/**
 * @jest-environment node
 */
/**
 * Tests for lib/http/request.ts:
 * - readBodyWithinLimit: a declared Content-Length over the cap is refused
 *   without reading; a streamed body is read up to the cap and refused past
 *   it; no body reads as ""; a stream that errors midway is `unreadable`
 * - rateLimitIpKey: IPv4 unchanged, IPv6 reduced to its /64 across spellings,
 *   IPv4-mapped IPv6 reduced to the IPv4 address, junk unchanged
 * - retryAfterSeconds: rounded up, at least 1
 * - clientIp: first X-Forwarded-For hop, then X-Real-IP, then "unknown"
 *
 * jest.setup.js replaces Request with a minimal mock; this suite installs the
 * edge-runtime primitives bundled with Next.js.
 */

import {
  clientIp,
  rateLimitIpKey,
  readBodyWithinLimit,
  retryAfterSeconds,
} from "@/lib/http/request";

const fetchPrimitives = jest.requireActual("next/dist/compiled/@edge-runtime/primitives");
global.Request = fetchPrimitives.Request;
global.Headers = fetchPrimitives.Headers;

const URL_UNDER_TEST = "http://localhost:3000/api/x";
const MAX_BYTES = 16;

function streamOf(chunks: string[], failAfter = false): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new fetchPrimitives.ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (failAfter) controller.error(new Error("client went away"));
      else controller.close();
    },
  });
}

function streamedRequest(stream: ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request {
  return new Request(URL_UNDER_TEST, {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit);
}

describe("readBodyWithinLimit", () => {
  it("refuses a declared Content-Length over the cap without reading the body", async () => {
    const stream = streamOf(["{}"]);
    const request = streamedRequest(stream, { "content-length": String(MAX_BYTES + 1) });
    expect(await readBodyWithinLimit(request, MAX_BYTES)).toEqual({ ok: false, reason: "too_large" });
    expect(request.bodyUsed).toBe(false);
  });

  it("reads a body whose declared length fits", async () => {
    const request = new Request(URL_UNDER_TEST, { method: "POST", body: '{"a":1}' });
    expect(await readBodyWithinLimit(request, MAX_BYTES)).toEqual({ ok: true, text: '{"a":1}' });
  });

  it("reads a streamed body with no declared length, across chunks", async () => {
    const request = streamedRequest(streamOf(["{\"a\":", "\"é\"}"]));
    expect(await readBodyWithinLimit(request, MAX_BYTES)).toEqual({ ok: true, text: '{"a":"é"}' });
  });

  it("refuses a streamed body once it passes the cap", async () => {
    const request = streamedRequest(streamOf(["a".repeat(MAX_BYTES), "b"]));
    expect(await readBodyWithinLimit(request, MAX_BYTES)).toEqual({ ok: false, reason: "too_large" });
  });

  it("refuses a body that understates its Content-Length", async () => {
    const request = streamedRequest(streamOf(["a".repeat(MAX_BYTES + 1)]), { "content-length": "1" });
    expect(await readBodyWithinLimit(request, MAX_BYTES)).toEqual({ ok: false, reason: "too_large" });
  });

  it("reads a request with no body as empty", async () => {
    expect(await readBodyWithinLimit(new Request(URL_UNDER_TEST), MAX_BYTES)).toEqual({ ok: true, text: "" });
  });

  it("reports a stream that errors midway as unreadable instead of throwing", async () => {
    const request = streamedRequest(streamOf(["{\"a\":"], true));
    expect(await readBodyWithinLimit(request, MAX_BYTES)).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("rateLimitIpKey", () => {
  it.each(["203.0.113.7", "unknown", "", "not an ip"])("leaves %j unchanged", (ip) => {
    expect(rateLimitIpKey(ip)).toBe(ip);
  });

  it.each([
    ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
    ["2001:db8:1:2::1", "2001:db8:1:2::/64"],
    ["2001:0DB8:0001:0002:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"],
    ["[2001:db8:1:2::abcd]", "2001:db8:1:2::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    ["2001:db8::", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["::", "0:0:0:0::/64"],
    ["64:ff9b::192.0.2.33", "64:ff9b:0:0::/64"],
  ])("keys %s on its /64", (ip, key) => {
    expect(rateLimitIpKey(ip)).toBe(key);
  });

  it("puts every address in one /64 on the same key", () => {
    const keys = ["2001:db8:aa:bb::1", "2001:db8:aa:bb:ffff::2", "2001:db8:aa:bb:1:2:3:4"].map(rateLimitIpKey);
    expect(new Set(keys).size).toBe(1);
    expect(rateLimitIpKey("2001:db8:aa:bc::1")).not.toBe(keys[0]);
  });

  it.each([
    ["::ffff:203.0.113.7", "203.0.113.7"],
    ["::ffff:cb00:7107", "203.0.113.7"],
    ["0:0:0:0:0:ffff:203.0.113.7", "203.0.113.7"],
  ])("keys the IPv4-mapped address %s as its IPv4 address", (ip, key) => {
    expect(rateLimitIpKey(ip)).toBe(key);
  });

  it.each(["1::2::3", "1:2:3:4:5:6:7:8:9", "1:2:3", "2001:db8::zzzz", "::ffff:300.1.1.1", "203.0.113.7:8080"])(
    "leaves the malformed address %s unchanged",
    (ip) => {
      expect(rateLimitIpKey(ip)).toBe(ip);
    }
  );
});

describe("retryAfterSeconds", () => {
  it("rounds up to whole seconds and is never below 1", () => {
    expect(retryAfterSeconds(10_000, 0)).toBe(10);
    expect(retryAfterSeconds(10_001, 0)).toBe(11);
    expect(retryAfterSeconds(500, 0)).toBe(1);
    expect(retryAfterSeconds(0, 0)).toBe(1);
    expect(retryAfterSeconds(0, 5_000)).toBe(1);
  });
});

describe("clientIp", () => {
  it("prefers the first X-Forwarded-For hop, then X-Real-IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1", "x-real-ip": "10.0.0.2" }))).toBe(
      "198.51.100.1"
    );
    expect(clientIp(new Headers({ "x-real-ip": "10.0.0.2" }))).toBe("10.0.0.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
