# Adversarial Review: Story 3.1.2 — Shared Test Utilities for Saves Domain

**Date:** 2026-02-23  
**Artifact:** `_bmad-output/implementation-artifacts/3-1-2-shared-test-utilities.md`  
**Scope:** Story 3.1.2 acceptance criteria, tasks, mock design, proof-of-concept migration, and alignment with existing test-utils and Vitest constraints.

---

## Summary

The story is well-scoped and correctly depends on 3.1.1. The review finds **one high-impact inconsistency** (factory defaults vs. existing saves-get assertions), **several medium-impact gaps** (mockDbModule missing getItem/updateItem in default, vi.mock hoisting and \_mockEmitEvent ergonomics, no explicit test for the utilities), and **low/clarification** items (requireEventBus, getDefaultClient implementation, assertADR008 adoption scope) that could cause migration failures or confusion during 3.1.3.

---

## Epic 3 Intent & Dependencies

- **Epic 3 / Story 3.1:** Story 3.1.2 fits the “extract shared test utilities” goal and correctly depends on `3-1-1-extract-shared-schemas-constants`. No conflict with epic intent.
- **Build-on-3.1.1:** Dev Notes and Previous Story Intelligence correctly reference Story 3.1.1 (saveIdPathSchema, SAVES_WRITE_RATE_LIMIT, requireEventBus). requireEventBus is not present in the current events package; the artifact’s “consider adding requireEventBus mock” is forward-looking and appropriate.

---

## High

### H1: createTestSaveItem defaults break proof-of-concept migration (AC1, AC6)

**Artifact (Task 1.1)** defines `createTestSaveItem` with:

- `url: \`https://example.com/${saveId}\``
- `normalizedUrl: \`https://example.com/${saveId}\``
- `urlHash: \`hash-${saveId}\``

**Current `saves-get/handler.test.ts`** uses a local `createSaveItem` with:

- `url: "https://example.com/article"`
- `normalizedUrl: "https://example.com/article"`
- `urlHash: "hash123"`

and asserts:

```ts
expect(body.data.url).toBe("https://example.com/article");
```

**Impact:** If the proof-of-concept migration (Task 5) simply replaces the local factory with `createTestSaveItem()` and `VALID_SAVE_ID`, the test “returns 200 with save data” will fail: the handler will return the new default URL/urlHash and the assertion will not match.

**Recommendation:** Choose one and document it:

1. **Option A (preferred):** Make the shared factory’s **default** shape match the current saves-get test so that the migration is a drop-in replacement with no assertion changes. In Task 1.1, set default `url`, `normalizedUrl`, and `urlHash` to `"https://example.com/article"` and `"hash123"` (or a single constant like `DEFAULT_TEST_URL` / `DEFAULT_TEST_URL_HASH`). Document that “defaults are chosen so that saves-get tests pass without changing assertions.”
2. **Option B:** Keep the artifact’s parameterized defaults but in Task 5 explicitly require updating the saves-get assertions to the new defaults (e.g. `expect(body.data.url).toBe(\`https://example.com/${VALID_SAVE_ID}\`)`). Then AC1’s “signature supports all variations” is satisfied by overrides (e.g. `createTestSaveItem(VALID_SAVE_ID, { url: "https://example.com/article", urlHash: "hash123" })`), and the PoC migration must include those overrides or updated assertions.

Until this is resolved, AC6 (“all tests still pass”) is at risk when the artifact’s code is implemented as written.

---

### H2: mockDbModule default return omits getItem and updateItem; story does not require passing them

**Artifact (Task 3.1):** `mockDbModule(mockFns)` returns an object with `getDefaultClient`, `SAVES_TABLE_CONFIG`, `USERS_TABLE_CONFIG`, `toPublicSave`, `requireEnv`, `SAVES_WRITE_RATE_LIMIT`, and `...mockFns`. It does **not** include `getItem` or `updateItem` in the default object.

