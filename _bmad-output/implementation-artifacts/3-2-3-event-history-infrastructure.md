---
id: "3.2.3"
title: "Event History Infrastructure"
status: ready-for-dev
depends_on: []
touches:
  - backend/shared/types/src/entities
  - backend/shared/db/src/operations
  - backend/shared/db/test/operations
  - backend/shared/middleware/src/handlers
  - backend/shared/middleware/test/handlers
  - infra/lib/stacks/core
  - infra/test/stacks/core
risk: low
---

# Story 3.2.3: Event History Infrastructure

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer building agent-native APIs,
I want a shared event history infrastructure that records state changes per entity with actor attribution,
so that all domain entities can expose queryable event history endpoints for audit, debugging, and agent reconciliation after failures.

## Acceptance Criteria

### AC1: Events DynamoDB Table

**Given** the CDK infrastructure is deployed
**When** the events table is provisioned
**Then** it has:

- PK: string (`EVENTS#{entityType}#{entityId}`)
- SK: string (`EVENT#{timestamp}#{eventId}`)
- TTL attribute: `ttl` (number, epoch seconds)
- Billing: PAY_PER_REQUEST
- Point-in-time recovery: enabled
- Encryption: AWS_MANAGED
- Table name exported as CfnOutput

### AC2: Event Record Schema

**Given** an event is recorded via `recordEvent()`
**When** stored in the events table
**Then** the item contains:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `PK` | string | yes | `EVENTS#{entityType}#{entityId}` |
| `SK` | string | yes | `EVENT#{timestamp}#{eventId}` |
| `eventId` | string (ULID) | yes | Auto-generated |
| `entityType` | string | yes | `save`, `project`, `tutorial`, `link`, `user`, `apiKey` |
| `entityId` | string | yes | ID of the affected entity |
| `userId` | string | yes | Owner of the entity |
| `eventType` | string | yes | PascalCase `{EntityType}{PastTenseVerb}` — e.g., `SaveCreated`, `SaveUpdated`, `SaveDeleted`, `ProjectStatusTransitioned`, `ApiKeyRevoked` |
| `actorType` | `human` \| `agent` | yes | Who performed the action |
| `actorId` | string \| null | no | Agent ID if `actorType === 'agent'` |
| `timestamp` | string (ISO 8601) | yes | Auto-generated |
| `changes` | object \| null | no | Minimal diff of changed fields only: `{ before: { title: "old" }, after: { title: "new" } }`. If full before/after exceeds 10KB, log WARN and fall back to `{ changedFields: ['title', 'tags'] }` |
| `context` | object \| null | no | `{ trigger, source, confidence, upstream_ref }` |
| `requestId` | string | yes | Correlation ID from the originating request |
| `ttl` | number | yes | Epoch seconds, 90 days from creation (auto-calculated) |

### AC3: `recordEvent()` Shared Utility

**Given** `@ai-learning-hub/db` is imported
**When** a handler calls `recordEvent(client, params, logger)`
**Then** the function:

- Generates `eventId` as ULID
- Generates `timestamp` as ISO 8601 now
- Calculates `ttl` as `Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60`
- Constructs PK/SK from `entityType` + `entityId` + `timestamp` + `eventId`
- Writes to the events table via `putItem()`
- Returns the created event record
- Validates required fields via Zod schema before writing
- Logs the write at INFO level
- **Fire-and-forget design:** `recordEvent()` is non-critical. Callers MUST wrap in try/catch and log failures at WARN level without re-throwing. Event recording must never block or fail the primary operation (same pattern as EventBridge emission in saves handlers)

### AC4: `queryEntityEvents()` Shared Utility

**Given** `@ai-learning-hub/db` is imported
**When** a handler calls `queryEntityEvents(client, entityType, entityId, options, logger)`
**Then** the function:

