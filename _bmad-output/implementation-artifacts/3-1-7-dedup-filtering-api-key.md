---
id: "3.1.7"
title: "Dedup, filtering & API key"
status: review
depends_on:
  - 3-1-4-dedup-scan-agent-pipeline
  - 3-4-save-filtering-sorting
touches:
  - backend/functions/saves
  - backend/functions/saves-list
  - backend/functions/saves-get
  - backend/functions/saves-update
  - backend/functions/saves-delete
  - backend/functions/saves-restore
  - backend/shared/validation
  - backend/shared/middleware
  - infra (route/scope config if applicable)
risk: low
---

# Story 3.1.7: Dedup, filtering & API key

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the platform maintainer,
I want the saves domain to have no duplicated filtering/scope logic and consistent API key scope enforcement across all saves endpoints,
so that DRY is maintained, capture-only keys are correctly restricted, and the dedup scanner can verify cross-handler consistency.

## Acceptance Criteria

1. **AC1 (Dedup — filtering)**  
   Given the saves-list handler and any other handlers that use filter/sort query params, when the dedup scanner runs over the saves domain, then no Important+ findings exist for: duplicate filter/sort schema definitions, duplicate filter constants, or in-handler copy of `listSavesQuerySchema` / shared validation.

2. **AC2 (Dedup — API key / scope)**  
   Given all saves handlers (create, list, get, update, delete, restore), when the dedup scanner runs, then no Important+ findings exist for: duplicate scope checks, duplicate requiredScope constants, or middleware usage that could be centralized (e.g. same pattern in every handler).

3. **AC3 (API key scope matrix)**  
   Given the route registry and authorizer config, when a request hits a saves endpoint, then: (a) `POST /saves` allows both `*` and `saves:write`; (b) `GET /saves`, `GET /saves/:saveId`, `PUT /saves/:saveId`, `DELETE /saves/:saveId`, `POST /saves/:saveId/restore` require a scope that permits read/update/delete (e.g. `*` or a future `saves:read` as defined by product) — **`saves:write` alone must not satisfy these routes**; (c) capture-only keys (`saves:write` only) cannot call list/get/update/delete/restore.

4. **AC4 (Scope enforcement in handlers)**  
   Given each saves handler, when the handler runs, then it uses the shared scope middleware (or route-level scope config) to enforce the scope matrix; no handler implements its own ad-hoc scope check that duplicates middleware logic.

5. **AC5 (Filtering — shared schema)**  
   Given the saves-list handler, when it validates list query params (filter, sort, search, pagination), then it uses the shared `listSavesQuerySchema` (or equivalent) from `@ai-learning-hub/validation`; no inline duplicate schema definition for the same query shape.

6. **AC6 (Tests)**  
   Given the scope matrix, when integration or handler tests run, then: (a) capture-only key can POST /saves and receives 403 (or equivalent) for GET/PUT/DELETE/restore; (b) full-access key can call all saves endpoints; (c) invalid or missing scope is rejected with consistent error (e.g. SCOPE_INSUFFICIENT / 403).

## Tasks / Subtasks

