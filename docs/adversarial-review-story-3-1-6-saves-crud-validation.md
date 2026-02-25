# Adversarial Review: Story 3.1.6 — Saves CRUD & Validation Smoke Scenarios

**Date:** 2026-02-23  
**Artifact:** `_bmad-output/implementation-artifacts/3-1-6-saves-crud-validation.md`  
**Scope:** Story 3.1.6 acceptance criteria, tasks, alignment with smoke-test runner, phase registry dependency (3.1.5), and API/ADR-008 consistency.

---

## Summary

The story correctly adds high-value smoke coverage for the saves CRUD lifecycle and validation error paths. The review finds **one critical gap** (state passing and cleanup for SC1–SC8), **several high-impact issues** (dependency on 3.1.5 deliverable, assertSaveShape scope and lastAccessedAt, SC4 timing, SV4 reuse vs create), and **medium/low clarifications** (URL naming, phase-only runs, optional fields) that could cause flaky tests, blocked implementation, or under-specified behavior if unaddressed.

---

## Critical

### C1: No state passing or cleanup strategy for SC1–SC8 as eight scenarios

**Artifact:** Phase 2 contains SC1–SC8 as eight scenarios; SC2–SC8 have "Given: Save created in SC1" or "Save created in SC1". Task 2.9 says "Add cleanup in finally block."

**Current runner:** `ScenarioDefinition` has only `id`, `name`, `run(): Promise<number>`. The runner in `run.ts` executes a flat list of scenarios sequentially; there is no built-in state passing between scenarios. Cleanup is handled via `registerCleanup()` (see `initApiKeyCleanup(registerCleanup)`), which runs at the end of the entire run in a single `finally` block.

**Gaps:**

1. **saveId propagation:** SC2–SC8 need the `saveId` produced by SC1. The artifact does not specify how that value is passed. Options: (a) one compound scenario whose single `run()` performs all eight steps and holds `saveId` in a local variable, or (b) eight separate scenario definitions with shared (e.g. module-level) state so SC1 sets `saveId` and SC2–SC8 read it. If (b), the artifact must explicitly require module-level (or phase-level) shared state and document that scenario order is fixed (SC1 → SC2 → … → SC8).

2. **Cleanup placement:** If there are eight separate scenarios, "finally block" cannot mean each scenario’s own finally—SC1’s finally would run immediately after SC1, deleting the save before SC2 runs. So cleanup must be either (a) a single finally at the end of one compound run(), or (b) SC1 registering a cleanup with `registerCleanup()` that captures the saveId (closure) and runs when the runner calls `runCleanups()`. The artifact does not say which. If (b), the story must mention that saves-crud (or Phase 2) needs an init hook similar to `initApiKeyCleanup` so scenarios can register cleanups, unless the phase runner already provides it.

**Impact:** Implementers may build eight separate scenarios without shared state, causing SC2–SC8 to fail (no saveId), or may add cleanup in SC1’s finally and break the lifecycle (save deleted before SC2).

**Recommendation:**

- In Task 2 and Dev Notes, state explicitly: **Either** (1) implement Phase 2 as one compound scenario (single `run()` that performs SC1–SC8 in sequence, with one `finally` that soft-deletes the created save), **or** (2) implement eight scenario definitions with module-level (or phase-level) shared state for `saveId`, and in SC1 after successful POST call `registerCleanup(() => client.delete(\`/saves/${saveId}\`))`so cleanup runs at end of run. If (2), document that the phase runner or scenario index must pass`registerCleanup`into the saves-crud module (e.g.`initSavesCrudCleanup(registerCleanup)`) so cleanups are registered.
- In AC2, add: "Cleanup runs after all scenarios in the phase/run (e.g. via runner’s runCleanups()), not inside SC1’s local finally."

---

## High

### H1: Dependency on 3.1.5 — smoke-test phase registry and CLI must exist