**Reality:** Saves handlers (e.g. saves-get) call `getItem` and `updateItem` from `@ai-learning-hub/db`. If a test does `vi.mock("@ai-learning-hub/db", () => mockDbModule())` with no arguments, the mocked module will have no `getItem` or `updateItem`; handler code will receive `undefined` and crash.

**Impact:** Implementers or future migrations might assume `mockDbModule()` alone is enough. Tests will fail at runtime until callers pass e.g. `mockDbModule({ getItem: mockGetItem, updateItem: mockUpdateItem })`. The artifact’s proof-of-concept (Task 5.2) says “use mockDbModule() for the @ai-learning-hub/db mock” but does not show that mockFns must supply these.

**Recommendation:**

1. In Task 3.1, add a sentence: “Callers must pass at least `getItem` and `updateItem` (and any other used exports) in `mockFns` so the mocked module is complete for handler tests.”
2. In Task 5.2, show the intended usage explicitly, e.g.: “Use `mockDbModule({ getItem: mockGetItem, updateItem: mockUpdateItem })` (with mocks declared before `vi.mock()` per Dev Notes).”
3. Optionally, document in Dev Notes that “saves-get and most saves handlers require getItem and updateItem; list handlers may also need queryItems.”

---

## Medium

### M1: mockEventsModule() — asserting emitEvent calls requires \_mockEmitEvent or vi.mocked()

**Artifact (Task 2.1):** Returns `emitEvent: (...args: unknown[]) => mockEmitEvent(...args)` and `_mockEmitEvent: mockEmitEvent` for assertions.

**Gap:** The story does not explain how a test file should assert that `emitEvent` was called. With `vi.mock("@ai-learning-hub/events", () => mockEventsModule())`, the handler imports `emitEvent` from `@ai-learning-hub/events`; that is the wrapper function. To assert on calls, the test must either (1) import the module and use `vi.mocked(module._mockEmitEvent)` (or access `_mockEmitEvent` if re-exported), or (2) use `vi.mocked(emitEvent)` which would mock the wrapper, not the inner mock—so reset/assertions might be confusing.

**Recommendation:** In Dev Notes or Task 2.1, add one line: “Tests that need to assert emitEvent calls should import the events module and assert on the `_mockEmitEvent` property (e.g. `const events = await import('@ai-learning-hub/events'); expect(events._mockEmitEvent).toHaveBeenCalledWith(...)`), or document that the module factory re-exports `_mockEmitEvent` for test use.” If the index does not re-export `_mockEmitEvent`, clarify that it is only available on the mocked module object, not from test-utils.

---

### M2: mockDbModule getDefaultClient implementation is redundant

**Artifact (Task 3.1):**

```ts
getDefaultClient: () => vi.fn(() => ({}))(),
```

This creates a mock function that returns `{}`, then immediately invokes it, so `getDefaultClient()` returns `{}`. The same behavior is achieved with `getDefaultClient: () => ({})`. The `vi.fn()` adds no benefit here and may confuse readers.

**Recommendation:** Use `getDefaultClient: () => ({})` in the artifact (and in implementation) unless there is a need to assert on getDefaultClient being called, in which case document that and use e.g. `const mockGetDefaultClient = vi.fn(() => ({})); ... getDefaultClient: mockGetDefaultClient`.

---

### M3: No explicit test file for the new utilities

**Artifact (Testing Requirements):** “The utilities are tested implicitly — the proof-of-concept migration in Task 5 validates they work correctly.”

**Gap:** If a future change breaks `createTestSaveItem` (e.g. a new required field on SaveItem) or `mockDbModule` (e.g. wrong SAVES_TABLE_CONFIG shape), the only signal would be failing handler tests. There is no dedicated test file for test-utils (e.g. `save-factories.test.ts`, `mock-db.test.ts`) that would fail first and localize the break. The existing `mock-wrapper.test.ts` shows the project does unit-test test utilities.

**Recommendation:** Either (1) add a Task 1.3 / 3.3: “Add minimal unit tests for the new utilities (e.g. createTestSaveItem returns valid SaveItem and applies overrides; mockDbModule return shape includes required keys and mockFns override),” or (2) explicitly document the decision: “Utilities are validated only by consumer tests; no dedicated test-utils tests in this story (acceptable given low risk and PoC coverage).” The second keeps the story smaller but leaves refactor risk to 3.1.3.

