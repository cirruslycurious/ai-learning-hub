---
id: "3.3"
title: "Update, Delete & Restore Saves API"
status: ready-for-dev
depends_on:
  - 3-1b-create-save-api
  - 3-2-list-get-saves-api
touches:
  - backend/functions/saves-update/handler.ts (new)
  - backend/functions/saves-delete/handler.ts (new)
  - backend/functions/saves-restore/handler.ts (new)
  - backend/shared/events/src/events/saves.ts
  - infra/lib/stacks/api/saves-routes.stack.ts
  - infra/config/route-registry.ts
risk: medium
---

# Story 3.3: Update, Delete & Restore Saves API

Status: ready-for-dev

## Story

As a user,  
I want to edit save metadata, delete saves I no longer need, and undo accidental deletes,  
so that I can keep my library organized and recover from mistakes.

## Acceptance Criteria

| #    | Given                                | When                                                                           | Then                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | User authenticated, save exists      | `PATCH /saves/:saveId` with body `{ title?, userNotes?, contentType?, tags? }` | Updates specified fields + sets `updatedAt`; returns updated save; omitted fields unchanged                                                                                                                                                                   |
| AC2  | Save updated successfully            | After DynamoDB write                                                           | EventBridge event emitted: `detailType: 'SaveUpdated'`, detail includes updated fields + `userId`, `saveId`, `urlHash`, `normalizedUrl`                                                                                                                     |
| AC3  | User authenticated, save exists      | `DELETE /saves/:saveId`                                                        | Sets `deletedAt` = ISO 8601 timestamp (soft delete); returns 204 No Content                                                                                                                                                                                   |
| AC4  | Save soft-deleted                    | After DynamoDB write                                                           | EventBridge event emitted: `detailType: 'SaveDeleted'`, detail includes `userId`, `saveId`, `urlHash`, `normalizedUrl`                                                                                                                                        |
| AC5  | Save does not exist, is deleted, or wrong user | `PATCH /saves/:saveId`                                                         | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`. **Handler must not allow** db helper message `"Item not found"` to surface (catch-and-rethrow `AppError(ErrorCode.NOT_FOUND, 'Save not found')`). |
| AC6  | Save does not exist or wrong user    | `DELETE /saves/:saveId`                                                        | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`. **Handler must throw** `new AppError(ErrorCode.NOT_FOUND, 'Save not found')` for this path (do not bubble `"Item not found"`). |
| AC7  | Save already soft-deleted            | `PATCH /saves/:saveId`                                                         | Returns 404 (treat soft-deleted as not found for normal PATCH)                                                                                                                                                                                                |
| AC8  | Save already soft-deleted            | `DELETE /saves/:saveId`                                                        | Returns 204 (idempotent — already deleted)                                                                                                                                                                                                                    |
| AC9  | Invalid field values in PATCH body   | Validation                                                                     | Returns 400 `{ error: { code: 'VALIDATION_ERROR', message: '...', requestId } }` with field-level error details                                                                                                                                               |
| AC10 | Save is soft-deleted (has deletedAt) | `POST /saves/:saveId/restore`                                                  | Clears `deletedAt` field; returns 200 with restored save. This endpoint bypasses the `attribute_not_exists(deletedAt)` guard.                                                                                                                                |
| AC11 | Save is NOT soft-deleted             | `POST /saves/:saveId/restore`                                                  | Returns 200 with current save (idempotent — already active)                                                                                                                                                                                                   |
| AC12 | Save does not exist or wrong user    | `POST /saves/:saveId/restore`                                                  | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`. **Handler must throw** `new AppError(ErrorCode.NOT_FOUND, 'Save not found')` for this path (do not bubble `"Item not found"`). |
| AC13 | Save successfully restored           | After DynamoDB write                                                           | EventBridge event emitted: `detailType: 'SaveRestored'`, detail includes `userId`, `saveId`, `urlHash`, `normalizedUrl`. Downstream consumers should treat as re-activation (a `SaveDeleted` may be followed by a `SaveRestored` within seconds).                |

## Tasks / Subtasks

- [ ] Task 1: Extend Saves domain event types in `@ai-learning-hub/events` (AC: #2, #4, #13)
  - [ ] 1.1 Update `backend/shared/events/src/events/saves.ts`:
    - Extend `SavesEventDetailType` to include `"SaveUpdated"` and `"SaveDeleted"`
    - Implement event detail typing as a **discriminated union by `detailType`** so existing call sites keep compiling without payload changes
    - Extend the detail typing to support:
      - `SaveUpdated`: `{ userId, saveId, urlHash, normalizedUrl, updatedFields: string[] }`
      - `SaveDeleted`: `{ userId, saveId, urlHash, normalizedUrl }`
      - Keep `SaveCreated`/`SaveRestored` working without changes to call sites (current payload includes `url` and `contentType`; do not break it)
    - Concrete requirement: `SaveCreated` and `SaveRestored` must continue to accept the current detail shape `{ userId, saveId, url, normalizedUrl, urlHash, contentType }` emitted by `backend/functions/saves/handler.ts`
  - [ ] 1.2 Ensure `backend/functions/saves/handler.ts` compiles with the updated types
  - [ ] 1.3 Add/update tests in `backend/shared/events/test/` if needed (at minimum: type-level compilation via existing test suite + runtime emitter tests unchanged)

- [ ] Task 2: Create `saves-update` Lambda handler (PATCH) (AC: #1, #2, #5, #7, #9)
  - [ ] 2.1 Create `backend/functions/saves-update/handler.ts` using `wrapHandler` + `HandlerContext`
  - [ ] 2.2 Validate `saveId` path param (ULID regex) using `validatePathParams`
  - [ ] 2.3 Validate JSON body using `validateJsonBody(updateSaveSchema, ...)`
  - [ ] 2.4 Enforce write rate limit using `enforceRateLimit` with the same effective limit as `saves-create` (**200/hour per user**). Do not accidentally multiply the limit by choosing a distinct operation bucket per endpoint.
  - [ ] 2.5 Use `updateItem` with `ConditionExpression: attribute_exists(PK) AND attribute_not_exists(deletedAt)`
  - [ ] 2.5a Catch `AppError` with `ErrorCode.NOT_FOUND` from `updateItem` and throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")` (do not return `"Item not found"`)
  - [ ] 2.6 Return the updated save object (public shape)
  - [ ] 2.7 Emit `SaveUpdated` via `emitEvent` with `updatedFields` list + `normalizedUrl` + `urlHash`

