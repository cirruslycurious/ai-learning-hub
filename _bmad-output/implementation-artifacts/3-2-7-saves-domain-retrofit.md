---
id: "3.2.7"
title: "Command Endpoint Pattern & Saves Domain Retrofit"
status: ready-for-dev
depends_on:
  - "3.2.1"
  - "3.2.2"
  - "3.2.3"
  - "3.2.4"
  - "3.2.5"
  - "3.2.10"
touches:
  - backend/functions/saves/handler.ts
  - backend/functions/saves-get/handler.ts
  - backend/functions/saves-list/handler.ts
  - backend/functions/saves-update/handler.ts
  - backend/functions/saves-delete/handler.ts
  - backend/functions/saves-restore/handler.ts
  - backend/functions/saves-events/handler.ts (new)
  - backend/shared/db/src/saves.ts
  - backend/shared/types/src/entities.ts
  - backend/shared/validation/src/schemas.ts
  - backend/shared/middleware/src/action-registrations.ts
  - infra/lib/stacks/api/saves-routes.stack.ts
risk: high
---

# Story 3.2.7: Command Endpoint Pattern & Saves Domain Retrofit

Status: ready-for-dev

## Story

As a **developer building agent-native API endpoints**,
I want **the CQRS-lite command endpoint convention established with `POST /saves/:saveId/update-metadata`, all 6 existing saves handlers retrofitted with idempotency, optimistic concurrency, event history recording, rate limiting via wrapHandler, proper scope permissions, and context metadata pass-through**,
so that **AI agents can safely retry save mutations without duplicates (idempotency), detect concurrent conflicts before overwriting data (optimistic concurrency), query the full audit trail of any save (event history), receive transparent rate limit information (headers + meta), operate with least-privilege API keys (scoped permissions), and pass workflow context that flows into the audit log (context metadata) — making the saves domain the reference implementation for all future domain retrofits**.

## Acceptance Criteria

### CQRS Command Endpoint (FR92, FR93)

1. **AC1: CQRS command endpoint** — A new `POST /saves/:saveId/update-metadata` route is wired in API Gateway to the **same Lambda function** as `PATCH /saves/:saveId` (zero code duplication). Both accept the same body schema (title, userNotes, contentType, tags, optional `context`), require `Idempotency-Key` and `If-Match` headers, and return `200` with the updated save in the standard envelope. The POST route follows the CQRS-lite command convention — agents should prefer it over PATCH for explicit command semantics.

2. **AC2: Single Lambda, two routes** — The `saves-update/handler.ts` Lambda handles both `PATCH /saves/:saveId` and `POST /saves/:saveId/update-metadata`. CDK wires both routes to the same function. The handler logic is identical for both — no branching on HTTP method needed. The `updateSaveSchema` is extended with the optional `context` field (AC17) and serves both routes.

### Idempotency Integration (FR96, FR97)

3. **AC3: Idempotency on create** — `POST /saves` uses `idempotent: true` in `wrapHandler` options. Duplicate requests with the same `Idempotency-Key` replay the cached 201 response. The `Idempotency-Key` header is required for all POST /saves requests. Requests without it receive `400 VALIDATION_ERROR` with `{ field: "Idempotency-Key", message: "Idempotency-Key header is required" }`.

4. **AC4: Idempotency on update endpoints** — Both `PATCH /saves/:saveId` and `POST /saves/:saveId/update-metadata` use `idempotent: true`. Retried updates with the same key replay the cached 200 response. `Idempotency-Key` header is required on both.

5. **AC5: Idempotency on delete** — `DELETE /saves/:saveId` uses `idempotent: true`. Retried deletes with the same key replay the cached 204 response. `Idempotency-Key` header is required.

6. **AC6: Idempotency on restore** — `POST /saves/:saveId/restore` uses `idempotent: true`. Retried restores with the same key replay the cached 200 response. `Idempotency-Key` header is required.

### Optimistic Concurrency (FR96)

7. **AC7: Version field on saves** — New saves are created with `version: 1` (using `INITIAL_VERSION` from `@ai-learning-hub/middleware`). The `toPublicSave()` function includes `version` in the response. Both `SaveItem` and `PublicSave` types include `version: number` (required, not optional — this is V1, no pre-existing data).

8. **AC8: Concurrency on update** — Both `PATCH /saves/:saveId` and `POST /saves/:saveId/update-metadata` use `requireVersion: true` in `wrapHandler` options. The `If-Match` header is required and carries the expected version number. The DynamoDB update uses a condition expression `version = :expectedVersion`. On success, `version` is incremented. On mismatch, returns `409 VERSION_CONFLICT` with `{ currentVersion: <actual> }` in error details. **Note:** `currentVersion` in the 409 response is a best-effort hint from the pre-read — under concurrent writes it may be stale. Clients MUST re-read (GET) before retrying.

9. **AC9: Version increment on all mutations** — Create sets `version: 1`. Update increments version. Delete and restore increment version. All mutations that modify save state bump the version, ensuring every state change is trackable via If-Match.

### Event History Recording (FR102)

10. **AC10: Event recording on create** — After successful save creation, `recordEvent()` is called with `eventType: "SaveCreated"`, `actorType` and `actorId` from `ctx.actorType`/`ctx.agentId`, `changes: { changedFields: null, before: null, after: { url, title, contentType, tags, ... } }` capturing the initial state of the created save for audit value, and `context` from the request body (if provided). Recording is fire-and-forget (try/catch, log WARN on failure, never throw).

11. **AC11: Event recording on update** — After successful save update, `recordEvent()` is called with `eventType: "SaveMetadataUpdated"`, field-level `changes: { changedFields: [...], before: {...}, after: {...} }` showing only modified fields, and `context` from the request body. The `before` snapshot captures the pre-update values; the `after` snapshot captures post-update values.

12. **AC12: Event recording on delete/restore** — After successful soft-delete, `recordEvent()` is called with `eventType: "SaveDeleted"`. After successful restore, `recordEvent()` with `eventType: "SaveRestored"`. Both include `actorType`/`actorId`. Delete records only when state actually changes (not on idempotent re-delete). Restore records only when state actually changes (not on idempotent re-restore).

### Event History Query Endpoint (FR102)

13. **AC13: Events query endpoint** — `GET /saves/:saveId/events` is wired as a new endpoint using `createEventHistoryHandler({ entityType: "save", entityExistsFn, client })`. Supports `since`, `limit`, and `cursor` query parameters. Returns events in the standard envelope with `meta.cursor`. Requires `saves:read` scope. The `entityExistsFn` returns `true` for both active AND soft-deleted saves (deleted saves retain their audit trail).

