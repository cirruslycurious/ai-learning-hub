# Adversarial Review: Story 3.3 — Update, Delete & Restore Saves API

**Date:** 2026-02-22  
**Artifact:** `_bmad-output/implementation-artifacts/3-3-update-delete-restore-api.md`  
**Scope:** Story 3.3 acceptance criteria, tasks, technical requirements, and alignment with existing codebase.

---

## Summary

The story is well-structured and mostly implementable as written. The review identifies **one critical gap** (404 message consistency), **several high-impact clarifications** (conditional-update flow, event detail union, and CORS/infra wording), and **minor omissions** (tests, rate-limit value, and event backward compatibility) that could cause rework or production inconsistencies if unaddressed.

---

## Critical

### C1: 404 response message will violate ACs if db helper error is allowed to bubble

**AC5, AC6, AC12** require:

```json
{ "error": { "code": "NOT_FOUND", "message": "Save not found", "requestId" } }
```

**Current behavior:** `@ai-learning-hub/db`’s `updateItem` throws `AppError(ErrorCode.NOT_FOUND, "Item not found")` on `ConditionalCheckFailedException` (see `backend/shared/db/src/helpers.ts` ~303–304). The middleware forwards the `AppError` message into the response body.

**Impact:** For **PATCH** and for **DELETE/RESTORE** when the handler concludes “missing → 404”, if the handler lets the db helper’s exception propagate, the API will return `message: "Item not found"` instead of `"Save not found"`, failing the ACs.

**Evidence:** `saves-get` explicitly throws `new AppError(ErrorCode.NOT_FOUND, "Save not found")` when the save is missing or soft-deleted (e.g. `backend/functions/saves-get/handler.ts` ~41).

**Recommendation:** In the story, add an explicit requirement: for any path that returns 404 for a save (PATCH/DELETE/RESTORE), the handler **must** throw `new AppError(ErrorCode.NOT_FOUND, "Save not found")`. In particular:

- **PATCH:** On conditional failure (or any “not found” path), catch or avoid propagating the db helper’s NOT_FOUND and instead throw with message `"Save not found"`.
- **DELETE / RESTORE:** After disambiguating with `getItem`, when returning 404 throw `AppError(ErrorCode.NOT_FOUND, "Save not found")` (not the raw db exception).

---

## High

### H1: Conditional-update + getItem flow is not spelled out; implementers may misuse the helper

**Story text (Task 3.4–3.5, 4.4–4.5):** “Attempt conditional soft delete … On conditional failure: getItem to disambiguate missing vs already deleted.”

**Reality:** The shared `updateItem` **does not** return on condition failure; it throws `AppError(ErrorCode.NOT_FOUND, "Item not found")`. So “on conditional failure” means “in the catch block for that NOT_FOUND.”

**Gap:** The story never says to **catch** the exception from `updateItem`. A developer might assume a new helper that returns a result type, or might call `getItem` before `updateItem` (adding latency and races). The existing **saves create** handler (3.1b) already uses the “try updateItem, catch NOT_FOUND, then use existing context” pattern for restore; here the handler has no prior item, so it must `getItem` in the catch block.

**Recommendation:** In Task 3 and Task 4, add an explicit step, e.g. “Catch `AppError` with `ErrorCode.NOT_FOUND` from the conditional update; in the catch block call `getItem` with the same key. If no item → 404; if item has `deletedAt` (DELETE) or lacks `deletedAt` (RESTORE) → idempotent success (204 / 200).” This makes the intended control flow and use of the existing helper unambiguous.

---

### H2: Event detail type extension will break existing call sites unless done as a discriminated union

**Story (Task 1.1):** Extend `SavesEventDetailType` with `SaveUpdated` and `SaveDeleted` and “extend the detail typing” for the new shapes.

**Current state:** `backend/shared/events/src/events/saves.ts` defines a single `SavesEventDetail` with `userId`, `saveId`, `url`, `normalizedUrl`, `urlHash`, `contentType`. The **saves create** handler emits `SaveRestored` with that shape (including `url` and `contentType`).

**Conflict:** AC2 says `SaveUpdated` detail includes `updatedFields: string[]` and does not require `contentType`. AC4/AC13 say `SaveDeleted`/`SaveRestored` detail includes `userId`, `saveId`, `urlHash`, `normalizedUrl` (no `url`/`contentType`). If the events package is extended by **replacing** the single `SavesEventDetail` with a union, existing `emitEvent<..., SavesEventDetail>(..., detail: { userId, saveId, url, normalizedUrl, urlHash, contentType })` in the saves create handler must still type-check.

