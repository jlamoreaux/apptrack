// @jest-environment node
/**
 * Redirect targets after auth: same-origin paths only, checked twice, once as
 * a string and once by parsing against the origin.
 */

import { isValidInternalPath, resolveInternalUrl } from "@/lib/utils/internal-path";

const origin = "https://careerotter.io";

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
  ["a non-string", 42],
])("rejects %s", (_label, path) => {
  expect(isValidInternalPath(path)).toBe(false);
  expect(resolveInternalUrl(path, origin)).toBeNull();
});
