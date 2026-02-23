# Code Review: Story 3.1b -- Create Save API

## Summary

This review covers the POST /saves endpoint implementation including the Lambda handler, TransactWriteItems helper, EventBridge CDK stack, and Saves Routes CDK stack. The implementation is well-structured and follows established project patterns closely. The two-layer duplicate detection logic is correctly designed. I found **no critical security issues** and **no hardcoded secrets**. There are several important and medium-severity issues around 409 response ADR-008 compliance, missing scope enforcement, GSI query semantics, and IAM over-permissioning.

## Findings

### [HIGH] 409 response does not follow ADR-008 error format

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts:145-156`
- **Issue**: The 409 duplicate response is constructed manually with `{ error: { code, message, requestId }, existingSave }`. While this has the error fields, it is missing the `X-Request-Id` response header that all other responses include via `createErrorResponse()` or `createSuccessResponse()`. Additionally, the `wrapHandler` middleware at line 180-211 of `wrapper.ts` normalizes 4xx responses: it checks if `parsed?.error?.code` and `parsed?.error?.message` exist; the 409 passes this check, but the `existingSave` sibling field is non-standard for ADR-008. The same issue appears in `handleTransactionFailure()` at lines 273-284.
- **Fix**: Consider using `createErrorResponse()` from `@ai-learning-hub/middleware` with an AppError that carries the `existingSave` in its details, or at minimum add the `X-Request-Id` header to the manually constructed 409 responses. Example:
  ```typescript
  return {
    statusCode: 409,
    headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
    body: JSON.stringify({
      error: {
        code: "DUPLICATE_SAVE",
        message: "URL already saved",
        requestId,
      },
      existingSave: toPublicSave(layer1Result.items[0]),
    }),
  };
  ```

### [HIGH] Missing `requiredScope` on handler export -- API key scope not enforced

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts:368-370`
- **Issue**: The handler is exported with `wrapHandler(savesCreateHandler, { requireAuth: true })` but without a `requiredScope` option. The reference implementation for api-keys at `backend/functions/api-keys/handler.ts:134` uses `requiredScope: "keys:manage"`. Per ADR-013 and the api-key scope schema in `schemas.ts:159`, `"saves:write"` is a defined scope. Without scope enforcement, an API key with only `saves:read` scope can create saves.
- **Fix**: Add `requiredScope: "saves:write"` to the wrapHandler options:
  ```typescript
  export const handler = wrapHandler(savesCreateHandler, {
    requireAuth: true,
    requiredScope: "saves:write",
  });
  ```
  Also add a test case for scope enforcement (403 for API key with insufficient scope).

### [HIGH] Layer 1 GSI query uses `urlHash` as KeyConditionExpression but filters by `PK` -- returns ALL users' saves with that hash

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts:128-141`
- **Issue**: The `urlHash-index` GSI has `urlHash` as the partition key with no sort key (verified in `tables.stack.ts:80-83`). The query uses `keyConditionExpression: "urlHash = :urlHash"` and `filterExpression: "PK = :pk AND attribute_not_exists(deletedAt)"`. This means DynamoDB reads ALL items with that urlHash across ALL users, then filters client-side. For popular URLs saved by many users, this could read hundreds or thousands of items just to find the one belonging to the current user. This is a performance concern but more critically could cause DynamoDB throttling for hot partition keys.
- **Issue (secondary)**: The `filterExpression` uses `attribute_not_exists(deletedAt)` on a GSI. DynamoDB GSIs project attributes based on the projection type (ALL in this case), so `deletedAt` is available. However, filter expressions on GSIs are applied AFTER the read, so all items with matching `urlHash` are read regardless.
- **Fix**: This is an architectural limitation of the current GSI design. For this story, the behavior is functionally correct -- just potentially slow for popular URLs. Document this as a known performance consideration. A future optimization could add a composite GSI with `PK` as sort key, or use a direct GetItem on the marker (`URL#{urlHash}`) to check existence instead of a GSI query.

