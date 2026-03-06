# @ai-learning-hub/events

EventBridge client and event catalog for the AI Learning Hub. All Lambda handlers that publish domain events MUST import from this package — do not use `@aws-sdk/client-eventbridge` directly in handler code.

**Package path:** `backend/shared/events/src/`  
**ADR:** ADR-003 (EventBridge + Step Functions for all async work; no Lambda-to-Lambda, no SQS for workflows)

---

## Key Exports

| Export | Kind | Purpose |
|---|---|---|
| `requireEventBus()` | Helper | Call once at module scope (cold start) to extract `busName` + `ebClient` from env |
| `emitEvent()` | Function | Fire-and-forget publish to EventBridge; never throws; logs failures as WARN |
| `EventEntry<TDetailType, TDetail>` | Interface | Typed event payload passed to `emitEvent` |
| `createEventBridgeClient()` | Function | Creates an `EventBridgeClient`; used by `requireEventBus` internally |
| `getDefaultClient()` / `resetDefaultClient()` | Functions | Singleton client; `resetDefaultClient` is test-only |
| `SAVES_EVENT_SOURCE` | Const | `"ai-learning-hub.saves"` — use this, never repeat the string |
| `SavesEventDetailType` | Union type | `"SaveCreated" \| "SaveRestored" \| "SaveUpdated" \| "SaveDeleted"` |
| `SavesEventMap` | Mapped type | Compile-time coupling between `detailType` → detail shape |
| `SaveCreatedRestoredDetail` | Interface | Payload for SaveCreated / SaveRestored events |
| `SaveUpdatedDetail` | Interface | Payload for SaveUpdated events (includes `updatedFields`) |
| `SaveDeletedDetail` | Interface | Payload for SaveDeleted events |

---

## Required Environment Variable

```
EVENT_BUS_NAME   — EventBridge custom bus name; set by CDK at deploy time
```

`requireEventBus()` will throw at cold start if `EVENT_BUS_NAME` is not set (suppressed in test environment).

---

## Standard Usage Pattern

Call `requireEventBus()` once at module scope (outside the handler), then call `emitEvent()` inside the handler after a successful write:

```typescript
import { requireEventBus, emitEvent, SAVES_EVENT_SOURCE } from "@ai-learning-hub/events";
import type { SaveCreatedRestoredDetail } from "@ai-learning-hub/events";
import { logger } from "@ai-learning-hub/logging";

// Cold-start: extract bus name and client once
const { busName, ebClient } = requireEventBus();

export const handler = async (event: APIGatewayProxyEvent) => {
  // ... write to DynamoDB ...

  // Fire-and-forget after successful write — never await
  emitEvent<"SaveCreated", SaveCreatedRestoredDetail>(
    ebClient,
    busName,
    {
      source: SAVES_EVENT_SOURCE,
      detailType: "SaveCreated",
      detail: {
        userId,
        saveId,
        url,
        normalizedUrl,
        urlHash,
        contentType,
      },
    },
    logger
  );

  return successResponse;
};
```

---

## Critical Design Properties

**Fire-and-forget:** `emitEvent` is `void` — callers cannot `await` it. EventBridge publish runs in a detached IIFE inside the function. This keeps the Lambda response path independent of event delivery.

**Non-fatal failures:** If EventBridge `PutEvents` fails or partially fails, a `WARN` is logged and the handler's response is unaffected. The save is already committed to DynamoDB; event delivery is best-effort at this tier.

**Serialization contract:** Pass plain serializable objects as `detail` — no class instances, no `Date` objects, no circular references. `undefined` fields are silently omitted by `JSON.stringify`.

**Type safety:** Use `SavesEventMap` to enforce compile-time coupling between `detailType` and payload shape:

```typescript
type Detail = SavesEventMap["SaveDeleted"]; // SaveDeletedDetail
```

---

## Adding a New Event Domain

1. Create `backend/shared/events/src/events/<domain>.ts` following the shape of `saves.ts`
2. Export a `<DOMAIN>_EVENT_SOURCE` const, a `DetailType` union, detail interfaces, and an `EventMap`
3. Re-export from `backend/shared/events/src/index.ts`

Do not add new event schemas directly inside handler files — all event types belong in this package.

---

## References

- ADR-003: EventBridge + Step Functions for async; no SQS for workflows
- ADR-005: No Lambda-to-Lambda; use EventBridge for async cross-domain calls
- Source: `backend/shared/events/src/`
- Tests: `backend/shared/events/src/*.test.ts`
