---
id: "3.1.6"
title: "Saves CRUD & Validation Smoke Scenarios"
status: review
depends_on:
  - "3.1.5"
touches:
  - scripts/smoke-test/scenarios/saves-crud.ts
  - scripts/smoke-test/scenarios/saves-validation.ts
  - scripts/smoke-test/helpers.ts
  - scripts/smoke-test/phases.ts
risk: low
---

# Story 3.1.6: Saves CRUD & Validation Smoke Scenarios

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want **smoke test scenarios that exercise the full saves CRUD lifecycle and validation error paths in the deployed environment**,
so that **we prove DynamoDB access, IAM, env vars, TransactWriteItems, soft-delete, restore, and ADR-008 error handling work end-to-end in AWS**.

## Acceptance Criteria

**Phase 2 — Saves CRUD Lifecycle (SC1–SC8):**

| #   | Given                          | When                                                                  | Then                                                                                                                              |
| --- | ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | Valid JWT auth token available | `POST /saves` with `{ url: "https://example.com/smoke-test-" + Date.now() }` | 201 response; body has `{ data: { saveId, url, normalizedUrl, urlHash, contentType, tags, ... } }`; `saveId` is a valid ULID      |
| SC2 | Save created in SC1            | `GET /saves/<saveId>`                                                 | 200 response; body `data.saveId` matches SC1; `data.url` matches submitted URL; `data.lastAccessedAt` is present (updated on GET) |
| SC3 | Save created in SC1            | `GET /saves`                                                          | 200 response; `data.items` array contains an entry with matching `saveId`; response has `data.hasMore` (list contract: see saves-list handler) |
| SC4 | Save created in SC1            | `PATCH /saves/<saveId>` with `{ title: "Smoke Test Updated" }`        | 200 response; body `data.title` equals `"Smoke Test Updated"`; `data.updatedAt` is present and >= `data.createdAt` (ISO string comparison) |
| SC5 | Save created in SC1            | `DELETE /saves/<saveId>`                                              | 204 response; empty body                                                                                                          |
| SC6 | Save deleted in SC5            | `GET /saves/<saveId>`                                                 | 404 response; ADR-008 error shape with code `"NOT_FOUND"`                                                                         |
| SC7 | Save deleted in SC5            | `POST /saves/<saveId>/restore`                                        | 200 response; body `data.saveId` matches; `data.deletedAt` is absent (stripped by `toPublicSave`)                                 |
| SC8 | Save restored in SC7           | `GET /saves/<saveId>`                                                 | 200 response; save is accessible again; `data.title` still equals `"Smoke Test Updated"` (persisted through delete/restore cycle) |

**Phase 4 — Saves Validation Errors (SV1–SV4):**

| #   | Given                                              | When                                                                            | Then                                                             |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| SV1 | Valid auth token available                         | `POST /saves` with `{ url: "not-a-url" }`                                       | 400 response; ADR-008 error shape with code `"VALIDATION_ERROR"` |
| SV2 | Valid auth token available                         | `GET /saves/not-a-valid-ulid`                                                   | 400 response; ADR-008 error shape with code `"VALIDATION_ERROR"` |
| SV3 | Valid auth token available                         | `GET /saves/00000000000000000000000000` (valid ULID format, 26 chars, nonexistent) | 404 response; ADR-008 error shape with code `"NOT_FOUND"`        |
| SV4 | Save exists (see Dev Notes)     | `PATCH /saves/<saveId>` with `{ url: "https://changed.com" }` (immutable field) | 400 response; ADR-008 error shape with code `"VALIDATION_ERROR"` |

**General:**