### [MEDIUM] `updateItem` call in `handleTransactionFailure` catches ALL errors as success

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts:346-349`
- **Issue**: The `catch` block at line 346 catches any error from the `updateItem` call and treats it as success (returns 200 with the original softDeleted item). But `updateItem` in `helpers.ts:290` throws `AppError(NOT_FOUND)` for `ConditionalCheckFailedException` and `AppError(INTERNAL_ERROR)` for other errors (network failures, DynamoDB service errors, etc.). The comment says "ConditionalCheckFailed means another request already restored it" but the catch will also swallow genuine INTERNAL_ERROR exceptions (e.g., network timeout, IAM permission issue).
- **Fix**: Narrow the catch to only handle the expected case:
  ```typescript
  } catch (error) {
    if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
      // ConditionalCheckFailed means another request already restored it
      return createSuccessResponse(toPublicSave(softDeleted), requestId, 200);
    }
    throw error;
  }
  ```

### [MEDIUM] EventBridge event bus name hardcoded without environment prefix

- **File**: `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/core/events.stack.ts:18`
- **Issue**: The EventBridge bus name is hardcoded as `"ai-learning-hub-events"` without the `environmentPrefix` that is used for DynamoDB table names (e.g., `${prefix}-ai-learning-hub-saves`). This means all environments (dev, staging, prod) share the same bus name in the same AWS account, which would cause CloudFormation conflicts when deploying multiple environments.
- **Fix**: Accept `environmentPrefix` as a prop and use it:
  ```typescript
  eventBusName: `${environmentPrefix}-ai-learning-hub-events`;
  ```
  Or make the EventsStack accept an `environmentPrefix` prop similar to TablesStack.

### [MEDIUM] IAM over-permissioning: `grantReadWriteData` on both tables

- **File**: `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/saves-routes.stack.ts:108-109`
- **Issue**: The Lambda gets `grantReadWriteData()` on both the saves table and users table. Comparing to the AuthStack pattern at `auth.stack.ts:70-79`, where least-privilege explicit IAM actions are used (e.g., `dynamodb:GetItem`, `dynamodb:PutItem`). The saves-create handler needs: saves table (Query on GSI, PutItem for save+marker, UpdateItem for restore), users table (UpdateItem for rate limit counters). Using `grantReadWriteData` grants DeleteItem, BatchWriteItem, and other write operations that are not needed.
- **Fix**: Use explicit IAM policy statements instead:
  ```typescript
  this.savesCreateFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"],
      resources: [savesTable.tableArn, `${savesTable.tableArn}/index/*`],
    })
  );
  this.savesCreateFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [usersTable.tableArn],
    })
  );
  ```

### [MEDIUM] `urlSchema` does not enforce URL max length (AC1 mentions length)

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/shared/validation/src/schemas.ts:17-32`
- **Issue**: AC1 requires URL length validation, but the `urlSchema` (and therefore `createSaveSchema.url`) has no `.max()` constraint. DynamoDB items have a 400KB limit, but an extremely long URL (e.g., 100KB+ of query parameters) could cause issues with normalization performance, hashing, and storage. The url-normalizer also does not impose a length limit.
- **Fix**: Add a max length to the URL schema. A common limit is 2048 characters:
  ```typescript
  export const urlSchema = z.string().max(2048, "URL must be 2048 characters or less").url()...
  ```
  Note: This fix is in the shared validation package (Story 3.1a), not in this story's handler. The handler correctly uses the shared schema, so the fix would be upstream.

### [MEDIUM] Test for AC6 (fire-and-forget) does not actually verify resilience to EventBridge failure

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.test.ts:496-509`
- **Issue**: The test comment says "emitEvent is fire-and-forget, so even if it throws internally, the handler should still return 201. Since we mock emitEvent as vi.fn(), it returns undefined (void), simulating the fire-and-forget contract." But the test never actually makes `mockEmitEvent` throw or reject. It only verifies the default mock behavior (returning undefined). A proper AC6 test should make `emitEvent` throw and confirm the handler still returns 201.
- **Fix**: Add a test that makes `mockEmitEvent` throw:

  ```typescript
  it("returns 201 even when emitEvent throws", async () => {
    mockQueryItems.mockResolvedValue({ items: [], hasMore: false });
    mockTransactWriteItems.mockResolvedValue(undefined);
    mockEmitEvent.mockImplementation(() => {
      throw new Error("EventBridge down");
    });

    const event = createSaveEvent({ url: "https://example.com" }, "user_123");
    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(201);
  });
  ```

  Note: Since `emitEvent` returns `void` (not a promise) and catches internally via its detached IIFE, throwing from the mock might not actually test the right thing. The real contract is that `emitEvent` never propagates errors to callers. The current test implicitly validates this since the mock returns `void`, but a more explicit test would be better.

### [LOW] Redundant `EVENT_BUS_NAME` fallback chain

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts:222`
- **Issue**: `const busName = EVENT_BUS_NAME ?? process.env.EVENT_BUS_NAME ?? ""` -- `EVENT_BUS_NAME` is assigned from `process.env.EVENT_BUS_NAME` at line 49, so the second `?? process.env.EVENT_BUS_NAME` is always redundant. If `EVENT_BUS_NAME` is undefined (only possible in test due to the guard at line 50-51), the env var has not changed, so `process.env.EVENT_BUS_NAME` would also be undefined. The same pattern appears at line 322.
- **Fix**: Simplify to `const busName = EVENT_BUS_NAME ?? "";` or better, make `EVENT_BUS_NAME` read lazily for testability.

