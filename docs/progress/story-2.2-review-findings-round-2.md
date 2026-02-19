# Story 2.2 Code Review Findings - Round 2

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-15
**Branch:** story-2-2-api-key-authorizer

## Critical Issues (Must Fix)

### 1. Missing exports for API key functions in `@ai-learning-hub/db` barrel file

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/index.ts`
- **Problem:** The handler at `backend/functions/api-key-authorizer/handler.ts` (line 4-7) imports `getApiKeyByHash`, `getProfile`, and `updateApiKeyLastUsed` from `@ai-learning-hub/db`. The functions `getApiKeyByHash` and `updateApiKeyLastUsed` are defined in `backend/shared/db/src/users.ts` but are **never re-exported** from the package barrel file `backend/shared/db/src/index.ts`. The barrel file only exports `getProfile`, `ensureProfile`, `USERS_TABLE_CONFIG`, `UserProfile`, and `PublicMetadata` from `users.ts`. The `ApiKeyItem` type is also not exported.
- **Impact:** **Build failure.** Any consumer importing `getApiKeyByHash`, `updateApiKeyLastUsed`, or `ApiKeyItem` from `@ai-learning-hub/db` will get a compile-time error. The Lambda function will fail to bundle/deploy. This is a release-blocking defect.
- **Fix:** Add the missing exports to `backend/shared/db/src/index.ts`:
  ```typescript
  export {
    getProfile,
    ensureProfile,
    getApiKeyByHash,
    updateApiKeyLastUsed,
    USERS_TABLE_CONFIG,
    type UserProfile,
    type PublicMetadata,
    type ApiKeyItem,
  } from "./users.js";
  ```

### 2. CDK AuthStack missing API Key Authorizer Lambda definition

- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts`
- **Problem:** The CDK stack was **not modified** on this branch (zero diff). It only defines the JWT Authorizer Lambda. However, the CDK test file (`infra/test/stacks/auth/auth.stack.test.ts`) was updated to expect **2** Lambda functions (line asserting `resourceCountIs("AWS::Lambda::Function", 2)`), expect `ApiKeyAuthorizerFunctionArn` and `ApiKeyAuthorizerFunctionName` outputs, and expect a Lambda with `USERS_TABLE_NAME` but without `CLERK_SECRET_KEY_PARAM`. Since the CDK stack still only creates 1 Lambda, all these new tests will fail.
- **Impact:** **CDK test suite will fail.** The tests assert infrastructure that does not exist in the stack. Additionally, there is no way to deploy the API Key Authorizer Lambda to AWS without its CDK definition, meaning this feature cannot be deployed.
- **Fix:** Add the API Key Authorizer Lambda to `infra/lib/stacks/auth/auth.stack.ts`. It should:
  - Create a `NodejsFunction` with entry pointing to `backend/functions/api-key-authorizer/handler.ts`
  - Set environment variable `USERS_TABLE_NAME` (no `CLERK_SECRET_KEY_PARAM` needed)
  - Grant `grantReadWriteData` on `usersTable` (for GSI query and UpdateItem)
  - Export the function ARN and name as `ApiKeyAuthorizerFunctionArn` and `ApiKeyAuthorizerFunctionName`
  - Expose it as a public property `apiKeyAuthorizerFunction` on the stack class
  - Add CDK Nag suppressions consistent with the JWT authorizer

## Important Issues (Should Fix)

### 1. No unit tests for `getApiKeyByHash` and `updateApiKeyLastUsed` in the db shared library

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/test/users.test.ts`
- **Problem:** The `users.test.ts` file was not modified in this branch. It contains tests only for `getProfile` and `ensureProfile`. The two new functions `getApiKeyByHash` and `updateApiKeyLastUsed` have zero unit test coverage in the shared db library. While the handler test file exercises these functions indirectly through mocks, the actual db function logic (GSI query construction, key formatting, error handling) is untested.
- **Impact:** The `getApiKeyByHash` function builds a GSI query with specific `indexName`, `keyConditionExpression`, and `limit: 1`. The `updateApiKeyLastUsed` function constructs DynamoDB key format `USER#${userId}` / `APIKEY#${keyId}`. None of this logic is verified by unit tests. Bugs in key construction or query parameters would only be caught in integration testing.
- **Fix:** Add test cases in `backend/shared/db/test/users.test.ts` covering:
  - `getApiKeyByHash` returning an item when found via GSI
  - `getApiKeyByHash` returning null when not found
  - `getApiKeyByHash` error propagation
  - `updateApiKeyLastUsed` calling updateItem with correct key format
  - `updateApiKeyLastUsed` error propagation

