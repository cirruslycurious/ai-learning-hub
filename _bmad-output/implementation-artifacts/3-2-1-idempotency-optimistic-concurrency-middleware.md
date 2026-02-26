# Story 3.2.1: Idempotency & Optimistic Concurrency Middleware

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer building agent-native API endpoints**,
I want **shared idempotency and optimistic concurrency middleware in `@ai-learning-hub/middleware` backed by DynamoDB**,
so that **all command endpoints can be safely retried by AI agents without creating duplicates, and concurrent writes are detected and rejected with actionable error responses**.

## Acceptance Criteria

### Idempotency Middleware (FR96, NFR-AN1, NFR-AN6)

1. **AC1: Idempotency-Key extraction & validation** — Middleware extracts the `Idempotency-Key` header from incoming requests. Returns `400 VALIDATION_ERROR` with message "Idempotency-Key header is required" when the header is missing on a command endpoint that opts into idempotency enforcement. Key must be a non-empty string, 1-256 characters, matching `[a-zA-Z0-9_\-\.]+`. Invalid format returns `400 VALIDATION_ERROR` with message describing the constraint.
2. **AC2: DynamoDB-backed dedup storage** — Idempotency records are stored in a dedicated DynamoDB table (`idempotency` table) with PK = `IDEMP#{userId}#{idempotencyKey}`. Each record stores the original response body, status code, headers, the operation path, and the actor/key/command fingerprint.
3. **AC3: Cached result replay (2xx only)** — When a duplicate `Idempotency-Key` is received from the same user for the same operation path, the middleware returns the cached response (same status code, body, and relevant headers) without re-executing the handler. The replayed response includes an `X-Idempotent-Replayed: true` header. **Only responses with 2xx status codes are cached.** Error responses (4xx, 5xx) are NOT cached — the agent can fix the issue and retry with the same key.
4. **AC4: 24-hour TTL with application-level expiry check** — Idempotency records have a TTL attribute (`expiresAt`) set to 24 hours from creation. DynamoDB TTL is enabled on the table for eventual physical cleanup. **Additionally, the read path checks `expiresAt` at the application level:** if `Date.now() > record.expiresAt`, the record is treated as a cache miss and the handler re-executes. This defense-in-depth approach prevents stale replays during DynamoDB's TTL deletion lag window (which can be up to 48 hours).
5. **AC5: Operation fingerprint matching** — Idempotency dedup checks match on `(userId, idempotencyKey, operationPath)`. A key reused for a different operation path returns `409 IDEMPOTENCY_KEY_CONFLICT` with message "Idempotency-Key already used for a different operation" and details including `{ boundTo: <original_operation_path> }` (prevents key reuse across different endpoints).
6. **AC6: Concurrent first-use race condition** — When two requests arrive simultaneously with the same new `Idempotency-Key`, the first to write the idempotency record wins (DynamoDB conditional write). The second request retries reading the now-stored result and replays it. No duplicate execution occurs.
7. **AC7: wrapHandler integration** — `WrapperOptions` gains a new `idempotent?: boolean` field. When `true`, the idempotency middleware is applied before handler execution. When `false` or unset, the handler executes normally (backward-compatible).
8. **AC8: Response size guard** — If the handler response body exceeds 350KB (DynamoDB 400KB item size safety margin), the idempotency record stores a tombstone (`{ oversized: true }`) instead of the full response. Subsequent retries with the same key re-execute the handler rather than replaying. A warning is logged: "Idempotency response too large to cache".
9. **AC9: Fail-open on idempotency table errors** — If the idempotency table is unreachable (DynamoDB error on read or write), the middleware logs a warning and falls through to execute the handler normally (fail-open). Idempotency is best-effort, not a blocking dependency. The response includes an `X-Idempotency-Status: unavailable` header so agents are aware.

### Optimistic Concurrency (FR97, NFR-AN2)

