---
id: "3.5.3"
title: "Security & Observability Hardening"
status: ready-for-dev
depends_on: ["3.5.2"]
touches:
  - backend/shared/middleware/src/wrapper.ts
  - backend/shared/types/src/api.ts
  - backend/shared/middleware/test/rate-limit-integration.test.ts
  - backend/functions/validate-invite/handler.ts
  - backend/functions/api-keys/handler.ts
  - infra/lib/stacks/api/discovery-routes.stack.ts
creates:
  - backend/test/pk-enforcement.test.ts
  - infra/test/stacks/api/discovery-routes.stack.test.ts
risk: medium
---

# Story 3.5.3: Security & Observability Hardening

## Story

As a **developer and operator of ai-learning-hub**,
I want **automated PK construction enforcement, IP-based secondary rate limits on sensitive public endpoints, fail-open observability for rate limiting, and CDK test coverage for the discovery routes stack**,
so that **security regressions are caught by CI before they ship, brute-force abuse of invite validation and API key creation is throttled per IP, operators can see when rate limiting is degraded, and all CDK stacks have test coverage**.

## Acceptance Criteria

1. **AC1: PK construction architecture test** — `backend/test/pk-enforcement.test.ts` scans all handler files under `backend/functions/` for any string containing `USER#`. For every match, the test asserts that the `USER#` prefix is constructed using a value sourced from the `auth` context (e.g., `auth.userId`, `auth!.userId`, `ctx.auth`) and NOT from user-supplied input (request body, path parameters, query parameters). The test fails if a handler constructs `USER#${body.userId}` or similar user-controlled input. This prevents IDOR regressions where an attacker could read/write another user's data by forging the PK.

2. **AC2: PK enforcement negative test** — The PK enforcement test includes a negative case: it creates a temporary synthetic file containing `USER#${body.userId}`, runs the scanner against it, and asserts the scanner flags it as a violation. After the assertion, the temp file is cleaned up. This proves the scanner actually catches the pattern it claims to detect.

3. **AC3: validate-invite secondary IP rate limit** — `backend/functions/validate-invite/handler.ts` handler export adds `secondaryRateLimit` to its `wrapHandler` options with `identifierSource: "sourceIp"`, `operation: "invite-validate-ip"`, `windowSeconds: 3600`, and `limit: 20`. This throttles brute-force invite code guessing from a single IP to 20 attempts per hour, independent of the per-user rate limit.

4. **AC4: api-keys createHandler secondary IP rate limit** — `backend/functions/api-keys/handler.ts` `createHandler` export adds `secondaryRateLimit` to its `wrapHandler` options with `identifierSource: "sourceIp"`, `operation: "api-key-create-ip"`, `windowSeconds: 3600`, and `limit: 10`. This throttles API key creation from a single IP to 10 per hour.

5. **AC5: Secondary IP rate limit unit tests** — Unit tests verify the `secondaryRateLimit` wiring for both `validate-invite` and `api-keys` `createHandler`. Tests confirm: (a) secondary rate limit is checked after primary passes; (b) secondary 429 is returned when secondary limit is exceeded even if primary allows; (c) both primary and secondary must pass for the request to proceed.

6. **AC6: Rate limit fail-open status tracking** — `wrapper.ts` adds a `RateLimitStatus` mutable object (mirroring the existing `IdempotencyStatus` pattern) initialized as `{ available: true }`. When rate limiting fails open (DynamoDB unreachable or dynamic limit function throws), `available` is set to `false`. This status is checked after the rate limit middleware block completes.

7. **AC7: X-RateLimit-Status header on fail-open** — When `RateLimitStatus.available` is `false`, the wrapper adds `X-RateLimit-Status: unavailable` to the response headers on both success and error paths (matching the `X-Idempotency-Status: unavailable` pattern). This header is NOT added when rate limiting succeeds normally or when no rate limit is configured.

8. **AC8: Fail-open header integration tests** — `backend/shared/middleware/test/rate-limit-integration.test.ts` adds assertions for the `X-RateLimit-Status: unavailable` header: (a) present when `incrementAndCheckRateLimit` throws (DynamoDB unreachable); (b) present when dynamic limit function throws; (c) NOT present when rate limiting succeeds normally; (d) NOT present when no rate limit is configured.

