// @jest-environment node
/**
 * Redirect targets after auth: same-origin paths only, checked twice, once as
 * a string and once by parsing against the origin. The URL parser strips
 * tab, LF and CR, so those (and every other control character and any
 * whitespace) are refused outright, including when they arrive
 * percent-encoded and are decoded by URLSearchParams. safeInternalPath hands
 * back the parsed path, so what is navigated to is what was checked.
 */

import { isValidInternalPath, resolveInternalUrl, safeInternalPath } from "@/lib/utils/internal-path";

const origin = "https://careerotter.io";

/** The value of `redirectTo` in a raw query string, decoded the way every caller reads it. */
function fromQuery(rawValue: string): string | null {
  return new URLSearchParams(`redirectTo=${rawValue}`).get("redirectTo");
}

it("accepts plain site-relative paths", () => {
  expect(isValidInternalPath("/dashboard/comp")).toBe(true);
  expect(isValidInternalPath("/try/unlock?session=abc")).toBe(true);
  expect(resolveInternalUrl("/dashboard/comp", origin)?.href).toBe(`${origin}/dashboard/comp`);
});

it.each([
  ["nothing", ""],
  ["a relative path", "dashboard"],
  ["a protocol-relative URL", "//evil.example/x"],
  ["an absolute URL", "https://evil.example/x"],
  ["a backslash the browser would read as a slash", "/\\evil.example"],
  ["an encoded backslash once decoded", decodeURIComponent("/%5Cevil.example")],
  ["a tab the URL parser strips", "/\t/evil.com"],
  ["a line feed the URL parser strips", "/\n/evil.com"],
  ["a carriage return the URL parser strips", "/\r/evil.com"],
  ["a NUL", "/\u0000/evil.com"],
  ["DEL", "/\u007F/evil.com"],
  ["a space", "/ /evil.com"],
  ["a no-break space", "/\u00A0/evil.com"],
  ["a line separator", "/\u2028/evil.com"],
  ["a non-string", 42],
])("rejects %s", (_label, path) => {
  expect(isValidInternalPath(path)).toBe(false);
  expect(resolveInternalUrl(path, origin)).toBeNull();
  expect(safeInternalPath(path, origin)).toBeNull();
});

it.each([
  ["%09", "/%09/evil.com"],
  ["%0a", "/%0a/evil.com"],
  ["%0A", "/%0A/evil.com"],
  ["%0d", "/%0d/evil.com"],
  ["%0D%0A", "/%0D%0A/evil.com"],
  ["%2F%2F (decodes to three slashes)", "/%2F%2Fevil.com"],
  ["%5C", "/%5Cevil.com"],
  ["an encoded protocol-relative URL", "%2F%2Fevil.com"],
])("rejects %s once URLSearchParams decodes it", (_label, raw) => {
  const decoded = fromQuery(raw);
  expect(safeInternalPath(decoded, origin)).toBeNull();
});

it("confirms the tab bypass is real: the URL parser would leave the origin", () => {
  expect(new URL("/\t/evil.com", origin).origin).toBe("https://evil.com");
});

describe("safeInternalPath", () => {
  it("returns the parsed pathname, query and hash of a same-origin path", () => {
    expect(safeInternalPath("/oauth/consent?client_id=a&state=x%20y#top", origin)).toBe(
      "/oauth/consent?client_id=a&state=x%20y#top"
    );
    expect(safeInternalPath("/try/unlock?session=abc", origin)).toBe("/try/unlock?session=abc");
  });

  it("keeps a double-encoded slash as a harmless same-origin path", () => {
    expect(safeInternalPath("/%2F%2Fevil.com", origin)).toBe("/%2F%2Fevil.com");
    expect(new URL(safeInternalPath("/%2F%2Fevil.com", origin) ?? "", origin).origin).toBe(origin);
  });

  it.each(["/\\evil.com", "//evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com"])(
    "never yields a path that navigates off-origin for %j",
    (path) => {
      const safe = safeInternalPath(path, origin);
      expect(safe === null || new URL(safe, origin).origin === origin).toBe(true);
    }
  );
});
