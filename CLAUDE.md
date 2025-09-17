# Task Master AI - Claude Code Integration Guide

## Essential Commands

### Core Workflow Commands

```bash
# Project Setup
task-master init                                    # Initialize Task Master in current project
task-master parse-prd .taskmaster/docs/prd.txt      # Generate tasks from PRD document
task-master models --setup                        # Configure AI models interactively

# Daily Development Workflow
task-master list                                   # Show all tasks with status
task-master next                                   # Get next available task to work on
task-master show <id>                             # View detailed task information (e.g., task-master show 1.2)
task-master set-status --id=<id> --status=done    # Mark task complete

# Task Management
task-master add-task --prompt="description" --research        # Add new task with AI assistance
task-master expand --id=<id> --research --force              # Break task into subtasks
task-master update-task --id=<id> --prompt="changes"         # Update specific task
task-master update --from=<id> --prompt="changes"            # Update multiple tasks from ID onwards
task-master update-subtask --id=<id> --prompt="notes"        # Add implementation notes to subtask

# Analysis & Planning
task-master analyze-complexity --research          # Analyze task complexity
task-master complexity-report                      # View complexity analysis
task-master expand --all --research               # Expand all eligible tasks

# Dependencies & Organization
task-master add-dependency --id=<id> --depends-on=<id>       # Add task dependency
task-master move --from=<id> --to=<id>                       # Reorganize task hierarchy
task-master validate-dependencies                            # Check for dependency issues
task-master generate                                         # Update task markdown files (usually auto-called)
```

## Key Files & Project Structure

### Core Files

- `.taskmaster/tasks/tasks.json` - Main task data file (auto-managed)
- `.taskmaster/config.json` - AI model configuration (use `task-master models` to modify)
- `.taskmaster/docs/prd.txt` - Product Requirements Document for parsing
- `.taskmaster/tasks/*.txt` - Individual task files (auto-generated from tasks.json)
- `.env` - API keys for CLI usage

### Claude Code Integration Files

- `CLAUDE.md` - Auto-loaded context for Claude Code (this file)
- `.claude/settings.json` - Claude Code tool allowlist and preferences
- `.claude/commands/` - Custom slash commands for repeated workflows
- `.mcp.json` - MCP server configuration (project-specific)

### Directory Structure

```
project/
├── .taskmaster/
│   ├── tasks/              # Task files directory
│   │   ├── tasks.json      # Main task database
│   │   ├── task-1.md      # Individual task files
│   │   └── task-2.md
│   ├── docs/              # Documentation directory
│   │   ├── prd.txt        # Product requirements
│   ├── reports/           # Analysis reports directory
│   │   └── task-complexity-report.json
│   ├── templates/         # Template files
│   │   └── example_prd.txt  # Example PRD template
│   └── config.json        # AI models & settings
├── .claude/
│   ├── settings.json      # Claude Code configuration
│   └── commands/         # Custom slash commands
├── .env                  # API keys
├── .mcp.json            # MCP configuration
└── CLAUDE.md            # This file - auto-loaded by Claude Code
```

## MCP Integration

Task Master provides an MCP server that Claude Code can connect to. Configure in `.mcp.json`:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "your_key_here",
        "PERPLEXITY_API_KEY": "your_key_here",
        "OPENAI_API_KEY": "OPENAI_API_KEY_HERE",
        "GOOGLE_API_KEY": "GOOGLE_API_KEY_HERE",
        "XAI_API_KEY": "XAI_API_KEY_HERE",
        "OPENROUTER_API_KEY": "OPENROUTER_API_KEY_HERE",
        "MISTRAL_API_KEY": "MISTRAL_API_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "AZURE_OPENAI_API_KEY_HERE",
        "OLLAMA_API_KEY": "OLLAMA_API_KEY_HERE"
      }
    }
  }
}
```

### Essential MCP Tools

```javascript
help; // = shows available taskmaster commands
// Project setup
initialize_project; // = task-master init
parse_prd; // = task-master parse-prd

