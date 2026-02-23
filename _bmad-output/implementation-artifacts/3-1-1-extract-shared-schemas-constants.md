---
id: "3.1.1"
title: "Extract Shared Schemas & Constants"
status: ready-for-dev
depends_on: []
touches:
  - backend/shared/validation/src/schemas.ts
  - backend/shared/validation/src/index.ts
  - backend/shared/db/src/saves.ts
  - backend/shared/db/src/index.ts
  - backend/shared/events/src/index.ts
  - backend/functions/saves-get/handler.ts
  - backend/functions/saves-update/handler.ts
  - backend/functions/saves-delete/handler.ts
  - backend/functions/saves-restore/handler.ts
  - backend/functions/saves/handler.ts
risk: low
---

# Story 3.1.1: Extract Shared Schemas & Constants

Status: ready-for-dev

## Story

As a developer,
I want duplicated schemas, constants, and helpers extracted into shared packages,
so that policy changes (rate limits, validation rules, EventBridge config) only need to be updated in one place.

## Acceptance Criteria

| #   | Given                                                                                                    | When                                                            | Then                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| AC1 | `saveIdPathSchema` defined locally in 4 handlers (saves-get, saves-update, saves-delete, saves-restore)  | Schema extracted to `@ai-learning-hub/validation`               | All 4 handlers import from shared package; no local `saveIdPathSchema` definitions remain in any handler file         |
| AC2 | Rate limit config `{ operation: "saves-write", limit: 200, windowSeconds: 3600 }` repeated in 4 handlers | Config extracted to `@ai-learning-hub/db/saves`                 | All 4 handlers import `SAVES_WRITE_RATE_LIMIT` constant; no inline rate limit config objects remain                   |
| AC3 | EventBridge init boilerplate repeated in 4 handlers                                                      | Helper `requireEventBus()` created in `@ai-learning-hub/events` | All 4 handlers call `requireEventBus()` instead of inline `process.env.EVENT_BUS_NAME` + guard + `getDefaultClient()` |
| AC4 | All existing tests pass                                                                                  | After all extractions                                           | `npm test` passes with 0 failures; no behavioral changes                                                              |

## Tasks / Subtasks

