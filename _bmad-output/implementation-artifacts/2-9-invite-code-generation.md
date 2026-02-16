# Story 2.9: Invite Code Generation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **existing user with a validated invite**,
I want **to generate invite codes and view my generated codes**,
so that **I can share codes with colleagues so they can sign up and join the platform**.

## Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | User authenticated with `inviteValidated === true` | `POST /users/invite-codes` | Generates 128-bit entropy code (16 alphanumeric chars `[A-Za-z0-9]`); stores in `invite-codes` table with `generatedBy`, `generatedAt`, `expiresAt` (7 days from now); returns `{ code, expiresAt, generatedAt }` — code shown only once |
| AC2 | Code generated | Response returned | Returns 201 with body `{ data: { code, expiresAt, generatedAt } }` and `X-Request-Id` header (requestId is a HEADER, not in body — per `createSuccessResponse` convention) |
| AC3 | User authenticated | `GET /users/invite-codes` | Returns paginated list of user's generated codes via `generatedBy-index` GSI: `{ items: [{ code (masked after redemption), status, generatedAt, expiresAt, redeemedAt? }], hasMore, nextCursor? }` with `X-Request-Id` header. Items sorted newest-first (in-memory sort by `generatedAt` descending, since GSI has no sort key) |
| AC4 | Code generated | Code format | Strictly alphanumeric (`[A-Za-z0-9]`), exactly 16 chars; one-time use only. MUST match existing `validateInviteBodySchema` regex `/^[a-zA-Z0-9]+$/` so codes pass validation at redemption |
| AC5 | User generates too many codes | Rate limit exceeded | Returns 429 `RATE_LIMITED` with `Retry-After` header; limit: 5 codes per user per day (86400 second window) |
| AC6 | User not authenticated or invite not validated | Any request | Returns 401 (no auth) or 403 `INVITE_REQUIRED` (no invite) — handled by existing JWT authorizer at API Gateway level. This route MUST be behind the JWT authorizer (not a public route) for invite enforcement to work |
| AC7 | User calls GET | Codes listed | Redeemed codes show masked code (first 4 chars + `****`); unredeemed codes show full code. Status priority: `revoked` > `redeemed` > `expired` > `active` (a revoked+expired code shows `revoked`) |

## Tasks / Subtasks

> **Task Ordering:** Task 1 (DB layer) MUST be completed first — Tasks 2-3 depend on the DB functions. Task 3 (schemas) is minimal but should exist before Task 2. Task 4 (CDK) can be done in parallel with Tasks 2-3 but must be done before Task 6. Task 5 (tests) depends on Tasks 1-3.

