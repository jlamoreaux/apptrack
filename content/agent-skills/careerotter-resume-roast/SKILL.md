---
name: careerotter-resume-roast
description: Get blunt, specific resume feedback from CareerOtter's Resume Roast, and read a shared roast's score and categories from its permalink.
---

# CareerOtter Resume Roast

Resume Roast reads a resume and returns harsh, specific, entertaining feedback
plus a numeric score. It is free and needs no account.

## Getting a roast

Send the person to `/roast-my-resume` and have them upload a PDF or DOCX resume.
There is no API for creating a roast: uploads are rate limited per browser and
per IP, and the endpoint expects a multipart form from the site's own page.

Roasts are scored 0-100 with a label, and broken into per-category notes
(formatting, content, impact, and so on). Every roast gets a shareable permalink
at `/roast/<shareableId>`.

## Reading a shared roast

Given a permalink someone has shared with you, you can read the structured
result:

```
GET https://careerotter.io/api/roast/{shareableId}
Accept: application/json
```

A 200 response looks like:

```json
{
  "content": "The roast text, in markdown.",
  "score": 62,
  "scoreLabel": "Needs work",
  "firstName": "Sam",
  "categories": [{ "name": "Impact", "score": 40, "note": "..." }],
  "createdAt": "2026-02-01T12:00:00.000Z",
  "viewCount": 12
}
```

Handle these failures explicitly:

- **404** — no roast with that id. The link is wrong or was never valid.
- **410** — the roast expired. Roasts are deliberately short-lived; suggest
  running a new one at `/roast-my-resume` rather than retrying.

`shareableId` is the last path segment of a `/roast/...` URL. Nothing else in
the response identifies the person beyond the first name they supplied.

## Using a roast well

The score alone is not useful advice. When summarizing a roast for someone, lead
with the lowest-scoring category and the one concrete fix named in its note.
Roast output is intentionally blunt; soften the tone if the person asked for
encouragement, but do not drop the substance of the criticism.
