# Adversarial Review: Story 3.1.1 — Extract Shared Schemas & Constants

**Date:** 2026-02-23  
**Artifact:** `_bmad-output/implementation-artifacts/3-1-1-extract-shared-schemas-constants.md`  
**Scope:** Story 3.1.1 acceptance criteria, tasks, technical requirements, alignment with existing handlers and shared packages, and test impact.

---

## Summary

The story is well-scoped for a refactor-only change (no behavioral changes) and correctly targets the four by-saveId handlers plus the saves create handler for extractions. The review finds **no critical blockers** but **several high-impact gaps**: the exact `saveIdPathSchema` definition is not specified (risk of inconsistent validation or messages), test mocks must explicitly add `requireEventBus` or handler tests will break, and the post-extraction handler usage of `requireEventBus()` (module-level capture and use of `busName`/`ebClient`) is not spelled out. **Medium** items include placement of the rate-limit constant in `db/saves`, optional schema unit test, and build-order dependency.

---

## Epic 3 Intent & Story Role

- **Story role:** Pure DRY refactor (NFR-M1). No new behavior, no API or error-shape changes. Correctly depends on nothing and touches only shared packages and the five saves handlers.
- **Handlers affected:** The artifact correctly identifies: `saves-get`, `saves-update`, `saves-delete`, `saves-restore` for path schema + (where applicable) rate limit + EventBridge; `saves` (create) for rate limit + EventBridge only. `saves-get` does not use rate limit or EventBridge — only the path schema — which matches the codebase.

---

## High

### H1: Exact `saveIdPathSchema` definition is not specified

**Artifact (Task 1.1):** “Add `saveIdPathSchema` to `backend/shared/validation/src/schemas.ts` alongside existing …”

**Gap:** The artifact does not specify the schema body. In the codebase, all four handlers currently use:

```ts
const saveIdPathSchema = z.object({
  saveId: z
    .string()
    .regex(/^[0-9A-Z]{26}$/, "saveId must be a 26-character ULID"),
});
```

If an implementer uses a different regex (e.g. UUID), different message, or adds/removes constraints, validation behavior or 400 messages will change and AC4 (no behavioral changes) will be violated.

**Recommendation:** In Task 1.1, add the exact definition:

```ts
export const saveIdPathSchema = z.object({
  saveId: z
    .string()
    .regex(/^[0-9A-Z]{26}$/, "saveId must be a 26-character ULID"),
});
```

State that the shared schema must match the current handler definitions exactly (26-char ULID, same message) so that behavior and error messages remain identical.

---

### H2: Test mocks must add `requireEventBus` or handler tests will fail

**Artifact (Previous Story Intelligence):** “Event mock in tests may need updating if `requireEventBus` changes the import surface.”

**Reality:** Handlers will call `requireEventBus()` at **module scope**. In tests, `vi.mock("@ai-learning-hub/events", ...)` replaces the events package. If the mock does not export `requireEventBus`, the handler will either call the real `requireEventBus()` (which reads `process.env.EVENT_BUS_NAME` and `getDefaultClient()`) or, if the mock returns an object without `requireEventBus`, the handler will throw when it tries to call it at load time.

**Evidence:** Current saves handler test mocks (e.g. `backend/functions/saves/handler.test.ts`) mock `getDefaultClient` and set `process.env.EVENT_BUS_NAME = "test-event-bus"`. After extraction, the handler will call `requireEventBus()` at module scope; that call must be satisfied by the mock.

**Recommendation:** In Task 3.2 or Testing Requirements, add an explicit step: “In each of the four handler test files that mock `@ai-learning-hub/events` (saves, saves-update, saves-delete, saves-restore), add `requireEventBus` to the mock, e.g. `requireEventBus: () => ({ busName: 'test-event-bus', ebClient: {} })`, so that module-level `requireEventBus()` succeeds and tests do not fail on load or get wrong EventBridge behavior.”

---

### H3: Handler usage of `requireEventBus()` result is not spelled out

**Artifact (Task 3.1):** Defines `requireEventBus()` returning `{ busName, ebClient }`. Task 3.2 says “call `requireEventBus()` instead of inline boilerplate” and remove the inline blocks.

**Gap:** Current handlers use at module scope: `const EVENT_BUS_NAME = ...`, guard, and `const ebClient = getDefaultEBClient()`. In the handler body they use `const busName = EVENT_BUS_NAME ?? ""` and call `emitEvent(ebClient, busName, entry, logger)`. After extraction, the handler must:

1. Call `requireEventBus()` once at module scope and store the result.
2. Use that result’s `busName` and `ebClient` wherever `emitEvent` is called (and avoid re-reading env or calling `getDefaultClient` for EventBridge).

If the story does not state this, an implementer might call `requireEventBus()` inside the handler function on every request (wasteful) or keep a separate `getDefaultClient` call for EventBridge (duplication).

**Recommendation:** In Task 3.2 or Dev Notes, add: “At module scope, set `const eventBus = requireEventBus();`. In the handler body, use `eventBus.ebClient` and `eventBus.busName` for all `emitEvent(...)` calls. Do not call `requireEventBus()` inside the handler or retain a separate EventBridge client getter.”

---

## Medium

