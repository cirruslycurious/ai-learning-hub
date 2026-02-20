---
id: "3.1b"
title: "Create Save API"
status: ready-for-dev
depends_on:
  - 3-1a-save-validation-modules
  - 3-1c-events-shared-package
touches:
  - backend/functions/saves
  - backend/shared/db
  - infra/lib/stacks
  - infra/config/route-registry.ts
risk: medium-high
---

# Story 3.1b: Create Save API

Status: ready-for-dev

## Story

As a user (web, Shortcut, or API),
I want to save a URL with optional metadata,
so that the URL is stored in my library and available for organization, enrichment, and recall.

## Acceptance Criteria

| #   | Given                                                    | When                                                                       | Then                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User authenticated (JWT or API key)                      | `POST /saves` with body `{ url, title?, userNotes?, contentType?, tags? }` | URL normalized using `normalizeUrl()` from `@ai-learning-hub/validation`. `urlHash` = SHA-256 of `normalizedUrl`. Input validated using `createSaveSchema` from `@ai-learning-hub/validation`.                                                                                                                                                                                                          |
| AC2 | Normalized URL has not been saved by this user           | Save creation                                                              | New item written to `saves` table: `PK=USER#<userId>`, `SK=SAVE#<ULID>` with all attributes + `linkedProjectCount: 0`, `isTutorial: false`; `tutorialStatus` attribute is **omitted entirely** (not set to null) to avoid polluting the `userId-tutorialStatus-index` GSI; returns 201 with save object |
| AC3 | Normalized URL already saved by this user (same urlHash) | Save creation                                                              | Returns 409 with body `{ error: { code: 'DUPLICATE_SAVE', message: 'URL already saved', requestId: '<correlation-id>' }, existingSave: {...} }` — `existingSave` is a sibling of `error` (not nested inside it) to keep the `error` object compliant with ADR-008's standard shape                                                                                                                      |
| AC4 | Save created successfully                                | After DynamoDB write                                                       | EventBridge event emitted: `source: 'ai-learning-hub.saves'`, `detailType: 'SaveCreated'`, detail includes `{ userId, saveId, url, normalizedUrl, urlHash, contentType }`                                                                                                                                                                                                                               |
| AC5 | URL provided without contentType                         | Save creation                                                              | System calls `detectContentType()` from `@ai-learning-hub/validation`. User-provided `contentType` always takes precedence.                                                                                                                                                                                                                                                                             |
| AC6 | Any warm invocation                                      | POST /saves                                                                | Response time < 1 second (NFR-P2). Cold start may exceed per ADR-016. EventBridge `PutEvents` is **fire-and-forget** (`void` — not awaited) so it is off the critical path; the response is returned before the event emission completes. |
| AC7 | Any request                                              | Handler executes                                                           | Lambda uses `@ai-learning-hub/logging`, `@ai-learning-hub/middleware`, `@ai-learning-hub/db`, `@ai-learning-hub/validation`. Rate limiting inherited from Epic 2 middleware (Story 2.7): POST /saves is a write operation.                                                                                                                                                                              |
| AC8 | Duplicate check                                          | Before DynamoDB write                                                      | **Layer 1:** Query GSI `urlHash-index` with `urlHash = <hash>`, FilterExpression `PK = USER#<userId> AND attribute_not_exists(deletedAt)`. **Layer 2:** TransactWriteItems atomically writes save item + uniqueness marker `PK=USER#<userId>, SK=URL#<urlHash>` with ConditionExpression `attribute_not_exists(SK)` on marker. If condition fails → 409. Two-layer guard mitigates TOCTOU race.          |
| AC9 | URL was previously saved then soft-deleted               | `POST /saves` with same URL                                                | Layer 1 passes (deleted save filtered out), Layer 2 condition fails (marker still exists). Handler re-queries for the soft-deleted save via GSI (see Dev Notes), clears `deletedAt` using `ConditionExpression: attribute_exists(deletedAt)` (so only one concurrent restore wins), emits `SaveRestored` event (`source: 'ai-learning-hub.saves'`, `detailType: 'SaveRestored'`, detail includes `{ userId, saveId, url, normalizedUrl, urlHash, contentType }`), returns 200 with restored save. iOS Shortcut treats both 201 and 200 as success. If no soft-deleted save is found (orphaned marker), log anomaly and return 500 INTERNAL_ERROR. |

