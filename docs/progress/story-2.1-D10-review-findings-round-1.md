# Story 2.1-D10 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-22
**Branch:** story-2-1-d10-add-jwt-fallback-to-api-key-authorizer

## Critical Issues (Must Fix)

None identified.

## Important Issues (Should Fix)

1. **Role fallback logic differs from jwt-authorizer -- inconsistent behavior for the same user**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts`, line 205
   - **Problem:** The jwt-authorizer at `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts` line 85 uses a three-level role fallback:
     ```typescript
     const role = profile.role || (publicMetadata.role as string) || "user";
     ```
     The new JWT fallback path in the api-key-authorizer only uses:
     ```typescript
     const role = profile.role || "user";
     ```
     The `publicMetadata.role` fallback is missing. This means that during the create-on-first-auth flow (AC6), if `ensureProfile` creates a profile without a `role` field (or with a falsy `role`), and `publicMetadata.role` is set, the jwt-authorizer would return that metadata role while the api-key-authorizer JWT fallback would return `"user"`. The same user hitting the same endpoint could get different role assignments depending on which authorizer path runs first.
   - **Impact:** Role assignment inconsistency between the two JWT validation paths. A user whose profile has no `role` but whose Clerk `publicMetadata.role` is `"analyst"` would get `role: "analyst"` from the jwt-authorizer but `role: "user"` from the api-key-authorizer JWT fallback. This violates the story's requirement that the JWT fallback "mirrors the jwt-authorizer's Clerk verification logic."
   - **Fix:** Change line 205 to:
     ```typescript
     const role = profile.role || (publicMetadata.role as string) || "user";
     ```

2. **Non-Bearer Authorization schemes are not rejected early -- passed to verifyToken unnecessarily**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts`, lines 164-165
   - **Problem:** The handler strips the `Bearer ` prefix with a regex replace, but if the Authorization header uses a different scheme (e.g., `Basic`, `Digest`), the entire header value (including the scheme name) is passed to `verifyToken()`. While `verifyToken()` will correctly reject it, this causes:
     (a) An unnecessary SSM call to fetch the Clerk secret key.
     (b) A misleading error log: "JWT verification failed (fallback)" when no JWT was ever present.
     The jwt-authorizer has the same pattern, but it only receives TOKEN-type events where API Gateway has already filtered on the `Authorization` header -- clients cannot send `Basic` credentials to a TOKEN-type authorizer. The REQUEST-type authorizer receives all headers, making this a real concern.
   - **Impact:** Wasted SSM reads and misleading CloudWatch logs for non-Bearer auth attempts. In a worst case, an attacker could force repeated SSM calls by sending requests with `Authorization: Basic ...` to JWT-or-apikey routes.
   - **Fix:** Add an explicit check after extracting the auth header value:
     ```typescript
     if (!authHeaderValue || !authHeaderValue.match(/^Bearer\s+/i)) {
       logger.warn("No x-api-key or valid Bearer Authorization header");
       throw new Error("Unauthorized");
     }
     ```

3. **CDK test for AC9 (ssm:GetParameter) uses a weak count-based assertion that does not verify the specific Lambda**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`, lines 134-146
   - **Problem:** The test at line 134 ("API Key authorizer has ssm:GetParameter permission for Clerk secret (AC9)") asserts `ssmPolicies.length >= 3` but does not verify that the ssm:GetParameter policy is attached to the api-key-authorizer Lambda specifically. It counts all IAM policies in the stack that grant ssm:GetParameter. If a future refactor removes the api-key-authorizer's SSM permission but adds it to another Lambda, this test would still pass. The test title claims to verify AC9 but the assertion is not specific enough.
   - **Impact:** False confidence -- the test could pass even if the api-key-authorizer lacks SSM permission, as long as enough other Lambdas have it.
   - **Fix:** Use CDK's `template.hasResourceProperties` with a more targeted match that identifies the api-key-authorizer Lambda's role, or use `findResources` to locate the specific policy attached to the api-key-authorizer function's role and assert ssm:GetParameter is present on it.

4. **No CDK test assertion specifically verifying `dynamodb:PutItem` on the api-key-authorizer Lambda (AC7 partial gap)**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`
   - **Problem:** AC7 requires that the api-key-authorizer Lambda has `dynamodb:PutItem` IAM permission for `ensureProfile`. The existing CDK test at line 84-97 checks that _some_ Lambda in the stack has `dynamodb:PutItem`, but this was already true before this story (from the jwt-authorizer). There is no new assertion verifying that the api-key-authorizer specifically received PutItem. The tests added for this story (lines 114-146) only check env vars and ssm:GetParameter counts.
   - **Impact:** If PutItem were accidentally removed from the api-key-authorizer's policy, no test would fail.
   - **Fix:** Add a test that verifies the count of IAM policies granting PutItem increased from the pre-D10 state, or directly verify the api-key-authorizer Lambda's policy includes PutItem.

## Minor Issues (Nice to Have)