// Daily workflow
get_tasks; // = task-master list
next_task; // = task-master next
get_task; // = task-master show <id>
set_task_status; // = task-master set-status

// Task management
add_task; // = task-master add-task
expand_task; // = task-master expand
update_task; // = task-master update-task
update_subtask; // = task-master update-subtask
update; // = task-master update

// Analysis
analyze_project_complexity; // = task-master analyze-complexity
complexity_report; // = task-master complexity-report
```

## Claude Code Workflow Integration

### Standard Development Workflow

#### 1. Project Initialization

```bash
# Initialize Task Master
task-master init

# Create or obtain PRD, then parse it
task-master parse-prd .taskmaster/docs/prd.txt

# Analyze complexity and expand tasks
task-master analyze-complexity --research
task-master expand --all --research
```

If tasks already exist, another PRD can be parsed (with new information only!) using parse-prd with --append flag. This will add the generated tasks to the existing list of tasks..

#### 2. Daily Development Loop

```bash
# Start each session
task-master next                           # Find next available task
task-master show <id>                     # Review task details

# During implementation, check in code context into the tasks and subtasks
task-master update-subtask --id=<id> --prompt="implementation notes..."

# Complete tasks
task-master set-status --id=<id> --status=done
```

#### 3. Multi-Claude Workflows

For complex projects, use multiple Claude Code sessions:

```bash
# Terminal 1: Main implementation
cd project && claude

# Terminal 2: Testing and validation
cd project-test-worktree && claude

# Terminal 3: Documentation updates
cd project-docs-worktree && claude
```

### Custom Slash Commands

Create `.claude/commands/taskmaster-next.md`:

```markdown
Find the next available Task Master task and show its details.

Steps:

1. Run `task-master next` to get the next task
2. If a task is available, run `task-master show <id>` for full details
3. Provide a summary of what needs to be implemented
4. Suggest the first implementation step
```

Create `.claude/commands/taskmaster-complete.md`:

```markdown
Complete a Task Master task: $ARGUMENTS

Steps:

1. Review the current task with `task-master show $ARGUMENTS`
2. Verify all implementation is complete
3. Run any tests related to this task
4. Mark as complete: `task-master set-status --id=$ARGUMENTS --status=done`
5. Show the next available task with `task-master next`
```

## Tool Allowlist Recommendations

Add to `.claude/settings.json`:

```json
{
  "allowedTools": [
    "Edit",
    "Bash(task-master *)",
    "Bash(git commit:*)",
    "Bash(git add:*)",
    "Bash(npm run *)",
    "mcp__task_master_ai__*"
  ]
}
```

## Configuration & Setup

### API Keys Required

At least **one** of these API keys must be configured:

- `ANTHROPIC_API_KEY` (Claude models) - **Recommended**
- `PERPLEXITY_API_KEY` (Research features) - **Highly recommended**
- `OPENAI_API_KEY` (GPT models)
- `GOOGLE_API_KEY` (Gemini models)
- `MISTRAL_API_KEY` (Mistral models)
- `OPENROUTER_API_KEY` (Multiple models)
- `XAI_API_KEY` (Grok models)

An API key is required for any provider used across any of the 3 roles defined in the `models` command.

### Model Configuration

```bash
# Interactive setup (recommended)
task-master models --setup

