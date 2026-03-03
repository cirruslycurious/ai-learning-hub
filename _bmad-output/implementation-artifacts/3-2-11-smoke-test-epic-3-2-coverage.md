---
id: "3.2.11"
title: "Smoke Test Retrofit & Coverage for Epic 3.2"
status: ready-for-dev
depends_on:
  - "3.2.7"
  - "3.2.8"
  - "3.2.9"
  - "3.2.10"
touches:
  - scripts/smoke-test/scenarios/saves-crud.ts
  - scripts/smoke-test/scenarios/saves-validation.ts
  - scripts/smoke-test/scenarios/api-key-auth.ts
  - scripts/smoke-test/scenarios/user-profile.ts
  - scripts/smoke-test/scenarios/eventbridge-verify.ts
  - scripts/smoke-test/scenarios/ops-endpoints.ts
  - scripts/smoke-test/scenarios/discovery-endpoints.ts
  - scripts/smoke-test/scenarios/command-endpoints.ts
  - scripts/smoke-test/scenarios/batch-operations.ts
  - scripts/smoke-test/scenarios/agent-native-behaviors.ts
  - scripts/smoke-test/scenarios/index.ts
  - scripts/smoke-test/phases.ts
  - scripts/smoke-test/helpers.ts
risk: medium
---

# Story 3.2.11: Smoke Test Retrofit & Coverage for Epic 3.2

Status: ready-for-dev

## Story

As a **developer deploying the API after Epic 3.2**,
I want **every smoke test scenario to reflect the current API surface — including mandatory idempotency headers, optimistic concurrency, cursor pagination, scope enforcement, new endpoints, and agent-native behaviors**,
so that **I can deploy confidently knowing the full suite passes and the deployed code matches what we designed**.

## Context

Epic 3.2 introduced middleware changes that affect **every mutation endpoint** in the existing smoke tests:

| Middleware change | Effect | Failure if missing |
|---|---|---|
| `idempotent: true` on all mutations | `Idempotency-Key` header mandatory | 400 VALIDATION_ERROR |
| `requireVersion: true` on PATCH /saves/:saveId, PATCH /users/me, POST /users/me/update, POST /saves/:saveId/update-metadata | `If-Match` header mandatory | 428 PRECONDITION_REQUIRED |
| `requiredScope` on all handlers | API keys without matching scope get rejected | 403 SCOPE_INSUFFICIENT |
| GET /saves list → cursor pagination | Response shape changed from `{ data: { items, hasMore } }` to `{ data: [...], meta: { cursor, total }, links: { self, next } }` | Assertion failures |

Additionally, 9 new routes were added that have zero smoke test coverage.

## Acceptance Criteria

### Part A: Retrofit Existing Scenarios

#### Saves CRUD (Phase 2: SC1–SC8)

1. **AC1: SC1 sends Idempotency-Key on create** — `POST /saves` includes `Idempotency-Key: <uuid>` header. Stores `data.version` from the 201 response for use by subsequent scenarios (avoids extra GET). Cleanup callback also sends `Idempotency-Key`.

2. **AC2: SC3 uses cursor pagination shape** — `GET /saves` asserts `data` is a top-level array (not `data.items`). Validates `meta.cursor` is present (string or null) and `links.self` is present. Removes `data.hasMore` assertion. Still verifies created save appears in the array.

