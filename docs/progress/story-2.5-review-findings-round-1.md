# Story 2.5 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-15
**Branch:** story-2-5-user-profile

## Critical Issues (Must Fix)

1. **`UserProfile` interface missing `globalPreferences` field**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/users.ts`, line 22-32
   - **Problem:** The `UserProfile` interface does not declare a `globalPreferences` field, even though the architecture document (`_bmad-output/planning-artifacts/architecture.md`, line 1056) specifies `globalPreferences: object` as part of the user profile schema. The `updateProfile` function writes `globalPreferences` to DynamoDB, and the handler's `toPublicProfile` reads it, but the shared type does not include it. The interface extends `Record<string, unknown>` which silently allows this at runtime, but the omission means TypeScript provides no compile-time safety for this field, and any code importing `UserProfile` will not see `globalPreferences` in autocomplete or type checks.
   - **Impact:** Type divergence between the canonical interface and actual data. Future consumers of `UserProfile` will not know `globalPreferences` exists. The handler works around this by defining its own inline type (handler.ts line 23-33) instead of reusing `UserProfile`, which is a code smell.
   - **Fix:** Add `globalPreferences?: Record<string, unknown>;` to the `UserProfile` interface in `users.ts`. Then update `handler.ts` to import and use `UserProfile` from `@ai-learning-hub/db` instead of defining an inline type.

2. **No size limit on `globalPreferences` -- potential storage abuse / DynamoDB item limit breach**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/validation/src/schemas.ts`, line 167
   - **Problem:** The `globalPreferences` field is validated as `z.record(z.unknown())` with no depth, key count, or size constraint. A user could send a multi-megabyte JSON object (e.g., `{ "a": "x".repeat(300000) }`). DynamoDB has a 400KB item size limit; exceeding it will cause an unhandled `ValidationException` from DynamoDB that is not caught as a known error type by the `updateItem` helper. This would surface as a 500 Internal Server Error to the client.
   - **Impact:** Denial-of-service vector (large payloads consume Lambda memory and time), potential 500 errors from DynamoDB item size violations, and unbounded storage cost per user.
   - **Fix:** Add a reasonable size constraint. For example, limit the serialized JSON size of `globalPreferences` to 10KB or 50KB using a Zod `.refine()` check: `.refine((obj) => JSON.stringify(obj).length <= 10240, "globalPreferences must be under 10KB")`. Also consider limiting nesting depth or key count.

## Important Issues (Should Fix)

