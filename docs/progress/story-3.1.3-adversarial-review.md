# Adversarial Review: Story 3.1.3 — Handler & Test Consolidation

**Date:** 2026-02-23  
**Artifact:** `_bmad-output/implementation-artifacts/3-1-3-handler-test-consolidation.md`  
**Scope:** Acceptance criteria, tasks, dev notes, and alignment with codebase and dependencies (3.1.1, 3.1.2).

---

## Summary

The story is well-scoped and mostly implementable as written. The review identifies **one critical dependency/verification mismatch** (AC8 vs 3.1.1), **several high-impact gaps** (test message assertions, mock factory API, and behavioral change disclosure), and **minor risks** (line-number drift, vague “keep local” guidance, and scope creep) that could cause rework or subtle regressions if unaddressed.

---

## Critical

### C1: AC8 verification assumes 3.1.1 is complete; 3.1.3 tasks never remove local `saveIdPathSchema`

**AC8** requires: “No local schema definitions remain in handler files” and verification step 5.4: `grep -r "const saveIdPathSchema" backend/functions/` returns no matches.

**Reality:** Removal of local `saveIdPathSchema` is owned by **Story 3.1.1** (Task 1.4–1.5: update imports and remove local definitions in saves-get, saves-update, saves-delete, saves-restore). Story 3.1.3’s task list does **not** include changing or removing `saveIdPathSchema` in any handler.

**Impact:** If 3.1.1 is not completed before 3.1.3, the 3.1.3 verification step 5.4 will fail, and implementers may (a) incorrectly add “remove saveIdPathSchema” to 3.1.3, or (b) leave 3.1.3 “done” with AC8 failing. If 3.1.1 is done first, AC8 is satisfied by that story; then 3.1.3’s grep is a **cross-check** that nothing re-introduced the local schema.

**Recommendation:** In 3.1.3, clarify AC8 and Task 5.4: “This verification assumes 3.1.1 has already removed local `saveIdPathSchema` from all handlers. If 5.4 finds matches, complete or fix 3.1.1 first; 3.1.3 does not add or remove path schema imports.” Optionally add a precondition: “3.1.1 completed (no local saveIdPathSchema in backend/functions/).”

---

## High

### H1: `assertADR008Error` does not assert error message — NOT_FOUND “Save not found” can regress

**Story (Task 4, AC6):** Migrate tests to use `assertADR008Error` for error assertions.

**Reality:** `backend/test-utils/assert-adr008.ts` has signature `assertADR008Error(response, expectedCode?, expectedStatus?)`. It does **not** accept or assert `expectedMessage`. So a test that only does `assertADR008Error(response, ErrorCode.NOT_FOUND)` will not catch a regression where the API returns `message: "Item not found"` instead of `"Save not found"`.

**Context:** The adversarial review for Story 3.3 called out that 404 responses must use message `"Save not found"` for consistency with ACs. Handlers that catch db helper `AppError(NOT_FOUND, "Item not found")` and rethrow or forward can violate that. Tests that rely solely on `assertADR008Error` will not detect this.

**Recommendation:** Either (a) extend `assertADR008Error` with an optional `expectedMessage?: string` and document it in 3.1.2/3.1.3, or (b) in 3.1.3 Task 4, require that for NOT_FOUND (and any other message-sensitive code), tests add an explicit assertion on `parsed.error.message` (e.g. `expect(parsed.error.message).toBe("Save not found")`) in addition to `assertADR008Error`. Prefer (a) for consistency and reuse.

---

### H2: `mockDbModule()` API and overrides are underspecified for 3.1.3 migration

**Story (Task 4, Dev Notes):** Use `mockDbModule()` and “Approach A — pass mocks in” so tests keep references (e.g. `mockUpdateItem`) for assertions.

**Reality:** Story 3.1.2 defines `mockDbModule(mockFns)` returning a fixed set of keys (`getDefaultClient`, `SAVES_TABLE_CONFIG`, `USERS_TABLE_CONFIG`, `toPublicSave`, `requireEnv`, `SAVES_WRITE_RATE_LIMIT`). It does not show how `mockFns` is merged: are `queryItems`, `updateItem`, `transactWriteItems`, `getItem` etc. part of the default object or only when passed in? If they are only when passed in, every test that uses `queryItems` or `updateItem` must pass them in Approach A. If the default object omits them, the handler under test will receive `undefined` for those imports and crash unless the test provides them.

**Gap:** 3.1.3 does not specify (a) which db functions each of the 6 test files actually mocks (e.g. saves/handler uses queryItems, updateItem, transactWriteItems; saves-update uses updateItem), or (b) that `mockDbModule()` must either provide no-op implementations for all used db functions or document “pass every used function in mockFns”. Without that, migration can lead to “handler gets undefined for queryItems” in CI.

**Recommendation:** In 3.1.3 Dev Notes or Task 4, add a short checklist: “For each test file, list the `@ai-learning-hub/db` functions the handler under test uses; ensure mockDbModule() is called with overrides for each (e.g. mockDbModule({ queryItems: mockQueryItems, updateItem: mockUpdateItem, transactWriteItems: mockTransactWriteItems })).” If 3.1.2’s mockDbModule provides default vi.fn() for all exported db functions, say so in 3.1.2 and reference it here.

---

### H3: Behavioral change (deletedAt stripped from 409) is a breaking API change — not called out as such

**Story (AC2, Dev Notes):** Shared `toPublicSave` strips `deletedAt`; local one in saves/handler does not. The story makes this the “only intentional behavioral change” and states it is correct.

