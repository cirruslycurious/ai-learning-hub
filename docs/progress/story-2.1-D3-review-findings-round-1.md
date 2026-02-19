# Story 2.1-D3 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-17
**Branch:** story-2-1-d3-wraphandler-mock-dedup

## Critical Issues (Must Fix)

None.

## Important Issues (Should Fix)

### 1. `scopes` option accepted but silently dropped in `createMockEvent`

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`, lines 62, 76-85, 102
- **Problem:** The `MockEventOptions` interface declares a `scopes?: string[]` field (line 62) and the JSDoc on line 70 says "Supports configurable auth context (userId, role, authMethod, scopes)". However, `scopes` is never destructured from `options` in the function body (lines 76-85) and never placed on the `authorizer` object (line 102). The option is accepted and silently discarded.
- **Impact:** Consumers who pass `scopes` (as the mock-wrapper.test.ts AC4 test does on line 83) will believe they are configuring scopes in the event, but the value is silently dropped. This will cause confusing failures when D4/D5 work needs to test scope-based authorization. The test on line 86-90 passes only because it does not assert that `scopes` is present on the authorizer.
- **Fix:** Either (a) destructure `scopes` and include it in the `authorizer` object: `authorizer: userId ? { userId, role, authMethod, scopes } : undefined`, or (b) remove the `scopes` field from `MockEventOptions` and the JSDoc claim until it is actually needed, to avoid misleading callers.

### 2. `scopes` not included in mock `wrapHandler` auth object

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`, lines 196-205
- **Problem:** Even if `scopes` were placed on the authorizer by `createMockEvent`, the mock `wrapHandler` does not extract `scopes` from the authorizer and does not include it in the `auth` object passed to the inner handler. The real middleware (`backend/shared/middleware/src/auth.ts`, line 38-58) does extract and include `scopes` in the auth context.
- **Impact:** Handler tests using this mock cannot test scope-based access control at all. While no current handler tests rely on `auth.scopes`, this is advertised as AC4 functionality (API key auth context support) and will be needed for future stories.
- **Fix:** Add `scopes` extraction to the mock's auth construction: read `event.requestContext.authorizer.scopes`, parse it if it is a JSON string (matching real middleware behavior), and include it on the `auth` object.

### 3. `MockLogger` and `MockMiddlewareModule` types not re-exported from barrel

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/index.ts`
- **Problem:** The barrel file re-exports `MockEventOptions` and `MockMiddlewareOptions` types, but omits `MockLogger` (line 13 of mock-wrapper.ts) and `MockMiddlewareModule` (line 143 of mock-wrapper.ts). These are both `export interface` declarations in the source module.
- **Impact:** Consumers importing from `../../test-utils/index.js` cannot type-annotate variables with `MockLogger` or `MockMiddlewareModule` without reaching into the internal module path. This reduces the utility of the barrel export and forces consumers to use direct imports, which undermines the purpose of the barrel.
- **Fix:** Add `MockLogger` and `MockMiddlewareModule` to the type exports in `index.ts`.

## Minor Issues (Nice to Have)

### 4. `createMockEvent` test for AC4 does not actually validate scopes are present

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.test.ts`, lines 78-91
- **Problem:** The test titled "creates event with API key auth context and scopes (AC4)" passes `scopes: ["saves:write"]` but then asserts the authorizer equals `{ userId, role, authMethod }` -- an object that does NOT include `scopes`. The test name claims to verify scopes support but actually verifies scopes are absent. This is misleading.
- **Impact:** A reader (or CI report) would assume AC4 scopes are tested and working, when they are not. If someone later adds scopes to the authorizer, this test would need updating.
- **Fix:** If scopes are implemented (per finding #1), update the assertion to include `scopes: ["saves:write"]`. If scopes are deferred, rename the test to "creates event with API key auth context (AC4 -- scopes deferred)" or similar.

### 5. `mockCreateLoggerModule` creates a new logger per `createLogger()` call, preventing assertion on specific logger instances

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`, lines 42-46
- **Problem:** Each call to `createLogger()` from the mock module returns a brand-new `MockLogger` with fresh `vi.fn()` instances. This means tests cannot capture the logger mock to assert which log methods were called (e.g., `expect(logger.info).toHaveBeenCalledWith(...)`) because they have no reference to the specific instance the handler received. The same is true of the logger created inside `wrapHandler` on line 213.
- **Impact:** This is consistent with the original inline mocks which had the same behavior. No current tests assert on logger calls. But if a future test needs to verify logging behavior, there is no way to get a reference to the logger mock. Consider adding a `getLastLogger()` or an option to inject a specific mock logger.
- **Fix:** No immediate fix needed since this matches original behavior, but consider adding a `loggerOverride` option to `MockMiddlewareOptions` for future extensibility.

### 6. `createNoContentResponse` in shared mock omits `Content-Type` header

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`, lines 271-276
- **Problem:** The `createNoContentResponse` mock returns headers with only `X-Request-Id` and no `Content-Type`. Meanwhile, `createSuccessResponse` includes `Content-Type: application/json`. The original users-me and validate-invite mocks did not include `createNoContentResponse` at all (it was added in api-keys and invite-codes). This is correct behavior (204 responses typically should not have a Content-Type), so this is a minor style observation rather than a bug.
- **Impact:** None. The api-keys handler test verifies `result.body === ""` and `statusCode === 204`, and the lack of Content-Type is correct for 204.
- **Fix:** No fix needed.

### 7. `createMockContext` returns an empty object cast as `Context`

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`, lines 51-53
- **Problem:** `createMockContext()` returns `{} as Context`, which lacks all Lambda context properties (`functionName`, `functionVersion`, `memoryLimitInMB`, `callbackWaitsForEmptyEventLoop`, etc.). This matches the originals (`const mockContext = {} as Context;`), but if any future handler or middleware reads these properties, tests will get `undefined` instead of meaningful values.
- **Impact:** Low. No current handler accesses Lambda context properties directly. This is consistent with the pre-refactor behavior.
- **Fix:** Optional: populate commonly-used context fields (functionName, awsRequestId) with sensible test defaults.

## Summary

- **Total findings:** 7
- **Critical:** 0
- **Important:** 3
- **Minor:** 4
- **Recommendation:** **Approve with minor revisions.** The refactoring is well-executed and behaviorally equivalent to the original inline mocks. The core `wrapHandler` mock logic, auth handling, error handling, and event construction all match the originals. The most notable issue is the `scopes` option being accepted but silently discarded (findings #1 and #2), which is misleading for AC4 compliance and could cause confusion in future stories. The barrel export missing two types (#3) is a straightforward fix. All other findings are stylistic or defensive improvements. The test suite (24 new mock-wrapper tests) is comprehensive for the current scope.