| #   | Given                     | When                     | Then                                                                                                                                                     |
| --- | ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | All scenarios implemented | Scenarios registered     | Phase 2 (`saves-crud`) contains SC1–SC8; Phase 4 (`saves-validation`) contains SV1–SV4; phase registry updated                                           |
| AC2 | Test data created         | After scenario execution | All test saves are cleaned up (soft-deleted); cleanup runs after all scenarios in the phase/run (e.g. via runner's runCleanups()), not inside SC1's local finally; URLs use unique timestamps to avoid cross-run conflicts |
| AC3 | Existing phases intact    | After adding new phases  | Phase 1 (`infra-auth`) scenarios unchanged; `npm run smoke-test -- --phase=1` produces identical results                                                 |
| AC4 | Helper utilities needed   | For save response shapes | `assertSaveShape(body, options?)` in `scripts/smoke-test/helpers.ts` validating at least `{ data: { saveId, url, normalizedUrl, urlHash, contentType, tags, createdAt, updatedAt } }`; optional `requireLastAccessedAt` for GET responses (SC2, SC8) |

## Tasks / Subtasks

- [x] Task 1: Add `assertSaveShape` helper (AC: #4)
  - [x] 1.1 Added to `scripts/smoke-test/helpers.ts`
  - [x] 1.2 Validates: saveId, url, normalizedUrl, urlHash, contentType, tags, createdAt, updatedAt + optional lastAccessedAt
- [x] Task 2: Create `scripts/smoke-test/scenarios/saves-crud.ts` (SC1–SC8)
  - [x] 2.0 Eight scenario definitions with module-level shared state for saveId; SC1 calls registerCleanup for soft-delete; initSavesCrudCleanup wires the registry.
  - [x] 2.1–2.8 All 8 scenarios implemented per AC table
  - [x] 2.9 Cleanup runs via runner's runCleanups(), not inline
- [x] Task 3: Create `scripts/smoke-test/scenarios/saves-validation.ts` (SV1–SV4)
  - [x] 3.1 SV1: invalid URL → 400 VALIDATION_ERROR
  - [x] 3.2 SV2: invalid ULID → 400 VALIDATION_ERROR
  - [x] 3.3 SV3: nonexistent ULID → 404 NOT_FOUND
  - [x] 3.4 SV4: immutable field → 400 VALIDATION_ERROR (creates temp save, cleans up in finally)
- [x] Task 4: Register scenarios in phase registry (AC: #1)
  - [x] 4.1 Created `phases.ts` with Phase 1 (infra-auth), Phase 2 (saves-crud), Phase 4 (saves-validation)
  - [x] 4.2 Updated `run.ts` with --phase=N and --up-to=N support via getFilteredPhases()
  - [x] 4.3 Phase 1 scenarios unchanged; existing flat scenarios array preserved in index.ts for backward compat
- [x] Task 5: Verify (AC: #2, #3)
  - [x] 5.1 Cannot run smoke-test locally (requires deployed env); structure verified via lint + type-check
  - [x] 5.4 `npm run lint` — 0 errors; `npm run type-check` — clean; `npm test` — all pass

## Dev Notes

- **Dependency (3.1.5):** Story 3.1.5 (Smoke Test Phase Runner Infrastructure) must be done first. Before starting 3.1.6, confirm with 3.1.5 that: (1) Phase registry (e.g. `scripts/smoke-test/phases.ts`) exists with Phase 2 and Phase 4 entries (scenarios may be empty), (2) `run.ts` (or equivalent) accepts `--phase=N` and `--up-to=N` and executes only the selected phase(s), (3) Scenario list is built from the phase registry rather than a single flat list. If 3.1.5 is scope-limited to orchestrator phases only, unblock 3.1.6 via a prerequisite or align 3.1.5 with the epic plan.
- **State and cleanup (Phase 2):** SC2–SC8 need the `saveId` from SC1. Either implement as one compound scenario (single `run()` doing SC1–SC8 with one `finally` that soft-deletes), or eight scenarios with module/phase-level shared state and SC1 calling `registerCleanup(() => client.delete(\`/saves/${saveId}\`))` so cleanup runs at end of run (see Task 2.0). Cleanup must run after all scenarios in the phase/run (runner's runCleanups()), not inside SC1's local finally. Use URL `https://example.com/smoke-test-${Date.now()}` everywhere (table and implementation) for uniqueness.
- **SC1 validates the most infrastructure in a single call:** Lambda execution, DynamoDB TransactWriteItems (save item + user counter update), GSI (urlHash-index), EventBridge PutEvents permission, env vars (SAVES_TABLE, USERS_TABLE, EVENT_BUS_NAME), Zod validation, and middleware (auth + error handling + response wrapping).
- **Existing helpers:** `scripts/smoke-test/helpers.ts` already has `assertADR008(body, expectedCode?)`, `assertStatus(actual, expected, context)`, `assertUserProfileShape(body)`. Add `assertSaveShape(body, options?)` following the same pattern; do not import from backend — keep script runnable without build. Use `assertADR008(res.body, "<code>")` for SV1–SV4 and SC6.
- **Client:** Use `getClient()` from `../client.js`; supports `auth: { type: "jwt", token }`. Base URL from `SMOKE_TEST_API_URL`. See `scenarios/jwt-auth.ts` and `scenarios/user-profile.ts` for request/assert patterns.
- **ADR-008 error shape:** `{ error: { code: string, message: string, requestId: string } }`. Use `assertADR008(res.body, "VALIDATION_ERROR")` etc. for error scenarios.
- **Save API base path:** `/saves`. Create: `POST /saves` (body `{ url, title?, userNotes?, contentType?, tags? }`). Get: `GET /saves/:saveId`. List: `GET /saves`. Update: `PATCH /saves/:saveId` (body: `title`, `userNotes`, `contentType`, `tags` only — URL immutable). Delete: `DELETE /saves/:saveId`. Restore: `POST /saves/:saveId/restore` (no body).

### Project Structure Notes

- Smoke test lives under `scripts/smoke-test/`. Do not add smoke logic to `backend/` or `frontend/`.
- New scenario files: `scripts/smoke-test/scenarios/saves-crud.ts`, `scripts/smoke-test/scenarios/saves-validation.ts`.
- Phase registry (after 3.1.5): `scripts/smoke-test/phases.ts` or equivalent; register Phase 2 and Phase 4 scenario arrays.
- `scripts/smoke-test/scenarios/index.ts` currently exports a flat `scenarios` list; 3.1.5 refactors to phase-grouped execution — this story adds scenario definitions and registers them in the phase registry.

### References

- [Source: docs/progress/epic-3-1-stories-and-plan.md] — Story 3.1.6 acceptance criteria, tasks, phase mapping (Phase 2 `saves-crud`, Phase 4 `saves-validation`).
- [Source: scripts/smoke-test/helpers.ts] — `assertADR008`, `assertUserProfileShape`, `assertStatus`; add `assertSaveShape` here.
- [Source: scripts/smoke-test/scenarios/jwt-auth.ts] — Pattern for JWT auth and scenario definition shape.
- [Source: scripts/smoke-test/scenarios/user-profile.ts] — Example of `assertADR008(res.body, "VALIDATION_ERROR")` and client usage.
- [Source: backend/functions/saves/handler.ts] — Create save request/response; uses `createSaveSchema`, `toPublicSave`; 201 with `data` save object.
- [Source: backend/functions/saves-list/handler.ts] — List response shape: `{ data: { items, hasMore, nextToken?, truncated? } }` (no `count` field).
- [Source: .claude/docs/api-patterns.md] — REST conventions and ADR-008 if needed.

## Dev Agent Record

### Agent Model Used

Claude Opus 4 (claude-sonnet-4-20250514)

### Debug Log References

None

### Completion Notes List

- Story 3.1.5 was scope-limited to orchestrator docs; created smoke test phase infrastructure (phases.ts, --phase/--up-to flags) as part of this story
- Chose option (2) from Task 2.0: 8 separate scenarios with module-level shared state + initSavesCrudCleanup callback
- SV4 creates its own temp save and cleans up in finally block (works standalone with --phase=4)
- Phase 1 scenarios unchanged; backward-compat flat export preserved in index.ts

### File List

- `scripts/smoke-test/helpers.ts` — added assertSaveShape
- `scripts/smoke-test/phases.ts` — new: phase registry with --phase and --up-to support
- `scripts/smoke-test/run.ts` — refactored to use phase-based execution
- `scripts/smoke-test/scenarios/saves-crud.ts` — new: SC1–SC8 lifecycle scenarios
- `scripts/smoke-test/scenarios/saves-validation.ts` — new: SV1–SV4 validation error scenarios
- `scripts/smoke-test/scenarios/index.ts` — updated: re-exports saves scenarios, preserves flat array
