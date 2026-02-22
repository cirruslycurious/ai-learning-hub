# Story 2.1-D10 Code Review Findings - Round 2

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-22
**Branch:** story-2-1-d10-add-jwt-fallback-to-api-key-authorizer

## Round 1 Fixes Verification

All 4 Important issues and all 5 Minor issues from Round 1 have been addressed:

| Round 1 Finding                                                  | Status | Verification                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Important #1: Role fallback missing `publicMetadata.role`        | FIXED  | `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts` line 205 now uses `profile.role \|\| (publicMetadata.role as string) \|\| "user"`, matching jwt-authorizer line 85. A dedicated test was added at handler.test.ts line 821. |
| Important #2: Non-Bearer schemes not rejected early              | FIXED  | `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts` line 159 now checks `!/^Bearer\s+/i.test(authHeaderValue)` before proceeding. Test at handler.test.ts line 767 verifies `verifyToken` is NOT called for `Basic` scheme.     |
| Important #3: CDK test AC9 was count-based                       | FIXED  | `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts` line 134 now filters policies by role ref containing "ApiKeyAuthorizer" and checks for `ssm:GetParameter`.                                                                        |
| Important #4: No CDK test for PutItem on api-key-authorizer      | FIXED  | `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts` line 173 now specifically checks for `dynamodb:PutItem` on policies attached to "ApiKeyAuthorizer" role.                                                                          |
| Minor #1: Bearer prefix test coupled to implementation           | FIXED  | Test updated to assert `verifyToken` is NOT called.                                                                                                                                                                                                                    |
| Minor #2: createEvent/createEventWithHeaders duplication         | FIXED  | `createEvent` at handler.test.ts line 139 now delegates to `createEventWithHeaders`.                                                                                                                                                                                   |
| Minor #3: Missing getClerkSecretKey failure test                 | FIXED  | Test at handler.test.ts line 776 covers this.                                                                                                                                                                                                                          |
| Minor #4: Missing ensureProfile failure test                     | FIXED  | Test at handler.test.ts line 788 covers this.                                                                                                                                                                                                                          |
| Minor #5: Missing ensureProfile-success-but-getProfile-null test | FIXED  | Test at handler.test.ts line 804 covers this.                                                                                                                                                                                                                          |

## Critical Issues (Must Fix)

None identified.

## Important Issues (Should Fix)

None identified.

## Minor Issues (Nice to Have)

1. **Unused variable `apiKeyAuthLogicalId` in CDK test**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`, line 149
   - **Problem:** The variable `apiKeyAuthLogicalId` is assigned (`const apiKeyAuthLogicalId = apiKeyAuthEntry![0];`) but is never referenced in the subsequent filter logic. The filter on lines 159-164 uses the hardcoded string `"ApiKeyAuthorizer"` directly. This appears to be a leftover from an earlier iteration where the variable was going to be used dynamically.
   - **Impact:** Dead code. No functional impact -- the test logic is correct since CDK logical IDs for this construct will contain "ApiKeyAuthorizer". May cause a lint warning for unused variables depending on ESLint configuration.
   - **Fix:** Either remove the unused assignment on line 149, or use `apiKeyAuthLogicalId` in the filter instead of the hardcoded string:
     ```typescript
     // Remove line 149 entirely, or:
     return (
       typeof ref === "string" &&
       ref.includes(apiKeyAuthLogicalId.replace("Function", ""))
     );
     ```

2. **Misleading comment in AC9 test does not match actual filter logic**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`, lines 139-142
   - **Problem:** The comment says "We identify it by checking the logical ID contains 'ApiKeyAuthorizer'" but the actual filter on line 142 only checks `envVars.CLERK_SECRET_KEY_PARAM && envVars.USERS_TABLE_NAME`, which matches three Lambdas (JWT authorizer, validate-invite, and API Key authorizer), not specifically the API Key authorizer. The comment describes the _policy_ filter logic (lines 159-164) rather than the Lambda-finding logic. This is confusing for future readers.
   - **Impact:** Readability only. The test is functionally correct because the Lambda-finding step only needs to confirm that at least one Lambda with those env vars exists, and the policy-filtering step properly narrows to "ApiKeyAuthorizer".
   - **Fix:** Update the comment to accurately describe the two-step approach:
     ```typescript
     // Step 1: Confirm at least one Lambda has CLERK_SECRET_KEY_PARAM
     // Step 2: Find IAM policies attached specifically to ApiKeyAuthorizer role
     ```

