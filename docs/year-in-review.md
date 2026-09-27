# Year in Review

A once-a-year, story-style recap of a user's job search: what they sent, how it
moved, the work behind it, and a label describing the shape of their effort,
illustrated by the otter in `public/images/year-in-review/`.

## Scope of this change

| Area | What ships |
|---|---|
| Data fix | Status changes were written to `application_history` twice (the PUT route and `ApplicationDAL.update()` both wrote). `ApplicationDAL.update()` is now the single writer. The AI coach's status tool also wrote a third, malformed row (`user_id`/`status` columns do not exist), which made the tool report failure after a successful update. |
| Stats | `lib/year-in-review/compute.ts`: a pure function from rows to a typed `YearInReviewStats`. No I/O, fully unit-tested. |
| Labels | `lib/year-in-review/labels.ts`: seven labels, ordered rules, one guaranteed fallback. |
| Loading | `lib/year-in-review/load.ts`: server-only reads, every query scoped to the user. |
| Page | `/dashboard/year-in-review`: full-screen cards, tap/swipe/arrow navigation, reduced-motion aware. |
| Sharing | `POST /api/year-in-review/share` mints a signed link to `/year-in-review/[token]`, a public page with an Open Graph card and a downloadable 1080x1920 story image. |
| Launch gate | `YEAR_IN_REVIEW_ENABLED=1`. Unset, every surface 404s (same pattern as `CAREEROTTER_ENABLED`). |

Deferred on purpose: the AI-written summary (AI Coach tier), the December
announcement email, and career-mode (wins/comp) recaps beyond a wins count. Each
is additive and none blocks launch; see "Deferred" below.

## Critical review of the original plan

The first plan was reviewed before implementation. What changed and why:

1. **No snapshot table.** The plan stored each recap in a new
   `year_in_review` table so share links stay stable. The repo is mid-cutover
   from Supabase to Drizzle/Neon (`drizzle/README.md`), where every schema
   change needs a drizzle migration, drift checks and a parity pass. A table for
   one seasonal feature is poor value at that moment. Instead the share link
   carries its own data: a compact JSON payload signed with HMAC-SHA256
   (`lib/year-in-review/share-token.ts`). Stable, zero schema change.
   - Trade-off: a link cannot be revoked. Accepted because the payload holds
     only what the user chose to publish (aggregate counts, their label, and
     optionally the company they joined), never application-level data. The
     payload is signed, not encrypted, so anything in it is readable: whether
     the user was hired travels only with the opt-in company, never as a flag.
   - Fails closed: without `YEAR_IN_REVIEW_SHARE_SECRET`, share minting returns
     503 and share pages 404.

2. **No history row on create.** The plan added one so next year's data is
   complete. Rejected: `pipeline-utils`, Today's recent-hire move and the
   dashboard all read history assuming rows are transitions. A creation row
   changes their semantics for a marginal gain; `date_applied` already marks
   when an application started.

3. **Existing duplicates are collapsed at read time.** Removing the double
   write fixes new data only. `compute.ts` drops a history row identical to the
   previous one for the same application (same old/new status) within 60 seconds.

4. **Every user with 5+ applications gets a label.** The first rule set could
   leave someone unlabeled. Timing is now the fallback axis: anyone not matched
   by a behaviour rule is either The Sprint (concentrated) or The Long Game
   (spread out), which always resolves.

5. **Honest thresholds, not tuned ones.** The numbers in `labels.ts` are
   starting points and are exported constants so they can be tuned against real
   distributions (target: no label above ~40% of users).

6. **Silence is private.** The "still waiting to hear back" count appears in
   the user's own recap only. It is never included in a share payload.

7. **Timezones.** Year and week bucketing use the `date_applied` string
   (`YYYY-MM-DD`), not a `Date` in local time, so a user in UTC-8 and one in
   UTC+10 bucket the same application identically.

8. **Archived applications count.** Archiving hides an application; the effort
   still happened. Rejected applications are often archived, so excluding them
   would inflate every rate.

## Stats

All counts are for applications whose `date_applied` falls in the year.

- **Volume**: applications, distinct companies (case-insensitive), busiest
  month, busiest week (7-day buckets counted from Jan 1; the 1-2 day remainder
  at year end is never reported as a week), per-week counts for the year strip.
- **Roles**: most common normalized title (seniority words stripped), distinct
  title count.
- **Funnel**: reached interview / offer / hired, from current status or any
  history row. An application rejected after interviewing still counts as
  interviewed.
- **Response time**: median days from `date_applied` to the first recorded
  status change. Shown only with at least 3 data points, because history
  coverage before September 2026 is thin.
- **Silence**: still `Applied` 30+ days after `date_applied` (private).
- **Work**: cover letters, fit analyses (and best `fit_score`), interview
  preps, tailored resumes, LinkedIn contacts added and contacted, wins logged.
- **Outcome**: the most recent Hired application in the year, if any.

## Labels

Checked in order; first match wins. Fewer than 5 applications gets no label.

| Label | Rule |
|---|---|
| The Connector | 5+ LinkedIn contacts marked contacted |
| The Craftsperson | cover letters + tailored resumes >= 50% of applications |
| The Curator | <= 15 applications and >= 30% reached interview |
| The Researcher | fit analyses >= 50% of applications |
| The Explorer | 4+ distinct role titles and distinct/applications >= 30% |
| The Sprint | >= 50% of applications inside one 8-week window |
| The Long Game | everyone else |

## Launch checklist

1. Set `YEAR_IN_REVIEW_SHARE_SECRET` (32+ random bytes) in every environment.
2. Set `YEAR_IN_REVIEW_ENABLED=1` when the recap should go live (early December).
3. Check label distribution on real accounts; tune `LABEL_THRESHOLDS` if one
   label dominates.

## Deferred

- **AI summary.** A paragraph generated from `YearInReviewStats`, gated by
  `checkAICoachAccess`, cached per user and year. Needs a place to cache, which
  is the one reason a table might be justified later.
- **Announcement email.** One send through `runLifecycleSend`, filtered by the
  `digest` preference. The careerotter.io sending domain is still warming.
- **Career-mode recap.** Wins by tag and comp change, for `career_mode =
  employed` users.