- Queries PK `EVENTS#{entityType}#{entityId}` with `ScanIndexForward=false` (newest first)
- If `options.since` provided and is valid ISO 8601: adds SK condition `SK > EVENT#{since}` to return only events after that timestamp
- If `options.since` provided and is NOT valid ISO 8601: throws `VALIDATION_ERROR` with `{ field: 'since', message: 'Must be ISO 8601 format' }`
- If `options.limit` provided: uses it (default 50, capped at 200)
- If `options.cursor` provided: decodes opaque base64url cursor to `ExclusiveStartKey`
- Returns `{ events: EntityEvent[], nextCursor: string | null }` where `nextCursor` is base64url-encoded `LastEvaluatedKey` or `null` if no more pages

### AC5: `createEventHistoryHandler()` Generator

**Given** `@ai-learning-hub/middleware` is imported
**When** a domain module calls `createEventHistoryHandler(config)` where config includes `entityType`, `entityExistsFn`, and `client` (DynamoDB DocumentClient)
**Then** it returns a `wrapHandler`-compatible handler that:

- Extracts `entityId` from path parameters
- Calls `entityExistsFn(userId, entityId)` to verify the entity belongs to the user (throws `NOT_FOUND` if not). The function MUST return `true` for both active AND soft-deleted entities — event history must remain accessible for deleted entities for debugging and agent reconciliation
- Parses query parameters: `since` (ISO 8601), `limit` (number), `cursor` (string)
- Calls `queryEntityEvents()` with parsed options
- Returns response in envelope format: `{ data: EntityEvent[], meta: { count, nextCursor, hasMore } }`

### AC6: 90-Day TTL Retention

**Given** events stored in the events table
**When** 90 days have passed since creation
**Then** DynamoDB TTL automatically deletes the expired records with no application-level cleanup

### AC7: Query Performance

**Given** an entity with up to 1000 events
**When** `GET /:entity/:id/events` is called
**Then** the response returns within 1 second (NFR-AN4: single-entity event query < 1s)

### AC8: Unit Test Coverage

All new code achieves ≥80% coverage. Required test scenarios by module:

**`recordEvent()` tests:**
- Writes correct PK/SK structure given entityType + entityId
- Auto-generates ULID for eventId (valid ULID format, monotonically increasing)
- Auto-generates ISO 8601 timestamp
- Calculates TTL as epoch seconds 90 days from now (±1s tolerance)
- Validates required fields via Zod — rejects missing `entityType`, `entityId`, `userId`, `eventType`, `actorType`, `requestId`
- Rejects invalid `entityType` not in the allowed union
- Rejects invalid `actorType` not in `['human', 'agent']`
- Logs at INFO level on successful write
- Logs at WARN level on DynamoDB write failure (does NOT throw)
- Accepts null `changes`, `context`, `actorId`
- Truncates `changes` to field names when diff exceeds 10KB

**`queryEntityEvents()` tests:**
- Queries correct PK given entityType + entityId
- Returns events newest-first (ScanIndexForward=false)
- Applies `since` filter as SK condition when valid ISO 8601
- Throws VALIDATION_ERROR when `since` is not valid ISO 8601 (e.g. `"yesterday"`, `"2026-13-01"`)
- Defaults limit to 50 when not provided
- Caps limit at 200 when caller passes higher value
- Encodes LastEvaluatedKey as base64url cursor
- Decodes cursor to ExclusiveStartKey on subsequent call
- Returns `nextCursor: null` when no LastEvaluatedKey (last page)
- Returns empty array for entity with no events

**`createEventHistoryHandler()` tests:**
- Returns 404 NOT_FOUND when `entityExistsFn` returns false
- Calls `entityExistsFn` with userId from auth context and entityId from path params
- Passes `since`, `limit`, `cursor` query params to `queryEntityEvents()`
- Returns events in envelope format `{ data, meta: { count, nextCursor, hasMore } }`
- Returns 400 VALIDATION_ERROR for non-ISO `since` parameter
- Returns empty data array with hasMore=false for entity with no events
- Works for soft-deleted entities (entityExistsFn returns true)

