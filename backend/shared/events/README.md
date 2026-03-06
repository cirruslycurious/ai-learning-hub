# @ai-learning-hub/events

EventBridge client and typed event emitter for fire-and-forget domain event publishing. All async workflows (enrichment, search sync, notifications) are triggered through this package.

## Quick start

```ts
import { requireEventBus, emitEvent } from "@ai-learning-hub/events";
import { SAVES_EVENT_SOURCE } from "@ai-learning-hub/events";

// Initialise at cold start (module scope)
const { busName, ebClient } = requireEventBus();

// Emit in a handler (fire-and-forget — does not block the response)
emitEvent(
  ebClient,
  busName,
  {
    source: SAVES_EVENT_SOURCE,
    detailType: "SaveCreated",
    detail: { userId, saveId, url, normalizedUrl, urlHash, contentType },
  },
  logger
);
```

## Client

```ts
import {
  createEventBridgeClient,
  getDefaultClient,
  resetDefaultClient,
} from "@ai-learning-hub/events";
```

- `createEventBridgeClient()` — create a new `EventBridgeClient` (use for tests)
- `getDefaultClient()` — module-level singleton; created once at cold start
- `resetDefaultClient()` — reset singleton for tests

## `requireEventBus()`

```ts
import { requireEventBus } from "@ai-learning-hub/events";

const { busName, ebClient } = requireEventBus();
```

Call once at module scope (outside the handler). Reads `EVENT_BUS_NAME` from the environment — set by CDK at deploy time. Throws at cold start if the env var is missing (except in `NODE_ENV=test`).

## `emitEvent(client, busName, entry, logger)`

```ts
import { emitEvent } from "@ai-learning-hub/events";
import type { EventEntry } from "@ai-learning-hub/events";
```

**Fire-and-forget.** Returns `void` synchronously — the `PutEvents` call happens in a detached async IIFE and does not block the Lambda response. Failures are logged as warnings (non-fatal) and never propagate to the caller.

```ts
interface EventEntry<TDetailType, TDetail> {
  source: string; // e.g. "ai-learning-hub.saves"
  detailType: TDetailType; // e.g. "SaveCreated"
  detail: TDetail; // Must be a plain serialisable object — no class instances
}
```

**Important:** Pass plain objects in `detail`. `JSON.stringify` is called internally — `undefined` fields are silently dropped, circular references throw (caught and logged).

## Saves domain events

```ts
import {
  SAVES_EVENT_SOURCE,
  type SavesEventDetailType,
  type SavesEventDetail,
  type SaveCreatedRestoredDetail,
  type SaveUpdatedDetail,
  type SaveDeletedDetail,
  type SavesEventMap,
} from "@ai-learning-hub/events";
```

### `SAVES_EVENT_SOURCE`

String constant `"ai-learning-hub.saves"` — always use this, never repeat the string literal.

### Event detail types

| `detailType`     | Detail interface            | When                       |
| ---------------- | --------------------------- | -------------------------- |
| `"SaveCreated"`  | `SaveCreatedRestoredDetail` | New save created           |
| `"SaveRestored"` | `SaveCreatedRestoredDetail` | Soft-deleted save restored |
| `"SaveUpdated"`  | `SaveUpdatedDetail`         | Save metadata patched      |
| `"SaveDeleted"`  | `SaveDeletedDetail`         | Save soft-deleted          |

```ts
interface SaveCreatedRestoredDetail {
  userId: string;
  saveId: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  contentType: string; // string, not ContentType enum — avoids coupling to types pkg
}

interface SaveUpdatedDetail {
  userId: string;
  saveId: string;
  normalizedUrl: string;
  // changedFields included in full detail shape
}

interface SaveDeletedDetail {
  userId: string;
  saveId: string;
  normalizedUrl: string;
}
```

## Adding new domain events

1. Create `src/events/<domain>.ts` following the `saves.ts` pattern
2. Export a `<DOMAIN>_EVENT_SOURCE` constant
3. Define `Detail` interfaces and a `DetailType` union
4. Re-export everything from `src/index.ts`

Do not reuse `SAVES_EVENT_SOURCE` for a different domain — each domain has its own source string for EventBridge rule targeting.

## Environment variables

| Variable         | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `EVENT_BUS_NAME` | EventBridge bus name — set by CDK; required at runtime |