9. **AC9: Discovery routes CDK test** — `infra/test/stacks/api/discovery-routes.stack.test.ts` is created following the `ops-routes.stack.test.ts` pattern. It asserts: (a) Lambda function count is 2 (actions-catalog, state-graph); (b) both functions have `Tracing: Active` (X-Ray); (c) both functions have the required environment variables (`USERS_TABLE_NAME`, `INVITE_CODES_TABLE_NAME`, `SAVES_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`, `EVENTS_TABLE_NAME`); (d) API Gateway routes exist for `GET /actions` and `GET /states/{entityType}` with custom authorization.

10. **AC10: All quality gates pass** — `npm test` passes with no regressions and coverage remains >= 80%. `npm run lint` passes. `npm run type-check` passes. `cd infra && npm run build && npx cdk synth` succeeds with no new CDK Nag errors.

## Tasks / Subtasks

- [ ] Task 1: PK construction enforcement test (AC: #1, #2)
  - [ ] 1.1 Create `backend/test/pk-enforcement.test.ts`. Use `glob` (or `fs.readdirSync` recursive) to find all `*.ts` files under `backend/functions/`. For each file, read the source and find all lines containing the string `USER#`. For each match, assert the PK is constructed from an auth-derived identifier (`auth.userId`, `auth!.userId`, `ctx.auth`, `userId` where `userId` is destructured from `auth` or `ctx.auth`) and NOT from request body, path params, or query params.
  - [ ] 1.2 Define violation patterns to flag: `USER#${body.`, `USER#${event.body`, `USER#${pathParameters.`, `USER#${event.pathParameters`, `USER#${queryStringParameters.`, `USER#${event.queryStringParameters`, `USER#${req.body`, or any other user-controlled input source. The scanner should use regex matching to detect these patterns.
  - [ ] 1.3 Add a negative test case: use `fs.mkdtempSync` / `fs.writeFileSync` to create a temporary `.ts` file containing `const pk = \`USER#\${body.userId}\`;`. Run the same scanning logic against this file and assert it returns at least one violation. Clean up the temp file in an `afterAll` or `finally` block.
  - [ ] 1.4 Run `npm test -- backend/test/pk-enforcement.test.ts` to confirm both positive (no violations in real handlers) and negative (synthetic violation detected) pass.

- [ ] Task 2: Add `secondaryRateLimit` support to wrapper and types (AC: #3, #4, #5 foundation)
  - [ ] 2.1 In `backend/shared/types/src/api.ts`, add `secondaryRateLimit?: RateLimitMiddlewareConfig` to the `WrapperOptions` interface. This is a separate field from the existing `rateLimit` — wrapper checks primary (userId) then secondary (sourceIp) sequentially.
  - [ ] 2.2 In `backend/shared/middleware/src/wrapper.ts`, after the existing `options.rateLimit` block (lines ~215–283), add a second block that checks `options.secondaryRateLimit` using identical logic: resolve limit, resolve identifier (sourceIp for secondary), call `incrementAndCheckRateLimit`, return 429 if exceeded. Both must pass; either can reject. The secondary block runs only if the primary block did not reject.
  - [ ] 2.3 **Important:** The `WrapperOptions` interface is defined in `wrapper.ts` (lines 83–91), NOT in `api.ts`. The `api.ts` file defines `RateLimitMiddlewareConfig` which is the config type. Add `secondaryRateLimit?: RateLimitMiddlewareConfig` to the `WrapperOptions` interface in `wrapper.ts`, importing the type from `./rate-limit-headers.js` where it's already imported.

- [ ] Task 3: Wire IP rate limits to validate-invite and api-keys (AC: #3, #4, #5)
  - [ ] 3.1 In `backend/functions/validate-invite/handler.ts`, update the `wrapHandler` call on the `handler` export (line ~165) to add `secondaryRateLimit: { operation: "invite-validate-ip", windowSeconds: 3600, limit: 20, identifierSource: "sourceIp" }`.
  - [ ] 3.2 In `backend/functions/api-keys/handler.ts`, update the `createHandler` export's `wrapHandler` call (line ~169) to add `secondaryRateLimit: { operation: "api-key-create-ip", windowSeconds: 3600, limit: 10, identifierSource: "sourceIp" }`.
  - [ ] 3.3 Add unit tests in `backend/shared/middleware/test/rate-limit-integration.test.ts` (new `describe` block for secondary rate limits): (a) test that secondary rate limit is checked when primary passes; (b) test that secondary 429 is returned independently of primary; (c) test both must pass for request to succeed.

- [ ] Task 4: Rate limit fail-open observability (AC: #6, #7, #8)
  - [ ] 4.1 In `wrapper.ts`, define `RateLimitStatus` interface (matching `IdempotencyStatus` pattern): `interface RateLimitStatus { available: boolean; }`. Initialize `const rateLimitStatus: RateLimitStatus = { available: true };` alongside the existing `idempotencyStatus` declaration (~line 177).
  - [ ] 4.2 In the rate limit `catch` block (line ~280 — "Fail-open: rate limiting is best-effort"), add `rateLimitStatus.available = false;` before the existing `logger.warn` call. Also set `rateLimitStatus.available = false;` in the `skipRateLimit = true` path (dynamic limit function threw, line ~228).
  - [ ] 4.3 Do the same for the `secondaryRateLimit` block — set `rateLimitStatus.available = false` on its fail-open paths.
  - [ ] 4.4 After the existing idempotency status header block (~line 393–401), add an analogous block: if `options.rateLimit` or `options.secondaryRateLimit` is configured AND `!rateLimitStatus.available`, add `X-RateLimit-Status: unavailable` header to `finalResult`.
  - [ ] 4.5 In the `catch` block (~line 414–437), add the same `X-RateLimit-Status: unavailable` header to `errorResponse` when applicable (mirroring the idempotency status pattern in the catch block).
  - [ ] 4.6 Add integration tests in `rate-limit-integration.test.ts`: (a) assert `X-RateLimit-Status: unavailable` header present when `incrementAndCheckRateLimit` throws; (b) assert header present when dynamic limit function throws; (c) assert header NOT present on successful rate limit check; (d) assert header NOT present when no rate limit configured.

- [ ] Task 5: Discovery routes CDK test (AC: #9)
  - [ ] 5.1 Create `infra/test/stacks/api/discovery-routes.stack.test.ts` following the `ops-routes.stack.test.ts` pattern: create `App`, mock tables, mock REST API with `RequestAuthorizer`, instantiate `DiscoveryRoutesStack`.
  - [ ] 5.2 Assert Lambda function count is 2.
  - [ ] 5.3 Assert both functions have `TracingConfig.Mode: Active` (X-Ray tracing enabled).
  - [ ] 5.4 Assert environment variables: `USERS_TABLE_NAME`, `INVITE_CODES_TABLE_NAME`, `SAVES_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`, `EVENTS_TABLE_NAME` present on both functions.
  - [ ] 5.5 Assert API Gateway routes: `GET` method on `/actions` resource and `GET` method on `/states/{entityType}` resource, both with custom authorization type.
  - [ ] 5.6 Run `cd infra && npm test -- test/stacks/api/discovery-routes.stack.test.ts` to confirm passing.

- [ ] Task 6: Quality gates (AC: #10)
  - [ ] 6.1 `npm run type-check` — no TypeScript errors in any touched file.
  - [ ] 6.2 `npm test` — all tests pass, no regressions.
  - [ ] 6.3 `npm run lint` — no lint errors.
  - [ ] 6.4 `cd infra && npm run build && npx cdk synth` — succeeds with no new CDK Nag errors.

## Dev Notes

- **Scope:** Four cross-cutting hardening items identified during codebase audit. No new API endpoints, no new features, no changes to the API contract from a consumer's perspective.
- **Greenfield rule:** No backward compatibility concerns — there are no consumers to break.

### Task 1: PK Enforcement Test Design

- The scanner is a static analysis test — it reads TypeScript source as text, not AST. Regex-based scanning is sufficient because the `USER#` pattern is distinctive and appears only in PK construction.
- **Safe patterns** (should NOT trigger violations): `USER#${userId}` where `userId` is from `auth`, `USER#${auth.userId}`, `USER#${auth!.userId}`, `PK: \`USER#\${userId}\`` where `userId` was destructured from `ctx.auth` earlier in the function.
- **Unsafe patterns** (MUST trigger violations): `USER#${body.userId}`, `USER#${event.body`, `USER#${pathParameters.userId}`, `USER#${req.body.id}`.
- The test should trace variable provenance: if `const userId = auth!.userId;` appears before `USER#${userId}`, that's safe. If `const userId = JSON.parse(event.body).userId;` appears before it, that's unsafe. A simpler approach: scan the file for `USER#` usages, then for each usage check if the interpolated variable name appears in a destructuring from `auth` or assignment from `auth` in the same function scope. If not traceable to auth, flag it.
- **Pragmatic approach:** Given the current codebase consistently uses `const userId = auth!.userId;` at the top of each handler, the scanner can check: (a) the file contains `const userId = auth!.userId` or equivalent, (b) all `USER#` interpolations use `userId` (not `body.X`, `pathParameters.X`, etc.). This catches the IDOR regression pattern without needing full AST analysis.

### Task 2–3: Secondary Rate Limit Design (Option A — confirmed by user)

- **`secondaryRateLimit` field on `WrapperOptions`:** A separate optional field, not an array. Wrapper checks primary (userId) then secondary (sourceIp) sequentially. Both must pass; either can reject with 429.
- The secondary block reuses the same `incrementAndCheckRateLimit` function and `addRateLimitHeaders` — no new DB operations or utilities needed.
- When secondary rejects, the 429 response uses the secondary rate limit's headers (its limit/remaining/reset), not the primary's.
- The `WrapperOptions` interface lives in `wrapper.ts` (not `api.ts`). `RateLimitMiddlewareConfig` is defined in `api.ts` and re-exported via `rate-limit-headers.ts`. The import is already in place.

### Task 4: Fail-Open Observability

- Mirrors the `IdempotencyStatus` pattern exactly: mutable status object, set to unavailable on fail-open, header added to response.
- The `X-RateLimit-Status: unavailable` header signals to operators and agents that the rate limit check was skipped. This is distinct from `X-RateLimit-*` headers (which are only present when rate limiting succeeds).
- Both primary and secondary fail-open paths should set `rateLimitStatus.available = false`.
- Export `RateLimitStatus` from the wrapper for test access if needed, or keep it internal and test via header assertions.

### Task 5: Discovery Routes CDK Test

- Follow `ops-routes.stack.test.ts` pattern exactly: standalone `RestApi`, mock `RequestAuthorizer`, mock tables, instantiate stack, assert via `Template`.
- The discovery stack has 2 functions (actions-catalog, state-graph), both with identical config (no IAM grants to tables — read-only from in-memory registry).
- No DynamoDB IAM assertions needed — these functions don't read/write tables. The table env vars are required only because `@ai-learning-hub/db` barrel import calls `requireEnv` at module load time.

### Files Touched (summary)

| File | Change |
|------|--------|
| `backend/shared/middleware/src/wrapper.ts` | `secondaryRateLimit` support + `RateLimitStatus` + `X-RateLimit-Status` header |
| `backend/shared/types/src/api.ts` | (read-only reference for `RateLimitMiddlewareConfig`) |
| `backend/shared/middleware/test/rate-limit-integration.test.ts` | Secondary rate limit tests + fail-open header assertions |
| `backend/functions/validate-invite/handler.ts` | Add `secondaryRateLimit` config |
| `backend/functions/api-keys/handler.ts` | Add `secondaryRateLimit` on `createHandler` |
| `infra/lib/stacks/api/discovery-routes.stack.ts` | (read-only reference for CDK test) |

### Files Created

| File | Purpose |
|------|---------|
| `backend/test/pk-enforcement.test.ts` | Architecture test scanning for IDOR-prone PK construction |
| `infra/test/stacks/api/discovery-routes.stack.test.ts` | CDK test for discovery routes stack |

### Verification

1. `npm test` — all tests pass
2. `npm run lint` — clean
3. `npm run type-check` — clean
4. `cd infra && npm run build && npx cdk synth` — no CDK Nag errors

### References

- [Source: cross-cutting audit Finding I-5] — PK construction uses auth context but no automated enforcement against regression
- [Source: cross-cutting audit Finding NFR-S9] — IP-based secondary rate limits missing on brute-forceable endpoints (validate-invite, api-key create)
- [Source: cross-cutting audit — rate limit fail-open] — Rate limiting fails open silently; no observability header analogous to `X-Idempotency-Status: unavailable`
- [Source: cross-cutting audit Finding I-7] — DiscoveryRoutesStack has no CDK test coverage (ops-routes, saves-routes, auth all have tests)
- [Source: backend/shared/middleware/src/idempotency.ts] — `IdempotencyStatus` pattern to mirror for `RateLimitStatus`
- [Source: backend/shared/middleware/src/wrapper.ts#lines 176–177, 393–401, 419–423] — Existing `IdempotencyStatus` usage pattern
- [Source: infra/test/stacks/api/ops-routes.stack.test.ts] — Test pattern to follow for discovery routes CDK test

### Deferred Findings (not in scope for this story)

- None — all four findings are fully addressed by this story's 10 ACs.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