### M1: Rate limit constant in `db/saves.ts` — package boundary

**Artifact (Task 2.1):** Add `SAVES_WRITE_RATE_LIMIT` to `backend/shared/db/src/saves.ts`.

**Observation:** The `db` package is primarily DynamoDB access and table config. Rate limit **state** lives in the users table (and `enforceRateLimit` is in `db`), but the **constant** (operation name, limit, window) is policy for the “saves” write domain. Putting it in `saves.ts` is defensible (co-located with saves table config) but blurs “data access” with “product policy.”

**Recommendation:** One sentence in Dev Notes: “`SAVES_WRITE_RATE_LIMIT` is placed in `saves.ts` to keep saves-domain policy with saves config. If more operation-specific rate limit constants are added later, consider a dedicated `rate-limits.ts` (or similar) in the db package to avoid scattering policy across multiple domain files.”

---

### M2: Optional unit test for `saveIdPathSchema`

**Artifact (Testing Requirements):** “No new tests required … If a test breaks, the extraction is wrong.”

**Gap:** The validation package has unit tests for other schemas (e.g. `createSaveSchema`, `updateSaveSchema` in `save-schemas.test.ts`). Adding a short test for `saveIdPathSchema` (valid 26-char ULID passes; invalid length/format fail with the expected message) would lock in the exact contract and catch accidental changes to the shared schema. The story does not require it, so it’s optional but would improve safety.

**Recommendation:** In Testing Requirements or as an optional subtask: “Optional: add a test in `backend/shared/validation/test/` that asserts `saveIdPathSchema` accepts a 26-character ULID and rejects invalid formats with the message ‘saveId must be a 26-character ULID’. Not required for AC4 but recommended for regression safety.”

---

### M3: Build order and verification

**Artifact:** Task 1 includes “Rebuild validation package” (1.3); Task 4 runs `npm test`, `type-check`, `lint`.

**Observation:** Handlers import from the **compiled** `@ai-learning-hub/validation` output. If Task 2 or 3 is done before the validation package is rebuilt after adding `saveIdPathSchema`, type-check or tests can fail or use an old build. The artifact already warns in Dev Notes that rebuild is required after schema changes; the task order (1.1–1.6 then 2, 3, 4) is correct. No change strictly required; a short reminder in Task 4.1 (“Ensure validation package has been built (Task 1.3) before running tests”) would reduce mistakes.

**Recommendation:** In Task 4.1, add: “Ensure `npm run -w @ai-learning-hub/validation build` has been run (Task 1.3) so handler imports resolve.”

---

## Low / Clarifications

### L1: `requireEventBus()` placement — `index.ts` vs `init.ts`

**Artifact (Task 3.1):** “Add `requireEventBus()` to the events package (e.g. `backend/shared/events/src/index.ts` or a new `init.ts`).”

**Clarification:** If a new `init.ts` is used, it must be exported from `index.ts` so handlers can `import { requireEventBus } from '@ai-learning-hub/events'`. Stating this avoids a partial export and broken imports.

**Recommendation:** One sentence: “If `requireEventBus` is implemented in a new file (e.g. `init.ts`), export it from `backend/shared/events/src/index.ts` so the public API remains `@ai-learning-hub/events`.”

---

### L2: Grep verification and alternate patterns

**Artifact (Task 1.6):** “Verify: `grep -r "const saveIdPathSchema" backend/functions/` returns no matches.”

**Observation:** This correctly ensures no handler **defines** the schema locally. A handler that both imported and re-declared (e.g. `const saveIdPathSchema = sharedSaveIdPathSchema`) would be caught by the grep if it used the same name. The intended state is only imports; the grep is sufficient.

---

### L3: ADR-008 and error shape

**Artifact (Architecture Compliance):** “ADR-008: No changes to error response format.”

**Observation:** This story does not touch error construction or middleware; it only moves schema and config. No change to ADR-008 is expected. No action needed; the table is accurate.

---

## Positive Notes

- **Behavioral equivalence** is clearly stated (Dev Notes, AC4), and “fix the extraction, not the test” is the right rule.
- **Validation rebuild** is explicitly called out from prior story intelligence.
- **EventBridge helper** is specified to run at module scope (cold start), matching current behavior.
- **Rate limit** use of `as const` and spread with `identifier: userId` matches existing `enforceRateLimit(client, USERS_TABLE_CONFIG.tableName, { ... }, logger)` usage in the codebase.
- **File list** and touched paths match the actual handlers and shared modules that contain the duplicated code.

---

## Checklist for Implementation

Before implementation, resolve or document:

- [ ] **H1:** Add exact `saveIdPathSchema` definition to Task 1.1.
- [ ] **H2:** Add explicit step to update events mock in all four handler test files to include `requireEventBus`.
- [ ] **H3:** Document module-level `const eventBus = requireEventBus();` and use of `eventBus.busName` / `eventBus.ebClient` in handler body.
- [ ] **M2 (optional):** Consider adding a validation package unit test for `saveIdPathSchema`.
- [ ] **M3:** Optional reminder in Task 4.1 to run validation build before tests.
- [ ] **L1:** If using `init.ts`, state that `requireEventBus` must be exported from events `index.ts`.
