---
id: "3.1.3"
title: "Handler & Test Consolidation"
status: ready-for-dev
depends_on:
  - 3-1-1-extract-shared-schemas-constants
  - 3-1-2-shared-test-utilities
touches:
  - backend/functions/saves/handler.ts
  - backend/functions/saves/handler.test.ts
  - backend/functions/saves-get/handler.test.ts
  - backend/functions/saves-list/handler.test.ts
  - backend/functions/saves-update/handler.ts
  - backend/functions/saves-update/handler.test.ts
  - backend/functions/saves-delete/handler.ts
  - backend/functions/saves-delete/handler.test.ts
  - backend/functions/saves-restore/handler.ts
  - backend/functions/saves-restore/handler.test.ts
risk: medium
---

# Story 3.1.3: Handler & Test Consolidation

Status: ready-for-dev

## Story

As a developer,
I want all saves handlers and test files to use shared code from `@ai-learning-hub/*` packages and `backend/test-utils/`,
so that the codebase is DRY, consistent, and easy to maintain.

## Acceptance Criteria

| #   | Given                                                                                         | When                                           | Then                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | `saves/handler.ts` defines local `SAVES_TABLE_CONFIG`, `SaveItem`, `toPublicSave`             | Handler retrofitted to use shared packages     | Imports `SAVES_TABLE_CONFIG`, `toPublicSave` from `@ai-learning-hub/db`; imports `SaveItem` from `@ai-learning-hub/types`; no local definitions remain    |
| AC2 | Local `toPublicSave` in `saves/handler.ts` does not strip `deletedAt`                         | Shared `toPublicSave` used everywhere          | `deletedAt` is stripped from all API responses including 409 `existingSave`; verified by test |
| AC3 | 409 duplicate response built twice within `saves/handler.ts`                                  | Extracted to local helper                      | Single `createDuplicateResponse(existingSave, requestId)` function; both call sites use it                                                                |
| AC4 | `AppError.isAppError()` not used consistently across handlers                                 | All handlers standardized                      | No manual `instanceof Error && "code" in error` checks remain in any saves handler; all use `AppError.isAppError(error)` |
| AC5 | `saves-update` and `saves-restore` use unnecessary explicit `createSuccessResponse()` for 200 | Standardized to auto-wrap pattern              | Both handlers return plain data objects for 200 responses; `wrapHandler` auto-wraps them |
| AC6 | All 6 test files have duplicated factory/mock/assertion code                                  | All test files use shared utilities from 3.1.2 | Each test file imports from `backend/test-utils/`: `createTestSaveItem`, `mockEventsModule`, `mockDbModule`, `VALID_SAVE_ID`, `assertADR008Error` as applicable |
| AC7 | All existing tests pass                                                                       | After all changes                              | `npm test` passes with 0 failures; no behavioral changes except AC2 (`deletedAt` stripping) |
| AC8 | No local schema definitions remain in handler files                                           | After cleanup                                  | `grep -r "const saveIdPathSchema" backend/functions/` returns no matches; `grep -r "const SAVES_TABLE_CONFIG" backend/functions/` returns no matches |

## Tasks / Subtasks

