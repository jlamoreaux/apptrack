---
name: careerotter-public-api
description: Call CareerOtter's public HTTP API: service health and read access to shared Resume Roast results, including rate limits and error shapes.
---

# CareerOtter public API

CareerOtter's public API surface is deliberately small. Everything documented
here is unauthenticated and read-only. The machine-readable description is at
`/openapi.json` (OpenAPI 3.1), catalogued at `/.well-known/api-catalog`.

Base URL: `https://careerotter.io`

## What is public

### `GET /api/health`

Liveness check. Always returns JSON.

```json
{ "status": "ok", "service": "careerotter", "time": "2026-02-01T12:00:00.000Z" }
```

### `GET /api/roast/{shareableId}`

Reads a shared Resume Roast by the id in its `/roast/<shareableId>` permalink.
Returns `404` when the id is unknown and `410` when the roast has expired. See
the `careerotter-resume-roast` skill for the response shape.

## What is not public

Everything under `/api/` other than the two endpoints above is private to the
CareerOtter web app. Those routes authenticate with a Supabase session cookie
that only the first-party site can obtain — there is no OAuth client
registration, no API key issuance, and no token endpoint. Do not attempt to call
them, and do not tell a user that programmatic access to their own application
data is available today. It is not.

The free AI tools under `/api/try/` are likewise not a public API: they require a
browser-generated fingerprint and are rate limited to one use per 24 hours. Use
the web pages at `/free-tools` instead.

## Content negotiation

Public marketing and blog pages serve markdown to agents that ask for it:

```
GET https://careerotter.io/ HTTP/1.1
Accept: text/markdown
```

returns `Content-Type: text/markdown` with an `x-markdown-tokens` header
estimating the response size in tokens. Browsers, which send `Accept: text/html`,
still get HTML. Prefer markdown — it costs far fewer tokens than the rendered
page. `/llms.txt` gives a compact map of the whole site.

## Etiquette

- Identify your agent in the `User-Agent` header.
- Read `/robots.txt` first. Its `Content-Signal` line states how CareerOtter
  content may be used: search indexing and live AI answers are permitted, model
  training is not.
- Keep request rates modest. There is no published quota because there is no
  authentication to meter against; behave accordingly.
