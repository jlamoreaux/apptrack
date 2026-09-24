/**
 * Stand-in for `@react-email/render`, an OPTIONAL peer dependency of `resend`.
 *
 * ## Why this exists
 *
 * `resend` supports two ways to supply an email body: `html` (a string) and `react` (a
 * React Email component). The `react` path lazily imports `@react-email/render`:
 *
 *     import("@react-email/render").then(({ render }) => …).catch(() => reject(…))
 *
 * This app only ever sends `html` — every template under `lib/email/templates/` is a plain
 * TypeScript string — so that import is dead code here, and the package is not installed.
 *
 * Webpack tolerated the unresolvable dynamic import. Turbopack, which Next.js 16 uses for
 * `next build` by default, treats it as a hard error and fails the build:
 *
 *     Module not found: Can't resolve '@react-email/render'
 *
 * Aliasing it here (see `turbopack.resolveAlias` in next.config.mjs) resolves the import
 * without pulling React Email — and its transitive React renderer — into the bundle, which
 * matters for the Cloudflare Workers bundle-size budget.
 *
 * ## Why this throws rather than being an empty module
 *
 * An empty stub would let the import succeed and then fail with `render2 is not a function`
 * at send time — a confusing error a long way from its cause. Throwing here preserves the
 * behaviour resend intended: if someone starts passing `react:` templates, they get a clear
 * instruction instead of a mystery.
 *
 * Remove this stub and install the real package if React Email templates are ever adopted.
 */

const MESSAGE =
  "@react-email/render is not installed. This app sends `html` strings, so it is aliased " +
  "to a stub in next.config.mjs. To use resend's `react:` option, install " +
  "@react-email/render and remove the alias.";

export function render(): never {
  throw new Error(MESSAGE);
}

export function renderAsync(): never {
  throw new Error(MESSAGE);
}

export default { render, renderAsync };
