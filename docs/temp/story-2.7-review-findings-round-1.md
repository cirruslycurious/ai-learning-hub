# Story 2.7 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-16
**Branch:** story-2-7-rate-limiting (uncommitted working tree changes)

---

## Critical Issues (Must Fix)

### Finding 1: WAF rate-based rule limit of 500 is below AWS minimum of 100 _per 5-minute period_ -- ACTUALLY valid, but semantics are wrong -- Critical

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/rate-limiting.stack.ts`:47
**Issue:** The WAF `rateBasedStatement.limit` is set to `500`. As of AWS WAFv2, the minimum value for a rate-based rule limit is **100** (requests evaluated over a trailing 5-minute window). The value 500 is technically valid (above the minimum of 100). However, the comment on line 46 says "500 requests per 5 minutes per IP" but AWS WAF rate-based rules evaluate over a **rolling 5-minute window**, not a fixed 5-minute window. The AC says "500 req / 5 min per IP" which aligns numerically, but the CDK stack comment should be accurate about the evaluation model (rolling vs. fixed window). This is not a blocker but the next finding IS critical.

**Impact:** Low -- the number is valid and the behavior is as expected.
**Fix:** Update the comment to clarify it is a rolling 5-minute evaluation window per AWS WAF behavior. Downgrading this to Minor.

### Finding 2: API Keys Lambda lacks DynamoDB UpdateItem permission for rate limit counters -- Critical

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts`:410-416
**Issue:** The `apiKeysFunction` Lambda is granted only `PutItem`, `Query`, and `UpdateItem` via an explicit IAM policy. However, the rate limiter uses `UpdateCommand` with `ADD` expression to atomically increment counters. The `UpdateItem` action IS included, so this looks correct at first glance. But the rate limiter writes items with `PK=RATELIMIT#...` which is a different partition key pattern than the `USER#...` pattern the Lambda was designed for. The IAM policy grants access to the table ARN, which covers all items in the table -- so this is actually fine from an IAM perspective.

**Impact:** None -- re-evaluating, the permissions are sufficient. Withdrawing this finding.

