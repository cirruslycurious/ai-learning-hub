# Epic 3.1: Tech Debt — Saves Domain DRY Consolidation

**Date:** 2026-02-23
**Source:** Post-implementation audit of Epic 3 stories 3.1a–3.4 (6 handlers, 6 test files, 3 shared packages)
**NFRs:** NFR-M1 (Maintainability), NFR-R7 (Reliability — toPublicSave divergence)

---

## Epic Goal

Eliminate cross-handler code duplication introduced during Epic 3 implementation, extract shared utilities, standardize test scaffolding, and introduce a pipeline-level deduplication scan agent that prevents future duplication before code reaches the adversarial reviewer.

**User Outcome:** Codebase is DRY across all saves handlers. Future stories automatically get flagged for duplication before review. Developer velocity improves through shared test factories and mock helpers.

---

## Audit Findings That Motivate This Epic

| #   | Finding                                                                                                 | Occurrences  | Risk                             |
| --- | ------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------- |
| 1   | `saveIdPathSchema` defined identically in 4 handlers                                                    | 4 files      | Policy drift                     |
| 2   | `saves/handler.ts` has local `SAVES_TABLE_CONFIG`, `toPublicSave`, `SaveItem` instead of shared imports | 1 file       | `deletedAt` leak in 409 response |
| 3   | EventBridge init boilerplate identical in 4 handlers                                                    | 4 files      | Policy drift                     |
| 4   | Rate limit config object identical in 4 handlers                                                        | 4 files      | Policy drift                     |
| 5   | `AppError.isAppError()` vs manual `instanceof` check — inconsistent                                     | 3 files      | Code clarity                     |
| 6   | 409 duplicate response built twice within `saves/handler.ts`                                            | 2 locations  | Internal duplication             |
| 7   | `createSaveItem` test factory — 5 near-identical copies                                                 | 5 test files | Maintenance burden               |
| 8   | Events mock block identical in 4 test files                                                             | 4 test files | Maintenance burden               |
| 9   | DB mock blocks with heavy overlap in 6 test files                                                       | 6 test files | Maintenance burden               |
| 10  | `VALID_SAVE_ID` constant repeated in 4 test files                                                       | 4 test files | Trivial duplication              |
| 11  | `assertADR008Error` used in only 1 of 6 test files                                                      | 5 test files | Inconsistent error assertions    |
| 12  | Response wrapping approach inconsistent (3 patterns)                                                    | 6 handlers   | Convention unclear               |

---

## Story Dependency Order

```
3.1.1 Shared Schemas & Constants  ──►  3.1.2 Test Utilities  ──►  3.1.3 Handler Consolidation
                                                                          │
                                                                          ▼
                                                              3.1.4 Dedup Scan Agent & Pipeline
```

- **3.1.1** extracts shared code that 3.1.2 and 3.1.3 depend on
- **3.1.2** creates test utilities that 3.1.3 uses when updating test files
- **3.1.3** retrofits all handlers and tests to use shared code from 3.1.1 + 3.1.2
- **3.1.4** adds the pipeline agent (can be done after 3.1.3 proves the patterns work)

---

## Story 3.1.1: Extract Shared Schemas & Constants

**Goal:** Move duplicated schemas, constants, and helpers from individual handlers into shared packages.

### Acceptance Criteria

| #   | Given                                                                                                    | When                                                            | Then                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| AC1 | `saveIdPathSchema` defined locally in 4 handlers                                                         | Schema extracted to `@ai-learning-hub/validation`               | All 4 handlers import from shared package; no local `saveIdPathSchema` definitions remain                             |
| AC2 | Rate limit config `{ operation: "saves-write", limit: 200, windowSeconds: 3600 }` repeated in 4 handlers | Config extracted to `@ai-learning-hub/db/saves`                 | All 4 handlers import `SAVES_WRITE_RATE_LIMIT` constant; no inline rate limit config objects remain                   |
| AC3 | EventBridge init boilerplate repeated in 4 handlers                                                      | Helper `requireEventBus()` created in `@ai-learning-hub/events` | All 4 handlers call `requireEventBus()` instead of inline `process.env.EVENT_BUS_NAME` + guard + `getDefaultClient()` |
| AC4 | All existing tests pass                                                                                  | After all extractions                                           | `npm test` passes with 0 failures; no behavioral changes                                                              |

### Tasks / Subtasks