### [LOW] `SaveItem.contentType` is typed as `string` instead of `ContentType` enum

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts:68`
- **Issue**: The `SaveItem` interface defines `contentType: string` but the value is always a `ContentType` enum value (from `detectContentType`). Using the `ContentType` type would provide stronger type safety and catch type mismatches at compile time.
- **Fix**: Import and use `ContentType`:
  ```typescript
  contentType: ContentType;
  ```

### [LOW] No test for URL max length validation (AC1)

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.test.ts`
- **Issue**: AC1 specifies URL length validation, but no test validates that extremely long URLs are rejected. This is related to the missing max length constraint in `urlSchema`.
- **Fix**: Add a test for excessively long URLs once the schema enforces a max length.

### [NIT] Missing function-name CfnOutput in SavesRoutesStack

- **File**: `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/saves-routes.stack.ts`
- **Issue**: The AuthStack exports `CfnOutput` for both ARN and function name for each Lambda (e.g., `ApiKeysFunctionArn` and `ApiKeysFunctionName`). The SavesRoutesStack does not export any `CfnOutput` for the saves-create function. While not strictly required since the function is created in this stack, it breaks consistency with the established pattern.
- **Fix**: Add CfnOutput entries for the saves-create function ARN and name.

### [NIT] Test mocks `TransactionCancelledError` as a separate class instead of importing

- **File**: `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.test.ts:24-31`
- **Issue**: The test creates `_MockTransactionCancelledError` inside the `vi.mock` factory and also imports `TransactionCancelledError` from the mock at line 72. The mock class matches the real class shape, but the `instanceof` check in the handler (`error instanceof TransactionCancelledError`) works because the import resolves to the same mock class. This is correct but fragile -- if someone changes the mock factory, the `instanceof` check in tests could silently break.
- **Fix**: This is fine as-is and follows the pattern used for mocking. No change needed, just noting for awareness.

### [NIT] CDK `NODEJS_LATEST` may cause runtime drift

- **File**: `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/saves-routes.stack.ts:84`
- **Issue**: Using `lambda.Runtime.NODEJS_LATEST` is consistent with all other stacks in this project, and there is already a CDK Nag suppression for it. This is a project-wide decision, not specific to this story.
- **Fix**: No change needed -- consistent with existing pattern.

## Summary Table

| Severity | Count | Key Issues                                                                               |
| -------- | ----- | ---------------------------------------------------------------------------------------- |
| CRITICAL | 0     | No security vulnerabilities or hardcoded secrets found                                   |
| HIGH     | 3     | Missing X-Request-Id header on 409, no scope enforcement, GSI query reads all users      |
| MEDIUM   | 4     | Broad error catch, no env prefix on event bus, IAM over-permissioning, no URL max length |
| LOW      | 3     | Redundant fallback, string type instead of enum, missing length test                     |
| NIT      | 3     | Missing CfnOutput, mock pattern note, NODEJS_LATEST note                                 |

## Acceptance Criteria Coverage

| AC  | Status  | Notes                                                                                                 |
| --- | ------- | ----------------------------------------------------------------------------------------------------- |
| AC1 | Partial | URL format, protocol, credentials validated. Max length NOT enforced (schema issue).                  |
| AC2 | Pass    | 201 with ULID, normalizedUrl, urlHash, contentType, tags default. PK/SK stripped.                     |
| AC3 | Pass    | 409 with existingSave returned. Note: missing X-Request-Id header (HIGH finding).                     |
| AC4 | Pass    | SaveCreated event emitted after write.                                                                |
| AC5 | Pass    | Auto-detection works, user override takes precedence.                                                 |
| AC6 | Partial | Fire-and-forget pattern correct via emitEvent's void return. Test does not verify failure resilience. |
| AC7 | Pass    | Rate limiting at 200/hr using enforceRateLimit.                                                       |
| AC8 | Pass    | Two-layer detection: GSI query + TransactWriteItems with condition.                                   |
| AC9 | Pass    | Soft-deleted save auto-restored with 200 + SaveRestored event.                                        |