**CDK assertion tests:**
- Events table has PK=string (partitionKey), SK=string (sortKey)
- TTL attribute is `ttl`
- Billing mode is PAY_PER_REQUEST
- PITR is enabled
- Table name exported as CfnOutput
- Removal policy is RETAIN

## Tasks / Subtasks

- [ ] Task 1 — CDK: Add events DynamoDB table (AC: 1, 6)
  - [ ] 1.1 Add `EventsTable` to `infra/lib/stacks/core/tables.stack.ts`
  - [ ] 1.2 Configure PK/SK, TTL attribute `ttl`, PAY_PER_REQUEST, PITR, encryption
  - [ ] 1.3 Export table name and ARN via `CfnOutput`
  - [ ] 1.4 Add CDK assertion tests in `infra/test/`

- [ ] Task 2 — Types: Define event types in `@ai-learning-hub/types` (AC: 2)
  - [ ] 2.1 Create `backend/shared/types/src/entities/events.ts`
  - [ ] 2.2 Add `EntityEvent` interface, `EventEntityType` union, `ActorType` union
  - [ ] 2.3 Add `RecordEventParams` input interface (omitting auto-generated fields)
  - [ ] 2.4 Add `EventHistoryQueryOptions` and `EventHistoryResponse` interfaces
  - [ ] 2.5 Export from `backend/shared/types/src/index.ts` barrel

- [ ] Task 3 — DB: Implement event history utilities in `@ai-learning-hub/db` (AC: 3, 4)
  - [ ] 3.1 Add `EVENTS_TABLE_CONFIG` to table config file
  - [ ] 3.2 Create `backend/shared/db/src/operations/events.ts`
  - [ ] 3.3 Implement `recordEvent()` with ULID, timestamp, TTL auto-generation
  - [ ] 3.4 Implement `queryEntityEvents()` with since/limit/cursor support
  - [ ] 3.5 Add Zod validation schema for `RecordEventParams`
  - [ ] 3.6 Export from `backend/shared/db/src/index.ts` barrel
  - [ ] 3.7 Write unit tests in `backend/shared/db/test/operations/events.test.ts`

- [ ] Task 4 — Middleware: Implement handler generator (AC: 5)
  - [ ] 4.1 Create `backend/shared/middleware/src/handlers/event-history.ts`
  - [ ] 4.2 Implement `createEventHistoryHandler({ entityType, entityExistsFn, client })` returning a `wrapHandler`-compatible function
  - [ ] 4.3 Add query parameter parsing and validation (`since`, `limit`, `cursor`)
  - [ ] 4.4 Export from `backend/shared/middleware/src/index.ts` barrel
  - [ ] 4.5 Write unit tests in `backend/shared/middleware/test/handlers/event-history.test.ts`

- [ ] Task 5 — CDK wiring for future consumers (AC: 1)
  - [ ] 5.1 Add `EVENTS_TABLE_NAME` to the environment variable registry in `infra/README.md` (or existing env var docs) so API stacks know to include it when wiring Lambdas in 3.2.7/3.2.8
  - [ ] 5.2 Export `eventsTable` and its `grantReadWriteData()` method from the tables stack so API stacks can grant permissions without importing the table construct directly

- [ ] Task 6 — Quality gates (AC: 8)
  - [ ] 6.1 Run `npm test` — all tests pass with ≥80% coverage on new files
  - [ ] 6.2 Run `npm run lint` — no errors
  - [ ] 6.3 Run `npm run build` — no TypeScript errors
  - [ ] 6.4 Run `npm run type-check` — passes

## Dev Notes

### Architecture Overview

This story builds the **shared event history infrastructure** for Epic 3.2 (Agent-Native API Foundation). It implements FR102 and NFR-AN4. All domain entities (saves, projects, tutorials, links, user) will use this infrastructure to expose queryable event history endpoints.

