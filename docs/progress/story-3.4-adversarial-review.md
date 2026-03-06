# Adversarial Review: Story 3.4 — Save Filtering & Sorting

**Date:** 2026-02-23  
**Artifact:** `_bmad-output/implementation-artifacts/3-4-save-filtering-sorting.md`  
**Scope:** Story 3.4 acceptance criteria, tasks, technical requirements, alignment with Epic 3 intent, Epic 2/3.2 foundation, and project standards.

---

## Summary

The story is well-scoped and builds correctly on Story 3.2’s list/get API and in-memory strategy. The review finds **one critical conflict** with the Epic 3 plan (nextToken behavior), **several high-impact gaps** (validation error message vs AC9, default order semantics, ADR-008 test requirement), and **medium/low clarifications** (missing linkedProjectCount handling, schema placement, optional truncated) that could cause rework or inconsistent behavior if unaddressed.

---

## Epic 3 Intent & Build-on-Epic-2 Check

- **Epic 3 intent:** Story 3.4 delivers FR12 (filter by type), FR13 (filter by linkage), FR14 (search title/source), FR19 (sort by date/title/last accessed). The artifact’s ACs and Technical Requirements align with the epic and with `docs/progress/epic-3-stories-and-plan.md` Story 3.4.
- **Builds on 3.2:** Correctly depends on `3-2-list-get-saves-api`; reuses `queryAllItems`, same ceiling (1000), same `GET /saves` handler; no new routes or Lambdas. In-memory filter/sort after fetch matches the epic’s “extends Story 3.2’s in-memory strategy.”
- **Epic 2 / project standards:** Same auth (JWT or API key via existing middleware), same ADR-008 error shape, same route registry and CDK pattern (no infra change for 3.4). GET /saves remains read-only; no rate-limit change (consistent with 3.2). Architecture compliance table correctly references ADR-001, ADR-008, ADR-014, NFR-P2.

---

## Critical

### C1: nextToken behavior contradicts Epic 3 plan (ignore vs 400)

**Epic 3 source** (`docs/progress/epic-3-stories-and-plan.md`, Story 3.4 Technical Notes):

> If `nextToken` references a save not present in the current filtered/sorted result set (e.g., client changed filters between paginated requests), the server **MUST ignore the token and return results from the beginning** (equivalent to no `nextToken`).

**Artifact** (Task 2.4, Developer Context):

> If nextToken resolves to an item not in the current filtered/sorted set, **treat as invalid and return 400** "nextToken is invalid or has expired — restart pagination" (defensive per epic plan).

**Conflict:** The epic explicitly requires **ignore token and return from page 1**. The artifact requires **400 and “restart pagination”**. They are different behaviors: one is silent reset, the other is an error.

**Impact:** Implementers following the artifact will violate the epic’s AC/technical note. Frontends that rely on “ignore and reset” (e.g. retry without nextToken) would instead receive 400 and need different handling.

**Recommendation:** Align the artifact with the epic. Either:

1. **Preferred:** Change Task 2.4 and Developer Context to: “If nextToken resolves to a saveId not in the current filtered/sorted list, **ignore nextToken** and return the first page (same as omitting nextToken). Do not return 400.” Update AC9/AC10 wording if any implied “invalid nextToken → 400” applies only to malformed/stale tokens (e.g. unparseable or pointing to a save that no longer exists in the **unfiltered** set), and document that “cursor not in filtered set” is handled by reset.
2. **Alternative:** If the product decision is to return 400 for “cursor not in filtered set,” update the Epic 3 story and technical note to say so and drop “ignore the token.”

Until this is resolved, the artifact and epic are inconsistent.

---

## High

### H1: AC9 “valid options listed” vs default validation message

**AC9:** Invalid filter or sort value → 400 `{ error: { code: 'VALIDATION_ERROR', message: '...', requestId } }` **with valid options listed**.

**Current behavior:** `@ai-learning-hub/validation`’s `validate()` throws `AppError(ErrorCode.VALIDATION_ERROR, "Validation failed", { errors: details })` where `details` are Zod’s per-field messages. The top-level **message** is the generic `"Validation failed"`. Zod’s enum errors often put valid values in the per-field message (or in `details.errors[].message`), but the main `error.message` in the response does not necessarily “list valid options.”

