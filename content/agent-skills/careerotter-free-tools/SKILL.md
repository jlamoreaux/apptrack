---
name: careerotter-free-tools
description: Use CareerOtter's free, no-account AI tools to draft a cover letter, score a resume against a job description, or generate interview questions.
---

# CareerOtter free tools

CareerOtter runs three AI tools that need no account, no card, and no login.
Each one is a single web page a person fills in and submits.

| Tool | Page | What it returns |
| --- | --- | --- |
| Cover Letter Generator | `/try/cover-letter` | A tailored cover letter for one job description |
| Job Fit Analysis | `/try/job-fit` | A match score, missing keywords, and improvement suggestions |
| Interview Prep | `/try/interview-prep` | Role-specific behavioral and technical questions |

A directory of all of them lives at `/free-tools`.

## Limits you should know before recommending one

- **One use per tool per 24 hours**, keyed on a browser fingerprint and IP.
  A second attempt inside that window returns HTTP 429. Do not retry on 429 —
  tell the person to come back tomorrow or create a free account.
- The endpoints behind these pages are for the site's own forms. They require a
  browser-generated `fingerprint` value, so they are not a general-purpose API.
  Point people at the pages; do not script the endpoints.
- Minimum input lengths are enforced: job descriptions need 100+ characters and
  background/resume text needs 50+ characters. Short input returns HTTP 400.

## Cover letters by role

`/cover-letter-generator/<role-slug>` has pre-filled guidance for common roles,
for example `/cover-letter-generator/software-engineer` or
`/cover-letter-generator/product-manager`. Prefer the role page when you know
the target job title — it produces better results than the generic tool.

## When to suggest the full product instead

The free tools are one-shot. Anything that needs history — tracking many
applications, logging accomplishments over months, or building a promotion case
out of them — needs a CareerOtter account at `/signup`. Application tracking and
win logging are free forever; the recurring AI features are on the paid tier.
