---
id: "3.1.2"
title: "Shared Test Utilities for Saves Domain"
status: review
depends_on:
  - 3-1-1-extract-shared-schemas-constants
touches:
  - backend/test-utils/save-factories.ts (new)
  - backend/test-utils/mock-events.ts (new)
  - backend/test-utils/mock-db.ts (new)
  - backend/test-utils/index.ts
risk: low
---

# Story 3.1.2: Shared Test Utilities for Saves Domain

Status: review

## Story

As a developer,
I want shared test factories, mock helpers, and assertion utilities for the saves domain,
so that new saves handlers can be tested with minimal boilerplate and existing tests are easier to maintain.

## Acceptance Criteria

| #   | Given                                                                  | When                                                               | Then                                                                                                                                                             |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | `createSaveItem` factory defined in 5 test files with minor variations | Factory extracted to `backend/test-utils/save-factories.ts`        | Single `createTestSaveItem(saveId?, overrides?)` function exported; signature supports all variations across existing test files                                 |
| AC2 | Events mock block identical in 4 test files                            | Mock factory extracted to `backend/test-utils/mock-events.ts`      | `mockEventsModule()` function exported (matching `mockMiddlewareModule()` pattern); returns `{ emitEvent, getDefaultClient, SAVES_EVENT_SOURCE }`                |
| AC3 | DB mock blocks with heavy overlap across 6 test files                  | Composable mock factory created in `backend/test-utils/mock-db.ts` | `mockDbModule(mockFns)` function providing `SAVES_TABLE_CONFIG`, `USERS_TABLE_CONFIG`, `toPublicSave`, `requireEnv`, `getDefaultClient` with override capability |
| AC4 | `VALID_SAVE_ID` constant defined in 4 test files                       | Constant extracted to `backend/test-utils/save-factories.ts`       | Single export `VALID_SAVE_ID`; value matches existing: `"01HXYZ1234567890ABCDEFGHIJ"`                                                                            |
| AC5 | All existing tests pass                                                | After creating all new test utilities                              | `npm test` passes with 0 failures; new utilities are importable and working                                                                                      |
| AC6 | One test file updated as proof-of-concept                              | `saves-get/handler.test.ts` migrated to use new utilities          | Test file uses `createTestSaveItem`, `mockDbModule`, `VALID_SAVE_ID` from `backend/test-utils/`; all tests still pass                                            |

## Tasks / Subtasks