## Acceptance Criteria Compliance Check

| AC   | Status        | Notes                                                                                                                                                                                                                                                                   |
| ---- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | PASS          | Valid JWT with no API key returns Allow with `authMethod: "jwt"`, `userId`, `role`. Test at handler.test.ts line 644.                                                                                                                                                   |
| AC2  | PASS          | Both headers present -- API key path used, `verifyToken` not called. Test at handler.test.ts line 846.                                                                                                                                                                  |
| AC3  | PASS          | Invalid/expired JWT throws Unauthorized. Test at handler.test.ts line 753.                                                                                                                                                                                              |
| AC4  | PASS          | Invite not validated returns Deny INVITE_REQUIRED. Tests at handler.test.ts lines 665 and 680 (both `false` and missing).                                                                                                                                               |
| AC5  | PASS          | Suspended user returns Deny SUSPENDED_ACCOUNT. Test at handler.test.ts line 695.                                                                                                                                                                                        |
| AC6  | PASS          | First-time user calls ensureProfile then returns Allow. Test at handler.test.ts line 719.                                                                                                                                                                               |
| AC7  | PASS          | CDK adds `CLERK_SECRET_KEY_PARAM` env var (auth.stack.ts line 160), `ssm:GetParameter` (lines 189-203), and `dynamodb:PutItem` (lines 176-186).                                                                                                                         |
| AC8  | PASS          | All 8 test scenarios covered: JWT fallback valid (line 644), API key priority (line 846), invalid JWT (line 753), invite not validated (line 665), suspended (line 695), create-on-first-auth (line 719), neither header (line 762), context shape (lines 883 and 908). |
| AC9  | PASS          | CDK tests verify `CLERK_SECRET_KEY_PARAM` env var (line 124) and `ssm:GetParameter` specifically on ApiKeyAuthorizer role (line 134).                                                                                                                                   |
| AC10 | CANNOT VERIFY | Requires running tests; not part of code review.                                                                                                                                                                                                                        |
| AC11 | CANNOT VERIFY | Requires deployment and smoke test; not part of code review.                                                                                                                                                                                                            |

## What I Checked

- **Handler logic parity with jwt-authorizer:** The JWT fallback path in `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.ts` (lines 151-224) now exactly mirrors the jwt-authorizer at `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.ts` (lines 44-103) for: token extraction, `verifyToken` call, invite validation, profile lookup with create-on-first-auth, suspension check, role fallback chain, and context shape.
- **Security:** No hardcoded secrets (AWS keys, API keys, private keys, connection strings) found in any changed files. Secrets are fetched from SSM via `getClerkSecretKey()`.
- **Shared library usage:** All imports use `@ai-learning-hub/*` packages (logging, middleware, db) and `@clerk/backend` as required by CLAUDE.md.
- **Error handling:** Both API key and JWT fallback paths have proper try/catch with "Unauthorized" throws. Non-Unauthorized errors are logged before rethrowing. The Bearer prefix check prevents unnecessary SSM calls for non-Bearer schemes.
- **CDK infrastructure:** API Key authorizer Lambda correctly has `CLERK_SECRET_KEY_PARAM` env var, `ssm:GetParameter` permission scoped to the specific SSM parameter ARN, and `dynamodb:PutItem` added to the existing policy statement.
- **Test coverage:** 15 new test cases added across 3 describe blocks (JWT Fallback, Auth method priority, JWT fallback context shape), covering happy paths, error paths, edge cases, and context shape verification.
- **No ADR violations:** No Lambda-to-Lambda calls, no direct secret storage, REQUEST-type authorizer pattern preserved.

## Summary

- **Total findings:** 2
- **Critical:** 0
- **Important:** 0
- **Minor:** 2
- **Recommendation:** APPROVE. All 4 Important issues and 5 Minor issues from Round 1 have been properly fixed. The two remaining Minor findings are a dead variable and a misleading comment in CDK tests -- neither affects functionality or correctness. The implementation is clean, correctly mirrors the jwt-authorizer logic, uses shared libraries appropriately, and has thorough test coverage. Ready to merge.
