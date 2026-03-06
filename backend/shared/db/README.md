# @ai-learning-hub/db

DynamoDB client, table configs, and query helpers for all Lambda handlers. Do not import AWS SDK DynamoDB clients directly in handlers — use this package (enforced by architecture-guard hook).

## Quick start

```ts
import {
  getDefaultClient,
  getItem,
  putItem,
  queryItems,
} from "@ai-learning-hub/db";
```

The default client is initialised once at cold start from `AWS_REGION` and `DYNAMODB_ENDPOINT` (for local override). All table helpers use it automatically.

## Client

```ts
import {
  createDynamoDBClient,
  getDefaultClient,
  resetDefaultClient,
} from "@ai-learning-hub/db";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
```

- `createDynamoDBClient(options?)` — create a new `DynamoDBDocumentClient` (use for tests or custom configs)
- `getDefaultClient()` — module-level singleton; used by all helpers automatically
- `resetDefaultClient()` — reset singleton for tests

## Generic helpers

```ts
import {
  getItem,
  putItem,
  deleteItem,
  queryItems,
  updateItem,
  requireEnv,
} from "@ai-learning-hub/db";
import type {
  TableConfig,
  QueryParams,
  UpdateParams,
} from "@ai-learning-hub/db";
```

| Function                         | Description                                           |
| -------------------------------- | ----------------------------------------------------- |
| `getItem(client, table, key)`    | Get a single item by PK/SK                            |
| `putItem(client, table, item)`   | Put an item (full overwrite)                          |
| `deleteItem(client, table, key)` | Delete an item by PK/SK                               |
| `queryItems(client, params)`     | Query with KeyConditionExpression, filters, and limit |
| `updateItem(client, params)`     | Update with UpdateExpression and condition            |
| `requireEnv(name, testFallback)` | Read an env var; use `testFallback` in tests          |

### `TableConfig`

```ts
interface TableConfig {
  tableName: string;
  // GSI names are referenced inline in query params
}
```

## Key patterns (ADR-001)

| Entity             | PK                                          | SK                         |
| ------------------ | ------------------------------------------- | -------------------------- |
| User profile       | `USER#<userId>`                             | `PROFILE`                  |
| API key            | `USER#<userId>`                             | `APIKEY#<keyId>`           |
| Invite code        | `INVITE#<code>`                             | `METADATA`                 |
| Save               | `USER#<userId>`                             | `SAVE#<saveId>`            |
| Idempotency record | `IDEMPOTENCY#<handlerKey>#<idempotencyKey>` | `RECORD`                   |
| Event history      | `EVENT#<entityType>#<entityId>`             | `TS#<timestamp>#<eventId>` |

Table names come from environment variables set by CDK at deploy time — never hardcode them.

## Table configs

```ts
import {
  USERS_TABLE_CONFIG,
  SAVES_TABLE_CONFIG,
  EVENTS_TABLE_CONFIG,
  IDEMPOTENCY_TABLE_CONFIG,
  INVITE_CODES_TABLE_CONFIG,
} from "@ai-learning-hub/db";
```

Each config holds the table name read from the corresponding env var (`USERS_TABLE_NAME`, `SAVES_TABLE_NAME`, etc.).

## User and API key operations

```ts
import {
  getProfile,
  ensureProfile,
  updateProfile,
  updateProfileWithEvents,
  getApiKeyByHash,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKeyLastUsed,
  apiKeyCreateRateLimit,
  inviteGenerateRateLimit,
  inviteValidateRateLimit,
  profileUpdateRateLimit,
} from "@ai-learning-hub/db";
import type {
  UserProfile,
  ApiKeyItem,
  PublicApiKeyItem,
  CreateApiKeyResult,
} from "@ai-learning-hub/db";
```

- `ensureProfile(userId)` — create profile on first use (upsert)
- `getApiKeyByHash(hash)` — look up a key by its SHA-256 hash (for authorizer use)
- `createApiKey(userId, name, scopes)` — creates key, returns `CreateApiKeyResult` with the plaintext secret (one-time)
- `revokeApiKey(userId, keyId)` — soft-revokes (sets `revokedAt`)