### Rate Limiting via wrapHandler (FR103, FR104)

14. **AC14: Rate limiting via wrapHandler options** — All mutation handlers (create, update, update-metadata, delete, restore) use the `rateLimit` config in `wrapHandler` options instead of calling `enforceRateLimit()` directly. This ensures rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) and `meta.rateLimit` are automatically added to ALL responses (success and error), not just rate-limited ones.

15. **AC15: Scope-based rate limits** — The `rateLimit.limit` field uses a function `(auth) => number` that differentiates limits by API key tier: `capture` keys get 20 writes/hour, `full`/`*` keys get 200 writes/hour, other scoped write keys get 100 writes/hour. JWT (web) users get the default 200 writes/hour. Read endpoints (get, list, events) do not have rate limiting in V1.

### Scope Permissions (FR7, via 3.2.6)

16. **AC16: Correct requiredScope on all handlers** — Each handler declares the proper `requiredScope` matching the 3.2.6 reference table:

   | Endpoint | Method | requiredScope |
   |----------|--------|---------------|
   | `/saves` | POST | `saves:create` |
   | `/saves` | GET | `saves:read` |
   | `/saves/:saveId` | GET | `saves:read` |
   | `/saves/:saveId` | PATCH | `saves:write` |
   | `/saves/:saveId` | DELETE | `saves:write` |
   | `/saves/:saveId/restore` | POST | `saves:write` |
   | `/saves/:saveId/update-metadata` | POST | `saves:write` |
   | `/saves/:saveId/events` | GET | `saves:read` |

   **Intentional scope expansion:** `POST /saves` changes from `saves:write` to `saves:create`. This deliberately ENABLES `capture`-tier API keys (iOS Shortcut) to create saves — they were previously blocked because `capture` only grants `saves:create`, not `saves:write`. This fulfills FR7 ("capture-only API keys limited to POST /saves only"). Existing `saves:write` and `full` keys are unaffected — both tiers include `saves:create` in their grants.

### Context Metadata Pass-through (FR103, FR104)

17. **AC17: Context field in mutation schemas** — The `createSaveSchema`, `updateSaveSchema`, and the new `updateMetadataCommandSchema` are extended with an optional `context` field validated by the `eventContextSchema` from Story 3.2.4: `{ trigger?: string, source?: string, confidence?: number, upstream_ref?: string }`. The context is NOT stored on the save item — it flows only into the event history record.

18. **AC18: Context flows to event recording** — When a mutation request includes `context` in the body, that context object is passed to `recordEvent()` as the `context` parameter. Agents can include `{ trigger: "learning-scout", source: "rss-feed", confidence: 0.95 }` to explain why the operation was performed. The context is queryable in the event history.

### Action Registry Updates (FR95, via 3.2.10)

19. **AC19: New commands registered** — The following actions are registered in `action-registrations.ts`: `saves:update-metadata` (POST command), `saves:events` (GET query). Existing registrations for `saves:update` (PATCH), `saves:delete`, `saves:restore` are verified to include `requiredHeaders` entries for `Idempotency-Key` and (where applicable) `If-Match`. The `saves:get` response's `meta.actions[]` includes the new `saves:update-metadata` command with its fully-resolved URL.

### CDK & Infrastructure

20. **AC20: New endpoints wired** — Two new API Gateway routes wired in `saves-routes.stack.ts`:
   - `POST /saves/{saveId}/update-metadata` → **existing `savesUpdateFunction`** (same Lambda as PATCH — zero code duplication)
   - `GET /saves/{saveId}/events` → `savesEventsFunction` (new Lambda)

   The `SavesRoutesStack` props must be extended to accept `eventsTable` and `idempotencyTable` references so that all mutation Lambdas can be granted IAM permissions and receive environment variables for those tables. The events function needs read access to both saves table (entity existence check) and events table (event queries). CORS configuration is already correct (Idempotency-Key, If-Match, X-Agent-ID in allowHeaders; rate limit and agent headers in exposeHeaders — set up in previous stories).

### Intentional Breaking Changes & Migration

