/** HTTP status codes used by API routes and the browser clients that call them. */
export const HTTP_STATUS = {
  OK: 200,
  FOUND: 302,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR_MIN: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