## Invite code operations

```ts
import {
  getInviteCode,
  redeemInviteCode,
  createInviteCode,
  listInviteCodesByUser,
  toPublicInviteCode,
} from "@ai-learning-hub/db";
import type { InviteCodeItem, PublicInviteCodeItem } from "@ai-learning-hub/db";
```

## Saves operations

```ts
import {
  SAVES_TABLE_CONFIG,
  SAVES_WRITE_RATE_LIMIT,
  savesWriteRateLimit,
  toPublicSave,
} from "@ai-learning-hub/db";
```

- `toPublicSave(item)` — strips internal DynamoDB fields from a `SaveItem`, returns `PublicSave`
- `savesWriteRateLimit` — `RateLimitMiddlewareConfig` for saves mutations (scope-aware: capture-tier keys = 20/hr, full access = 200/hr)

## Rate limiting

```ts
import {
  incrementAndCheckRateLimit,
  enforceRateLimit,
  getWindowKey,
  getCounterTTL,
} from "@ai-learning-hub/db";
import type { RateLimitConfig, RateLimitResult } from "@ai-learning-hub/db";
```

Sliding-window rate limiter backed by DynamoDB atomic counters. `enforceRateLimit` throws an `AppError` with code `RATE_LIMIT_EXCEEDED` if the limit is breached; use `incrementAndCheckRateLimit` when you want to check without throwing.

## Cursor pagination (Epic 3.2.5)

```ts
import {
  encodeCursor,
  decodeCursor,
  validateCursor,
  buildPaginatedResponse,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@ai-learning-hub/db";
import type { BuildPaginatedResponseOptions } from "@ai-learning-hub/db";
```

Cursors are base64-encoded JSON. `buildPaginatedResponse` wraps items in the standard `{ data, meta: { cursor, total? }, links: { self, next? } }` envelope. Never use offset/page-number pagination.

## Query all (accumulator)

```ts
import { queryAllItems } from "@ai-learning-hub/db";
import type { QueryAllParams } from "@ai-learning-hub/db";
```

`queryAllItems` loops DynamoDB `QueryCommand` with `ExclusiveStartKey` until `LastEvaluatedKey` is absent. Use only for internal batch jobs — not for user-facing list endpoints (use cursor pagination instead).

## Transactional writes

```ts
import {
  transactWriteItems,
  TransactionCancelledError,
} from "@ai-learning-hub/db";
```

Wraps `TransactWriteItemsCommand`. Throws `TransactionCancelledError` on `TransactionCanceledException`, which handlers can catch to return structured conflict responses.

## Optimistic concurrency (Epic 3.2.1)

```ts
import {
  updateItemWithVersion,
  putItemWithVersion,
  VersionConflictError,
} from "@ai-learning-hub/db";
```

- `updateItemWithVersion(client, params, expectedVersion)` — adds `version = :v` to the condition expression; throws `VersionConflictError` on mismatch
- `VersionConflictError` carries `currentVersion` for building 409 responses with `currentState`

## Idempotency storage (Epic 3.2.1)

```ts
import {
  storeIdempotencyRecord,
  getIdempotencyRecord,
  buildIdempotencyPK,
  IDEMPOTENCY_TABLE_CONFIG,
} from "@ai-learning-hub/db";
```

Used internally by `@ai-learning-hub/middleware`'s idempotency layer. Direct use is only needed for custom idempotency logic outside `wrapHandler`.

## Event history operations (Epic 3.2.3)

```ts
import {
  recordEvent,
  queryEntityEvents,
  buildEventPK,
  buildEventSK,
  EVENTS_TABLE_CONFIG,
} from "@ai-learning-hub/db";
```

`recordEvent(params)` writes a timestamped event entry. `queryEntityEvents(entityType, entityId, options)` returns a paginated event list.