# Set specific models
task-master models --set-main claude-3-5-sonnet-20241022
task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
task-master models --set-fallback gpt-4o-mini
```

## Task Structure & IDs

### Task ID Format

- Main tasks: `1`, `2`, `3`, etc.
- Subtasks: `1.1`, `1.2`, `2.1`, etc.
- Sub-subtasks: `1.1.1`, `1.1.2`, etc.

### Task Status Values

- `pending` - Ready to work on
- `in-progress` - Currently being worked on
- `done` - Completed and verified
- `deferred` - Postponed
- `cancelled` - No longer needed
- `blocked` - Waiting on external factors

### Task Fields

```json
{
  "id": "1.2",
  "title": "Implement user authentication",
  "description": "Set up JWT-based auth system",
  "status": "pending",
  "priority": "high",
  "dependencies": ["1.1"],
  "details": "Use bcrypt for hashing, JWT for tokens...",
  "testStrategy": "Unit tests for auth functions, integration tests for login flow",
  "subtasks": []
}
```

## Claude Code Best Practices with Task Master

### Context Management

- Use `/clear` between different tasks to maintain focus
- This CLAUDE.md file is automatically loaded for context
- Use `task-master show <id>` to pull specific task context when needed

### Iterative Implementation

1. `task-master show <subtask-id>` - Understand requirements
2. Explore codebase and plan implementation
3. `task-master update-subtask --id=<id> --prompt="detailed plan"` - Log plan
4. `task-master set-status --id=<id> --status=in-progress` - Start work
5. Implement code following logged plan
6. `task-master update-subtask --id=<id> --prompt="what worked/didn't work"` - Log progress
7. `task-master set-status --id=<id> --status=done` - Complete task

### Complex Workflows with Checklists

For large migrations or multi-step processes:

1. Create a markdown PRD file describing the new changes: `touch task-migration-checklist.md` (prds can be .txt or .md)
2. Use Taskmaster to parse the new prd with `task-master parse-prd --append` (also available in MCP)
3. Use Taskmaster to expand the newly generated tasks into subtasks. Consdier using `analyze-complexity` with the correct --to and --from IDs (the new ids) to identify the ideal subtask amounts for each task. Then expand them.
4. Work through items systematically, checking them off as completed
5. Use `task-master update-subtask` to log progress on each task/subtask and/or updating/researching them before/during implementation if getting stuck

### Git Integration

Task Master works well with `gh` CLI:

```bash
# Create PR for completed task
gh pr create --title "Complete task 1.2: User authentication" --body "Implements JWT auth system as specified in task 1.2"

# Reference task in commits
git commit -m "feat: implement JWT auth (task 1.2)"
```

### Parallel Development with Git Worktrees

```bash
# Create worktrees for parallel task development
git worktree add ../project-auth feature/auth-system
git worktree add ../project-api feature/api-refactor

# Run Claude Code in each worktree
cd ../project-auth && claude    # Terminal 1: Auth work
cd ../project-api && claude     # Terminal 2: API work
```

## Troubleshooting

### AI Commands Failing

```bash
# Check API keys are configured
cat .env                           # For CLI usage

# Verify model configuration
task-master models

# Test with different model
task-master models --set-fallback gpt-4o-mini
```

### MCP Connection Issues

- Check `.mcp.json` configuration
- Verify Node.js installation
- Use `--mcp-debug` flag when starting Claude Code
- Use CLI as fallback if MCP unavailable

### Task File Sync Issues

```bash
# Regenerate task files from tasks.json
task-master generate