## Tasks / Subtasks

- [ ] Task 1: Add `transactWriteItems` helper to `@ai-learning-hub/db` (AC: #8)
  - [ ] 1.1 Create `backend/shared/db/src/transact.ts` with `transactWriteItems(client, transactItems, logger?)` function using `TransactWriteCommand` from `@aws-sdk/lib-dynamodb`
  - [ ] 1.2 Map `TransactionCanceledException` to a typed result (return reason codes: `ConditionalCheckFailed` per item index) so callers can distinguish which item caused failure
  - [ ] 1.3 Export `transactWriteItems` and `TransactionCancelledError` from `backend/shared/db/src/index.ts`
  - [ ] 1.4 Add unit tests in `backend/shared/db/test/transact.test.ts`

- [ ] Task 2: Create the saves-create Lambda handler (AC: all)
  - [ ] 2.1 Create `backend/functions/saves/handler.ts` (route: POST /saves)
  - [ ] 2.2 Implement `SAVES_TABLE_CONFIG` using `process.env.SAVES_TABLE_NAME ?? 'ai-learning-hub-saves'`
  - [ ] 2.3 Implement Layer 1 duplicate check: Query `urlHash-index` GSI with `urlHash = :hash`, FilterExpression `PK = :pk AND attribute_not_exists(deletedAt)`
  - [ ] 2.4 Build save item: generate `saveId` with `ulid()`, `PK=USER#<userId>`, `SK=SAVE#<saveId>`, all fields from story notes (see Full Save Item Shape)
  - [ ] 2.5 Implement Layer 2: `transactWriteItems` writing save item + marker item `SK=URL#<urlHash>` with `ConditionExpression: attribute_not_exists(SK)` on marker
  - [ ] 2.6 Implement Layer 2 failure handling (three sub-paths):
    - Re-query `urlHash-index` GSI (same as Layer 1) for active save → return 409 with `existingSave`
    - Query `urlHash-index` GSI without `attribute_not_exists(deletedAt)` filter to find soft-deleted save → `updateItem` with `UpdateExpression: 'REMOVE deletedAt SET updatedAt = :now'` and **`ConditionExpression: attribute_exists(deletedAt)`** (prevents double-restore in concurrent requests) → emit `SaveRestored` event (fire-and-forget) → return 200 with restored save
    - If neither active nor soft-deleted save found (orphaned marker — data anomaly): log error with `requestId` for investigation and return 500 `INTERNAL_ERROR` with message `'Save state inconsistency detected'`
  - [ ] 2.7 Emit events using `emitEvent` from `@ai-learning-hub/events` as **fire-and-forget** (`void emitEvent(...)` — do NOT await); `emitEvent` catches and logs its own errors internally; calling code returns the API response immediately without waiting for event delivery. See Dev Notes — EventBridge for the exact call site.
  - [ ] 2.8 Export `handler = wrapHandler(savesCreateHandler, { requireAuth: true })`

- [ ] Task 3: Create EventBridge CDK stack (AC: #4)
  - [ ] 3.1 Create `infra/lib/stacks/core/events.stack.ts` with a custom `EventBus` named `ai-learning-hub-events`
  - [ ] 3.2 Export `eventBus` as a public property; output `EventBusName` and `EventBusArn` as CloudFormation exports
  - [ ] 3.3 Pass `EVENT_BUS_NAME` env var to saves-create Lambda (set to `eventBus.eventBusName`)

- [ ] Task 4: Wire saves-create Lambda in CDK (AC: #7)
  - [ ] 4.1 Create `infra/lib/stacks/api/saves-routes.stack.ts` containing the saves-create Lambda (`NodejsFunction`)
  - [ ] 4.2 Lambda config: `memorySize: 256`, `timeout: 10s`, `tracing: ACTIVE`, env vars `SAVES_TABLE_NAME` + `EVENT_BUS_NAME`
  - [ ] 4.3 Grant IAM permissions: `savesTable.grantReadWriteData(savesCreateFunction)` (saves CRUD) + `usersTable.grantReadWriteData(savesCreateFunction)` (**required** — `enforceRateLimit` writes counter items to the users table) + `events:PutEvents` on the event bus ARN via an `iam.PolicyStatement`
  - [ ] 4.4 Register route in `infra/config/route-registry.ts`: `{ path: '/saves', methods: ['POST'], authType: 'jwt-or-apikey', handlerRef: 'savesCreateFunction', epic: 'Epic-3' }`
  - [ ] 4.5 Extend `HandlerRef` union type to include `'savesCreateFunction'`
  - [ ] 4.6 Wire the route in `infra/lib/stacks/api/saves-routes.stack.ts` following the auth-routes pattern (add API Gateway resource + method pointing at the Lambda)
  - [ ] 4.7 Update `infra/bin/app.ts` to instantiate `EventsStack` and `SavesRoutesStack`; pass `savesTable` **and** `usersTable` from `TablesStack` as props to `SavesRoutesStack` so Task 4.3 grants are possible

- [ ] Task 5: Write comprehensive tests (AC: all)
  - [ ] 5.1 Unit tests: create handler — 201 on fresh URL, 409 on active duplicate (both Layer 1 fast-path and Layer 2 transaction failure paths), 200 auto-restore on re-save-after-delete, 400 invalid URL, 400 embedded credentials URL, tags trimmed+deduplicated on create
  - [ ] 5.2 Integration test: EventBridge event emitted includes `normalizedUrl`, `urlHash`, `contentType` — mock `@ai-learning-hub/events` and verify `emitEvent` was called with correct `source`, `detailType`, and `detail` fields
  - [ ] 5.3 Test: concurrent duplicate guard — two simultaneous POST requests for same URL; verify Layer 2 TransactWriteItems ConditionExpression blocks the second write
  - [ ] 5.4 Test: EventBridge failure does NOT fail the API response — mock `PutEvents` throwing; verify 201 still returned. Then call `await flushPromises()` (defined as `new Promise(resolve => setTimeout(resolve, 0))`) before asserting `logger.warn` was called with the EventBridge error. The async work runs in a detached IIFE; the event loop must advance before side effects are visible. Do NOT use `vi.runAllMicrotasksAsync()` — it does not exist in Vitest 3.x.
  - [ ] 5.5 Test: `SAVES_TABLE_CONFIG` reads from `process.env.SAVES_TABLE_NAME`
  - [ ] 5.6 Architecture enforcement tests (T1–T4 in `infra/test/stacks/api/route-registry.test.ts`) must continue to pass after adding new route entry

- [ ] Task 6: Verify build and quality gates
  - [ ] 6.1 `npm test` — all tests pass (including existing 1,243 tests from 3.1a + new tests)
  - [ ] 6.2 `npm run lint` — no errors
  - [ ] 6.3 `npm run build` — clean TypeScript compilation
  - [ ] 6.4 `npm run type-check` — no type errors
  - [ ] 6.5 Verify `npm run format` has been run on all changed files

## Dev Notes

### Critical: Modules From Story 3.1a (DO NOT Reinvent)

Story 3.1a is done (PR #156). Import everything directly from `@ai-learning-hub/validation`:

```typescript
import {
  normalizeUrl,
  detectContentType,
  createSaveSchema,
  validateJsonBody,
  NormalizeError,
} from '@ai-learning-hub/validation';
```

`normalizeUrl(rawUrl)` returns `{ normalizedUrl: string, urlHash: string }` or throws `NormalizeError` (which maps to `VALIDATION_ERROR`).

`detectContentType(url, userProvidedContentType?)` returns the `ContentType` — user-provided value always wins.

`createSaveSchema` validates the request body: `{ url, title?, userNotes?, contentType?, tags? }`.

### Full Save Item Shape

```typescript
const saveItem = {
  PK: `USER#${userId}`,
  SK: `SAVE#${saveId}`,           // ULID — sort-friendly, chronological
  userId,
  saveId,
  url,                             // original URL as submitted
  normalizedUrl,                   // from normalizeUrl()
  urlHash,                         // SHA-256 of normalizedUrl, from normalizeUrl()
  ...(body.title !== undefined && { title: body.title }),
  ...(body.userNotes !== undefined && { userNotes: body.userNotes }),
  contentType,                     // from detectContentType() or user-provided
  tags: body.tags ?? [],
  isTutorial: false,
  // tutorialStatus is intentionally OMITTED (not set to null) so this item is not
  // projected into the userId-tutorialStatus-index GSI, keeping the GSI clean.
  linkedProjectCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### Uniqueness Marker Item

```typescript
const markerItem = {
  PK: `USER#${userId}`,
  SK: `URL#${urlHash}`,           // NOT SAVE# — different SK prefix prevents collision with save item
};
```

The marker is NEVER removed (not on soft-delete, not on restore). It permanently occupies the URL slot for this user. This ensures Layer 2 always blocks a second concurrent create for the same URL.

### ULID Usage

```typescript
import { ulid } from 'ulid';
const saveId = ulid();
```

`ulid` is already in the workspace (check `package.json` at root; it was added for Epic 1 or 2). If missing: `npm install ulid`.

### DynamoDB Table Config Pattern

Follow the existing pattern from `@ai-learning-hub/db`:

```typescript
import { type TableConfig } from '@ai-learning-hub/db';

const SAVES_TABLE_CONFIG: TableConfig = {
  tableName: process.env.SAVES_TABLE_NAME ?? 'ai-learning-hub-saves',
  partitionKey: 'PK',
  sortKey: 'SK',
};
```

The saves table is `ai-learning-hub-saves` (confirmed in `infra/lib/stacks/core/tables.stack.ts` line 46).

### TransactWriteItems — New Helper Required

The `@ai-learning-hub/db` package does NOT currently export `transactWriteItems`. You MUST add it (Task 1) before using it in the handler. Do NOT use the DynamoDB SDK directly in the handler — that violates the import-guard rule.

The helper signature should be:

```typescript
export async function transactWriteItems(
  client: DynamoDBDocumentClient,
  transactItems: TransactWriteCommandInput['TransactItems'],
  logger?: Logger
): Promise<void>
```

Import `TransactWriteCommand`, `TransactWriteCommandInput` from `@aws-sdk/lib-dynamodb`. Handle `TransactionCanceledException` from `@aws-sdk/client-dynamodb` — the `CancellationReasons` array tells you which item failed (index 0 = save item, index 1 = marker item).

### Two-Layer Duplicate Detection Flow

```
POST /saves
    │
    ▼
[Validate body with createSaveSchema]
    │
    ▼
[normalizeUrl(url)] → NormalizeError → 400 VALIDATION_ERROR
    │
    ▼
[detectContentType(url, body.contentType)]
    │
    ▼
[Layer 1: Query urlHash-index GSI (active saves only)]
  ├── active save found → return 409 with existingSave
  └── no active save found → continue to Layer 2
    │
    ▼
[Layer 2: TransactWriteItems (save + marker)]
  ├── success → void emitSaveCreatedEvent(...) → return 201
  └── TransactionCanceledException (marker exists)
        │
        ▼
      [Re-query urlHash-index GSI for active save]
        ├── active save found → return 409 with existingSave
        └── no active save found (was soft-deleted or anomaly)
              │
              ▼
            [Re-query urlHash-index GSI WITHOUT deletedAt filter]
              ├── soft-deleted save found
              │     → UpdateItem REMOVE deletedAt (ConditionExpression: attribute_exists(deletedAt))
              │     → void emitSaveRestoredEvent(...)
              │     → return 200 with restored save
              └── no save found at all (orphaned marker — data anomaly)
                    → log error with requestId
                    → return 500 INTERNAL_ERROR
```

### Layer 1: GSI Query

```typescript
// Layer 1 — active saves only (filter by userId + no deletedAt)
const layer1Result = await queryItems<SaveItem>(client, SAVES_TABLE_CONFIG, {
  keyConditionExpression: 'urlHash = :urlHash',
  expressionAttributeValues: {
    ':urlHash': urlHash,
    ':pk': `USER#${userId}`,  // REQUIRED — FilterExpression references :pk
  },
  filterExpression: 'PK = :pk AND attribute_not_exists(deletedAt)',
  expressionAttributeNames: undefined,
  indexName: 'urlHash-index',
});

// Re-query for soft-deleted save (same GSI, without the deletedAt filter)
const softDeletedResult = await queryItems<SaveItem>(client, SAVES_TABLE_CONFIG, {
  keyConditionExpression: 'urlHash = :urlHash',
  expressionAttributeValues: {
    ':urlHash': urlHash,
    ':pk': `USER#${userId}`,
  },
  filterExpression: 'PK = :pk AND attribute_exists(deletedAt)',
  expressionAttributeNames: undefined,
  indexName: 'urlHash-index',
});
```

Note: The GSI has ALL projection so `deletedAt` and `PK` are projected. `attribute_not_exists(deletedAt)` / `attribute_exists(deletedAt)` work correctly in FilterExpression against GSI items. **Known limitation:** For globally popular URLs saved by thousands of users, the GSI page (up to ~1MB) may not contain this user's row on the first DynamoDB page. In that case Layer 1 returns empty and the request falls through to Layer 2 — correctness is preserved (Layer 2 TransactWriteItems blocks the duplicate via the marker), but the fast-path 409 with `existingSave` body becomes a slower-path 409 without `existingSave`. This is an accepted trade-off at boutique scale (< 100 users). If this becomes an issue at scale, replace with a targeted main-table GetItem using `PK=USER#<userId>, SK=URL#<urlHash>` to detect the marker, then fetch the save separately.

### Layer 2: TransactWriteItems

```typescript
await transactWriteItems(client, [
  {
    Put: {
      TableName: SAVES_TABLE_CONFIG.tableName,
      Item: saveItem,
    },
  },
  {
    Put: {
      TableName: SAVES_TABLE_CONFIG.tableName,
      Item: markerItem,
      ConditionExpression: 'attribute_not_exists(SK)',
    },
  },
], logger);
```

Only the MARKER item needs the ConditionExpression — the save item write is unconditional (ULID guarantees uniqueness of `SK=SAVE#<ulid>`).

### Auto-Restore: UpdateItem with ConditionExpression

Use a conditional update to prevent concurrent requests both emitting `SaveRestored`:

```typescript
// Only the first concurrent restore wins; others get ConditionalCheckFailed (ignored)
await updateItem(client, SAVES_TABLE_CONFIG, {
  key: { PK: `USER#${userId}`, SK: softDeleted.SK },
  updateExpression: 'REMOVE deletedAt SET updatedAt = :now',
  expressionAttributeValues: { ':now': new Date().toISOString() },
  conditionExpression: 'attribute_exists(deletedAt)',  // guard against double-restore
  returnValues: 'ALL_NEW',
}, logger);
```

The `ConditionExpression: attribute_exists(deletedAt)` ensures that only one concurrent POST wins the restore. If a second concurrent request also tries to restore, `updateItem` throws (which the existing `updateItem` helper maps to `NOT_FOUND` via `ConditionalCheckFailedException`) — catch it and treat as success (the URL is now active in the library, which is the user's intent).

### EventBridge — Using @ai-learning-hub/events

No EventBridge CDK stack exists yet. You need to create one (Task 3). The event bus name should be `ai-learning-hub-events` (default custom bus).

**Lambda-side PutEvents** — import `emitEvent` and `getDefaultClient` from `@ai-learning-hub/events` (created in Story 3.1c, which this story depends on). `emitEvent` returns `void` — **do not prefix with `void` and do not `await` it**; the fire-and-forget contract is enforced by the return type.

```typescript
import {
  emitEvent,
  getDefaultClient,
  SAVES_EVENT_SOURCE,
  type SavesEventDetailType,
  type SavesEventDetail,
} from '@ai-learning-hub/events';

// Fail loudly at Lambda cold-start if env var is missing — per architecture-guard rule
// (hardcoding real resource names in application code is prohibited).
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;
if (!EVENT_BUS_NAME) throw new Error('EVENT_BUS_NAME env var is not set');

// Module-level singleton — reused across warm invocations
const ebClient = getDefaultClient();

// Synchronous call — returns void immediately; async work is detached
emitEvent<SavesEventDetailType, SavesEventDetail>(ebClient, EVENT_BUS_NAME, {
  source: SAVES_EVENT_SOURCE,              // const — no magic string drift
  detailType: 'SaveCreated',               // compile error if not in SavesEventDetailType
  detail: { userId, saveId, url, normalizedUrl, urlHash, contentType },
}, logger);
return createSuccessResponse(toPublicSave(saved), requestId, 201);
```

`emitEvent` catches and logs its own errors internally — callers never need a try/catch. The `@aws-sdk/client-eventbridge` package is an `externalModule` in CDK bundling (available in the Lambda runtime); no local install needed.

### SaveRestored Event Shape

`SaveRestored` uses the same `emitEvent` call with `detailType: 'SaveRestored'` and an identical detail shape:

```typescript
emitEvent<SavesEventDetailType, SavesEventDetail>(ebClient, EVENT_BUS_NAME, {
  source: SAVES_EVENT_SOURCE,
  detailType: 'SaveRestored',
  detail: {
    userId, saveId: softDeleted.saveId, url: softDeleted.url,
    normalizedUrl: softDeleted.normalizedUrl, urlHash: softDeleted.urlHash,
    contentType: softDeleted.contentType,
  },
}, logger);
```

Downstream consumers (Epic 9 enrichment pipeline, Epic 7 search index sync) should treat `SaveRestored` identically to `SaveCreated` — re-enqueue the URL for enrichment and re-add to search index.

### 409 Response Shape (ADR-008 compliant)

Define `toPublicSave` inline in `backend/functions/saves/handler.ts` — it does NOT exist in any shared package yet:

```typescript
/** Strip internal DynamoDB keys before returning a save to the API caller. */
function toPublicSave(item: SaveItem) {
  const { PK, SK, ...rest } = item;  // omit DynamoDB keys
  return rest;
}

// 409 response — existingSave is a SIBLING of error, not nested inside it
return {
  statusCode: 409,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    error: {
      code: 'DUPLICATE_SAVE',
      message: 'URL already saved',
      requestId,
    },
    existingSave: toPublicSave(existingSave),
  }),
};
```

The `error` object must be ADR-008-compliant (`{ code, message, requestId }`). `existingSave` lives alongside `error` at the top level — NOT nested inside it.

### Rate Limiting (Inherited from Epic 2)

The `wrapHandler` middleware from `@ai-learning-hub/middleware` does NOT automatically enforce rate limiting. Rate limiting must be called explicitly using `enforceRateLimit` from `@ai-learning-hub/db`:

```typescript
import { enforceRateLimit, USERS_TABLE_CONFIG } from '@ai-learning-hub/db';

