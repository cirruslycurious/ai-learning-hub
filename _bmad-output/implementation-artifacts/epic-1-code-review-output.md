# Code Review: Story 3.5.1 -- Epic 1 Code Cleanup

## Summary

This review covers the code cleanup story addressing 15 acceptance criteria: type deduplication, constant consolidation, import fixes, IAM least-privilege narrowing, new CDK tests, auth stack test hardening, and documentation updates. The implementation is largely well-executed, with the IAM narrowing correctly applied and the constant consolidation properly handling the CJS/ESM boundary. However, there are meaningful gaps in test coverage (AC9 and AC12 are partially incomplete), one over-granted IAM permission, and some test assertions that are too weak to catch regressions.

## Findings

### Finding 1: AC9 Not Implemented -- NAG suppressions missing `appliesTo` constraints

- **Severity:** high
- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/saves-routes.stack.ts` (line 498) and `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts` (lines 440, 619)
- **Description:** AC9 requires that after IAM narrowing, the `AwsSolutions-IAM5` suppressions be updated with `appliesTo` arrays that limit each suppression to `Resource::<table-arn>/index/*` patterns. The implementation only updates the `reason` text string but does not add any `appliesTo` constraints. Without `appliesTo`, the suppression remains a blanket wildcard suppression that would silently hide any future IAM5 violations (e.g., if someone accidentally adds `Resource: *` to a policy statement, the suppression would swallow the CDK Nag warning). The story dev notes (lines 165-173) explicitly provide the expected `appliesTo` pattern, and this was not applied.
- **Suggested fix:** Add `appliesTo` arrays to each `AwsSolutions-IAM5` suppression. For example in `saves-routes.stack.ts`:
  ```typescript
  {
    id: "AwsSolutions-IAM5",
    reason: "Index ARN wildcards are standard CDK behavior for GSI access",
    appliesTo: [
      `Resource::${savesTable.tableArn}/index/*`,
      `Resource::${usersTable.tableArn}/index/*`,
      `Resource::${idempotencyTable.tableArn}/index/*`,
    ],
  }
  ```
  Note: `grantReadWriteData` on savesTable and idempotencyTable still generates `index/*` wildcards. The `appliesTo` must cover all tables that still use broad grants or have explicit `index/*` in addToRolePolicy resources.

### Finding 2: AC12 Partially Implemented -- Missing function-specific IAM tests for jwtAuthorizer and usersMeFunction

- **Severity:** high
- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`
- **Description:** AC12 and Task 8.3 require function-specific IAM assertions for every Lambda in `AuthStack` that has an explicit `addToRolePolicy` call. The implementation adds tests for `validateInviteFunction` (GetItem + UpdateItem on inviteCodesTable) and `generateInviteFunction` (PutItem + Query on inviteCodesTable), but omits:
  - `jwtAuthorizerFunction` -- should assert GetItem, PutItem, UpdateItem, Query on usersTable (auth.stack.ts lines 82-92)
  - `usersMeFunction` -- should assert GetItem, UpdateItem on usersTable (auth.stack.ts lines 297-302)

  The old generic test ("grants the Lambda read/write access to users table") was removed and replaced with the SSM test (which was already tested before the rename). There is now NO test covering the jwtAuthorizer or usersMeFunction IAM grants on the users table. A regression in those policies (e.g., accidentally removing UpdateItem from usersMeFunction) would go undetected.

- **Suggested fix:** Add two more function-specific test cases following the same pattern used for validateInvite and generateInvite, filtering by role Ref containing "JwtAuthorizer" and "UsersMe" respectively.

### Finding 3: Saves-routes test IAM assertions do not verify function-specific role attachment

- **Severity:** medium
- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/api/saves-routes.stack.test.ts` (lines 179-262)
- **Description:** The IAM tests in saves-routes.stack.test.ts check that policies with certain action sets exist somewhere in the template, but do NOT verify which function's role the policy is attached to. For example:
  - Line 179: "mutation functions have explicit usersTable policy with UpdateItem + Query only" finds any policy containing those actions and asserts `length >= 1`. It does not confirm the policies are attached to mutation function roles (no role Ref filtering).
  - Line 204: `expect(usersNarrowPolicies.length).toBeGreaterThanOrEqual(1)` would pass even if only 1 of 4 mutation functions received the narrowed policy.
  - Line 235: "savesGetFunction has explicit GetItem + UpdateItem policy" has the same problem -- it matches any policy with that action pair without verifying it belongs to the saves-get function.

  Compare this with `auth.stack.test.ts` (lines 118-178) which correctly filters by role Ref (e.g., `ref.includes("ValidateInvite")`). The saves-routes tests do not follow this pattern and are weaker as a result. A regression that removes the narrowed policy from one of the 4 mutation functions would likely still pass these tests.

- **Suggested fix:** For each IAM test, add role Ref filtering to verify the policy is attached to the expected function(s) (e.g., `ref.includes("SavesCreate")`, `ref.includes("SavesGet")`). Also change assertions to check exact counts rather than `toBeGreaterThanOrEqual(1)`.

### Finding 4: Unnecessary `dynamodb:Query` permission on usersTable for saves mutation functions

- **Severity:** medium
- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/saves-routes.stack.ts` (lines 150-154, 264-268, 308-312, 352-356)
- **Description:** The saves mutation functions (create, update, delete, restore) are granted `dynamodb:UpdateItem` AND `dynamodb:Query` on usersTable. The inline comment says "Query (profile GSI lookup)". However, auditing all handler source code and the middleware wrapper shows:
  - The rate limiter (`incrementAndCheckRateLimit` in `rate-limiter.ts` line 94) only issues `UpdateCommand` on the users table.
  - The `wrapHandler` middleware (wrapper.ts line 253) only calls `incrementAndCheckRateLimit`.
  - No handler code in saves, saves-update, saves-delete, or saves-restore performs any `Query` or `queryItems` call on the users table.

  The `dynamodb:Query` grant is over-privileged for these functions. This is not a security regression since it replaces the broader `grantReadWriteData`, but it falls short of true least-privilege.

- **Suggested fix:** Remove `"dynamodb:Query"` from the usersTable policy statements for mutation functions. The `index/*` ARN suffix can also be removed since `UpdateItem` only targets the base table:
  ```typescript
  actions: ["dynamodb:UpdateItem"],
  resources: [usersTable.tableArn],
  ```

### Finding 5: Ops-routes test IAM assertions are generic and not function-specific

- **Severity:** low
- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/api/ops-routes.stack.test.ts` (lines 211-237)
- **Description:** The IAM tests for OpsRoutesStack check that some policy in the stack has `dynamodb:GetItem` and another has `dynamodb:PutItem`, but do not verify which function the policy is attached to. For example, "readiness function has read access to users table" (line 212) does not verify it is specifically the readiness function -- it matches any policy with GetItem. Similarly, "batch function has read/write access to idempotency table" does not verify it is the batch function.
- **Suggested fix:** Add role Ref filtering to bind each assertion to the expected function's logical ID (e.g., filter for Refs containing "Readiness" or "Batch").

### Finding 6: AC1 Direction Reversal -- FieldValidationError kept in types, not re-exported from validation

- **Severity:** low
- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/types/src/api.ts` (lines 62-68) and `/Users/stephen/Documents/ai-learning-hub/backend/shared/validation/src/validator.ts` (lines 11-16)
- **Description:** AC1 literally states: "api.ts no longer declares its own FieldValidationError interface; it re-exports the canonical ValidationErrorDetail from @ai-learning-hub/validation as FieldValidationError." The implementation does the opposite direction -- it keeps `FieldValidationError` as the canonical interface in `types/api.ts` and makes `validation/validator.ts` alias `ValidationErrorDetail = FieldValidationError` by importing from types.

  This is the CORRECT technical decision. The `@ai-learning-hub/validation` package already depends on `@ai-learning-hub/types` (for `AppError` and `ErrorCode`). If types imported from validation, it would create a circular dependency. Task 1.0 in the story explicitly anticipates this direction reversal. The deduplication goal is achieved -- there is exactly one interface definition and the duplicate is eliminated.

- **Suggested fix:** No code change needed. The implementation is correct. Optionally update the story AC text to reflect the actual direction chosen, or add a brief note in the PR description.

### Finding 7: AC2 CDK Constant Duplication -- Unable to import ESM middleware from CJS CDK

- **Severity:** low
- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/api-gateway.stack.ts` (lines 24-27)
- **Description:** AC2 states CDK's `api-gateway.stack.ts` should use `AUTHORIZER_CACHE_TTL` imported from `@ai-learning-hub/middleware`. The implementation correctly identifies that CDK runs as CJS (`"module": "commonjs"` in `infra/tsconfig.json`) and cannot `require()` the ESM middleware package at synth time. Instead, it duplicates the constant locally with a clear "Keep in sync with middleware/authorizerConstants.ts" comment. This is pragmatic but introduces a manual sync obligation -- if someone changes the value in `authorizerConstants.ts` but forgets to update `api-gateway.stack.ts`, the values silently diverge.
- **Suggested fix:** The duplication is acceptable given the CJS/ESM constraint. To mitigate sync risk, consider adding a CDK test assertion that validates the synthesized JWT authorizer `resultsCacheTtl` matches the expected 300 seconds. Alternatively, a lint rule or test in the middleware package could cross-check the two files.

### Finding 8: Authorizer test TTL assertion imports from mocked module

- **Severity:** low
- **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/jwt-authorizer/handler.test.ts` (lines 333-336) and `/Users/stephen/Documents/ai-learning-hub/backend/functions/api-key-authorizer/handler.test.ts` (lines 591-594)
- **Description:** The updated tests for AUTHORIZER_CACHE_TTL do `const { AUTHORIZER_CACHE_TTL } = await import("@ai-learning-hub/middleware")` and then assert `expect(AUTHORIZER_CACHE_TTL).toBe(300)`. However, the test file has already mocked `@ai-learning-hub/middleware` with `vi.mock` at the top of the file, including `AUTHORIZER_CACHE_TTL: 300` in the mock return value (jwt-authorizer line 87, api-key-authorizer line 70). This means the dynamic import resolves to the mock, and the test is asserting against its own mock value -- not the real constant from the middleware package. The test will always pass regardless of what the actual `authorizerConstants.ts` exports.
- **Suggested fix:** Use `vi.importActual("@ai-learning-hub/middleware")` in the test to bypass the mock and import the real module, or move this assertion to a separate test file that does not mock the middleware module.

### Finding 9: `savesGetFunction` has unnecessary `index/*` ARN for GetItem + UpdateItem

- **Severity:** low
- **File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/saves-routes.stack.ts` (lines 233-238)
- **Description:** The savesGetFunction is granted `dynamodb:GetItem` and `dynamodb:UpdateItem` on both `savesTable.tableArn` AND `${savesTable.tableArn}/index/*`. Neither `GetItem` nor `UpdateItem` operates on GSI indexes -- these are base table operations only. The `index/*` resource is unnecessary and adds a wildcard that triggers the IAM5 CDK Nag finding.
- **Suggested fix:** Change resources to `[savesTable.tableArn]` only (no index ARN needed for GetItem/UpdateItem).

## Verdict

PASS_WITH_NOTES

The implementation achieves its core objectives: type deduplication eliminates the duplicate interface, IAM permissions are meaningfully narrowed from broad `grantReadWriteData` to specific actions, the AUTHORIZER_CACHE_TTL constant is consolidated, new CDK tests provide previously-missing coverage for SavesRoutesStack and OpsRoutesStack, and documentation is updated. The CJS/ESM handling in CDK is pragmatic and well-documented.

The two high-severity findings (NAG `appliesTo` missing per AC9, and incomplete auth stack function-specific IAM tests per AC12) represent partial AC implementation that should be addressed. The medium-severity findings around test assertion weakness (Findings 3 and 4) mean the IAM narrowing is not as tightly verified or applied as it should be. These should be addressed before merge to ensure the cleanup story delivers on its stated testing and security promises.

No security regressions, no hardcoded secrets, no broken imports, and no behavioral changes were detected.
