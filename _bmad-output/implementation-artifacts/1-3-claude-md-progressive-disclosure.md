# Story 1.3: CLAUDE.md and Progressive Disclosure

Status: done

## Story

As a **developer (human or AI agent)**,
I want **CLAUDE.md kept concise plus detailed docs in .claude/docs/ loadable on demand**,
so that **agents get essential rules in every session without context bloat, and can load architecture, schema, API, and testing details only when needed**.

## Acceptance Criteria

1. **AC1: CLAUDE.md is under 200 lines and essential-only**
   - GIVEN the project root
   - WHEN I read CLAUDE.md
   - THEN it contains: quick start, structure, tech stack, key patterns, commands, context loading hint, NEVER/ALWAYS, current status
   - AND line count is under 200
   - AND it does not duplicate full architecture or schema

2. **AC2: .claude/docs/ exists with progressive disclosure docs**
   - GIVEN the .claude directory
   - WHEN I list .claude/docs/
   - THEN architecture.md, database-schema.md, api-patterns.md, testing-guide.md exist
   - AND a README explains when to load which doc (progressive disclosure)

3. **AC3: architecture.md summarizes ADRs and stack layout**
   - GIVEN an agent needs system design context
   - WHEN the agent reads .claude/docs/architecture.md
   - THEN it finds: ADR list, stack structure, API-first and Lambda-per-concern rules
   - AND it can load full _bmad-output/planning-artifacts/architecture.md for deep dives

4. **AC4: database-schema.md documents tables, keys, and GSIs**
   - GIVEN an agent needs DynamoDB context
   - WHEN the agent reads .claude/docs/database-schema.md
   - THEN it finds: 7 tables, PK/SK patterns, 10 GSIs, main access patterns
   - AND user tables use USER#<userId>; content table uses CONTENT#<urlHash>

5. **AC5: api-patterns.md documents REST and error shape**
   - GIVEN an agent needs API contract context
   - WHEN the agent reads .claude/docs/api-patterns.md
   - THEN it finds: REST conventions, ADR-008 error response shape, middleware usage
   - AND no Lambda-to-Lambda calls

6. **AC6: testing-guide.md documents coverage and test levels**
   - GIVEN an agent needs test context
   - WHEN the agent reads .claude/docs/testing-guide.md
   - THEN it finds: 80% coverage requirement, unit/integration/contract/E2E levels, persona paths
   - AND test commands and where tests live

## Tasks / Subtasks

- [x] **Task 1: Verify CLAUDE.md is essential-only and under 200 lines** (AC: 1)
  - [x] Confirm CLAUDE.md contains only quick start, structure, patterns, commands, context loading, NEVER/ALWAYS, status
  - [x] Confirm it references .claude/docs/ for detailed docs
  - [x] Confirm line count < 200. Confirmed: 98 lines.

- [x] **Task 2: Create .claude/docs/ directory and README** (AC: 2)
  - [x] Create .claude/docs/
  - [x] Add README.md explaining progressive disclosure and when to load which doc

- [x] **Task 3: Create .claude/docs/architecture.md** (AC: 3)
  - [x] Summarize ADRs (multi-table DynamoDB, EventBridge+Step Functions, Lambda per concern, no Lambda-to-Lambda, CDK stacks, error handling)
  - [x] Document stack layout under infra/lib/stacks/
  - [x] Reference full architecture doc for deep dives

- [x] **Task 4: Create .claude/docs/database-schema.md** (AC: 4)
  - [x] List 7 tables with PK/SK
  - [x] List 10 GSIs with purpose
  - [x] Document key access patterns and USER# / CONTENT# conventions

- [x] **Task 5: Create .claude/docs/api-patterns.md** (AC: 5)
  - [x] REST resource conventions
  - [x] ADR-008 error response shape and logging contract
  - [x] Middleware (auth, error handler) and no Lambda-to-Lambda rule

- [x] **Task 6: Create .claude/docs/testing-guide.md** (AC: 6)
  - [x] 80% coverage requirement and npm test
  - [x] Test levels (unit, integration, contract, E2E) and persona paths
  - [x] Where tests live per workspace

## Review Follow-ups (AI)

*From BMAD code review (Story 1-3). Tracked in GitHub issues.*

- [x] [AI-Review][HIGH] Add CLAUDE.md to story File List — AC1 deliverable was CLAUDE.md but it is not listed. [#43](https://github.com/cirruslycurious/ai-learning-hub/issues/43)
- [x] [AI-Review][HIGH] Complete ADR summary in .claude/docs/architecture.md — add ADR-011 through ADR-016. Full source has 16 ADRs; summary currently lists 10. [#44](https://github.com/cirruslycurious/ai-learning-hub/issues/44)
- [x] [AI-Review][MEDIUM] Document planning-artifact paths in .claude/docs/README.md — add one-line note that _bmad-output/planning-artifacts/ is BMAD planning output and may be regenerated. [#45](https://github.com/cirruslycurious/ai-learning-hub/issues/45)
- [x] [AI-Review][MEDIUM] Record CLAUDE.md line count in story — add actual count (e.g. 89 lines) to Task 1 so re-verification is trivial. [#46](https://github.com/cirruslycurious/ai-learning-hub/issues/46)
- [x] [AI-Review][LOW] Consider centralizing planning-artifacts path — same path appears in CLAUDE.md, README, architecture.md; document once (e.g. README) and reference elsewhere to reduce drift. [#47](https://github.com/cirruslycurious/ai-learning-hub/issues/47)
- [x] [AI-Review][LOW] Expand "persona paths" in testing-guide.md — add one sentence on what they are or link to epics so agents have context. [#48](https://github.com/cirruslycurious/ai-learning-hub/issues/48)

## Dependencies

- **Depends on**: Story 1.1 (monorepo), Story 1.2 (shared libs — for api-patterns/testing references)
- **Blocks**: None; enables all later stories by giving agents on-demand context

## Out of Scope

- Custom slash commands (.claude/commands/) — Story 1.4
- Hooks and settings.json — Story 1.5
- GitHub templates — Story 1.6
- Module/feature-level CLAUDE.md files — add when codebase grows (documented in README)

## File List

- CLAUDE.md
- _bmad-output/implementation-artifacts/1-3-claude-md-progressive-disclosure.md
- .claude/docs/README.md
- .claude/docs/architecture.md
- .claude/docs/database-schema.md
- .claude/docs/api-patterns.md
- .claude/docs/testing-guide.md
