# Story 2.1 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-14
**Branch:** story-2-1-clerk-integration-jwt-authorizer

---

## Critical Issues (Must Fix)

### Finding 1: [CRITICAL] Clerk Secret Key stored as plaintext SSM String Parameter, not SecureString

- **File**: `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts:29`
- **Issue**: The CDK stack uses `ssm.StringParameter.valueForStringParameter()` to retrieve the Clerk secret key. This expects a plaintext `String` SSM parameter. The Clerk secret key (`sk_live_*` or `sk_test_*`) is a secret credential and MUST be stored as a `SecureString` parameter (which is KMS-encrypted at rest) or retrieved via AWS Secrets Manager. Using a plaintext String parameter means the secret is stored unencrypted in the SSM parameter store and visible in the CloudFormation template/console.
- **Suggestion**: Use `ssm.StringParameter.valueFromLookup()` with a SecureString parameter, or better yet use `cdk.SecretValue.ssmSecure()` to pass the value as a dynamic reference. Alternatively, use AWS Secrets Manager (`secretsmanager.Secret.fromSecretNameV2()`). Since CDK does not natively resolve SecureString parameters at synth time, the recommended pattern is to use a dynamic SSM reference: `{{resolve:ssm-secure:/ai-learning-hub/clerk-secret-key}}` which keeps the value encrypted and never appears in the CloudFormation template. Example:
  ```typescript
  environment: {
    CLERK_SECRET_KEY: `{{resolve:ssm-secure:/ai-learning-hub/clerk-secret-key}}`,
  }
  ```

### Finding 2: [CRITICAL] Performance: Every request does a conditional PutItem even for existing users (violates AC5)

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts:87`
- **Issue**: The handler always calls `ensureProfile(client, clerkId, publicMetadata)` before `getProfile(client, clerkId)`. This means every single authenticated request -- including the fast-path for existing users -- issues a conditional PutItem to DynamoDB that will fail with `ConditionalCheckFailedException` for existing profiles. AC5 explicitly states: "PROFILE exists -> GetItem only (no PutItem); fast path." The current implementation violates this: it always does PutItem + GetItem (2 DynamoDB operations), when existing users should only do GetItem (1 operation). The `ConditionalCheckFailedException` is caught and swallowed, but the DynamoDB write capacity is still consumed and latency is added unnecessarily on every request.
- **Suggestion**: Reverse the order: call `getProfile` first. If the profile is `null`, then call `ensureProfile` and `getProfile` again. This gives existing users the fast path (1 read), while new users get 1 read + 1 conditional write + 1 read (acceptable for first-auth only):

  ```typescript
  const client = getDefaultClient();
  let profile = await getProfile(client, clerkId);

  if (!profile) {
    await ensureProfile(client, clerkId, publicMetadata);
    profile = await getProfile(client, clerkId);
  }
  ```

---

## Important Issues (Should Fix)

### Finding 3: [HIGH] No handling for getProfile returning null after ensureProfile

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts:90-95`
- **Issue**: After calling `ensureProfile` and `getProfile`, the code does `if (profile?.suspendedAt)` and then accesses `profile?.role` on line 98. If `getProfile` returns `null` (e.g., DynamoDB eventually-consistent read returns null immediately after a write, or a concurrent delete), the code does not explicitly handle this. It would silently proceed to Allow with `role = "user"` (due to the fallback chain on line 98). While unlikely, a null profile should be treated as an error condition after a successful ensureProfile, not silently allowed.
- **Suggestion**: Add an explicit null check after `getProfile` and return a deny or throw:
  ```typescript
  if (!profile) {
    logger.error(
      "Profile not found after ensureProfile",
      new Error("Profile inconsistency")
    );
    throw new Error("Unauthorized");
  }
  ```
  Also add a test for this edge case.