**Artifact:** "Dependency: Story 3.1.5 (Smoke Test Phase Runner Infrastructure) must be done first. Phase 2 and Phase 4 must exist in the phase registry (even if empty) and `--phase=N` / `--up-to=N` must be supported."

**Observation:** The epic plan describes 3.1.5 as refactoring the **smoke test** runner (`scripts/smoke-test/`) to support phased execution and `--phase` / `--up-to`. A separate implementation artifact for 3.1.5 (phase-runner-infrastructure) describes **orchestrator** phase registry (`.claude/skills/epic-orchestrator/phase-registry.md`), not the smoke-test phase registry. The artifact for 3.1.6 assumes `scripts/smoke-test/phases.ts` (or equivalent) and CLI flags exist.

**Impact:** If 3.1.5 does not deliver a smoke-test phase registry and `--phase` / `--up-to` in `scripts/smoke-test/`, 3.1.6 cannot register Phase 2 and Phase 4 or run them selectively. Implementation would be blocked or would have to invent the phase layer.

**Recommendation:**

- In Dev Notes (Dependency), add: "Confirm with 3.1.5 that the following exist before starting 3.1.6: (1) Phase registry (e.g. `scripts/smoke-test/phases.ts`) with Phase 2 and Phase 4 entries (scenarios may be empty), (2) `run.ts` (or equivalent) accepts `--phase=N` and `--up-to=N` and executes only the selected phase(s), (3) Scenario list is built from the phase registry rather than a single flat list."
- If 3.1.5 is scope-limited to orchestrator phases only, add a prerequisite story for smoke-test phase runner or fold it into 3.1.5 and align the 3.1.5 artifact with the epic plan.

---

### H2: assertSaveShape — required vs optional fields and lastAccessedAt

**Artifact (AC4, Task 1.2):** `assertSaveShape(body)` validates `{ data: { saveId, url, normalizedUrl, urlHash, contentType, tags, createdAt, updatedAt } }`.

**Reality:** `PublicSave` (from `@ai-learning-hub/types`) also includes `userId`, `isTutorial`, `linkedProjectCount`, and optionally `lastAccessedAt`, `title`, `userNotes`, etc. SC2 explicitly requires "`data.lastAccessedAt` is present (updated on GET)". POST /saves 201 response may not set `lastAccessedAt` (it is updated on GET).

**Gaps:**

1. **Required vs optional:** The artifact lists eight required fields for assertSaveShape. It does not say whether the helper must reject extra fields or only check presence of these. If the API adds new top-level fields (e.g. `userId`), strict equality could break. Recommend "at least these fields present" unless the project wants strict shape.
2. **lastAccessedAt:** For SC1 (POST 201), `lastAccessedAt` might be absent. For SC2 (GET 200), it must be present. So either (a) assertSaveShape has an optional parameter for "require lastAccessedAt" or (b) two helpers (e.g. assertSaveShapeCreate vs assertSaveShapeGet), or (c) assertSaveShape only checks the eight fields and SC2 separately asserts `data.lastAccessedAt` is present. The artifact does not specify.

**Impact:** Implementers may require lastAccessedAt in assertSaveShape and break SC1, or omit it and not validate SC2’s requirement.

**Recommendation:**

- In Task 1.2, state: "assertSaveShape(body, options?: { requireLastAccessedAt?: boolean }) validates at least: saveId, url, normalizedUrl, urlHash, contentType, tags, createdAt, updatedAt. If requireLastAccessedAt is true, also assert data.lastAccessedAt is present. Use requireLastAccessedAt for GET responses (SC2, SC8); do not require it for POST 201 (SC1) or PATCH 200 (SC4, SC7)."
- Optionally document that the helper does not assert absence of extra fields (e.g. userId, isTutorial) so the API can evolve.

---

### H3: SC4 — "updatedAt is later than data.createdAt" can fail under same-second updates

**Artifact (SC4):** "200 response; body data.updatedAt is later than data.createdAt."

