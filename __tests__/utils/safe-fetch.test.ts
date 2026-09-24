/**
 * SSRF guard tests.
 *
 * `assertResolvesPublic` was rewritten from `dns/promises` `lookup()` to DNS-over-HTTPS,
 * because `node:dns` does not exist on Cloudflare Workers even with `nodejs_compat`. These
 * tests pin the behaviour that matters: a hostname resolving to a private address is
 * rejected, and a DNS failure is NOT treated as a rejection (the subsequent fetch produces
 * the user-facing error instead).
 */

import {
  isBlockedIp,
  isBlockedHost,
  assertResolvesPublic,
} from "@/lib/utils/safe-fetch";

/** Shapes a DoH JSON response. `type` 1 = A, 28 = AAAA. */
function dohResponse(answers: Array<{ type: number; data: string }>) {
  return {
    ok: true,
    json: async () => ({ Answer: answers }),
  } as unknown as Response;
}

describe("isBlockedIp", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.1.2.3", "private 10/8"],
    ["172.16.0.1", "private 172.16/12"],
    ["172.31.255.255", "private 172.31 upper bound"],
    ["192.168.1.1", "private 192.168/16"],
    ["169.254.169.254", "cloud metadata"],
    ["0.0.0.0", "unspecified"],
    ["::1", "IPv6 loopback"],
    ["fe80::1", "IPv6 link-local"],
    ["fc00::1", "IPv6 unique-local"],
    ["::ffff:127.0.0.1", "v4-mapped loopback"],
    ["::ffff:10.0.0.1", "v4-mapped private"],
  ])("blocks %s (%s)", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each([
    ["8.8.8.8", "public DNS"],
    ["1.1.1.1", "public DNS"],
    ["172.15.0.1", "just below the private 172.16 range"],
    ["172.32.0.1", "just above the private 172.31 range"],
    ["192.169.0.1", "adjacent to 192.168 but public"],
    ["2606:4700:4700::1111", "public IPv6"],
  ])("allows %s (%s)", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("isBlockedHost", () => {
  it.each(["localhost", "foo.localhost", "db.internal", "LOCALHOST"])(
    "blocks %s",
    (host) => {
      expect(isBlockedHost(host)).toBe(true);
    }
  );

  it("blocks a bare IP literal that resolves to a private range", () => {
    expect(isBlockedHost("169.254.169.254")).toBe(true);
  });

  it("allows an ordinary public hostname", () => {
    expect(isBlockedHost("example.com")).toBe(false);
  });
});

describe("assertResolvesPublic (DNS-over-HTTPS)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("rejects a public hostname that resolves to a private address", async () => {
    // The DNS-rebinding case: the name looks fine, the address does not.
    global.fetch = jest
      .fn()
      .mockResolvedValue(dohResponse([{ type: 1, data: "10.0.0.5" }]));

    await expect(assertResolvesPublic("evil.example.com")).rejects.toThrow(
      "Blocked host"
    );
  });

  it("rejects when only the AAAA record is private", async () => {
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("type=AAAA")
          ? dohResponse([{ type: 28, data: "fc00::1" }])
          : dohResponse([{ type: 1, data: "93.184.216.34" }])
      )
    );

    await expect(assertResolvesPublic("mixed.example.com")).rejects.toThrow(
      "Blocked host"
    );
  });

  it("allows a hostname resolving only to public addresses", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(dohResponse([{ type: 1, data: "93.184.216.34" }]));

    await expect(assertResolvesPublic("example.com")).resolves.toBeUndefined();
  });

  it("ignores CNAME records and validates only A/AAAA answers", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      dohResponse([
        { type: 5, data: "cdn.example.net." }, // CNAME — not connectable
        { type: 1, data: "93.184.216.34" },
      ])
    );

    await expect(assertResolvesPublic("www.example.com")).resolves.toBeUndefined();
  });

  it("does not reject when DNS resolution fails", async () => {
    // Deliberate: a resolution failure should fall through so the real fetch
    // produces the user-facing error, rather than masquerading as an SSRF block.
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

    await expect(assertResolvesPublic("example.com")).resolves.toBeUndefined();
  });

  it("does not reject on a non-OK DoH response", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({}) } as Response);

    await expect(assertResolvesPublic("example.com")).resolves.toBeUndefined();
  });

  it("queries the DoH endpoint with the dns-json accept header", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue(dohResponse([{ type: 1, data: "93.184.216.34" }]));
    global.fetch = mockFetch;

    await assertResolvesPublic("example.com");

    expect(mockFetch).toHaveBeenCalledTimes(2); // A and AAAA
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("cloudflare-dns.com/dns-query");
    expect(url).toContain("name=example.com");
    expect(init.headers.accept).toBe("application/dns-json");
  });

  it("strips brackets from IPv6 literals before querying", async () => {
    const mockFetch = jest.fn().mockResolvedValue(dohResponse([]));
    global.fetch = mockFetch;

    await assertResolvesPublic("[2606:4700::1111]");

    expect(mockFetch.mock.calls[0][0]).not.toContain("%5B");
  });
});
