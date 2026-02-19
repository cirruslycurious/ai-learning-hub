# Story 2.8 Code Review Findings - Round 2

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-16
**Branch:** story-2-8-auth-error-codes

## Critical Issues (Must Fix)

None found.

## Important Issues (Should Fix)

None found.

## Minor Issues (Nice to Have)

1. **`wrapper.test.ts` scope test lacks `expect.assertions()` guard for consistency with story guideline**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/wrapper.test.ts`, lines 248-275
   - **Problem:** The story's Task 6.5 mandates "Use `expect.assertions()` in all error-path tests (lesson from Story 2.7)." The Round 1 review correctly flagged the missing `expect.assertions()` in `auth.test.ts` scope tests, which was fixed. However, the `wrapper.test.ts` scope test (line 248) -- which is also an error-path test returning a 403 -- still does not have `expect.assertions()`. While this test's assertions are all at the top level (not inside a conditional catch block) so the risk of silent skip is lower, adding `expect.assertions(3)` would be consistent with the established pattern used in the contract test file and the newly-fixed `auth.test.ts` tests.
   - **Impact:** Minor consistency gap. The test would still fail if any of its 3 assertions failed, since they are not inside conditional branches. This is cosmetic adherence to the team's established convention.
   - **Fix:** Add `expect.assertions(3)` at the top of the test (accounting for the 3 `expect` calls: `statusCode`, `error.code`, `error.details`).

2. **Activity log timestamps still use placeholder `[xx:xx]`**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/docs/progress/epic-2-auto-run.md`, lines 59-78
   - **Problem:** Same as Round 1 Minor #2. Multiple activity log entries for Stories 2.6 and 2.7 use `[xx:xx]` as placeholder timestamps. This was a minor finding from Round 1 and was not addressed (which is acceptable for a minor item).
   - **Impact:** Reduces the value of the activity log for debugging timeline issues. Low priority.
   - **Fix:** Populate actual timestamps or accept as a known process gap.

3. **Dev Agent Record section of story file is still empty**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/_bmad-output/implementation-artifacts/2-8-auth-error-codes.md`, lines 226-232
   - **Problem:** Same as Round 1 Minor #4. The "Agent Model Used", "Debug Log References", "Completion Notes List", and "File List" subsections remain blank.
   - **Impact:** Minor documentation gap useful for retrospectives.
   - **Fix:** Populate with the agent model used and the list of files modified.

## Verification of Round 1 Fixes

All three Important findings from Round 1 have been properly addressed:

1. **`keyScopes` vs `actualScopes` inconsistency (Round 1 Important #1):** FIXED. Both `auth.ts` (line 127) and `wrapper.ts` (line 139) now consistently use `keyScopes` as the property name for the scopes array in the SCOPE_INSUFFICIENT error details object. The `wrapper.test.ts` details assertion at line 273 also correctly uses `keyScopes`.

2. **Missing `expect.assertions()` in `auth.test.ts` (Round 1 Important #2):** FIXED. Both scope tests at lines 325 and 396 now have `expect.assertions(2)` at the top, matching the 2 assertion calls in each test body (the `toThrow(AppError)` and the `expect(e.code).toBe(...)` inside the catch block).

3. **Missing `details` assertion in `wrapper.test.ts` (Round 1 Important #3):** FIXED. The scope test at lines 271-274 now asserts `body.error.details` matches `{ requiredScope: "saves:write", keyScopes: ["saves:read"] }`, fully verifying AC4's requirement.

## Acceptance Criteria Verification

| AC  | Status               | Evidence                                                                                                                                                                                                                                                                          |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Met                  | All middleware/handler errors use ADR-008 format via `createErrorResponse`. Contract tests verify `{ error: { code, message, requestId } }` shape and X-Request-Id header for SCOPE_INSUFFICIENT, INVALID_INVITE_CODE, and RATE_LIMITED.                                          |
| AC2 | Met                  | All 7 new auth error codes added to `ErrorCode` enum in `errors.ts` (EXPIRED_TOKEN, INVALID_API_KEY, REVOKED_API_KEY, SUSPENDED_ACCOUNT, SCOPE_INSUFFICIENT, INVITE_REQUIRED, INVALID_INVITE_CODE). RATE_LIMITED pre-existed. All 8 codes tested for correct HTTP status mapping. |
| AC3 | Met (deferred scope) | Authorizer `deny()` calls pass errorCode in context (verified existing code, no changes needed per story constraints). Gateway Response formatting deferred to future API stack story.                                                                                            |
| AC4 | Met                  | Scope middleware now uses `ErrorCode.SCOPE_INSUFFICIENT` (both `auth.ts` and `wrapper.ts`), returns 403, and includes `{ requiredScope, keyScopes }` details. Verified by tests in `auth.test.ts`, `wrapper.test.ts`, and contract test.                                          |
| AC5 | Met                  | RATE_LIMITED + Retry-After header verified in contract test (line 76: `expect(response.headers?.["Retry-After"]).toBe("1800")`). No changes were made to rate limiter code.                                                                                                       |

## What Was Checked

- **Secrets scan:** All 12 changed files scanned for AWS account IDs, access keys, resource IDs, API keys, private key material, connection strings, and ARNs. No secrets found. The only ARN is a mock placeholder in `wrapper.test.ts` line 61 with a 9-digit fake account ID.
- **Security:** No new security vulnerabilities. No secrets in code. Error details expose scope names (e.g., `saves:write`, `saves:read`) which is intentional per AC4 and appropriate for API key scope debugging.
- **ADR compliance:** ADR-008 error format fully followed. ADR-013 auth error code mappings correctly implemented.
- **Shared library usage:** All code uses `@ai-learning-hub/types` (ErrorCode, AppError, ErrorCodeToStatus) and `@ai-learning-hub/middleware` (createErrorResponse, wrapHandler). No utility functions duplicated outside shared packages.
- **Test coverage:** New contract test file with 12 tests covering all 8 auth error codes. Existing tests updated for SCOPE_INSUFFICIENT (auth.test.ts, wrapper.test.ts) and INVALID_INVITE_CODE (handler.test.ts). All error-path contract tests use `expect.assertions()`.
- **Consistency:** Both scope-check code paths (auth.ts `requireScope` and wrapper.ts inline check) now use identical error code (`SCOPE_INSUFFICIENT`), identical message ("API key lacks required scope"), and identical details structure (`{ requiredScope, keyScopes }`).

## Summary

- **Total findings:** 3
- **Critical:** 0
- **Important:** 0
- **Minor:** 3
- **Recommendation:** Approve

All three Important findings from Round 1 have been properly fixed. The remaining 3 Minor findings are cosmetic (test convention consistency, placeholder timestamps, empty doc section) and do not affect correctness, security, or AC compliance. The implementation is clean, well-tested, and correctly addresses all acceptance criteria.
