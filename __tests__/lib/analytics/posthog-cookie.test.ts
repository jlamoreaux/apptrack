import { distinctIdFromCookieHeader } from "@/lib/analytics/posthog-cookie";

function phCookie(value: unknown) {
  return `ph_phc_abc123_posthog=${encodeURIComponent(JSON.stringify(value))}`;
}

describe("distinctIdFromCookieHeader", () => {
  it("reads distinct_id from the posthog-js cookie", () => {
    const header = `sb-access=xyz; ${phCookie({ distinct_id: "user-1", $sesid: [] })}; theme=dark`;
    expect(distinctIdFromCookieHeader(header)).toBe("user-1");
  });

  it("accepts a header split across array entries", () => {
    expect(distinctIdFromCookieHeader(["theme=dark", phCookie({ distinct_id: "u2" })])).toBe("u2");
  });

  it("returns undefined without the cookie", () => {
    expect(distinctIdFromCookieHeader("theme=dark")).toBeUndefined();
    expect(distinctIdFromCookieHeader(undefined)).toBeUndefined();
  });

  it("returns undefined for a malformed cookie", () => {
    expect(distinctIdFromCookieHeader("ph_phc_abc_posthog=%7Bnot-json")).toBeUndefined();
    expect(distinctIdFromCookieHeader(phCookie({ distinct_id: 42 }))).toBeUndefined();
  });
});
