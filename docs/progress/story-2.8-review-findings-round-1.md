# Story 2.8 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-16
**Branch:** story-2-8-auth-error-codes

## Critical Issues (Must Fix)

None found.

## Important Issues (Should Fix)

1. **Inconsistent `details` field naming between `auth.ts` and `wrapper.ts` for the same SCOPE_INSUFFICIENT error**
   - **File:** `backend/shared/middleware/src/auth.ts` (line ~125) and `backend/shared/middleware/src/wrapper.ts` (line ~137)
   - **Problem:** The `auth.ts` `requireScope()` function passes `{ requiredScope, keyScopes: scopes }` as the details object, while the `wrapper.ts` inline scope check passes `{ requiredScope: options.requiredScope, actualScopes: scopes }`. Both produce a `SCOPE_INSUFFICIENT` error, but the scopes array is named `keyScopes` in one path and `actualScopes` in the other. A client consuming the `details` field of this error would need to check for two different property names depending on which code path was taken.
   - **Impact:** Breaks the promise of "consistent, machine-parseable auth error responses" (story goal). A client parsing `details.keyScopes` will miss the data when the error comes from the `wrapper.ts` path (where it is `details.actualScopes`), and vice versa. This is a contract inconsistency.
   - **Fix:** Align both to use the same property name. The story file (Task 2.3) explicitly says "Note: existing code uses `keyScopes` rather than `actualScopes` -- keep existing name for backward compatibility." The `wrapper.ts` should use `keyScopes` instead of `actualScopes` to match `auth.ts`.

2. **`auth.test.ts` scope tests lack `expect.assertions()` guard, making the `if (AppError.isAppError(e))` branch silently skippable**
   - **File:** `backend/shared/middleware/test/auth.test.ts` (lines ~324-340, ~405-420)
   - **Problem:** The pattern used in both scope tests is:
     ```typescript
     try {
       requireScope(auth, "saves:write");
     } catch (e) {
       if (AppError.isAppError(e)) {
         expect(e.code).toBe(ErrorCode.SCOPE_INSUFFICIENT);
       }
     }
     ```
     The `if (AppError.isAppError(e))` guard means that if `requireScope` throws a non-AppError (or the `isAppError` check breaks due to a refactor involving different class instances across modules), the `expect(e.code)` assertion is silently skipped and the test still passes. There is no `expect.assertions()` call to ensure the assertion inside the catch actually runs. The story itself (Task 6.5) mandates: "Use `expect.assertions()` in all error-path tests (lesson from Story 2.7)." While this lesson is applied in the new contract test file, it was not applied to the updated existing tests.
   - **Impact:** False-positive tests. If the error type changes or `isAppError` fails to identify the error, the assertion on `e.code` is silently skipped and the test still reports as passing.
   - **Fix:** Add `expect.assertions(2)` (or appropriate count) at the top of each test, or remove the `if (AppError.isAppError(e))` guard and assert directly on `e.code` (since the preceding `expect(() => ...).toThrow(AppError)` already confirms it is an AppError). Alternatively, replace the try/catch pattern with `expect(() => ...).toThrowError(expect.objectContaining({ code: ErrorCode.SCOPE_INSUFFICIENT }))`.

