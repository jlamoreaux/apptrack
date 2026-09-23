/** Response helpers shared by the OAuth endpoints and metadata documents. */

import { AGENT_OAUTH_FORM_CONTENT_TYPE } from "@/lib/constants/agent-oauth";
import { HTTP_STATUS } from "@/lib/constants/http-status";

const JSON_CONTENT_TYPE = "application/json";

/** The same bare 404 the middleware sends for a surface that's switched off. */
export function oauthNotFound(): Response {
  return new Response("Not Found", { status: HTTP_STATUS.NOT_FOUND });
}

export function oauthJson(
  body: unknown,
  status: number,
  headers: Readonly<Record<string, string>>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": JSON_CONTENT_TYPE, ...headers },
  });
}

/** A CORS preflight answer carrying `corsHeaders`. */
export function oauthPreflight(corsHeaders: Readonly<Record<string, string>>): Response {
  return new Response(null, { status: HTTP_STATUS.NO_CONTENT, headers: corsHeaders });
}

/** The Content-Type's media type, lowercased and without parameters. */
function mediaTypeOf(headers: Headers): string | undefined {
  return headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
}

/** True when the Content-Type's media type is application/json. */
export function isJsonContentType(headers: Headers): boolean {
  return mediaTypeOf(headers) === JSON_CONTENT_TYPE;
}

/** True when the Content-Type's media type is application/x-www-form-urlencoded. */
export function isFormContentType(headers: Headers): boolean {
  return mediaTypeOf(headers) === AGENT_OAUTH_FORM_CONTENT_TYPE;
}

/**
 * A form parameter's value, with an empty one read as absent (RFC 6749 §3.1:
 * parameters sent without a value are treated as omitted).
 */
export function formParam(form: URLSearchParams, name: string): string | null {
  const value = form.get(name);
  return value === null || value === "" ? null : value;
}