1. **Test for "Authorization header without Bearer prefix" relies on verifyToken rejecting the raw value, not on explicit Bearer validation**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.test.ts`, lines 808-815
   - **Problem:** The test mocks `verifyToken` to reject `"Basic some-credentials"`, which validates the current behavior. However, if the handler is fixed to reject non-Bearer schemes early (per Important Issue #2), this test's mock setup would need updating. The test is correct for the current code but is tightly coupled to the implementation choice of not validating the Bearer prefix.
   - **Impact:** Low. The test works correctly now.
   - **Fix:** If Important Issue #2 is addressed, update this test to not mock `verifyToken` (since it would never be called) and instead verify the handler rejects without calling `verifyToken`.

2. **The `createEvent` and `createEventWithHeaders` test helpers have duplicated boilerplate**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.test.ts`, lines 88-185
   - **Problem:** `createEventWithHeaders` (lines 88-135) and `createEvent` (lines 137-185) duplicate the same REQUEST authorizer event structure. `createEvent` could be refactored to call `createEventWithHeaders` internally, reducing ~50 lines of duplication.
   - **Impact:** Maintenance burden only. No functional impact.
   - **Fix:** Refactor `createEvent` to delegate to `createEventWithHeaders`:
     ```typescript
     function createEvent(apiKey?: string, headerName = "x-api-key") {
       return createEventWithHeaders(apiKey ? { [headerName]: apiKey } : {});
     }
     ```

3. **Missing test for `getClerkSecretKey` failure in JWT fallback path**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.test.ts`
   - **Problem:** There is no test covering the case where `getClerkSecretKey()` throws (e.g., SSM parameter not found, network error). While the error is caught by the try-catch and re-thrown as "Unauthorized", an explicit test would document this expected behavior and guard against regressions.
   - **Impact:** Minor coverage gap. The error path works correctly due to the generic catch block.
   - **Fix:** Add a test where `getClerkSecretKey` is mocked to reject, and verify the handler throws "Unauthorized".

4. **Missing test for `ensureProfile` failure in JWT fallback path**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.test.ts`
   - **Problem:** There is no test covering the case where `ensureProfile()` throws an error (e.g., DynamoDB write fails). The current AC6 test only covers the happy path (ensureProfile succeeds, second getProfile returns profile). If ensureProfile throws, the handler will catch it and throw "Unauthorized", but this behavior is not tested.
   - **Impact:** Minor coverage gap.
   - **Fix:** Add a test where `ensureProfile` is mocked to reject, verify the handler throws "Unauthorized".

5. **Missing test for case where ensureProfile succeeds but second getProfile returns null**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.test.ts`
   - **Problem:** Handler lines 189-195 cover the edge case where `ensureProfile()` succeeds but the subsequent `getProfile()` still returns null (a "Profile inconsistency" scenario). This code path is not tested.
   - **Impact:** The code correctly handles this by logging an error and throwing "Unauthorized", but there is no test for this edge case.
   - **Fix:** Add a test where the first `getProfile` returns null, `ensureProfile` succeeds, and the second `getProfile` also returns null, verifying "Unauthorized" is thrown.

## Acceptance Criteria Compliance Check

| AC   | Status        | Notes                                                                                                                                            |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | PASS          | Valid JWT with no API key returns Allow with `authMethod: "jwt"`, tested                                                                         |
| AC2  | PASS          | Both headers present, API key takes priority, verified `verifyToken` not called                                                                  |
| AC3  | PASS          | Invalid/expired JWT throws Unauthorized, tested                                                                                                  |
| AC4  | PASS          | Invite not validated returns Deny INVITE_REQUIRED, tested (both false and missing)                                                               |
| AC5  | PASS          | Suspended user returns Deny SUSPENDED_ACCOUNT, tested                                                                                            |
| AC6  | PASS          | First-time user calls ensureProfile, returns Allow, tested                                                                                       |
| AC7  | PARTIAL       | Env var and SSM permission added in CDK, PutItem added. But CDK tests don't specifically verify PutItem on api-key-authorizer (see Important #4) |
| AC8  | PASS          | All 8 test scenarios listed in AC8 are covered in the test file                                                                                  |
| AC9  | PARTIAL       | Test exists but uses count-based assertion not specific to api-key-authorizer (see Important #3)                                                 |
| AC10 | CANNOT VERIFY | Requires running tests; not part of this code review                                                                                             |
| AC11 | CANNOT VERIFY | Requires deployment and smoke test; not part of this code review                                                                                 |

## Summary

- **Total findings:** 9
- **Critical:** 0
- **Important:** 4
- **Minor:** 5
- **Recommendation:** Fix Important Issues #1 (role fallback inconsistency) and #2 (Bearer prefix validation) before merge. Issues #3 and #4 are CDK test specificity improvements that should be addressed. The implementation is functionally sound and closely mirrors the jwt-authorizer pattern, with the role fallback discrepancy being the most consequential issue to resolve for behavioral correctness.