3. **AC3: SC4 sends Idempotency-Key and If-Match on update** — `PATCH /saves/:saveId` uses the stored version from SC1 (or SC2 if SC1 doesn't store it) to send `If-Match: <version>` and includes `Idempotency-Key: <uuid>`. Asserts 200, title updated. Stores the new `data.version` for SC5+.

4. **AC4: SC5 sends Idempotency-Key on delete** — `DELETE /saves/:saveId` includes `Idempotency-Key: <uuid>`. Asserts 204.

5. **AC5: SC7 sends Idempotency-Key on restore** — `POST /saves/:saveId/restore` includes `Idempotency-Key: <uuid>`. Asserts 200, no deletedAt.

#### Saves Validation (Phase 4: SV1–SV4)

6. **AC6: SV4 sends all required headers before testing validation** — SV4 setup creates a save (with `Idempotency-Key`), stores `data.version`, then sends bad PATCH with `If-Match: <version>` and `Idempotency-Key: <uuid>` alongside the immutable `url` field. Asserts 400 VALIDATION_ERROR (confirming body validation runs after middleware). Cleanup delete sends `Idempotency-Key`.

#### API Key Auth (Phase 1: AC5–AC8, AC13)

7. **AC7: createKey helper sends Idempotency-Key** — The shared `createKey()` helper includes `Idempotency-Key: <uuid>` on each `POST /users/api-keys` attempt (fresh key per retry).

8. **AC8: deleteKey helper sends Idempotency-Key** — The shared `deleteKey()` helper includes `Idempotency-Key: <uuid>` on `DELETE /users/api-keys/:id`.

9. **AC9: AC6 scope test asserts 403 SCOPE_INSUFFICIENT** — AC6 creates an API key with `saves:write` scope, attempts `PATCH /users/me` (which requires `users:write`), and asserts **403 SCOPE_INSUFFICIENT** (not 200). Validates error body contains `required_scope === "users:write"` and `granted_scopes` array. This replaces the previous AC6 behavior which expected 200 because scope enforcement was not yet active.

#### User Profile (Phase 1: AC11–AC12)

10. **AC10: AC11 sends If-Match and Idempotency-Key on profile update** — `PATCH /users/me` first fetches profile to get `data.version`, sends `If-Match: <version>` and `Idempotency-Key: <uuid>`. The restore step in `finally` re-fetches version before restoring with fresh `If-Match` and `Idempotency-Key`.

11. **AC11: AC12 sends required headers before testing validation** — Invalid `PATCH /users/me` fetches profile to get `data.version`, sends `If-Match: <version>` and `Idempotency-Key: <uuid>` alongside the invalid body field. Asserts 400 VALIDATION_ERROR (not 428).

#### EventBridge (Phase 7: EB1–EB3)

12. **AC12: EB scenarios send Idempotency-Key on mutations** — EB1 (POST /saves create) and EB3 (DELETE /saves) include `Idempotency-Key` headers. EB2 (GET) is unaffected. EB3 cleanup delete also sends `Idempotency-Key`.

### Part B: New Endpoint Scenarios

#### Ops Endpoints (Phase 1 — unauthenticated)

13. **AC13: Health endpoint** — Scenario `OP1` sends `GET /health` with `auth: { type: "none" }`. Asserts 200, `data.status === "healthy"`, `data.timestamp` present, `data.version` present. Validates `links.self === "/health"`. Uses `assertResponseEnvelope()`.

14. **AC14: Readiness endpoint** — Scenario `OP2` sends `GET /ready` with `auth: { type: "none" }`. Asserts 200, `data.ready === true`, `data.dependencies.dynamodb === "ok"`, `data.timestamp` present. Validates `links.self === "/ready"`. Uses `assertResponseEnvelope()`.

#### Discovery Endpoints (Phase 1 — authenticated)

15. **AC15: Actions catalog** — Scenario `DS1` sends `GET /actions` with JWT auth. Asserts 200, `data` is a non-empty array, each action has `actionId`, `method`, `urlPattern`, `description`. Validates at least one action with `actionId` starting with `"saves:"` and at least one starting with `"batch:"` exist.

16. **AC16: Actions catalog entity filter** — `DS1` additionally sends `GET /actions?entity=saves` and verifies all returned actions have `entityType === "saves"`.

17. **AC17: State graph** — Scenario `DS2` sends `GET /states/saves` with JWT auth. Asserts 200, response contains state graph data. Validates `links.self` present.

#### Command Endpoints (Phase 2 — after saves CRUD)

18. **AC18: Update-metadata command** — Scenario `CM1` creates its own save (with `Idempotency-Key`), then sends `POST /saves/{saveId}/update-metadata` with `{ title: "Updated via command" }`, `Idempotency-Key`, and `If-Match: <version>` (handler has `requireVersion: true`). Asserts 200. Cleans up save in `finally` (with `Idempotency-Key` on delete).

19. **AC19: Event history** — Scenario `CM2` sends `GET /saves/{saveId}/events` for the save created/modified by CM1. Asserts 200, `data` is an array containing at least one event with `eventType` present.

20. **AC20: User profile update command** — Scenario `CM3` sends `POST /users/me/update` with `{ displayName: "Smoke Test User" }`, `Idempotency-Key`, `If-Match: <version>` (fetched via GET /users/me), and JWT auth. Asserts 200, response contains updated profile. Restores original displayName in `finally` (re-fetching version, sending both headers).

21. **AC21: API key revoke command** — Scenario `CM4` creates a temporary API key (with `Idempotency-Key`), then sends `POST /users/api-keys/{id}/revoke` with `Idempotency-Key`. Asserts 200. Verifies the revoked key returns 401 when used for `GET /users/me`. Cleanup is implicit (key is revoked).

#### Batch Operations (Phase 3 — new phase)

22. **AC22: Batch basic execution** — Scenario `BA1` sends `POST /batch` with JWT auth, `Idempotency-Key` (the batch handler itself has `idempotent: true`), and 2 operations: a `GET /actions` and a `GET /users/me`. Asserts 200, `data.results` has 2 entries, `data.summary.total === 2`, `data.summary.succeeded === 2`. (Uses only GETs to avoid complex per-operation cleanup.)

23. **AC23: Batch partial failure** — Scenario `BA2` sends `POST /batch` with `Idempotency-Key` and 2 operations: one valid `GET /actions` and one `GET /saves/00000000000000000000000000` (should 404). Asserts 200, `data.summary.succeeded === 1`, `data.summary.failed === 1`. Validates per-operation `statusCode` in results.

24. **AC24: Batch requires authentication** — Scenario `BA3` sends `POST /batch` with `auth: { type: "none" }` and no `Idempotency-Key`. Asserts 401 or 403.

### Part C: Agent-Native Behavior Validation

#### Response Envelope (Phase 1)

25. **AC25: Response envelope on authenticated endpoints** — Scenario `AN1` sends `GET /users/me` with JWT auth. Verifies response contains `data` (object), `links` (object with `self`), and optionally `meta`. Uses `assertResponseEnvelope()`.

#### Idempotency (Phase 2)

26. **AC26: Idempotency replay** — Scenario `AN2` generates a UUID, sends `POST /saves` twice with that same `Idempotency-Key` and identical body. Asserts both responses return 201 with the same `data.saveId`. Asserts second response has `X-Idempotent-Replayed: true` header. Cleans up save (with `Idempotency-Key` on delete).

#### Optimistic Concurrency (Phase 2)

27. **AC27: If-Match conflict → 409** — Scenario `AN3` creates a save (with `Idempotency-Key`), obtains `data.version`, sends `PATCH /saves/:saveId` with `If-Match: 999` (stale version), `Idempotency-Key`, and `{ title: "Should Fail" }`. Asserts 409 `VERSION_CONFLICT`. Validates error body contains `currentVersion` (number). Cleans up save (with `Idempotency-Key` on delete).

28. **AC28: Missing If-Match → 428** — Scenario `AN4` creates a save (with `Idempotency-Key`), sends `PATCH /saves/:saveId` with `Idempotency-Key` but **no** `If-Match` header and `{ title: "Should Fail" }`. Asserts 428 `PRECONDITION_REQUIRED`. Cleans up save.

#### Scope Enforcement (Phase 1)

29. **AC29: Insufficient scope → 403** — Scenario `AN5` creates an API key with `["saves:read"]` scope (via `createKey` with `Idempotency-Key`), attempts `POST /saves` (requires `saves:create`) with that key and `Idempotency-Key`. Asserts 403 `SCOPE_INSUFFICIENT`. Validates error body contains `required_scope` and `granted_scopes`. Cleans up API key (with `Idempotency-Key` on delete).

#### Rate Limiting (Phase 1)

30. **AC30: Rate limit headers present** — Scenario `AN6` sends `GET /users/me` with JWT auth. Asserts `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers are present.

#### Cursor Pagination (Phase 2)

31. **AC31: Cursor pagination mechanics** — Scenario `AN7` creates 2 saves (with `Idempotency-Key`), sends `GET /saves?limit=1`. Asserts `data` array has exactly 1 element, `meta.cursor` is a non-null string, `links.next` is a non-null string containing `cursor=`. Follows `links.next` and asserts `data` is non-empty. Cleans up both saves (with `Idempotency-Key` on delete).

#### X-Agent-ID Header (Phase 1)

32. **AC32: X-Agent-ID accepted** — Scenario `AN8` sends `GET /users/me` with JWT auth and `X-Agent-ID: smoke-test-agent` header. Asserts 200. (Header acceptance is verified; recording is an EventBridge concern.)

### Part D: Infrastructure

33. **AC33: Shared createSave helper with retry-on-429** — `helpers.ts` adds `createSave(auth, opts?)` that handles `Idempotency-Key`, retry-on-429 (matching `createKey` pattern), and returns `{ saveId, version, url }`. Used by AN2, AN3, AN4, AN5, AN7, CM1, and SV4 setup.

34. **AC34: Shared deleteSave helper** — `helpers.ts` adds `deleteSave(saveId, auth)` that sends `Idempotency-Key` and handles 404 gracefully (already deleted). Used by all cleanup callbacks.

35. **AC35: Assertion helpers** — `helpers.ts` adds:
    - `assertResponseEnvelope(body)` — validates `data` exists, `links.self` exists
    - `assertCursorPagination(body)` — validates `data` is array, `meta.cursor` present, `links.self` present
    - `idempotencyKey()` — returns `{ "Idempotency-Key": crypto.randomUUID() }`

36. **AC36: Phase registry updated** — `phases.ts` adds:
    - Phase 1: ops (OP1–OP2), discovery (DS1–DS2), agent-native cross-cutting (AN1, AN5, AN6, AN8)
    - Phase 2: command (CM1–CM4), agent-native saves-dependent (AN2, AN3, AN4, AN7)
    - Phase 3: batch (BA1–BA3) — claims reserved phase

37. **AC37: scenarios/index.ts re-exports** — All new scenario arrays re-exported.

38. **AC38: Self-cleaning** — All scenarios that create resources use try/finally or cleanup callbacks with `Idempotency-Key` on delete. Environment unchanged after full run.

39. **AC39: Full suite passes** — `npm run smoke-test` runs all phases — existing (retrofitted) + new — all pass.

## Tasks / Subtasks

### Task 1: Shared helpers and utilities

- [ ] 1.1 Add `idempotencyKey()` to `helpers.ts` — returns `{ "Idempotency-Key": crypto.randomUUID() }`
- [ ] 1.2 Add `createSave(auth, opts?)` to `helpers.ts` — POST /saves with Idempotency-Key, retry-on-429, returns `{ saveId, version, url }`
- [ ] 1.3 Add `deleteSave(saveId, auth)` to `helpers.ts` — DELETE with Idempotency-Key, 404-safe
- [ ] 1.4 Add `assertResponseEnvelope(body)` — validates `data` and `links.self`
- [ ] 1.5 Add `assertCursorPagination(body)` — validates `data` array, `meta.cursor`, `links.self`
- [ ] 1.6 Add `assertHealthShape(body)` — validates health response fields
- [ ] 1.7 Add `assertReadinessShape(body)` — validates readiness response fields

### Task 2: Retrofit saves-crud.ts (SC1–SC8)

- [ ] 2.1 SC1: Add Idempotency-Key header, store `data.version` in module state
- [ ] 2.2 SC1: Cleanup callback sends Idempotency-Key via `deleteSave` helper
- [ ] 2.3 SC3: Rewrite assertions for cursor pagination shape (`data[]`, `meta.cursor`, `links.self`)
- [ ] 2.4 SC4: Use stored version for `If-Match`, add `Idempotency-Key`, store new version
- [ ] 2.5 SC5: Add `Idempotency-Key` header
- [ ] 2.6 SC7: Add `Idempotency-Key` header

### Task 3: Retrofit saves-validation.ts (SV1–SV4)

- [ ] 3.1 SV4: Use `createSave` helper for setup (gets Idempotency-Key + version)
- [ ] 3.2 SV4: Send `If-Match` + `Idempotency-Key` on bad PATCH
- [ ] 3.3 SV4: Use `deleteSave` helper for cleanup

### Task 4: Retrofit api-key-auth.ts (AC5–AC8, AC13)

- [ ] 4.1 `createKey()`: Add Idempotency-Key to POST /users/api-keys (fresh per retry)
- [ ] 4.2 `deleteKey()`: Add Idempotency-Key to DELETE /users/api-keys/:id
- [ ] 4.3 AC6: Rewrite to assert 403 SCOPE_INSUFFICIENT with `required_scope` and `granted_scopes`

### Task 5: Retrofit user-profile.ts (AC11–AC12)

- [ ] 5.1 AC11: Fetch version before PATCH, send If-Match + Idempotency-Key
- [ ] 5.2 AC11: Restore step re-fetches version, sends both headers
- [ ] 5.3 AC12: Fetch version before invalid PATCH, send If-Match + Idempotency-Key

### Task 6: Retrofit eventbridge-verify.ts (EB1–EB3)

- [ ] 6.1 EB1: Add Idempotency-Key to POST /saves
- [ ] 6.2 EB3: Add Idempotency-Key to DELETE /saves
- [ ] 6.3 EB cleanup: Use `deleteSave` helper

### Task 7: New ops endpoint scenarios (OP1–OP2)

- [ ] 7.1 Create `scenarios/ops-endpoints.ts`
- [ ] 7.2 Implement OP1 — GET /health, no auth, assertResponseEnvelope (AC13)
- [ ] 7.3 Implement OP2 — GET /ready, no auth, assertResponseEnvelope (AC14)

### Task 8: New discovery endpoint scenarios (DS1–DS2)

- [ ] 8.1 Create `scenarios/discovery-endpoints.ts`
- [ ] 8.2 Implement DS1 — GET /actions, verify catalog + entity filter (AC15, AC16)
- [ ] 8.3 Implement DS2 — GET /states/saves (AC17)

### Task 9: New command endpoint scenarios (CM1–CM4)

- [ ] 9.1 Create `scenarios/command-endpoints.ts`
- [ ] 9.2 Implement CM1 — POST /saves/{id}/update-metadata, self-contained (AC18)
- [ ] 9.3 Implement CM2 — GET /saves/{id}/events, uses CM1's save (AC19)
- [ ] 9.4 Implement CM3 — POST /users/me/update (AC20)
- [ ] 9.5 Implement CM4 — POST /users/api-keys/{id}/revoke (AC21)

### Task 10: New batch operation scenarios (BA1–BA3)

- [ ] 10.1 Create `scenarios/batch-operations.ts`
- [ ] 10.2 Implement BA1 — batch with 2 GETs, outer Idempotency-Key (AC22)
- [ ] 10.3 Implement BA2 — partial failure (AC23)
- [ ] 10.4 Implement BA3 — unauthenticated rejection (AC24)

### Task 11: New agent-native behavior scenarios (AN1–AN8)

- [ ] 11.1 Create `scenarios/agent-native-behaviors.ts`
- [ ] 11.2 Implement AN1 — response envelope (AC25)
- [ ] 11.3 Implement AN2 — idempotency replay with X-Idempotent-Replayed (AC26)
- [ ] 11.4 Implement AN3 — If-Match conflict → 409 VERSION_CONFLICT (AC27)
- [ ] 11.5 Implement AN4 — missing If-Match → 428 PRECONDITION_REQUIRED (AC28)
- [ ] 11.6 Implement AN5 — insufficient scope → 403 SCOPE_INSUFFICIENT (AC29)
- [ ] 11.7 Implement AN6 — rate limit headers (AC30)
- [ ] 11.8 Implement AN7 — cursor pagination mechanics (AC31)
- [ ] 11.9 Implement AN8 — X-Agent-ID passthrough (AC32)
- [ ] 11.10 Wire cleanup for AN2, AN3, AN4, AN5, AN7

### Task 12: Phase registry and index wiring

- [ ] 12.1 Update `scenarios/index.ts` — re-export all new scenario arrays
- [ ] 12.2 Update `phases.ts` — Phase 1 adds ops/discovery/AN1,AN5,AN6,AN8; Phase 2 adds command/AN2,AN3,AN4,AN7; Phase 3 claims batch
- [ ] 12.3 Verify `--phase=3` runs only batch scenarios

### Task 13: Manual deploy verification

- [ ] 13.1 Run `npm run smoke-test -- --phase=1` — verify OP1, OP2, DS1, DS2, AN1, AN5, AN6, AN8 pass alongside retrofitted AC5–AC13, AC11–AC12
- [ ] 13.2 Run `npm run smoke-test -- --phase=2` — verify retrofitted SC1–SC8, CM1–CM4, AN2, AN3, AN4, AN7 pass
- [ ] 13.3 Run `npm run smoke-test -- --phase=3` — verify BA1–BA3 pass
- [ ] 13.4 Run `npm run smoke-test -- --phase=4` — verify retrofitted SV1–SV4 pass
- [ ] 13.5 Run `npm run smoke-test` (full) — all scenarios pass end-to-end

## Dev Notes

### Architecture context

- Smoke tests run via `tsx` against the deployed API Gateway — no build step, no mocks
- All scenarios use `SmokeClient` from `client.ts` and assertion helpers from `helpers.ts`
- Route-registry-bridge loads ROUTE_REGISTRY from compiled `infra/dist/` — AC9/AC10 automatically cover all new routes for connectivity/CORS
- `crypto.randomUUID()` available in Node 19+ — sufficient for idempotency keys

### Breaking changes from Epic 3.2

| Middleware change | Affected existing scenarios | Fix |
|---|---|---|
| `idempotent: true` → Idempotency-Key mandatory (400) | SC1, SC4, SC5, SC7, SV4, AC5–AC8, AC13, AC11, EB1, EB3 | Add `Idempotency-Key: <uuid>` to all mutation requests |
| `requireVersion: true` → If-Match mandatory (428) | SC4, SV4, AC11, AC12 | Fetch version first, send `If-Match: <version>` |
| `requiredScope` enforced → 403 SCOPE_INSUFFICIENT | AC6 (saves:write key → PATCH /users/me requires users:write) | Rewrite AC6 to assert 403 + error body |
| List response → cursor pagination | SC3 | Assert `data[]` + `meta.cursor` + `links.self` |

### Endpoint inventory for new scenarios

| Endpoint | Method | Auth | Idempotent | RequireVersion | Phase |
|---|---|---|---|---|---|
| /health | GET | none | no | no | 1 |
| /ready | GET | none | no | no | 1 |
| /actions | GET | jwt | no | no | 1 |
| /states/saves | GET | jwt | no | no | 1 |
| /saves/{id}/update-metadata | POST | jwt-or-apikey | yes | yes | 2 |
| /saves/{id}/events | GET | jwt-or-apikey | no | no | 2 |
| /users/me/update | POST | jwt-or-apikey | yes | yes | 2 |
| /users/api-keys/{id}/revoke | POST | jwt-or-apikey | yes | no | 2 |
| /batch | POST | jwt | yes | no | 3 |

### Design decisions

- **CM1 is self-contained:** Creates its own save rather than coupling to SC1's module state. CM2 reuses CM1's save. Cleanup in `finally`.
- **BA1 uses only GETs in batch:** Avoids per-operation save creation/cleanup complexity. Validates batch mechanics without side effects.
- **AC6 now tests 403:** Scope enforcement is active post-3.2. The old 200 assertion was wrong — `saves:write` cannot access `users:write` endpoints. This is the correct deployed behavior.
- **AN4 (428) separate from AN3 (409):** Tests distinct failure modes — missing header vs stale version. Both are agent-native recovery scenarios.
- **AN5 scope test in Phase 1:** Uses API key auth (Phase 1 dependency only), doesn't need saves.
- **Shared helpers `createSave`/`deleteSave`:** Centralizes Idempotency-Key injection and retry-on-429 logic. All scenarios use these instead of raw client calls for mutations.
- **Version stored from create response:** `INITIAL_VERSION = 1`. Create response includes `data.version`. Avoids extra GET-before-PATCH round trips.

### Constraints

- All scenarios must respect `SMOKE_TEST_SKIP` and throw `ScenarioSkipped` if prerequisites fail
- All saves mutations need retry-on-429 (Epic 3.2 added `savesWriteRateLimit`)
- Full suite must complete in <60 seconds
- AC6 (scope test) generates a `saves:write` key and a `saves:read` key — both need cleanup

### References

- [Source: docs/smoke-test-architecture.md — full system design]
- [Source: scripts/smoke-test/phases.ts — phase registry]
- [Source: scripts/smoke-test/helpers.ts — assertion helpers]
- [Source: infra/config/route-registry.ts — all routes including Epic 3.2]
- [Source: backend/shared/middleware/src/idempotency.ts — Idempotency-Key extraction, X-Idempotent-Replayed header]
- [Source: backend/shared/middleware/src/concurrency.ts — If-Match extraction, 428 PRECONDITION_REQUIRED]
- [Source: backend/shared/middleware/src/auth.ts — requireScope, 403 SCOPE_INSUFFICIENT]
- [Source: backend/shared/db/src/version-helpers.ts — VersionConflictError, 409 VERSION_CONFLICT]
- [Source: backend/shared/types/src/entities.ts — INITIAL_VERSION = 1]