### Finding 4: [HIGH] Logger.error called with wrong signature in handler

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts:113`
- **Issue**: The handler calls `logger.error("JWT verification failed", error as Error)`. Looking at the `Logger` class in `/Users/stephen/Documents/ai-learning-hub/backend/shared/logging/src/logger.ts:222`, the `error` method signature is `error(message: string, error?: Error, data?: Record<string, unknown>)`. The call matches the expected signature, so this is actually correct. However, there is a subtle issue: the `error` variable in the `catch` block is typed as `unknown` (default catch type), and the cast `error as Error` is unsafe. If Clerk's `verifyToken` throws a non-Error value (e.g., a string or an object), the cast will produce incorrect behavior in the logger (accessing `.name`, `.message`, `.stack` on a non-Error object).
- **Suggestion**: Guard the cast:
  ```typescript
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("JWT verification failed", err);
  ```

### Finding 5: [HIGH] Missing test: getProfile returns null (profile not found after ensureProfile)

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.test.ts`
- **Issue**: There is no test case for when `getProfile` returns `null` after a successful `ensureProfile` call. This is an important edge case to verify the handler's behavior when the profile is unexpectedly missing. The test suite covers the happy path and suspension, but not the null profile scenario.
- **Suggestion**: Add a test:
  ```typescript
  it("handles profile not found after ensureProfile", async () => {
    mockVerifyResult({
      sub: "user_ghost",
      publicMetadata: { inviteValidated: true },
    });
    mockEnsureProfile.mockResolvedValueOnce(undefined);
    mockGetProfile.mockResolvedValueOnce(null);
    // Verify behavior: should it throw? allow with default role? deny?
  });
  ```

### Finding 6: [HIGH] AUTHORIZER_CACHE_TTL exported but never used in CDK stack configuration

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts:23` and `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts`
- **Issue**: AC8 states "Authorizer cache TTL is 300 seconds (configurable)." The handler exports `AUTHORIZER_CACHE_TTL = 300`, and there is a test verifying the constant value. However, the CDK AuthStack does not configure any API Gateway authorizer with this TTL. The `AuthStack` only creates the Lambda function, not the API Gateway Token Authorizer resource that would reference this TTL. This means the cache TTL constant exists but has zero runtime effect -- API Gateway will use its own default (which is 300s, but this is coincidental and not explicitly configured). The TTL should either be set in the API Gateway authorizer configuration (when the authorizer is attached to an API), or documented as deferred to a later story.
- **Suggestion**: Either (a) add the API Gateway `TokenAuthorizer` construct to the `AuthStack` with `resultsCacheTtl: cdk.Duration.seconds(300)` referencing the constant, or (b) add a clear comment/TODO that the API Gateway authorizer attachment and TTL configuration is deferred to Story 2.2 or the API Gateway story. The test for AC8 currently only validates the constant value, which is insufficient to prove the cache actually works.

### Finding 7: [HIGH] Users test mock profile missing required `userId` field

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/test/users.test.ts:49-57`
- **Issue**: The `getProfile` test creates a mock profile object that is missing the `userId` field, which is a required property in the `UserProfile` interface (line 19 of `users.ts`). The mock has `PK`, `SK`, `email`, `displayName`, `role`, `createdAt`, `updatedAt` but not `userId`. Since the mock is passed through the mocked `getItem` function and its return type is generic `T`, TypeScript does not catch this mismatch, but the test data does not accurately represent the real data shape. This means the tests could pass even if downstream code expected `userId` to be present but it was not.
- **Suggestion**: Add `userId: "clerk_123"` to the mock profile objects in the users tests to match the `UserProfile` interface.

---

## Minor Issues (Nice to Have)

### Finding 8: [MEDIUM] Non-null assertion on Lambda role in NagSuppressions

- **File**: `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts:77`
- **Issue**: `this.jwtAuthorizerFunction.role!` uses a non-null assertion. While CDK always creates a role for `NodejsFunction`, the `!` operator bypasses TypeScript's null safety. If the role were ever null (e.g., an externally provided role scenario), this would cause a runtime error.
- **Suggestion**: Add a guard: `if (this.jwtAuthorizerFunction.role) { ... }` or use an assertion function.

### Finding 9: [MEDIUM] Resource: "\*" in IAM policy is overly permissive for authorizer

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts:41`
- **Issue**: The `generatePolicy` function returns `Resource: "*"` for both Allow and Deny policies. This means a cached Allow policy grants access to ALL API Gateway resources/methods, not just the specific method that was requested. Best practice for TOKEN authorizers is to scope the `Resource` to `event.methodArn` (or a wildcard based on the API, e.g., `arn:aws:execute-api:region:account:api-id/stage/*/*`). Using `*` works but is more permissive than necessary and means the cache applies globally rather than per-resource.
- **Suggestion**: Either pass `event.methodArn` into `generatePolicy` and use it as the Resource, or construct a scoped wildcard from the methodArn (e.g., replace the specific method/path with `*/*`). Note that if you want API Gateway to cache the result and reuse it across different resources for the same token, using `*` is intentional but should be documented.

### Finding 10: [MEDIUM] ensureProfile always calls both PutItem and getProfile -- two DynamoDB calls minimum

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/users.ts:60-97`
- **Issue**: Related to Finding 2. The `ensureProfile` function itself is clean, but the handler's usage pattern means it always does 2 DynamoDB calls. This is a design issue rather than a code bug. The `ensureProfile` function could optionally return the created item (by adding `ReturnValues: 'ALL_NEW'` to the PutCommand or similar), which would eliminate the need for a separate `getProfile` call on first auth. However, the `putItem` helper does not return the item.
- **Suggestion**: This is acceptable for now but worth optimizing later. Consider making `ensureProfile` return the profile on success, avoiding the second read.