10. **AC10: Version field pattern** — A `withVersion<T>` TypeScript utility type adds a `version: number` field to any entity type. A `INITIAL_VERSION` constant is exported (value: `1`). A `nextVersion(current: number): number` helper increments the version.
11. **AC11: If-Match header validation** — Middleware extracts the `If-Match` header from incoming requests. When the handler context includes `requireVersion: true` in WrapperOptions, the middleware validates that `If-Match` is present and parses it as a numeric version. The parsed version number is attached to `HandlerContext` as `expectedVersion?: number`. Handlers access it via `ctx.expectedVersion` and pass it to `updateItemWithVersion`. Missing `If-Match` on a version-required endpoint returns `428 PRECONDITION_REQUIRED` with message "If-Match header is required for this operation".
12. **AC12: 409 Conflict response** — When a DynamoDB conditional write fails due to version mismatch, the middleware (or a helper function) returns a `409 CONFLICT` response with body: `{ error: { code: "VERSION_CONFLICT", message: "Resource has been modified", requestId }, currentVersion: <server_version> }`. The `currentVersion` field enables the agent to re-read and retry.
13. **AC13: Optimistic concurrency DB helper** — A new `updateItemWithVersion` function in `@ai-learning-hub/db` wraps `updateItem` to automatically add `SET version = :newVersion` and `ConditionExpression: version = :expectedVersion`. Accepts `expectedVersion` parameter and throws a typed `VersionConflictError` on mismatch.
14. **AC14: Version on create** — A `putItemWithVersion` helper in `@ai-learning-hub/db` automatically sets `version: 1` on new items.

### Infrastructure (CDK)

15. **AC15: Idempotency DynamoDB table** — CDK stack creates a new `idempotency` table: PK = `pk` (string), TTL attribute = `expiresAt`, on-demand billing, encryption at rest enabled, point-in-time recovery enabled. Table name passed to Lambda functions via `IDEMPOTENCY_TABLE_NAME` environment variable.
16. **AC16: Table cost compliance** — Idempotency table storage overhead remains < 1% of total DynamoDB capacity (NFR-AN6). Each record is ~1KB (response body + metadata). At boutique scale (100 commands/day), this is ~100KB/day, well within limits.

### Type Safety & Error Codes

17. **AC17: New error codes** — `ErrorCode` enum extended with: `VERSION_CONFLICT` (409), `PRECONDITION_REQUIRED` (428), `IDEMPOTENCY_KEY_CONFLICT` (409). All mapped in `ErrorCodeToStatus`.
18. **AC18: Exported types** — All new types exported from package index files: `IdempotencyRecord`, `VersionedEntity`, `VersionConflictError`, `IdempotencyOptions`, middleware option types.

### Testing

19. **AC19: Unit tests — idempotency** — Tests cover: key extraction, key format validation, missing key rejection, first-use storage, duplicate replay, expired key re-execution, different-operation rejection, concurrent race condition handling, oversized response tombstone, fail-open on table errors. Minimum 90% coverage for new idempotency code.
20. **AC20: Unit tests — optimistic concurrency** — Tests cover: version field initialization, If-Match extraction, missing If-Match rejection, version match success, version mismatch 409 response, `updateItemWithVersion` conditional write, `putItemWithVersion` initial version, `ctx.expectedVersion` propagation. Minimum 90% coverage for new concurrency code.
21. **AC21: Integration contract tests** — Test that idempotency + concurrency middleware integrates correctly with the existing `wrapHandler` chain: auth → idempotency check → handler execution → idempotency store → response. Verify backward compatibility (handlers without `idempotent: true` are unaffected).

## Tasks / Subtasks

### Task 1: New Error Codes & Types (AC: #17, #18, #10)

- [x] 1.1 Add `VERSION_CONFLICT`, `PRECONDITION_REQUIRED`, `IDEMPOTENCY_KEY_CONFLICT` to `ErrorCode` enum in `@ai-learning-hub/types/src/errors.ts`
- [x] 1.2 Add status code mappings to `ErrorCodeToStatus` (409, 428, 409)
- [x] 1.3 Create `withVersion<T>` utility type, `INITIAL_VERSION` constant, `nextVersion()` helper in `@ai-learning-hub/types/src/entities.ts`
- [x] 1.4 Create `IdempotencyRecord` interface in `@ai-learning-hub/types/src/api.ts`
- [x] 1.5 Export all new types from package index
- [x] 1.6 Write tests for new types and helpers

### Task 2: Idempotency DynamoDB Table (AC: #15, #16)

- [x] 2.1 Create `idempotency-table.stack.ts` in `infra/lib/stacks/core/` (or extend existing tables stack)
- [x] 2.2 Define table: PK = `pk` (string), TTL on `expiresAt`, on-demand billing, encryption, PITR
- [x] 2.3 Export table name and add to Lambda environment variable configuration pattern
- [ ] 2.4 Add `IDEMPOTENCY_TABLE_NAME` to relevant function environment variables in API stacks _(deferred: wire env var and IAM grants when the first Lambda opts into idempotency in a later story)_
- [x] 2.5 Verify CDK synth succeeds
- [x] 2.6 Update `infra/bin/app.ts` to include the new idempotency table stack in the deployment graph, dependent on the core stack