- [x] Task 1: Add invite code DB operations to `@ai-learning-hub/db` (AC: #1, #3, #4, #7)
  - [x]1.1 Add `putItem` to imports from `./helpers.js` in `backend/shared/db/src/invite-codes.ts` (currently only imports `getItem` and `updateItem`)
  - [x]1.2 Add `createInviteCode(client, userId, expiresInHours?)` to `backend/shared/db/src/invite-codes.ts` — generates 16-char strictly-alphanumeric code using custom function (see Code Generation Pattern below — NOT base64url which includes `-` and `_`), creates item `{ PK: CODE#<code>, SK: META, code, generatedBy: userId, generatedAt: now, expiresAt: now + 7 days }` via `putItem` with `conditionExpression: "attribute_not_exists(PK)"` (prevents collision). On `ConditionalCheckFailedException`, retry ONCE with a new code; throw `AppError(ErrorCode.INTERNAL_ERROR, "Failed to generate invite code")` if second attempt also fails. Returns `{ code: string, generatedAt: string, expiresAt: string }`
  - [x]1.3 Add `listInviteCodesByUser(client, userId, limit?, cursor?)` to same file — queries `generatedBy-index` GSI with `keyConditionExpression: "generatedBy = :userId"`, returns `PaginatedResponse<InviteCodeItem>` using existing `queryItems` helper with `indexName: "generatedBy-index"`. NOTE: GSI has no sort key so DynamoDB returns items in arbitrary order. After query, sort items in-memory by `generatedAt` descending (newest first) before returning
  - [x]1.4 Define `PublicInviteCodeItem` interface in `backend/shared/db/src/invite-codes.ts`: `{ code: string, status: 'active' | 'redeemed' | 'expired' | 'revoked', generatedAt: string, expiresAt?: string, redeemedAt?: string }`
  - [x]1.5 Add `toPublicInviteCode(item: InviteCodeItem): PublicInviteCodeItem` projection function that: (a) computes `status` with priority: `revoked` (isRevoked) > `redeemed` (redeemedBy set) > `expired` (expiresAt < now) > `active`, (b) masks code if `redeemedBy` exists (first 4 chars + `****`), (c) returns `PublicInviteCodeItem`
  - [x]1.6 Export new functions (`createInviteCode`, `listInviteCodesByUser`, `toPublicInviteCode`) and `PublicInviteCodeItem` type from `backend/shared/db/src/index.ts`
  - [x]1.7 Add unit tests in `backend/shared/db/test/invite-codes.test.ts` — test code generation (mock putItem, verify PK format, verify code is strictly alphanumeric, verify collision retry), test list query (mock queryItems, verify GSI name and pagination, verify in-memory sort by generatedAt descending), test `toPublicInviteCode` with all status combinations and priority (active, redeemed, expired, revoked, revoked+expired → revoked)

- [x] Task 2: Create invite code generation handler (AC: #1, #2, #4, #5, #6)
  - [x]2.1 Create `backend/functions/invite-codes/handler.ts` with router pattern (POST + GET dispatch via `httpMethod` switch)
  - [x]2.2 Implement `handlePost(ctx)`: enforce rate limit (`operation: "invite-generate"`, `identifier: userId`, `limit: 5`, `windowSeconds: 86400`), call `createInviteCode(client, userId)`, return `createSuccessResponse(result, requestId, 201)`
  - [x]2.3 Implement `handleGet(ctx)`: parse pagination from query params via `validateQueryParams(paginationQuerySchema, ...)`, call `listInviteCodesByUser(client, userId, limit, cursor)`, map items through `toPublicInviteCode`, return result (auto-wraps as 200)
  - [x]2.4 Add 405 METHOD_NOT_ALLOWED response for unsupported methods with `Allow: POST, GET` header
  - [x]2.5 Export as `wrapHandler(inviteCodesHandler, { requireAuth: true })`

- [x] Task 3: Create Zod validation schemas (AC: #1, #3)
  - [x]3.1 Create `backend/functions/invite-codes/schemas.ts` — no body schema needed for POST (no request body), re-export `paginationQuerySchema` from `@ai-learning-hub/validation` for GET. This file is minimal but maintains the three-file pattern (handler.ts, handler.test.ts, schemas.ts) used by all Lambda functions

- [x] Task 4: Add CDK infrastructure for invite code generation Lambda (AC: all)
  - [x]4.1 Add `generateInviteFunction` (NodejsFunction) to `infra/lib/stacks/auth/auth.stack.ts` — entry: `backend/functions/invite-codes/handler.ts`, env: `INVITE_CODES_TABLE_NAME`, `USERS_TABLE_NAME` (for rate limiting), runtime: NODEJS_LATEST, timeout: 10s, memory: 256MB, tracing: ACTIVE
  - [x]4.2 Grant `inviteCodesTable.grantReadWriteData()` (PutItem for create, Query for list via GSI)
  - [x]4.3 Grant rate limit access: `usersTable` UpdateItem permission (for rate limit counter) — follow exact pattern from validate-invite function
  - [x]4.4 Add CDK Nag suppressions (AwsSolutions-IAM4, AwsSolutions-L1, AwsSolutions-IAM5) — copy exact suppressions from existing Lambda definitions in auth.stack.ts
  - [x]4.5 Add CfnOutputs for function ARN and function name
  - [x]4.6 Update `infra/test/stacks/auth/auth.stack.test.ts` — update Lambda function count assertion (currently asserts 5, will be 6 with new function), add assertion for new Lambda resource, verify IAM permissions, verify table access grants

- [x] Task 5: Add comprehensive tests (AC: all)
  - [x]5.1 Create `backend/functions/invite-codes/handler.test.ts` following api-keys test pattern: mock `@ai-learning-hub/db` (createInviteCode, listInviteCodesByUser, toPublicInviteCode, enforceRateLimit, getDefaultClient, INVITE_CODES_TABLE_CONFIG, USERS_TABLE_CONFIG), mock `@ai-learning-hub/logging`, mock `@ai-learning-hub/middleware` (wrapHandler simulation), DO NOT mock `@ai-learning-hub/validation`
  - [x]5.2 Test POST success: verify 201 status, verify code/expiresAt/generatedAt in response, verify createInviteCode called with correct userId
  - [x]5.3 Test POST rate limit: mock enforceRateLimit to reject, verify 429 with RATE_LIMITED code, verify createInviteCode NOT called
  - [x]5.4 Test POST auth required: no authorizer context → 401
  - [x]5.5 Test GET success: verify 200 with items array. Mock `listInviteCodesByUser` to return raw `InviteCodeItem[]`, mock `toPublicInviteCode` to return `{ code: 'AbCd****', status: 'redeemed', generatedAt: '...', expiresAt: '...', redeemedAt: '...' }`. Verify items in response match `PublicInviteCodeItem` shape, verify pagination params forwarded
  - [x]5.6 Test GET with pagination: verify limit/cursor forwarded to listInviteCodesByUser
  - [x]5.7 Test unsupported method (PUT): verify 405 with Allow header
  - [x]5.8 Use `expect.assertions()` in all error-path tests (lesson from Story 2.7)

- [x] Task 6: Run full test suite and verify 80% coverage (AC: all)
  - [x]6.1 `npm test` passes
  - [x]6.2 No regressions in existing auth tests (Stories 2.1-2.8)
  - [x]6.3 Verify no broken imports from new exports in `@ai-learning-hub/db`

## Dev Notes

### Critical Architecture Context

**Success Response Shape (via `createSuccessResponse`):**
```json
{
  "statusCode": 201,
  "headers": {
    "Content-Type": "application/json",
    "X-Request-Id": "correlation-id"
  },
  "body": {
    "data": { "code": "aBcDeFgH12345678", "expiresAt": "2026-02-23T...", "generatedAt": "2026-02-16T..." }
  }
}
```
**NOTE:** `requestId` goes in the `X-Request-Id` HEADER, NOT in the body. The `createSuccessResponse(data, requestId, statusCode)` helper handles this automatically.

**ADR-008 Error Response Shape (for 4xx/5xx):**
```json
{ "error": { "code": "RATE_LIMITED", "message": "...", "requestId": "correlation-id" } }
```

**ADR-013 Auth:** User must have `inviteValidated === true` — this is already enforced by the JWT authorizer (deny with `INVITE_REQUIRED` if not validated). No new auth code needed for this story. **IMPORTANT:** `wrapHandler` does NOT check `inviteValidated` — enforcement happens at the API Gateway authorizer level only. This route MUST be deployed behind the JWT authorizer.

**ADR-014 API-First:** Response shapes optimized for machine consumption. Pagination uses `{ items, hasMore, nextCursor }` pattern.

### Existing Code to REUSE (DO NOT reinvent)

| What | Where | How to Use |
|------|-------|------------|
| DynamoDB helpers | `@ai-learning-hub/db` — `putItem`, `queryItems` | Import from db package, pass `INVITE_CODES_TABLE_CONFIG` |
| Rate limiter | `@ai-learning-hub/db` — `enforceRateLimit` | Call BEFORE DB operations, uses `USERS_TABLE_CONFIG.tableName` for counters |
| Invite code table config | `backend/shared/db/src/invite-codes.ts` — `INVITE_CODES_TABLE_CONFIG` | Already exists, already exported |
| `InviteCodeItem` interface | `backend/shared/db/src/invite-codes.ts` | Already defined with correct fields (`generatedBy`/`redeemedBy`) |

**TYPE NAMING TRAP:** `backend/shared/types/src/entities.ts` defines a DIFFERENT `InviteCode` type with WRONG field names (`createdBy`/`usedBy`/`usedAt`). DO NOT import `InviteCode` from `@ai-learning-hub/types`. ALWAYS use `InviteCodeItem` from `@ai-learning-hub/db` which matches the actual DynamoDB schema (`generatedBy`/`redeemedBy`/`redeemedAt`).
| Pagination schema | `@ai-learning-hub/validation` — `paginationQuerySchema` | Reuse for GET query params |
| Handler wrapper | `@ai-learning-hub/middleware` — `wrapHandler` | Wrap exported handler with `{ requireAuth: true }` |
| Success/error responses | `@ai-learning-hub/middleware` — `createSuccessResponse`, `createNoContentResponse` | Use for POST 201 response |
| AppError | `@ai-learning-hub/types` — `AppError`, `ErrorCode` | Throw for error cases |
| Structured logging | `@ai-learning-hub/logging` — `createLogger` | Logging via `ctx.logger` from wrapHandler |

### Code Generation Pattern

**CRITICAL: DO NOT use `base64url` encoding.** Base64url includes `-` and `_` characters which will FAIL the existing `validateInviteBodySchema` regex `/^[a-zA-Z0-9]+$/` in `backend/shared/validation/src/schemas.ts` when codes are redeemed.

Use a strictly-alphanumeric generation function:
```typescript
import { randomBytes } from "crypto";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateAlphanumericCode(length: number = 16): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHANUMERIC[b % ALPHANUMERIC.length]).join("");
}
```
This produces exactly 16 chars from `[A-Za-z0-9]` (~95 bits of entropy, sufficient for invite codes).

Use `putItem` with `conditionExpression: "attribute_not_exists(PK)"` to handle the astronomically unlikely collision case. On `ConditionalCheckFailedException`, retry ONCE with a new code. Throw `INTERNAL_ERROR` if second attempt also fails.

### DynamoDB Table: invite-codes (ALREADY EXISTS from Epic 1)

```
Table: ai-learning-hub-invite-codes
PK: CODE#<code>    SK: META

Attributes:
  code: string              # The actual invite code value
  generatedBy: string       # userId who created the code
  generatedAt: string       # ISO 8601
  expiresAt: string         # ISO 8601 (generatedAt + 7 days)
  redeemedBy?: string       # userId who used the code
  redeemedAt?: string       # ISO 8601
  isRevoked?: boolean       # Admin revocation flag

GSI: generatedBy-index
  PK: generatedBy (string)  # Query by userId to list user's codes
  SK: (none)                # NO sort key — DynamoDB returns items in arbitrary order
  Projection: ALL
```
**GSI Sort Limitation:** Since `generatedBy-index` has no sort key, `scanIndexForward` has no effect. The `listInviteCodesByUser` function MUST sort results in-memory by `generatedAt` descending after the query to achieve newest-first ordering.

### Handler File Structure (Follow api-keys pattern EXACTLY)

```
backend/functions/invite-codes/
  handler.ts        # Lambda handler (POST/GET router)
  handler.test.ts   # Co-located tests
  schemas.ts        # Zod schemas (minimal for this story)
```

### Rate Limiting (Follow Story 2.7 pattern)

```typescript
await enforceRateLimit(client, USERS_TABLE_CONFIG.tableName, {
  operation: "invite-generate",
  identifier: userId,        // Per-user, NOT per-IP
  limit: 5,                  // 5 codes per day
  windowSeconds: 86400,      // 24 hours
}, logger);
```

Rate limit counter stored in `users` table as `PK: RATELIMIT#invite-generate#<userId>`, with TTL.

### CDK Pattern (Follow validate-invite Lambda pattern in auth.stack.ts)

The new Lambda goes in `infra/lib/stacks/auth/auth.stack.ts` alongside the existing validate-invite function. It needs:
- `inviteCodesTable` read/write access (PutItem for create, Query for GSI list)
- `usersTable` UpdateItem access (rate limit counters)
- Environment variables: `INVITE_CODES_TABLE_NAME`, `USERS_TABLE_NAME`
- CDK Nag suppressions: copy the exact pattern from validate-invite or api-keys functions

### Error Handling

| Scenario | ErrorCode | HTTP | Message |
|----------|-----------|------|---------|
| Rate limit exceeded | `RATE_LIMITED` | 429 | "Rate limit exceeded: 5 invite-generate per 1 day(s)" |
| Not authenticated | `UNAUTHORIZED` | 401 | Handled by wrapHandler |
| Invite not validated | `INVITE_REQUIRED` | 403 | Handled by JWT authorizer deny() |
| DynamoDB error | `INTERNAL_ERROR` | 500 | "Database operation failed" |
| Code collision (retry failed) | `INTERNAL_ERROR` | 500 | "Failed to generate invite code" |

### Previous Story (2.8) Intelligence

**Learnings to apply:**
- `ErrorCodeToStatus` map is typed as `Record<ErrorCode, number>` — any new enum member MUST have a status mapping or TypeScript fails. Story 2.9 does NOT add new error codes (uses existing `RATE_LIMITED`, `INTERNAL_ERROR`, etc.), so no changes to error types needed.
- Tests need `expect.assertions()` for error paths — apply to rate limit and auth tests.
- Commit style: `feat:` for new endpoint, reference issue number.
- Two distinct scope check paths exist in wrapper.ts and auth.ts — this story uses `requireAuth: true` only, no scope checks needed since invite generation is for any authenticated user with validated invite.

**Code patterns from 2.8:**
- `AppError` class with `ErrorCode` enum and optional `details` object
- Error handler auto-formats ADR-008 body shape
- Tests mock the full wrapHandler middleware chain

### Masking Pattern for GET Response

```typescript
/** Public representation of an invite code (strips PK/SK, masks redeemed codes) */
export interface PublicInviteCodeItem {
  code: string;                                              // Full or masked (first 4 + '****')
  status: 'active' | 'redeemed' | 'expired' | 'revoked';    // Priority: revoked > redeemed > expired > active
  generatedAt: string;
  expiresAt?: string;
  redeemedAt?: string;
}

export function toPublicInviteCode(item: InviteCodeItem): PublicInviteCodeItem {
  const now = new Date();
  // Status priority: revoked > redeemed > expired > active
  let status: PublicInviteCodeItem['status'];
  if (item.isRevoked) status = 'revoked';
  else if (item.redeemedBy) status = 'redeemed';
  else if (item.expiresAt && new Date(item.expiresAt) < now) status = 'expired';
  else status = 'active';

  return {
    code: item.redeemedBy ? item.code.slice(0, 4) + '****' : item.code,
    status,
    generatedAt: item.generatedAt,
    expiresAt: item.expiresAt,
    redeemedAt: item.redeemedAt,
  };
}
```

### Test Pattern (Follow api-keys/handler.test.ts EXACTLY)

Copy the `vi.mock` block structure from `backend/functions/api-keys/handler.test.ts`, adapting function names. Key differences from api-keys:

```typescript
// Mock @ai-learning-hub/db — adapt from api-keys mock block
vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  createInviteCode: (...args) => mockCreateInviteCode(...args),
  listInviteCodesByUser: (...args) => mockListInviteCodesByUser(...args),
  toPublicInviteCode: (...args) => mockToPublicInviteCode(...args),
  enforceRateLimit: (...args) => mockEnforceRateLimit(...args),
  INVITE_CODES_TABLE_CONFIG: { tableName: "ai-learning-hub-invite-codes", partitionKey: "PK", sortKey: "SK" },
  USERS_TABLE_CONFIG: { tableName: "ai-learning-hub-users", partitionKey: "PK", sortKey: "SK" },
}));
// DO NOT mock @ai-learning-hub/validation — test real Zod schemas
// Copy @ai-learning-hub/logging and @ai-learning-hub/middleware mocks verbatim from api-keys tests
```

### Project Structure Notes

- Handler directory: `backend/functions/invite-codes/` (new)
- DB operations: `backend/shared/db/src/invite-codes.ts` (existing file, ADD functions)
- DB tests: `backend/shared/db/test/invite-codes.test.ts` (new)
- CDK stack: `infra/lib/stacks/auth/auth.stack.ts` (existing, ADD Lambda)
- CDK test: `infra/test/stacks/auth/auth.stack.test.ts` (existing, ADD assertions)
- No changes to shared types, middleware, or validation packages

### References

- [Source: docs/progress/epic-2-stories-and-plan.md — Story 2.9 Requirements]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-001 DynamoDB Tables]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-008 Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-013 Authentication]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-014 API-First Design]
- [Source: backend/shared/db/src/invite-codes.ts — Existing InviteCodeItem, getInviteCode, redeemInviteCode]
- [Source: backend/shared/db/src/users.ts — createApiKey, listApiKeys patterns (lines 276-373)]
- [Source: backend/shared/db/src/helpers.ts — queryItems with indexName support (lines 172-228)]
- [Source: backend/functions/api-keys/handler.ts — POST/GET/DELETE router pattern]
- [Source: backend/functions/validate-invite/handler.ts — Rate limit + invite code lookup pattern]
- [Source: backend/shared/middleware/src/wrapper.ts — wrapHandler, HandlerContext, auto-wrapping]
- [Source: backend/shared/middleware/src/error-handler.ts — createSuccessResponse, createNoContentResponse]
- [Source: infra/lib/stacks/auth/auth.stack.ts — CDK Lambda + table grant pattern]
- [Source: infra/lib/stacks/core/tables.stack.ts — invite-codes table + generatedBy-index GSI definition]
- [Source: _bmad-output/implementation-artifacts/2-8-auth-error-codes.md — Previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4

### Debug Log References

- All 705 tests pass (30 new tests added: 21 DB, 9 handler)
- Coverage: db/invite-codes.ts 95.51%, handler 100% (via integration tests)

### Completion Notes List

- Task 1: Added `createInviteCode`, `listInviteCodesByUser`, `toPublicInviteCode` + `PublicInviteCodeItem` to `@ai-learning-hub/db`. Strictly alphanumeric 16-char code generation with collision retry. In-memory sort by generatedAt descending for GSI without sort key.
- Task 2: Created `backend/functions/invite-codes/handler.ts` with POST/GET router. POST enforces 5/day rate limit, returns 201. GET maps items through `toPublicInviteCode` for masking.
- Task 3: Created minimal `schemas.ts` re-exporting `paginationQuerySchema`.
- Task 4: Added `generateInviteFunction` Lambda to CDK auth stack with invite-codes table read/write and users table UpdateItem for rate limiting.
- Task 5: 9 handler tests covering AC1-AC7: POST success/rate-limit, GET success/pagination, auth enforcement, 405 method routing. 21 DB tests covering code generation, collision retry, list sorting, toPublicInviteCode status priority.
- Task 6: Full test suite passes (705 tests), no regressions.

### File List

- backend/shared/db/src/invite-codes.ts (modified — added createInviteCode, listInviteCodesByUser, toPublicInviteCode, PublicInviteCodeItem)
- backend/shared/db/src/index.ts (modified — added exports)
- backend/shared/db/test/invite-codes.test.ts (modified — added 12 new test cases)
- backend/functions/invite-codes/handler.ts (new)
- backend/functions/invite-codes/handler.test.ts (new)
- backend/functions/invite-codes/schemas.ts (new)
- infra/lib/stacks/auth/auth.stack.ts (modified — added generateInviteFunction Lambda)
- infra/test/stacks/auth/auth.stack.test.ts (modified — updated Lambda count 5→6, added output assertions)