**Scope boundary:** This story delivers infrastructure only — the DynamoDB table, shared utilities, and handler generator. No existing handlers are modified to record or expose events. That happens in:
- Story 3.2.7 (Saves Domain Retrofit) — wires saves handlers to record events and adds `GET /saves/:id/events`
- Story 3.2.8 (Auth Domain Retrofit) — wires auth handlers similarly

### DynamoDB Events Table Design

```
Table: events (8th table — extends ADR-001 multi-table design)

PK: EVENTS#{entityType}#{entityId}
    Examples: "EVENTS#save#01ARZ3NDEKTSV4RRFFQ69G5FAV"
              "EVENTS#project#01ARZ3NDEKTSV4RRFFQ69G5FAV"

SK: EVENT#{timestamp}#{eventId}
    Examples: "EVENT#2026-02-25T12:00:00.000Z#01ARZ3NDEKTSV4RRFFQ69G5FAV"

TTL: ttl (epoch seconds — 90 days from event creation)
```

**Why this key design:**

| Design choice | Rationale |
|--------------|-----------|
| PK groups by entity | Single query retrieves full history for one entity |
| Timestamp in SK prefix | Enables `?since=` via `SK > EVENT#{isoTimestamp}` key condition |
| ULID suffix in SK | Guarantees uniqueness even for simultaneous events on same entity |
| Separate table (not in saves/projects) | TTL applies table-wide; events span ALL entity types; isolation from entity CRUD |
| PAY_PER_REQUEST | Event volume is low at boutique scale; no capacity planning needed |

**No GSIs needed** — the only access pattern is "get events for entity X" which the PK handles directly.

### Event Type Naming Convention

All event types MUST use PascalCase `{EntityType}{PastTenseVerb}` format:

| Entity | Event Types |
|--------|-------------|
| save | `SaveCreated`, `SaveUpdated`, `SaveDeleted`, `SaveRestored`, `SaveMetadataUpdated` |
| project | `ProjectCreated`, `ProjectUpdated`, `ProjectDeleted`, `ProjectStatusTransitioned` |
| apiKey | `ApiKeyCreated`, `ApiKeyRevoked`, `ApiKeyUsed` |
| tutorial | `TutorialStarted`, `TutorialCompleted` |

Define a `KNOWN_EVENT_TYPES` record per domain in `@ai-learning-hub/types`. Not enforced at write time in V1 (domains may add new types), but validated in tests to catch typos.

### `apiKey` as Entity Type

`apiKey` is a valid entity type because API keys have their own lifecycle (created, revoked, last-used) independent of the user profile. Event history for `entityType: 'apiKey'` uses the key ID as `entityId`, not the user ID. When 3.2.8 (auth retrofit) implements event recording, it should use `apiKey` for key-specific events and `user` for profile-level events.

### Existing Codebase Patterns — MUST Follow

**Table config pattern** (`backend/shared/db/src/config.ts`):

```typescript
export const EVENTS_TABLE_CONFIG: TableConfig = {
  tableName: requireEnv("EVENTS_TABLE_NAME", "dev-ai-learning-hub-events"),
  partitionKey: "PK",
  sortKey: "SK",
};
```

**DB operation pattern** (`backend/shared/db/src/operations/*.ts`):

```typescript
export async function recordEvent(
  client: DynamoDBDocumentClient,
  params: RecordEventParams,
  logger?: Logger
): Promise<EntityEvent> { ... }
```