### 2. `updateApiKeyLastUsed` silently creates items if key does not exist (no condition expression)

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/users.ts`, lines ~157-170 (the `updateApiKeyLastUsed` function)
- **Problem:** The `updateItem` call does not include a `conditionExpression` such as `attribute_exists(PK)`. DynamoDB `UpdateItem` will **create a new item** if the specified key does not exist. If a race condition occurs (key revoked/deleted between lookup and update), this function would create a phantom partial item with only `PK`, `SK`, `lastUsedAt`, and `updatedAt` attributes -- missing required fields like `keyHash`, `name`, `scopes`.
- **Impact:** Orphaned partial items in the users table. Since this is fire-and-forget, the error would be silent. The likelihood is low (requires a revoke between GSI query and update), but the data corruption risk exists.
- **Fix:** Add `conditionExpression: "attribute_exists(PK)"` to the `updateItem` params. Since this is fire-and-forget, the ConditionalCheckFailedException will be caught by the `.catch()` handler in the authorizer, which is the desired behavior.

### 3. API key value could be logged in error stack traces

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts`, lines 56-62
- **Problem:** While the handler correctly avoids logging the API key value directly (complying with NFR-S8), the `apiKey` variable is in scope when `hashApiKey(apiKey)` is called on line 58. If `createHash` or `hashApiKey` threw an unexpected error (e.g., corrupted crypto module), the error's stack trace captured by the `catch` block on line 107 and logged on line 110 could potentially include the API key value in local variable captures, depending on the logging library's error serialization behavior.
- **Impact:** Low probability, but NFR-S8 explicitly states "API keys never logged." The current design is reasonable but not defensively hardened.
- **Fix:** Consider clearing the `apiKey` variable after hashing (e.g., `const keyHash = hashApiKey(apiKey); // apiKey no longer needed`). Alternatively, verify that the logging library does not serialize local variables in stack traces. This is a defensive measure.

## Minor Issues (Nice to Have)

### 1. `principalId` for Deny response uses `apiKeyItem.userId` which leaks user identity on suspended accounts

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts`, line 91
- **Problem:** When returning a Deny for suspended accounts, the code calls `deny(apiKeyItem.userId, "SUSPENDED_ACCOUNT")`, passing the real userId as the `principalId`. This is consistent with the JWT authorizer behavior (which also passes `clerkId`), but it means the API Gateway access logs will show the real user ID for denied suspended accounts.
- **Impact:** Minimal -- this is consistent with the JWT authorizer pattern and the userId is not exposed to the client. API Gateway access logs are internal.
- **Fix:** No action needed if consistent with JWT authorizer is the desired behavior. Note for future security hardening.

### 2. Authorizer handler tests create a new logger on every invocation without request context

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts`, line 41
- **Problem:** `createLogger()` is called at the top of every handler invocation without passing request context (e.g., `requestId` from the event). The JWT authorizer has the same pattern, so this is consistent, but it means structured logs from the API Key authorizer lack request correlation.
- **Impact:** Makes it harder to correlate logs across a single request in CloudWatch. This applies equally to the JWT authorizer.
- **Fix:** Consider passing `{ requestId: event.requestContext?.requestId }` to `createLogger()` in a future enhancement.

### 3. Comment artifact referencing "Minor #1" from previous review round

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/authorizer-policy.ts`, line 8
- **Problem:** The module-level comment says `"Resource "*" is intentional: authorizer responses are cached by API Gateway across endpoints, so the policy must apply to all methods (Minor #1)."` The "(Minor #1)" reference is an artifact from the previous code review round's findings. Code comments should not reference review finding numbers.
- **Impact:** Cosmetic. Confusing to future readers who have no context for "Minor #1."
- **Fix:** Remove the "(Minor #1)" parenthetical, leaving just the explanation about Resource "\*" being intentional for authorizer caching.

### 4. Test file uses fake but syntactically ambiguous AWS account ID

- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.test.ts`, lines 83 and 91
- **Problem:** The test uses `"123456789"` as a fake AWS account ID. Real AWS account IDs are 12 digits. While this is clearly test data, using a 9-digit number is slightly ambiguous -- security scanners may or may not flag it. Using a clearly fake 12-digit account ID like `"000000000000"` would be clearer.
- **Impact:** Cosmetic. No functional impact.
- **Fix:** Consider using `"000000000000"` for test ARNs and account IDs.

## Summary

- **Total findings:** 9
- **Critical:** 2
- **Important:** 3
- **Minor:** 4
- **Recommendation:** **REQUEST CHANGES** -- The two Critical issues are release-blocking. (1) The barrel file (`db/src/index.ts`) does not export the new API key functions, so the handler will fail to compile/bundle. (2) The CDK stack was not updated to include the API Key Authorizer Lambda, so the infrastructure tests will fail and the Lambda cannot be deployed. Both must be fixed before merge.
