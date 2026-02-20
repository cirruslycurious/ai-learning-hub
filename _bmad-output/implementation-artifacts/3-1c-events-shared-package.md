---
id: "3.1c"
title: "EventBridge Shared Package (@ai-learning-hub/events)"
status: ready-for-dev
depends_on: []
touches:
  - backend/shared/events
  - package.json (root workspace)
  - tsconfig.base.json (project references)
risk: low
---

# Story 3.1c: EventBridge Shared Package (@ai-learning-hub/events)

Status: ready-for-dev

## Story

As a developer building Lambda handlers that emit EventBridge events,
I want a shared `@ai-learning-hub/events` package with a typed, non-throwing event emitter,
so that all Lambdas emit events consistently without copy-pasting `EventBridgeClient` boilerplate.

## Acceptance Criteria

| #   | Given                                                      | When                                                                   | Then                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | A Lambda calls `emitEvent(client, busName, entry, logger)` | The EventBridge `PutEvents` call succeeds                              | The event is published; the function returns synchronously (return type is `void`, not `Promise<void>`)                                                                                                                                                                     |
| AC2 | A Lambda calls `emitEvent(...)` and PutEvents throws       | EventBridge call fails for any reason                                  | The error is caught internally, logged at `warn` level with `{ detailType, err }`, and the function still returns `void` — it never throws. Callers cannot accidentally block on it.                                                                                        |
| AC3 | Any Lambda initialises the module                          | Module loads                                                           | `getDefaultClient()` returns a singleton `EventBridgeClient` configured from `AWS_REGION` env var (fallback `us-east-1`). `createEventBridgeClient()` always constructs a new instance (for testing or custom config). `resetDefaultClient()` clears the singleton for test teardown. |
| AC4 | `emitEvent` is called                                      | Inspecting the `PutEventsCommand` payload                              | Entry shape: `{ Source, DetailType, Detail: JSON.stringify(detail), EventBusName: busName }`. Only one entry per call.                                                                                                                                                       |
| AC5 | Event catalog types are imported                           | TypeScript compilation                                                 | `SavesEventDetail` and `SavesEventDetailType` are exported. `emitEvent` is generic over `<TDetailType extends string, TDetail extends object>`: passing a `detailType` not assignable to `TDetailType` is a **compile error**. The `detail` shape is also enforced at compile time. |
| AC6 | `emitEvent` is called from a Lambda handler                | TypeScript compilation                                                 | `emitEvent` returns `void`. TypeScript itself does not error on `await voidFn()` — awaiting a `void` value is syntactically valid. The `@typescript-eslint/await-thenable` rule would flag it, but **that rule requires type-aware linting (`recommendedTypeChecked`) which this project has explicitly deferred** (see `eslint.config.js`). The practical enforcement is semantic: the `void` return type signals intent clearly, and a missing `await` has no compile consequence because there is nothing to await. This is a known limitation documented here so future developers understand the guarantee boundary. |
| AC7 | PutEvents returns `FailedEntryCount > 0`                   | Partial EventBridge failure                                            | Logged at `warn` level including `detailType`, `failedCount`, `errorCode`, and `errorMessage` from `result.Entries?.[0]` — the fields needed for production debugging.                                                                                                      |
| AC8 | Package is built                                           | `npm run build` in `backend/shared/events`                             | Clean TypeScript compilation with `.d.ts` declarations; package exports resolve correctly from `@ai-learning-hub/events`.                                                                                                                                                   |
| AC9 | Tests run                                                  | `npm test` in `backend/shared/events`                                  | All tests pass, ≥ 80% coverage enforced by `vitest.config.ts` thresholds (not just by CI flag).                                                                                                                                                                             |

## Tasks / Subtasks