3. **Handler uses inline type instead of importing `UserProfile` from shared library**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/users-me/handler.ts`, lines 23-33
   - **Problem:** The `toPublicProfile` function defines its own inline parameter type with `PK`, `SK`, `userId`, `email`, `displayName`, `role`, `globalPreferences`, `createdAt`, `updatedAt`. This duplicates and diverges from the `UserProfile` interface exported by `@ai-learning-hub/db`. Per CLAUDE.md, all Lambdas MUST import from `@ai-learning-hub/*` shared libraries to avoid duplication.
   - **Impact:** If `UserProfile` changes (e.g., new fields added), the handler's inline type will be out of sync. This is a maintenance hazard and violates the project's shared-library-first mandate.
   - **Fix:** After fixing issue #1 (adding `globalPreferences` to `UserProfile`), import `UserProfile` from `@ai-learning-hub/db` and use it as the parameter type for `toPublicProfile`.

4. **Unsupported HTTP methods return 400 VALIDATION_ERROR instead of 405 Method Not Allowed**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/users-me/handler.ts`, lines 91-94
   - **Problem:** When a DELETE, PUT, or POST request is made, the handler throws `AppError(ErrorCode.VALIDATION_ERROR, ...)` which maps to HTTP 400. The correct HTTP response for an unsupported method is 405 Method Not Allowed. While `ErrorCode` does not currently include a `METHOD_NOT_ALLOWED` variant, using `VALIDATION_ERROR` is semantically incorrect. The error message `"Method ${method} not allowed"` says "not allowed" but the status code says "bad request."
   - **Impact:** Clients and monitoring tools may misclassify method routing errors as input validation failures. API consumers will not see the standard 405 status code they expect per HTTP specification.
   - **Fix:** Either add `METHOD_NOT_ALLOWED` to `ErrorCode` in `@ai-learning-hub/types` (preferred, per ADR-008), or as a short-term fix, add a comment explaining the choice and consider returning a raw 405 response directly.

5. **Missing test: PATCH /users/me with non-existent profile should return 404**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/users-me/handler.test.ts`
   - **Problem:** The test suite covers GET 404 (line 255-264) but has no corresponding test for PATCH when the user profile does not exist. The `updateProfile` function in `users.ts` uses `conditionExpression: "attribute_exists(PK)"` and the `updateItem` helper throws `NOT_FOUND` on `ConditionalCheckFailedException`, but this error path is never tested for PATCH.
   - **Impact:** Regression risk. If the condition expression or error handling changes, there is no test to catch the regression for the PATCH path.
   - **Fix:** Add a test case like:
     ```typescript
     it("returns 404 when profile does not exist (PATCH)", async () => {
       mockUpdateProfile.mockRejectedValueOnce(
         new AppError(ErrorCode.NOT_FOUND, "User profile not found")
       );
       const event = createEvent(
         "PATCH",
         { displayName: "Test" },
         "nonexistent_user"
       );
       const result = await handler(event, mockContext);
       expect(result.statusCode).toBe(404);
     });
     ```

6. **`displayName` allows whitespace-only strings**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/validation/src/schemas.ts`, line 162-165
   - **Problem:** The schema uses `.min(1)` to enforce non-empty display names, but does not use `.trim()` before the length check. A user could set their display name to `"   "` (all spaces), which passes `.min(1)` but is functionally empty.
   - **Impact:** Users could have blank-looking display names, leading to poor UX in any frontend that displays profile information.
   - **Fix:** Add `.trim()` before `.min(1)`: `z.string().trim().min(1, "Display name cannot be empty").max(255, "Display name too long").optional()`.

7. **IAM permissions overly broad for users-me Lambda**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/auth/auth.stack.ts`, line 231
   - **Problem:** `usersTable.grantReadWriteData(this.usersMeFunction)` grants full read/write permissions including `PutItem`, `DeleteItem`, `BatchWriteItem`, and `Scan` on the entire users table. The users-me Lambda only needs `GetItem` and `UpdateItem` on the specific user's PK.
   - **Impact:** Violates least-privilege principle. If the Lambda is compromised, an attacker could delete or overwrite any user's profile or API keys in the entire table.
   - **Fix:** Replace `grantReadWriteData` with a scoped IAM policy granting only `dynamodb:GetItem` and `dynamodb:UpdateItem` on the table ARN. Example:
     ```typescript
     this.usersMeFunction.addToRolePolicy(
       new iam.PolicyStatement({
         actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
         resources: [usersTable.tableArn],
       })
     );
     ```
     Note: The existing NagSuppression for IAM5 would need to be updated or removed accordingly.

## Minor Issues (Nice to Have)

8. **Dead code: redundant null check after updateItem in `updateProfile`**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/users.ts`, lines 208-210
   - **Problem:** The `if (!updated)` check after `updateItem` can never be reached for the NOT_FOUND case. The `updateItem` helper (helpers.ts line 277-278) already throws `AppError(ErrorCode.NOT_FOUND, "Item not found")` when `ConditionalCheckFailedException` occurs. If the condition expression fires, the error propagates before `updated` is ever set. The only way `updated` could be `null` is if DynamoDB returns an empty `Attributes` map on a successful update, which should not happen with `ReturnValues: "ALL_NEW"`.
   - **Impact:** No functional impact -- this is defensive coding. But it may confuse future maintainers about the actual error flow.
   - **Fix:** Add a comment explaining this is a defensive fallback, or remove it since the helper already handles the NOT_FOUND case.

9. **`expressionAttributeNames` is declared but never populated in `updateProfile`**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/db/src/users.ts`, lines 177, 189-191, 199-201
   - **Problem:** The `expressionAttributeNames` object is created empty (line 177), a comment on line 189-190 mentions "reserved word escape for 'role' if needed in the future," and then line 199 conditionally spreads it only if it has keys (which it never does). This is dead code that adds cognitive overhead.
   - **Impact:** No functional issue, but the code creates a false impression that reserved word handling is partially implemented.
   - **Fix:** Remove the `expressionAttributeNames` declaration and the associated spread logic. If reserved word handling is needed later, it can be added at that time.

10. **CDK stack test could verify Users Me Lambda has USERS_TABLE_NAME environment variable**
    - **File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/auth/auth.stack.test.ts`
    - **Problem:** The existing test on line 104-112 verifies that there are two Lambdas with `USERS_TABLE_NAME` but without `CLERK_SECRET_KEY_PARAM`. While this implicitly covers the users-me function, there is no test specifically asserting that the users-me Lambda has the correct environment variables or correct entry point. The tests are somewhat generic across all three Lambdas.
    - **Impact:** Low -- the generic tests do provide some coverage, but specific assertions for users-me would catch regressions better.
    - **Fix:** Add a targeted test that identifies the users-me Lambda by its logical ID or entry path and asserts its specific properties.

11. **Non-null assertion on `auth` in handlers**
    - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/users-me/handler.ts`, lines 50, 68
    - **Problem:** Both `handleGet` and `handlePatch` use `auth!.userId` with a non-null assertion. While this is safe because `wrapHandler` with `requireAuth: true` guarantees `auth` is non-null, the assertion bypasses TypeScript's null-safety. If someone later changes the wrapper options, the assertion masks the potential null.
    - **Impact:** Low risk given the middleware guarantees, but it's a TypeScript code quality concern.
    - **Fix:** Either add an explicit null check with early return (defensive), or document that `auth!` is intentional because `requireAuth: true` guarantees it. Alternatively, the `HandlerContext` type could offer a `RequiredAuthHandlerContext` variant where `auth` is non-nullable.

12. **Test creates a new DynamoDB client mock per invocation but never asserts on it**
    - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/functions/users-me/handler.test.ts`, line 13
    - **Problem:** `mockGetDefaultClient` returns `{}` each time. The mock client is passed to `getProfile` and `updateProfile`, but tests never assert which client instance was used. This means if `getDefaultClient()` were accidentally called multiple times or with different configurations, the test wouldn't catch it.
    - **Impact:** Very low -- the handler pattern is simple enough that this is unlikely to be a problem.
    - **Fix:** No action needed, but a note for completeness.

## Summary

- **Total findings:** 12
- **Critical:** 2
- **Important:** 5
- **Minor:** 5
- **Recommendation:** **Request changes.** The two critical issues (missing `globalPreferences` in `UserProfile` interface and unbounded `globalPreferences` size) should be fixed before merge. The important issues (inline type duplication, missing PATCH 404 test, whitespace-only displayName, wrong status code for unsupported methods, and overly broad IAM) should also be addressed. The code is well-structured overall -- it correctly uses shared libraries for auth, validation, DB operations, and error handling, and follows the project's patterns. The test coverage is good but has the PATCH 404 gap noted above.