**Reality:** If the backend sets `updatedAt` to "now" on PATCH and the request is fast, `createdAt` and `updatedAt` can be identical (same second or same millisecond). Strict "later than" would then fail.

**Recommendation:** In SC4 table and Task 2.4, change to "data.updatedAt is greater than or equal to data.createdAt" or "data.updatedAt is present and >= data.createdAt (ISO string comparison)." Alternatively, allow equality and only fail if updatedAt is missing or less than createdAt.

---

### H4: SV4 — "reuse SC1's save or create a new one" and phase-only runs

**Artifact (SV4 Given):** "Save exists (reuse SC1's save or create a new one)."

**Reality:** If the user runs only `--phase=4`, Phase 2 does not run, so no save from SC1 exists. SV4 must then create its own save. Reusing SC1’s save only works when Phase 2 has run in the same run and shared state (e.g. module-level saveId from Phase 2) is available to Phase 4—which the artifact does not define.

**Impact:** Implementers might assume Phase 2 always runs before Phase 4 and try to read a global saveId that does not exist when only Phase 4 is run.

**Recommendation:**

- In SV4 and Task 3.4, state: "If a save from Phase 2 is available in shared state (e.g. same full run with --up-to=4), SV4 may reuse that saveId for PATCH. Otherwise SV4 must create a new save (POST with unique URL), perform PATCH with immutable field, assert 400, then soft-delete the created save in a finally/cleanup." This keeps SV4 self-contained when run in isolation.

---

## Medium

### M1: URL naming inconsistency — "smoke-<timestamp>" vs "smoke-test-<Date.now()>"

**Artifact:** Acceptance table SC1 says URL `"https://example.com/smoke-<timestamp>"`; Dev Notes say "URL `https://example.com/smoke-test-<Date.now()>`."

**Recommendation:** Use one convention everywhere (e.g. `smoke-${Date.now()}` or `smoke-test-${Date.now()}`) and reference it in both the table and Dev Notes to avoid divergent implementations.

---

### M2: Phase 1 "unchanged" and scenario index structure after 3.1.5

**Artifact (AC3):** "Phase 1 (infra-auth) scenarios unchanged; `npm run smoke-test -- --phase=1` produces identical results."

**Reality:** After 3.1.5, the scenario list may be built from a phase registry (e.g. phases.ts) instead of the current flat `scenarios` export from `scenarios/index.ts`. The artifact says "3.1.5 refactors to phase-grouped execution — this story adds scenario definitions and registers them in the phase registry." So the way scenarios are exported may change: current code does `export const scenarios = [...jwtAuthScenarios, ...]`; after 3.1.5 it might be phase-based. 3.1.6 "registers" Phase 2 and Phase 4—so 3.1.6 depends on the registry shape from 3.1.5.

**Recommendation:** In Task 4 and AC3, add one line: "Assume 3.1.5 has defined the phase registry shape (e.g. phases[].scenarios); this story only adds scenario arrays to Phase 2 and Phase 4 and does not change Phase 1 scenario definitions or IDs."

---

### M3: GET /saves response shape — "count" field

**Artifact (SC3):** "200 response; items array contains an entry with matching saveId; response has count field."

**Reality:** Backend may return `data.items` and `data.count` (or similar). The artifact does not cite the exact API contract (e.g. list response schema). If the API uses a different name (e.g. `total`), the scenario would fail.

**Recommendation:** In Task 2.3 or References, point to the saves-list API contract (e.g. `.claude/docs/api-patterns.md` or the handler) so "count" is confirmed. If the API returns both `items` and `count`, no change; otherwise align the Then clause with the real field name.

---

## Low / Clarifications

### L1: Optional fields in save shape (title, userNotes, etc.)

**Artifact:** assertSaveShape lists saveId, url, normalizedUrl, urlHash, contentType, tags, createdAt, updatedAt. It does not require title, userNotes, or lastAccessedAt (handled in H2). PublicSave has optional title, userNotes, lastAccessedAt. No conflict if the helper only asserts the listed set; document that optional fields may be present and are not asserted.

