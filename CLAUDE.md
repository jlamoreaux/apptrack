# AppTrack Development Guide

## Critical Rules

1. **NEVER run dev/build commands** (`pnpm dev`, `pnpm build`, `pnpm start`) - user handles these
2. **NEVER commit unless explicitly asked** - wait for "commit", "please commit", etc.
3. **NEVER co-author commits** - no `Co-Authored-By` lines in commit messages
4. **NEVER access Supabase from client components** - use API routes instead
5. **ALWAYS check `./schemas/` before writing database code** - verify field names match

---

## UI Style Guide

### Text & Typography
- **No emojis** in UI text, labels, titles, or buttons
- **No gradient text** effects (`bg-gradient-to-r bg-clip-text text-transparent`)
- Keep copy clean and professional

### Section Backgrounds (Homepage)
Use a conversion-focused pattern - `bg-muted` only on conversion-driving sections:
- Hero: transparent
- Problem/Solution: transparent
- Try AI Features: `bg-muted` (conversion point)
- Features: transparent
- Testimonials: transparent
- Pricing: `bg-muted` (conversion point)
- FAQ: transparent
- Final CTA: `bg-muted` (conversion point)

### Section Consistency
- Padding: `py-16` (not py-20)
- Max width: `max-w-6xl` for content sections
- Container: `container mx-auto`

### Components
- **DRY patterns** - extract reusable components, avoid duplicating UI code
- **Server Components preferred** - only add `"use client"` when actually needed (state, effects, browser APIs)
- **Tailwind over custom CSS** - avoid inline styles
- **44px minimum touch targets** for interactive elements
- **WCAG AA color contrast** (4.5:1 minimum)

---

## Architecture Patterns

### Supabase Access
```typescript
// BAD: Client component accessing Supabase
"use client";
import { createClient } from "@/lib/supabase/server";

// GOOD: Client calls API route
"use client";
const response = await fetch("/api/endpoint");
```

### Database Schema
Check `./schemas/` before coding. Key fields:
- `company` (not `company_name`)
- `role` (not `position_title`)
- `date_applied` (not `application_date`)
- `archived` boolean (not status-based)
- Status values: `['Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired', 'Rejected']`

### Type Safety
- Single source of truth: `/types/index.ts`
- Prefer type guards over assertions
- Use `satisfies` for compile-time validation
- Centralize constants in `/lib/constants/`

### Code Comments
```typescript
// BAD: Historical commentary
// Fixed in Task 4, resolved TypeScript error

// GOOD: Explains why
// Extract only color properties to avoid conflicts
```

---

## Task Master Commands

```bash
# Daily workflow
task-master list                              # Show all tasks
task-master next                              # Get next task
task-master show <id>                         # View task details
task-master set-status --id=<id> --status=done

# Task management
task-master add-task --prompt="..." --research
task-master expand --id=<id> --research
task-master update-subtask --id=<id> --prompt="notes"

# Analysis
task-master analyze-complexity --research
task-master parse-prd .taskmaster/docs/prd.txt --append
```

---

## Analytics

- **PostHog**: Use `capturePostHogEvent` from `@/lib/analytics/posthog`
- **Vercel Analytics**: `window.va` - web vitals
- Never use `window.posthog` directly - use the helper function

---

## Scripts

```bash
./scripts/run-schema.sh schemas/file.sql    # Run SQL migrations
```