### Task 3: Idempotency Storage Layer (AC: #2, #4, #5, #6, #8)

- [x] 3.1 Create `idempotency.ts` in `@ai-learning-hub/db/src/` with table config
- [x] 3.2 Implement `storeIdempotencyRecord(client, key, userId, operationPath, response)` — conditional PutItem with `attribute_not_exists(pk)`
- [x] 3.3 Implement `getIdempotencyRecord(client, key, userId, operationPath)` — GetItem, returns null if not found OR if `expiresAt < Date.now()` (application-level expiry check, defense-in-depth against DynamoDB TTL lag)
- [x] 3.4 Record schema: `{ pk, userId, operationPath, statusCode, responseBody, responseHeaders, createdAt, expiresAt }`
- [x] 3.5 Export from `@ai-learning-hub/db` index
- [x] 3.6 Write unit tests with mocked DynamoDB client

### Task 4: Optimistic Concurrency DB Helpers (AC: #13, #14)

- [x] 4.1 Create `VersionConflictError` class extending `AppError` with `currentVersion` field
- [x] 4.2 Implement `updateItemWithVersion(client, config, params, expectedVersion, logger)` in `@ai-learning-hub/db/src/helpers.ts` (or new file)
- [x] 4.3 Implement `putItemWithVersion(client, config, item, logger)` — auto-sets `version: 1`
- [x] 4.4 Export from `@ai-learning-hub/db` index
- [x] 4.5 Write unit tests: version match success, version mismatch error, initial version on create

### Task 5: Idempotency Middleware (AC: #1, #3, #7, #8, #9)

- [x] 5.1 Create `idempotency.ts` in `@ai-learning-hub/middleware/src/`
- [x] 5.2 Implement `extractIdempotencyKey(event)` — returns key or throws `VALIDATION_ERROR`
- [x] 5.3 Implement idempotency check/store logic as middleware layer within `wrapHandler`
- [x] 5.4 Add `idempotent?: boolean` to `WrapperOptions`
- [x] 5.5 Wire idempotency middleware into `wrapHandler` flow: after auth, before handler execution
- [x] 5.6 Add `X-Idempotent-Replayed: true` header on cached response replay
- [x] 5.7 Handle concurrent first-use: catch ConditionalCheckFailed on store → re-read → replay
- [x] 5.8 Implement response size guard: if body > 350KB, store tombstone and log warning
- [x] 5.9 Implement fail-open: catch idempotency table errors → log warning → execute handler → add `X-Idempotency-Status: unavailable` header
- [x] 5.10 Export from `@ai-learning-hub/middleware` index
- [x] 5.11 Write unit tests (AC19)

### Task 6: Optimistic Concurrency Middleware (AC: #11, #12)

- [x] 6.1 Create `concurrency.ts` in `@ai-learning-hub/middleware/src/`
- [x] 6.2 Implement `extractIfMatch(event)` — returns version number or throws `PRECONDITION_REQUIRED`
- [x] 6.3 Add `requireVersion?: boolean` to `WrapperOptions`
- [x] 6.4 Parse `If-Match` header and attach to `HandlerContext` as `expectedVersion`
- [x] 6.5 Wire into `wrapHandler`: extract before handler, provide in context
- [x] 6.6 Export from `@ai-learning-hub/middleware` index
- [x] 6.7 Write unit tests (AC20)

### Task 7: Integration & Contract Tests (AC: #21)

- [x] 7.1 Integration test: wrapHandler with `idempotent: true` — full middleware chain
- [x] 7.2 Integration test: wrapHandler with `requireVersion: true` — full middleware chain
- [x] 7.3 Integration test: backward compatibility — existing handlers unaffected
- [x] 7.4 Integration test: combined idempotent + requireVersion on same handler
- [x] 7.5 Verify all existing middleware tests still pass

## Dev Notes

### Architecture Patterns & Constraints