**Recommendation:** In Task 1.1, require a **discriminated union** (e.g. by `detailType` or separate interfaces) so that `SaveCreated`/`SaveRestored` keep their current shape (including `url` and `contentType` where used) and `SaveUpdated`/`SaveDeleted` use the slimmer shapes. Explicitly state that existing call sites in `backend/functions/saves/handler.ts` must compile without changing their emit payloads (Task 1.2 should then be a quick verification).

---

### H3: CORS and route wiring wording can be read as “add preflight only to restore”

**Story (Task 5.4, File Structure):** “Wire API Gateway … Add CORS preflight to the `{saveId}` and `restore` resources.”

**Current CDK:** `saveByIdResource` already has `addCorsPreflight(corsOptions)` (Story 3.2). So “add CORS preflight to `{saveId}`” could be interpreted as “ensure it’s there” (no-op) or “add it if missing.” The **restore** sub-resource (`/saves/{saveId}/restore`) is new and **must** get its own `addCorsPreflight` on that new resource object.

**Recommendation:** Clarify: “Ensure `/saves/{saveId}` has CORS preflight (already present from 3.2). **Add** CORS preflight on the **new** `/saves/{saveId}/restore` resource.” This avoids duplicate preflight or missing preflight on restore.

---

### H4: PATCH empty body and “at least one field” are aligned; story should reference schema refinement

**Technical requirements:** “Only fields present in the request body are updated.”

**Reality:** `updateSaveSchema` in `backend/shared/validation/src/schemas.ts` uses `.refine(..., { message: "At least one field must be provided" })`, so an empty body `{}` fails validation and returns 400. The story’s AC9 and testing requirements already cover invalid body and validation errors.

**Recommendation:** One sentence in “Technical Requirements” or “Library Requirements”: “Empty or missing body is rejected by `updateSaveSchema` (at least one of title, userNotes, contentType, tags required).” This ties the “only present fields updated” behavior to the existing schema and avoids a future “allow PATCH with {} to no-op” misinterpretation.

---

## Medium

### M1: Rate limit value for write endpoints is not stated

**Story (Task 2.4, 3.3, 4.3):** “Enforce write rate limit using `enforceRateLimit` (use the same limit as `saves-create` unless Epic 2 docs specify otherwise).”

**Reality:** The saves create handler uses “200 saves per hour” (see `backend/functions/saves/handler.ts`). The story defers to “same as saves-create” but does not state the value in the artifact.

