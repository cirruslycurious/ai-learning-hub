# Story 3.1.7 Dedup Scan Findings - Round 1

**Scanner:** Agent (Fresh Context)
**Date:** 2026-02-23
**Branch:** story-3-1-5-phase-runner-infrastructure
**Domain:** saves domain handlers
**Handlers scanned:** 6

| #   | Handler        | Path                                         | Lines |
| --- | -------------- | -------------------------------------------- | ----- |
| 1   | saves (create) | `backend/functions/saves/handler.ts`         | 337   |
| 2   | saves-list     | `backend/functions/saves-list/handler.ts`    | 211   |
| 3   | saves-get      | `backend/functions/saves-get/handler.ts`     | 66    |
| 4   | saves-update   | `backend/functions/saves-update/handler.ts`  | 142   |
| 5   | saves-delete   | `backend/functions/saves-delete/handler.ts`  | 135   |
| 6   | saves-restore  | `backend/functions/saves-restore/handler.ts` | 129   |

**Shared packages inspected:**

- `@ai-learning-hub/validation` (schemas.ts, validator.ts, index.ts)
- `@ai-learning-hub/middleware` (wrapper.ts, error-handler.ts, auth.ts, index.ts)
- `@ai-learning-hub/types` (errors.ts)
- `@ai-learning-hub/db` (saves.ts, rate-limiter.ts, helpers.ts, index.ts)
- `@ai-learning-hub/events` (saves.ts, emitter.ts, client.ts, index.ts)

---

## Critical Issues (Must Fix)

None.

All handlers use the shared `toPublicSave()`, `SAVES_TABLE_CONFIG`, `SAVES_WRITE_RATE_LIMIT`, event constants, schemas, and error types consistently from their respective shared packages. No semantic divergence was detected between any local definition and a shared export.

---

## Important Issues (Should Fix)

### 1. [Duplicate Code] Rate-limit enforcement block is identical in 4 handlers

The following 6-line block is copy-pasted verbatim in 4 of 6 handlers:

```typescript
await enforceRateLimit(
  client,
  USERS_TABLE_CONFIG.tableName,
  {
    ...SAVES_WRITE_RATE_LIMIT,
    identifier: userId,
  },
  logger
);
```

- **Files:**
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts`:78-86
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-update/handler.ts`:50-58
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-delete/handler.ts`:51-59
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-restore/handler.ts`:48-56
- **Shared export:** `@ai-learning-hub/db` exports `enforceRateLimit`, `USERS_TABLE_CONFIG`, and `SAVES_WRITE_RATE_LIMIT` separately. No higher-level "enforce saves write rate limit" helper exists.
- **Problem:** Four handlers independently compose the same three imports into the same call pattern. The spread-then-assign pattern (`{ ...SAVES_WRITE_RATE_LIMIT, identifier: userId }`) is repeated identically in every case.
- **Impact:** If the rate-limit config changes (different table name, different spread shape, additional parameters), all 4 handlers must be updated in lockstep. Moderate maintenance burden.
- **Fix:** Extract a `enforceSavesWriteRateLimit(client, userId, logger)` helper into `@ai-learning-hub/db` (saves.ts) that encapsulates the table name, config spread, and identifier wiring. Handlers would call `enforceSavesWriteRateLimit(client, userId, logger)` instead of the 6-line block.

### 2. [Duplicate Code] `const eventBus = requireEventBus()` module-scope initialization in 4 handlers

All 4 event-emitting handlers have an identical module-scope line:

```typescript
const eventBus = requireEventBus();
```

- **Files:**
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts`:44
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-update/handler.ts`:35
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-delete/handler.ts`:37
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-restore/handler.ts`:34
- **Shared export:** `@ai-learning-hub/events` exports `requireEventBus()`. No pre-initialized singleton exists.
- **Problem:** Each handler repeats the same cold-start initialization. The subsequent `emitEvent()` call then destructures `eventBus.ebClient` and `eventBus.busName` the same way every time.
- **Impact:** Low risk today (it is a single line), but the 8-argument `emitEvent(eventBus.ebClient, eventBus.busName, ...)` call pattern that follows is repeated in every event-emitting handler. The combined boilerplate (init + emit call with destructuring) spans ~12 lines per handler.
- **Fix:** Consider a higher-level `emitSavesEvent(detailType, detail, logger)` helper in the shared events package (or in `@ai-learning-hub/db/saves.ts`) that encapsulates both the `requireEventBus()` initialization and the `emitEvent()` call with the fixed `SAVES_EVENT_SOURCE`. This would reduce each handler's event emission to a single function call.

### 3. [Duplicate Code] DynamoDB key construction pattern `{ PK: \`USER#${userId}\`, SK: \`SAVE#${saveId}\` }` in 5 handlers

The same DynamoDB key object literal appears across 5 of 6 handlers:

```typescript
{ PK: `USER#${userId}`, SK: `SAVE#${saveId}` }
```

- **Files (occurrences):**
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves/handler.ts`:136-137 (PK only, different SK for SAVE# and URL# items)
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-get/handler.ts`:32, 47
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-update/handler.ts`:94
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-delete/handler.ts`:75, 93
  - `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-restore/handler.ts`:65, 80
- **Shared export:** None -- no key builder function exists.
- **Problem:** The template-literal key construction `USER#${userId}` and `SAVE#${saveId}` is repeated at least 10 times across handlers. The key prefix strings are magic strings embedded directly in handler code.
- **Impact:** If the key format changes (e.g., prefix convention update), every occurrence must be found and updated. The prefix strings `USER#` and `SAVE#` are also repeated in `saves-list` as filter expression values (`:pk` = `USER#${userId}`, `:prefix` = `SAVE#`).
- **Fix:** Add key builder helpers to `@ai-learning-hub/db/saves.ts`:
  ```typescript
  export function saveKey(userId: string, saveId: string) {
    return { PK: `USER#${userId}`, SK: `SAVE#${saveId}` };
  }
  export function userPrefix(userId: string) {
    return `USER#${userId}`;
  }
  ```
  Then handlers use `saveKey(userId, saveId)` instead of the object literal.

---

## Minor Issues (Nice to Have)

### 4. [Similar Pattern] Conditional-check-failed disambiguation pattern in saves-delete and saves-restore

Both `saves-delete` and `saves-restore` have a structurally identical fallback pattern after a `conditionExpression` failure: catch `AppError(NOT_FOUND)`, re-fetch the item with `getItem`, then disambiguate between "already in target state" (idempotent success) vs "truly missing" (throw NOT_FOUND).

**saves-delete** (`/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-delete/handler.ts`:87-107):

```typescript
} catch (error) {
  if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
    const existing = await getItem<SaveItem>(
      client, SAVES_TABLE_CONFIG,
      { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
      {}, logger
    );
    if (existing && existing.deletedAt) {
      return createNoContentResponse(requestId);  // idempotent
    }
    throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
  }
  throw error;
}
```

**saves-restore** (`/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-restore/handler.ts`:74-94):

```typescript
} catch (error) {
  if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
    const existing = await getItem<SaveItem>(
      client, SAVES_TABLE_CONFIG,
      { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
      {}, logger
    );
    if (existing && !existing.deletedAt) {
      return toPublicSave(existing);  // idempotent
    }
    throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
  }
  throw error;
}
```

- **Problem:** The two blocks are structurally identical (same catch guard, same getItem call, same throw). The only difference is the disambiguation condition (`existing.deletedAt` vs `!existing.deletedAt`) and the idempotent return value.
- **Impact:** If the disambiguation logic needs to change (e.g., different error codes, logging additions), both handlers must be updated. This is a moderate abstraction opportunity.
- **Fix:** Consider extracting a shared `disambiguateConditionFailure(client, userId, saveId, opts, logger)` helper that accepts a predicate and idempotent-response factory. This is a "nice to have" because the two handlers intentionally have different idempotent return behaviors.

### 5. [Similar Pattern] Handler preamble pattern (destructure ctx, extract userId, get client) in all 6 handlers

All 6 handlers follow the same 3-line preamble:

```typescript
const { event, auth, logger[, requestId] } = ctx;
const userId = auth!.userId;
const client = getDefaultClient();
```

- **Files:** All 6 handler files.
- **Problem:** The preamble is nearly identical (minor variation: some destructure `requestId`, some do not). This is a common pattern in wrapped handlers.
- **Impact:** Very low. The pattern is idiomatic and each handler may destructure different fields. Extracting it would add indirection without meaningful benefit.
- **Fix:** No action recommended. This is standard handler boilerplate and is clear as-is. Flagging only for completeness.

### 6. [Similar Pattern] `"Save not found"` error message string repeated in 4 handlers

The exact string `"Save not found"` is used in `AppError(ErrorCode.NOT_FOUND, "Save not found")` throws across 4 handlers:

- `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-get/handler.ts`:38
- `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-update/handler.ts`:105
- `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-delete/handler.ts`:104
- `/Users/stephen/Documents/ai-learning-hub/backend/functions/saves-restore/handler.ts`:91

- **Problem:** Magic string repeated 4 times. If the error message needs standardization (e.g., for i18n or error catalog), it must be updated in 4 places.
- **Impact:** Very low. Error messages are typically static strings and rarely change. The consistency across handlers is actually good.
- **Fix:** Could define `SAVE_NOT_FOUND_MSG = "Save not found"` in `@ai-learning-hub/db/saves.ts` or create a `throwSaveNotFound()` helper, but the benefit is marginal.

---

## Summary

- **Total findings:** 6
- **Critical:** 0
- **Important:** 3 (items 1, 2, 3)
- **Minor:** 3 (items 4, 5, 6)
- **Recommendation:** PROCEED

**Rationale:** All three Important findings are DRY improvement opportunities (rate-limit call pattern, eventBus initialization + emission pattern, DynamoDB key construction). None involve semantic divergence or correctness risk. The handlers correctly import all schemas, types, constants, and helper functions from shared packages -- no local redefinitions of shared exports were found. The duplication that exists is at the "call-site boilerplate" level, not the "logic divergence" level.

The Important items are worth addressing in a future cleanup story but do not block the current work.