- [ ] Task 1: Scaffold the package (AC: #3, #8)
  - [ ] 1.1 Create `backend/shared/events/` directory with `src/`, `src/events/`, and `test/` subdirectories
  - [ ] 1.2 Create `backend/shared/events/package.json` — name `@ai-learning-hub/events`; follow the exact structure of `@ai-learning-hub/db` (`"type": "module"`, `main`/`types`/`exports` pointing at `dist/index.js`, `build`/`test`/`lint` scripts, `@ai-learning-hub/logging` as dependency, `@aws-sdk/client-eventbridge` as dependency). See Dev Notes — package.json Template.
  - [ ] 1.3 Create `backend/shared/events/tsconfig.json` — extend `../../../tsconfig.base.json`, `outDir: dist`, `rootDir: src`, `composite: true`, `declaration: true`, `declarationMap: true`. `exclude: ["node_modules", "dist", "test"]`. References: `../logging` only (no `../types` — intentional; see Dev Notes — ContentType). See Dev Notes — tsconfig.json Template.
  - [ ] 1.4 Create `backend/shared/events/vitest.config.ts` — copy coverage threshold pattern from `@ai-learning-hub/db`; alias `@ai-learning-hub/logging` to its `src/index.ts`. See Dev Notes — vitest.config.ts Template.
  - [ ] 1.5 Add `"backend/shared/events"` to the `workspaces` array in root `package.json` (after `backend/shared/middleware`)
  - [ ] 1.6 Run `npm install` at workspace root to link the new package

- [ ] Task 2: Implement the EventBridge client module (AC: #3)
  - [ ] 2.1 Create `backend/shared/events/src/client.ts`
  - [ ] 2.2 Implement `createEventBridgeClient(options?: { region?: string }): EventBridgeClient` — always constructs and returns a new `EventBridgeClient`; mirrors `createDynamoDBClient` in `@ai-learning-hub/db`
  - [ ] 2.3 Implement `getDefaultClient(): EventBridgeClient` — module-level singleton; constructs on first call via `createEventBridgeClient()`, returns same instance on subsequent calls
  - [ ] 2.4 Implement `/** @internal — for test teardown only */ resetDefaultClient(): void` — sets singleton to `null`. Add the `@internal` JSDoc annotation so tooling and reviewers know this must not be called in production code.
  - [ ] 2.5 Add X-Ray tracing comment matching the pattern in `@ai-learning-hub/db/src/client.ts` — note that EventBridge subsegment capture is deferred, same as DynamoDB. See Dev Notes — X-Ray.

- [ ] Task 3: Implement the event emitter (AC: #1, #2, #4, #6, #7)
  - [ ] 3.1 Create `backend/shared/events/src/emitter.ts`
  - [ ] 3.2 Define `EventEntry<TDetailType extends string, TDetail extends object>` interface: `{ source: string; detailType: TDetailType; detail: TDetail }` — two generics so both `detailType` and `detail` are type-constrained at the call site
  - [ ] 3.3 Implement `emitEvent<TDetailType extends string, TDetail extends object>(client, busName, entry, logger): void` — **return type is `void`**, not `Promise<void>`; the async work runs inside a fire-and-forget IIFE. See Dev Notes — Emitter Module for the exact pattern.
  - [ ] 3.4 Inside the IIFE: send `PutEventsCommand` with `{ Source, DetailType, Detail: JSON.stringify(entry.detail), EventBusName: busName }`
  - [ ] 3.5 After a successful send: check `result.FailedEntryCount > 0`; if true, log `warn` including `detailType`, `failedCount`, `errorCode: result.Entries?.[0]?.ErrorCode`, `errorMessage: result.Entries?.[0]?.ErrorMessage`
  - [ ] 3.6 In the `catch` block: wrap the `logger.warn(...)` call in its own inner try/catch with an empty catch body (`catch {}`). If `logger.warn` itself throws (logging library bug, serialization error), the outer IIFE's promise would become an unhandled rejection — which terminates the Node 20 Lambda process. The inner try/catch prevents this. Never rethrow from either catch.
  - [ ] 3.7 Add a dev note (inline comment) in `emitter.ts` about `JSON.stringify` constraints — see Dev Notes — JSON.stringify Constraints

- [ ] Task 4: Define typed event catalog for the Saves domain (AC: #5)
  - [ ] 4.1 Create `backend/shared/events/src/events/saves.ts`
  - [ ] 4.2 Define `SavesEventDetailType` as `'SaveCreated' | 'SaveRestored'` — **only these two** because they are the only Saves events emitted in Epic 3 stories 3.1b and 3.3 (restore path). `SaveUpdated` and `SaveDeleted` are deferred to Story 3.3 where their distinct detail shapes will be defined.
  - [ ] 4.3 Define `SavesEventDetail` interface matching the architecture spec (see Dev Notes — Event Catalog). Note: `contentType` is typed as `string`, not the `ContentType` enum — see Dev Notes — ContentType.
  - [ ] 4.4 Export `SAVES_EVENT_SOURCE = 'ai-learning-hub.saves' as const` — callers import this constant instead of repeating the magic string. Prevents source typos that cause EventBridge rules to silently receive events no rule matches.
  - [ ] 4.5 Export `SavesEventDetailType`, `SavesEventDetail`, and `SAVES_EVENT_SOURCE` from `backend/shared/events/src/events/saves.ts`
  - [ ] 4.6 Re-export all three from `backend/shared/events/src/index.ts`

- [ ] Task 5: Wire the index exports (AC: #3, #5, #8)
  - [ ] 5.1 Create `backend/shared/events/src/index.ts` that exports all public symbols (see Dev Notes — Public Exports)

- [ ] Task 6: Write tests (AC: #9)
  - [ ] 6.1 Create `backend/shared/events/test/emitter.test.ts`
  - [ ] 6.2 Test: `emitEvent` calls `PutEventsCommand` with correct `Source`, `DetailType`, `Detail` (JSON-serialised), `EventBusName`
  - [ ] 6.3 Test: `emitEvent` returns `void` synchronously and does NOT return a Promise — `const r = emitEvent(...); assert(r === undefined)`
  - [ ] 6.4 Test: when PutEvents throws, `emitEvent` does NOT throw at the call site AND `logger.warn` is called with the error — **call `await flushPromises()` after `emitEvent(...)` and before asserting** (the async work runs in a detached IIFE; assertions need the microtask queue to drain). Use the `flushPromises` helper defined in Dev Notes — Test Timing. Do NOT use `vi.runAllMicrotasksAsync()` — this function does not exist in Vitest 3.x.
  - [ ] 6.5 Test: when `FailedEntryCount > 0`, `emitEvent` does NOT throw AND `logger.warn` is called with `errorCode` and `errorMessage` from the SDK response — same `flushPromises()` drain technique as 6.4
  - [ ] 6.6 Test: when `FailedEntryCount === 0` (success), `logger.warn` is NOT called — **also requires `await flushPromises()` before asserting**; without it the test is a false positive (the IIFE hasn't completed, so warn simply hasn't run yet rather than genuinely not having been called)
  - [ ] 6.7 Create `backend/shared/events/test/client.test.ts` — test singleton lifecycle: first call to `getDefaultClient()` creates client, second call returns same instance, `resetDefaultClient()` clears it so next call creates a new instance
  - [ ] 6.8 Mock `EventBridgeClient` via `vi.mock('@aws-sdk/client-eventbridge')` in all tests

- [ ] Task 7: Quality gates
  - [ ] 7.1 `npm run build` from workspace root — clean compilation including the new package
  - [ ] 7.2 `npm test` from workspace root — all tests pass (new + existing ≥ 1,243); `vitest.config.ts` thresholds enforce 80% coverage
  - [ ] 7.3 `npm run lint` — no errors
  - [ ] 7.4 `npm run type-check` — no type errors
  - [ ] 7.5 `npm run format` — run Prettier on all new files

## Dev Notes

### Why This Story Exists Before 3.1b

Story 3.1b (Create Save API) is the first Lambda to emit EventBridge events. Without this package, 3.1b would inline its own `EventBridgeClient` + `emitSavesEvent` function (as noted in 3.1b's dev notes). Stories 3.3, 3.5, Epic 9, and others all emit events too. Creating the shared package first means 3.1b (and every downstream story) imports a consistent, tested abstraction instead of accumulating copy-paste boilerplate that would require a cleanup story to fix.

**3.1b will use this package** — its dev notes have already been updated to import from `@ai-learning-hub/events`. The CDK EventBridge stack (`events.stack.ts`) stays in 3.1b — that is infrastructure setup, not the shared library.

### Package Structure

```
backend/shared/events/
├── src/
│   ├── client.ts          # EventBridgeClient singleton
│   ├── emitter.ts         # emitEvent() helper
│   ├── events/
│   │   └── saves.ts       # Saves domain event types
│   └── index.ts           # Public exports
├── test/
│   ├── client.test.ts
│   └── emitter.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Client Module Pattern

Mirror `@ai-learning-hub/db`'s `client.ts`. Key distinction: `createEventBridgeClient()` always returns a **new** instance; `getDefaultClient()` is the singleton. AC3 reflects this correctly — do not conflate the two functions.

```typescript
/**
 * EventBridge client for Lambda.
 *
 * X-Ray: Lambda injects _X_AMZN_TRACE_ID; trace ID is available via env for
 * logging/correlation. EventBridge subsegment capture (aws-xray-sdk) is deferred
 * to a later story; use the Lambda trace for request-level tracing until then.
 */
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';

let defaultClient: EventBridgeClient | null = null;

export function createEventBridgeClient(options: { region?: string } = {}): EventBridgeClient {
  return new EventBridgeClient({
    region: options.region ?? process.env.AWS_REGION ?? 'us-east-1',
  });
}

export function getDefaultClient(): EventBridgeClient {
  if (!defaultClient) {
    defaultClient = createEventBridgeClient();
  }
  return defaultClient;
}

/**
 * @internal — for test teardown only. Do not call in production code.
 */
export function resetDefaultClient(): void {
  defaultClient = null;
}
```

### Emitter Module

`emitEvent` returns **`void`** (not `Promise<void>`). The async work runs inside a detached IIFE. This means:
- Callers naturally fire-and-forget: `emitEvent(client, bus, entry, logger);`
- TypeScript itself does NOT error on `await emitEvent(...)` — awaiting a `void` value is syntactically valid. The `@typescript-eslint/await-thenable` rule would catch it, but requires type-aware linting which this project has deferred (see AC6 for the full explanation).
- The `void` return type is a strong semantic signal, not a hard compiler barrier. Code review should reject any `await emitEvent(...)` call site.
- The `void` prefix (`void emitEvent(...)`) is redundant and should be omitted — the return type is already `void`.

```typescript
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { Logger } from '@ai-learning-hub/logging';

export interface EventEntry<TDetailType extends string, TDetail extends object> {
  source: string;
  detailType: TDetailType;
  detail: TDetail;
}

export function emitEvent<TDetailType extends string, TDetail extends object>(
  client: EventBridgeClient,
  busName: string,
  entry: EventEntry<TDetailType, TDetail>,
  logger: Logger,
): void {
  // Fire-and-forget: async work runs in a detached IIFE. Return type is void so
  // callers cannot accidentally await this function and block the response path.
  void (async () => {
    try {
      const result = await client.send(
        new PutEventsCommand({
          Entries: [{
            Source: entry.source,
            DetailType: entry.detailType,
            // JSON.stringify constraints: undefined fields are silently omitted,
            // Date objects serialize to ISO strings, circular references throw (caught
            // below). Callers must pass plain serializable objects — no class instances.
            Detail: JSON.stringify(entry.detail),
            EventBusName: busName,
          }],
        }),
      );
      if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        logger.warn('EventBridge PutEvents partial failure (non-fatal)', undefined, {
          detailType: entry.detailType,
          failedCount: result.FailedEntryCount,
          errorCode: result.Entries?.[0]?.ErrorCode,
          errorMessage: result.Entries?.[0]?.ErrorMessage,
        });
      }
    } catch (err) {
      // Inner try/catch around logger.warn is REQUIRED: if logger.warn throws
      // (logging library bug, serialization error), the exception would propagate
      // out of this catch block into the detached IIFE's promise. In Node 20,
      // unhandled promise rejections terminate the process — crashing the Lambda.
      try {
        logger.warn('EventBridge PutEvents failed (non-fatal)', err as Error, {
          detailType: entry.detailType,
        });
      } catch {
        // logger itself failed — nothing safe to do here
      }
    }
  })();
}
```

### JSON.stringify Constraints

Add this as an inline comment in `emitter.ts` (shown above) and be aware when writing tests:

- **`undefined` fields are silently dropped** — `{ foo: undefined }` serializes to `{}`. If a field is required by downstream consumers, make it non-optional in the detail type.
- **`Date` objects serialize to ISO strings** — generally fine but not explicit in types.
- **Circular references throw** — the throw lands in the `catch` block and is logged as a warn. The event is silently swallowed, not retried. Do not pass objects with circular references as `detail`.
- **Plain objects only** — no class instances in `detail`. All exported detail interfaces use primitive types; callers construct them inline.

### Event Catalog — Saves Domain

Define in `src/events/saves.ts`. Only define what has a concrete detail shape today:

```typescript
/**
 * EventBridge source for all Saves domain events.
 * Import this constant — do not repeat the string literal at call sites.
 */
export const SAVES_EVENT_SOURCE = 'ai-learning-hub.saves' as const;

/**
 * Detail types for Saves domain events emitted in Epic 3.
 * SaveUpdated and SaveDeleted will be added in Story 3.3 with their distinct detail shapes.
 */
export type SavesEventDetailType = 'SaveCreated' | 'SaveRestored';

export interface SavesEventDetail {
  userId: string;
  saveId: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  /** Typed as string, not the ContentType enum — see Dev Notes: ContentType */
  contentType: string;
}
```

`SaveCreated` and `SaveRestored` share the same detail shape in Story 3.1b. When Story 3.3 adds `SaveUpdated` (which needs `updatedFields`) and `SaveDeleted`, it will extend `SavesEventDetailType` and add the appropriate interfaces. Story 3.3 should also consider converting to a discriminated union at that point.

### ContentType: string, not the Enum

`SavesEventDetail.contentType` is typed as `string` rather than the `ContentType` enum from `@ai-learning-hub/types`. This is **intentional**:

- Adding `@ai-learning-hub/types` as a dependency couples `@ai-learning-hub/events` to the types package. EventBridge events cross domain boundaries (Epic 9 enrichment, Epic 7 search, future external consumers) and their payloads should be loosely typed at the wire level.
- Lambda handlers that call `emitEvent` already have `contentType` typed as `ContentType` from `@ai-learning-hub/types`. TypeScript will accept a `ContentType` enum value for a `string`-typed field without complaint (enums are assignable to their base type).
- If strict type-checking at the call site is desired in the future, callers can cast: `contentType: save.contentType as string` — but this is unnecessary in practice.

### How Story 3.1b Will Use This Package

```typescript
import {
  emitEvent,
  getDefaultClient,
  SAVES_EVENT_SOURCE,
  type SavesEventDetailType,
  type SavesEventDetail,
} from '@ai-learning-hub/events';

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;
if (!EVENT_BUS_NAME) throw new Error('EVENT_BUS_NAME env var is not set');

// Module-level singleton — reused across warm invocations
const ebClient = getDefaultClient();

// Inside handler — synchronous call, fire-and-forget by return type:
emitEvent<SavesEventDetailType, SavesEventDetail>(ebClient, EVENT_BUS_NAME, {
  source: SAVES_EVENT_SOURCE,              // const — no magic string drift
  detailType: 'SaveCreated',               // compile error if not in SavesEventDetailType
  detail: { userId, saveId, url, normalizedUrl, urlHash, contentType },  // compile error if shape wrong
}, logger);
return createSuccessResponse(toPublicSave(saved), requestId, 201);
```

### Test Timing — Fire-and-Forget Async

Because `emitEvent` returns `void` and the async work runs in a detached IIFE, test assertions about `logger.warn` or `PutEventsCommand` call counts must wait for the microtask queue to drain **before asserting**. Without draining, assertions run before the IIFE has resolved — producing both false negatives (warn not called yet on failure paths) and false positives (warn not called yet on success paths).

**Do NOT use `vi.runAllMicrotasksAsync()`** — this function does not exist in Vitest 3.x. The available fake-timer APIs (`vi.runAllTicks()`, `vi.runAllTimers()`) operate only when fake timers are active and are not relevant here.

Define a `flushPromises` helper at the top of each test file and use it after every `emitEvent(...)` call that requires assertions:

```typescript
// Drains the microtask queue and any pending I/O callbacks.
// Required after calling emitEvent() to allow the detached IIFE to complete
// before asserting on logger.warn or PutEventsCommand call counts.
const flushPromises = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0));

it('logs warn when PutEvents throws', async () => {
  mockSend.mockRejectedValueOnce(new Error('throttled'));

  emitEvent(client, 'bus', entry, mockLogger);  // synchronous call

  await flushPromises();  // drain the detached IIFE before asserting

  expect(mockLogger.warn).toHaveBeenCalledWith(
    'EventBridge PutEvents failed (non-fatal)',
    expect.any(Error),
    expect.objectContaining({ detailType: entry.detailType }),
  );
});

it('does NOT call logger.warn on success', async () => {
  mockSend.mockResolvedValueOnce({ FailedEntryCount: 0, Entries: [] });

  emitEvent(client, 'bus', entry, mockLogger);

  await flushPromises();  // required even on success path — false positive without it

  expect(mockLogger.warn).not.toHaveBeenCalled();
});
```

`setTimeout(resolve, 0)` runs after all pending microtasks and I/O callbacks in the current event loop turn, making it reliable for draining an async IIFE whose mocked `client.send` resolves synchronously.

This also applies to the 3.1b tests (Task 5.4): call the handler, then `await flushPromises()` before asserting `logger.warn` was called with the EventBridge error. The 201 response assertion can run immediately — it precedes `emitEvent` in handler execution order.

### Lambda Freeze / At-Most-Once Delivery

**This is a known trade-off of the fire-and-forget design in Lambda specifically.**

When the Lambda handler returns (after `return createSuccessResponse(...)`), AWS may freeze the execution environment before the detached IIFE's `PutEventsCommand` network call completes. If Lambda freezes mid-flight, the event is never delivered to EventBridge. On the next warm invocation the environment is thawed, but the in-flight request from the previous invocation is gone.

This means event delivery is **best-effort / at-most-once**, not guaranteed:
- If Lambda stays warm (typical on warm invocations with concurrent traffic), the IIFE completes in the background before the environment is frozen — events are delivered.
- If Lambda freezes immediately after the handler returns (e.g., no concurrent traffic, end of burst), the in-flight request is dropped — events are silently lost.

**At boutique scale (< 100 users) this is an accepted trade-off**: the NFR-P2 latency requirement (< 1s response) outweighs the risk of occasional event loss. Downstream pipelines (Epic 9 enrichment, Epic 7 search) are idempotent and will catch up via other triggers. Do not change this design without a confirmed scale requirement.

If guaranteed delivery becomes a requirement: move event emission into a DynamoDB Stream trigger or use a transactional outbox pattern instead.

### package.json Template

```json
{
  "name": "@ai-learning-hub/events",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run --coverage",
    "lint": "eslint ."
  },
  "dependencies": {
    "@ai-learning-hub/logging": "*",
    "@aws-sdk/client-eventbridge": "^3.490.0"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^3.2.4",
    "typescript": "~5.3.0",
    "vitest": "^3.2.4"
  }
}
```

**SDK version note:** `^3.490.0` matches the `@aws-sdk/*` versions in `@ai-learning-hub/db/package.json`. If `@ai-learning-hub/db` is upgraded to a newer SDK version in a future story, update this package in the same PR to keep them in sync. The monorepo does not currently enforce a shared AWS SDK version via root `resolutions` — keeping the versions consistent manually is the current convention.

### tsconfig.json Template

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"],
  "references": [
    { "path": "../logging" }
  ]
}
```

Notes:
- No `../types` reference — intentional; see Dev Notes — ContentType.
- `exclude` uses `"test"` (not `"**/*.test.ts"`). Tests live in `test/`, not under `src/`. Since `rootDir` is `src`, TypeScript would never compile `test/**` anyway; the pattern `**/*.test.ts` was misleading and is not used here.

### vitest.config.ts Template

Copy from `@ai-learning-hub/db/vitest.config.ts`, but alias only `@ai-learning-hub/logging` (no types alias needed):

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ai-learning-hub/logging': path.join(__dirname, '..', 'logging', 'src', 'index.ts'),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

This wires the 80% coverage threshold directly in the package so `npm test` fails locally (not just in CI) if coverage drops.

### Public Exports (`src/index.ts`)

```typescript
// Client
export { createEventBridgeClient, getDefaultClient, resetDefaultClient } from './client.js';

// Emitter
export { emitEvent, type EventEntry } from './emitter.js';

// Event catalog — Saves domain
export { SAVES_EVENT_SOURCE, type SavesEventDetailType, type SavesEventDetail } from './events/saves.js';
```

### Architecture Compliance

| ADR | How This Story Complies |
|-----|-------------------------|
| ADR-003 (EventBridge) | Provides the standard emission pattern; `void` return type ensures event failures never block the API response path |
| ADR-005 (No L2L) | Package emits to EventBridge only — no Lambda-to-Lambda calls |
| ADR-008 (Error Handling) | `emitEvent` never throws; error is logged and swallowed so callers' response shapes are unaffected |

### Testing Standards

- **Framework:** Vitest (matches all other backend packages)
- **Coverage:** 80% minimum — enforced by `vitest.config.ts` thresholds (fails locally, not just CI)
- **Mock pattern:** `vi.mock('@aws-sdk/client-eventbridge')` — mock `EventBridgeClient.prototype.send` or use `vi.fn()` on the mock instance. Check `backend/shared/db/test/` for existing mock patterns.
- **Logger mock:** Use `vi.fn()` on `logger.warn` to assert it is called (and only called) on failure paths
- **Async timing:** All assertions about `logger.warn` and `PutEventsCommand` after calling `emitEvent` must follow `await flushPromises()` (see Dev Notes — Test Timing for the helper definition). This applies to both failure and success-path tests. Do NOT use `vi.runAllMicrotasksAsync()` — it does not exist in Vitest 3.x.

### Project Structure Notes

- New package: `backend/shared/events/` (create from scratch — no `.gitkeep` exists yet)
- Modified: root `package.json` — add `"backend/shared/events"` to `workspaces`
- No changes to `infra/` — the CDK EventBridge stack is created in Story 3.1b
- No changes to other shared packages

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-003] — EventBridge + Step Functions async pattern; event catalog
- [Source: backend/shared/db/src/client.ts] — Singleton client pattern (and X-Ray comment) to mirror
- [Source: backend/shared/db/package.json] — package.json template to follow
- [Source: backend/shared/db/tsconfig.json] — tsconfig template to follow
- [Source: backend/shared/db/vitest.config.ts] — vitest.config.ts coverage threshold pattern to follow
- [Source: _bmad-output/implementation-artifacts/3-1b-create-save-api.md#EventBridge] — Inline implementation this package replaces; fire-and-forget requirement; `EVENT_BUS_NAME` env var guard

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List
