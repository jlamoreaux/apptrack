/** Request helpers shared by route handlers that read bodies and key limits by IP. */

const UNKNOWN_IP = "unknown";

/** The Content-Length header as a number; 0 when absent or not a number. */
export function declaredContentLength(request: Request): number {
  const header = request.headers.get("content-length");
  const length = header === null ? 0 : Number(header);
  return Number.isFinite(length) ? length : 0;
}

/** Reads the stream as UTF-8, or returns null as soon as it exceeds maxBytes. */
export async function readCappedText(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<string | null> {
  if (stream === null) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

/** The body text when both the declared and the actual size fit maxBytes, else null. */
export async function readBodyWithinLimit(
  request: Request,
  maxBytes: number
): Promise<string | null> {
  if (declaredContentLength(request) > maxBytes) return null;
  return readCappedText(request.body, maxBytes);
}

/** The client IP from the platform's forwarding headers, for rate-limit keys. */
export function clientIp(headers: Headers): string {
  const forwardedFirstHop = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFirstHop || headers.get("x-real-ip")?.trim() || UNKNOWN_IP;
}