---

### L2: SV3 ULID — "01JNOTREAL000000000000000" validity

**Artifact (SV3):** "GET /saves/01JNOTREAL000000000000000 (valid ULID format, nonexistent)."

**Reality:** ULID is 26 characters, Crockford base32. The string "01JNOTREAL000000000000000" is 26 characters and format-valid; it may or may not be a valid ULID timestamp/entropy depending on implementation. Backend validation should accept it as format-valid and return 404 for "not found." No change needed unless the backend rejects it as invalid format; then use a clearly format-valid ULID that does not exist in DB.

---

### L3: ADR-008 error shape — existing helper

**Artifact:** References assertADR008(body, expectedCode) for error scenarios. helpers.ts already implements this. No gap; ensure new scenario files import from `../helpers.js` and use assertADR008 for SV1–SV4 and SC6.

---

## Compliance Check (Artifact vs Epic Plan & Runner)

| Item                                     | Status                                              |
| ---------------------------------------- | --------------------------------------------------- |
| Phase 2 = saves-crud, SC1–SC8            | ✅                                                  |
| Phase 4 = saves-validation, SV1–SV4      | ✅                                                  |
| Cleanup in finally / cleanup registry    | ⚠️ Strategy not specified (C1)                      |
| Phase 1 unchanged (AC3)                  | ✅ Assumed after 3.1.5                              |
| assertSaveShape in helpers.ts            | ✅ Scope and lastAccessedAt need clarification (H2) |
| Dependency on 3.1.5 phase registry + CLI | ⚠️ Must be confirmed (H1)                           |
| No backend/frontend smoke logic          | ✅                                                  |
| JWT from SMOKE_TEST_CLERK_JWT            | ✅ Matches existing pattern                         |
| ADR-008 NOT_FOUND, VALIDATION_ERROR      | ✅                                                  |

---

## Recommended Story Edits (Concise)

1. **State and cleanup (C1):** Specify either one compound scenario for SC1–SC8 with a single run() and one finally, or eight scenarios with module-level (or phase-level) shared state for saveId and cleanup via registerCleanup in SC1. If using registerCleanup, document that the phase runner or scenario module must receive registerCleanup (e.g. initSavesCrudCleanup).
2. **3.1.5 dependency (H1):** In Dev Notes, require that 3.1.5 delivers smoke-test phase registry (e.g. phases.ts), --phase/--up-to in the smoke-test runner, and Phase 2/4 entries. Align with 3.1.5 artifact if it currently only describes orchestrator phases.
3. **assertSaveShape (H2):** Add optional parameter (e.g. requireLastAccessedAt) and document when to use it (GET vs POST 201). State that the helper asserts "at least" the listed fields.
4. **SC4 timing (H3):** Relax "later than" to "greater than or equal to" for updatedAt vs createdAt, or allow equality.
5. **SV4 (H4):** Clarify that when only Phase 4 runs, SV4 creates and cleans up its own save; "reuse SC1's save" only when Phase 2 has run and shared state is available.
6. **URL naming (M1):** Unify on one URL pattern (e.g. smoke-${Date.now()}) in both table and Dev Notes.
7. **Phase registry (M2):** Note that 3.1.6 assumes 3.1.5’s phase registry shape and only adds scenarios to Phase 2 and 4.
8. **List response (M3):** Confirm "count" field name against saves-list API and reference it in the story.

---

## Conclusion

Story 3.1.6 is well-scoped and adds the right smoke coverage for saves CRUD and validation. The main risks are **undefined state passing and cleanup** for the eight Phase 2 scenarios (C1), **dependency on 3.1.5 delivering the smoke-test phase runner** (H1), and **assertSaveShape and SC4/SV4 edge cases** (H2–H4). Applying the recommended edits will make implementation unambiguous and avoid flaky or blocked work.