- **ADR-001 (Multi-Table DynamoDB):** The idempotency store uses a new dedicated table, consistent with separation of concerns. PK pattern: `IDEMP#{userId}#{idempotencyKey}` follows the project's key prefix convention.
- **ADR-008 (Standardized Error Handling):** All new error responses use the existing `AppError` → `createErrorResponse` pipeline. New error codes (`VERSION_CONFLICT`, `PRECONDITION_REQUIRED`, `IDEMPOTENCY_KEY_CONFLICT`) follow the established `ErrorCode` enum pattern.
- **ADR-014 (API-First Design):** Idempotency headers (`Idempotency-Key`, `If-Match`, `X-Idempotent-Replayed`) follow HTTP standards for agent consumption.
- **ADR-015 (Lambda Layers):** New middleware and DB functions are added to existing shared packages and deployed via the shared Lambda Layer.
- **No Lambda-to-Lambda (ADR-005):** This story is pure middleware/shared code — no inter-service calls.

### Existing Code to Extend

| Package                       | File                               | Changes                                                  |
| ----------------------------- | ---------------------------------- | -------------------------------------------------------- |
| `@ai-learning-hub/types`      | `src/errors.ts`                    | Add 3 new `ErrorCode` values + status mappings           |
| `@ai-learning-hub/types`      | `src/entities.ts`                  | Add `withVersion<T>`, `INITIAL_VERSION`, `nextVersion()` |
| `@ai-learning-hub/types`      | `src/api.ts`                       | Add `IdempotencyRecord` interface                        |
| `@ai-learning-hub/db`         | `src/idempotency.ts` (new)         | Idempotency table config + CRUD operations               |
| `@ai-learning-hub/db`         | `src/helpers.ts`                   | Add `updateItemWithVersion`, `putItemWithVersion`        |
| `@ai-learning-hub/middleware` | `src/idempotency.ts` (new)         | Idempotency middleware logic                             |
| `@ai-learning-hub/middleware` | `src/concurrency.ts` (new)         | Optimistic concurrency middleware logic                  |
| `@ai-learning-hub/middleware` | `src/wrapper.ts`                   | Wire idempotency + concurrency into `wrapHandler`        |
| `@ai-learning-hub/middleware` | `src/index.ts`                     | Export new middleware                                    |
| `infra/lib/stacks/core/`      | `idempotency-table.stack.ts` (new) | CDK stack for idempotency table                          |

### DynamoDB Idempotency Table Design

```
Table: ai-learning-hub-idempotency
PK: pk (string) — "IDEMP#{userId}#{idempotencyKey}"
TTL: expiresAt (number) — Unix epoch seconds, 24h from creation

Attributes:
  - pk: string
  - userId: string
  - operationPath: string (e.g. "POST /saves")
  - statusCode: number
  - responseBody: string (JSON stringified)
  - responseHeaders: Record<string, string> (selected headers to replay)
  - createdAt: string (ISO 8601)
  - expiresAt: number (Unix epoch for TTL)

Billing: On-demand (PAY_PER_REQUEST)
Encryption: AWS-owned key (default)
PITR: Enabled
```

### Optimistic Concurrency Pattern

```typescript
// Entity with version
interface SaveItemVersioned extends SaveItem {
  version: number; // starts at 1, incremented on every mutation
}

// Update with version check
await updateItemWithVersion(
  client,
  SAVES_TABLE_CONFIG,
  {
    key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
    updateExpression: "SET title = :title, updatedAt = :now",
    expressionAttributeValues: { ":title": newTitle, ":now": now },
  },
  expectedVersion,
  logger
);
// Throws VersionConflictError if version mismatch
```

### Middleware Chain Order (after this story)

```
Request → Extract Auth → Check Idempotency Cache → Extract If-Match
         → Execute Handler → Store Idempotency Result → Return Response
```

### Testing Standards

- **Framework:** Vitest (already used across all shared packages)
- **Coverage target:** 90% for new code (above the 80% CI gate)
- **Test location:** Co-located `test/` directories in each shared package
- **Mock pattern:** Use `vi.mock()` for DynamoDB client, following `backend/shared/db/test/` patterns
- **Test factories:** Use existing `backend/test-utils/` mock helpers where applicable

### Scope Boundaries

- **Non-goal: Retrofitting existing entities.** This story does NOT add the `version` field to existing entities (saves, users). The version field pattern and helpers are created here; the actual retrofit to saves is Story 3.2.7 and to auth is Story 3.2.8.
- **DELETE endpoints:** HTTP DELETE is inherently idempotent. The `idempotent: true` flag is intended for POST command endpoints (state-changing commands). DELETEs do not need idempotency middleware — they should remain naturally idempotent via soft-delete checks.
- **Fail-open philosophy:** The idempotency middleware is a safety net, not a hard dependency. If the idempotency table is down, handlers execute normally and agents may see duplicate effects — this is the same behavior as before this middleware existed, and is acceptable at boutique scale.