- [ ] Task 1: Extract `saveIdPathSchema` (AC: #1)
  - [ ] 1.1 Add `saveIdPathSchema` to `backend/shared/validation/src/schemas.ts` alongside existing `createSaveSchema`, `updateSaveSchema`, `listSavesQuerySchema`. Use this exact definition (must match current handler definitions character-for-character):
    ```typescript
    export const saveIdPathSchema = z.object({
      saveId: z
        .string()
        .regex(/^[0-9A-Z]{26}$/, "saveId must be a 26-character ULID"),
    });
    ```
  - [ ] 1.2 Export from `backend/shared/validation/src/index.ts`
  - [ ] 1.3 Rebuild validation package: `npm run -w @ai-learning-hub/validation build`
  - [ ] 1.4 Update imports in `saves-get/handler.ts`, `saves-update/handler.ts`, `saves-delete/handler.ts`, `saves-restore/handler.ts`
  - [ ] 1.5 Remove local `saveIdPathSchema` definitions from all 4 handlers
  - [ ] 1.6 Verify: `grep -r "const saveIdPathSchema" backend/functions/` returns no matches

- [ ] Task 2: Extract rate limit constant (AC: #2)
  - [ ] 2.1 Add to `backend/shared/db/src/saves.ts`:
    ```typescript
    export const SAVES_WRITE_RATE_LIMIT = {
      operation: "saves-write",
      limit: 200,
      windowSeconds: 3600,
    } as const;
    ```
  - [ ] 2.2 Export from `backend/shared/db/src/index.ts`
  - [ ] 2.3 Update `saves/handler.ts`, `saves-update/handler.ts`, `saves-delete/handler.ts`, `saves-restore/handler.ts` to use:
    ```typescript
    await enforceRateLimit(client, USERS_TABLE_CONFIG.tableName, {
      ...SAVES_WRITE_RATE_LIMIT,
      identifier: userId,
    }, logger);
    ```

- [ ] Task 3: Extract EventBridge init helper (AC: #3)
  - [ ] 3.1 Add `requireEventBus()` to the events package (e.g., `backend/shared/events/src/index.ts` or a new `init.ts`):
    ```typescript
    export function requireEventBus() {
      const busName = process.env.EVENT_BUS_NAME;
      if (!busName && process.env.NODE_ENV !== "test")
        throw new Error("EVENT_BUS_NAME env var is not set");
      return { busName: busName ?? "", ebClient: getDefaultClient() };
    }
    ```
  - [ ] 3.2 If `requireEventBus` is implemented in a new file (e.g., `init.ts`), re-export it from `backend/shared/events/src/index.ts` so the public API remains `@ai-learning-hub/events`
  - [ ] 3.3 Update all 4 handlers: at module scope, set `const eventBus = requireEventBus();`. In the handler body, use `eventBus.ebClient` and `eventBus.busName` for all `emitEvent(...)` calls. Do not call `requireEventBus()` inside the handler function or retain a separate EventBridge client getter.
  - [ ] 3.4 Remove the 4 inline `const EVENT_BUS_NAME = ...` + guard + `getDefaultEBClient()` blocks
  - [ ] 3.5 Update test mocks: in each of the 4 handler test files that mock `@ai-learning-hub/events` (saves, saves-update, saves-delete, saves-restore), add `requireEventBus` to the mock: `requireEventBus: () => ({ busName: "test-event-bus", ebClient: {} })`. Without this, handler module-level `requireEventBus()` calls will fail on test load.

- [ ] Task 4: Verify all tests pass (AC: #4)
  - [ ] 4.1 Run `npm test` — all tests must pass
  - [ ] 4.2 Run `npm run type-check` — clean
  - [ ] 4.3 Run `npm run lint` — clean

## Dev Notes

### Key principle: behavioral equivalence

This story makes ZERO behavioral changes. Every extraction must produce identical runtime behavior. If any test breaks, the extraction introduced a regression — fix the extraction, not the test.

### Validation package rebuild required

After modifying `backend/shared/validation/src/schemas.ts`, you MUST run `npm run -w @ai-learning-hub/validation build` before running tests. The handlers import from the compiled output, not the source. This was a lesson from Story 3.4 implementation.

### EventBridge helper design

The `requireEventBus()` function must be called once at module scope (cold start), not inside the handler function body. Store the result: `const eventBus = requireEventBus();`. In handler body code, reference `eventBus.busName` and `eventBus.ebClient` for `emitEvent(...)` calls. This preserves the existing behavior where the env guard and client init run once on cold start.

### Rate limit constant design

Use `as const` on the rate limit config to get literal types. Handlers spread it with `{ ...SAVES_WRITE_RATE_LIMIT, identifier: userId }` to add the per-request `identifier` field.

## Architecture Compliance

| ADR / NFR           | How This Story Must Comply                                                    |
| ------------------- | ----------------------------------------------------------------------------- |
| **NFR-M1 (DRY)**   | Primary purpose — eliminate duplication                                        |
| **ADR-008**         | No changes to error response format                                           |
| **Shared libs**     | Extractions go INTO shared libs (`@ai-learning-hub/validation`, `db`, `events`) |

## Testing Requirements

### No new tests required

This story only moves existing code into shared packages. Existing tests validate the behavior. If a test breaks, the extraction is wrong.

### Quality gates (must be green)

- `npm test`
- `npm run lint`
- `npm run type-check`

## Previous Story Intelligence

### From Epic 3 Stories 3.1a–3.4

- **Validation package rebuild**: After adding exports to `@ai-learning-hub/validation`, always rebuild before running tests
- **Event mock in tests**: The 4 handler test files that mock `@ai-learning-hub/events` MUST add `requireEventBus` to the mock (see Task 3.5). Handlers call `requireEventBus()` at module scope — if the mock doesn't provide it, tests will fail on import

## File Structure Requirements

### Modify

- `backend/shared/validation/src/schemas.ts` — add `saveIdPathSchema`
- `backend/shared/validation/src/index.ts` — add export
- `backend/shared/db/src/saves.ts` — add `SAVES_WRITE_RATE_LIMIT`
- `backend/shared/db/src/index.ts` — add export
- `backend/shared/events/src/index.ts` — add `requireEventBus()`
- `backend/functions/saves-get/handler.ts` — update imports, remove local schema
- `backend/functions/saves-update/handler.ts` — update imports, remove local schema + rate limit + EB boilerplate
- `backend/functions/saves-delete/handler.ts` — update imports, remove local schema + rate limit + EB boilerplate
- `backend/functions/saves-restore/handler.ts` — update imports, remove local schema + rate limit + EB boilerplate
- `backend/functions/saves/handler.ts` — update rate limit + EB boilerplate (schema already centralized)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