---

### M4: Vi.mock hoisting and mockDbModule(mockFns) ordering could be clearer

**Artifact (Dev Notes):** Correctly states that mock functions must be declared before `vi.mock()` and that `mockDbModule()` must accept mock functions as parameters if the test needs direct references.

**Gap:** The proof-of-concept Task 5 does not show the required order in the file (e.g. “at top: const mockGetItem = vi.fn(); const mockUpdateItem = vi.fn(); vi.mock('@ai-learning-hub/db', () => mockDbModule({ getItem: mockGetItem, updateItem: mockUpdateItem })); then imports”). A new contributor might put `vi.mock()` after imports and hit hoisting/undefined reference issues.

**Recommendation:** In Task 5.1–5.2 or Dev Notes, add a one-line reminder: “In the migrated file, declare mock functions (e.g. mockGetItem, mockUpdateItem) before any vi.mock() that uses them, then vi.mock(), then imports and tests.”

---

## Low / Clarifications

### L1: requireEventBus — not in codebase yet

**Artifact (Task 2.3, Previous Story Intelligence):** Suggests considering a `requireEventBus` mock if Story 3.1.1 introduced it. `requireEventBus` does not exist in the current events package.

**Recommendation:** Leave as-is. The “consider” and “if Story 3.1.1 introduced it” wording is correct; implementers can add the mock when 3.1.1 adds the export.

---

### L2: assertADR008Error adoption (AC/Task 4.2)

**Artifact (Task 4.2, Dev Notes):** Preserve existing exports including `assertADR008Error`; adoption in more test files is 3.1.3.

**Clarification:** No conflict. Ensuring index.ts exports assertADR008Error is sufficient for this story; no need to use it in the PoC migration unless saves-get already has an ADR-008 test (it has 400/404 tests but not necessarily assertADR008Error).

---

### L3: toPublicSave and deletedAt

**Artifact (Task 3.1):** `toPublicSave` strips `PK`, `SK`, `deletedAt`. `SaveItem` in `@ai-learning-hub/types` includes optional `deletedAt`; `PublicSave` omits it. The mock’s inline `toPublicSave` matches that. No change needed; just confirming alignment.

---

## Architecture Compliance

- **NFR-M1 (DRY):** The story reduces duplication via shared factories and mocks; compliant.
- **Test patterns:** Matching `mockMiddlewareModule()` (plain object, factory for vi.mock, optional exposure of mocks for assertions) is correct. The artifact’s mock design is consistent with that pattern.

---

## Recommendations Summary

| Priority | Item                                        | Action                                                                                                                 |
| -------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| High     | H1 Factory defaults vs saves-get assertions | Align factory defaults with current saves-get (Option A) or document overrides/assertion updates in Task 5 (Option B). |
| High     | H2 mockDbModule missing getItem/updateItem  | Document that callers must pass getItem/updateItem in mockFns; show in Task 5.2.                                       |
| Medium   | M1 \_mockEmitEvent assertion pattern        | Document how to assert emitEvent calls (e.g. via \_mockEmitEvent on mocked module).                                    |
| Medium   | M2 getDefaultClient                         | Simplify to `() => ({})` or document if assertable mock is needed.                                                     |
| Medium   | M3 Unit tests for utilities                 | Add minimal unit tests or document conscious skip.                                                                     |
| Medium   | M4 vi.mock ordering                         | Add one-line reminder in Task 5 or Dev Notes.                                                                          |
| Low      | L1–L3                                       | No change or optional clarification.                                                                                   |

---

## Conclusion

The story is implementable and aligns with Epic 3 and existing test-utils patterns. Addressing **H1** (factory defaults) and **H2** (mockDbModule required mockFns) before or during implementation will prevent proof-of-concept migration failures and confusion in Story 3.1.3. The medium items improve clarity and long-term maintainability of the test utilities.