- [x] Task 1: Verify and fix filtering dedup (AC: #1, #5)
  - [x] 1.1 Manual comparison of all handlers vs shared validation — no duplicate filter/sort schemas found. `listSavesQuerySchema` is the single source of truth in `@ai-learning-hub/validation`.
  - [x] 1.2 saves-list uses only `listSavesQuerySchema` from shared validation; no inline duplicates.
  - [x] 1.3 No filter/sort constants duplicated across handlers — verified clean.

- [x] Task 2: Verify and fix scope/middleware dedup (AC: #2, #4)
  - [x] 2.1 Manual comparison of all handlers — no duplicate scope checks or requiredScope constants. All handlers use wrapHandler's requiredScope option exclusively.
  - [x] 2.2 Confirmed: all 6 saves handlers rely solely on wrapHandler's requiredScope; no ad-hoc scope logic.
  - [x] 2.3 Scope matrix documented in route-registry.ts comments (inline, next to Epic 3 route entries).

- [x] Task 3: Document and enforce API key scope matrix (AC: #3, #6)
  - [x] 3.0 Pre-implementation audit: saves (create) had `saves:write`; list/get had no requiredScope; update/delete/restore had `saves:write`. Fixed: list/get now `requiredScope: '*'`; update/delete/restore now `requiredScope: '*'`.
  - [x] 3.1 Scope matrix documented in `infra/config/route-registry.ts` comments.
  - [x] 3.2 Confirmed: POST /saves allows `saves:write` and `*`; all other saves endpoints require `*` only.
  - [x] 3.3 Added scope enforcement tests to all 6 handler test files: capture-only key → 403 SCOPE_INSUFFICIENT for list/get/update/delete/restore; full-access key → success; capture-only key → 200 for create. Uses `assertADR008Error(result, ErrorCode.SCOPE_INSUFFICIENT, 403)`.

- [x] Task 4: Quality gates and dedup re-scan (AC: #1, #2)
  - [x] 4.1 `npm test` (all pass), `npm run lint` (0 errors), `npm run type-check` (clean).
  - [x] 4.2 Manual review confirms 0 Important+ findings for filtering and scope duplication across all 6 saves handlers.

## Dev Notes

- **Epic 3.1 context:** This story is tech-debt consolidation. Stories 3.1.1–3.1.4 established shared schemas, test utilities, handler consolidation, and the dedup scan pipeline. Story 3.4 added filtering/sorting to saves-list. This story closes gaps: (1) ensure filtering uses shared schema only (no new duplication), (2) ensure API key scope is consistent and documented, (3) ensure no duplicate scope/filter logic across handlers.
- **Scope semantics:** Epic 2 defined API key scopes (e.g. `*`, `saves:write`). Capture-only keys (`saves:write`) are for iOS Shortcut / agents that only need to create saves. List/get/update/delete/restore must not be callable with `saves:write` only; middleware should enforce this. **Current implementation:** list/get have no `requiredScope` (any authenticated user can call); update/delete/restore use `requiredScope: "saves:write"` so capture-only keys can call them. This story fixes that: list/get/update/delete/restore must use a scope that capture-only does not have (e.g. `requiredScope: '*'`).
- **Dedup scanner:** If 3.1.4 is implemented, run the epic-dedup-scanner over the saves domain and address any findings. The create handler lives at `backend/functions/saves/handler.ts` (not `saves-create`); the glob `saves*/handler.ts` does **not** match it. Ensure the dedup domain explicitly includes `backend/functions/saves/handler.ts` (e.g. two globs or a pattern that matches both `saves` and `saves-*`). If not yet implemented, perform manual cross-handler comparison including saves/handler.ts, saves-list, saves-get, saves-update, saves-delete, saves-restore.
- **Route registry / infra:** The route registry (`infra/config/route-registry.ts`) has no `requiredScope` field; scope is enforced only in handler code via `wrapHandler(..., { requiredScope })`. Document the scope matrix in auth docs or in route-registry comments; scope remains handler-level unless the team chooses to extend the registry.

### Project Structure Notes

- Handlers: **create** at `backend/functions/saves/handler.ts` (not saves-create); list at `saves-list`, get at `saves-get`, update at `saves-update`, delete at `saves-delete`, restore at `saves-restore`.
- Shared: `@ai-learning-hub/validation` (listSavesQuerySchema), `@ai-learning-hub/middleware` (scope checks).
- Scope is set per handler in `wrapHandler(..., { requiredScope })`; route registry has no requiredScope field.

### References

- [Source: _bmad-output/implementation-artifacts/3-1-4-dedup-scan-agent-pipeline.md] — Dedup scanner/fixer and pipeline
- [Source: _bmad-output/implementation-artifacts/3-4-save-filtering-sorting.md] — List filter/sort schema and saves-list behavior
- [Source: backend/shared/middleware] — Scope middleware and SCOPE_INSUFFICIENT
- [Source: docs/adversarial-review-story-3-1-4-dedup-scan-agent-pipeline.md] — Review findings for 3.1.4 (domain derivation, fixer safety)

## Architecture Compliance

| ADR / NFR | How This Story Must Comply |
|-----------|----------------------------|
| **NFR-M1 (DRY)** | Remove duplicate filter/sort and scope logic; use only shared validation and middleware. |
| **ADR-008** | Scope failures must return consistent error shape (e.g. SCOPE_INSUFFICIENT, 403). Use shared error helpers. |
| **Epic 2 (API keys)** | Scope matrix must align with defined scopes: `*`, `saves:write`; no new ad-hoc scope logic. |
| **Shared libraries** | All validation from `@ai-learning-hub/validation`, scope from `@ai-learning-hub/middleware`; no local copies. |

## Testing Requirements

- **Handler/integration tests:** Capture-only key (saves:write only) → 200 for POST /saves; 403 (SCOPE_INSUFFICIENT or equivalent) for GET /saves, GET /saves/:id, PUT, DELETE, restore. Full-access key (*) → all saves endpoints return success where applicable.
- **Validation error consistency:** Use `assertADR008Error` (or equivalent) for 403 scope failures so message/code are consistent.
- **Quality gates:** `npm test`, `npm run lint`, `npm run build`, `npm run type-check`, `npm run format` must pass. No new duplication; dedup scan (or manual review) shows 0 Important+ for filtering and scope.

## Previous Story Intelligence

### From Story 3.1.4 (Dedup scan pipeline)

- Dedup scanner reads ALL handler files in the domain (`backend/functions/saves*/handler.ts`) and compares to shared packages. Use it to verify no duplicate filter/sort or scope logic.
- If story touches only shared packages (no handler paths), dedup loop can be skipped; this story touches handlers, so dedup applies.
- Fixer must not push; commit only on current branch. Findings path: `.claude/dedup-findings-{story.id}-round-{round}.md`.

### From Story 3.4 (Save filtering & sorting)

- saves-list uses (or should use) `listSavesQuerySchema` from `@ai-learning-hub/validation` for contentType, linkStatus, search, sort, order. Ensure no inline duplicate schema.
- Filter/sort applied in-memory after queryAllItems; pagination (nextToken) and truncated flag already defined.

### From Epic 2 (API key authorizer)

- Scopes stored in context (e.g. `*` or `["saves:write"]`). Middleware checks requiredScope before handler runs. Use same pattern for all saves routes.

## File Structure Requirements

### Likely modify

- `backend/functions/saves-list/handler.ts` — ensure list query validation uses shared schema only.
- `backend/functions/saves/handler.ts` (create), `saves-get`, `saves-update`, `saves-delete`, `saves-restore` — set requiredScope per AC3: POST /saves keeps `requiredScope: "saves:write"`; list/get add `requiredScope: '*'`; update/delete/restore change from `saves:write` to `requiredScope: '*'`. Remove any ad-hoc scope checks.
- `backend/shared/validation/src/schemas.ts` (or index) — ensure listSavesQuerySchema is the single source of truth (saves-list already uses it; verify no inline duplicate).
- `backend/shared/middleware` — no change unless centralizing requiredScope; scope remains in each handler's wrapHandler options.
- Auth docs or route-registry comments — document scope matrix (POST = saves:write or *; list/get/update/delete/restore = * only).
- Handler and/or integration tests — add scope matrix tests: invoke saves list/get/update/delete/restore with capture-only key → 403; with full-access → success; use assertADR008Error for SCOPE_INSUFFICIENT.

### Do not create

- New shared packages for scope or filter logic; use existing `@ai-learning-hub/validation` and `@ai-learning-hub/middleware`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4 (claude-sonnet-4-20250514)

### Debug Log References

None

### Completion Notes List

- No filtering/sort dedup issues found — `listSavesQuerySchema` already centralized in shared validation
- No ad-hoc scope checks found — all handlers use wrapHandler exclusively
- 5 scope changes: saves-list and saves-get added `requiredScope: '*'`; saves-update, saves-delete, saves-restore changed from `saves:write` to `'*'`
- 12 new scope enforcement tests added (2 per handler: capture-only key rejection + full-access key success)
- Scope matrix documented in route-registry.ts inline comments

### File List

- `backend/functions/saves-list/handler.ts` — added `requiredScope: '*'`
- `backend/functions/saves-get/handler.ts` — added `requiredScope: '*'`
- `backend/functions/saves-update/handler.ts` — changed scope from `saves:write` to `'*'`
- `backend/functions/saves-delete/handler.ts` — changed scope from `saves:write` to `'*'`
- `backend/functions/saves-restore/handler.ts` — changed scope from `saves:write` to `'*'`
- `backend/functions/saves/handler.test.ts` — added scope tests (create: capture-only allowed, full-access allowed)
- `backend/functions/saves-list/handler.test.ts` — added scope tests (capture-only rejected, full-access allowed)
- `backend/functions/saves-get/handler.test.ts` — added scope tests
- `backend/functions/saves-update/handler.test.ts` — added scope tests
- `backend/functions/saves-delete/handler.test.ts` — added scope tests
- `backend/functions/saves-restore/handler.test.ts` — added scope tests
- `infra/config/route-registry.ts` — added scope matrix documentation comments