**Impact:** If clients or docs assume the main `message` lists options, they will not get that. If the story is satisfied by listing options in `error.details.errors`, the artifact should say so explicitly.

**Recommendation:**

1. In Task 1.3 and Technical Requirements, state either: (a) “The 400 response must list valid options **in the error message or in error.details**,” and/or (b) “For enum validation failures (contentType, linkStatus, sort, order), use a custom message that includes the valid values (e.g. `contentType must be one of: article, video, podcast, ...`) so that AC9 is satisfied in `error.message`.”
2. In Task 3.1, add an explicit test: “Invalid contentType/linkStatus/sort returns 400; response body (message or details) includes the list of valid options.”

---

### H2: Default `order` when only `sort` is provided is underspecified

**Artifact:** “Defaults: sort=createdAt, order=desc for date sorts and order=asc for title.”

**Gap:** When the client sends `sort=title` but omits `order`, the default must be `asc`. When the client sends `sort=createdAt` and omits `order`, the default must be `desc`. Zod’s `.default()` is per-field and cannot express “default order depending on sort.” The artifact does not say where this conditional default is applied (schema refinement, transform, or handler logic).

**Recommendation:** In Task 1.1 or Dev Notes, add: “Apply default for `order` in the handler after parsing: if `order` is undefined, set order to `'desc'` when sort is `createdAt` or `lastAccessedAt`, and to `'asc'` when sort is `title`.” Optionally add a schema refinement that sets order from sort when order is missing, and document it so tests can assert the default behavior.

---

### H3: ADR-008 error path tests not explicitly required

**Project standard (Story 2.1-D5, AC12):** Every handler test file in `backend/functions/**` must include at least one error path test using `assertADR008Error`.

**Artifact (Task 3.1):** Requires tests for “invalid contentType/linkStatus/sort → 400 with valid options” but does not mention `assertADR008Error` or “ADR-008 body shape.”

**Impact:** Implementers might add 400 tests that only assert status and message and omit the shared ADR-008 assertion, weakening consistency with other handlers.

**Recommendation:** In Task 3.1 or Testing Requirements, add: “For all 400 validation error paths, use `assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400)` from `backend/test-utils` so that ADR-008 compliance is asserted.”

---

## Medium

### M1: Missing `linkedProjectCount` for old or partial items

**Artifact:** linkStatus filter uses `linkedProjectCount > 0` (linked) and `linkedProjectCount === 0` (unlinked). Save type has `linkedProjectCount: number` (no `?`).

**Reality:** Older items or partial writes might lack the attribute; in JS/TS that becomes `undefined`. Using `item.linkedProjectCount === 0` would treat missing as “not 0” and exclude the item from `linkStatus=unlinked`.

**Recommendation:** In Task 2.2 or Dev Notes, state: “Treat missing `linkedProjectCount` as 0: use `(item.linkedProjectCount ?? 0) > 0` for linked and `(item.linkedProjectCount ?? 0) === 0` for unlinked.”

---

### M2: Schema location: handler-inline vs shared package

**Artifact:** “Optional: new schema in `backend/shared/validation/src/schemas.ts` (e.g. `listSavesQuerySchema`) and export from index.”

**Current 3.2:** `saves-list/handler.ts` defines `listQuerySchema` inline (limit, nextToken only). The artifact leaves open whether 3.4 extends that inline schema or adds a shared `listSavesQuerySchema`.

**Impact:** If the list query schema stays handler-inline, other callers (e.g. future BFF or tests) cannot reuse it. If it moves to validation, the handler must be updated to import it and the artifact should say “add” not “optional.”

**Recommendation:** Decide and document: “Use a single list query schema (either extend the inline schema in the handler with the new params, or add `listSavesQuerySchema` in `@ai-learning-hub/validation` and use it in the handler). If added to validation, export from the package index and reference it in File Structure Requirements.”

---

### M3: `truncated` optional and omission when false

**Artifact:** Response shape “`truncated?: boolean`” and “`truncated: true` only when … capped at 1000.”