### Finding 11: [LOW] Test for "missing Bearer prefix" (AC7) does not actually test the handler's token stripping logic

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.test.ts:259-268`
- **Issue**: The test case "throws Unauthorized when token is missing Bearer prefix" sets `event.authorizationToken = "invalid-format-token"` and then mocks `verifyToken` to reject. This means the test is actually testing that `verifyToken` rejection causes an Unauthorized throw, which is already tested by the previous test case. It does NOT test the handler's Bearer-stripping regex (`/^Bearer\s+/i`) behavior. The regex would pass `"invalid-format-token"` through unchanged to `verifyToken`, which is correct behavior, but the test name is misleading.
- **Suggestion**: Either rename the test to reflect what it actually tests, or add a separate test that verifies the Bearer prefix is correctly stripped (e.g., that `verifyToken` receives `"valid-jwt-token"` when given `"Bearer valid-jwt-token"`). The AC1 test already covers this, so the misleading test can be removed or renamed.

### Finding 12: [LOW] Coverage exclusion pattern change may miss handler source coverage

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/vitest.config.ts:23`
- **Issue**: The coverage exclusion was changed from `"functions/**"` (exclude all function files) to `"functions/**/*.test.ts"` (exclude only test files). This is correct for enabling coverage of handler source files. However, the `thresholds` are all set to 0 (lines 13-16), which means coverage is not actually enforced for the handler. The CLAUDE.md states "80% coverage enforced." The shared packages may have their own thresholds, but the backend workspace's thresholds being at 0 means the JWT authorizer handler coverage is not gated.
- **Suggestion**: Either raise the thresholds to a meaningful level (e.g., 80% to match the project requirement), or add per-file coverage thresholds for the new handler files. Alternatively, document why backend workspace thresholds remain at 0.

### Finding 13: [INFO] CDK auth stack test does not verify X-Ray tracing is enabled

- **File**: `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`
- **Issue**: The auth stack sets `tracing: lambda.Tracing.ACTIVE` on the Lambda function, but the CDK test does not assert that X-Ray tracing is enabled. This is a minor gap in test coverage.
- **Suggestion**: Add an assertion:
  ```typescript
  it("has X-Ray tracing enabled", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      TracingConfig: { Mode: "Active" },
    });
  });
  ```

### Finding 14: [INFO] PublicMetadata type in users.ts is not reused in handler.ts

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts:74` and `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/users.ts:28-33`
- **Issue**: The `users.ts` defines a `PublicMetadata` interface with `{ email?, displayName?, role?, inviteValidated? }`. But in the handler, `publicMetadata` is typed as `Record<string, unknown>` (line 74). The handler then passes this loosely-typed object to `ensureProfile`, which expects `PublicMetadata`. This works because `Record<string, unknown>` is assignable to `PublicMetadata` (all fields optional), but the handler loses type safety when accessing `publicMetadata.inviteValidated` (line 80) and `publicMetadata.role` (line 98).
- **Suggestion**: Import and use the `PublicMetadata` type in the handler:
  ```typescript
  const publicMetadata = (verified.publicMetadata ?? {}) as PublicMetadata;
  ```
  This would give proper type checking for `.inviteValidated` and `.role` accesses.

---

## Summary

- **Total findings:** 14
- **Critical:** 2
- **Important (High):** 5
- **Medium:** 3
- **Low/Info:** 4
- **Recommendation:** **Request Changes** -- the two Critical findings should be addressed before merge. Finding 1 (SSM plaintext secret) is a security concern: the Clerk secret key should use SecureString or Secrets Manager. Finding 2 (performance violation of AC5) means every authenticated request does an unnecessary DynamoDB conditional PutItem for existing users, violating the stated acceptance criteria. The High-severity findings (null profile handling, logger error safety, missing test edge cases, and unused TTL configuration) should also be addressed.
