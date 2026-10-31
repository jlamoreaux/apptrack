import { distinctIdFromCookieHeader } from "@/lib/analytics/posthog-cookie";

const TOKEN = "phc_abc123";

function phCookie(value: unknown, token = TOKEN) {
  return `ph_${token}_posthog=${encodeURIComponent(JSON.stringify(value))}`;
}

describe("distinctIdFromCookieHeader", () => {
  it("reads distinct_id from the configured project's posthog-js cookie", () => {
    const header = `sb-access=xyz; ${phCookie({ distinct_id: "user-1", $sesid: [] })}; theme=dark`;
    expect(distinctIdFromCookieHeader(header, TOKEN)).toBe("user-1");
  });

  it("ignores another project's cookie that appears first", () => {
    const header = `${phCookie({ distinct_id: "other-project-user" }, "phc_other")}; ${phCookie({ distinct_id: "user-1" })}`;
    expect(distinctIdFromCookieHeader(header, TOKEN)).toBe("user-1");
  });

  it("accepts a header split across array entries", () => {
    expect(distinctIdFromCookieHeader(["theme=dark", phCookie({ distinct_id: "u2" })], TOKEN)).toBe("u2");
  });

  it("returns undefined without the cookie or without a configured project", () => {
    expect(distinctIdFromCookieHeader("theme=dark", TOKEN)).toBeUndefined();
    expect(distinctIdFromCookieHeader(undefined, TOKEN)).toBeUndefined();
    expect(distinctIdFromCookieHeader(phCookie({ distinct_id: "u3" }), undefined)).toBeUndefined();
  });

  it("returns undefined for a malformed cookie", () => {
    expect(distinctIdFromCookieHeader(`ph_${TOKEN}_posthog=%7Bnot-json`, TOKEN)).toBeUndefined();
    expect(distinctIdFromCookieHeader(phCookie({ distinct_id: 42 }), TOKEN)).toBeUndefined();
  });
});
