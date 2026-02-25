# Epic 3.1: Tech Debt — Saves Domain DRY Consolidation & Smoke Test Expansion

**Date:** 2026-02-23
**Source:** Post-implementation audit of Epic 3 stories 3.1a–3.4 (6 handlers, 6 test files, 3 shared packages)
**NFRs:** NFR-M1 (Maintainability), NFR-R7 (Reliability — toPublicSave divergence), NFR-O1 (Observability — EventBridge verification)

---

## Epic Goal

Eliminate cross-handler code duplication introduced during Epic 3 implementation, extract shared utilities, standardize test scaffolding, introduce a pipeline-level deduplication scan agent that prevents future duplication before code reaches the adversarial reviewer, and expand the smoke test suite to validate the full saves domain infrastructure end-to-end in the deployed AWS environment.

**User Outcome:** Codebase is DRY across all saves handlers. Future stories automatically get flagged for duplication before review. Developer velocity improves through shared test factories and mock helpers. Deployments are validated by a phased smoke test suite that proves auth, CRUD, dedup, filtering, API key auth, and EventBridge wiring all work correctly in AWS — catching CDK misconfigurations, missing IAM permissions, and broken env vars before users hit them.

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

## Smoke Test Gap Analysis

The existing smoke test (PR #173) validates Epic 2/2.1 infrastructure — the auth chain, user profiles, route connectivity, and rate limiting (14 scenarios, AC1–AC14). The only Epic 3 coverage is AC9/AC10 (route-connectivity), which proves CDK wiring exists but not that the Lambdas actually work. None of the following are functionally validated: saves DynamoDB table operations, TransactWriteItems, GSI queries, EventBridge PutEvents, content type detection, filtering/sorting, or API key auth against saves routes.

---

## Story Dependency Order

```
Track A — Code Consolidation:
3.1.1 Shared Schemas & Constants  ──►  3.1.2 Test Utilities  ──►  3.1.3 Handler Consolidation
                                                                          │
                                                                          ▼
                                                              3.1.4 Dedup Scan Agent & Pipeline

Track B — Smoke Test Expansion (independent of Track A):
3.1.5 Phase Runner Infra  ──►  3.1.6 Saves CRUD & Validation  ──►  3.1.7 Saves Dedup, Filtering & API Key
                                       │
3.1.8 EventBridge Observability  ──────┴──►  3.1.9 EventBridge Verification
```

### Track A — Code Consolidation

- **3.1.1** extracts shared code that 3.1.2 and 3.1.3 depend on ✅ Done (#194)
- **3.1.2** creates test utilities that 3.1.3 uses when updating test files ✅ Done (#196)
- **3.1.3** retrofits all handlers and tests to use shared code from 3.1.1 + 3.1.2
- **3.1.4** adds the pipeline agent (can be done after 3.1.3 proves the patterns work)

### Track B — Smoke Test Expansion

- **3.1.5** refactors the smoke test runner to support phased execution and CLI flags
- **3.1.6** adds saves CRUD lifecycle and validation error scenarios (highest-value addition)
- **3.1.7** adds dedup detection, filtering/sorting, and API key + saves cross-auth scenarios
- **3.1.8** adds EventBridge observability infra (CDK rule + CloudWatch log group target on event bus)
- **3.1.9** adds EventBridge verification scenario that queries CloudWatch logs after creating a save

Tracks A and B can be worked **in parallel** — they have no shared dependencies.

### Phase Mapping

The smoke test phases (runtime concept) map to stories as follows:

| Phase | Name               | Scenarios | Story              |
| ----- | ------------------ | --------- | ------------------ |
| 1     | `infra-auth`       | AC1–AC14  | Existing (PR #173) |
| 2     | `saves-crud`       | SC1–SC8   | 3.1.6              |
| 3     | `saves-dedup`      | SD1–SD2   | 3.1.7              |
| 4     | `saves-validation` | SV1–SV4   | 3.1.6              |
| 5     | `saves-filtering`  | SF1–SF3   | 3.1.7              |
| 6     | `saves-apikey`     | SA1       | 3.1.7              |
| 7     | `eventbridge`      | EB1–EB3   | 3.1.9              |

---

## Story 3.1.1: Extract Shared Schemas & Constants

**Status:** ✅ Done (PR #194)

**Goal:** Move duplicated schemas, constants, and helpers from individual handlers into shared packages.

### Acceptance Criteria

| #   | Given                                                                                                    | When                                                            | Then                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| AC1 | `saveIdPathSchema` defined locally in 4 handlers                                                         | Schema extracted to `@ai-learning-hub/validation`               | All 4 handlers import from shared package; no local `saveIdPathSchema` definitions remain                             |
| AC2 | Rate limit config `{ operation: "saves-write", limit: 200, windowSeconds: 3600 }` repeated in 4 handlers | Config extracted to `@ai-learning-hub/db/saves`                 | All 4 handlers import `SAVES_WRITE_RATE_LIMIT` constant; no inline rate limit config objects remain                   |
| AC3 | EventBridge init boilerplate repeated in 4 handlers                                                      | Helper `requireEventBus()` created in `@ai-learning-hub/events` | All 4 handlers call `requireEventBus()` instead of inline `process.env.EVENT_BUS_NAME` + guard + `getDefaultClient()` |
| AC4 | All existing tests pass                                                                                  | After all extractions                                           | `npm test` passes with 0 failures; no behavioral changes                                                              |

### Tasks / Subtasks

- [x] Task 1: Extract `saveIdPathSchema` (AC: #1)
- [x] Task 2: Extract rate limit constant (AC: #2)
- [x] Task 3: Extract EventBridge init helper (AC: #3)
- [x] Task 4: Verify all tests pass (AC: #4)

---

## Story 3.1.2: Shared Test Utilities for Saves Domain

**Status:** ✅ Done (PR #196)

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

- [x] Task 1: Create `backend/test-utils/save-factories.ts` (AC: #1, #4)
- [x] Task 2: Create `backend/test-utils/mock-events.ts` (AC: #2)
- [x] Task 3: Create `backend/test-utils/mock-db.ts` (AC: #3)
- [x] Task 4: Verify test infrastructure works (AC: #6)

---

## Story 3.1.3: Handler & Test Consolidation

**Status:** In Progress

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

**Status:** Pending (depends on 3.1.3)

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

## Story 3.1.5: Smoke Test Phase Runner Infrastructure

**Status:** Pending

**Goal:** Refactor the smoke test runner (`scripts/smoke-test/`) to support phased execution with CLI flags. The existing 14 scenarios (AC1–AC14) become Phase 1 (`infra-auth`). New phases are registered but empty — subsequent stories fill them in.

### Acceptance Criteria

| #   | Given                                                            | When                                                 | Then                                                                                                                                                                       |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Smoke test runner (`run.ts`) executes all scenarios sequentially | Runner refactored to support phase grouping          | Each scenario belongs to a named phase; phases execute in numeric order; existing scenarios assigned to Phase 1 (`infra-auth`)                                             |
| AC2 | No way to run a subset of scenarios                              | `--phase` flag added to CLI                          | `npm run smoke-test -- --phase=2` runs only Phase 2; `npm run smoke-test -- --phase=1,4` runs Phases 1 and 4; phases execute in numeric order regardless of argument order |
| AC3 | No way to run up to a specific phase                             | `--up-to` flag added to CLI                          | `npm run smoke-test -- --up-to=3` runs Phases 1, 2, 3 in order; respects the natural dependency chain                                                                      |
| AC4 | No default — must explicitly request phases                      | Runner invoked with no flags                         | All registered phases execute in order (full suite); behavior is identical to current runner for existing scenarios                                                        |
| AC5 | Phase execution provides clear output                            | Any phase combination runs                           | Console output shows phase name/number header before each phase's scenarios; summary at end shows pass/fail/skip counts per phase                                          |
| AC6 | Phase metadata is extensible                                     | New phase registered                                 | A phase is defined by `{ number, name, scenarios[], dependsOn?: number[] }`; adding a new phase requires only adding an entry to the registry and a scenario file          |
| AC7 | Phase dependency validation                                      | `--phase=3` requested but Phase 3 depends on Phase 2 | Runner warns that Phase 2 is a dependency of Phase 3 but will NOT be run; does not auto-include (user chose explicitly); warning is informational only                     |
| AC8 | Existing tests and lint pass                                     | After refactor                                       | `npm run lint` passes; existing smoke test scenarios produce identical results when run with no flags                                                                      |

### Tasks / Subtasks

- [ ] Task 1: Define phase registry type and data structure (AC: #6)
  - [ ] 1.1 Create `scripts/smoke-test/phases.ts` with `Phase` type: `{ number, name, scenarios, dependsOn? }`
  - [ ] 1.2 Register Phase 1 (`infra-auth`) containing all existing scenario groups
  - [ ] 1.3 Register placeholder entries for Phases 2–7 (empty scenario arrays, filled by subsequent stories)
- [ ] Task 2: Add CLI flag parsing (AC: #2, #3, #4)
  - [ ] 2.1 Parse `--phase=N` and `--phase=N,M` from `process.argv`
  - [ ] 2.2 Parse `--up-to=N` from `process.argv`
  - [ ] 2.3 Default to all phases when no flags provided
  - [ ] 2.4 Validate that `--phase` and `--up-to` are mutually exclusive
- [ ] Task 3: Refactor `run.ts` to execute by phase (AC: #1, #5)
  - [ ] 3.1 Replace flat scenario array with phase-grouped execution loop
  - [ ] 3.2 Add phase header output (`═══ Phase 1: infra-auth ═══`)
  - [ ] 3.3 Add per-phase summary in final results table
  - [ ] 3.4 Preserve existing exit code behavior (non-zero on any failure)
- [ ] Task 4: Add dependency warnings (AC: #7)
  - [ ] 4.1 When `--phase` is used, check if requested phases have unmet `dependsOn` phases
  - [ ] 4.2 Print informational warning (not an error — user may know what they're doing)
- [ ] Task 5: Verify backward compatibility (AC: #8)
  - [ ] 5.1 Run `npm run lint` — passes
  - [ ] 5.2 Run smoke test with no flags — identical output to current runner

### Dev Notes

**Phase registry (initial state after this story):**

| Phase | Name               | Scenarios | dependsOn |
| ----- | ------------------ | --------- | --------- |
| 1     | `infra-auth`       | AC1–AC14  | —         |
| 2     | `saves-crud`       | _(empty)_ | [1]       |
| 3     | `saves-dedup`      | _(empty)_ | [2]       |
| 4     | `saves-validation` | _(empty)_ | [1]       |
| 5     | `saves-filtering`  | _(empty)_ | [2]       |
| 6     | `saves-apikey`     | _(empty)_ | [1]       |
| 7     | `eventbridge`      | _(empty)_ | [2]       |

Empty phases are skipped silently during execution (no header printed, no "0/0" in summary).

---

## Story 3.1.6: Saves CRUD & Validation Smoke Scenarios

**Status:** Pending (depends on 3.1.5)

**Goal:** Add the highest-value smoke test scenarios: a full save lifecycle (create → get → list → update → delete → restore) and validation error paths. These prove that DynamoDB table access, IAM permissions, env vars, TransactWriteItems, soft-delete logic, and the ADR-008 error chain all work correctly in the deployed environment.

### Acceptance Criteria

**Phase 2 — Saves CRUD Lifecycle (SC1–SC8):**

| #   | Given                          | When                                                                  | Then                                                                                                                              |
| --- | ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | Valid JWT auth token available | `POST /saves` with `{ url: "https://example.com/smoke-<timestamp>" }` | 201 response; body has `{ data: { saveId, url, normalizedUrl, urlHash, contentType, tags, ... } }`; `saveId` is a valid ULID      |
| SC2 | Save created in SC1            | `GET /saves/<saveId>`                                                 | 200 response; body `data.saveId` matches SC1; `data.url` matches submitted URL; `data.lastAccessedAt` is present (updated on GET) |
| SC3 | Save created in SC1            | `GET /saves`                                                          | 200 response; `items` array contains an entry with matching `saveId`; response has `count` field                                  |
| SC4 | Save created in SC1            | `PATCH /saves/<saveId>` with `{ title: "Smoke Test Updated" }`        | 200 response; body `data.title` equals `"Smoke Test Updated"`; `data.updatedAt` is later than `data.createdAt`                    |
| SC5 | Save created in SC1            | `DELETE /saves/<saveId>`                                              | 204 response; empty body                                                                                                          |
| SC6 | Save deleted in SC5            | `GET /saves/<saveId>`                                                 | 404 response; ADR-008 error shape with code `"NOT_FOUND"`                                                                         |
| SC7 | Save deleted in SC5            | `POST /saves/<saveId>/restore`                                        | 200 response; body `data.saveId` matches; `data.deletedAt` is absent (stripped by `toPublicSave`)                                 |
| SC8 | Save restored in SC7           | `GET /saves/<saveId>`                                                 | 200 response; save is accessible again; `data.title` still equals `"Smoke Test Updated"` (persisted through delete/restore cycle) |

**Phase 4 — Saves Validation Errors (SV1–SV4):**

| #   | Given                                              | When                                                                            | Then                                                             |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| SV1 | Valid auth token available                         | `POST /saves` with `{ url: "not-a-url" }`                                       | 400 response; ADR-008 error shape with code `"VALIDATION_ERROR"` |
| SV2 | Valid auth token available                         | `GET /saves/not-a-valid-ulid`                                                   | 400 response; ADR-008 error shape with code `"VALIDATION_ERROR"` |
| SV3 | Valid auth token available                         | `GET /saves/01JNOTREAL000000000000000` (valid ULID format, nonexistent)         | 404 response; ADR-008 error shape with code `"NOT_FOUND"`        |
| SV4 | Save exists (reuse SC1's save or create a new one) | `PATCH /saves/<saveId>` with `{ url: "https://changed.com" }` (immutable field) | 400 response; ADR-008 error shape with code `"VALIDATION_ERROR"` |

**General:**

| #   | Given                     | When                     | Then                                                                                                                                                     |
| --- | ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | All scenarios implemented | Scenarios registered     | Phase 2 (`saves-crud`) contains SC1–SC8; Phase 4 (`saves-validation`) contains SV1–SV4; phase registry updated                                           |
| AC2 | Test data created         | After scenario execution | All test saves are cleaned up in `finally` blocks (soft-deleted); URLs use unique timestamps to avoid cross-run conflicts                                |
| AC3 | Existing phases intact    | After adding new phases  | Phase 1 (`infra-auth`) scenarios unchanged; `npm run smoke-test -- --phase=1` produces identical results                                                 |
| AC4 | Helper utilities needed   | For save response shapes | `assertSaveShape(body)` helper added to `scripts/smoke-test/helpers.ts` validating `{ data: { saveId, url, normalizedUrl, urlHash, contentType, ... } }` |

### Tasks / Subtasks

- [ ] Task 1: Add `assertSaveShape` helper (AC: #4)
  - [ ] 1.1 Add to `scripts/smoke-test/helpers.ts`
  - [ ] 1.2 Validate required fields: `saveId`, `url`, `normalizedUrl`, `urlHash`, `contentType`, `tags`, `createdAt`, `updatedAt`
- [ ] Task 2: Create `scripts/smoke-test/scenarios/saves-crud.ts` (SC1–SC8)
  - [ ] 2.1 SC1: POST /saves with unique timestamp URL → assert 201 + save shape
  - [ ] 2.2 SC2: GET /saves/:saveId → assert 200 + matching saveId + lastAccessedAt present
  - [ ] 2.3 SC3: GET /saves → assert 200 + items contains saveId
  - [ ] 2.4 SC4: PATCH /saves/:saveId → assert 200 + title updated
  - [ ] 2.5 SC5: DELETE /saves/:saveId → assert 204
  - [ ] 2.6 SC6: GET deleted save → assert 404 + ADR-008 NOT_FOUND
  - [ ] 2.7 SC7: POST /saves/:saveId/restore → assert 200 + no deletedAt
  - [ ] 2.8 SC8: GET restored save → assert 200 + title persisted
  - [ ] 2.9 Add cleanup in `finally` block
- [ ] Task 3: Create `scripts/smoke-test/scenarios/saves-validation.ts` (SV1–SV4)
  - [ ] 3.1 SV1: POST with invalid URL → assert 400 + VALIDATION_ERROR
  - [ ] 3.2 SV2: GET with invalid ULID → assert 400 + VALIDATION_ERROR
  - [ ] 3.3 SV3: GET with nonexistent ULID → assert 404 + NOT_FOUND
  - [ ] 3.4 SV4: PATCH with immutable field → assert 400 + VALIDATION_ERROR
- [ ] Task 4: Register scenarios in phase registry (AC: #1)
  - [ ] 4.1 Import and register saves-crud scenarios as Phase 2
  - [ ] 4.2 Import and register saves-validation scenarios as Phase 4
- [ ] Task 5: Verify (AC: #2, #3)
  - [ ] 5.1 Run `npm run smoke-test -- --phase=1` — identical to current results
  - [ ] 5.2 Run `npm run smoke-test -- --phase=2` — SC1–SC8 pass against deployed env
  - [ ] 5.3 Run `npm run smoke-test -- --phase=4` — SV1–SV4 pass against deployed env
  - [ ] 5.4 Run `npm run lint` — passes

### Dev Notes

**Cleanup strategy:** SC1 creates a save with URL `https://example.com/smoke-test-<Date.now()>`. The `finally` block calls `DELETE /saves/<saveId>` to soft-delete it. Since URLs are timestamped, parallel runs won't conflict. The soft-deleted data remains in DynamoDB but is invisible to the API — no manual table cleanup needed.

**SC1 validates the most infrastructure in a single call:** Lambda execution, DynamoDB TransactWriteItems (save item + user counter update), GSI creation (urlHash-index), EventBridge PutEvents permission, env var resolution (SAVES_TABLE, USERS_TABLE, EVENT_BUS_NAME), Zod schema validation, and the middleware chain (auth + error handling + response wrapping).

---

## Story 3.1.7: Saves Dedup, Filtering & API Key Smoke Scenarios

**Status:** Pending (depends on 3.1.6)

**Goal:** Add second-tier smoke scenarios that validate duplicate detection (including auto-restore on re-save), filtering/sorting query parameters, and the critical API key + saves cross-auth path used by iOS Shortcuts and agents.

### Acceptance Criteria

**Phase 3 — Saves Dedup (SD1–SD2):**

| #   | Given                                                     | When                                | Then                                                                                                                                       |
| --- | --------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| SD1 | A save exists for URL X                                   | `POST /saves` with same URL X       | 409 response; body has `{ error: { code: "DUPLICATE_SAVE" }, existingSave: { saveId, ... } }`; `existingSave` does NOT contain `deletedAt` |
| SD2 | Save for URL X is soft-deleted (`DELETE /saves/<saveId>`) | `POST /saves` with same URL X again | 200 response (not 201, not 409); save is auto-restored; returned `saveId` matches the original; `deletedAt` is absent                      |

**Phase 5 — Saves Filtering (SF1–SF3):**

| #   | Given                                                                | When                                         | Then                                                                                                  |
| --- | -------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SF1 | Two saves exist with different content types (e.g., article + video) | `GET /saves?contentType=video`               | 200 response; `items` array contains only saves with `contentType: "video"`; article save is excluded |
| SF2 | Multiple saves exist with different `createdAt` timestamps           | `GET /saves?sort=createdAt&order=desc`       | 200 response; first item's `createdAt` ≥ second item's `createdAt`                                    |
| SF3 | A save exists with a unique title (set via PATCH)                    | `GET /saves?search=<unique-title-substring>` | 200 response; `items` array contains the matching save; other saves excluded                          |

**Phase 6 — Saves via API Key (SA1):**

| #   | Given                                                | When                                                                                                         | Then                                                                                                                                    |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| SA1 | A valid API key exists (created in Phase 1 or fresh) | `POST /saves` with `x-api-key` header (no JWT) and `{ url: "https://example.com/apikey-smoke-<timestamp>" }` | 201 response; save shape is valid; `userId` in response matches the API key's owner; proves `jwt-or-apikey` auth works for saves routes |

**General:**

| #   | Given                     | When                     | Then                                                                                             |
| --- | ------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| AC1 | All scenarios implemented | Scenarios registered     | Phase 3 contains SD1–SD2; Phase 5 contains SF1–SF3; Phase 6 contains SA1; phase registry updated |
| AC2 | Test data created         | After scenario execution | All test saves cleaned up in `finally` blocks; URLs use unique timestamps                        |
| AC3 | Existing phases intact    | After adding new phases  | Phases 1, 2, 4 unchanged; full suite still passes                                                |

### Tasks / Subtasks

- [ ] Task 1: Create `scripts/smoke-test/scenarios/saves-dedup.ts` (SD1–SD2)
  - [ ] 1.1 SD1: Create save, then POST same URL → assert 409 + DUPLICATE_SAVE + existingSave shape (no deletedAt)
  - [ ] 1.2 SD2: Delete the save, then POST same URL → assert 200 + auto-restored + same saveId
  - [ ] 1.3 Add cleanup in `finally` block
- [ ] Task 2: Create `scripts/smoke-test/scenarios/saves-filtering.ts` (SF1–SF3)
  - [ ] 2.1 Create 2 test saves with different URLs yielding different content types
  - [ ] 2.2 SF1: GET /saves?contentType=video → assert only video saves returned
  - [ ] 2.3 SF2: GET /saves?sort=createdAt&order=desc → assert descending order
  - [ ] 2.4 SF3: PATCH one save with unique title, then GET /saves?search=<title> → assert match
  - [ ] 2.5 Add cleanup in `finally` block
- [ ] Task 3: Create `scripts/smoke-test/scenarios/saves-apikey.ts` (SA1)
  - [ ] 3.1 SA1: Create or reuse API key, then POST /saves with x-api-key header → assert 201 + valid save shape
  - [ ] 3.2 Add cleanup in `finally` block
- [ ] Task 4: Register scenarios in phase registry (AC: #1)
  - [ ] 4.1 Import and register saves-dedup as Phase 3
  - [ ] 4.2 Import and register saves-filtering as Phase 5
  - [ ] 4.3 Import and register saves-apikey as Phase 6
- [ ] Task 5: Verify (AC: #2, #3)
  - [ ] 5.1 Run full suite — all phases pass
  - [ ] 5.2 Run `npm run smoke-test -- --phase=3` — SD1–SD2 pass
  - [ ] 5.3 Run `npm run smoke-test -- --phase=5` — SF1–SF3 pass
  - [ ] 5.4 Run `npm run smoke-test -- --phase=6` — SA1 passes
  - [ ] 5.5 Run `npm run lint` — passes

### Dev Notes

**SD2 is the trickiest scenario.** It validates the auto-restore path in `saves/handler.ts`: when a user re-saves a URL that was previously soft-deleted, the handler detects the existing (deleted) save via GSI, removes `deletedAt`, and returns 200 instead of 409. This exercises TransactWriteItems with a ConditionExpression on the existing item.

**SA1 is critical for the iOS Shortcut / agent capture flow.** The existing API key smoke tests (AC5–AC8) only hit `/users/me`. This scenario proves that `jwt-or-apikey` auth works specifically on saves routes, which resolve `userId` from a different path in the authorizer response.

**SF1 content type detection:** Use a YouTube URL (e.g., `https://youtube.com/watch?v=smoke-test`) to get `contentType: "video"` and a GitHub URL (e.g., `https://github.com/smoke-test`) to get `contentType: "article"`. The content type detection is deterministic based on URL patterns.

---

## Story 3.1.8: EventBridge Observability Infrastructure

**Status:** Pending (no dependencies — can start immediately)

**Goal:** Add a CloudWatch Log Group target to the EventBridge event bus so that all events flowing through the bus are logged. This provides observability into event flow and enables the smoke test (Story 3.1.9) to verify EventBridge wiring by querying CloudWatch Logs. This also validates that CloudWatch logging works in the deployed environment.

### Acceptance Criteria

| #   | Given                                                            | When                                                                | Then                                                                                                                                         |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | EventBridge bus `ai-learning-hub-events` has no rules or targets | CDK stack updated with a rule + CloudWatch Log Group target         | New `events.Rule` on the bus matches all events (`{ source: [{ prefix: "ai-learning-hub" }] }`) and targets a CloudWatch Log Group           |
| AC2 | No explicit CloudWatch Log Group exists for event bus logging    | Log group created by CDK                                            | Log group named `/aws/events/ai-learning-hub-events` exists with retention policy of 14 days (dev) / 90 days (prod based on stage param)     |
| AC3 | EventBridge needs permission to write to CloudWatch Logs         | CDK grants necessary permissions                                    | The rule target has the correct resource policy allowing `events.amazonaws.com` to create log streams and put log events                     |
| AC4 | Observability stack exists but only has X-Ray sampling           | EventBridge logging added to events stack (not observability stack) | Changes are in `infra/lib/stacks/core/events.stack.ts` (co-located with the bus); observability stack is not modified                        |
| AC5 | CDK Nag may flag new resources                                   | `cdk synth` runs                                                    | No new CDK Nag errors; suppressions added with documented reasons if needed                                                                  |
| AC6 | Infrastructure deploys cleanly                                   | `cdk deploy` runs                                                   | Stack deploys without errors; CloudWatch Log Group visible in AWS Console; creating a save via API produces a log entry in the new log group |
| AC7 | All existing tests pass                                          | After CDK changes                                                   | `npm test` passes; `npm run lint` passes; no changes to Lambda handler code                                                                  |

### Tasks / Subtasks

- [ ] Task 1: Add CloudWatch Log Group to events stack (AC: #2, #4)
  - [ ] 1.1 Import `aws-cdk-lib/aws-logs` in `events.stack.ts`
  - [ ] 1.2 Create `LogGroup` with name `/aws/events/ai-learning-hub-events` and appropriate retention
  - [ ] 1.3 Export log group name as stack output (`AiLearningHub-EventLogGroupName`)
- [ ] Task 2: Add EventBridge Rule with Log Group target (AC: #1, #3)
  - [ ] 2.1 Create `events.Rule` matching `source: [{ prefix: "ai-learning-hub" }]`
  - [ ] 2.2 Add `CloudWatchLogGroup` target pointing to the log group
  - [ ] 2.3 CDK handles the resource policy automatically via `targets.CloudWatchLogGroup`
- [ ] Task 3: Handle CDK Nag (AC: #5)
  - [ ] 3.1 Run `cdk synth` and check for Nag findings
  - [ ] 3.2 Add suppressions with documented reasons if needed
- [ ] Task 4: Verify (AC: #6, #7)
  - [ ] 4.1 Run `npm test` — passes
  - [ ] 4.2 Run `npm run lint` — passes
  - [ ] 4.3 Run `cdk synth` — succeeds without errors
  - [ ] 4.4 After deploy: create a save via API, check CloudWatch Log Group for matching event entry

### Dev Notes

**Why put this in events.stack.ts, not observability.stack.ts?** The log group is tightly coupled to the event bus — it's a target on a rule attached to the bus. Co-locating keeps the events stack self-contained. The observability stack is for cross-cutting concerns (dashboards, alarms, X-Ray config). If we later add a CloudWatch Dashboard that queries this log group, _that_ would go in the observability stack.

**Retention policy:** 14 days is sufficient for dev/staging (keeps costs low). For production, 90 days provides enough history for incident investigation. Use a stage parameter (passed via CDK context or stack props) to vary retention.

**What gets logged:** Every event on the bus is captured. The event detail includes the full event payload (e.g., `{ userId, saveId, normalizedUrl, urlHash }` for `SaveCreated`). This is intentional — it provides full observability for debugging. Sensitive data considerations: these events contain user IDs and URLs but no PII beyond that.

**No Lambda handler changes.** The existing handlers already call `emitEvent()` fire-and-forget. This story only adds infrastructure to _capture_ those events.

---

## Story 3.1.9: EventBridge Verification Smoke Scenario

**Status:** Pending (depends on 3.1.6 + 3.1.8)

**Goal:** Add a smoke test scenario that verifies EventBridge events are actually being emitted and delivered by querying CloudWatch Logs after creating a save. This validates the full event chain: Lambda → EventBridge PutEvents → Rule → CloudWatch Logs target.

### Acceptance Criteria

**Phase 7 — EventBridge Verification (EB1–EB3):**

| #   | Given                                                                    | When                                                                                                                  | Then                                                                                                                                            |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| EB1 | `SMOKE_TEST_EVENT_LOG_GROUP` env var set (or derived from stack outputs) | `POST /saves` with unique URL, then wait 5–10 seconds, then `FilterLogEvents` on `/aws/events/ai-learning-hub-events` | At least one log event found matching the test save's `saveId`; event `detail-type` is `SaveCreated`; event `source` is `ai-learning-hub.saves` |
| EB2 | Save from EB1 updated via PATCH                                          | Wait 5–10 seconds, then `FilterLogEvents` for `SaveUpdated`                                                           | Log event found with `detail-type: SaveUpdated` and matching `saveId`; `detail.updatedFields` is present                                        |
| EB3 | Save from EB1 deleted via DELETE                                         | Wait 5–10 seconds, then `FilterLogEvents` for `SaveDeleted`                                                           | Log event found with `detail-type: SaveDeleted` and matching `saveId`                                                                           |

**General:**

| #   | Given                                                           | When                                               | Then                                                                                                                                               |
| --- | --------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Scenario needs AWS SDK to query CloudWatch Logs                 | AWS SDK v3 `@aws-sdk/client-cloudwatch-logs` added | Package added to `scripts/smoke-test/package.json` (or root dev dependency); `FilterLogEventsCommand` used to query log group                      |
| AC2 | CloudWatch Log Group may not exist (3.1.8 not deployed)         | `SMOKE_TEST_EVENT_LOG_GROUP` not set               | Phase 7 is skipped with `SKIP` status and message: `"EventBridge log group not configured — set SMOKE_TEST_EVENT_LOG_GROUP or deploy Story 3.1.8"` |
| AC3 | CloudWatch Logs delivery has inherent latency                   | Scenario queries logs                              | Scenario retries `FilterLogEvents` up to 3 times with 5-second intervals (max 15s wait) before failing; first successful match short-circuits      |
| AC4 | All scenarios implemented                                       | Scenarios registered                               | Phase 7 (`eventbridge`) contains EB1–EB3; phase registry updated                                                                                   |
| AC5 | Smoke test runner needs AWS credentials for CloudWatch Logs API | Credentials available                              | Scenario uses default credential chain (same as `cdk deploy`); no new IAM users or keys needed; `logs:FilterLogEvents` permission required         |
| AC6 | Existing phases intact                                          | After adding Phase 7                               | All other phases unchanged; full suite still passes                                                                                                |

### Tasks / Subtasks

- [ ] Task 1: Add AWS SDK dependency (AC: #1)
  - [ ] 1.1 Add `@aws-sdk/client-cloudwatch-logs` to appropriate package.json
  - [ ] 1.2 Verify it doesn't conflict with existing dependencies
- [ ] Task 2: Create CloudWatch Logs query helper
  - [ ] 2.1 Create `scripts/smoke-test/helpers/cloudwatch.ts` (or add to `helpers.ts`)
  - [ ] 2.2 Implement `waitForLogEvent(logGroupName, filterPattern, maxRetries, intervalMs)` that retries `FilterLogEvents` (AC: #3)
  - [ ] 2.3 Return parsed event detail on success, throw on timeout
- [ ] Task 3: Create `scripts/smoke-test/scenarios/eventbridge-verify.ts` (EB1–EB3)
  - [ ] 3.1 Check for `SMOKE_TEST_EVENT_LOG_GROUP` env var; skip phase if missing (AC: #2)
  - [ ] 3.2 EB1: Create save → wait → query for `SaveCreated` with matching saveId
  - [ ] 3.3 EB2: Update save → wait → query for `SaveUpdated` with matching saveId
  - [ ] 3.4 EB3: Delete save → wait → query for `SaveDeleted` with matching saveId
  - [ ] 3.5 Add cleanup in `finally` block
- [ ] Task 4: Register scenarios in phase registry (AC: #4)
  - [ ] 4.1 Import and register eventbridge-verify as Phase 7
- [ ] Task 5: Verify (AC: #5, #6)
  - [ ] 5.1 Run full suite with `SMOKE_TEST_EVENT_LOG_GROUP` set — all phases pass including Phase 7
  - [ ] 5.2 Run full suite without `SMOKE_TEST_EVENT_LOG_GROUP` — Phase 7 skipped, all other phases pass
  - [ ] 5.3 Run `npm run smoke-test -- --phase=7` — EB1–EB3 pass
  - [ ] 5.4 Run `npm run lint` — passes

### Dev Notes

**Filter pattern for CloudWatch Logs:** Use `filterPattern: '{ $.detail.saveId = "<saveId>" }'` in `FilterLogEventsCommand`. EventBridge delivers events to CloudWatch Logs as JSON with fields: `version`, `id`, `detail-type`, `source`, `account`, `time`, `region`, `resources`, `detail`. The `detail` field contains the event payload.

**Latency:** EventBridge to CloudWatch Logs delivery is typically 1–3 seconds but can spike to 10+ seconds under load. The retry strategy (3 retries × 5 seconds = 15 seconds max) provides adequate headroom. If this proves flaky, increase to 5 retries × 5 seconds.

**Credential requirements:** The smoke test already runs in an environment with AWS credentials (same machine that runs `cdk deploy`). The `FilterLogEvents` API only needs `logs:FilterLogEvents` permission on the specific log group. The default CDK bootstrap role or developer credentials typically have this.

**Why this validates more than "events don't 500":** Without this scenario, EventBridge could silently fail — the handlers fire events fire-and-forget and don't check the PutEvents response. A missing IAM permission, wrong bus name, or bus deletion would be invisible. This scenario proves the full chain works: handler → SDK → EventBridge → Rule → CloudWatch Logs.

---

## Summary: Scenario Inventory

After all Track B stories are complete, the smoke test suite will contain:

| Phase     | Name               | Scenarios | Count  | What it proves                                            |
| --------- | ------------------ | --------- | ------ | --------------------------------------------------------- |
| 1         | `infra-auth`       | AC1–AC14  | 14     | JWT/API key auth, route connectivity, CORS, rate limiting |
| 2         | `saves-crud`       | SC1–SC8   | 8      | Full save lifecycle, DynamoDB CRUD, soft-delete, restore  |
| 3         | `saves-dedup`      | SD1–SD2   | 2      | Duplicate detection (409), auto-restore on re-save        |
| 4         | `saves-validation` | SV1–SV4   | 4      | Zod validation, 400/404 error shapes, ADR-008 compliance  |
| 5         | `saves-filtering`  | SF1–SF3   | 3      | Content type filter, sort order, title/URL search         |
| 6         | `saves-apikey`     | SA1       | 1      | API key auth on saves routes (iOS/agent path)             |
| 7         | `eventbridge`      | EB1–EB3   | 3      | EventBridge emit + delivery + CloudWatch Logs capture     |
| **Total** |                    |           | **35** |                                                           |

---

## Project Context Reference

- Audit source: Cross-handler duplication analysis of Epic 3 (stories 3.1a–3.4)
- Smoke test baseline: PR #173 (Epic 2/2.1 validation — 14 scenarios)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epic orchestrator: `.claude/skills/epic-orchestrator/SKILL.md`
- Review loop: `.claude/skills/epic-orchestrator/review-loop.md`
- Existing agents: `.claude/agents/epic-reviewer.md`, `.claude/agents/epic-fixer.md`
- Route registry: `infra/config/route-registry.ts`
- Events stack: `infra/lib/stacks/core/events.stack.ts`
- Saves routes stack: `infra/lib/stacks/api/saves-routes.stack.ts`
- Existing smoke test: `scripts/smoke-test/`