**Recommendation:** In Developer Context or Technical Requirements, state explicitly: “Write rate limit: same as saves-create (e.g. 200 saves per hour per user for create; use the same operation bucket or an equivalent for update/delete/restore so that a user cannot bypass the intent by mixing operations.” If the product decision is to share one bucket across all save writes, say so to avoid each handler using a different key and effectively multiplying the limit.

---

### M2: DELETE “best-effort” for already-deleted and timestamp behavior

**Story (Technical Requirements):** “If item exists but already deleted → return 204 **without** changing timestamps (best-effort).”

**Implementation:** The flow is conditional update (fails when `deletedAt` exists) → catch → getItem → if `deletedAt` set, return 204 **without** calling update. So timestamps are not changed. “Best-effort” might be read as “we might sometimes update timestamps”; the actual behavior is “we never update when already deleted.”

**Recommendation:** Replace “best-effort” with: “Do not perform any write when the save is already soft-deleted; return 204 with no timestamp change.” This matches the described flow and avoids ambiguity.

---

### M3: Test list does not call out “wrong user” explicitly

**Testing Requirements** cover 404 for “missing save” and (for PATCH) “soft-deleted save,” and 404 for “missing save” for RESTORE. AC5/AC6/AC12 also require 404 when the save exists but belongs to **another user** (per-user isolation).

**Reality:** Because keys are `USER#<userId>`, a request with a valid `saveId` that belongs to another user will result in getItem/updateItem returning nothing or condition failure, and the handler should return 404. That is “not found” from the client’s perspective, but tests should lock in that **wrong user → 404**, not 403 or 200.

**Recommendation:** In the “Required test scenarios” for PATCH, DELETE, and RESTORE, add: “404 when save exists but belongs to another user (wrong PK).” This keeps NFR-S4 and per-user isolation clearly validated by tests.

---

## Low / Clarifications

### L1: `returnValues` for DELETE

**Story:** DELETE returns 204 No Content. The shared `updateItem` defaults to `ReturnValues: "ALL_NEW"`. For DELETE, the handler does not need the updated item. Either pass `returnValues: "NONE"` to avoid reading attributes back, or leave default and ignore the return; both are correct. Stating “use returnValues: 'NONE' for DELETE” would make the intent explicit and slightly reduce read capacity.

### L2: Event payload backward compatibility for `SaveRestored`

**Current 3.1b:** `SaveRestored` is emitted with `url` and `contentType` in the detail. AC13 only requires `userId`, `saveId`, `urlHash`, `normalizedUrl`. Keeping `url` and `contentType` in `SaveRestored` (and in the type union) preserves backward compatibility for existing consumers; the story can note “existing SaveRestored payload remains valid; new fields must include at least …” so that 3.3’s restore handler does not drop fields that 3.1b already emits.

### L3: Architecture enforcement tests (T2/T4) and new routes

The adversarial architecture review (2026-02-20) found that route-completeness and lambda-route-wiring tests do not verify that the **correct** Lambda is wired to each route (F1, F3). Adding three new routes and three new Lambdas will increase the risk of wiring the wrong handler to a method. Task 7.2 says “Ensure architecture enforcement tests still pass”; the story does not require adding a test that asserts “PATCH /saves/{saveId} is integrated with savesUpdateFunction.” Consider a follow-up story or tech-debt item to strengthen T2/T4 so that new routes like these are covered by handler-ref → integration checks.

---

## Compliance Check (Story vs Codebase)

| Item                                                                | Status                                   |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `updateSaveSchema` exists and allows partial fields + at least one  | ✅                                       |
| `updateItem` supports conditionExpression and returnValues          | ✅                                       |
| `updateItem` throws NOT_FOUND on condition failure                  | ✅ (must be caught for DELETE/RESTORE)   |
| `toPublicSave` strips PK, SK, deletedAt                             | ✅ (`backend/shared/db/src/saves.ts`)    |
| `validatePathParams` + ULID schema used in saves-get                | ✅                                       |
| `enforceRateLimit` in @ai-learning-hub/db                           | ✅                                       |
| `emitEvent` fire-and-forget, SAVES_EVENT_SOURCE                     | ✅                                       |
| SAVES_TABLE_CONFIG, requireEnv pattern                              | ✅                                       |
| HandlerRef and ROUTE_REGISTRY extendible                            | ✅                                       |
| SavesEventDetailType currently has SaveCreated \| SaveRestored only | ✅ (Story adds SaveUpdated, SaveDeleted) |

---

## Recommended Story Edits (concise)

1. **ACs / Technical requirements:** Require that any 404 for a save returns `message: "Save not found"` and that handlers throw `AppError(ErrorCode.NOT_FOUND, "Save not found")` (do not let db “Item not found” propagate).
2. **Task 3 (DELETE):** Add step: catch `AppError(ErrorCode.NOT_FOUND)` from conditional update; in catch, call `getItem`; if null → 404 with “Save not found”; if item has `deletedAt` → 204.
3. **Task 4 (RESTORE):** Same pattern: catch NOT_FOUND, getItem, null → 404, no `deletedAt` → 200 with current save.
4. **Task 1.1 (events):** Specify that detail types are a discriminated union; existing SaveCreated/SaveRestored payloads unchanged and still valid.
5. **Task 5.4 / File structure:** Clarify CORS: ensure preflight on existing `{saveId}`; add preflight on new `restore` resource only.
6. **Technical requirements:** State that empty PATCH body is invalid per `updateSaveSchema` (at least one field required).
7. **Rate limit:** State the limit (e.g. same as saves-create, 200/hour) and whether update/delete/restore share the same bucket.
8. **Testing:** Add “404 when save belongs to another user” for PATCH, DELETE, and RESTORE.
9. **DELETE wording:** Replace “best-effort” with “Do not perform any write when already deleted.”

---

## Conclusion

Story 3.3 is implementable with the current shared packages and patterns. The main risks are **AC-violating 404 messages** if the db helper’s NOT_FOUND is not replaced with “Save not found,” **confusion on conditional-update + getItem** (DELETE/RESTORE), and **event type breakage** if the new detail types are not introduced as a backward-compatible union. Applying the recommended edits and the test addition for “wrong user → 404” will reduce rework and keep behavior and tests aligned with the ACs and NFRs.
