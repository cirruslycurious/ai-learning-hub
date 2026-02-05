# AI Learning Hub

## Quick Start

```bash
npm install          # Install all workspace dependencies
npm test             # Run all tests
npm run build        # Build all packages
npm run lint         # Lint all code
cd infra && cdk deploy  # Deploy infrastructure
```

## Project Structure

```
/frontend            # React + Vite PWA
/backend             # Lambda function handlers
/infra               # AWS CDK stacks (15+)
/shared              # @ai-learning-hub/* packages
/.claude/docs/       # Detailed docs (load on-demand)
/.claude/commands/   # Custom slash commands
```

## Tech Stack

- Frontend: React + Vite + TypeScript
- Auth: Clerk (JWT for web, API keys for agents)
- Backend: AWS Lambda (Node.js/TypeScript)
- Database: DynamoDB (7 tables, 10 GSIs)
- Infra: AWS CDK (TypeScript)
- Hosting: S3 + CloudFront

## Key Patterns

### Shared Libraries (MANDATORY)

All Lambdas MUST import from `@ai-learning-hub/*`:

- `@ai-learning-hub/logging` - Structured logging + X-Ray
- `@ai-learning-hub/middleware` - Auth, error handling, validation
- `@ai-learning-hub/db` - DynamoDB client + query helpers
- `@ai-learning-hub/validation` - Zod schemas
- `@ai-learning-hub/types` - Shared TypeScript types

### API-First Design

- No Lambda-to-Lambda calls (use API Gateway or EventBridge)
- All async via EventBridge + Step Functions
- Standardized error responses (ADR-008)

### DynamoDB Keys

- User tables: `PK=USER#{userId}`, `SK=<entity>#<id>`
- Content table: `PK=CONTENT#{urlHash}`

## Commands

- `/project-start-story` - Start story/task work with branch + issue + PR workflow (enforces habit)
- `/project-fix-github-issue N` - Fix issue #N
- `/project-create-lambda name` - Create new Lambda
- `/project-create-component Name` - Create React component
- `/project-run-tests` - Run full test suite
- `/project-deploy` - Deploy to dev environment

## Context Loading

For detailed docs, read from `.claude/docs/`:

- `.claude/docs/architecture.md` - Full architecture details
- `.claude/docs/database-schema.md` - All 7 tables + GSIs
- `.claude/docs/api-patterns.md` - REST conventions
- `.claude/docs/testing-guide.md` - Test requirements

## Session Continuity

- Read `docs/progress/epic-N.md` for current epic status
- Read `docs/stories/N.M/progress.md` for story status
- Update progress.md as you complete tasks

## Workflow (PRs & branches)

For **story/task work** (epic implementation, BMAD stories, features, bugs), use a branch and PR so work is traceable and the PR checklist runs before merge.

1. **Issue** — Create or link a GitHub issue (story/task/feature/bug). One issue = one PR.
2. **Branch** — Create a branch from `main` (e.g. `story-1-6-github-templates`, `fix/42-save-error`). Do not commit story/task work directly to `main`.
3. **Work** — Implement, test, and reference the issue in commits (e.g. `feat: add PR template #17`).
4. **PR** — Push the branch, open a Pull Request with "Closes #issue-number", fill the PR template (summary, changes, testing, checklist), run tests/lint/build. Merge after review (self-review is fine when solo).

**Light habit:** When starting a BMAD story or a task, run `/project-start-story` (or ensure issue + branch yourself) so the session begins with the right workflow. Before considering the task done, remind to open the PR and merge.

## NEVER

- Create utility functions without checking /shared first
- Skip tests (80% coverage enforced)
- Force push to main or master
- Mix multiple issues in one PR
- Make Lambda-to-Lambda calls
- Store secrets in code (use Parameter Store)
- Modify CLAUDE.md without human approval

## ALWAYS

- Run `npm test` before committing
- Use shared libraries (@ai-learning-hub/\*)
- Reference issue numbers in commits (e.g., "fix: resolve save error #42")
- Start new session for new tasks
- Read progress.md before starting work
- Update progress.md after completing work

## Current Status

Phase: Planning Complete, Ready for Epic 1

- PRD: 81 FRs, 28 NFRs documented
- Architecture: 16 ADRs finalized
- Epics: 11 epics defined, stories pending

## Key Docs

- `_bmad-output/planning-artifacts/prd.md`, `architecture.md`, `epics.md` (canonical path: see .claude/docs/README.md)

---

_This file is human-owned. Do not modify without explicit approval._
_Last updated: 2026-02-04_
