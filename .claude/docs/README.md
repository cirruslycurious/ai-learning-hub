# Progressive Disclosure — .claude/docs/

**Purpose:** Keep CLAUDE.md short (<200 lines) and put detailed context here. Load these files **on demand** when the task requires them; do not load all of them at session start.

## When to Load Which Doc

| Doc                    | Load when                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **architecture.md**    | Designing systems, adding stacks, understanding ADRs (no Lambda-to-Lambda, API-first, Lambda per concern). |
| **database-schema.md** | Writing or changing DynamoDB access, adding GSIs, implementing saves/projects/links/content/search.        |
| **api-patterns.md**    | Implementing or changing API handlers, error responses, or middleware.                                     |
| **testing-guide.md**   | Adding or changing tests, checking coverage, or running the test suite.                                    |

## Hierarchy (future)

- **Project level:** `CLAUDE.md` (primary; always loaded).
- **Module level:** e.g. `backend/CLAUDE.md` — add when backend grows; subsystem-specific rules.
- **Feature level:** e.g. `features/auth/CLAUDE.md` — add when features need scoped instructions.

Start with project-level only; add module/feature CLAUDE.md files as the codebase grows.

## Full Sources

For the complete architecture and rationale, see:

- `_bmad-output/planning-artifacts/architecture.md` — full ADRs, pipelines, and examples.
- `_bmad-output/planning-artifacts/epics.md` — epic and story list.
- `docs/` — product and progress docs.