21. **AC21: Documented breaking changes** — This story introduces intentional breaking changes to enforce agent-native safety patterns. All existing saves mutation endpoints now REQUIRE headers that were previously optional:

   | Change | Affected Endpoints | Before | After |
   |--------|-------------------|--------|-------|
   | `Idempotency-Key` required | All 5 mutations (POST, PATCH, DELETE, POST restore) | Optional/ignored | Required — 400 if missing |
   | `If-Match` required | PATCH /saves/:saveId, POST update-metadata | Optional/ignored | Required — 428 if missing |
   | `requiredScope` narrowed | GET /saves/:id, PATCH, DELETE, POST restore | `*` (any key works) | Granular operation scopes |
   | `requiredScope` expanded | POST /saves | `saves:write` | `saves:create` (enables capture keys) |

   **Migration notes for frontend:**
   - The web frontend must be updated to send `Idempotency-Key` (UUID) on all mutation requests
   - The web frontend must send `If-Match: <version>` on update requests (version comes from GET response)
   - These changes MUST be coordinated with a frontend update — deploy backend + frontend together

   **Additive (non-breaking) changes:**
   - `version` field added to all save responses (new field, existing consumers ignore it)
   - `context` field accepted in mutation request bodies (optional, ignored if absent)
   - New `POST /saves/:saveId/update-metadata` endpoint (new route, doesn't affect existing)
   - New `GET /saves/:saveId/events` endpoint (new route)
   - Rate limit headers added to all mutation responses (new headers)

   **Rate limit timing change:** Rate limiting now runs BEFORE body validation (in wrapHandler middleware), not after. This means a rate-limited request with an invalid body receives 429 instead of 400. This is correct behavior (reject early, save compute) but is a subtle behavioral change.

### Testing

22. **AC22: Unit tests** — Each retrofitted handler has updated unit tests covering: idempotency key validation, idempotent replay, version conflict handling (409 with currentVersion), event recording verification (recordEvent called with correct params), rate limit via wrapHandler (headers in response), scope permission enforcement, context metadata pass-through. The new update-metadata handler has full unit tests. The events handler uses createEventHistoryHandler and needs minimal custom tests.

23. **AC23: Integration tests** — End-to-end middleware chain tests: (1) Create with idempotency replay, (2) Update with version conflict and retry, (3) Delete then query events to verify audit trail, (4) Rate limit headers present on all mutation responses, (5) capture-scope key can POST /saves but rejected from PATCH /saves/:id, (6) Context metadata appears in event history query.

24. **AC24: Coverage** — All new and modified files maintain >= 80% test coverage (CI gate). Target 90% for new code.

## Tasks / Subtasks

### Task 1: Version Field on Saves (AC: #7, #9)

- [ ] 1.1 Update `SaveItem` interface in `backend/shared/types/src/entities.ts` to include `version: number` (required — V1, no pre-existing data)
- [ ] 1.2 Update `PublicSave` type to include `version: number`
- [ ] 1.3 Update `toPublicSave()` in `backend/shared/db/src/saves.ts` to include `version` in the returned object
- [ ] 1.4 Update `POST /saves` handler to set `version: 1` (using `INITIAL_VERSION`) on new save items
- [ ] 1.5 Verify `toPublicSave` tests pass and add tests for version field presence in responses
- [ ] 1.6 Import `INITIAL_VERSION` from `@ai-learning-hub/middleware` (or `@ai-learning-hub/db` if that's where the concurrency constants live)

### Task 2: Fix Scope Permissions (AC: #16)

- [ ] 2.1 Update `saves/handler.ts`: change `requiredScope: "saves:write"` → `"saves:create"` (enables capture-tier keys)
- [ ] 2.2 Update `saves-get/handler.ts`: change `requiredScope: "*"` → `"saves:read"`
- [ ] 2.3 Update `saves-list/handler.ts`: verify `requiredScope` is `"saves:read"` (check current value)
- [ ] 2.4 Update `saves-update/handler.ts`: change `requiredScope: "*"` → `"saves:write"`
- [ ] 2.5 Update `saves-delete/handler.ts`: change `requiredScope: "*"` → `"saves:write"`
- [ ] 2.6 Update `saves-restore/handler.ts`: change `requiredScope: "*"` → `"saves:write"`
- [ ] 2.7 Update all handler tests to use correct scope assertions

### Task 3: Migrate Rate Limiting to wrapHandler (AC: #14, #15)

- [ ] 3.1 Define scope-based rate limit function in a shared location (e.g., `backend/shared/db/src/saves.ts` or a new `saves-rate-limit.ts`):
  ```typescript
  const savesWriteRateLimit: RateLimitMiddlewareConfig = {
    operation: 'saves-write',
    windowSeconds: 3600,
    limit: (auth) => {
      const scopes = auth?.scopes ?? [];
      if (scopes.includes('capture')) return 20;
      if (scopes.includes('full') || scopes.includes('*')) return 200;
      return 100;
    },
  };
  ```
- [ ] 3.2 Update `saves/handler.ts`: remove direct `enforceRateLimit()` call, add `rateLimit: savesWriteRateLimit` to wrapHandler options
- [ ] 3.3 Update `saves-update/handler.ts`: remove direct `enforceRateLimit()`, add `rateLimit: savesWriteRateLimit`
- [ ] 3.4 Update `saves-delete/handler.ts`: remove direct `enforceRateLimit()`, add `rateLimit: savesWriteRateLimit`
- [ ] 3.5 Update `saves-restore/handler.ts`: remove direct `enforceRateLimit()`, add `rateLimit: savesWriteRateLimit`
- [ ] 3.6 Verify rate limit headers appear in test responses (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- [ ] 3.7 Verify `meta.rateLimit` appears in JSON response body
- [ ] 3.8 Remove unused `enforceRateLimit` imports from modified handlers

### Task 4: Wire Idempotency on All Mutation Handlers (AC: #3, #4, #5, #6)

- [ ] 4.1 Update `saves/handler.ts`: add `idempotent: true` to wrapHandler options
- [ ] 4.2 Update `saves-update/handler.ts`: add `idempotent: true`
- [ ] 4.3 Update `saves-delete/handler.ts`: add `idempotent: true`
- [ ] 4.4 Update `saves-restore/handler.ts`: add `idempotent: true`
- [ ] 4.5 Write tests: verify 400 error when Idempotency-Key header missing on each mutation
- [ ] 4.6 Write tests: verify cached response replay on duplicate Idempotency-Key
- [ ] 4.7 Write tests: verify `X-Idempotent-Replayed: true` header on replay
- [ ] 4.8 Verify idempotency table environment variable (`IDEMPOTENCY_TABLE_NAME`) is available to saves Lambda functions (CDK check)

### Task 5: Wire Optimistic Concurrency on Update Endpoints (AC: #8, #9)

- [ ] 5.1 Update `saves-update/handler.ts`: add `requireVersion: true` to wrapHandler options
- [ ] 5.2 Refactor update logic to use pre-read + condition expression approach (see "Pre-Read + ALL_NEW Approach" in Dev Notes):
  - Pre-read via `getItem` (existence check + before snapshot + version hint)
  - Build condition: `version = :expectedVersion`
  - Add `SET version = :nextVersion` to update expression, keep `returnValues: "ALL_NEW"`
  - Handle `ConditionalCheckFailed` → since pre-read confirmed existence, this is a version conflict → throw `VERSION_CONFLICT` with `currentVersion` from pre-read
- [ ] 5.3 Add version increment to delete handler (increment version before setting deletedAt)
- [ ] 5.4 Add version increment to restore handler (increment version when clearing deletedAt)
- [ ] 5.5 Write tests: 409 VERSION_CONFLICT when If-Match doesn't match, response includes `currentVersion`
- [ ] 5.6 Write tests: successful update returns incremented version in response

### Task 6: Add Context Metadata to Mutation Schemas (AC: #17)

- [ ] 6.1 Import `eventContextSchema` from `@ai-learning-hub/validation`
- [ ] 6.2 Extend `createSaveSchema` with `.extend({ context: eventContextSchema.optional() })`
- [ ] 6.3 Extend `updateSaveSchema` with `.extend({ context: eventContextSchema.optional() })`
- [ ] 6.4 Derive `updateMetadataCommandSchema` programmatically from `updateSaveSchema`: `export const updateMetadataCommandSchema = updateSaveSchema;` (named alias for semantic clarity in action registry — both schemas are identical after 6.3 adds context)
- [ ] 6.5 Update `updateSaveSchema` refine to exclude `context` from the "at least one field" check (context alone is not a valid update)
- [ ] 6.6 Write tests: context field accepted, context-only request rejected, context validation errors

### Task 7: Wire Event History Recording (AC: #10, #11, #12, #18)

- [ ] 7.1 Import `recordEvent` from `@ai-learning-hub/db` in all mutation handlers
- [ ] 7.2 In `saves/handler.ts` (create): add `recordEvent()` call after successful transactWriteItems with `eventType: "SaveCreated"`, `actorType: ctx.actorType`, `actorId: ctx.agentId`, `context: body.context`, `changes: { changedFields: null, before: null, after: { url, title, contentType, tags, ... } }` (capture initial state for audit value)
- [ ] 7.3 In `saves-update/handler.ts` (update): add `recordEvent()` after successful updateItem with `eventType: "SaveMetadataUpdated"`, `changes: { changedFields, before: { ...oldValues }, after: { ...newValues } }`, `context: body.context`
  - `before` comes from the pre-read `getItem` (see "Pre-Read + ALL_NEW Approach" in Dev Notes)
  - `after` comes from `ALL_NEW` returnValues on the updateItem call
- [ ] 7.4 In `saves-delete/handler.ts` (delete): add `recordEvent()` with `eventType: "SaveDeleted"`, only when state actually changes (previousItem exists)
- [ ] 7.5 In `saves-restore/handler.ts` (restore): add `recordEvent()` with `eventType: "SaveRestored"`, only when state actually changes (not idempotent re-restore)
- [ ] 7.6 Wrap ALL `recordEvent()` calls in try/catch, log WARN on failure — never throw (fire-and-forget pattern from 3.2.3)
- [ ] 7.7 Pass `requestId: ctx.requestId` to all recordEvent calls
- [ ] 7.8 Write tests: verify recordEvent called with correct params (mock recordEvent, assert arguments)
- [ ] 7.9 Write tests: verify recordEvent failure doesn't cause handler failure

### Task 8: Wire CQRS Command Route — Single Lambda (AC: #1, #2)

- [ ] 8.1 Verify CDK wiring from Task 11.4: `POST /saves/{saveId}/update-metadata` points to the **same Lambda function** as `PATCH /saves/{saveId}` — no new Lambda, no new handler file
- [ ] 8.2 Verify the `saves-update/handler.ts` logic works identically for both routes — no branching on HTTP method needed (both accept the same body, same headers, same response)
- [ ] 8.3 Extend `updateSaveSchema` with the optional `context` field (AC17) so it serves both PATCH and POST command routes
- [ ] 8.4 Confirm `wrapHandler` options cover both routes: `{ requireAuth: true, requiredScope: "saves:write", idempotent: true, requireVersion: true, rateLimit: savesWriteRateLimit }`
- [ ] 8.5 Write integration test: POST /saves/:saveId/update-metadata with Idempotency-Key, If-Match, context — verify 200 with updated save

### Task 9: Wire Event History Query Endpoint (AC: #13)

- [ ] 9.1 Create `backend/functions/saves-events/handler.ts` using `createEventHistoryHandler()`
- [ ] 9.2 Implement `entityExistsFn`: query saves table for the saveId, return `true` even if `deletedAt` is set (soft-deleted saves retain event history)
- [ ] 9.3 `wrapHandler` options: `{ requireAuth: true, requiredScope: "saves:read" }`
- [ ] 9.4 Write unit tests: entity found (200 with events), entity not found (404), soft-deleted entity (200 — events visible), auth required
- [ ] 9.5 Integration test: create save → update → delete → query events → verify all 3 events in chronological order

### Task 10: Update Action Registry (AC: #19)

- [ ] 10.1 Open `backend/shared/middleware/src/action-registrations.ts`
- [ ] 10.2 Register `saves:update-metadata` action with `method: "POST"`, `urlPattern: "/saves/:saveId/update-metadata"`, `requiredHeaders` including `Idempotency-Key` and `If-Match`, `requiredScope: "saves:write"`, `inputSchema` from updateMetadataCommandSchema
- [ ] 10.3 Register `saves:events` action with `method: "GET"`, `urlPattern: "/saves/:saveId/events"`, `requiredScope: "saves:read"`
- [ ] 10.4 Update existing save action registrations to include `requiredHeaders` for `Idempotency-Key` (on create, update, delete, restore) and `If-Match` (on update endpoints)
- [ ] 10.5 Verify `buildResourceActions("saves", saveId)` in saves-get returns the new update-metadata command in `meta.actions[]`

### Task 11: CDK Infrastructure (AC: #20)

- [ ] 11.1 Open `infra/lib/stacks/api/saves-routes.stack.ts`
- [ ] 11.2 Extend `SavesRoutesStackProps` to accept `eventsTable` and `idempotencyTable` DynamoDB table references (these tables were created in Stories 3.2.1 and 3.2.3 but not yet passed to the saves stack)
- [ ] 11.3 Add `savesEventsFunction` Lambda: needs `SAVES_TABLE_NAME` (for entity existence check), `EVENTS_TABLE_NAME` (for event queries), read-only IAM on both tables
- [ ] 11.4 Wire API Gateway routes:
  - `POST /saves/{saveId}/update-metadata` → **existing `savesUpdateFunction`** (add child resource under saveIdResource, point to same Lambda)
  - `GET /saves/{saveId}/events` → savesEventsFunction (add child resource under saveIdResource)
- [ ] 11.5 Ensure all mutation Lambdas have IAM permissions for the idempotency table (write access)
- [ ] 11.6 Ensure all mutation Lambdas have IAM permissions for the events table (write access for recordEvent)
- [ ] 11.7 Add `IDEMPOTENCY_TABLE_NAME` and `EVENTS_TABLE_NAME` environment variables to all saves mutation Lambdas
- [ ] 11.8 Trace prop threading: root stack → API stack → SavesRoutesStack. Ensure `eventsTable` and `idempotencyTable` are passed through every layer.
- [ ] 11.9 Run `npm run build` in `infra/` and verify `cdk synth` succeeds

### Task 12: Update Existing Handler Tests (AC: #22)

- [ ] 12.1 Update `saves/handler.test.ts`: mock idempotency, test Idempotency-Key required, test replay, test version in response, test recordEvent called, test scope is `saves:create`, test rate limit headers in response
- [ ] 12.2 Update `saves-update/handler.test.ts`: mock idempotency + concurrency, test If-Match required, test version conflict 409, test recordEvent with changes, test scope is `saves:write`, test rate limit headers
- [ ] 12.3 Update `saves-delete/handler.test.ts`: mock idempotency, test Idempotency-Key required, test recordEvent on state change only, test scope is `saves:write`, test rate limit headers
- [ ] 12.4 Update `saves-restore/handler.test.ts`: mock idempotency, test Idempotency-Key required, test recordEvent on state change only, test scope is `saves:write`, test rate limit headers
- [ ] 12.5 Update `saves-get/handler.test.ts`: test scope is `saves:read`, verify version in response
- [ ] 12.6 Update `saves-list/handler.test.ts`: verify scope is `saves:read` (confirm current value)

### Task 13: Integration Tests (AC: #23)

- [ ] 13.1 Integration test: create → retry with same Idempotency-Key → verify cached 201 replay
- [ ] 13.2 Integration test: create → get (version=1) → update (If-Match: 1) → get (version=2) → update (If-Match: 1 — stale) → verify 409 VERSION_CONFLICT
- [ ] 13.3 Integration test: create → update → delete → GET /saves/:id/events → verify 3 events with correct types and ordering
- [ ] 13.4 Integration test: mutation response includes `X-RateLimit-*` headers and `meta.rateLimit` in body
- [ ] 13.5 Integration test: API key with `capture` scope can POST /saves but rejected from PATCH /saves/:id (403 SCOPE_INSUFFICIENT)
- [ ] 13.6 Integration test: POST /saves with `context: { trigger: "learning-scout" }` → query events → verify context in event record

### Task 14: Document Breaking Changes (AC: #21)

- [ ] 14.1 Create a GitHub issue for the frontend team: "Update saves mutations to send Idempotency-Key and If-Match headers" — reference the AC21 migration table
- [ ] 14.2 Add a note to the PR description listing all breaking changes from AC21 so reviewers are aware of the coordinated frontend update requirement

### Task 15: Quality Gates

- [ ] 15.1 Run `npm test` — all tests pass with >= 80% coverage on all modified/new files
- [ ] 15.2 Run `npm run lint` — no errors
- [ ] 15.3 Run `npm run build` — no TypeScript errors
- [ ] 15.4 Run `npm run build` in `infra/` → `cdk synth` succeeds

## Dev Notes

### Architecture Patterns & Constraints

- **ADR-005 (Lambda per Concern):** Each API endpoint gets its own Lambda function. **Exception:** `POST /saves/:saveId/update-metadata` shares the same Lambda as `PATCH /saves/:saveId` because both are the same concern (save metadata mutation) with identical logic. The new `events` endpoint gets a dedicated Lambda.
- **ADR-008 (Standardized Error Handling):** All errors use `AppError` with `ErrorCode`. Version conflicts return `409 VERSION_CONFLICT` with `details: { currentVersion }`. Missing Idempotency-Key returns `400 VALIDATION_ERROR` with field-level detail.
- **ADR-013 (Authentication):** Scope enforcement via `requireScope()` in `wrapHandler`. JWT bypasses scope checks. API keys use hierarchical scope resolution from Story 3.2.6.
- **ADR-014 (API-First Design):** CQRS-lite command convention: mutations are commands (require Idempotency-Key), reads are queries (no side effects except lastAccessedAt update on GET).
- **ADR-015 (Lambda Layers):** All shared code in `@ai-learning-hub/*` packages, deployed via Lambda Layer.

### Current State Analysis — What Needs to Change

| Handler | File | Current `requiredScope` | Target | Current Rate Limit | Current Idempotency |
|---------|------|------------------------|--------|-------------------|---------------------|
| POST /saves | `saves/handler.ts` | `saves:write` | `saves:create` | Direct `enforceRateLimit()` | None |
| GET /saves | `saves-list/handler.ts` | (check) | `saves:read` | None | N/A |
| GET /saves/:id | `saves-get/handler.ts` | `*` | `saves:read` | None | N/A |
| PATCH /saves/:id | `saves-update/handler.ts` | `*` | `saves:write` | Direct `enforceRateLimit()` | None |
| DELETE /saves/:id | `saves-delete/handler.ts` | `*` | `saves:write` | Direct `enforceRateLimit()` | None |
| POST /saves/:id/restore | `saves-restore/handler.ts` | `*` | `saves:write` | Direct `enforceRateLimit()` | None |

**Key issues to fix:**
1. Most handlers use `requiredScope: "*"` which matches any API key — should use granular operation scopes
2. Rate limiting is done via direct `enforceRateLimit()` calls, which means rate limit transparency headers are NOT added to responses
3. No handler uses idempotency or optimistic concurrency
4. No handler records events to the events table (only EventBridge fire-and-forget emission)

### WrapHandler Options — Before vs After

**BEFORE (current saves-create):**
```typescript
export const handler = wrapHandler(savesCreateHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
});
```

**AFTER (retrofitted saves-create):**
```typescript
export const handler = wrapHandler(savesCreateHandler, {
  requireAuth: true,
  requiredScope: "saves:create",
  idempotent: true,
  rateLimit: savesWriteRateLimit,
});
```

**AFTER (retrofitted saves-update — serves both PATCH and POST update-metadata):**
```typescript
export const handler = wrapHandler(savesUpdateHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
  idempotent: true,
  requireVersion: true,
  rateLimit: savesWriteRateLimit,
});
```

### Rate Limit Configuration

```typescript
import type { RateLimitMiddlewareConfig } from "@ai-learning-hub/middleware";

export const savesWriteRateLimit: RateLimitMiddlewareConfig = {
  operation: "saves-write",
  windowSeconds: 3600,
  limit: (auth) => {
    const scopes = auth?.scopes ?? [];
    if (scopes.includes("capture")) return 20;
    if (scopes.includes("full") || scopes.includes("*")) return 200;
    return 100; // scoped write default
  },
};
```

Export from `backend/shared/db/src/saves.ts` (alongside existing `SAVES_WRITE_RATE_LIMIT` constant, which can be deprecated or kept as a simple fallback).

### Update Handler — Pre-Read + ALL_NEW Approach

**Capturing field-level changes for event recording:**

Use a **pre-read** (`getItem`) before `updateItem` with `returnValues: "ALL_NEW"`. The pre-read serves triple duty:

1. **Existence check** — confirm the save exists and is not soft-deleted before attempting update
2. **Before snapshot** — capture pre-update field values for event recording (`changes.before`)
3. **Version hint for conflict errors** — if the DynamoDB condition expression fails after confirming existence via pre-read, it must be a version conflict. Report `currentVersion` from the pre-read item in the 409 error.

```typescript
// 1. Pre-read: existence + before snapshot + version hint
const existingItem = await getItem<SaveItem>(client, SAVES_TABLE_CONFIG,
  { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
  { consistentRead: true }, logger
);
if (!existingItem || existingItem.deletedAt) {
  throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
}

// 2. Update with version condition, returns ALL_NEW
try {
  const updatedItem = await updateItem<SaveItem>(client, SAVES_TABLE_CONFIG, {
    key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
    updateExpression: "SET #title = :title, ..., version = :nextVer",
    conditionExpression: "version = :expectedVersion",
    returnValues: "ALL_NEW",
  }, logger);
} catch (err) {
  if (isConditionalCheckFailed(err)) {
    // We confirmed item exists via pre-read, so this must be version conflict
    throw AppError.build(ErrorCode.VERSION_CONFLICT, "Save was modified")
      .withDetails({ currentVersion: existingItem.version })
      .create();
  }
  throw err;
}

// 3. Build changes from pre-read (before) and ALL_NEW (after)
const changedFields = Object.keys(body).filter(k => k !== "context");
const before: Record<string, unknown> = {};
const after: Record<string, unknown> = {};
for (const field of changedFields) {
  before[field] = existingItem[field as keyof SaveItem];
  after[field] = updatedItem![field as keyof SaveItem];
}
```

**Why pre-read over ALL_OLD?** Simpler — keeps `ALL_NEW` (handler already uses it), avoids reconstructing the post-update response manually, and the pre-read doubles as existence/soft-delete check that must happen anyway.

### Event Recording — Fire and Forget Pattern

From Story 3.2.3, `recordEvent()` is designed as fire-and-forget. In handlers:

```typescript
try {
  await recordEvent(client, {
    entityType: "save",
    entityId: saveId,
    userId,
    eventType: "SaveCreated",
    actorType: ctx.actorType,
    actorId: ctx.agentId ?? undefined,
    changes: { changedFields: null, before: null, after: { url, title, contentType, tags } },
    context: body.context ?? undefined,
    requestId: ctx.requestId,
  }, logger);
} catch (err) {
  logger.warn("Failed to record event (non-fatal)", { error: err, saveId });
}
```

**Critical:** Event recording MUST happen AFTER the primary mutation succeeds. Do NOT record events before the save is written — partial failures would create orphan events.

**Silent failure risk (FM3):** Because event recording is fire-and-forget, misconfigured CDK (missing `EVENTS_TABLE_NAME` env var or missing IAM permissions) causes ALL event recording to silently fail with no user-visible error. Mitigations:
- Integration test in CI verifies create → query events returns at least 1 event (#244)
- Post-deployment smoke test: create → update → delete → query events → verify all 3 events (#245)
- Consider CloudWatch alarm on WARN logs matching "Failed to record event"

### CQRS Command Convention

The CQRS-lite pattern for this project:
- **Query endpoints** (GET): No side effects (except lastAccessedAt touch), no Idempotency-Key required, no If-Match required
- **Command endpoints** (POST, PATCH, DELETE): Side effects, Idempotency-Key REQUIRED, If-Match required on mutations that modify existing resources

The `POST /saves/:saveId/update-metadata` endpoint is the first CQRS command endpoint. It establishes the convention that future domain retrofits (3.2.8 auth, Epic 4 projects, Epic 8 tutorials) will follow:
- URL pattern: `POST /:entity/:id/:action` (slash-separated, consistent with existing `/restore` endpoint)
- Required headers: `Idempotency-Key`, `If-Match`
- Body includes the command payload + optional `context`
- Response: standard envelope with updated resource

**Why keep PATCH alongside POST?** PATCH is standard REST semantics. POST command is CQRS semantics. Both work — PATCH for RESTful clients (web frontend), POST command for agent-native clients. The handler logic is shared. No deprecation of PATCH — both are first-class.

### Middleware Chain Order (after retrofit)

```
Request → Extract Auth → Check Role → Check Scope (saves:read/write/create)
        → Extract Agent Identity (X-Agent-ID → actorType, agentId)
        → Check Rate Limit (scope-based limits → headers + meta)
        → Check Idempotency Cache (replay cached response if hit)
        → Extract If-Match Version (→ ctx.expectedVersion)
        → Execute Handler
            → Validate body (Zod, including context field)
            → DynamoDB mutation (with version condition)
            → Record event (fire-and-forget)
            → Emit EventBridge event (fire-and-forget)
        → Store Idempotency Result (2xx only, fail-open)
        → Add Rate Limit Headers + Meta
        → Echo X-Agent-ID Header
        → Return Response
```

### Idempotency Fail-Open Behavior

The idempotency middleware (Story 3.2.1) uses **fail-open** design: if the idempotency table is throttled or unavailable, the handler executes normally without dedup protection. The `X-Idempotency-Status: unavailable` header signals this to callers. This means "at-least-once" execution is possible during table outages. Application-level idempotency in the create handler (URL hash duplicate detection) and delete handler (already-deleted check) provides a second safety net.

### Capture Scope and Auto-Restore Behavior

The `POST /saves` create handler has auto-restore logic: when a duplicate URL is detected for a soft-deleted save, it restores the save instead of creating a new one. With the scope change from `saves:write` to `saves:create` (AC16), `capture`-tier API keys can now trigger this auto-restore behavior implicitly. This is intentional — the auto-restore is semantically part of the "create" operation (user intent: "save this URL"). Document this in the API reference so capture-key consumers understand the behavior.

### Idempotency Key and DynamoDB — Environment Variable

The idempotency middleware needs the `IDEMPOTENCY_TABLE_NAME` environment variable on each Lambda. This must be added in CDK for all saves mutation Lambdas. The table was created in Story 3.2.1 but not yet wired to saves Lambdas.

Similarly, `EVENTS_TABLE_NAME` must be added for event recording (created in Story 3.2.3, not yet wired to saves Lambdas).

### Existing Code to Modify

| Package / Location | File | Changes |
|-------------------|------|---------|
| `@ai-learning-hub/types` | `src/entities.ts` | Add `version: number` to both `SaveItem` and `PublicSave` (required — V1, no pre-existing data) |
| `@ai-learning-hub/db` | `src/saves.ts` | `toPublicSave` includes version; export `savesWriteRateLimit` config |
| `@ai-learning-hub/validation` | `src/schemas.ts` | Extend create/update schemas with `context` field |
| `@ai-learning-hub/middleware` | `src/action-registrations.ts` | Register new saves commands |
| `backend/functions/saves/` | `handler.ts` | Scope, idempotency, rate limit via wrapper, event recording, version field |
| `backend/functions/saves-get/` | `handler.ts` | Scope fix only |
| `backend/functions/saves-list/` | `handler.ts` | Verify scope |
| `backend/functions/saves-update/` | `handler.ts` | Scope, idempotency, concurrency (pre-read + ALL_NEW), rate limit, event recording; serves both PATCH and POST update-metadata routes |
| `backend/functions/saves-delete/` | `handler.ts` | Scope, idempotency, rate limit, event recording, version increment |
| `backend/functions/saves-restore/` | `handler.ts` | Scope, idempotency, rate limit, event recording, version increment |
| `infra/lib/stacks/api/` | `saves-routes.stack.ts` | New endpoints, env vars, IAM |

### New Files

| File | Purpose |
|------|---------|
| `backend/functions/saves-events/handler.ts` | GET /saves/:saveId/events query |
| `backend/functions/saves-events/handler.test.ts` | Unit tests |

**Note:** No `saves-update-metadata/` directory. The `POST /saves/:saveId/update-metadata` route is served by the existing `saves-update/handler.ts` Lambda (CDK wires both routes to the same function).

### Project Structure Notes

- All new code goes in existing shared packages or as new Lambda handler directories under `backend/functions/`
- No new shared packages created
- One new Lambda function in CDK (`saves-events`); `POST update-metadata` reuses the existing `saves-update` Lambda
- No new DynamoDB tables (uses existing idempotency + events tables from 3.2.1 and 3.2.3)

### Previous Story Intelligence

**Story 3.2.1 (Idempotency & Concurrency):**
- `wrapHandler` accepts `idempotent: true` to enable idempotency middleware
- `wrapHandler` accepts `requireVersion: true` to enable If-Match version extraction
- `INITIAL_VERSION = 1` constant for new items
- `X-Idempotent-Replayed: true` header on cached replays
- `X-Idempotency-Status: unavailable` on fail-open
- Only 2xx responses cached (4xx/5xx NOT cached so agents can retry)
- Fail-open philosophy: DynamoDB errors → execute handler normally

**Story 3.2.2 (Error Contract & Envelope):**
- `VERSION_CONFLICT` (409) error code exists
- `AppError.build(ErrorCode.VERSION_CONFLICT, msg).withDetails({currentVersion}).create()`
- `createSuccessResponse(data, requestId, { statusCode?, meta?, links? })` options pattern
- `meta.rateLimit` populated by rate limit middleware

**Story 3.2.3 (Event History):**
- `recordEvent(client, params, logger)` — fire-and-forget, log WARN on failure
- `createEventHistoryHandler(config)` — handler factory for GET /:entity/:id/events
- Event naming: `SaveCreated`, `SaveMetadataUpdated`, `SaveDeleted`, `SaveRestored`
- Events table PK: `EVENTS#save#{saveId}`, TTL 90 days
- Soft-deleted entities MUST be queryable for event history

**Story 3.2.4 (Agent Identity & Rate Limit):**
- Agent identity always extracted (ctx.agentId, ctx.actorType)
- `RateLimitMiddlewareConfig` with dynamic `limit` function
- Rate limit headers on ALL responses (success + error)
- `eventContextSchema` for context metadata pass-through

**Story 3.2.5 (Cursor Pagination):**
- Saves-list already uses cursor pagination with envelope response
- `buildPaginatedResponse()` for list responses

**Story 3.2.6 (Scoped Permissions):**
- `checkScopeAccess(grantedScopes, requiredScope)` for hierarchical resolution
- `saves:create` — satisfied by `capture`, `saves:write`, `full`
- `saves:read` — satisfied by `read`, `saves:write`, `full`
- `saves:write` — satisfied by `saves:write`, `full`
- Scope-based rate limits: capture=20, full=200, scoped=100

**Story 3.2.10 (Action Discoverability):**
- `buildResourceActions("saves", saveId)` already called in saves-get
- `action-registrations.ts` contains declarative action seed data
- New actions (update-metadata, events) must be registered

### Git Intelligence

Recent commits (Epic 3.2):
```
7d8fdbc feat: Proactive Action Discoverability (Story 3.2.10) (#243)
d40e3c2 feat: Scoped API Key Permissions (Story 3.2.6) #239 (#240)
f002997 feat: Cursor-Based Pagination (Story 3.2.5) (#236)
c76a438 feat: Agent Identity, Context & Rate Limit Transparency (Story 3.2.4) (#234)
b564aa4 feat: Event History Infrastructure (Story 3.2.3) #229 (#230)
9d17f52 feat: Idempotency & Optimistic Concurrency Middleware (Story 3.2.1) (#226)
```

All dependency stories (3.2.1-3.2.6, 3.2.10) have merged PRs — the middleware infrastructure is production-ready. This story is pure integration.

### Anti-Patterns to Avoid

- **Do NOT call `enforceRateLimit()` directly** — use `wrapHandler`'s `rateLimit` config so that rate limit headers are automatically added to ALL responses (including errors).
- **Do NOT use `requiredScope: "*"` on any handler** — use granular operation scopes (`saves:create`, `saves:read`, `saves:write`). The `*` wildcard makes every API key work for everything, defeating the purpose of scoped permissions.
- **Do NOT record events BEFORE the primary mutation** — event recording must happen AFTER the DynamoDB write succeeds. Partial failures would create orphan events.
- **Do NOT throw on event recording failure** — `recordEvent()` is fire-and-forget. Wrap in try/catch, log WARN. Never let event recording failure cause a handler failure.
- **Do NOT store the `context` field on the SaveItem** — context is transient metadata that flows into the event history record only. It does not belong in the save's DynamoDB item.
- **Do NOT create a separate shared package** — all code goes in existing `@ai-learning-hub/*` packages.
- **Do NOT use `console.log`** — use `@ai-learning-hub/logging` structured logger (via `ctx.logger`).
- **Do NOT over-abstract the update logic** — if extracting a shared `executeSaveUpdate()` function adds complexity without clear benefit, keep the logic inline in each handler. Two handlers with similar 30-line blocks is better than a premature abstraction.
- **Do NOT add event recording to GET endpoints** — reads are queries, not commands. They don't generate events. The `lastAccessedAt` update in saves-get is a side effect but is NOT event-worthy (too noisy, no business value).
- **Do NOT create CDK resources without running `npm run build` in infra/** — CDK compiles TypeScript to `infra/dist/`. Forgetting to build means stale JS and synth won't reflect your changes.

### Duplicate Response Pattern — Create Handler

The `POST /saves` create handler has a custom 409 `DUPLICATE_SAVE` response that bypasses `createSuccessResponse()`. When adding idempotency, note that the idempotency middleware caches the FINAL response (including 409s). This means:
- First request: URL already exists → 409 DUPLICATE_SAVE (NOT cached — only 2xx cached)
- Retry with same Idempotency-Key: handler re-executes, same 409 returned

This is correct behavior — 409 is an error response, and errors are NOT cached by the idempotency middleware. The duplicate check is idempotent by nature (same URL → same 409).

### Delete Handler — Behavioral Idempotency vs Middleware Idempotency

The delete handler already has application-level idempotency: deleting an already-deleted save returns 204 without emitting an event. With middleware idempotency added:
- First DELETE: save exists → soft delete → 204 → cached by idempotency middleware
- Retry with same Idempotency-Key: cached 204 replayed (handler NOT re-executed)
- Same Idempotency-Key, different saveId: 409 IDEMPOTENCY_KEY_CONFLICT (operation path mismatch)
- Different Idempotency-Key, same saveId: handler re-executes → already-deleted → 204 (application-level idempotency)

Both layers complement each other: middleware idempotency prevents re-execution entirely on retry; application-level idempotency handles the "new key, same intent" case.

### Testing Strategy

**Unit tests (Vitest):**
- Mock `getDefaultClient()` for DynamoDB operations
- Mock `recordEvent()` to verify it's called with correct params
- Mock `emitEvent()` (existing pattern)
- Use `createMockHandlerContext` from `backend/test-utils/mock-wrapper.ts` with idempotency and version options
- Test each handler's wrapHandler options are correct (scope, idempotent, requireVersion, rateLimit)

**Integration tests:**
- Full middleware chain from API Gateway event → handler → response
- Use `createMockEvent` from test-utils for realistic event shapes
- Verify response headers (rate limit, idempotency, agent ID)
- Verify response body envelope (data, meta with rateLimit, links)

**What NOT to test in this story:**
- Idempotency middleware internals (tested in 3.2.1)
- Concurrency middleware internals (tested in 3.2.1)
- Scope resolution internals (tested in 3.2.6)
- Rate limit middleware internals (tested in 3.2.4)
- Event history handler internals (tested in 3.2.3)

Focus tests on **integration correctness**: are the right middleware options wired, and do the handlers pass the right data to the middleware?

### Scope Boundaries

**In scope:**
- CQRS command endpoint (update-metadata)
- Idempotency on all mutations
- Optimistic concurrency on update endpoints
- Event history recording on all mutations
- Event history query endpoint
- Rate limiting via wrapHandler
- Scope permissions
- Context metadata pass-through
- Action registry updates
- CDK wiring

**Not in scope:**
- Auth domain retrofit (Story 3.2.8)
- Batch operations (Story 3.2.9)
- Rate limit differentiation by endpoint (all writes share one bucket — future optimization)
- State machine for saves (saves don't have lifecycle states in V1)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3.2, Story 3.2.7]
- [Source: _bmad-output/planning-artifacts/prd.md — FR92-FR93 CQRS-lite]
- [Source: _bmad-output/planning-artifacts/prd.md — FR96-FR97 Idempotency]
- [Source: _bmad-output/planning-artifacts/prd.md — FR100-FR101 Error contract]
- [Source: _bmad-output/planning-artifacts/prd.md — FR102 Event history]
- [Source: _bmad-output/planning-artifacts/prd.md — FR103-FR104 Agent identity + context]
- [Source: _bmad-output/planning-artifacts/prd.md — FR105 Cursor pagination]
- [Source: _bmad-output/planning-artifacts/prd.md — FR7 Capture-only API keys]
- [Source: backend/functions/saves/handler.ts — Current create handler]
- [Source: backend/functions/saves-get/handler.ts — Current get handler]
- [Source: backend/functions/saves-update/handler.ts — Current update handler]
- [Source: backend/functions/saves-delete/handler.ts — Current delete handler]
- [Source: backend/functions/saves-restore/handler.ts — Current restore handler]
- [Source: backend/functions/saves-list/handler.ts — Current list handler]
- [Source: backend/shared/db/src/saves.ts — toPublicSave, SAVES_WRITE_RATE_LIMIT]
- [Source: backend/shared/middleware/src/wrapper.ts — wrapHandler, WrapperOptions]
- [Source: backend/shared/middleware/src/idempotency.ts — Idempotency middleware]
- [Source: backend/shared/middleware/src/concurrency.ts — Version/If-Match middleware]
- [Source: backend/shared/middleware/src/agent-identity.ts — Agent identity extraction]
- [Source: backend/shared/middleware/src/rate-limit-headers.ts — Rate limit transparency]
- [Source: backend/shared/middleware/src/scope-resolver.ts — Scope tier resolution]
- [Source: backend/shared/middleware/src/handlers/event-history.ts — Event history handler factory]
- [Source: backend/shared/middleware/src/action-registrations.ts — Action registry seed data]
- [Source: backend/shared/middleware/src/resource-actions.ts — buildResourceActions]
- [Source: backend/shared/db/src/events.ts — recordEvent, EVENTS_TABLE_CONFIG]
- [Source: backend/shared/validation/src/schemas.ts — createSaveSchema, updateSaveSchema, eventContextSchema]
- [Source: backend/shared/types/src/entities.ts — SaveItem, PublicSave, ContentType]
- [Source: backend/shared/types/src/api.ts — EnvelopeMeta, RateLimitMiddlewareConfig, AuthContext]
- [Source: infra/lib/stacks/api/saves-routes.stack.ts — Saves CDK routes]
- [Source: _bmad-output/implementation-artifacts/3-2-1-idempotency-optimistic-concurrency-middleware.md]
- [Source: _bmad-output/implementation-artifacts/3-2-2-consistent-error-contract-response-envelope.md]
- [Source: _bmad-output/implementation-artifacts/3-2-3-event-history-infrastructure.md]
- [Source: _bmad-output/implementation-artifacts/3-2-4-agent-identity-context-rate-limit.md]
- [Source: _bmad-output/implementation-artifacts/3-2-5-cursor-based-pagination.md]
- [Source: _bmad-output/implementation-artifacts/3-2-6-scoped-api-key-permissions.md]
- [Source: _bmad-output/implementation-artifacts/3-2-10-proactive-action-discoverability.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