- [ ] Task 3: Create `saves-delete` Lambda handler (DELETE) (AC: #3, #4, #6, #8)
  - [ ] 3.1 Create `backend/functions/saves-delete/handler.ts`
  - [ ] 3.2 Validate `saveId` path param (ULID regex)
  - [ ] 3.3 Enforce write rate limit
  - [ ] 3.4 Attempt conditional soft delete via `updateItem` with `ConditionExpression: attribute_exists(PK) AND attribute_not_exists(deletedAt)` setting `deletedAt` + `updatedAt`
  - [ ] 3.5 Catch `AppError` with `ErrorCode.NOT_FOUND` from `updateItem`; in the catch block call `getItem` to disambiguate missing vs already deleted
    - Missing → 404
    - Already deleted → 204
  - [ ] 3.5a When returning 404, throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")`
  - [ ] 3.6 Emit `SaveDeleted` only on active → deleted transition

- [ ] Task 4: Create `saves-restore` Lambda handler (POST /restore) (AC: #10, #11, #12, #13)
  - [ ] 4.1 Create `backend/functions/saves-restore/handler.ts`
  - [ ] 4.2 Validate `saveId` path param (ULID regex)
  - [ ] 4.3 Enforce write rate limit
  - [ ] 4.4 Attempt conditional restore update via `updateItem` with `ConditionExpression: attribute_exists(PK) AND attribute_exists(deletedAt)` removing `deletedAt` and setting `updatedAt`
  - [ ] 4.5 Catch `AppError` with `ErrorCode.NOT_FOUND` from `updateItem`; in the catch block call `getItem` to disambiguate missing vs already active
    - Missing → 404
    - Already active → 200 with current save (no event)
  - [ ] 4.5a When returning 404, throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")`
  - [ ] 4.6 Emit `SaveRestored` only on deleted → active transition

- [ ] Task 5: Extend `SavesRoutesStack` (infra wiring) (AC: all)
  - [ ] 5.1 In `infra/lib/stacks/api/saves-routes.stack.ts`, add:
    - `public readonly savesUpdateFunction`
    - `public readonly savesDeleteFunction`
    - `public readonly savesRestoreFunction`
  - [ ] 5.2 Create three `NodejsFunction`s with env vars: `SAVES_TABLE_NAME`, `USERS_TABLE_NAME`, `EVENT_BUS_NAME`
  - [ ] 5.3 IAM: grant `savesTable.grantReadWriteData()` + `usersTable.grantReadWriteData()`; allow `events:PutEvents` on the bus
  - [ ] 5.4 Wire API Gateway resources/methods under `/saves`:
    - `/saves/{saveId}`: `PATCH`, `DELETE`
    - `/saves/{saveId}/restore`: `POST`

- [ ] Task 6: Update route registry (architecture enforcement) (AC: all)
  - [ ] 6.1 Update `infra/config/route-registry.ts` `HandlerRef` union to include:
    - `savesUpdateFunction`, `savesDeleteFunction`, `savesRestoreFunction`
  - [ ] 6.2 Add the 3 routes to `ROUTE_REGISTRY` with `authType: 'jwt-or-apikey'` and `epic: 'Epic-3'`

- [ ] Task 7: Tests + repo quality gates
  - [ ] 7.1 Add handler tests for update/delete/restore, including idempotency + event emission assertions
  - [ ] 7.2 Ensure architecture enforcement tests still pass
  - [ ] 7.3 Run `npm test`, `npm run lint`, `npm run build`, `npm run type-check`, `npm run format`

## Developer Context (Read First)

- **Do not reinvent shared modules**:
  - **Validation**: use `updateSaveSchema` + `validateJsonBody` from `@ai-learning-hub/validation` (already exists).
  - **DynamoDB**: use `getDefaultClient`, `getItem`, `updateItem`, `queryItems` from `@ai-learning-hub/db` (no raw AWS SDK in handlers).
  - **Events**: emit domain events using `emitEvent` + `SAVES_EVENT_SOURCE` from `@ai-learning-hub/events` (fire-and-forget, non-fatal).
- **URL immutability**: `url`, `normalizedUrl`, and `urlHash` are **immutable** after creation (do not allow updates via PATCH).
- **PATCH empty body is invalid**: `updateSaveSchema` requires at least one of `title`, `userNotes`, `contentType`, `tags`. `{}` must return 400 `VALIDATION_ERROR`.
- **Soft delete semantics**:
  - `DELETE` sets `deletedAt` (ISO string) and should be **idempotent** (already deleted ⇒ 204, no error).
  - `restore` clears `deletedAt` and should be **idempotent** (already active ⇒ 200 with current item).
- **Per-user isolation**: all reads/writes must be scoped to `PK=USER#<userId>` so “wrong user” behaves like “not found” (404, never 403).
- **404 message must match ACs**: any 404 for a save must return `message: "Save not found"` (do not let `@ai-learning-hub/db` propagate `"Item not found"`).
- **Rate limiting**: treat update/delete/restore as save **write** operations. Use the same effective limit as create (**200/hour per user**) and do not accidentally multiply it by using separate operation buckets per endpoint.
- **Event ordering reality**: a `SaveDeleted` can be followed quickly by `SaveRestored` (undo window). Downstream consumers must already be idempotent; do not add delays/queues in this story.

## Technical Requirements

### Endpoint: `PATCH /saves/{saveId}` (Update metadata)

- **Auth**: `jwt-or-apikey`, require scope `saves:write`.
- **Path validation**: validate `saveId` as ULID (`/^[0-9A-Z]{26}$/`), using `validatePathParams`.
- **Body validation**: `validateJsonBody(updateSaveSchema, event.body)` (schema already exists in `@ai-learning-hub/validation`).
- **Update rules**:
  - Only fields present in the request body are updated (`title`, `userNotes`, `contentType`, `tags`).
  - Always set `updatedAt = now()`.
  - Do **not** touch `url`, `normalizedUrl`, `urlHash`, `createdAt`, `linkedProjectCount`, `isTutorial`.
- **Conditional write**: `ConditionExpression: attribute_exists(PK) AND attribute_not_exists(deletedAt)` (deleted items behave like 404).
- **Response**: 200 with the **updated** save (same public shape as `POST /saves` / `GET /saves/:saveId`; never include `PK`, `SK`, `deletedAt`).
- **404 behavior (AC5/AC7)**: `updateItem` throws `AppError(ErrorCode.NOT_FOUND, "Item not found")` on conditional failure. The handler must catch that path and throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")` to satisfy the AC message.
- **Events (AC2)**:
  - Emit `SaveUpdated` after successful update.
  - Detail MUST include `userId`, `saveId`, `urlHash`, `normalizedUrl`, and an explicit list of updated fields (names).

### Endpoint: `DELETE /saves/{saveId}` (Soft delete)

- **Auth**: `jwt-or-apikey`, require scope `saves:write`.
- **Path validation**: same ULID validation as PATCH.
- **Delete rules**:
  - Soft delete by setting `deletedAt = now()` and `updatedAt = now()`.
  - Do **not** delete the item or the `URL#<urlHash>` uniqueness marker (marker is never removed; see Story 3.1b).
- **Idempotency requirements**:
  - If item exists and is active → perform the update, return 204, emit `SaveDeleted`.
  - If item exists but already deleted → return 204 **without** changing timestamps and **do not** emit another delete event (do not perform any write in this case).
  - If item does not exist → return 404.
  - Implementation hint (required control flow): do a conditional `updateItem` and catch `AppError` with `ErrorCode.NOT_FOUND`; in the catch block, call `getItem` to distinguish “missing” vs “already deleted”.
  - **404 message (AC6)**: when returning 404, throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")`.
- **Performance hint**: for the delete update, pass `returnValues: "NONE"` to `updateItem` (204 response does not need attributes).
- **Events (AC4)**:
  - Emit `SaveDeleted` only when transitioning active → deleted.
  - Detail MUST include `userId`, `saveId`, `urlHash`, `normalizedUrl`.

### Endpoint: `POST /saves/{saveId}/restore` (Undo delete)

- **Auth**: `jwt-or-apikey`, require scope `saves:write`.
- **Path validation**: same ULID validation as PATCH/DELETE.
- **Restore rules**:
  - If item has `deletedAt` → clear it (`UpdateExpression: REMOVE deletedAt SET updatedAt = :now`), return 200 updated save, emit `SaveRestored`.
  - If item exists and is already active → return 200 with current item (no-op), do not emit `SaveRestored`.
  - If item does not exist → return 404.
  - Implementation hint (required control flow): do a conditional restore `updateItem` and catch `AppError` with `ErrorCode.NOT_FOUND`; in the catch block, call `getItem` to disambiguate “already active” vs “missing”.
  - **404 message (AC12)**: when returning 404, throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")`.
- **Events (AC13)**:
  - Emit `SaveRestored` only when transitioning deleted → active.
  - Detail MUST include `userId`, `saveId`, `urlHash`, `normalizedUrl`, and should also include `url` and `contentType` to remain consistent with the existing `SaveRestored` payload emitted in Story 3.1b.

### Error handling & response shape (ADR-008)

- Validation failures: 400 with `{ error: { code: 'VALIDATION_ERROR', message, requestId } }` (field-level details from shared middleware/validation helpers).
- Not found (missing or wrong user, or deleted where applicable): 404 with `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`.
- **Non-negotiable**: on all 404 paths in this story, throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")` from the handler layer. Do not allow `@ai-learning-hub/db`’s default NOT_FOUND message (`"Item not found"`) to become the response message.
- Successful delete: 204 with empty body.

## Architecture Compliance

| ADR / NFR | How This Story Must Comply |
|---|---|
| **ADR-001 (DynamoDB key patterns)** | Saves are stored as `PK=USER#<userId>`, `SK=SAVE#<saveId>`. No cross-user access; wrong-user looks like missing. |
| **ADR-003 (EventBridge)** | Emit domain events (`SaveUpdated`, `SaveDeleted`, `SaveRestored`) via the shared `@ai-learning-hub/events` emitter. Events are **non-fatal** and must not block API responses. |
| **ADR-005 (No Lambda-to-Lambda)** | No direct Lambda invocations. Only DynamoDB + EventBridge interactions. |
| **ADR-008 (Standardized errors)** | All errors must be raised as `AppError`/`ErrorCode` (or handler returns the ADR-008 shape) and wrapped by shared middleware. |
| **ADR-014 (API-first)** | Endpoints must be consistent with existing REST conventions: PATCH for partial update, DELETE for soft delete, POST for restore action. |
| **NFR-S4 (Per-user isolation)** | Enforced by PK scoping + 404-not-403 behavior. |
| **NFR-P2 (Warm perf)** | Avoid extra reads on the happy path. Use `UpdateItem` with return values to avoid “read-before-write” where possible. |

## Library / Framework Requirements

### Required shared packages (do not bypass)

- `@ai-learning-hub/middleware`
  - `wrapHandler`, `createSuccessResponse`, `type HandlerContext`
- `@ai-learning-hub/validation`
  - `updateSaveSchema`, `validateJsonBody`, `validatePathParams`, `z` (for the path schema)
- `@ai-learning-hub/db`
  - `getDefaultClient`, `getItem`, `updateItem`, `enforceRateLimit`, `USERS_TABLE_CONFIG`, `requireEnv`, `type TableConfig`
- `@ai-learning-hub/types`
  - `AppError`, `ErrorCode`, and the `ContentType` enum (for typing only; validation comes from `contentTypeSchema`)
- `@ai-learning-hub/events`
  - `emitEvent`, `getDefaultClient` (EventBridge), `SAVES_EVENT_SOURCE`, and typed saves event detail types

### Version notes (do not “upgrade in story”)

- Workspace uses **Node.js \(>=20\)** (root `package.json`).
- Validation currently depends on **Zod `^3.22.0`** (`backend/shared/validation/package.json`). Zod v4 exists, but do **not** upgrade as part of Story 3.3 unless explicitly planned.
- Tests use **Vitest `^3.2.4`** across workspaces.

## File Structure Requirements

### New Lambda handlers (Lambda-per-concern)

Create exactly these directories (one handler each):

- `backend/functions/saves-update/handler.ts` — `PATCH /saves/{saveId}`
- `backend/functions/saves-delete/handler.ts` — `DELETE /saves/{saveId}`
- `backend/functions/saves-restore/handler.ts` — `POST /saves/{saveId}/restore`

Do **not** add these endpoints to `backend/functions/saves/handler.ts` (that file is for `POST /saves` from Story 3.1b).

### Shared packages to modify

- `backend/shared/events/src/events/saves.ts`
  - Extend `SavesEventDetailType` to include `SaveUpdated` and `SaveDeleted`.
  - Extend the detail typing to support the new event shapes without breaking existing `SaveCreated`/`SaveRestored` usage.

### Infra to modify

- `infra/lib/stacks/api/saves-routes.stack.ts`
  - Add three `NodejsFunction`s for update/delete/restore.
  - Wire API Gateway resources:
    - `/saves/{saveId}`: `PATCH` + `DELETE`
    - `/saves/{saveId}/restore`: `POST`
  - Ensure CORS preflight exists on the existing `/saves/{saveId}` resource (it should already exist from Story 3.2).
  - Add CORS preflight on the new `/saves/{saveId}/restore` resource.
  - Grant IAM: `savesTable.grantReadWriteData()` and `usersTable.grantReadWriteData()` for rate limiting + writes; plus `events:PutEvents` on the event bus ARN.
- `infra/config/route-registry.ts`
  - Extend `HandlerRef` with `savesUpdateFunction`, `savesDeleteFunction`, `savesRestoreFunction`.
  - Add three route entries (Epic-3) matching the CDK wiring.

## Testing Requirements

### Handler tests (Vitest)

Add tests alongside each handler (same folder) following the existing patterns from:
- `backend/functions/saves/handler.test.ts` (Story 3.1b)
- `backend/functions/saves-get/handler.test.ts` / `backend/functions/saves-list/handler.test.ts` (Story 3.2, once implemented)

Required test scenarios:

- **PATCH /saves/{saveId}**
  - 200 updates only provided fields; omitted fields unchanged; `updatedAt` changes.
  - 400 invalid `saveId` format.
  - 400 invalid body (e.g., title too long; tags > 20; empty strings) → `VALIDATION_ERROR`.
  - 404 missing save or wrong user.
  - 404 soft-deleted save.
  - Emits `SaveUpdated` with correct `updatedFields` list and includes `normalizedUrl` + `urlHash`.

- **DELETE /saves/{saveId}**
  - 204 on first delete (active → deleted); `deletedAt` set; emits `SaveDeleted`.
  - 204 on second delete (already deleted) and does **not** emit a second event.
  - 404 when save truly does not exist (after disambiguation) or belongs to another user.

- **POST /saves/{saveId}/restore**
  - 200 restores when deleted (`deletedAt` removed); emits `SaveRestored`.
  - 200 no-op when already active; does not emit `SaveRestored`.
  - 404 missing save or belongs to another user.

### Event typing tests / sanity

When updating `@ai-learning-hub/events` saves event types, ensure:
- Existing Story 3.1b handler still compiles and its tests still pass.
- New handlers can emit the new event types without type casts.

### Quality gates (must be green before implementation PR)

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run type-check`
- `npm run format`

## Previous Story Intelligence (3.1b + 3.2)

### From Story 3.1b (Create Save API)

- **Event emission pattern** is already implemented and should be mirrored:
  - `emitEvent(...)` is fire-and-forget and **must not** be awaited (see `backend/shared/events/src/emitter.ts`).
  - Event source constant: `SAVES_EVENT_SOURCE` (do not repeat string literals).
- **Config pattern**:
  - Use `requireEnv()` from `@ai-learning-hub/db` for `SAVES_TABLE_NAME`/`USERS_TABLE_NAME` in handlers (avoid hardcoding).
  - CDK sets env vars; handlers fail fast at cold start if missing (except tests).
- **Rate limiting**:
  - Write endpoints call `enforceRateLimit(...)` and therefore need `usersTable.grantReadWriteData()` in CDK.

### From Story 3.2 (List & Get Saves API)

- **Handler signature guardrail**: every Lambda handler is `async (ctx: HandlerContext) => ...` and exported via `wrapHandler(...)`.
- **Save ID validation**: use a strict ULID regex for `saveId` path params.
- **Public response shape**: never return internal DynamoDB keys (`PK`, `SK`) or `deletedAt`.

## Git Intelligence Summary

Recent commit subjects (most recent first) show the current patterns in-flight:

- `feat: implement Story 3.1b — Create Save API (POST /saves) (#182)`
- `Implement Story 3.1c: EventBridge Shared Package (@ai-learning-hub/events) (#177)`
- `feat: foundations hardening — adversarial review remediation (Story 2.1-D9) (#175)`

Implications for Story 3.3:

- Extend the existing `SavesRoutesStack` (`infra/lib/stacks/api/saves-routes.stack.ts`) rather than creating a new stack.
- Extend the route registry (`infra/config/route-registry.ts`) and keep it in sync with CDK to satisfy architecture enforcement tests.
- Add new event detail types to `backend/shared/events/src/events/saves.ts` (it explicitly notes 3.3 will add `SaveUpdated`/`SaveDeleted`).

## Latest Tech Information (Quick Notes)

- **Zod**: Latest stable Zod is v4.x (as of early 2026), but this repo is pinned to `zod@^3.22.0` in `@ai-learning-hub/validation`. Do not upgrade Zod as part of Story 3.3.
- **DynamoDB conditional writes**: failed `ConditionExpression` results in `ConditionalCheckFailedException` (AWS SDK v3). Treat this as an expected control-flow signal for:
  - PATCH on deleted/missing → 404
  - RESTORE on already-active/missing → disambiguate with `getItem`
  - DELETE idempotency → disambiguate “already deleted” vs “missing” with `getItem`

## Adversarial Review Fixes Applied

- Any 404 for a save must return **`"Save not found"`** (not the db helper’s `"Item not found"`).
- Conditional-update flows now explicitly require **catching** `AppError(ErrorCode.NOT_FOUND)` and then using `getItem` to disambiguate idempotent success vs missing.
- Saves events typing is explicitly required to be a **discriminated union** to avoid breaking existing `SaveCreated` / `SaveRestored` call sites.

## Project Context Reference

- Story definition + ACs source of truth: `docs/progress/epic-3-stories-and-plan.md#Story-3.3`
- Architecture constraints: `_bmad-output/planning-artifacts/architecture.md` (ADR-001/003/005/008/014/016)
- Prior story context:
  - `_bmad-output/implementation-artifacts/3-1b-create-save-api.md`
  - `_bmad-output/implementation-artifacts/3-2-list-get-saves-api.md`
- Note: no `project-context.md` file was found under `docs/` in this repo at story creation time.

## Story Completion Status

- **Status**: ready-for-dev
- **Completion note**: Ultimate context engine analysis completed — comprehensive developer guide created

## References

- [Source: docs/progress/epic-3-stories-and-plan.md#Story-3.3] — ACs + technical notes
- [Source: backend/shared/validation/src/schemas.ts] — `updateSaveSchema`, tags constraints
- [Source: backend/shared/events/src/events/saves.ts] — saves event catalog (3.3 extends)
- [Source: backend/shared/events/src/emitter.ts] — fire-and-forget event emission contract
- [Source: backend/functions/saves/handler.ts] — existing saves create handler patterns (rate limit, env var requirements, event emission)
- [Source: infra/lib/stacks/api/saves-routes.stack.ts] — CDK wiring pattern for `/saves`
- [Source: infra/config/route-registry.ts] — route registry + handler ref pattern
- [Source: _bmad-output/implementation-artifacts/3-2-list-get-saves-api.md] — handler signature + saveId validation pattern

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