- [x] Task 1: Create `backend/test-utils/save-factories.ts` (AC: #1, #4)
  - [x] 1.1 Implement `createTestSaveItem(saveId?, overrides?)`:

    ```typescript
    import { ContentType } from "@ai-learning-hub/types";
    import type { SaveItem } from "@ai-learning-hub/types";

    export const VALID_SAVE_ID = "01HXYZ1234567890ABCDEFGHIJ";

    export function createTestSaveItem(
      saveId: string = VALID_SAVE_ID,
      overrides: Partial<SaveItem> = {}
    ): SaveItem {
      return {
        PK: "USER#user123",
        SK: `SAVE#${saveId}`,
        userId: "user123",
        saveId,
        url: `https://example.com/${saveId}`,
        normalizedUrl: `https://example.com/${saveId}`,
        urlHash: `hash-${saveId}`,
        contentType: ContentType.ARTICLE,
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-02-20T00:00:00Z",
        updatedAt: "2026-02-20T00:00:00Z",
        ...overrides,
      };
    }
    ```

  - [x] 1.2 Export from `backend/test-utils/index.ts`

- [x] Task 2: Create `backend/test-utils/mock-events.ts` (AC: #2)
  - [x] 2.1 Implement `mockEventsModule()`:

    ```typescript
    import { vi } from "vitest";

    export function mockEventsModule() {
      const mockEmitEvent = vi.fn();
      return {
        emitEvent: (...args: unknown[]) => mockEmitEvent(...args),
        getDefaultClient: () => ({}),
        SAVES_EVENT_SOURCE: "ai-learning-hub.saves",
        // Expose the mock for assertions
        _mockEmitEvent: mockEmitEvent,
      };
    }
    ```

  - [x] 2.2 Export from `backend/test-utils/index.ts`
  - [x] 2.3 Consider: should `requireEventBus` (from Story 3.1.1) also be mocked here? If so, add `requireEventBus: () => ({ busName: "test-event-bus", ebClient: {} })`

- [x] Task 3: Create `backend/test-utils/mock-db.ts` (AC: #3)
  - [x] 3.1 Implement `mockDbModule(mockFns)`. Note: this provides shared static config (table configs, toPublicSave, requireEnv, rate limit constant). Callers MUST pass handler-specific operation mocks (e.g., `getItem`, `updateItem`, `queryItems`, `queryAllItems`, `enforceRateLimit`, `transactWriteItems`) via `mockFns` — these vary per handler and are not included in defaults:

    ```typescript
    import { vi } from "vitest";
    import type { SaveItem } from "@ai-learning-hub/types";

    export function mockDbModule(
      mockFns: Record<string, ReturnType<typeof vi.fn>> = {}
    ) {
      return {
        getDefaultClient: () => ({}),
        SAVES_TABLE_CONFIG: {
          tableName: "ai-learning-hub-saves",
          partitionKey: "PK",
          sortKey: "SK",
        },
        USERS_TABLE_CONFIG: {
          tableName: "ai-learning-hub-users",
          partitionKey: "PK",
          sortKey: "SK",
        },
        toPublicSave: (item: SaveItem) => {
          const { PK: _PK, SK: _SK, deletedAt: _del, ...rest } = item;
          return rest;
        },
        requireEnv: (name: string, fallback: string) =>
          process.env[name] ?? fallback,
        SAVES_WRITE_RATE_LIMIT: {
          operation: "saves-write",
          limit: 200,
          windowSeconds: 3600,
        },
        ...mockFns,
      };
    }
    ```

  - [x] 3.2 Export from `backend/test-utils/index.ts`

- [x] Task 4: Update `backend/test-utils/index.ts` exports (AC: #1-#4)
  - [x] 4.1 Add re-exports for all new modules
  - [x] 4.2 Ensure existing exports (`createMockLogger`, `mockCreateLoggerModule`, `createMockContext`, `createMockEvent`, `mockMiddlewareModule`, `assertADR008Error`) are preserved

- [x] Task 5: Proof-of-concept migration (AC: #6)
  - [x] 5.1 Update `saves-get/handler.test.ts` to import `createTestSaveItem`, `VALID_SAVE_ID` from `backend/test-utils/`
  - [x] 5.2 Update `saves-get/handler.test.ts` to use `mockDbModule()` for the `@ai-learning-hub/db` mock. Callers must pass handler-specific mocks (e.g., `getItem`, `updateItem`) via `mockFns` — `mockDbModule` only provides shared static config. Example: `mockDbModule({ getItem: (...args: unknown[]) => mockGetItem(...args), updateItem: (...args: unknown[]) => mockUpdateItem(...args) })`
  - [x] 5.3 Note: the shared factory uses parameterized defaults (`url: \`https://example.com/${saveId}\``). The current saves-get test asserts against fixed strings (`"https://example.com/article"`). Either pass overrides (e.g., `createTestSaveItem(VALID_SAVE_ID, { url: "https://example.com/article", urlHash: "hash123" })`) or update test assertions to match the new defaults. The parameterized defaults are intentional — they're needed by saves-list tests that create multiple items with distinct URLs.
  - [x] 5.4 Run `saves-get` tests to confirm no regressions