3. **`wrapper.test.ts` scope test does not verify the `details` object is present in the error response (AC4 partial gap)**
   - **File:** `backend/shared/middleware/test/wrapper.test.ts` (lines ~248-272)
   - **Problem:** AC4 requires "Returns 403 with SCOPE_INSUFFICIENT code and details of required vs actual scopes." The wrapper test now correctly asserts `body.error.code === "SCOPE_INSUFFICIENT"` (which was added in this story), but does not assert that `body.error.details` contains `requiredScope` and scope values. This means if the `details` parameter were accidentally removed from the `AppError` constructor call in `wrapper.ts`, the test would still pass.
   - **Impact:** The test does not fully verify AC4's requirement that scope details are included. The contract test covers this for the `createErrorResponse` path but not for the full `wrapHandler` integration path.
   - **Fix:** Add an assertion like `expect(body.error.details).toEqual({ requiredScope: "saves:write", actualScopes: ["saves:read"] })` (adjusting the field name per finding #1 above).

## Minor Issues (Nice to Have)

1. **Story file status says "ready-for-dev" but all tasks are checked off**
   - **File:** `_bmad-output/implementation-artifacts/2-8-auth-error-codes.md` (line 3)
   - **Problem:** The `Status: ready-for-dev` field was not updated after implementation. All task checkboxes are marked `[x]` (done), but the status metadata still indicates the story has not been started.
   - **Impact:** Process tracking inconsistency. Any automation or human reading the status field would believe the story has not been developed yet.
   - **Fix:** Update to `Status: done` or `Status: in-review` as appropriate.

2. **Activity log timestamps use placeholder `[xx:xx]`**
   - **File:** `docs/progress/epic-2-auto-run.md` (lines ~59-78)
   - **Problem:** Multiple activity log entries for Stories 2.6 and 2.7 use `[xx:xx]` as placeholder timestamps instead of actual times. Only the final entries for Story 2.8 have real `[12:00]` timestamps.
   - **Impact:** Reduces the value of the activity log for debugging timeline issues. Minor process concern.
   - **Fix:** Populate actual timestamps or use a consistent placeholder convention (e.g., `[--:--]`).

3. **Contract test file does not exercise `EXPIRED_TOKEN`, `INVALID_API_KEY`, `REVOKED_API_KEY`, `SUSPENDED_ACCOUNT`, or `INVITE_REQUIRED` through `createErrorResponse`**
   - **File:** `backend/shared/middleware/test/auth-error-codes.contract.test.ts`
   - **Problem:** The contract tests verify HTTP status mapping for all 8 auth error codes via `ErrorCodeToStatus` lookups, but only `SCOPE_INSUFFICIENT`, `INVALID_INVITE_CODE`, and `RATE_LIMITED` are tested through the full `createErrorResponse` pipeline (verifying ADR-008 body shape, headers, etc.). The remaining 5 codes (EXPIRED_TOKEN, INVALID_API_KEY, REVOKED_API_KEY, SUSPENDED_ACCOUNT, INVITE_REQUIRED) are only tested as map lookups. While the story's scope constraints acknowledge these 5 flow through the authorizer path (not middleware), the `createErrorResponse` function would still produce correct ADR-008 responses for them, and having contract tests for all codes would future-proof the test suite for when Gateway Responses are added.
   - **Impact:** Minor coverage gap. The existing tests are sufficient for current scope since these error codes are not yet used in the middleware path.
   - **Fix:** Optionally add a parameterized test that runs all 8 auth error codes through `createErrorResponse` and verifies ADR-008 body shape.

4. **`Dev Agent Record` section of story file is empty**
   - **File:** `_bmad-output/implementation-artifacts/2-8-auth-error-codes.md` (lines 226-232)
   - **Problem:** The "Agent Model Used", "Debug Log References", "Completion Notes List", and "File List" subsections are all blank.
   - **Impact:** Minor documentation gap. This metadata is useful for retrospectives.
   - **Fix:** Populate with the agent model used and the list of files modified.

## Summary

- **Total findings:** 7
- **Critical:** 0
- **Important:** 3
- **Minor:** 4
- **Recommendation:** Approve after fixes

**Overall assessment:** This is a well-scoped, clean implementation. The core changes -- new ErrorCode enum members, ErrorCodeToStatus mappings, migration from FORBIDDEN to SCOPE_INSUFFICIENT, and migration from VALIDATION_ERROR to INVALID_INVITE_CODE -- are all correct and properly tested. The new contract test file is well-structured and applies the `expect.assertions()` pattern from Story 2.7 lessons learned.

The most substantive finding is the `keyScopes` vs `actualScopes` naming inconsistency between the two scope-checking code paths (Important #1). This directly contradicts the story's stated goal of consistent error responses and the story file's own guidance (Task 2.3) to keep the existing `keyScopes` name. The other important findings relate to test robustness (missing `expect.assertions()` guards and missing details assertions), which represent false-positive risk rather than production bugs.

No hardcoded secrets, no security vulnerabilities, no ADR violations, and no shared library bypass detected. The implementation correctly leaves authorizer throw/deny paths untouched per the scope constraints.