All DB functions accept an optional `Logger` parameter (established in PR #151). Use `putItem()` and `queryItems()` from the existing `@ai-learning-hub/db` helpers.

**Handler pattern** (`backend/shared/middleware/src/`):

The handler generator must return a function compatible with `wrapHandler()`:

```typescript
export function createEventHistoryHandler(config: {
  entityType: EventEntityType;
  entityExistsFn: (userId: string, entityId: string) => Promise<boolean>;
  client: DynamoDBDocumentClient;
}) {
  return async function eventHistoryHandler(ctx: HandlerContext) {
    // ...
  };
}
```

Consumers wire it like:

```typescript
// In saves handler (done in story 3.2.7, not this story)
export const savesEventsHandler = wrapHandler(
  createEventHistoryHandler({
    entityType: "save",
    entityExistsFn: async (userId, saveId) => {
      const save = await getSave(client, userId, saveId, { includeSoftDeleted: true });
      return save !== null;
    },
    client,
  }),
  { requireAuth: true }
);
```

**Error codes** (from `@ai-learning-hub/types`): Use `ErrorCode.NOT_FOUND` for missing entities, `ErrorCode.VALIDATION_ERROR` for bad query params.

**CDK table pattern** (`infra/lib/stacks/core/tables.stack.ts`): Follow the exact pattern used for the saves, projects, and other tables. Use `TableV2`, `Billing.payPerRequest()`, enable PITR, set removal policy to `RETAIN`.

### Events vs EventBridge — Two Different Concepts

The codebase has two distinct event systems:

| System | Package | Purpose | Storage |
|--------|---------|---------|---------|
| EventBridge events | `@ai-learning-hub/events` | Real-time event routing to consumers (enrichment pipeline, search sync) | Transient (EventBridge + CloudWatch Logs) |
| Event history (this story) | `@ai-learning-hub/db` | Per-entity queryable audit log for agents and debugging | DynamoDB with 90-day TTL |

They are complementary. A `SaveCreated` EventBridge event triggers enrichment. A `SaveCreated` event history record lets an agent query "what happened to this save?" later.

### Cursor Pagination Pattern

Encode `LastEvaluatedKey` as opaque base64url cursor:

```typescript
function encodeCursor(lastEvaluatedKey: Record<string, any>): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64url");
}

function decodeCursor(cursor: string): Record<string, any> {
  return JSON.parse(Buffer.from(cursor, "base64url").toString());
}
```

This aligns with the cursor pagination pattern in story 3.2.5. If 3.2.5 lands first and establishes a shared cursor utility, use that instead. If this story lands first, place the cursor helpers in `@ai-learning-hub/db` so 3.2.5 can reuse them.

### Response Format

Until story 3.2.2 (error contract & response envelope) establishes the canonical envelope, use this shape:

```typescript
{
  data: EntityEvent[],
  meta: {
    count: number,       // items in this page
    nextCursor: string | null,
    hasMore: boolean
  }
}
```

Adapt to the 3.2.2 envelope once it lands. This shape is intentionally compatible with the planned `{ data, meta: { cursor, total, rate_limit }, links: { self, next } }` envelope.

### Response Examples

**`recordEvent()` input (what the caller provides):**
```json
{
  "entityType": "save",
  "entityId": "01HX4Z3NDEKTSV4RRFFQ69G5FAV",
  "userId": "user_2abc123",
  "eventType": "SaveCreated",
  "actorType": "human",
  "actorId": null,
  "changes": null,
  "context": null,
  "requestId": "req-550e8400-e29b"
}
```

**Resulting DynamoDB item (auto-generated fields added):**
```json
{
  "PK": "EVENTS#save#01HX4Z3NDEKTSV4RRFFQ69G5FAV",
  "SK": "EVENT#2026-02-25T12:00:00.000Z#01HX5A7BEKTSV4RRFFQ69G5FBW",
  "eventId": "01HX5A7BEKTSV4RRFFQ69G5FBW",
  "entityType": "save",
  "entityId": "01HX4Z3NDEKTSV4RRFFQ69G5FAV",
  "userId": "user_2abc123",
  "eventType": "SaveCreated",
  "actorType": "human",
  "actorId": null,
  "changes": null,
  "context": null,
  "requestId": "req-550e8400-e29b",
  "timestamp": "2026-02-25T12:00:00.000Z",
  "ttl": 1748174400
}
```

**`GET /saves/01HX4Z.../events` — success response (first page):**
```json
{
  "data": [
    {
      "eventId": "01HX5A7BEKTSV4RRFFQ69G5FBW",
      "entityType": "save",
      "entityId": "01HX4Z3NDEKTSV4RRFFQ69G5FAV",
      "eventType": "SaveUpdated",
      "actorType": "agent",
      "actorId": "claude-code-v1",
      "timestamp": "2026-02-25T14:30:00.000Z",
      "changes": { "before": { "title": "Old Title" }, "after": { "title": "New Title" } },
      "context": { "trigger": "bulk-update", "source": "batch-endpoint" },
      "requestId": "req-662f9511-c38a"
    },
    {
      "eventId": "01HX4Z3NDEKTSV4RRFFQ69G5FAV",
      "entityType": "save",
      "entityId": "01HX4Z3NDEKTSV4RRFFQ69G5FAV",
      "eventType": "SaveCreated",
      "actorType": "human",
      "actorId": null,
      "timestamp": "2026-02-25T12:00:00.000Z",
      "changes": null,
      "context": null,
      "requestId": "req-550e8400-e29b"
    }
  ],
  "meta": {
    "count": 2,
    "nextCursor": null,
    "hasMore": false
  }
}
```

**`GET /saves/01HX4Z.../events?since=2026-02-25T13:00:00Z&limit=10` — filtered response:**
```json
{
  "data": [
    {
      "eventId": "01HX5A7BEKTSV4RRFFQ69G5FBW",
      "eventType": "SaveUpdated",
      "actorType": "agent",
      "actorId": "claude-code-v1",
      "timestamp": "2026-02-25T14:30:00.000Z",
      "changes": { "before": { "title": "Old Title" }, "after": { "title": "New Title" } }
    }
  ],
  "meta": { "count": 1, "nextCursor": null, "hasMore": false }
}
```

**Error — entity not found (404):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Save not found",
    "requestId": "req-773a0622-d49c"
  }
}
```

**Error — invalid `since` parameter (400):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameter",
    "requestId": "req-884b1733-e5ad",
    "details": {
      "fields": [{ "field": "since", "message": "Must be ISO 8601 format", "code": "invalid_string" }]
    }
  }
}
```