# Fix dependency issues
task-master fix-dependencies
```

DO NOT RE-INITIALIZE. That will not do anything beyond re-adding the same Taskmaster core files.

## Important Notes

### AI-Powered Operations

These commands make AI calls and may take up to a minute:

- `parse_prd` / `task-master parse-prd`
- `analyze_project_complexity` / `task-master analyze-complexity`
- `expand_task` / `task-master expand`
- `expand_all` / `task-master expand --all`
- `add_task` / `task-master add-task`
- `update` / `task-master update`
- `update_task` / `task-master update-task`
- `update_subtask` / `task-master update-subtask`

### File Management

- Never manually edit `tasks.json` - use commands instead
- Never manually edit `.taskmaster/config.json` - use `task-master models`
- Task markdown files in `tasks/` are auto-generated
- Run `task-master generate` after manual changes to tasks.json

### Claude Code Session Management

- Use `/clear` frequently to maintain focused context
- Create custom slash commands for repeated Task Master workflows
- Configure tool allowlist to streamline permissions
- Use headless mode for automation: `claude -p "task-master next"`

### Multi-Task Updates

- Use `update --from=<id>` to update multiple future tasks
- Use `update-task --id=<id>` for single task updates
- Use `update-subtask --id=<id>` for implementation logging

### Research Mode

- Add `--research` flag for research-based AI enhancement
- Requires a research model API key like Perplexity (`PERPLEXITY_API_KEY`) in environment
- Provides more informed task creation and updates
- Recommended for complex technical tasks

---

## Project-Specific Context & Lessons Learned

### Database Schema Alignment

**CRITICAL**: Always verify code matches actual database schema in `./schemas/` directory before implementation.

**Application Schema (`schemas/applications.sql`):**
- Fields: `company` (not `company_name`), `role` (not `position_title`), `date_applied` (not `application_date`)
- Archival: Uses boolean `archived` field, NOT status-based archival
- Status constraint: Only allows `['Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired', 'Rejected']`
- Indexes: `user_id`, `status`, `date_applied`, `user_id + archived` composite

**Schema Validation Checklist:**
1. Check `./schemas/` for actual database structure before coding
2. Verify field names match database columns exactly
3. Ensure status values match database constraints
4. Confirm archival method (boolean vs status-based)
5. Validate sortable fields have database indexes

### Runtime Error Debugging Pattern

**Server/Client Component Issues:**
- Error: "Only plain objects... can be passed to Client Components from Server Components"
- Solution: Use React Context providers for dependency injection instead of passing class instances
- Pattern: Create client-side provider wrapping service instantiation

**Type Consolidation:**
- Avoid duplicate type definitions across `/lib/types.ts` and `/types/index.ts`
- Use single source of truth: `/types/index.ts`
- Import types consistently across all files

### Performance & Architecture Patterns

**Pagination Implementation:**
- Server-side rendering for initial data, client-side for pagination
- API routes for client-side data fetching: `/api/applications`
- URL state management with validation and debouncing
- Component hierarchy: Page → List Component → API calls

**Status Management:**
- Centralized constants in `/lib/constants/application-status.ts`
- Export both individual status values AND arrays for validation
- Use shared constants across DAL, components, and validation

### Build Validation Process

**IMPORTANT**: Do NOT run `pnpm dev` or `pnpm build` automatically. The user will handle running these commands.

**Before marking any task as done, ensure:**
1. TypeScript types are correct and consistent
2. All imports are properly defined
3. Check for missing imports in DAL files
4. Validate field name consistency across components
5. Ensure status constants match database constraints
6. Code follows established patterns and conventions

**Task Completion Checklist:**
- [ ] All TypeScript errors resolved (build passes)
- [ ] All linting issues addressed
- [ ] All tests passing (including new functionality tests)
- [ ] Code follows established patterns and conventions
- [ ] Documentation updated if new APIs/components added
- [ ] No console errors or warnings in development

### Common Pitfalls Encountered

1. **Assuming field names** without checking database schema
2. **Forgetting to import arrays** (`APPLICATION_STATUS_VALUES`) when importing individual constants
3. **Mixed archival strategies** (status vs boolean) causing data inconsistencies
4. **Outdated sort field types** in hooks not matching updated DAL types
5. **Client trying to filter by invalid statuses** removed from constants

## Code Quality & Development Preferences

### CRITICAL: Supabase Access Pattern

**NEVER access Supabase directly from frontend/client components!**
- **DO NOT** import from `@/lib/supabase/server` in client components
- **DO NOT** use `createClient()` in components with `"use client"`
- **ALWAYS** create API routes in `/app/api/` for database operations
- **ALWAYS** call these API routes from client components using `fetch()`

**Correct Pattern:**
```typescript
// ❌ BAD: Client component accessing Supabase directly
"use client";
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data } = await supabase.from("table").select();