// Inside handler, after auth:
await enforceRateLimit(client, USERS_TABLE_CONFIG.tableName, {
  operation: 'saves-create',
  identifier: userId,
  limit: 200,         // 200 saves per hour — saves is a core daily action (vs 10/hr for api-key creation)
  windowSeconds: 3600,
}, logger);
```

**Rate limit value rationale:** No story file exists for Story 2.7 to cross-reference. Based on the existing implemented limits — `api-key-create` uses 10/hour (sensitive, infrequent) and `invite-code-generate` uses 5/day (very infrequent) — `saves-create` is a core high-frequency action; 200/hour is a reasonable V1 limit that prevents abuse while not blocking power users. If the Story 2.7 implementation established a different value (e.g. via a rate-limits config file), use that value instead. **Consider creating `backend/shared/db/src/rate-limits.ts`** to define all rate limit constants in one place rather than scattering magic numbers across handlers.

### Route Registry Update

Add to `infra/config/route-registry.ts`:

1. Extend the `HandlerRef` type:
```typescript
export type HandlerRef =
  | "validateInviteFunction"
  | "usersMeFunction"
  | "apiKeysFunction"
  | "generateInviteFunction"
  | "savesCreateFunction";   // ADD THIS
```

2. Add to `ROUTE_REGISTRY`:
```typescript
{
  path: '/saves',
  methods: ['POST'],
  authType: 'jwt-or-apikey',
  handlerRef: 'savesCreateFunction',
  epic: 'Epic-3',
},
```

The architecture enforcement tests in `infra/test/stacks/api/route-registry.test.ts` (from Story 2.1-D5) validate the registry against CDK resources. They will fail until the CDK stack also exposes a `savesCreateFunction` property that matches.

### Architecture Compliance

| ADR | How This Story Complies |
|-----|-------------------------|
| ADR-001 (DynamoDB) | `PK=USER#<userId>`, `SK=SAVE#<ULID>`, marker `SK=URL#<urlHash>` all follow documented key patterns |
| ADR-003 (EventBridge) | `SaveCreated` emitted after successful write; `SaveRestored` emitted on auto-restore; non-throwing emission |
| ADR-005 (No L2L) | No Lambda invocations; EventBridge for async |
| ADR-008 (Error Handling) | All errors use `{ error: { code, message, requestId } }`; 409 adds `existingSave` as sibling field |
| ADR-014 (API-First) | `POST /saves` returns 201 with save object; pagination deferred to 3.2 |
| ADR-016 (Cold Starts) | NFR-P2 claim qualified as "warm invocation" |