- [x] Task 6: Verify (AC: #5)
  - [x] 6.1 Run `npm test` — all tests pass
  - [x] 6.2 Run `npm run type-check` — clean

## Dev Notes

### Design pattern: match `mockMiddlewareModule()`

The existing `mockMiddlewareModule()` in `backend/test-utils/mock-wrapper.ts` is the gold standard for how mock factories should work in this codebase. Study it before implementing `mockEventsModule()` and `mockDbModule()`. Key patterns:

- Returns a plain object (not a class)
- Mock functions are created inside the factory
- Consumers use `vi.mock("@ai-learning-hub/events", () => mockEventsModule())`

### `vi.mock()` hoisting constraint

`vi.mock()` calls are hoisted to the top of the test file by Vitest. The factory function passed to `vi.mock()` cannot reference variables defined later in the file. This means:

- Mock functions like `mockUpdateItem` must be declared BEFORE the `vi.mock()` call
- The `mockDbModule()` factory must accept mock functions as parameters (not create them internally) if the test file needs direct references to them for assertions
- Alternative: `mockDbModule()` creates its own mocks and the test file accesses them via `vi.mocked()` — this is cleaner but requires the test to know the internal structure

### Proof-of-concept scope

Only migrate `saves-get/handler.test.ts` in this story. The full migration of all 6 test files happens in Story 3.1.3. This keeps the story small and validates the utility design before committing to it across all files.

### `assertADR008Error` adoption

This utility already exists in `backend/test-utils/assert-adr008.ts`. It does NOT need to be created — it needs to be adopted in more test files. That adoption happens in Story 3.1.3 (AC5), not here. This story only ensures it's properly exported from `backend/test-utils/index.ts` (which it already should be).

## Architecture Compliance

| ADR / NFR         | How This Story Must Comply                                       |
| ----------------- | ---------------------------------------------------------------- |
| **NFR-M1 (DRY)**  | Reduce test boilerplate through shared utilities                 |
| **Test patterns** | Follow existing `mockMiddlewareModule()` pattern for consistency |

## Testing Requirements

### Test the utilities themselves

The utilities are tested implicitly — the proof-of-concept migration in Task 5 validates they work correctly. If `saves-get` tests pass using the new utilities, the utilities are correct.

### Quality gates

- `npm test`
- `npm run lint`
- `npm run type-check`

## Previous Story Intelligence

### From Story 3.1.1

- Shared packages may have been updated (new exports like `saveIdPathSchema`, `SAVES_WRITE_RATE_LIMIT`, `requireEventBus`)
- `mockDbModule()` should include `SAVES_WRITE_RATE_LIMIT` in its default returns
- `mockEventsModule()` should include `requireEventBus` mock if Story 3.1.1 introduced it

## File Structure Requirements

### New

- `backend/test-utils/save-factories.ts` — `createTestSaveItem`, `VALID_SAVE_ID`
- `backend/test-utils/mock-events.ts` — `mockEventsModule()`
- `backend/test-utils/mock-db.ts` — `mockDbModule()`

### Modify

- `backend/test-utils/index.ts` — add re-exports
- `backend/functions/saves-get/handler.test.ts` — proof-of-concept migration

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed TS2742 error: `vi.fn()` return type not portable across project references — added explicit `Record<string, unknown>` return types to `mockEventsModule` and `mockDbModule`
- Fixed TS2345 error: `as const` on `SAVE_OVERRIDES` made `tags` readonly — used explicit `Partial<SaveItem>` type annotation instead
- Removed unused `vi` import from `mock-db.ts` (no `vi.fn()` calls needed after simplifying param type)

### Completion Notes List

- AC1: `createTestSaveItem(saveId?, overrides?)` factory created in `backend/test-utils/save-factories.ts` with parameterized defaults
- AC2: `mockEventsModule(mockFns?)` factory created in `backend/test-utils/mock-events.ts` — includes `requireEventBus` from Story 3.1.1
- AC3: `mockDbModule(mockFns)` composable factory created in `backend/test-utils/mock-db.ts` — includes `SAVES_WRITE_RATE_LIMIT` from Story 3.1.1
- AC4: `VALID_SAVE_ID` constant exported from `backend/test-utils/save-factories.ts`
- AC5: All 333 tests pass across 20 test files, coverage at 97.45%
- AC6: `saves-get/handler.test.ts` migrated to use `createTestSaveItem`, `mockDbModule`, `VALID_SAVE_ID` — all 9 tests pass
- Task 2.3: Yes, `requireEventBus` included in `mockEventsModule` defaults (matches existing handler test patterns)

### File List

- `backend/test-utils/save-factories.ts` (new) — `createTestSaveItem`, `VALID_SAVE_ID`
- `backend/test-utils/mock-events.ts` (new) — `mockEventsModule()`
- `backend/test-utils/mock-db.ts` (new) — `mockDbModule()`
- `backend/test-utils/index.ts` (modified) — added re-exports for new modules
- `backend/functions/saves-get/handler.test.ts` (modified) — proof-of-concept migration
- `_bmad-output/implementation-artifacts/3-1-2-shared-test-utilities.md` (modified) — task completion tracking