### Key Technical Decisions

1. **Separate idempotency table (not saves table):** Cross-cutting concern used by ALL future domains (projects, links, tutorials). Own table with TTL keeps it clean and doesn't pollute entity tables.
2. **PK includes userId:** Prevents cross-user idempotency key collisions. User A and User B can use the same key value independently.
3. **operationPath is intentionally NOT in the PK:** The PK is `(userId, idempotencyKey)` only. The `operationPath` is stored as an attribute and checked at the application layer. This is deliberate: if operationPath were in the PK, reusing a key for a different operation would silently create a separate record instead of being detected and rejected (AC5). The application-layer check ensures cross-operation key reuse is caught.
4. **Version stored as number (not ETag string):** Simpler to increment and compare. `If-Match` header carries the numeric version as a string.
5. **Middleware opt-in via WrapperOptions:** Backward-compatible. Existing handlers without `idempotent: true` are completely unaffected.
6. **VersionConflictError extends AppError:** Integrates with existing error handling pipeline. The `currentVersion` field is included in the response body for agent retry logic.

### Project Structure Notes

- All new code goes into existing shared packages — no new packages created
- New CDK table stack follows `infra/lib/stacks/core/tables.stack.ts` pattern
- Environment variable naming follows existing convention: `IDEMPOTENCY_TABLE_NAME`
- No new npm dependencies required — uses existing `@aws-sdk/lib-dynamodb` and `ulidx`

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Agent-Native API Patterns] — FR96 (idempotency), FR97 (optimistic concurrency)
- [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements] — NFR-AN1 (24h window), NFR-AN2 (no distributed locking), NFR-AN6 (<1% storage)
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-001] — Multi-table DynamoDB design
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008] — Standardized error handling
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-015] — Lambda Layers for shared code
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3.2] — Story definition and dependencies
- [Source: backend/shared/middleware/src/wrapper.ts] — Existing wrapHandler pattern to extend
- [Source: backend/shared/middleware/src/error-handler.ts] — Existing error response pipeline
- [Source: backend/shared/types/src/errors.ts] — Existing ErrorCode enum to extend
- [Source: backend/shared/db/src/helpers.ts] — Existing DynamoDB helpers to extend

### Git Intelligence

Recent work (Epic 3.1) established patterns for:

- Shared schema extraction to `@ai-learning-hub/*` packages (PR #194)
- Shared test utilities in `backend/test-utils/` (PR #196)
- Handler consolidation using shared middleware (PR #198)
- Phase runner infrastructure for smoke tests (PR #202)
- API key scope enforcement across endpoints (PR #204)

These patterns should be followed for consistency. The scope enforcement middleware from PR #204 (Story 3.1.7) is particularly relevant as it demonstrates how to add new middleware concerns to the existing handler pipeline.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- PR: https://github.com/cirruslycurious/ai-learning-hub/pull/226
- Issue: #224

### Completion Notes List

- All 21 ACs implemented across 7 task groups
- Code review round 1: 13 findings (3 critical, 5 important, 5 minor) — 8 fixed, 5 deferred as minor
- Task 2.4 (IDEMPOTENCY_TABLE_NAME env var wiring) deferred to when first Lambda opts in
- Context compaction during session caused lost edits; re-applied successfully

### File List

New files:
- backend/shared/db/src/idempotency.ts
- backend/shared/db/src/version-helpers.ts
- backend/shared/db/test/idempotency.test.ts
- backend/shared/db/test/version-helpers.test.ts
- backend/shared/middleware/src/idempotency.ts
- backend/shared/middleware/src/concurrency.ts
- backend/shared/middleware/test/idempotency.test.ts
- backend/shared/middleware/test/concurrency.test.ts
- backend/shared/middleware/test/idempotency-concurrency.integration.test.ts

Modified files:
- backend/shared/types/src/errors.ts
- backend/shared/types/src/entities.ts
- backend/shared/types/src/api.ts
- backend/shared/types/src/index.ts
- backend/shared/db/src/index.ts
- backend/shared/middleware/src/wrapper.ts
- backend/shared/middleware/src/index.ts
- backend/shared/middleware/tsconfig.json
- backend/shared/middleware/package.json
- infra/lib/stacks/core/tables.stack.ts
- infra/test/stacks/core/tables.stack.test.ts
