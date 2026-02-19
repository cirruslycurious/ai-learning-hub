# Story 2.7 Code Review Findings - Round 2

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-16
**Branch:** story-2-7-rate-limiting

---

## Verification of Round 1 Fixes

### Fix 1: Retry-After HTTP header (Round 1 Finding 3 -- Critical) -- VERIFIED

The `createErrorResponse` function in `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/error-handler.ts` (lines 27-33) now correctly checks for `error.code === ErrorCode.RATE_LIMITED` and `error.details?.retryAfter != null`, and sets `headers["Retry-After"] = String(error.details.retryAfter)`. Three new test cases in `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/error-handler.test.ts` (lines 43-73) cover:

- RATE_LIMITED with retryAfter detail: header is set
- RATE_LIMITED without retryAfter detail: header is absent
- Non-rate-limit error with retryAfter detail: header is absent

This fix is correct and well-tested.

### Fix 2: DynamoDB TTL on users table (Round 1 Finding 4 -- Critical) -- VERIFIED

The `UsersTable` in `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/core/tables.stack.ts` (line 32) now includes `timeToLiveAttribute: "ttl"`. A corresponding CDK assertion test in `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/core/tables.stack.test.ts` (lines 155-163) verifies that the `TimeToLiveSpecification` has `AttributeName: "ttl"` and `Enabled: true`.

This fix is correct and tested.

### Fix 3: Counter inflation documentation (Round 1 Finding 5 -- Important) -- VERIFIED

The comment block at `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/rate-limiter.ts` (lines 74-79) now clearly documents that the counter is incremented unconditionally before checking the limit, that rejected requests inflate the counter, and that this is by design for simplicity.

This fix is adequate.

### Fix 4: TODO for IP behind CDN (Round 1 Finding 6 -- Important) -- VERIFIED

The TODO comment at `/Users/stephen/Documents/ai-learning-hub/backend/functions/validate-invite/handler.ts` (lines 71-73) now notes that `event.requestContext.identity.sourceIp` will be the CDN edge IP when behind CloudFront and recommends using `X-Forwarded-For`.

This fix is adequate.

### Fix 5: Scoped UpdateItem policy for validate-invite (Round 1 Finding 7 -- Important) -- VERIFIED

The IAM policy in `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts` (lines 318-324) now uses `addToRolePolicy` with only `dynamodb:UpdateItem` on the users table ARN, replacing the previous `grantReadData`. I verified that `getProfile` is not called from the validate-invite handler source code -- it was only present in the test mock setup (likely from a copy-paste template). The handler only needs `UpdateItem` for rate limit counter increments on the users table, and `grantReadWriteData` on the invite-codes table (line 316) for GetItem/UpdateItem on invite codes. The permissions are now correctly scoped.

This fix is correct.

### Fix 6: expect.assertions for weak test assertions (Round 1 Finding 8 -- Important) -- VERIFIED

The test "throws RATE_LIMITED when over the limit (AC3)" at `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/test/rate-limiter.test.ts` (line 208) now has `expect.assertions(5)`, and the test "includes retryAfter in error details (AC3)" (line 235) has `expect.assertions(4)`. This ensures the catch blocks actually execute.

This fix is correct.

### Fix 7: WAF comment accuracy (Round 1 Finding 10 -- Minor) -- VERIFIED

The comment at `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/rate-limiting.stack.ts` (line 46) now correctly says "WAF evaluates over a rolling 5-minute window".

This fix is correct.

---

## Critical Issues (Must Fix)

None.

## Important Issues (Should Fix)

None.

## Minor Issues (Nice to Have)

### Finding 1: validate-invite rate limit test does not verify that downstream operations are skipped when rate-limited

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/validate-invite/handler.test.ts`, lines 452-467
**Problem:** The rate limit test "returns 429 when rate limit exceeded" verifies the status code and error code, but does not assert that `mockGetInviteCode`, `mockRedeemInviteCode`, and `mockUpdateUserMetadata` were NOT called. The api-keys handler test (line 497) correctly asserts `expect(mockCreateApiKey).not.toHaveBeenCalled()`, but the validate-invite test omits these guards.
**Impact:** Low -- if the handler were refactored to call `getInviteCode` before the rate limit check (instead of after), this test would not catch the regression. The current handler code is correctly ordered, so this is a test quality gap rather than a correctness bug.
**Fix:** Add `expect(mockGetInviteCode).not.toHaveBeenCalled()` and similar assertions to the rate limit exceeded test in `handler.test.ts`.

### Finding 2: getProfile mock is declared but never used in validate-invite tests

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/validate-invite/handler.test.ts`, lines 14, 22
**Problem:** `mockGetProfile` is declared (line 14) and registered in the mock factory (line 22), but it is only used once in the AC7 idempotent test (line 505), where it is called but the result is never consumed by the handler since the handler does not import or call `getProfile`. This means the AC7 test line `mockGetProfile.mockResolvedValueOnce(...)` has no effect on the handler behavior -- it configures a mock that nothing reads.
**Impact:** Low -- the AC7 test still works because the handler's idempotent path is triggered by `inviteCode.redeemedBy === userId`, not by a profile lookup. The `mockGetProfile` setup is misleading dead code in the test, but does not affect correctness.
**Fix:** Remove the unused `mockGetProfile` setup from the AC7 test to reduce confusion.