- [ ] Task 1: Retrofit `saves/handler.ts` (AC: #1, #2, #3)
  - [ ] 1.1 Replace local `SAVES_TABLE_CONFIG` with import from `@ai-learning-hub/db`
  - [ ] 1.2 Replace local `SaveItem` interface with `import type { SaveItem } from "@ai-learning-hub/types"`
  - [ ] 1.3 Replace local `toPublicSave` with import from `@ai-learning-hub/db` — this CHANGES behavior: `deletedAt` is now stripped from 409 responses
  - [ ] 1.4 Extract 409 response into `createDuplicateResponse(existingSave: PublicSave, requestId: string)` local helper function
  - [ ] 1.5 Replace both 409 response construction sites with `createDuplicateResponse()` call: (1) the block returning 409 with `existingSave` from the Layer 1 GSI query result, and (2) the block returning 409 with `existingSave` from `activeResult` in `handleTransactionFailure`
  - [ ] 1.6 Update `saves/handler.test.ts` to verify `deletedAt` is NOT present in 409 `existingSave` response

- [ ] Task 2: Standardize `AppError` usage across handlers (AC: #4)
  - [ ] 2.1 In `saves-update/handler.ts`: replace manual `instanceof Error && "code" in error && (error as AppError).code` with `AppError.isAppError(error) && error.code`
  - [ ] 2.2 In `saves-delete/handler.ts`: same replacement
  - [ ] 2.3 In `saves-restore/handler.ts`: same replacement
  - [ ] 2.4 Verify `AppError` is imported from `@ai-learning-hub/types` (where `isAppError` static method lives)

- [ ] Task 3: Standardize response wrapping (AC: #5)
  - [ ] 3.1 In `saves-update/handler.ts`: change from `return createSuccessResponse(toPublicSave(updated), requestId)` to `return toPublicSave(updated)` — `wrapHandler` will auto-wrap with 200
  - [ ] 3.2 In `saves-restore/handler.ts`: change from `return createSuccessResponse(toPublicSave(restored), requestId)` to `return toPublicSave(restored)`
  - [ ] 3.3 Remove unused `createSuccessResponse` imports from both handlers
  - [ ] 3.4 Verify tests still pass — the response shape is identical (wrapHandler produces same output)

- [ ] Task 4: Migrate all 6 test files to shared utilities (AC: #6)
  - [ ] 4.1 `saves/handler.test.ts`:
    - Import `createTestSaveItem` from test-utils. Use overrides for any create-specific defaults (e.g., `createTestSaveItem(saveId, { url: "...", tags: ["test"] })`). Do NOT keep a local factory — if `createTestSaveItem` doesn't support a needed shape, extend it via overrides.
    - Use `mockEventsModule()` for events mock
    - Use `mockDbModule()` for db mock
    - Use `assertADR008Error` for error assertions
  - [ ] 4.2 `saves-get/handler.test.ts`:
    - Already migrated in Story 3.1.2 proof-of-concept
    - Add `assertADR008Error` usage for error response structural checks
    - **Important:** `assertADR008Error` validates status code and error code but NOT the error message. Keep existing `expect(body.error.message).toBe("Save not found")` assertions alongside `assertADR008Error`. This applies to all test files — `assertADR008Error` supplements existing message assertions, it does not replace them.
  - [ ] 4.3 `saves-list/handler.test.ts`:
    - Import `createTestSaveItem` from test-utils
    - Use `mockDbModule()` for db mock
    - `assertADR008Error` already used — no changes needed
  - [ ] 4.4 `saves-update/handler.test.ts`:
    - Import `createTestSaveItem`, `VALID_SAVE_ID` from test-utils
    - Use `mockEventsModule()`, `mockDbModule()`
    - Use `assertADR008Error` for error assertions
  - [ ] 4.5 `saves-delete/handler.test.ts`:
    - Import `createTestSaveItem`, `VALID_SAVE_ID` from test-utils
    - Use `mockEventsModule()`, `mockDbModule()`
    - Use `assertADR008Error` for error assertions
  - [ ] 4.6 `saves-restore/handler.test.ts`:
    - Import `createTestSaveItem`, `VALID_SAVE_ID` from test-utils
    - Use `mockEventsModule()`, `mockDbModule()`
    - Use `assertADR008Error` for error assertions

- [ ] Task 5: Verification (AC: #7, #8)
  - [ ] 5.1 Run `npm test` — all tests pass
  - [ ] 5.2 Run `npm run type-check` — clean
  - [ ] 5.3 Run `npm run lint` — clean
  - [ ] 5.4 Verify: `grep -r "const saveIdPathSchema" backend/functions/` — no matches (cross-check: Story 3.1.1 already removed these; this confirms nothing was re-introduced)
  - [ ] 5.5 Verify: `grep -r "const SAVES_TABLE_CONFIG" backend/functions/` — no matches
  - [ ] 5.6 Verify: `grep -rn "instanceof Error" backend/functions/saves` — no AppError detection patterns remain

## Dev Notes

### This is the largest story — plan for methodical execution

This story touches all 6 handlers and all 6 test files. Work through one handler+test pair at a time, running tests after each pair to catch regressions early.

**Recommended order:**
1. `saves/handler.ts` + test (most complex — local definitions, 409 helper, toPublicSave)
2. `saves-update/handler.ts` + test (AppError + response wrapping changes)
3. `saves-restore/handler.ts` + test (mirrors update pattern)
4. `saves-delete/handler.ts` + test (AppError change only, no response wrapping change)
5. `saves-get/handler.test.ts` (test-only — handler already clean; adds assertADR008Error)
6. `saves-list/handler.test.ts` (test-only — handler already clean; factory migration)

### Behavioral change: `toPublicSave` in `saves/handler.ts`

The only intentional behavioral change in this story is AC2: the shared `toPublicSave` strips `deletedAt`, while the local version does not. This means the 409 `existingSave` object will no longer include `deletedAt` if it was somehow present. This is the CORRECT behavior — `deletedAt` is an internal field that should never be exposed in API responses.

Add a test to `saves/handler.test.ts` that explicitly verifies `deletedAt` is NOT in the 409 response body.

### Response wrapping equivalence

`wrapHandler` at line ~214 of `backend/shared/middleware/src/wrapper.ts` detects when a handler returns a plain object (no `statusCode`) and auto-wraps it with `createSuccessResponse(result, requestId)`. This means:
- Handler returns `toPublicSave(updated)` → wrapHandler returns `{ statusCode: 200, headers: {...}, body: JSON.stringify({ data: toPublicSave(updated) }) }`
- Handler returns `createSuccessResponse(toPublicSave(updated), requestId)` → wrapHandler returns this directly (it has `statusCode`)

The output is identical. Existing tests validate the response shape and will catch any divergence.

### `vi.mock()` migration strategy

When migrating from inline mocks to `mockDbModule()`, be careful about mock function references. If a test file does:

```typescript
const mockUpdateItem = vi.fn();
vi.mock("@ai-learning-hub/db", () => ({
  updateItem: (...args) => mockUpdateItem(...args),
  // ...
}));
```

And you want to use `mockDbModule()`, you need to ensure the test file still has a reference to `mockUpdateItem` for assertion purposes. Two approaches:

**Approach A — pass mocks in:**
```typescript
const mockUpdateItem = vi.fn();
vi.mock("@ai-learning-hub/db", () => mockDbModule({ updateItem: (...args) => mockUpdateItem(...args) }));
```

**Approach B — use vi.mocked():**
```typescript
vi.mock("@ai-learning-hub/db", () => mockDbModule());
import { updateItem } from "@ai-learning-hub/db";
const mockUpdateItem = vi.mocked(updateItem);
```

Approach A is recommended for consistency with the existing codebase patterns.

## Architecture Compliance

| ADR / NFR           | How This Story Must Comply                                                          |
| ------------------- | ----------------------------------------------------------------------------------- |
| **NFR-M1 (DRY)**   | Primary purpose — remove all remaining duplication                                   |
| **ADR-008**         | No changes to error response format; `assertADR008Error` validates conformance       |
| **Shared libs**     | All handlers must import from `@ai-learning-hub/*`; no local copies                  |

## Testing Requirements

### Modified tests must pass

All 6 test files are modified. Every test must continue to pass. No new test cases are needed except AC2 (verify `deletedAt` stripping in 409).

### Quality gates

- `npm test`
- `npm run lint`
- `npm run type-check`

## Previous Story Intelligence

### From Story 3.1.1

- `saveIdPathSchema` now in `@ai-learning-hub/validation` — handlers already import it
- `SAVES_WRITE_RATE_LIMIT` now in `@ai-learning-hub/db` — handlers already import it
- `requireEventBus()` now in `@ai-learning-hub/events` — handlers already import it

### From Story 3.1.2

- `createTestSaveItem`, `VALID_SAVE_ID` available from `backend/test-utils/save-factories`
- `mockEventsModule()` available from `backend/test-utils/mock-events`
- `mockDbModule()` available from `backend/test-utils/mock-db`
- `saves-get/handler.test.ts` already migrated as proof-of-concept

## File Structure Requirements

### Modify

- `backend/functions/saves/handler.ts` — retrofit to shared packages
- `backend/functions/saves/handler.test.ts` — migrate to shared utilities + add deletedAt test
- `backend/functions/saves-get/handler.test.ts` — add assertADR008Error usage
- `backend/functions/saves-list/handler.test.ts` — migrate factory to shared
- `backend/functions/saves-update/handler.ts` — AppError + response wrapping
- `backend/functions/saves-update/handler.test.ts` — migrate to shared utilities
- `backend/functions/saves-delete/handler.ts` — AppError standardization
- `backend/functions/saves-delete/handler.test.ts` — migrate to shared utilities
- `backend/functions/saves-restore/handler.ts` — AppError + response wrapping
- `backend/functions/saves-restore/handler.test.ts` — migrate to shared utilities

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