**Clarification:** When the user has ≤1000 saves (or the filtered set is from a truncated fetch but we still don’t hit ceiling), the artifact implies we may omit `truncated` or set it to false. Story 3.2’s TODO says “expose truncated in response” when truncated; it does not require sending `truncated: false` when not truncated.

**Recommendation:** One sentence in Technical Requirements or Dev Notes: “Include `truncated` in the response only when `truncated === true` (i.e. `...(truncated && { truncated: true })`); omit when not truncated so clients can treat absence as false.” This matches “truncated: true only when…” and keeps the contract clear.

---

## Low / Clarifications

### L1: Search on empty or missing `title`

**AC4:** “title or url contains” (case-insensitive). Save has `title?: string` and `url: string`.

**Recommendation:** In Task 2.2, explicitly state: “For search, match when the search string is included in `(item.title ?? '')` or `item.url` (case-insensitive).” This avoids ambiguity for missing title.

---

### L2: Sort stability for ties

**Artifact:** Sort by createdAt, lastAccessedAt, or title; null/empty lastAccessedAt or title “sort to bottom.”

**Clarification:** For ties (e.g. same createdAt), the artifact does not require a secondary sort. Determinism helps pagination and testing.

**Recommendation:** Optional: “For tie-breaking when sort key values are equal, use saveId (e.g. ascending) so order is deterministic.” Can be deferred if not required by AC.

---

### L3: Test “nextToken invalid or not in filtered set”

**Artifact (Task 3.1):** “nextToken invalid or not in filtered set → 400.”

**Conflict with C1:** If the artifact is updated to “ignore nextToken when cursor not in filtered set” (per epic), this test should become: “nextToken that decodes to a valid ULID but whose saveId is not in the current filtered/sorted list → first page returned (no 400).” Only **malformed** nextToken (unparseable or invalid ULID) would still yield 400. Task 3.1 should be updated to match the chosen nextToken behavior.

---

## Compliance Check (Artifact vs Standards)

| Item                                                             | Status               |
| ---------------------------------------------------------------- | -------------------- |
| Epic 3 FR12, FR13, FR14, FR19 covered by ACs                     | ✅                   |
| Builds on 3.2 only; no new routes/Lambdas                        | ✅                   |
| ADR-001 (keys), ADR-008 (errors), ADR-014 (API-first) referenced | ✅                   |
| NFR-P2 (warm &lt; 1s) acknowledged                               | ✅                   |
| Same GET /saves, queryAllItems, ceiling 1000                     | ✅                   |
| contentTypeSchema (validation) for filter                        | ✅                   |
| Save entity: linkedProjectCount, lastAccessedAt, title, url      | ✅                   |
| nextToken semantics vs epic plan                                 | ❌ Conflict (C1)     |
| AC9 “valid options listed” vs default validation message         | ⚠️ Unclear (H1)      |
| assertADR008Error in handler tests                               | ⚠️ Not required (H3) |

---

## Recommended Story Edits (Concise)

1. **nextToken (C1):** Align with epic: either require “ignore nextToken when cursor not in filtered set and return first page” and update Task 2.4 and Developer Context, or change the epic to “return 400” and document the decision. Update Task 3.1/L3 accordingly.
2. **AC9 (H1):** Require that 400 for invalid enum params list valid options in `error.message` or in `error.details`, and add a test that asserts the response body contains valid options.
3. **Default order (H2):** Document that the handler sets default `order` from `sort` when `order` is omitted (desc for date sorts, asc for title).
4. **Tests (H3):** Require `assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400)` for validation error paths in saves-list handler tests.
5. **linkedProjectCount (M1):** Use `(item.linkedProjectCount ?? 0)` for linkStatus filter.
6. **Schema (M2):** Decide inline vs shared `listSavesQuerySchema` and state it in the artifact.
7. **truncated (M3):** State that `truncated` is included only when true.
8. **Search (L1):** Use `(item.title ?? '')` for search on title.

---

## Conclusion

Story 3.4’s scope, dependency on 3.2, and use of project standards (ADRs, shared packages, GET-only extension) are sound. The main fix is **resolving the nextToken conflict with the Epic 3 plan** (ignore vs 400). Addressing AC9 messaging, default order semantics, ADR-008 test requirement, and the medium/low items will keep implementation and tests aligned with the epic and with existing project conventions.