### Finding 3: WAF WebACL uses a hardcoded resource name that may conflict in multi-account deployments

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/rate-limiting.stack.ts`, line 25
**Problem:** The WebACL `name` is hardcoded to `"ai-learning-hub-api-rate-limit"`. WAF WebACL names must be unique within a region and account. If the CDK app is deployed to the same account under different stage names (e.g., dev/staging), the hardcoded name would cause a CloudFormation conflict.
**Impact:** Low -- this is consistent with the pattern already used by the `TablesStack` (which also hardcodes table names and has a TODO at line 17-19 for adding environment prefix support). Not a regression.
**Fix:** None needed now -- follow the existing TODO pattern and address when multi-environment support is added.

---

## Deferred Items (Not Re-Raised per Instructions)

The following items from Round 1 were explicitly deferred and are not re-raised:

- Finding 9: CDK permission tests for API keys Lambda
- Finding 11: Rate limiting stack dependency declaration
- Finding 12: Rate limiter identifier sanitization
- Finding 13: USERS_TABLE_CONFIG.tableName hardcoded fallback
- Finding 14: enforceRateLimit error message fractional hours formatting

---

## What Was Checked

1. **All 15 changed files** were read in full and analyzed for correctness, security, and completeness.
2. **All 7 Round 1 fixes** were individually verified against the original findings.
3. **Secrets scan**: All new and modified files were scanned for AWS account IDs, access keys, resource IDs, API keys, private key material, and connection strings. No secrets found.
4. **Shared library usage**: Both handlers correctly import `enforceRateLimit` and `USERS_TABLE_CONFIG` from `@ai-learning-hub/db`. The rate limiter correctly uses `@ai-learning-hub/types` (AppError, ErrorCode) and `@ai-learning-hub/logging`.
5. **IAM permissions**: The api-keys Lambda has `PutItem`, `Query`, and `UpdateItem` (line 418) which covers rate limit counter writes (`UpdateItem`). The validate-invite Lambda has `UpdateItem` only on the users table (line 321) which is sufficient for rate limit counters.
6. **DynamoDB UpdateExpression**: The `ADD #count :inc SET #ttl = if_not_exists(#ttl, :ttl)` expression is correct -- `ADD` atomically increments a numeric attribute (creating it with the value if it does not exist), and `if_not_exists` ensures the TTL is only set on first write.
7. **Error handling**: The rate limiter correctly fails open on DynamoDB errors (line 146-152), and the `enforceRateLimit` wrapper correctly propagates `AppError` with `RATE_LIMITED` code including `retryAfter`, `limit`, and `current` details.
8. **CDK infrastructure**: WAF WebACL with 500 req/5min rate-based rule (above AWS minimum of 100), REGIONAL scope, CloudWatch metrics enabled, CDK Nag suppression for WAF logging. TTL enabled on users table. CfnOutputs export WebACL ARN and throttle settings.
9. **Test coverage**: Rate limiter has unit tests for `getWindowKey`, `getCounterTTL`, `incrementAndCheckRateLimit` (6 cases including fail-open), and `enforceRateLimit` (3 cases). Handler tests cover rate limit integration. CDK tests verify WAF resource, outputs, and TTL.

---

## Summary

- **Total findings:** 3
- **Critical:** 0
- **Important:** 0
- **Minor:** 3
- **Recommendation:** **Approve.** All Critical and Important issues from Round 1 have been correctly fixed and verified. The remaining 3 Minor findings are test quality improvements and a pre-existing naming pattern, none of which affect correctness or security. The rate limiting implementation is sound: DynamoDB atomic counters with TTL cleanup, proper Retry-After headers, fail-open on infrastructure errors, scoped IAM policies, and WAF infrastructure-level protection.
