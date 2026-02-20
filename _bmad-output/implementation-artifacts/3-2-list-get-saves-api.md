---
id: "3.2"
title: "List & Get Saves API"
status: ready-for-dev
depends_on:
  - 3-1b-create-save-api
touches:
  - backend/shared/types/src/entities.ts
  - backend/shared/db/src/saves.ts (new)
  - backend/shared/db/src/query-all.ts (new)
  - backend/shared/db/src/helpers.ts
  - backend/shared/db/src/index.ts
  - backend/functions/saves-list/handler.ts (new)
  - backend/functions/saves-get/handler.ts (new)
  - infra/lib/stacks/api/saves-routes.stack.ts
  - infra/config/route-registry.ts
risk: medium
---

# Story 3.2: List & Get Saves API

Status: ready-for-dev

## Story

As a user,
I want to view all my saves in a list and see individual save details,
so that I can browse my saved URLs and access their metadata.

## Acceptance Criteria

| #   | Given                              | When                                     | Then                                                                                                                                                                                                                                                             |
| --- | ---------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User authenticated                 | `GET /saves`                             | Returns paginated list of user's active saves (where `deletedAt` is absent), sorted by `createdAt` descending (newest first)                                                                                                                                     |
| AC2 | —                                  | `GET /saves?nextToken=<token>&limit=<n>` | In-memory pagination over active saves only: active saves fetched from DynamoDB (up to 1000-item ceiling applied to **active** saves), then paginated with ULID cursor. Default limit=25, max limit=100. Response: `{ items: PublicSave[], nextToken?: string, hasMore: boolean }` |
| AC3 | User authenticated                 | `GET /saves/:saveId`                     | Returns single save with all public attributes; returns 404 if not found or if it belongs to another user                                                                                                                                                        |
| AC4 | Save exists and is returned        | `GET /saves/:saveId`                     | `lastAccessedAt` updated via awaited-but-non-throwing `updateItem` call (errors logged with full correlation context, not propagated); response is returned whether or not the update succeeds                                                                    |
| AC5 | Save has been soft-deleted         | `GET /saves/:saveId`                     | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`                                                                                                                                                                             |
| AC6 | User has no saves                  | `GET /saves`                             | Returns `{ items: [], hasMore: false }` (empty list, not an error)                                                                                                                                                                                               |
| AC7 | Save belongs to a different user   | `GET /saves/:saveId`                     | Returns 404 (not 403 — no information leakage). Key scoping (`PK=USER#<userId>`) makes this automatic: the item simply won't be found.                                                                                                                            |
| AC8 | —                                  | Any main saves-table read                | All `GetItem` and `Query` calls on the saves table (main table, not GSI) use `ConsistentRead: true`. Scope: saves table only. Users table reads (Epic 2 handlers) are unchanged. GSI reads (other stories) remain eventually consistent by DynamoDB design.      |
| AC9 | —                                  | `GET /saves` or `GET /saves/:saveId`     | Response time < 1 second on warm invocation (NFR-P2). Cold start may exceed per ADR-016.                                                                                                                                                                         |
| AC10| `nextToken` is provided            | Token references a save no longer in result set | Returns 400 `{ error: { code: 'VALIDATION_ERROR', message: 'nextToken is invalid or has expired — restart pagination', requestId } }`. Client must reset to page 1. |

## Tasks / Subtasks

