# Story 3.2.4 Dedup Scan Findings - Round 1

**Scanner:** Agent (Fresh Context)
**Date:** 2026-02-26
**Branch:** main (post-merge scan)
**Domain:** backend/shared/middleware/src/**/\*.ts + related packages
**Handlers scanned:\*\* 11 middleware source files, 12 Lambda handler files, 6 shared packages

## Files Analyzed

### Middleware package (primary scan target)

- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/agent-identity.ts` (NEW)
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/rate-limit-headers.ts` (NEW)
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts` (MODIFIED)
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/index.ts` (MODIFIED)
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/error-handler.ts`
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/auth.ts`
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/idempotency.ts`
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/concurrency.ts`
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/event-history.ts`
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/authorizer-policy.ts`
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/ssm.ts`

### Related packages

- `/Users/stephen/Documents/ai-learning-hub/backend/shared/types/src/api.ts` (AgentIdentity type)
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/types/src/events.ts` (ActorType type)
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/validation/src/event-context.ts` (NEW)
- `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/rate-limiter.ts` (RateLimitResult type)
- `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts` (MODIFIED)

### Lambda handlers (cross-reference for duplication)

- All 12 handler files in `backend/functions/*/handler.ts`

## Critical Issues (Must Fix)

1. **[Semantic Divergence] mock-wrapper.ts agent identity extraction skips validation**
   - **Files:**
     - `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`:281-294
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/agent-identity.ts`:27-55
   - **Shared export:** `@ai-learning-hub/middleware`, `extractAgentIdentity`
   - **Problem:** The mock-wrapper re-implements agent identity extraction inline (lines 281-294) instead of using `extractAgentIdentity`. The mock version does a simple header lookup and truthy check:
     ```typescript
     // mock-wrapper.ts:281-294
     const agentIdHeader =
       event.headers?.["x-agent-id"] ??
       event.headers?.["X-Agent-ID"] ??
       null;
     // ...
     agentId: agentIdHeader,
     actorType: agentIdHeader ? "agent" : "human",
     ```
     The real `extractAgentIdentity` performs regex validation (`/^[a-zA-Z0-9_\-.]{1,128}$/`) and throws `VALIDATION_ERROR` for invalid agent IDs. The mock version silently accepts any string (including `"agent with spaces"`, `"agent<script>"`, or strings longer than 128 characters). This means handler tests using mock-wrapper will pass with invalid agent IDs that would be rejected in production.
   - **Impact:** Handler tests that pass an invalid `X-Agent-ID` header will not see the 400 VALIDATION_ERROR that production would return. Any handler test relying on agent identity behavior is testing against a less strict contract than production enforces.
   - **Fix:** Import and call `extractAgentIdentity` from `@ai-learning-hub/middleware` (or from the source file directly) in the mock-wrapper. Wrap in try/catch to match mock-wrapper's error handling pattern. Alternatively, since mock-wrapper is for unit testing convenience, document the intentional simplification with a comment explaining the semantic gap.

## Important Issues (Should Fix)

2. **[Duplicate Code] X-Agent-ID echo header logic repeated 3 times in wrapper.ts**
   - **Files:**
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:274-279 (rate-limit 429 early return)
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:417-426 (success path)
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:452-456 (catch block)
   - **Shared export:** None -- needs extraction
   - **Problem:** The pattern of conditionally adding `X-Agent-ID` to a response is written 3 separate times within wrapper.ts:
     ```typescript
     // Pattern 1 (line 275): rate limit 429 early return
     if (agentIdentity.agentId) {
       (errorResponse.headers as Record<string, string>)["X-Agent-ID"] =
         agentIdentity.agentId;
     }
     // Pattern 2 (line 418): success path -- uses spread
     if (agentIdentity.agentId) {
       finalResult = {
         ...finalResult,
         headers: {
           ...(finalResult.headers ?? {}),
           "X-Agent-ID": agentIdentity.agentId,
         },
       };
     }
     // Pattern 3 (line 453): catch block -- uses mutation
     if (agentIdentity.agentId) {
       (errorResponse.headers as Record<string, string>)["X-Agent-ID"] =
         agentIdentity.agentId;
     }
     ```
     Additionally, patterns 1 and 3 use direct mutation while pattern 2 uses immutable spread. This style inconsistency increases the risk of one path being updated while others are missed.
   - **Impact:** If the agent-ID echo logic changes (e.g., adding a header prefix or sanitization), all 3 locations must be updated in sync. The style inconsistency (mutation vs spread) makes this harder to maintain.
   - **Fix:** Extract a helper function in `rate-limit-headers.ts` or a new `response-decoration.ts`:
     ```typescript
     export function addAgentIdHeader(
       response: APIGatewayProxyResult,
       agentId: string | null
     ): APIGatewayProxyResult {
       if (!agentId) return response;
       return {
         ...response,
         headers: { ...(response.headers ?? {}), "X-Agent-ID": agentId },
       };
     }
     ```
     Then call it once at each return point, or better yet, consolidate the response decoration into a single "decorate response" step that runs before every `return` in wrapper.ts.

3. **[Duplicate Code] Rate limit header decoration logic repeated 3 times in wrapper.ts**
   - **Files:**
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:256-273 (rate-limit 429 early return, uses `buildRateLimitHeaders` + manual merge)
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:409-414 (success path, uses `addRateLimitHeaders`)
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:441-449 (catch block, uses `buildRateLimitHeaders` + manual merge)
   - **Shared export:** `addRateLimitHeaders` exists in `rate-limit-headers.ts` but is only used for path 2
   - **Problem:** The 429 early-return path (line 256-273) and the catch block (lines 441-449) manually call `buildRateLimitHeaders` and merge headers, while the success path uses the dedicated `addRateLimitHeaders` function. This inconsistency means there are two different code patterns for the same operation in the same file. The dedicated `addRateLimitHeaders` function exists specifically to centralize this logic, but 2 of 3 call sites don't use it.
   - **Impact:** If `addRateLimitHeaders` behavior changes (e.g., adding a new header), the manual-merge paths at lines 256-273 and 441-449 would drift.
   - **Fix:** Use `addRateLimitHeaders` at all 3 locations. The function already handles the spread-merge pattern cleanly. For the 429 early return, this would be:
     ```typescript
     let errorResponse = handleError(error, requestId, logger);
     errorResponse = addRateLimitHeaders(
       errorResponse,
       result,
       options.rateLimit.windowSeconds
     );
     ```

4. **[Duplicate Pattern] Inline `enforceRateLimit` calls in 6 handler files -- coexists with new middleware-based rate limiting**
   - **Files:**
     - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts`:78-86
     - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-delete/handler.ts`:51-59
     - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-update/handler.ts`:50-58
     - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-restore/handler.ts`:48-56
     - `/Users/stephen/Documents/ai-learning-hub/backend/functions/validate-invite/handler.ts`:75 (approx)
     - `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-keys/handler.ts`:51 (approx)
     - `/Users/stephen/Documents/ai-learning-hub/backend/functions/invite-codes/handler.ts`:37 (approx)
   - **Shared export:** `@ai-learning-hub/middleware` now provides `WrapperOptions.rateLimit` via `RateLimitMiddlewareConfig`
   - **Problem:** Story 3.2.4 introduced a new middleware-based rate limiting approach via `wrapHandler` options (`options.rateLimit`), which automatically adds X-RateLimit-\* transparency headers. However, all 7 existing handler files still use the old pattern: calling `enforceRateLimit` directly inside the handler body. The old pattern does NOT return rate limit transparency headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) and does not expose `rateLimitResult` in the handler context. The saves-domain handlers all share an identical 8-line block:
     ```typescript
     await enforceRateLimit(
       client,
       USERS_TABLE_CONFIG.tableName,
       { ...SAVES_WRITE_RATE_LIMIT, identifier: userId },
       logger
     );
     ```
   - **Impact:** This is a known migration gap -- Story 3.2.4 built the infrastructure, and Story 3.2.7 (retrofit) is expected to migrate existing handlers. However, until migration happens, there are two parallel rate-limiting patterns in the codebase, which is confusing for new developers. The old pattern lacks transparency headers. Also, the 8-line `enforceRateLimit` block is duplicated verbatim across 4 saves-domain handlers.
   - **Fix:** Not a Story 3.2.4 bug -- this is expected to be addressed in the Story 3.2.7 retrofit. No immediate action required, but documenting here for completeness. When migrated, each handler can replace the inline `enforceRateLimit` call with a `rateLimit` option in `wrapHandler`, eliminating duplication and gaining transparency headers automatically.

## Minor Issues (Nice to Have)

5. **[Similar Pattern] `makeEvent` test factory duplicated across 5 middleware test files**
   - **Files:**
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/agent-identity.test.ts`:8
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/concurrency.test.ts`:6
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/rate-limit-integration.test.ts`:54
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/idempotency-concurrency.integration.test.ts`:32
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/idempotency.test.ts`:44
   - **Problem:** Each middleware test file defines its own `makeEvent()` factory function with a near-identical APIGatewayProxyEvent skeleton. The rate-limit-integration test version includes a full `requestContext.authorizer` object; the agent-identity test version has a minimal authorizer. The core shape (15+ fields of the APIGatewayProxyEvent identity block) is identical in all 5.
   - **Impact:** Low. Test factory duplication is common and each test may need slightly different defaults. However, `backend/test-utils/mock-wrapper.ts` already exports `createMockEvent()` which serves the same purpose.
   - **Fix:** Consider importing `createMockEvent` from `@ai-learning-hub/test-utils` in middleware tests, or extracting a shared `makeEvent` factory in a `backend/shared/middleware/test/helpers.ts` file. This is a nice-to-have, not a blocker.

6. **[Style Inconsistency] Response header mutation vs immutable spread in wrapper.ts**
   - **Files:**
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:270-273 (mutation: `errorResponse.headers = { ...errorResponse.headers, ...rlHeaders }`)
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:419-426 (immutable: `finalResult = { ...finalResult, headers: { ... } }`)
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:399-406 (immutable: idempotency status header uses spread)
     - `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/wrapper.ts`:435-438 (mutation: idempotency status in catch block uses direct assignment)
   - **Problem:** The try block uses immutable spread pattern for response decoration, while the catch block uses direct property mutation on `errorResponse.headers`. This mixed style within a single function makes the code harder to reason about.
   - **Impact:** No functional bug, but inconsistent style increases cognitive load and risk of accidental mutation bugs.
   - **Fix:** Standardize on immutable spread throughout, or (if performance is a concern in the catch path) document why mutation is acceptable there.

## Summary

- **Total findings:** 6
- **Critical:** 1 (mock-wrapper agent identity semantic divergence)
- **Important:** 3 (X-Agent-ID echo 3x duplication, rate limit header decoration 3x duplication, old vs new rate limiting pattern coexistence)
- **Minor:** 2 (test factory duplication, style inconsistency)
- **Recommendation:** FIX REQUIRED -- Critical issue #1 means handler tests using mock-wrapper may pass with invalid agent IDs that production would reject. Important issues #2 and #3 are within-file duplication in wrapper.ts that should be consolidated to prevent policy drift.