// ✅ GOOD: Client component calling API route
"use client";
const response = await fetch("/api/check-user");
const data = await response.json();
```

**Why:** Server-side Supabase functions use `cookies()` from `next/headers`, which only works in Server Components. Client components must use API routes as a proxy.

### Code Documentation Standards

**Comments and Documentation Policy:**
- **DO NOT** add comments about what was fixed, changed, or when
- **DO NOT** mention specific tasks, PRs, or implementation history in code
- **DO** add comments that help future developers understand the code
- **DO** focus on explaining "why" rather than "what" in comments
- **DO** document complex business logic or non-obvious implementations

**Examples:**
```typescript
// ❌ Bad: Historical commentary
// Fixed duplicate label issue in Task 4 accessibility implementation
// Added this to resolve TypeScript errors

// ✅ Good: Functional documentation  
// Extract only color properties to avoid property conflicts
const { bg, text, border } = getStatusColors(status);
```

### Architecture Preferences Discovered

**Type Safety & Validation:**
- Prefer type guards (`isApplicationStatus`) over type assertions
- Use `satisfies` operator for compile-time validation
- Implement runtime validation with graceful fallbacks
- Add development-only warnings for invalid inputs

**Performance Patterns:**
- Prefer Tailwind utilities over custom CSS and inline styles
- Use single source of truth for colors and constants
- Memoize expensive operations in hooks
- Extract magic numbers to named constants

**Accessibility First:**
- All interactive elements must meet 44px touch target minimum
- Color contrast must exceed WCAG AA requirements (4.5:1)
- Implement proper ARIA attributes and semantic HTML
- Include focus management for complex interactions
- Test with screen readers and keyboard navigation

**Error Handling:**
- Implement error boundaries at appropriate component levels
- Provide graceful degradation for accessibility features
- Log development warnings without polluting production
- Use descriptive error messages with actionable guidance

### Component Design Patterns

**Status Management:**
- Use centralized constants in `/lib/constants/application-status.ts`
- Implement type-safe status validation throughout
- Connect status system to accessible color system
- Provide utility functions for status operations

**Hook Design:**
- Extract reusable logic into custom hooks
- Use proper dependency arrays for optimization
- Implement cleanup functions for subscriptions/timers
- Document hook behavior with JSDoc and examples

**Testing Strategy:**
- Write comprehensive tests for accessibility features
- Test keyboard navigation and screen reader support
- Validate color contrast programmatically
- Include integration tests for complex workflows

### File Organization Preferences

**Accessibility Components:**
- Group in `/components/accessibility/` directory
- Provide comprehensive README with usage examples
- Export common patterns through index file
- Document WCAG compliance in component documentation

**Constants and Configuration:**
- Centralize colors in `/lib/constants/accessible-colors.ts`
- Generate Tailwind config from constants (single source of truth)
- Use descriptive constant names with proper TypeScript types
- Document contrast ratios and compliance levels

**Testing Structure:**
- Organize tests by feature/domain (`__tests__/accessibility/`)
- Use descriptive test names that explain the requirement
- Include both unit and integration accessibility tests
- Maintain high test coverage for critical accessibility features

### Performance & Bundle Considerations

**CSS Strategy:**
- Minimize custom CSS in favor of Tailwind utilities
- Use `@layer components` for necessary custom styles
- Scope custom styles to prevent global pollution
- Leverage Tailwind's purging for optimal bundle size

**TypeScript Configuration:**
- Use strict type checking throughout
- Prefer explicit typing over `any`
- Document complex types with JSDoc
- Use union types and enums for constrained values

### Important Git Commit Instructions

**NEVER commit changes unless explicitly asked by the user**. Always wait for the user to say something like:
- "commit the changes"
- "please commit"
- "you can commit now"
- "go ahead and commit"

When changes are ready but not committed, simply inform the user that the changes are staged and ready for commit when they're ready.

---

_This guide ensures Claude Code has immediate access to Task Master's essential functionality and the established code quality patterns for this project._