- [ ] Task 1: Add `SaveItem` type to `@ai-learning-hub/types` (Minor #15)
  - [ ] 1.1 In `backend/shared/types/src/entities.ts`, add `export type SaveItem = Save & { PK: string; SK: string };` below the `Save` interface
  - [ ] 1.2 Add `export type PublicSave = Omit<SaveItem, 'PK' | 'SK' | 'deletedAt'>;` alongside it
  - [ ] 1.3 Verify existing types exports in `backend/shared/types/src/index.ts` include these new types (add if missing)

- [ ] Task 2: Add `SAVES_TABLE_CONFIG` and `toPublicSave` to `@ai-learning-hub/db` (Significant #9, #10)
  - [ ] 2.1 Create `backend/shared/db/src/saves.ts` with `SAVES_TABLE_CONFIG` (reads `process.env.SAVES_TABLE_NAME`, fallback `'ai-learning-hub-saves'`) and `toPublicSave(item: SaveItem): PublicSave` (strips `PK`, `SK`, `deletedAt`)
  - [ ] 2.2 Export `SAVES_TABLE_CONFIG`, `toPublicSave` from `backend/shared/db/src/index.ts`
  - [ ] 2.3 Add unit tests in `backend/shared/db/test/saves.test.ts` — verify `toPublicSave` strips `PK`, `SK`, `deletedAt`; verify it preserves all other fields including optional ones; verify `SAVES_TABLE_CONFIG.tableName` reads from env var with fallback

- [ ] Task 3: Add `queryAllItems` helper to `@ai-learning-hub/db` (Critical #1, #4)
  - [ ] 3.1 Create `backend/shared/db/src/query-all.ts` — see Dev Notes for `QueryAllParams` interface and full implementation including the FilterExpression-aware Limit logic
  - [ ] 3.2 The `Limit` optimization (`ceiling - allItems.length`) MUST be disabled when `filterExpression` is present (DynamoDB `Limit` applies before `FilterExpression`, so using it would starve accumulation on tables with many soft-deleted items). When `filterExpression` is present, use a fixed page size of 500.
  - [ ] 3.3 Log `pages` counter alongside `totalItems` and `durationMs` for performance diagnosis (Minor #16)
  - [ ] 3.4 Export `queryAllItems` and `QueryAllParams` from `backend/shared/db/src/index.ts`
  - [ ] 3.5 Add unit tests in `backend/shared/db/test/query-all.test.ts` — see Dev Notes for required test cases

- [ ] Task 4: Add `ConsistentRead` support to `getItem` and `queryItems` in `@ai-learning-hub/db` (AC: #8)
  - [ ] 4.1 Add `consistentRead?: boolean` to `QueryParams` interface in `backend/shared/db/src/helpers.ts`; wire into `QueryCommandInput` via `...(params.consistentRead && { ConsistentRead: true })`
  - [ ] 4.2 Add `consistentRead?: boolean` to `getItem` options param; wire into `GetCommandInput`; update all callers in `backend/shared/db/src/` that use `getItem` (add `options` arg as `{}` to preserve existing behaviour)

- [ ] Task 5: Create `saves-list` Lambda handler — `GET /saves` (AC: #1, #2, #6, #8, #9, #10)
  - [ ] 5.1 Create `backend/functions/saves-list/handler.ts` using the `WrappedHandler<T>` / `HandlerContext` pattern — see Dev Notes for the complete handler skeleton
  - [ ] 5.2 Parse and validate query params with `validateQueryParams` from `@ai-learning-hub/validation`: `limit` (int, 1–100, default 25) and `nextToken` (optional string). Return `AppError(ErrorCode.VALIDATION_ERROR, ...)` for invalid `limit`.
  - [ ] 5.3 Call `queryAllItems` with `filterExpression: 'attribute_not_exists(deletedAt)'` so the 1000-item ceiling applies to **active** saves only (Critical #1 fix). No in-memory filter step needed.
  - [ ] 5.4 Apply ULID cursor pagination from the result. If `nextToken` resolves to a `saveId` not present in the result set, throw `AppError(ErrorCode.VALIDATION_ERROR, 'nextToken is invalid or has expired — restart pagination')` (AC10, Critical #2 fix).
  - [ ] 5.5 Log a `warn` if `truncated: true`: `logger.warn('Save list truncated at ceiling', { userId, ceiling: 1000 })`. Do NOT expose `truncated` in the response body yet — Story 3.4 will add it. Add a `// TODO(story-3.4): expose truncated in response` comment (Moderate #14).
  - [ ] 5.6 Return `{ items: page.map(toPublicSave), ...(nextToken && { nextToken }), hasMore }` — `wrapHandler` auto-wraps this as a 200 response
  - [ ] 5.7 Export `handler = wrapHandler(savesListHandler, { requireAuth: true })`

- [ ] Task 6: Create `saves-get` Lambda handler — `GET /saves/:saveId` (AC: #3, #4, #5, #7, #8, #9)
  - [ ] 6.1 Create `backend/functions/saves-get/handler.ts` using the `HandlerContext` pattern
  - [ ] 6.2 Validate `saveId` path param with `validatePathParams(saveIdPathSchema, ctx.event.pathParameters)` — schema: `z.object({ saveId: z.string().regex(/^[0-9A-Z]{26}$/, 'saveId must be a 26-character ULID') })` (Significant #8 fix)
  - [ ] 6.3 Fetch save with `getItem<SaveItem>(client, SAVES_TABLE_CONFIG, { PK: \`USER#${userId}\`, SK: \`SAVE#${saveId}\` }, { consistentRead: true }, logger)` — pass logger (Significant #7 fix)
  - [ ] 6.4 Return 404 via `AppError(ErrorCode.NOT_FOUND, 'Save not found')` if `item === null` OR `item.deletedAt` is set (AC5). Key scoping makes AC7 automatic.
  - [ ] 6.5 Update `lastAccessedAt` — awaited, wrapped in try/catch, uses `ctx.logger` (NOT a freshly created logger) to preserve correlation context (Significant #6 fix); pass `logger` to `updateItem` (Significant #7 fix). See Dev Notes for the exact pattern.
  - [ ] 6.6 Return `toPublicSave(item)` — `wrapHandler` auto-wraps as 200
  - [ ] 6.7 Export `handler = wrapHandler(savesGetHandler, { requireAuth: true })`

- [ ] Task 7: Extend `saves-routes.stack.ts` CDK stack
  - [ ] 7.1 Add `savesListFunction` and `savesGetFunction` `NodejsFunction` constructs to `infra/lib/stacks/api/saves-routes.stack.ts` — config: `memorySize: 256`, `timeout: 10s`, `tracing: ACTIVE`, env var `SAVES_TABLE_NAME`
  - [ ] 7.2 Grant IAM: `savesTable.grantReadData(savesListFunction)` and `savesTable.grantReadData(savesGetFunction)` — read-only, sufficient for these handlers
  - [ ] 7.3 **Do NOT grant `usersTable` access to these functions** — GET endpoints are not explicitly rate-limited in V1 (see Dev Notes: Rate Limiting Decision), so `enforceRateLimit` is not called and the users table grant would be over-permissioned (Minor #17 fix)
  - [ ] 7.4 Wire API Gateway routes on the `/saves` resource (created in Story 3.1b): `GET` → `savesListFunction`; add `{saveId}` child resource with `GET` → `savesGetFunction`. Add `corsOptions` preflight to the `{saveId}` resource.
  - [ ] 7.5 Expose `savesListFunction` and `savesGetFunction` as public properties on `SavesRoutesStack` (for architecture enforcement tests T1–T4)

- [ ] Task 8: Update route registry
  - [ ] 8.1 Extend `HandlerRef` union to include `'savesListFunction'` and `'savesGetFunction'`
  - [ ] 8.2 Add two entries to `ROUTE_REGISTRY`: `GET /saves` (savesListFunction) and `GET /saves/{saveId}` (savesGetFunction), both `authType: 'jwt-or-apikey'`, `epic: 'Epic-3'`
  - [ ] 8.3 Architecture enforcement tests (T1–T4) must still pass — they fail until CDK stack exposes matching public properties

- [ ] Task 9: Write comprehensive tests (AC: all)
  - [ ] 9.1 Tests for `query-all.ts`: single-page result, two-page accumulation (mock `LastEvaluatedKey` on first call), ceiling truncation with `truncated: true` and correct items count, empty table → `{ items: [], truncated: false }`, `ConsistentRead: true` passed to DynamoDB, FilterExpression disables Limit optimization (verify DynamoDB receives no `Limit` when filterExpression is present), page counter included in log output
  - [ ] 9.2 Tests for `saves-list` handler: 200 with items and pagination shape, empty list → `{ items: [], hasMore: false }`, cursor pagination (page 1 → nextToken → page 2 correctly skips), stale nextToken → 400, limit=100 (max), limit=101 → 400, malformed nextToken string → 400, `ConsistentRead: true` passed through, `toPublicSave` strips PK/SK/deletedAt from each item
  - [ ] 9.3 Tests for `saves-get` handler: 200 with save, `lastAccessedAt` updated (verify `updateItem` called), `lastAccessedAt` update failure does NOT fail response (mock `updateItem` throw → verify 200 still returned, error logged on `ctx.logger`), not found → 404, soft-deleted → 404, invalid saveId format (e.g. too short) → 400, `ConsistentRead: true` passed through
  - [ ] 9.4 Tests for `saves.ts` (db package): `toPublicSave` strips exactly `PK`, `SK`, `deletedAt`; preserves optional fields when present and absent; `SAVES_TABLE_CONFIG.tableName` reads env var with fallback
  - [ ] 9.5 Architecture enforcement tests (T1–T4 in `infra/test/`) pass

- [ ] Task 10: Verify build and quality gates
  - [ ] 10.1 `npm test` — all tests pass (including existing 3.1a, 3.1b, and prior epics)
  - [ ] 10.2 `npm run lint` — no errors
  - [ ] 10.3 `npm run build` — clean TypeScript compilation
  - [ ] 10.4 `npm run type-check` — no type errors
  - [ ] 10.5 `npm run format` run on all changed files

## Dev Notes

### Critical: Story 3.1b Must Be Done First

Story 3.1b (Create Save API) is a hard prerequisite. Before starting Story 3.2, confirm these exist:
- `infra/lib/stacks/api/saves-routes.stack.ts` (3.1b creates it; 3.2 extends it)
- `infra/lib/stacks/core/events.stack.ts` and `EventsStack` in `infra/bin/app.ts`
- Route registry entry for `savesCreateFunction` / `POST /saves`
- `backend/functions/saves/handler.ts` (POST handler from 3.1b)

### Critical: Correct Handler Signature — `HandlerContext`, Not `APIGatewayProxyHandler`

`wrapHandler` does NOT accept a `(event, context) => ...` function. It accepts a `WrappedHandler` that receives a single `HandlerContext` object. Every handler in this project follows this pattern. Using the wrong signature compiles but `wrapHandler` will pass a `HandlerContext` where the handler expects `APIGatewayProxyEvent` — a silent runtime failure.

```typescript
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from '@ai-learning-hub/middleware';

// CORRECT ✓
async function savesListHandler(ctx: HandlerContext) {
  const { event, auth, requestId, logger } = ctx;
  const userId = auth!.userId;
  // ...
}
export const handler = wrapHandler(savesListHandler, { requireAuth: true });

// WRONG ✗
const savesListHandler: APIGatewayProxyHandler = async (event, context) => { ... };
```

Reference: `backend/functions/api-keys/handler.ts` — canonical example of this pattern.

### Shared Packages: What to Import From Where

```typescript
// From @ai-learning-hub/types (after Task 1):
import type { Save, SaveItem, PublicSave } from '@ai-learning-hub/types';

// From @ai-learning-hub/db (after Tasks 2–4):
import {
  getDefaultClient,
  getItem,
  updateItem,
  queryAllItems,
  SAVES_TABLE_CONFIG,
  toPublicSave,
  type QueryAllParams,
} from '@ai-learning-hub/db';

// From @ai-learning-hub/middleware:
import { wrapHandler, type HandlerContext } from '@ai-learning-hub/middleware';

// From @ai-learning-hub/validation:
import {
  validateQueryParams,
  validatePathParams,
  z,
} from '@ai-learning-hub/validation';

// From @ai-learning-hub/types (errors):
import { AppError, ErrorCode } from '@ai-learning-hub/types';
```

### New DB Additions (Tasks 1–4)

#### `backend/shared/types/src/entities.ts` — Add `SaveItem` and `PublicSave`

```typescript
// Add after the existing `Save` interface:

/**
 * DynamoDB item shape for the saves table.
 * Extends Save with internal partition/sort keys.
 */
export type SaveItem = Save & { PK: string; SK: string };

/**
 * Public API shape for a save — DynamoDB keys and soft-delete marker stripped.
 */
export type PublicSave = Omit<SaveItem, 'PK' | 'SK' | 'deletedAt'>;
```

#### `backend/shared/db/src/saves.ts` — New File

```typescript
import type { TableConfig } from './helpers.js';
import type { SaveItem, PublicSave } from '@ai-learning-hub/types';

export const SAVES_TABLE_CONFIG: TableConfig = {
  tableName: process.env.SAVES_TABLE_NAME ?? 'ai-learning-hub-saves',
  partitionKey: 'PK',
  sortKey: 'SK',
};

/**
 * Strip internal DynamoDB keys and soft-delete marker before returning to API caller.
 * Pattern mirrors toPublicInviteCode in invite-codes.ts.
 */
export function toPublicSave(item: SaveItem): PublicSave {
  const { PK, SK, deletedAt, ...rest } = item;
  return rest;
}
```

This follows the same pattern as `toPublicInviteCode` in `backend/shared/db/src/invite-codes.ts`. By Story 3.3 there will be 5+ saves handlers — all importing from this single shared location rather than each defining their own copy.

#### `backend/shared/db/src/query-all.ts` — New File

```typescript
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AppError, ErrorCode } from '@ai-learning-hub/types';
import { createLogger, type Logger } from '@ai-learning-hub/logging';
import type { TableConfig } from './helpers.js';

// Page size used when filterExpression is present.
// Cannot use ceiling-remainder optimization because DynamoDB's Limit
// applies before FilterExpression — it would starve accumulation on
// tables with many soft-deleted items.
const FILTER_PAGE_SIZE = 500;

export interface QueryAllParams {
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
  filterExpression?: string;   // If present, Limit optimization is disabled (see above)
  scanIndexForward?: boolean;
  consistentRead?: boolean;
  ceiling?: number;            // Max items to accumulate (default: 1000)
}

export async function queryAllItems<T>(
  client: DynamoDBDocumentClient,
  config: TableConfig,
  params: QueryAllParams,
  logger?: Logger
): Promise<{ items: T[]; truncated: boolean }> {
  const log = logger ?? createLogger();
  const ceiling = params.ceiling ?? 1000;
  const allItems: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  let truncated = false;
  let pages = 0;
  const startTime = Date.now();

  do {
    // When filterExpression is present, skip the Limit optimization:
    // DynamoDB Limit caps scanned items BEFORE filtering, so it would
    // under-accumulate when many items are filtered out.
    const limitValue = params.filterExpression
      ? FILTER_PAGE_SIZE
      : ceiling - allItems.length;

    const input = {
      TableName: config.tableName,
      KeyConditionExpression: params.keyConditionExpression,
      ExpressionAttributeValues: params.expressionAttributeValues,
      ...(params.expressionAttributeNames && {
        ExpressionAttributeNames: params.expressionAttributeNames,
      }),
      ...(params.filterExpression && { FilterExpression: params.filterExpression }),
      ...(params.scanIndexForward !== undefined && {
        ScanIndexForward: params.scanIndexForward,
      }),
      ...(params.consistentRead && { ConsistentRead: true }),
      ...(lastKey && { ExclusiveStartKey: lastKey }),
      Limit: limitValue,
    };

    const result = await client.send(new QueryCommand(input));
    pages++;
    const page = (result.Items ?? []) as T[];
    allItems.push(...page);
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;

    if (allItems.length >= ceiling && lastKey) {
      truncated = true;
      // Trim to exactly ceiling — in the filter case we may have received
      // slightly more items if the last page pushed us over.
      allItems.splice(ceiling);
      break;
    }
  } while (lastKey);

  log.timed('DynamoDB QueryAll', startTime, {
    table: config.tableName,
    totalItems: allItems.length,
    pages,
    truncated,
  });

  return { items: allItems, truncated };
}
```

**DynamoDB throttle note:** AWS SDK v3 retries throttled requests automatically with exponential backoff (default: 3 retries). If all retries are exhausted the helper throws, and `wrapHandler` catches it and returns a 500. Returning partial results on throttle is not implemented — at boutique scale, throttle on the saves table is extremely unlikely (on-demand capacity mode). (Moderate #13)

### Handler: `saves-list` — Complete Implementation

**File:** `backend/functions/saves-list/handler.ts`

```typescript
import { getDefaultClient, queryAllItems, SAVES_TABLE_CONFIG, toPublicSave } from '@ai-learning-hub/db';
import { wrapHandler, type HandlerContext } from '@ai-learning-hub/middleware';
import { validateQueryParams, z } from '@ai-learning-hub/validation';
import { AppError, ErrorCode } from '@ai-learning-hub/types';
import type { SaveItem } from '@ai-learning-hub/types';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const CEILING = 1000;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  nextToken: z.string().optional(),
});

function encodeNextToken(saveId: string): string {
  return Buffer.from(saveId).toString('base64url');
}

function decodeNextToken(token: string): string | undefined {
  try {
    return Buffer.from(token, 'base64url').toString('utf-8');
  } catch {
    return undefined;
  }
}

async function savesListHandler(ctx: HandlerContext) {
  const { event, auth, requestId, logger } = ctx;
  const userId = auth!.userId;
  const client = getDefaultClient();

  const { limit, nextToken: nextTokenParam } = validateQueryParams(
    listQuerySchema,
    event.queryStringParameters
  );

  // Fetch active saves up to ceiling. FilterExpression ensures the ceiling
  // applies to ACTIVE items only — soft-deleted items do not count toward it.
  const { items: activeSaves, truncated } = await queryAllItems<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    {
      keyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      expressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'SAVE#',   // REQUIRED: excludes URL#<urlHash> marker items (Story 3.1b)
      },
      filterExpression: 'attribute_not_exists(deletedAt)',
      scanIndexForward: false,     // newest first
      consistentRead: true,         // NFR-R7
      ceiling: CEILING,
    },
    logger
  );

  // TODO(story-3.4): expose truncated in response so clients can surface
  // "Showing your most recent 1000 saves" banner.
  if (truncated) {
    logger.warn('Save list truncated at ceiling', { userId, ceiling: CEILING });
  }

  // Apply ULID cursor pagination over the in-memory active result set.
  let startIndex = 0;
  if (nextTokenParam) {
    const cursorSaveId = decodeNextToken(nextTokenParam);
    if (!cursorSaveId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'nextToken is invalid or has expired — restart pagination'
      );
    }
    const idx = activeSaves.findIndex((s) => s.saveId === cursorSaveId);
    if (idx === -1) {
      // Cursor item is no longer in the result set (e.g. was soft-deleted
      // between requests). Client must restart pagination explicitly.
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'nextToken is invalid or has expired — restart pagination'
      );
    }
    startIndex = idx + 1;
  }

  const page = activeSaves.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < activeSaves.length;
  const nextToken =
    hasMore ? encodeNextToken(page[page.length - 1].saveId) : undefined;

  return {
    items: page.map(toPublicSave),
    ...(nextToken && { nextToken }),
    hasMore,
  };
}

export const handler = wrapHandler(savesListHandler, { requireAuth: true });
```

### Handler: `saves-get` — Complete Implementation

**File:** `backend/functions/saves-get/handler.ts`

```typescript
import {
  getDefaultClient,
  getItem,
  updateItem,
  SAVES_TABLE_CONFIG,
  toPublicSave,
} from '@ai-learning-hub/db';
import { wrapHandler, type HandlerContext } from '@ai-learning-hub/middleware';
import { validatePathParams, z } from '@ai-learning-hub/validation';
import { AppError, ErrorCode } from '@ai-learning-hub/types';
import type { SaveItem } from '@ai-learning-hub/types';

const saveIdPathSchema = z.object({
  saveId: z
    .string()
    .regex(/^[0-9A-Z]{26}$/, 'saveId must be a 26-character ULID'),
});

async function savesGetHandler(ctx: HandlerContext) {
  const { event, auth, requestId, logger } = ctx;
  const userId = auth!.userId;
  const client = getDefaultClient();

  // Validate path param — rejects malformed inputs before touching DynamoDB (Significant #8)
  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);

  // Fetch save. PK scoping (USER#<userId>) enforces per-user isolation (AC7).
  const item = await getItem<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
    { consistentRead: true },   // NFR-R7
    logger                       // pass logger for structured DynamoDB error context
  );

  if (!item || item.deletedAt) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Save not found');
  }

  // Update lastAccessedAt — awaited but non-throwing (AC4).
  // Use ctx.logger (NOT createLogger()) to preserve correlation context
  // (requestId, traceId, userId already set on the wrapHandler-injected logger).
  try {
    await updateItem(
      client,
      SAVES_TABLE_CONFIG,
      {
        key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        updateExpression: 'SET lastAccessedAt = :now',
        expressionAttributeValues: { ':now': new Date().toISOString() },
      },
      logger   // pass same logger — preserves correlation context
    );
  } catch (err) {
    logger.error('Failed to update lastAccessedAt (non-fatal)', err as Error, {
      saveId,
    });
    // Never propagate — response is returned regardless
  }

  return toPublicSave(item);
}

export const handler = wrapHandler(savesGetHandler, { requireAuth: true });
```

### In-Memory Pagination Design: Why ULID Cursor Is Stable Under Concurrent Inserts

The reviewer raised a concern about cursor stability when new saves are created between paginated requests. This is handled correctly by the ULID properties:

- Items are sorted by `SK` (SAVE#<ULID>) with `ScanIndexForward=false` — newest first
- ULIDs encode creation time and sort lexicographically in the same order as `createdAt`
- A new save created between page 1 and page 2 has a newer ULID (higher sort key)
- With newest-first ordering, the new item appears **above** the cursor position
- `startIndex = idx + 1` correctly skips past the cursor to items **older** than it ✓

The only genuine stale cursor case is when the cursor item itself (the last item of the previous page) is **soft-deleted** between requests. With the `filterExpression: 'attribute_not_exists(deletedAt)'` fix, that item disappears from the next fetch → `idx === -1` → 400 INVALID_CURSOR (AC10).

### Rate Limiting Decision — GET Endpoints Not Explicitly Rate-Limited (Significant #5)

`GET /saves` and `GET /saves/:saveId` do NOT call `enforceRateLimit` in V1. Rationale:
- All write endpoints (POST, PATCH, DELETE) are rate-limited — these protect data modification
- Read endpoints rely on API Gateway's built-in throttle (500 RPS per endpoint by default)
- At boutique scale (<100 users), read abuse is not a current risk

**Consequence for CDK:** The `savesListFunction` and `savesGetFunction` Lambdas do **NOT** need `usersTable` access (the users table is only needed by `enforceRateLimit`). Grant `savesTable.grantReadData()` only — not `usersTable.grantReadWriteData()` (Minor #17 fix).

If the policy changes, add `enforceRateLimit` call with a high threshold (e.g., 1000/hour) and add `usersTable.grantReadWriteData()` at that time.

### CDK Extension: `saves-routes.stack.ts`

Story 3.1b **creates** this file. Story 3.2 **extends** it. The `SavesRoutesStackProps` interface and `eventBus` prop already exist from 3.1b — do not add them again (Moderate #11).

In the stack constructor, add after the existing `savesCreateFunction`:

```typescript
// saves-list — GET /saves
const savesListFunction = new lambda.NodejsFunction(this, 'SavesListFunction', {
  entry: path.join(__dirname, '../../../../backend/functions/saves-list/handler.ts'),
  handler: 'handler',
  memorySize: 256,
  timeout: cdk.Duration.seconds(10),
  tracing: lambda.Tracing.ACTIVE,
  environment: { SAVES_TABLE_NAME: props.savesTable.tableName },
});
// Read-only: no usersTable grant needed (GET endpoints not rate-limited in V1)
props.savesTable.grantReadData(savesListFunction);
this.savesListFunction = savesListFunction;

// saves-get — GET /saves/:saveId
const savesGetFunction = new lambda.NodejsFunction(this, 'SavesGetFunction', {
  entry: path.join(__dirname, '../../../../backend/functions/saves-get/handler.ts'),
  handler: 'handler',
  memorySize: 256,
  timeout: cdk.Duration.seconds(10),
  tracing: lambda.Tracing.ACTIVE,
  environment: { SAVES_TABLE_NAME: props.savesTable.tableName },
});
// grantReadData is sufficient for getItem; grantReadWriteData is for updateItem.
// updateItem is used for lastAccessedAt — update to grantReadWriteData if IAM errors occur.
// Keeping minimal scope first; lastAccessedAt update is non-fatal if it fails.
props.savesTable.grantReadWriteData(savesGetFunction);  // updateItem for lastAccessedAt
this.savesGetFunction = savesGetFunction;
```

**Note:** `savesGetFunction` needs `grantReadWriteData` (not `grantReadData`) because `updateItem` requires `dynamodb:UpdateItem` permission — even though it's a non-fatal side-effect, the Lambda needs the permission or it will log a 403 error on every call.

Wire routes on the `/saves` resource tree:
```typescript
// savesResource already exists from Story 3.1b (has POST method + CORS)
savesResource.addMethod('GET',
  new apigateway.LambdaIntegration(savesListFunction),
  { authorizer: props.apiKeyAuthorizer, authorizationType: apigateway.AuthorizationType.CUSTOM }
);

const saveByIdResource = savesResource.addResource('{saveId}');
saveByIdResource.addCorsPreflight(corsOptions);
saveByIdResource.addMethod('GET',
  new apigateway.LambdaIntegration(savesGetFunction),
  { authorizer: props.apiKeyAuthorizer, authorizationType: apigateway.AuthorizationType.CUSTOM }
);
```

Add public class properties:
```typescript
public readonly savesListFunction: lambda.NodejsFunction;
public readonly savesGetFunction: lambda.NodejsFunction;
```

### Route Registry Update

```typescript
// Extend HandlerRef (after 'savesCreateFunction' from 3.1b):
export type HandlerRef =
  | "validateInviteFunction"
  | "usersMeFunction"
  | "apiKeysFunction"
  | "generateInviteFunction"
  | "savesCreateFunction"    // Story 3.1b
  | "savesListFunction"      // Story 3.2
  | "savesGetFunction";      // Story 3.2

// Add to ROUTE_REGISTRY:
{
  path: '/saves',
  methods: ['GET'],
  authType: 'jwt-or-apikey',
  handlerRef: 'savesListFunction',
  epic: 'Epic-3',
},
{
  path: '/saves/{saveId}',
  methods: ['GET'],
  authType: 'jwt-or-apikey',
  handlerRef: 'savesGetFunction',
  epic: 'Epic-3',
},
```

Use `{saveId}` (curly braces) to match CDK's `addResource('{saveId}')` syntax — consistent with the existing `{id}` entry for `/users/api-keys/{id}`.

### Public Save Response Shape

`PublicSave` (from `@ai-learning-hub/types`) after stripping `PK`, `SK`, `deletedAt`:

| Field | Type | Notes |
|-------|------|-------|
| `saveId` | `string` | ULID |
| `url` | `string` | Original URL as submitted |
| `normalizedUrl` | `string` | After normalization (Story 3.1a) |
| `urlHash` | `string` | SHA-256 of normalizedUrl |
| `contentType` | `ContentType` | Enum value |
| `tags` | `string[]` | Max 20 tags |
| `isTutorial` | `boolean` | Always `false` until Epic 8 |
| `linkedProjectCount` | `number` | Always `0` until Epic 5 |
| `createdAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |
| `userId` | `string` | Included for API client convenience |
| `title` | `string?` | Present if set |
| `userNotes` | `string?` | Present if set |
| `lastAccessedAt` | `string?` | Set after first `GET /saves/:saveId` |
| `enrichedAt` | `string?` | Set by Epic 9 enrichment (absent until then) |

Fields never present: `PK`, `SK`, `deletedAt`, `tutorialStatus` (intentionally omitted at creation per Story 3.1b — absent items don't appear in JSON).

### Architecture Compliance

| ADR / NFR | How This Story Complies |
|-----------|------------------------|
| ADR-001 (DynamoDB) | `PK=USER#<userId>`, `SK=SAVE#<saveId>`. `begins_with(SK, 'SAVE#')` excludes URL marker items (`SK=URL#<urlHash>`) from Story 3.1b. |
| ADR-005 (No L2L) | Pure read handlers — no Lambda invocations, no EventBridge |
| ADR-008 (Error Handling) | All errors via `AppError` caught by `wrapHandler`. 404 for missing/soft-deleted/wrong-user saves. 400 for stale cursor. |
| ADR-014 (API-First) | List endpoint: `{ items, nextToken?, hasMore }`. `nextToken` is opaque base64url. |
| ADR-016 (Cold Starts) | NFR-P2 qualified as warm invocation |
| NFR-R7 | `ConsistentRead: true` on **saves table** main-table reads only. Epic 2 users-table reads are unchanged. |
| NFR-S4 | Per-user isolation enforced by DynamoDB key scoping. `getItem` with wrong userId → returns null. `queryAllItems` with wrong userId → returns empty. |

### Testing Standards

- **Framework:** Vitest
- **Coverage:** 80% minimum (CI-enforced)
- **Mock pattern:** `vi.mock('@ai-learning-hub/db')` for DynamoDB helpers. Use shared `wrapHandler` mock from `backend/shared/middleware/test/mock-wrapper.ts` (Story 2.1-D3). See `backend/functions/api-keys/handler.test.ts` for the canonical import and usage pattern.
- **HandlerContext mock:** Provide `{ event, auth: { userId }, requestId, logger: mockLogger, startTime }` to handler functions directly (bypassing `wrapHandler`), or use the mock-wrapper.
- **ConsistentRead verification:** Assert that `queryAllItems`/`getItem` were called with `consistentRead: true`.
- **FilterExpression verification:** Assert that `queryAllItems` was called with `filterExpression: 'attribute_not_exists(deletedAt)'` — this verifies the ceiling applies to active items.

### Project Structure Notes

| File | Action |
|------|--------|
| `backend/shared/types/src/entities.ts` | **Modify** — add `SaveItem`, `PublicSave` types |
| `backend/shared/db/src/saves.ts` | **Create** — `SAVES_TABLE_CONFIG`, `toPublicSave` |
| `backend/shared/db/src/query-all.ts` | **Create** — `queryAllItems` helper |
| `backend/shared/db/src/helpers.ts` | **Modify** — add `consistentRead` to `QueryParams` and `getItem` |
| `backend/shared/db/src/index.ts` | **Modify** — export new symbols |
| `backend/functions/saves-list/handler.ts` | **Create** — `GET /saves` handler |
| `backend/functions/saves-get/handler.ts` | **Create** — `GET /saves/:saveId` handler |
| `infra/lib/stacks/api/saves-routes.stack.ts` | **Modify** — add two Lambda functions and routes |
| `infra/config/route-registry.ts` | **Modify** — extend `HandlerRef`, add 2 routes |

**Note on function directories:** `backend/functions/saves-list/` and `backend/functions/saves-get/` are separate Lambda directories (Lambda per concern per ADR-005). Each has a single `handler.ts`. The `saves/` directory (with `handler.ts` from Story 3.1b) handles `POST /saves` only — do not add files to it.

### Story 3.4 Forward Compatibility

Story 3.2 is deliberately designed for Story 3.4 to extend:
- The `nextToken` cursor format (base64url of `saveId`) is stable — 3.4 adds filter params but keeps the same cursor semantics
- Story 3.4 modifies `saves-list/handler.ts` to add filter/sort query params and the `truncated` response flag (the `truncated` variable already exists in the handler, just not exposed yet)
- The `queryAllItems` helper already supports `filterExpression`, `scanIndexForward` — Story 3.4 composes with these

### References

- [Source: docs/progress/epic-3-stories-and-plan.md#Story-3.2] — ACs, pagination strategy, nextToken semantics
- [Source: _bmad-output/implementation-artifacts/3-1b-create-save-api.md] — `SAVES_TABLE_CONFIG` pattern, `toPublicSave`, URL marker item (`SK=URL#<urlHash>`), CDK stack structure
- [Source: backend/shared/middleware/src/wrapper.ts] — `wrapHandler`, `HandlerContext` — handler signature pattern
- [Source: backend/functions/api-keys/handler.ts] — Canonical `HandlerContext` handler pattern, `validateQueryParams`, `validatePathParams` usage
- [Source: backend/shared/db/src/helpers.ts] — `getItem`, `queryItems`, `updateItem` helpers
- [Source: backend/shared/db/src/invite-codes.ts] — `toPublicInviteCode` pattern (model for `toPublicSave`)
- [Source: backend/shared/db/src/users.ts] — `USERS_TABLE_CONFIG` pattern (model for `SAVES_TABLE_CONFIG`)
- [Source: backend/shared/types/src/entities.ts] — `Save` type (base for `SaveItem`)
- [Source: backend/shared/logging/src/logger.ts] — `Logger.timed()` confirmed to exist at line 230
- [Source: infra/lib/stacks/api/auth-routes.stack.ts] — CDK route wiring pattern (corsOptions, addMethod, LambdaIntegration)
- [Source: infra/config/route-registry.ts] — Route registry pattern

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
