/**
 * Clickjacking protection for the OAuth pages (/oauth/authorize, /oauth/consent
 * and /oauth/error): no site may frame them, so an Approve click can't be
 * tricked out of a user through an invisible overlay. CSP frame-ancestors for
 * current browsers, X-Frame-Options for older ones.
 *
 * Plain `.mjs` because next.config.mjs is loaded by Node directly and cannot
 * import TypeScript.
 */
export const OAUTH_PAGES_SOURCE = "/oauth/:path*";

export const OAUTH_FRAMING_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

export function oauthFramingHeaders() {
  return [{ source: OAUTH_PAGES_SOURCE, headers: OAUTH_FRAMING_HEADERS }];
}
