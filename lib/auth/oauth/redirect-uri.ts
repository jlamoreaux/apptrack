/**
 * OAuth redirect URIs: what registration accepts, how an authorization
 * request's redirect_uri is matched against the registered ones, and how a
 * URI is described to the user on the consent screen.
 *
 * Registered URIs are stored exactly as sent; validation parses them, but
 * matching compares the raw strings so nothing a parser normalizes can make
 * two different URIs match.
 */

import {
  AGENT_OAUTH_DENIED_REDIRECT_SCHEMES,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_LOOPBACK_HOSTS,
  AGENT_OAUTH_PRIVATE_USE_SCHEME_PATTERN,
} from "@/lib/constants/agent-oauth";
import { hasCredentials, hasFragment, parseUrl } from "@/lib/auth/oauth/url";

/** The three kinds of redirect URI registration accepts. */
export type RedirectUriKind = "https" | "loopback" | "private_use";

export type RedirectUriValidation =
  | { ok: true; kinds: RedirectUriKind[] }
  | { ok: false; message: string };

const HTTPS_PROTOCOL = "https:";
const HTTP_PROTOCOL = "http:";
const TRAILING_DOT = /\.$/;
const LOOPBACK_DISPLAY_HOST = "localhost";

// Splits a raw loopback URI into host, optional port and the rest (path and
// query), so two loopback URIs can be compared with only the port ignored.
const LOOPBACK_URI_PATTERN = new RegExp(
  `^http://(${AGENT_OAUTH_LOOPBACK_HOSTS.map(escapeRegExp).join("|")})(?::(\\d{1,5}))?([/?].*)?$`
);

const MESSAGES = {
  count: `redirect_uris must have 1 to ${AGENT_OAUTH_LIMITS.redirectUrisMax} entries`,
  length: `Each redirect URI must be at most ${AGENT_OAUTH_LIMITS.redirectUriMaxLength} characters`,
  notUrl: "Each redirect URI must be an absolute URI",
  fragment: "Redirect URIs must not contain a fragment",
  credentials: "Redirect URIs must not contain credentials",
  ownHost: "Redirect URIs must not point at CareerOtter itself",
  httpNotLoopback: "http redirect URIs are allowed only on 127.0.0.1, [::1] or localhost",
  scheme: "Redirect URI scheme is not allowed",
} as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLoopbackHost(hostname: string): boolean {
  return AGENT_OAUTH_LOOPBACK_HOSTS.some((host) => host === hostname);
}

function isDeniedScheme(scheme: string): boolean {
  return AGENT_OAUTH_DENIED_REDIRECT_SCHEMES.some((denied) => denied === scheme);
}

// A trailing dot names the same host in DNS, so "careerotter.io." is ours too.
function bareHostname(hostname: string): string {
  return hostname.replace(TRAILING_DOT, "");
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
 * are the hostnames of the accepted origins: a code must never land on our
 * own site, where page analytics would capture it.
 */
function classifyForRegistration(
  raw: string,
  ownHosts: ReadonlySet<string>
): { ok: true; kind: RedirectUriKind } | { ok: false; message: string } {
  if (raw.length > AGENT_OAUTH_LIMITS.redirectUriMaxLength) {
    return { ok: false, message: MESSAGES.length };
  }
  if (hasFragment(raw)) return { ok: false, message: MESSAGES.fragment };
  const url = parseUrl(raw);
  if (url === null) return { ok: false, message: MESSAGES.notUrl };
  if (hasCredentials(url)) return { ok: false, message: MESSAGES.credentials };
  const kind = structuralKind(url);
  if (kind === null) return { ok: false, message: rejectionFor(url) };
  if (kind === "https" && ownHosts.has(bareHostname(url.hostname))) {
    return { ok: false, message: MESSAGES.ownHost };
  }
  return { ok: true, kind };
}

function hostnamesOf(origins: readonly string[]): Set<string> {
  return new Set(origins.map((origin) => bareHostname(new URL(origin).hostname)));
}

/**
 * Registration-time check of a client's redirect URIs (RFC 8252 and OAuth
 * 2.1 §2.3.1): 1 to 5 absolute URIs of at most 512 characters, none with a
 * fragment or credentials, each an https URI not on one of `acceptedOrigins`,
 * an http loopback URI (any port), or a private-use scheme outside the
 * denylist. Returns each URI's kind, in order.
 */
export function validateRedirectUris(
  uris: readonly string[],
  acceptedOrigins: readonly string[]
): RedirectUriValidation {
  if (uris.length === 0 || uris.length > AGENT_OAUTH_LIMITS.redirectUrisMax) {
    return { ok: false, message: MESSAGES.count };
  }
  const ownHosts = hostnamesOf(acceptedOrigins);
  const kinds: RedirectUriKind[] = [];
  for (const uri of uris) {
    const classified = classifyForRegistration(uri, ownHosts);
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