### File Locations

**New files:**

| File | Package | Purpose |
|------|---------|---------|
| `backend/shared/types/src/entities/events.ts` | `@ai-learning-hub/types` | Event types and interfaces |
| `backend/shared/db/src/operations/events.ts` | `@ai-learning-hub/db` | `recordEvent()`, `queryEntityEvents()` |
| `backend/shared/db/test/operations/events.test.ts` | `@ai-learning-hub/db` | DB utility tests |
| `backend/shared/middleware/src/handlers/event-history.ts` | `@ai-learning-hub/middleware` | `createEventHistoryHandler()` |
| `backend/shared/middleware/test/handlers/event-history.test.ts` | `@ai-learning-hub/middleware` | Handler generator tests |

**Modified files:**

| File | Change |
|------|--------|
| `infra/lib/stacks/core/tables.stack.ts` | Add events table definition |
| `infra/test/stacks/core/tables.test.ts` | Add events table assertions |
| `backend/shared/types/src/index.ts` | Export event types |
| `backend/shared/db/src/index.ts` | Export event operations |
| `backend/shared/middleware/src/index.ts` | Export handler generator |

### V2 Consideration: User-Scoped Event Query

If "all events for a user" becomes a requirement, add `GSI: userId-timestamp-index` (PK: `userId`, SK: `timestamp`). Do not add preemptively — CloudWatch Logs Insights covers admin audit needs in V1. Every `recordEvent()` call logs at INFO level with structured fields including `actorId`, `entityType`, `entityId`, and `eventType`, making cross-entity queries like "what did agent X do?" a simple Logs Insights query.

### Handler Generator Escape Hatch

Domains can bypass `createEventHistoryHandler()` and call `queryEntityEvents()` directly for custom filtering needs (e.g., filter by `eventType`, include related entity events, combine events across linked entities). The generator handles the 80% case — entity-scoped history with since/limit/cursor. The utility layer (`recordEvent` + `queryEntityEvents`) is the real value; the handler generator is convenience.

### Anti-Patterns to Avoid

