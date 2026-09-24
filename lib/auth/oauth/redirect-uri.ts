/**
 * OAuth redirect URIs: what registration accepts, how an authorization
 * request's redirect_uri is matched against the registered ones, and how a
 * URI is described to the user on the consent screen.
 *
 * Registered URIs are the raw strings from the registration body, stored
 * exactly as sent: never the output of a URL parser or schema, which would
 * lowercase the host, drop a default port, resolve dot segments or encode
 * characters, so the client's own string would no longer match. Validation
 * parses a copy, after refusing strings a parser would rewrite (whitespace,
 * control characters, lone surrogates). Matching compares the raw strings, so
 * nothing a parser normalizes can make two different URIs match.
 */

import {
  AGENT_OAUTH_DENIED_REDIRECT_SCHEMES,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_LOOPBACK_HOSTS,
  AGENT_OAUTH_PRIVATE_USE_SCHEME_PATTERN,
  bareHostname,
} from "@/lib/constants/agent-oauth";
import {
  hasCredentials,
  hasFragment,
  hasUnsafeUriCharacters,
  parseUrl,
} from "@/lib/auth/oauth/url";
import { escapeRegExp } from "@/lib/utils/escape-regexp";
import type { RedirectUriKind } from "@/types";

export type RedirectUriValidation =
  | { ok: true; kinds: RedirectUriKind[] }
  | { ok: false; message: string };

const HTTPS_PROTOCOL = "https:";
const HTTP_PROTOCOL = "http:";
const LOOPBACK_DISPLAY_HOST = "localhost";

// A raw loopback URI, split into host, optional port and the rest (path and
// query) so two loopback URIs can be compared with only the port ignored.
// Case-sensitive on purpose: RFC 8252 §7.3 matches the loopback host exactly,
// so the scheme and host must be the lowercase literals, and a host URL would
// rewrite into one (127.1, 0x7f000001, "127.0.0.1.", [0:0:0:0:0:0:0:1],
// LOCALHOST) is refused rather than normalized.
const LOOPBACK_URI_PATTERN = new RegExp(
  `^http://(${AGENT_OAUTH_LOOPBACK_HOSTS.map(escapeRegExp).join("|")})(?::(\\d{1,5}))?([/?].*)?$`
);

const MESSAGES = {
  count: `redirect_uris must have 1 to ${AGENT_OAUTH_LIMITS.redirectUrisMax} entries`,
  length: `Each redirect URI must be at most ${AGENT_OAUTH_LIMITS.redirectUriMaxLength} characters`,
  characters: "Redirect URIs must not contain whitespace, control characters or invalid Unicode",
  notUrl: "Each redirect URI must be an absolute URI",
  fragment: "Redirect URIs must not contain a fragment",
  credentials: "Redirect URIs must not contain credentials",
  ownHost: "Redirect URIs must not point at CareerOtter itself",
  httpNotLoopback: "http redirect URIs are allowed only on 127.0.0.1, [::1] or localhost",
  scheme: "Redirect URI scheme is not allowed",
} as const;

function isLoopbackHost(hostname: string): boolean {
  return AGENT_OAUTH_LOOPBACK_HOSTS.some((host) => host === hostname);
}

function isDeniedScheme(scheme: string): boolean {
  return AGENT_OAUTH_DENIED_REDIRECT_SCHEMES.some((denied) => denied === scheme);
}

/** The URI's kind by structure alone, before the own-host ban. */
function structuralKind(url: URL): RedirectUriKind | null {
  if (url.protocol === HTTPS_PROTOCOL) return "https";
  if (url.protocol === HTTP_PROTOCOL) return isLoopbackHost(url.hostname) ? "loopback" : null;
  const scheme = url.protocol.slice(0, -1);
  if (!AGENT_OAUTH_PRIVATE_USE_SCHEME_PATTERN.test(scheme) || isDeniedScheme(scheme)) {
    return null;
  }
  return "private_use";
}

function rejectionFor(url: URL): string {
  if (url.protocol === HTTP_PROTOCOL) return MESSAGES.httpNotLoopback;
  return MESSAGES.scheme;
}

/**
 * The kind of one registered redirect URI, or why it's refused. `ownHosts`
 * are bare hostnames that serve or redirect to this app: a code must never
 * land on our own site, where page analytics would capture it.
 */