### Finding 3: Missing Retry-After HTTP header in 429 responses -- Critical

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/error-handler.ts`:16-30 and `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/rate-limiter.ts`:167-175
**Issue:** AC5 requires "429 response with Retry-After header when rate limited." The `enforceRateLimit` function correctly calculates `retryAfterSeconds` and includes it in the `AppError.details` object. However, the middleware's `createErrorResponse` function (error-handler.ts:16-30) does NOT extract `retryAfter` from the error details and set it as an HTTP `Retry-After` header. The `Retry-After` value is buried inside the JSON body under `error.details.retryAfter`, but it is **never set as an actual HTTP header**. RFC 6585 (and AC5) require a `Retry-After` HTTP response header for 429 status codes.

The middleware `handleError` calls `createErrorResponse` which produces headers containing only `Content-Type` and `X-Request-Id`. No `Retry-After` header is ever added.

**Impact:** Violates AC5 (429 response with Retry-After header). Clients relying on the standard `Retry-After` HTTP header for backoff logic will not receive the header. This is a spec compliance failure.
**Fix:** Either (a) modify `createErrorResponse` in the middleware to check if the error is `RATE_LIMITED` and add `Retry-After: <seconds>` to the response headers, or (b) have the handlers catch the rate limit error and build the response manually with the header. Option (a) is more maintainable since it centralizes the behavior.

### Finding 4: DynamoDB TTL not enabled on the users table -- Critical

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/core/tables.stack.ts`:23-33
**Issue:** The rate limiter design depends on DynamoDB TTL to automatically clean up expired rate limit counter items (rate-limiter.ts line 8-9: "DynamoDB automatically deletes expired counters"). The rate limiter writes a `ttl` attribute on each counter item. However, the `UsersTable` in `tables.stack.ts` does NOT have `timeToLiveAttribute` configured. Without enabling TTL on the table, the `ttl` attribute is written but DynamoDB will never automatically delete expired items. Rate limit counter items (PK=RATELIMIT#...) will accumulate indefinitely.

**Impact:** Rate limit counter items will grow unbounded in the users table, increasing storage costs and potentially affecting table performance over time. The TTL-based cleanup that the design relies on will not function. This is a data leak / storage growth issue.
**Fix:** Add `timeToLiveAttribute: 'ttl'` to the `UsersTable` definition in `tables.stack.ts`:

```typescript
this.usersTable = new dynamodb.Table(this, "UsersTable", {
  // ... existing config ...
  timeToLiveAttribute: "ttl",
});
```

---

## Important Issues (Should Fix)

### Finding 5: Rate limit counter incremented even when limit is already exceeded (count-before-check race) -- Important

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/rate-limiter.ts`:74-146
**Issue:** The `incrementAndCheckRateLimit` function unconditionally increments the counter FIRST, then checks if the new count exceeds the limit. This means every request (even those that will be rejected) increments the counter. If a user makes 100 requests while rate-limited, the counter will show 110 instead of 11. While this is a common pattern for simplicity, it has a side effect: the counter becomes artificially inflated beyond the actual number of successful requests, making the `current` count in logs and responses misleading. More importantly, if the window is long (1 hour) and the user is hammered, a later decrease in the limit would be harder to reason about.

An alternative is to use a DynamoDB conditional expression: `ADD #count :inc` with a condition `attribute_not_exists(#count) OR #count < :limit`. This would prevent incrementing past the limit. However, this would change the semantics (counter would cap at the limit).

**Impact:** Minor counter inflation. Not a correctness bug since the rate limit still works, but monitoring/alerting may show misleading "current" counts.
**Fix:** Acceptable as-is for a fixed-window rate limiter. Document the behavior that the counter may exceed the limit. Alternatively, consider a conditional update to cap the counter at `limit + 1`.

### Finding 6: IP-based rate limiting on validate-invite is bypassable behind CDN/proxy -- Important

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/validate-invite/handler.ts`:71
**Issue:** The validate-invite handler extracts the source IP from `event.requestContext?.identity?.sourceIp`. When deployed behind CloudFront + API Gateway, this will be the CloudFront edge IP, NOT the client's real IP. The real client IP would be in the `X-Forwarded-For` header. With the current architecture (S3 + CloudFront per the tech stack), ALL requests from a CloudFront edge will share the same `sourceIp`, making the per-IP rate limit ineffective -- many different users behind the same edge would share one counter, or conversely, a single abuser could rotate through different CloudFront edges.

Note: API Gateway with a REST API (not HTTP API) does populate `sourceIp` with the caller's IP when the request comes directly. However, when CloudFront is in front, the `sourceIp` becomes the CloudFront IP. The WAF (Finding 1) would see the real client IP since WAF is evaluated before API Gateway, but the application-level rate limit does not.

**Impact:** Per-IP rate limiting for invite validation may not work correctly in production when requests flow through CloudFront. An attacker could bypass the 5/hour limit.
**Fix:** Use `event.headers['X-Forwarded-For']` (first IP in the chain) or configure API Gateway to pass through the real client IP. Also consider using the WAF rule for IP-based rate limiting instead of application-level for this endpoint.

### Finding 7: Validate-invite rate limit uses USERS_TABLE_CONFIG.tableName but reads invite codes from a different table -- Important

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/validate-invite/handler.ts`:72-82
**Issue:** The `enforceRateLimit` call in validate-invite uses `USERS_TABLE_CONFIG.tableName` (the users table) for storing rate limit counters, while `getInviteCode` reads from the invite-codes table. This is actually correct per AC6 ("Rate limit counters stored in existing users table"). However, the validate-invite Lambda's original IAM permissions (before Story 2.7) only had `grantReadWriteData` on the invite-codes table. The Story 2.7 changes on line 319 of `auth.stack.ts` now grant `grantReadWriteData` on the users table to validate-invite -- this is correct and necessary.

Verifying: line 316 grants invite-codes read/write, line 319 grants users read/write. This is correct. Withdrawing this as an issue, but noting the broad `grantReadWriteData` on the users table gives the validate-invite Lambda write access to ALL items in the users table (profiles, API keys, etc.), not just rate limit counters.

**Impact:** The validate-invite Lambda now has more permissions than strictly needed -- it can write to user profiles and API key items, not just rate limit counters. This violates least-privilege.
**Fix:** Replace `grantReadWriteData` with a scoped IAM policy that only allows `UpdateItem` on the users table (since rate limiting only needs `UpdateItem` with `ADD`), plus any existing read permissions that were needed.

### Finding 8: Test for enforceRateLimit has a weak assertion pattern (catch without guaranteed throw) -- Important

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/test/rate-limiter.test.ts`:207-229
**Issue:** The test "throws RATE_LIMITED when over the limit (AC3)" at line 207-229 has a problematic pattern. It first asserts `rejects.toThrow("Rate limit exceeded")` (good), but then in lines 216-229 it uses a `try/catch` block to inspect the error properties. The problem is that if the second `enforceRateLimit` call does NOT throw (e.g., due to a bug), the assertions inside the `catch` block will simply be skipped and the test will pass silently. There is no `expect.assertions(N)` or a fail case in the `try` block.

**Impact:** If the rate limiter has a regression that causes it not to throw, this test would silently pass, giving false confidence.
**Fix:** Add `expect.assertions(N)` at the top of the test, or add `expect.unreachable()` / `throw new Error("should have thrown")` after the `await enforceRateLimit(...)` call inside the `try` block.

### Finding 9: No CDK test verifying the API keys Lambda has sufficient permissions for rate limiting -- Important

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`
**Issue:** The CDK tests for AuthStack do not verify that the API Keys Lambda has `UpdateItem` permission (needed for rate limit counter writes). While the existing IAM policy at `auth.stack.ts:413` does include `dynamodb:UpdateItem`, there is no test asserting this. If someone removes `UpdateItem` from the policy in the future, no CDK test would catch the regression. Similarly, there is no test verifying that the validate-invite Lambda has `grantReadWriteData` on the users table.

**Impact:** Regression risk -- future changes to IAM policies could break rate limiting without test failures.
**Fix:** Add CDK assertion tests that verify the API Keys Lambda and Validate Invite Lambda have the required DynamoDB permissions for rate limiting operations.

---

## Minor Issues (Nice to Have)

### Finding 10: WAF rate-based rule comment inaccuracy about evaluation window -- Minor

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/rate-limiting.stack.ts`:46-47
**Issue:** The comment says "500 requests per 5 minutes per IP" and then says "WAF evaluates in 5-minute windows." AWS WAF actually evaluates rate-based rules over a **rolling/sliding** 5-minute window, not a fixed 5-minute window. The distinction matters for understanding burst behavior.

**Impact:** Developer confusion about rate limiting behavior.
**Fix:** Update comment to: "WAF evaluates over a rolling 5-minute window."

### Finding 11: Rate limiting stack has no dependency declaration on TablesStack -- Minor

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/bin/app.ts`:52-60
**Issue:** The `RateLimitingStack` is instantiated without any `addDependency` call. While it does not directly reference any other stack's resources (it creates a standalone WAF WebACL), it is good practice to document deployment order. Currently, the stack can be deployed independently, which is correct for a standalone WAF resource. However, if the stack is later modified to reference the API Gateway (which depends on other stacks), the lack of dependency could cause deployment failures.

**Impact:** Low -- no current issue, but could be a problem if the stack evolves.
**Fix:** No action needed now. Consider adding a comment noting that dependencies will be needed when the API Gateway association is added.

### Finding 12: Rate limiter does not sanitize the identifier for DynamoDB key safety -- Minor

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/rate-limiter.ts`:85
**Issue:** The PK is constructed as `RATELIMIT#${config.operation}#${config.identifier}`. If the `identifier` contains a `#` character (unlikely for user IDs or IP addresses, but possible for other future uses), it could create ambiguous key patterns. DynamoDB itself does not restrict key characters, but parsing logic or queries that split on `#` could be confused.

**Impact:** Low -- current identifiers (userId, IP address) do not contain `#`.
**Fix:** Consider validating or encoding the identifier to ensure it does not contain the `#` delimiter, or document the assumption.

### Finding 13: USERS_TABLE_CONFIG.tableName uses hardcoded fallback in rate limiter path -- Minor

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/users.ts`:19 (used by rate limiter callers)
**Issue:** `USERS_TABLE_CONFIG.tableName` defaults to `process.env.USERS_TABLE_NAME ?? "ai-learning-hub-users"`. The rate limiter callers in both handlers pass `USERS_TABLE_CONFIG.tableName`. If the `USERS_TABLE_NAME` environment variable is not set (misconfiguration), it silently falls back to the hardcoded default. This is an existing pattern in the codebase (not introduced by Story 2.7), but it means rate limit counters could be written to the wrong table in a misconfigured environment.

**Impact:** Low -- existing pattern, not a new issue.
**Fix:** Consider throwing an error if `USERS_TABLE_NAME` is not set, rather than falling back to a hardcoded default.

### Finding 14: The `enforceRateLimit` error message uses division that could produce fractional hours -- Minor

**File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/rate-limiter.ts`:169
**Issue:** The error message template is: `` `Rate limit exceeded: ${config.limit} ${config.operation} per ${config.windowSeconds / 3600} hour(s)` ``. If `windowSeconds` is not a clean multiple of 3600 (e.g., 1800 for 30 minutes), this produces "per 0.5 hour(s)" which is awkward. Currently the only callers use 3600, but this could be confusing for future windows.

**Impact:** Cosmetic, user-facing message quality.
**Fix:** Format the duration more gracefully, e.g., using minutes if under an hour: `${windowSeconds >= 3600 ? windowSeconds / 3600 + ' hour(s)' : windowSeconds / 60 + ' minute(s)'}`.

---

## Summary

- **Total findings:** 12 (2 withdrawn during analysis)
- **Critical:** 2 (Finding 3: Missing Retry-After HTTP header; Finding 4: DynamoDB TTL not enabled)
- **Important:** 4 (Finding 5: Counter inflation; Finding 6: IP behind CDN; Finding 7: Overly broad IAM for validate-invite; Finding 8: Weak test assertion; Finding 9: Missing CDK permission tests)
- **Minor:** 5 (Finding 10: Comment accuracy; Finding 11: Stack dependency; Finding 12: Key sanitization; Finding 13: Hardcoded fallback; Finding 14: Error message formatting)
- **Recommendation:** **Request changes.** The two Critical findings must be addressed before merge:
  1. The `Retry-After` HTTP header is required by AC5 and is not being set in the HTTP response. The value exists in the error details but never becomes an actual HTTP header.
  2. DynamoDB TTL must be enabled on the users table for rate limit counter cleanup to function. Without it, counter items accumulate forever.