### Testing Standards

- **Framework:** Vitest (used by all backend packages — check `backend/functions/api-keys/handler.test.ts` for the pattern)
- **Coverage:** 80% minimum (CI-enforced)
- **Mock pattern:** Use the shared `wrapHandler` mock utility added in Story 2.1-D3: `backend/shared/middleware/test/mock-wrapper.ts`. Check `backend/functions/api-keys/handler.test.ts` for the import and usage pattern.
- **EventBridge mock:** Mock `@ai-learning-hub/events` using `vi.mock('@ai-learning-hub/events')` and assert `emitEvent` was called with the correct `source`, `detailType`, and `detail` shape. Do NOT mock `@aws-sdk/client-eventbridge` directly — that is tested in the `@ai-learning-hub/events` package itself.
- **TransactWriteItems mock:** Mock the new `transactWriteItems` helper from `@ai-learning-hub/db` — test both success and `TransactionCanceledException` paths
- **DynamoDB mock:** Use `vi.mock('@ai-learning-hub/db')` to mock `queryItems`, `transactWriteItems`, `updateItem`

### Project Structure Notes

- New Lambda handler: `backend/functions/saves/handler.ts` (directory already exists with `.gitkeep`)
- New db helper: `backend/shared/db/src/transact.ts` (add to existing package)
- New CDK stack: `infra/lib/stacks/core/events.stack.ts`
- New CDK stack: `infra/lib/stacks/api/saves-routes.stack.ts`
- Modified: `infra/config/route-registry.ts` (add route + extend HandlerRef)
- Modified: `infra/bin/app.ts` (instantiate new stacks)
- Modified: `backend/shared/db/src/index.ts` (export new transact helpers)
- Do NOT create a `saves/` subdirectory under `backend/functions/saves/` — flat file, single handler handles POST /saves; separate handlers for list/get/update/delete will be added in Stories 3.2 and 3.3