function classifyForRegistration(
  raw: string,
  ownHosts: ReadonlySet<string>
): { ok: true; kind: RedirectUriKind } | { ok: false; message: string } {
  if (raw.length > AGENT_OAUTH_LIMITS.redirectUriMaxLength) {
    return { ok: false, message: MESSAGES.length };
  }
  if (hasUnsafeUriCharacters(raw)) return { ok: false, message: MESSAGES.characters };
  if (hasFragment(raw)) return { ok: false, message: MESSAGES.fragment };
  const url = parseUrl(raw);
  if (url === null) return { ok: false, message: MESSAGES.notUrl };
  if (hasCredentials(url)) return { ok: false, message: MESSAGES.credentials };
  const kind = structuralKind(url);
  if (kind === null) return { ok: false, message: rejectionFor(url) };
  // The parsed host alone would accept spellings URL rewrites to a loopback
  // host; the raw string must already be in the exact form matching uses.
  if (kind === "loopback" && !LOOPBACK_URI_PATTERN.test(raw)) {
    return { ok: false, message: MESSAGES.httpNotLoopback };
  }
  if (kind === "https" && ownHosts.has(bareHostname(url.hostname))) {
    return { ok: false, message: MESSAGES.ownHost };
  }
  return { ok: true, kind };
}

/**
 * Registration-time check of a client's raw redirect URIs (RFC 8252 and
 * OAuth 2.1 §2.3.1): 1 to 5 absolute URIs of at most 512 characters, none
 * with whitespace, control characters, lone surrogates, a fragment or
 * credentials, each an https URI not on one of `ownHosts` (see
 * getOwnHostnames), an http loopback URI in its exact lowercase form (any
 * port), or a private-use scheme outside the denylist. Returns each URI's
 * kind, in order.
 */
export function validateRedirectUris(
  uris: readonly string[],
  ownHosts: readonly string[]
): RedirectUriValidation {
  if (uris.length === 0 || uris.length > AGENT_OAUTH_LIMITS.redirectUrisMax) {
    return { ok: false, message: MESSAGES.count };
  }
  const ownHostSet = new Set(ownHosts.map(bareHostname));
  const kinds: RedirectUriKind[] = [];
  for (const uri of uris) {
    const classified = classifyForRegistration(uri, ownHostSet);
    if (!classified.ok) return classified;
    kinds.push(classified.kind);
  }
  return { ok: true, kinds };
}

interface LoopbackParts {
  host: string;
  rest: string;
}

function loopbackParts(raw: string): LoopbackParts | null {
  const match = LOOPBACK_URI_PATTERN.exec(raw);
  return match ? { host: match[1], rest: match[3] ?? "" } : null;
}

function isWellFormedPresentedUri(raw: string): boolean {
  return !hasFragment(raw) && parseUrl(raw) !== null;
}

/**
 * The registered URI that `presented` matches, exactly as registered, or
 * null. Matching is exact string equality, except that loopback URIs may
 * differ in port (RFC 8252 §7.3): scheme, host, path and query still match
 * exactly.
 */
export function matchRegisteredRedirectUri(
  presented: string,
  registered: readonly string[]
): string | null {
  const exact = registered.find((uri) => uri === presented);
  if (exact !== undefined) return exact;
  if (!isWellFormedPresentedUri(presented)) return null;
  const presentedParts = loopbackParts(presented);
  if (presentedParts === null) return null;
  const loopbackMatch = registered.find((uri) => {
    const parts = loopbackParts(uri);
    return parts !== null && parts.host === presentedParts.host && parts.rest === presentedParts.rest;
  });
  return loopbackMatch ?? null;
}

function loopbackDisplay(url: URL): string {
  const host = url.port === "" ? LOOPBACK_DISPLAY_HOST : `${LOOPBACK_DISPLAY_HOST}:${url.port}`;
  return `an app on this computer (${host})`;
}

/**
 * Where the consent screen says the user will be sent back: the hostname for
 * https, "an app on this computer (localhost:PORT)" for loopback, and "the
 * <scheme> app" for a private-use scheme. Anything else is shown raw.
 */
export function redirectUriDisplay(uri: string): string {
  const url = parseUrl(uri);
  if (url === null) return uri;
  switch (structuralKind(url)) {
    case "https":
      return url.hostname;
    case "loopback":
      return loopbackDisplay(url);
    case "private_use":
      return `the ${url.protocol.slice(0, -1)} app`;
    case null:
      return uri;
  }
}
