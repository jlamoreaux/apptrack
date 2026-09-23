/** Response helpers shared by the OAuth endpoints and metadata documents. */

import { AGENT_OAUTH_FORM_CONTENT_TYPE } from "@/lib/constants/agent-oauth";

const HTTP_NO_CONTENT = 204;
const HTTP_NOT_FOUND = 404;
const JSON_CONTENT_TYPE = "application/json";

/** The same bare 404 the middleware sends for a surface that's switched off. */
export function oauthNotFound(): Response {
  return new Response("Not Found", { status: HTTP_NOT_FOUND });
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
  return new Response(null, { status: HTTP_NO_CONTENT, headers: corsHeaders });
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