### References

- [Source: docs/progress/epic-3-stories-and-plan.md#Story-3.1b] — Story definition, ACs, two-layer dedup technical notes
- [Source: _bmad-output/implementation-artifacts/3-1a-save-validation-modules.md] — Previous story outputs: `normalizeUrl`, `detectContentType`, `createSaveSchema` all exported from `@ai-learning-hub/validation`
- [Source: infra/lib/stacks/core/tables.stack.ts#SavesTable] — `ai-learning-hub-saves` table, `urlHash-index` GSI (ALL projection, `urlHash` PK)
- [Source: infra/config/route-registry.ts] — Route registry pattern and `HandlerRef` type
- [Source: backend/functions/api-keys/handler.ts] — `wrapHandler` + `enforceRateLimit` usage pattern
- [Source: backend/shared/db/src/helpers.ts] — Existing `queryItems`, `updateItem` helpers + `TableConfig` type
- [Source: backend/shared/db/src/users.ts] — `USERS_TABLE_CONFIG` pattern (env var fallback)
- [Source: backend/shared/middleware/src/index.ts] — Available middleware exports
- [Source: _bmad-output/planning-artifacts/architecture.md] — ADR-001 key patterns, ADR-003 EventBridge, ADR-008 error codes (DUPLICATE_SAVE → 409)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