- **Do NOT store events in the saves or projects table.** Events get their own table for TTL isolation and cross-entity querying.
- **Do NOT use DynamoDB Streams for event history.** Streams are for triggering downstream processing; this is a queryable audit log written explicitly by handlers.
- **Do NOT wire event recording into existing handlers in this story.** That's 3.2.7/3.2.8 scope.
- **Do NOT create a new shared package.** Event history utilities go in the existing `@ai-learning-hub/db` and `@ai-learning-hub/middleware` packages.
- **Do NOT use `console.log`.** Use `@ai-learning-hub/logging` structured logger.
- **Do NOT hardcode table names.** Use `requireEnv()` pattern with sensible dev defaults.
- **Do NOT let `recordEvent()` failures propagate.** Event recording is fire-and-forget — catch errors, log WARN, and continue. The primary operation (save, update, delete) must succeed even if event recording fails.
- **Do NOT record full entity state in `changes`.** Record only the changed fields as a minimal diff. Truncate to field names if the diff exceeds 10KB.
- **Do NOT add GSIs for cross-entity queries** (by actorId, by eventType, etc.). Agent audit queries use CloudWatch Logs Insights on the structured logs emitted by `recordEvent()`. DynamoDB is for entity-scoped queries only.

### Testing Strategy

**Unit tests (Vitest):**
- Mock DynamoDB client using existing mock patterns from `backend/shared/db/test/`
- Test `recordEvent()`: validates required fields, generates ULID, calculates TTL correctly (90 days), constructs correct PK/SK, handles errors
- Test `queryEntityEvents()`: queries correct PK, applies `since` filter, respects `limit` cap (200 max), handles cursor encoding/decoding, returns null cursor on last page
- Test `createEventHistoryHandler()`: requires auth, validates entity exists, parses query params, returns 404 for missing entity, returns correct response shape

**CDK assertion tests:**
- Events table has correct PK/SK schema
- TTL attribute is `ttl`
- Billing mode is PAY_PER_REQUEST
- PITR is enabled

### Dependencies and Risks

| Dependency | Status | Impact |
|-----------|--------|--------|
| 3.2.1 (Idempotency) | Not started | None — this story is independent |
| 3.2.2 (Error contract) | Not started | Response envelope may change — use compatible shape |
| 3.2.4 (Agent identity) | Not started | `actorType`/`actorId` fields are defined here but populated later |
| 3.2.5 (Cursor pagination) | Not started | Cursor helpers may be shared — place in `@ai-learning-hub/db` |

**Risk:** Stories 3.2.1-3.2.6 are all parallelizable shared infra. If 3.2.2 (error contract) or 3.2.5 (cursor pagination) land first, the event history handler should adopt their patterns. If this story lands first, the patterns established here should be reusable.

**Batch event recording (3.2.9 consideration):** Story 3.2.9 (batch operations) processes up to 25 operations per request and may need to record multiple events. For now, callers can invoke `recordEvent()` per operation (fire-and-forget, so latency is acceptable). If batch event recording becomes a bottleneck, add a `recordEvents(client, events[], logger)` batch utility as a follow-up — but do NOT add it in this story (YAGNI).

### Key Technical Decisions