**Reality:** Any client that currently parses the 409 `existingSave` and reads `deletedAt` (e.g. to show “you previously deleted this save”) will see that field disappear. That is a **breaking change** for the public API contract.

**Recommendation:** In the artifact, add one sentence under “Behavioral change” or in a “Breaking change” subsection: “Removing `deletedAt` from the 409 `existingSave` payload is a breaking change for clients that rely on it; document in release notes or API changelog.” No implementation change required, but the story should not be described as “no behavioral changes except AC2” without acknowledging breakage.

---

### H4: “Keep local if create handler’s test factory has unique needs” is too vague

**Story (Task 4.1):** “Import createTestSaveItem from test-utils (or keep local if create handler’s test factory has unique needs).”

**Risk:** Implementers may keep a local factory in saves/handler.test.ts “to be safe” or because they don’t check whether the shared factory supports all needed overrides. That undermines AC6 (each test file uses shared utilities) and leaves duplication in the largest test file.

**Recommendation:** Replace with a concrete rule: “Use createTestSaveItem from test-utils; if a test requires a field or shape not supported by createTestSaveItem(..., overrides), add that override to the shared factory in 3.1.2 (or extend createTestSaveItem signature) and use it here. Only keep a local factory if the team agrees the create handler has a one-off need that does not belong in shared code.” Optionally add a subtask: “4.1.1 Audit saves/handler.test.ts for any createSaveItem usage; map to createTestSaveItem(saveId?, overrides?) and remove local factory.”

---

## Medium

### M1: Line numbers for 409 call sites will drift

**Story (Task 1.5):** “Replace both 409 response construction sites (Layer 1 at ~line 145 and handleTransactionFailure at ~line 276).”

**Reality:** Current codebase has the first 409 block around 151–159 (body with existingSave) and the second around 276–289. Small drift is expected; “~line 276” is still accurate for the second.

**Recommendation:** Prefer “first 409: the block that returns statusCode 409 with existingSave from layer-1 query; second 409: the block that returns 409 with existingSave from activeResult” (or “search for existingSave in body”); de-emphasize line numbers so the story is robust to prior edits.

---

### M2: Response wrapping equivalence depends on `isApiGatewayResult` — edge case not mentioned

**Story (Dev Notes):** “wrapHandler detects when a handler returns a plain object (no statusCode) and auto-wraps.”

**Reality:** The wrapper uses `isApiGatewayResult(result)` (middleware wrapper.ts): true when result is an object with a numeric `statusCode` property. So returning a plain object **without** `statusCode` is auto-wrapped; returning an object that has `statusCode` (e.g. from createSuccessResponse) is passed through. The only theoretical edge case is a handler returning something like `{ statusCode: 200, data: ... }` with a different shape than createSuccessResponse; that’s not in scope for saves-update/saves-restore.

**Recommendation:** Optional one-liner in Dev Notes: “Auto-wrap applies when the handler return value does not have a numeric statusCode (see isApiGatewayResult in wrapper.ts).” No change required if the team is comfortable with the current wording.

---

### M3: Scope creep risk — other handlers still use createSuccessResponse explicitly

**Reality:** Handlers such as invite-codes and api-keys still use `createSuccessResponse` explicitly. The story only standardizes saves-update and saves-restore to the “return plain data, let wrapHandler wrap” pattern.

**Recommendation:** Add a one-sentence scope note under “Story” or “Architecture Compliance”: “Only the saves domain handlers are in scope; invite-codes and api-keys are unchanged.” This avoids future “we did 3.1.3, why does invite-codes still use createSuccessResponse?” confusion.

---

## Low

### L1: Task 2.4 “Verify AppError is imported from @ai-learning-hub/types”

**Reality:** `AppError` and `isAppError` live in `@ai-learning-hub/types` (errors.ts). Handlers already import `AppError` and `ErrorCode` from there. The verification is quick and correct.

**Recommendation:** None; keep as-is.

---

### L2: Quality gates (Task 5) order

**Story (Task 5):** test → type-check → lint, then greps.

**Recommendation:** Running type-check before tests can fail fast on type errors; current order is acceptable. No change required.

---

## Checklist for implementation

- [ ] Confirm 3.1.1 is done (no local saveIdPathSchema) before treating AC8 as passable.
- [ ] For NOT_FOUND (and other message-sensitive codes), add message assertion or extend assertADR008Error.
- [ ] For each test file, ensure mockDbModule() provides (or overrides) every db function the handler uses.
- [ ] Document deletedAt removal from 409 as a breaking change where appropriate.
- [ ] Use shared createTestSaveItem for saves/handler.test.ts unless an agreed exception exists.
- [ ] Locate 409 call sites by content (“existingSave”) rather than by line number.

---

## Summary table

| Severity | Id    | Topic                                                                  |
| -------- | ----- | ---------------------------------------------------------------------- |
| Critical | C1    | AC8 / 5.4 assumes 3.1.1 removed saveIdPathSchema; 3.1.3 doesn’t do it  |
| High     | H1    | assertADR008Error doesn’t assert message; “Save not found” can regress |
| High     | H2    | mockDbModule() merge/override contract underspecified for migration    |
| High     | H3    | deletedAt stripping is breaking; should be called out                  |
| High     | H4    | “Keep local if unique needs” too vague; can leave duplication          |
| Medium   | M1    | Line numbers for 409 drift; prefer semantic description                |
| Medium   | M2    | Optional note on isApiGatewayResult for auto-wrap                      |
| Medium   | M3    | Clarify scope: only saves domain; invite-codes/api-keys unchanged      |
| Low      | L1–L2 | No change                                                              |
