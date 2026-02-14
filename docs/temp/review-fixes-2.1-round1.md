# Story 2.1 Code Review Fixes - Round 1

**Date**: 2026-02-14
**Branch**: story-2-1-clerk-integration-jwt-authorizer
**Reviewer findings**: docs/temp/review-findings-2.1-round1.md

## Summary

Fixed 10/10 addressed findings from round 1 (2 Critical, 4 High, 1 Low, 2 Info, plus 1 High test update).

## Fixes Applied

### [CRITICAL] Finding 1: SSM plaintext to ssm-secure dynamic reference

**File**: `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts`

- Removed the `clerkSecretKey` variable that used `ssm.StringParameter.valueForStringParameter()`
- Removed the `import * as ssm from "aws-cdk-lib/aws-ssm"` import (no longer needed)
- Changed the CLERK_SECRET_KEY environment variable to use a CloudFormation dynamic SSM Secure reference: `{{resolve:ssm-secure:/ai-learning-hub/clerk-secret-key}}`
- This ensures the secret value is resolved at deploy-time by CloudFormation and never exposed in the CDK template as plaintext

### [CRITICAL] Finding 2: Reverse ensureProfile/getProfile order for AC5 fast path

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts`

- Reordered handler logic: `getProfile` is now called FIRST
- Only if profile is null (new user), `ensureProfile` is called followed by a second `getProfile`
- Existing users now take a fast path with only 1 DynamoDB read (no unnecessary PutItem)
- Updated all test mocks in handler.test.ts to reflect the new call order

### [HIGH] Finding 3: Add null guard after getProfile

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts`

- Added a null check after the getProfile/ensureProfile flow
- If profile is still null after ensureProfile, logs an error with "Profile inconsistency" and throws "Unauthorized"
- Prevents undefined property access on profile fields downstream

### [HIGH] Finding 4: Safe error cast in catch block

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts`

- Replaced `error as Error` with a safe runtime check: `error instanceof Error ? error : new Error(String(error))`
- Prevents issues when non-Error objects are thrown (e.g., strings, plain objects)

### [HIGH] Finding 5: Add test for null profile edge case

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.test.ts`

- Added "Profile not found edge case" describe block
- Test verifies that when both getProfile calls return null (before and after ensureProfile), the handler throws "Unauthorized"

### [HIGH] Finding 6: Add TODO comment for AUTHORIZER_CACHE_TTL

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts`

- Expanded the JSDoc comment on AUTHORIZER_CACHE_TTL to explain it will be consumed by CDK ApiStack
- Added TODO noting it needs to be wired into the API Gateway TokenAuthorizer in the API story

### [HIGH] Finding 7: Add userId to test mock profiles

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/test/users.test.ts`

- Added `userId: "clerk_123"` to the mock profile object in the getProfile test
- Now matches the UserProfile interface shape

### [LOW] Finding 11: Rename misleading test

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.test.ts`

- Renamed "throws Unauthorized when token is missing Bearer prefix" to "throws Unauthorized when verifyToken rejects with invalid token format"
- The test actually mocks verifyToken rejection, not Bearer prefix stripping

### [INFO] Finding 13: Add X-Ray tracing assertion

**File**: `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`

- Added test "has X-Ray tracing enabled" in the "JWT Authorizer Lambda" describe block
- Asserts TracingConfig Mode is "Active" on the Lambda function

### [INFO] Finding 14: Import PublicMetadata type in handler

**File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts`

- Added `type PublicMetadata` to the import from `@ai-learning-hub/db`
- Changed the publicMetadata cast from `Record<string, unknown>` to `PublicMetadata`
- Provides type safety for accessing publicMetadata fields

## Test updates for new getProfile-first flow

All existing tests in `handler.test.ts` were updated to reflect the new flow where `getProfile` is called before `ensureProfile`:

- **Existing user tests** (AC1, AC2, AC5, AC6, Role resolution, Policy generation): Mock `getProfile` to return a profile immediately; assert `ensureProfile` is NOT called
- **New user test** (AC4): Mock first `getProfile` returning null, then `ensureProfile`, then second `getProfile` returning the profile; assert `getProfile` called twice
- **Null profile test** (Finding 5): Both `getProfile` calls return null to test the guard

## Verification

- `npm run lint`: 0 errors (23 pre-existing warnings unchanged)
- `npm run build`: All 8 workspaces build successfully
- `npm test`: All 283 tests pass across all workspaces
- Coverage: 100% statements/lines on handler.ts, auth.stack.ts, users.ts