1. **Separate events table (not saves/projects table):** Cross-cutting concern used by ALL future domains. Own table with TTL keeps it clean, prevents entity CRUD interference, and allows 90-day retention without affecting entity data. Consistent with ADR-001 (multi-table design).
2. **PK = `EVENTS#{entityType}#{entityId}` (no userId in PK):** The access pattern is "events for entity X", not "all events for user Y." userId is an attribute for authorization, not a partition key. This keeps queries fast (single partition) at the cost of no user-scoped event queries — acceptable because CloudWatch Logs Insights handles that need in V1.
3. **ISO timestamp string in SK (not epoch number):** `new Date().toISOString()` always produces UTC zero-padded strings that sort lexicographically. Readable in DynamoDB console for debugging. The `recordEvent()` utility auto-generates timestamps — callers never provide them, guaranteeing sort correctness.
4. **Fire-and-forget recording (not critical path):** Same pattern as EventBridge emission in saves handlers. Event recording failure must never block or fail the primary operation. Callers wrap in try/catch, log WARN, continue. This is acceptable because events are supplementary audit data, not transactional.
5. **Minimal diff in `changes` (not full entity state):** Only changed fields are recorded, with a 10KB safety cap. Prevents approaching DynamoDB's 400KB item limit on large entities. Falls back to field names only (`{ changedFields: [...] }`) when the diff is too large.
6. **Handler generator with escape hatch:** `createEventHistoryHandler()` covers the 80% case. Domains with custom filtering needs can call `queryEntityEvents()` directly. The utility layer is the value; the generator is convenience.
7. **No GSIs — CloudWatch for cross-entity queries:** Agent audit ("what did agent X do?") uses CloudWatch Logs Insights on structured logs from `recordEvent()`. DynamoDB is entity-scoped only. No speculative GSIs.
8. **Soft-deleted entities remain queryable:** `entityExistsFn` must return `true` for soft-deleted entities. Event history of deleted entities is the most valuable for debugging and reconciliation.

### Git Intelligence

Recent work (Epics 3 and 3.1) established patterns for:
- Shared schema extraction to `@ai-learning-hub/*` packages (PR #194)
- Shared test utilities in `backend/test-utils/` (PR #196)
- Handler consolidation using shared middleware (PR #198)
- EventBridge observability infrastructure — CDK rule + CloudWatch log group target (PR #216, Story 3.1.8) — this is the EventBridge side of event capture; the current story adds the DynamoDB queryable side
- API key scope enforcement across endpoints (PR #204)
- Fire-and-forget event emission pattern in saves handlers (PR #182, Story 3-1b)

The fire-and-forget pattern from PR #182 is directly relevant — `recordEvent()` follows the same try/catch/warn/continue approach used for `emitEvent()` in the saves create handler.

### Previous Story Intelligence

Story 3.2.1 (Idempotency & Optimistic Concurrency) established:
- Pattern for new DynamoDB tables as CDK stacks (idempotency table — PK string, TTL attribute, on-demand, PITR)
- Pattern for extending `@ai-learning-hub/db` with new table configs and operation files
- Pattern for extending `@ai-learning-hub/types` with new interfaces and enums
- New error codes (`VERSION_CONFLICT`, `PRECONDITION_REQUIRED`, `IDEMPOTENCY_KEY_CONFLICT`) — follow same pattern for any event-specific error codes
- Fail-open philosophy for non-critical infrastructure (idempotency fails open; event recording also fails open)

Story 3.2.2 (Error Contract & Response Envelope) established:
- `EnvelopeMeta` interface with `cursor`, `total`, `rateLimit` — the event history response `meta` should use this type once 3.2.2 lands
- `ResponseEnvelope<T>` generic — event history response should be `ResponseEnvelope<EntityEvent[]>`
- `createSuccessResponse` options object pattern — use this when building the handler generator response
- `fields` key (not `errors`) for validation error details — use in `since` parameter validation

### References

- [Source: _bmad-output/planning-artifacts/prd.md — FR102: Event History & Reconciliation]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR-AN4: Event history retention, 90 days, < 1s query]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-001: Multi-Table DynamoDB Design]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-008: Standardized Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-015: Lambda Layers for Shared Code]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3.2, Story 3.2.3 description]
- [Source: backend/shared/db/src/ — DB utility patterns (TableConfig, putItem, queryItems)]
- [Source: backend/shared/middleware/src/ — Middleware patterns (wrapHandler, HandlerContext)]
- [Source: backend/shared/types/src/ — Type patterns (ErrorCode, AppError, entity interfaces)]
- [Source: backend/shared/events/src/ — EventBridge event patterns (complementary system)]
- [Source: infra/lib/stacks/core/tables.stack.ts — CDK table definition patterns]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