- [ ] Task 1: Extract `saveIdPathSchema` (AC: #1)
  - [ ] 1.1 Add `saveIdPathSchema` to `backend/shared/validation/src/schemas.ts`
  - [ ] 1.2 Export from `backend/shared/validation/src/index.ts`
  - [ ] 1.3 Rebuild validation package: `npm run -w @ai-learning-hub/validation build`
  - [ ] 1.4 Update imports in `saves-get`, `saves-update`, `saves-delete`, `saves-restore` handlers
  - [ ] 1.5 Remove local `saveIdPathSchema` definitions from all 4 handlers
- [ ] Task 2: Extract rate limit constant (AC: #2)
  - [ ] 2.1 Add `SAVES_WRITE_RATE_LIMIT` to `backend/shared/db/src/saves.ts`
  - [ ] 2.2 Export from `backend/shared/db/src/index.ts`
  - [ ] 2.3 Update all 4 write handlers to use the constant
- [ ] Task 3: Extract EventBridge init helper (AC: #3)
  - [ ] 3.1 Add `requireEventBus()` function to `backend/shared/events/src/index.ts` (or appropriate module)
  - [ ] 3.2 Update all 4 event-emitting handlers to use `requireEventBus()`
  - [ ] 3.3 Remove inline `EVENT_BUS_NAME` + guard + `getDefaultEBClient()` boilerplate
- [ ] Task 4: Verify all tests pass (AC: #4)
  - [ ] 4.1 Run `npm test` — all tests must pass
  - [ ] 4.2 Run `npm run type-check` — clean

---

## Story 3.1.2: Shared Test Utilities for Saves Domain

**Goal:** Extract duplicated test factories, mock helpers, and assertion utilities into `backend/test-utils/` so all saves test files share common scaffolding.

### Acceptance Criteria

| #   | Given                                                                  | When                                                               | Then                                                                                                                                                             |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | `createSaveItem` factory defined in 5 test files with minor variations | Factory extracted to `backend/test-utils/save-factories.ts`        | Single `createTestSaveItem(saveId?, overrides?)` function; all 5 test files import it                                                                            |
| AC2 | Events mock block identical in 4 test files                            | Mock factory extracted to `backend/test-utils/mock-events.ts`      | `mockEventsModule()` function (matching `mockMiddlewareModule()` pattern); all 4 test files use it                                                               |
| AC3 | DB mock blocks with heavy overlap across 6 test files                  | Composable mock factory created in `backend/test-utils/mock-db.ts` | `mockDbModule(mockFns)` function providing `SAVES_TABLE_CONFIG`, `USERS_TABLE_CONFIG`, `toPublicSave`, `requireEnv`, `getDefaultClient` with override capability |
| AC4 | `VALID_SAVE_ID` constant defined in 4 test files                       | Constant extracted to `backend/test-utils/save-factories.ts`       | Single export; all 4 test files import it                                                                                                                        |
| AC5 | `assertADR008Error` used in only 1 of 6 test files                     | All error assertion sites updated                                  | All 6 test files use `assertADR008Error` for error response validation where applicable                                                                          |
| AC6 | All existing tests pass                                                | After all extractions                                              | `npm test` passes with 0 failures; no behavioral changes                                                                                                         |

### Tasks / Subtasks

- [ ] Task 1: Create `backend/test-utils/save-factories.ts` (AC: #1, #4)
  - [ ] 1.1 Implement `createTestSaveItem(saveId?, overrides?)` with sensible defaults
  - [ ] 1.2 Export `VALID_SAVE_ID` constant
  - [ ] 1.3 Export from `backend/test-utils/index.ts`
- [ ] Task 2: Create `backend/test-utils/mock-events.ts` (AC: #2)
  - [ ] 2.1 Implement `mockEventsModule()` returning mock `emitEvent`, `getDefaultClient`, `SAVES_EVENT_SOURCE`
  - [ ] 2.2 Export from `backend/test-utils/index.ts`
- [ ] Task 3: Create `backend/test-utils/mock-db.ts` (AC: #3)
  - [ ] 3.1 Implement `mockDbModule(mockFns)` with standard table configs, `toPublicSave`, `requireEnv`
  - [ ] 3.2 Export from `backend/test-utils/index.ts`
- [ ] Task 4: Verify test infrastructure works (AC: #6)
  - [ ] 4.1 Update one test file (e.g., `saves-get`) as proof-of-concept
  - [ ] 4.2 Run tests to confirm no regressions

---

## Story 3.1.3: Handler & Test Consolidation

**Goal:** Retrofit all 6 saves handlers and their test files to use shared code from stories 3.1.1 and 3.1.2. Fix the `saves/handler.ts` divergence and standardize patterns.

### Acceptance Criteria

| #   | Given                                                                                         | When                                           | Then                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | `saves/handler.ts` defines local `SAVES_TABLE_CONFIG`, `SaveItem`, `toPublicSave`             | Handler retrofitted to use shared packages     | Imports `SAVES_TABLE_CONFIG`, `toPublicSave` from `@ai-learning-hub/db`; imports `SaveItem` from `@ai-learning-hub/types`; no local definitions remain    |
| AC2 | Local `toPublicSave` in `saves/handler.ts` does not strip `deletedAt`                         | Shared `toPublicSave` used everywhere          | `deletedAt` is stripped from all API responses including 409 `existingSave`                                                                               |
| AC3 | 409 duplicate response built twice within `saves/handler.ts`                                  | Extracted to local helper                      | Single `createDuplicateResponse(existingSave, requestId)` function; both call sites use it                                                                |
| AC4 | `AppError.isAppError()` not used consistently                                                 | All handlers use `AppError.isAppError()`       | No manual `instanceof Error && "code" in error` checks remain in any saves handler                                                                        |
| AC5 | `saves-update` and `saves-restore` use unnecessary explicit `createSuccessResponse()` for 200 | Standardized to auto-wrap pattern              | Both handlers return plain data objects for 200 responses (like `saves-get` and `saves-list`); `createSuccessResponse` only used for non-200 status codes |
| AC6 | All 6 test files have duplicated factory/mock/assertion code                                  | All test files use shared utilities from 3.1.2 | Each test file imports `createTestSaveItem`, `mockEventsModule`, `mockDbModule`, `VALID_SAVE_ID`, `assertADR008Error` from `backend/test-utils/`          |
| AC7 | All existing tests pass                                                                       | After all changes                              | `npm test` passes with 0 failures; no behavioral changes                                                                                                  |
| AC8 | No local schema definitions remain                                                            | After cleanup                                  | `grep -r "saveIdPathSchema" backend/functions/` returns only import statements, no `const saveIdPathSchema` or `z.object` definitions                     |

### Tasks / Subtasks

- [ ] Task 1: Retrofit `saves/handler.ts` (AC: #1, #2, #3)
  - [ ] 1.1 Replace local `SAVES_TABLE_CONFIG` with import from `@ai-learning-hub/db`
  - [ ] 1.2 Replace local `SaveItem` interface with import from `@ai-learning-hub/types`
  - [ ] 1.3 Replace local `toPublicSave` with import from `@ai-learning-hub/db`
  - [ ] 1.4 Extract 409 response into `createDuplicateResponse()` local helper
  - [ ] 1.5 Verify `deletedAt` is stripped in all response paths
- [ ] Task 2: Standardize `AppError` usage (AC: #4)
  - [ ] 2.1 Update `saves-update/handler.ts` to use `AppError.isAppError()`
  - [ ] 2.2 Update `saves-delete/handler.ts` to use `AppError.isAppError()`
  - [ ] 2.3 Update `saves-restore/handler.ts` to use `AppError.isAppError()`
- [ ] Task 3: Standardize response wrapping (AC: #5)
  - [ ] 3.1 Update `saves-update/handler.ts` to return plain data object for 200
  - [ ] 3.2 Update `saves-restore/handler.ts` to return plain data object for 200
- [ ] Task 4: Update all 6 test files to use shared utilities (AC: #6)
  - [ ] 4.1 Update `saves/handler.test.ts`
  - [ ] 4.2 Update `saves-get/handler.test.ts`
  - [ ] 4.3 Update `saves-list/handler.test.ts`
  - [ ] 4.4 Update `saves-update/handler.test.ts`
  - [ ] 4.5 Update `saves-delete/handler.test.ts`
  - [ ] 4.6 Update `saves-restore/handler.test.ts`
- [ ] Task 5: Verify everything (AC: #7, #8)
  - [ ] 5.1 Run `npm test` — all tests pass
  - [ ] 5.2 Run `npm run type-check` — clean
  - [ ] 5.3 Run `grep -r "saveIdPathSchema" backend/functions/` — only import statements
  - [ ] 5.4 Run `grep -r "const SAVES_TABLE_CONFIG" backend/functions/` — no matches

---

## Story 3.1.4: Deduplication Scan Agent & Pipeline Integration

**Goal:** Create a new `epic-dedup-scanner` agent that runs BEFORE the adversarial reviewer in the orchestrator pipeline. The scanner reads all handlers in the same domain (not just the branch diff) to detect cross-handler duplication. It has its own 2-round fix loop and must pass (0 findings at Important+) before the code proceeds to the reviewer.

### Acceptance Criteria

| #   | Given                                    | When                                                                                       | Then                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | New agent definition created             | `.claude/agents/epic-dedup-scanner.md` exists                                              | Agent has read-only tools (Read, Glob, Grep, Bash, Write), fresh context, scoped to cross-handler duplication detection                                                                                                                                                   |
| AC2 | New fixer agent created                  | `.claude/agents/epic-dedup-fixer.md` exists                                                | Agent has full edit tools, guided by dedup findings document                                                                                                                                                                                                              |
| AC3 | Orchestrator pipeline updated            | Step 2.3b "Dedup Scan Loop" added between quality gates (2.2) and adversarial review (2.4) | Dedup scan runs with max 2 rounds; gate requires 0 Important+ findings before proceeding to reviewer                                                                                                                                                                      |
| AC4 | Supporting protocol doc created          | `.claude/skills/epic-orchestrator/dedup-scan-loop.md` exists                               | Documents the 2-round loop, scanner prompt template, fixer prompt template, gate criteria, and dry-run behavior                                                                                                                                                           |
| AC5 | Scanner checks for specific patterns     | When scanner runs                                                                          | It reads ALL handler files in the same domain directory (e.g., all `backend/functions/saves-*`), not just the branch diff, and flags: duplicate schema definitions, duplicate constants, duplicate helper functions, code that should use existing shared package exports |
| AC6 | Scanner output follows structured format | When scanner writes findings                                                               | Output uses `Critical/Important/Minor` format matching the reviewer's findings format so the orchestrator can parse it identically                                                                                                                                        |
| AC7 | Pipeline gate enforced                   | When dedup scan has Important+ findings after 2 rounds                                     | Orchestrator escalates to human (same pattern as reviewer round 3 escalation)                                                                                                                                                                                             |
| AC8 | Reviewer remains unchanged               | After pipeline integration                                                                 | `epic-reviewer.md` agent definition is not modified; reviewer continues to operate on branch diff with fresh context                                                                                                                                                      |

### Tasks / Subtasks

- [ ] Task 1: Create `epic-dedup-scanner` agent (AC: #1, #5, #6)
  - [ ] 1.1 Create `.claude/agents/epic-dedup-scanner.md` with agent definition
  - [ ] 1.2 Define scanner methodology: read all same-domain handlers, compare patterns, check shared package usage
  - [ ] 1.3 Define structured findings output format (matching reviewer format)
- [ ] Task 2: Create `epic-dedup-fixer` agent (AC: #2)
  - [ ] 2.1 Create `.claude/agents/epic-dedup-fixer.md` with agent definition
  - [ ] 2.2 Define fixer methodology: read findings, extract to shared packages, update imports, run tests
- [ ] Task 3: Create pipeline protocol doc (AC: #4)
  - [ ] 3.1 Create `.claude/skills/epic-orchestrator/dedup-scan-loop.md`
  - [ ] 3.2 Document 2-round loop protocol (scan → fix → scan → gate)
  - [ ] 3.3 Document scanner prompt template with domain discovery
  - [ ] 3.4 Document fixer prompt template
  - [ ] 3.5 Document gate criteria and escalation path
  - [ ] 3.6 Document dry-run behavior
- [ ] Task 4: Update orchestrator pipeline (AC: #3, #7, #8)
  - [ ] 4.1 Add Step 2.3b to `.claude/skills/epic-orchestrator/SKILL.md` between existing 2.3 and 2.4
  - [ ] 4.2 Reference `dedup-scan-loop.md` for full protocol
  - [ ] 4.3 Define gate: 0 Important+ findings required to proceed to 2.4
  - [ ] 4.4 Define escalation: same pattern as reviewer round 3 (human chooses fix/accept/override)
  - [ ] 4.5 Verify `epic-reviewer.md` is NOT modified

### Dev Notes

**Domain discovery logic for the scanner:**

The scanner needs to know which "domain" the current story belongs to, so it can read all sibling handlers. The orchestrator should pass the domain directory pattern based on the story's `touches` field. For example:

- Story touches `backend/functions/saves-update/handler.ts` → domain pattern = `backend/functions/saves*/handler.ts`
- Story touches `backend/functions/auth/handler.ts` → domain pattern = `backend/functions/auth*/handler.ts`

The scanner then reads ALL files matching the domain pattern, plus the relevant shared packages, to detect duplication.

**Relationship to the reviewer:**

```
Quality Gates (2.2) → Dedup Scan Loop (2.3b) → Mark for Review (2.3) → Adversarial Review (2.4)
                       ↕                                                  ↕
                    epic-dedup-scanner (reads all handlers)           epic-reviewer (reads branch diff)
                    epic-dedup-fixer (extracts to shared)             epic-fixer (fixes findings)
                       max 2 rounds                                      max 3 rounds
```

The dedup scan catches structural/DRY issues. The reviewer catches correctness/security/test issues. Neither overlaps with the other's scope.

---

## Project Context Reference

- Audit source: Cross-handler duplication analysis of Epic 3 (stories 3.1a–3.4)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epic orchestrator: `.claude/skills/epic-orchestrator/SKILL.md`
- Review loop: `.claude/skills/epic-orchestrator/review-loop.md`
- Existing agents: `.claude/agents/epic-reviewer.md`, `.claude/agents/epic-fixer.md`
