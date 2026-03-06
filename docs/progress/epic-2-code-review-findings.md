# Epic 2: User Authentication & API Keys — Code Review Findings

**Scope:** All code and configuration delivered under Epic 2 (user auth, API keys, invite codes) and the shared infrastructure it depends on: `@ai-learning-hub/*` shared packages, `AuthStack`, `AuthRoutesStack`, `TablesStack`, `.github/workflows/ci.yml`, and any code added or touched that depends on these deliverables.

---

## Executive summary

This document contains three distinct categories of work. They require different types of fixes and have different urgency.

### Category A — Production bugs (must fix before go-live)

These are behavioral gaps that would affect real users on first deploy. None are surfaced by the current unit test or smoke test suite because they are either deployment-wiring problems or fail-open behaviors that produce no visible error signal.

| Finding | Problem                                                                          | Production consequence                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1.1** | Named handler exports dead; combined handlers lack idempotency and rate limiting | API key creation and invite generation have no rate limiting and no idempotency in production                                                                |
| **2.1** | Combined handlers apply mutation scope to all HTTP methods                       | API keys with `keys:read` or `invites:read` scope cannot call GET on those endpoints                                                                         |
| **6.1** | 4 Lambda IAM policies missing `PutItem` on events table                          | Every auth domain mutation (profile update, key create/revoke, invite generate/redeem) silently records nothing — event history permanently empty from day 1 |
| **6.2** | `validateInviteFunction` missing idempotency table IAM                           | Invite validation never stores or replays idempotency records — every retry re-executes the full handler                                                     |

### Category B — Test infrastructure gaps (fix to prevent recurrence)

These are structural gaps in the test suite that allowed the Category A bugs to pass undetected through unit tests, CDK template tests, and the smoke test. Fixing the Category A bugs without fixing these means the same class of bugs can re-enter undetected.

| Finding       | Gap                                                                                                                        | Fix required                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **7.1**       | No smoke test verifies events table writes for any Epic 2 mutation                                                         | Add post-mutation DynamoDB audit phase to smoke test (EB1–EB3 pattern)                                                                   |
| **7.2**       | No smoke test verifies idempotency replay for `validate-invite`                                                            | Add AN2-style replay scenario for `POST /auth/validate-invite`                                                                           |
| **7.3 / 6.3** | AC14 targets an unrate-limited endpoint; idempotency keys sent on api-keys mutations but replay never verified             | Retarget AC14; add replay assertion for `POST /users/api-keys`                                                                           |
| _(T1–T7)_     | CDK template tests check IAM shape but not completeness; no test verifies the CDK-wired export carries required middleware | Add assertions: each Lambda's IAM covers every table it writes to; wired export name matches the export with required middleware options |

### Category C — Code quality (schedule as maintenance)

These are clarity, consistency, and deduplication improvements. None affect correctness in production today, but several create maintenance risk over time (particularly 5.2 — the false comment describing a code path that would cause a production outage if acted on).

Findings: 1.2, 1.3, 2.2, 2.3, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3, 6.3 (smoke test AC14 retarget), 6.4.

---

### Why the test suite missed Category A

Unit tests mock AWS — IAM never executes. Fail-open error handling (in `recordEvent()`, idempotency, and rate limiting) means infrastructure failures produce 200 responses, not test failures. Unit tests call named exports directly, not the export string that CDK configures. CDK template tests (T1–T7) verify structure but not behavioral cross-cutting — they don't check whether the wired export carries the same middleware as what was unit-tested, and they don't verify IAM grant completeness per table. The smoke test validates the HTTP contract but has no side-effect audit layer for fail-open behaviors. All five structural gaps working together meant none of the Category A bugs produced any failing test at any layer.

---

## 1. Dead or redundant code

### 1.1 Named method-specific handler exports are unused in production — and their middleware is therefore also inactive

**Location:**

- `backend/functions/api-keys/handler.ts` (lines 179–201): `createHandler`, `listHandler`, `revokeHandler`
- `backend/functions/invite-codes/handler.ts` (lines 103–116): `generateHandler`, `listHandler`
- `backend/functions/users-me/handler.ts` (lines 200–215): `readHandler`, `writeHandler`

**What's wrong:** CDK's `AuthStack` wires every Lambda with `handler: "handler"`, meaning the production entry point is always the combined `handler` export in each file. The named per-method handler exports are dead code — they are never called in any deployed path. This is confirmed in `infra/lib/stacks/auth/auth.stack.ts` (lines 52, 160, 268, 356, 465, 549) and in `infra/lib/stacks/api/auth-routes.stack.ts`, which routes all `/users/api-keys` and `/users/invite-codes` methods via `LambdaIntegration(apiKeysFunction)` / `LambdaIntegration(generateInviteFunction)` — never referencing any named export.

**Critical consequence — idempotency and rate limiting are not active in production:** The combined `handler` exports carry only `{ requireAuth: true, requiredScope: ... }`. The named exports are the only ones that carry `idempotent: true` and `rateLimit: ...`:

| Named export (dead) | Middleware it carries                                    | Combined `handler` (live) | Middleware it carries |
| ------------------- | -------------------------------------------------------- | ------------------------- | --------------------- |
| `createHandler`     | `idempotent: true`, `rateLimit: apiKeyCreateRateLimit`   | `handler` (api-keys)      | neither               |
| `revokeHandler`     | `idempotent: true`                                       | same                      | neither               |
| `generateHandler`   | `idempotent: true`, `rateLimit: inviteGenerateRateLimit` | `handler` (invite-codes)  | neither               |

In production today: API key creation is not rate-limited and not idempotent. Invite code generation is not rate-limited and not idempotent. The `users-me` combined handler is unaffected — it applies rate limiting and idempotency imperatively inside the route function.

**Suggested change:** Choose one of two directions and be consistent across all three files:

- **Option A (remove named handlers, fix combined handler):** Delete the named exports. In `apiKeysHandler` and `inviteCodesHandler`, apply idempotency and rate limiting imperatively per method branch (using the same pattern `usersMeHandler` already uses for scope), then add `idempotent: true` to the combined `wrapHandler` call. See Finding 2.1 for the scope fix that must happen at the same time.
- **Option B (use named handlers from CDK):** Wire CDK to use the named exports directly — e.g., separate `NodejsFunction` instances or `handler: "createHandler"` per route in `auth-routes.stack.ts`. Remove or reduce the combined `handler` export. This preserves the tighter per-method middleware options and aligns with the pattern in `SavesRoutesStack`.

**Priority:** Critical.

---

### 1.2 JWT validation logic duplicated in the API key authorizer

**Location:**

- `backend/functions/jwt-authorizer/handler.ts` (lines 28–95): the entire handler.
- `backend/functions/api-key-authorizer/handler.ts` (lines 143–216): the JWT fallback path.

**What's wrong:** The JWT fallback in the API key authorizer is a near-verbatim copy of `jwt-authorizer/handler.ts` — same steps in the same order: strip Bearer prefix, `verifyToken`, check `inviteValidated`, `getProfile`, `ensureProfile`, check `suspendedAt`, return Allow with context. The two implementations can drift independently. Small differences already exist: the JWT authorizer falls back to `publicMetadata.role` if the profile role is missing (line 77); the fallback path in the API key authorizer does the same (line 197), but the log messages and comments diverge.

**Suggested change:** Extract a shared async function, e.g., `verifyClerkJwtAuth(token: string, client: DynamoDBDocumentClient, logger: Logger): Promise<APIGatewayAuthorizerResult>`, into `@ai-learning-hub/middleware` (e.g., in a new `src/clerk-auth.ts`). Both authorizer handlers call this shared function. The function encapsulates: `verifyToken`, invite check, `ensureProfile`, suspension check, and `generatePolicy`. Each authorizer keeps only its pre-auth logic (extract API key header vs extract Authorization header).

**Priority:** Medium.

---

### 1.3 `invite-codes/schemas.ts` is a pure re-export with no callers (carry-forward from Epic 1 review)

**Location:** `backend/functions/invite-codes/schemas.ts` (entire file, 13 lines).

**What's wrong:** The file only re-exports `paginationQuerySchema` and `validateQueryParams` from `@ai-learning-hub/validation`. The handler imports from `./schemas.js`, creating an unnecessary indirection layer. The file adds no local definitions. This was noted in the Epic 1 review and was not resolved.

**Suggested change:** If the three-file pattern (handler, test, schemas) is required, have the schemas file define something (e.g., a `listInviteCodesQuerySchema` alias) so it is substantive. Otherwise, change `invite-codes/handler.ts` to import `paginationQuerySchema` and `validateQueryParams` directly from `@ai-learning-hub/validation`, and delete `invite-codes/schemas.ts`.

**Priority:** Low.

---

## 2. Naming and consistency

### 2.1 Combined handlers apply overly broad scope, masking the intended per-method scopes

**Location:**

- `backend/functions/invite-codes/handler.ts` (lines 139–146): `wrapHandler(inviteCodesHandler, { requireAuth: true, requiredScope: "invites:manage" })`
- `backend/functions/api-keys/handler.ts` (lines 237–240): `wrapHandler(apiKeysHandler, { requireAuth: true, requiredScope: "keys:manage" })`

**What's wrong:** Both combined handlers apply a single scope to all HTTP methods, meaning a caller using an API key with only `invites:read` (or `keys:read`) cannot list their codes/keys. The named per-method exports (`listHandler`, `generateHandler`) set the correct scopes (`invites:read` for GET, `invites:manage` for POST) — but those named exports are dead code per Finding 1.1. The combined handler therefore applies the mutation scope to the read path in production.

This is a behavioral inconsistency between what the code documents and what it enforces: `keys:read` and `invites:read` scopes cannot successfully call GET on these endpoints through the current production path.

**Suggested change:** Change `inviteCodesHandler` and `apiKeysHandler` to call `requireScope(ctx.auth, scope)` imperatively per method branch (matching the pattern in `users-me/handler.ts` `usersMeHandler`), then drop `requiredScope` from the combined `wrapHandler` call. For example, in `apiKeysHandler`:

```typescript
case "GET":
  if (ctx.auth) requireScope(ctx.auth, "keys:read");
  return handleList(ctx);
case "POST":
  if (ctx.auth) requireScope(ctx.auth, "keys:manage");
  return handleCreate(ctx);
```

**Priority:** High.

---

### 2.2 Stale "stub" / "Epic 2 not yet implemented" comments in `auth.ts`

**Location:** `backend/shared/middleware/src/auth.ts` (lines 1–3 file-level comment, line 17 function-level comment):

```
 * Authentication middleware stubs
 * Full implementation will come in Epic 2 (Authentication)
```

and:

```
 * This is a stub that will be fully implemented with Clerk in Epic 2
```

**What's wrong:** Epic 2 is complete. The file now contains a full, production-grade implementation (`extractAuthContext`, `requireAuth`, `requireRole`, `requireScope`). Calling it a "stub" misleads future readers into thinking the auth layer is incomplete or provisional.

**Suggested change:** Replace the file-level comment with a short description of what the module actually provides, e.g., `"Authentication context extraction and enforcement for API Gateway Lambda handlers."` Remove the "stub" and "Full implementation will come in Epic 2" lines from the JSDoc.

**Priority:** Low.

---

### 2.3 `keyIdPathSchema` is inline in `api-keys/handler.ts` while similar schemas live in `@ai-learning-hub/validation`

**Location:** `backend/functions/api-keys/handler.ts` (lines 35–37):

```typescript
const keyIdPathSchema = z.object({
  id: z.string().min(1, "API key ID is required").max(128),
});
```

**What's wrong:** The project has a `saveIdPathSchema` in `@ai-learning-hub/validation/src/schemas.ts` for save ID path params. An analogous `keyIdPathSchema` exists only in the handler. If future handlers need to validate an API key ID path parameter (e.g., a GET by ID, events endpoint), they will each define the same schema inline.

**Suggested change:** Move `keyIdPathSchema` to `backend/shared/validation/src/schemas.ts` as `apiKeyIdPathSchema` and export it. Import from there in `api-keys/handler.ts`. This keeps all path parameter schemas in one place, consistent with `saveIdPathSchema`.

**Priority:** Low.

---

## 3. Use of standardized components and patterns

### 3.1 Rate limit middleware configs co-located with DB operations (wrong layer)

**Location:** `backend/shared/db/src/users.ts` (lines 32–87): `apiKeyCreateRateLimit`, `inviteGenerateRateLimit`, `inviteValidateRateLimit`, `profileUpdateRateLimit`.

**What's wrong:** These four `RateLimitMiddlewareConfig` objects are policy/middleware configuration — they define limits, windows, and scope-based branching logic for the middleware layer. They are not DB operations and do not use any DB helpers. Housing them in the DB package blurs the package boundary: `@ai-learning-hub/db` exports a type (`RateLimitMiddlewareConfig`) it imports from `@ai-learning-hub/types`, just to hold rate limit config objects.

**Suggested change:** Move the four rate limit config constants to a new file `backend/shared/middleware/src/rate-limit-configs.ts` and export them from `@ai-learning-hub/middleware`. Update handler imports accordingly. This makes the DB package purely about DynamoDB operations and lets the middleware package own all rate limiting policy.

**Priority:** Low.

---

### 3.2 `wrapper.ts` uses a different test fallback for `USERS_TABLE_NAME` than `users.ts`

**Location:**

- `backend/shared/middleware/src/wrapper.ts` (line 251): `requireEnv("USERS_TABLE_NAME", "ai-learning-hub-users")`
- `backend/shared/db/src/users.ts` (line 25): `requireEnv("USERS_TABLE_NAME", "dev-ai-learning-hub-users")`

**What's wrong:** In a test environment where `USERS_TABLE_NAME` is not set, `wrapper.ts`'s rate limit path will resolve to `"ai-learning-hub-users"` (no prefix) while `users.ts` resolves to `"dev-ai-learning-hub-users"` (with `dev-` prefix). Any test that exercises the rate limiter path without setting `USERS_TABLE_NAME` will silently use a different table name than the rest of the users DB layer. This can produce confusing test failures or false passes when both sides use mocks.

**Suggested change:** Align the fallback: change `wrapper.ts` line 251 to `requireEnv("USERS_TABLE_NAME", "dev-ai-learning-hub-users")` to match `users.ts`. Consider defining a single `DEFAULT_USERS_TABLE_NAME = "dev-ai-learning-hub-users"` constant in `@ai-learning-hub/db` and importing it in both places.

**Priority:** Low.

---

## 4. Opportunities for new shared components

### 4.1 Pagination link-building duplicated across three list handlers

**Location:**

- `backend/functions/api-keys/handler.ts` `handleList` (lines 99–114)
- `backend/functions/invite-codes/handler.ts` `handleList` (lines 82–96)
- `backend/functions/saves-list/handler.ts` `handleList` (lines 243–258)

**What's wrong:** All three list handlers build `self` and `next` links using the same pattern: construct a `Record<string, string>` of query params, serialize with `URLSearchParams`, prepend the base path, and conditionally append `cursor` to `next`. The code is structurally identical in the first two cases and similar in the third. Any change to the link format (e.g., absolute URL, different cursor param name) must be applied in all three places.

**Suggested change:** Add a `buildPaginationLinks(basePath: string, queryParams: Record<string, string>, nextCursor: string | null): { self: string; next: string | null }` helper to `@ai-learning-hub/middleware` (e.g., alongside `createSuccessResponse`). Replace the inline link-building in all three handlers. This also ensures future list endpoints (projects, links, tutorials) use the same format consistently.

**Priority:** Medium.

---

## 5. Clarity and efficiency

### 5.1 Lambda functions receive environment variables for tables they do not use

**Location:** `infra/lib/stacks/auth/auth.stack.ts` — every `NodejsFunction` definition (lines 63–69, 171–177, 280–285, 363–370, 476–482, 560–565).

**What's wrong:** Every Lambda in `AuthStack` receives the same five table environment variables even though most functions use only one or two tables. For example, `jwt-authorizer` reads from `USERS_TABLE_NAME` only; `SAVES_TABLE_NAME` is unnecessary for every auth function. This makes each function's actual runtime dependencies unclear and sets a pattern future contributors may follow for all new functions.

**Important prerequisite — barrel import constraint:** This finding cannot be fully implemented until the `@ai-learning-hub/db` barrel import issue is resolved (related to Finding 3.1). `infra/lib/stacks/api/saves-routes.stack.ts` contains an explicit comment documenting this constraint:

> "Read-only environment — still needs all table env vars because @ai-learning-hub/db barrel export triggers module-level `requireEnv()` calls"

Each table's config object (e.g. `USERS_TABLE_CONFIG`, `SAVES_TABLE_CONFIG`) is initialized at module load via `requireEnv()`. Any Lambda that imports from `@ai-learning-hub/db` — even to access only the users table — will trigger all other table configs at cold start. If `requireEnv()` throws on missing env vars without a default, removing a table's env var will cause Lambda initialization failures regardless of whether that table is used. Audit `requireEnv()` defaults in each table config before removing any env vars, and consider restructuring the barrel export to use lazy initialization (see Finding 3.1).

**Suggested change (once barrel import constraint is resolved):** Pass only the env vars each function actually needs:

| Function                   | Tables actually used                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `jwtAuthorizerFunction`    | `USERS_TABLE_NAME`                                                                           |
| `apiKeyAuthorizerFunction` | `USERS_TABLE_NAME`                                                                           |
| `usersMeFunction`          | `USERS_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`, `EVENTS_TABLE_NAME`                            |
| `validateInviteFunction`   | `INVITE_CODES_TABLE_NAME`, `USERS_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`, `EVENTS_TABLE_NAME` |
| `apiKeysFunction`          | `USERS_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`, `EVENTS_TABLE_NAME`                            |
| `generateInviteFunction`   | `INVITE_CODES_TABLE_NAME`, `USERS_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`, `EVENTS_TABLE_NAME` |

Remove `SAVES_TABLE_NAME` from all auth functions — none use it. Removing this is safe today only if `requireEnv("SAVES_TABLE_NAME", ...)` has a non-throwing default in the saves table config.

**Priority:** Low (blocked by Finding 3.1 / barrel import structure).

---

### 5.2 Combined handler comments contain false factual claims about CDK wiring

**Location:**

- `backend/functions/api-keys/handler.ts` (lines 233–236): `"Combined handler for backward compatibility. In production, CDK wires specific handlers for proper middleware."`
- `backend/functions/invite-codes/handler.ts` (lines 139–142): `"Combined handler for backward compatibility. In production, CDK wires specific handlers for proper middleware."`
- `backend/functions/users-me/handler.ts` (lines 217–221): `"CDK wires GET to readHandler and PATCH/POST to writeHandler separately, but this combined handler is kept for flexibility/testing."`

**What's wrong:** All three comments make factually incorrect claims about how CDK wires these handlers. `infra/lib/stacks/api/auth-routes.stack.ts` routes every method to the combined Lambda function reference — no named per-method export is ever referenced in CDK code. The api-keys and invite-codes comments say "CDK wires specific handlers for proper middleware" when the opposite is true. The users-me comment says "CDK wires GET to readHandler and PATCH/POST to writeHandler separately" which is also false — both GET and PATCH are wired to a single `LambdaIntegration(usersMeFunction)` in a `for` loop. A developer reading these comments would incorrectly believe the named exports are the active production entry points, which is the opposite of reality.

This is not simply a "backward compatibility" framing issue (this is a greenfield project — that framing doesn't apply either), but a false statement about the current architecture that will actively mislead anyone trying to trace the production call path.

**Suggested change:** Replace all three with accurate descriptions. For example:

- `"Production handler. CDK entry point — routes all HTTP methods for this resource via auth-routes.stack.ts."`
- If the named per-method exports are being kept for a planned migration to per-method Lambda wiring (Option B in Finding 1.1), say so explicitly.

**Priority:** Low (style/correctness), but blocks the misleading code being preserved through future maintenance.

---

### 5.3 CI pipeline runs lint twice in the same workflow (Stages 1 and 7)

**Location:** `.github/workflows/ci.yml` (lines 34–35 Stage 1, lines 237–238 Stage 7).

**What's wrong:** Stage 1 (`lint-and-format`) runs `npm run lint`. Stage 7 (`security-scan`) runs `npm run lint` again in the same commit with the same code, noting in a comment that "Lint runs here again for SAST context." The second lint run produces identical output and consumes compute budget without adding signal. If a security-specific ESLint config is needed, it should be a distinct `npm run lint:security` command.

**Suggested change:** Remove the duplicate `npm run lint` from Stage 7. If a security-specific ESLint run is desired, create a `lint:security` script that runs with the security plugin ruleset and use that exclusively in Stage 7. Otherwise, make Stage 7 depend on Stage 1 for lint results and skip the re-run.

**Priority:** Low.

---

## 6. Missing permissions and incorrect self-documentation

### 6.1 IAM policies for **four** auth Lambdas are missing `PutItem` on the events table — silent data loss

**Location:** `infra/lib/stacks/auth/auth.stack.ts`:

- `usersMeFunction` IAM grant (lines 297–302): `GetItem`, `UpdateItem` on `usersTable` only.
- `apiKeysFunction` IAM grant (lines 494–499): `PutItem`, `Query`, `UpdateItem` on `usersTable` only.
- `generateInviteFunction` IAM grant (lines 578–595): `PutItem`, `Query` on `inviteCodesTable`, `UpdateItem` on `usersTable` only.
- `validateInviteFunction` IAM grant (lines 382–415): `GetItem`, `UpdateItem` on `inviteCodesTable`, `UpdateItem` on `usersTable`. No events table grant.

**What's wrong:** All four functions call `recordEvent()` in their production code paths:

| Function                 | Event recorded                   | Call site                      |
| ------------------------ | -------------------------------- | ------------------------------ |
| `usersMeFunction`        | `ProfileUpdated`                 | `handleUpdate`                 |
| `apiKeysFunction`        | `ApiKeyCreated`, `ApiKeyRevoked` | `handleCreate`, `handleRevoke` |
| `generateInviteFunction` | `InviteCodeGenerated`            | `handleGenerate`               |
| `validateInviteFunction` | `InviteCodeRedeemed`             | `validateInviteHandler`        |

None of the four IAM policies grant `dynamodb:PutItem` on `eventsTable`.

**Why the smoke test does not catch this:** `recordEvent()` is explicitly fire-and-forget. Its implementation (`backend/shared/db/src/events.ts` lines 211–234) wraps the `putItem` call in a `try/catch` that catches all errors — including `AccessDeniedException` — logs them at `WARN` level, and returns the event object without re-throwing. The Lambda returns its normal 200/201/204. The smoke test asserts only HTTP status codes and never queries the events table to verify writes occurred. The IAM gap is completely invisible to status-code-only assertions.

**The actual consequence:** The event history for all Epic 2 mutations is empty in the deployed environment. Profile updates, API key creates, revocations, invite code generations, and invite redemptions all silently record nothing. No alert fires, no test fails, no 500 is returned. This requires a deliberate audit of the events table to discover.

**Suggested change:** Add `PutItem` on `eventsTable` to all four functions in `auth.stack.ts`:

```typescript
// Add to usersMeFunction, apiKeysFunction, generateInviteFunction, validateInviteFunction
fn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["dynamodb:PutItem"],
    resources: [eventsTable.tableArn],
  })
);
```

Add individually per function to preserve the explicit least-privilege pattern in the existing code.

**Priority:** High (silent data loss on first deploy).

---

### 6.2 `validateInviteFunction` idempotency is silently bypassed — IAM missing for idempotency table

**Location:** `infra/lib/stacks/auth/auth.stack.ts` — `validateInviteFunction` IAM grants (lines 382–415).

**What's wrong:** `validate-invite/handler.ts` is wrapped with `{ idempotent: true, rateLimit: inviteValidateRateLimit }` (line 165–169). The `idempotent: true` option causes `wrapHandler` to call `checkIdempotency` (needs `GetItem` on idempotency table) and `storeIdempotencyResult` (needs `PutItem` on idempotency table) on every request. The `validateInviteFunction` IAM policy has no grants on the idempotency table.

Both `checkIdempotency` and `storeIdempotencyResult` are fail-open (see `backend/shared/middleware/src/idempotency.ts` lines 133–142 and 217–223). When the DynamoDB call throws `AccessDeniedException`:

- `checkIdempotency` catches it, sets `idempotencyStatus.available = false`, and returns `null` (handler executes anyway)
- `storeIdempotencyResult` catches it, sets `idempotencyStatus.available = false`, and returns the original result
- `wrapHandler` adds `X-Idempotency-Status: unavailable` to the response header

**Why the smoke test does not catch this:** The route-connectivity test (AC9) sends `POST /auth/validate-invite` with a minimal body `{}` — this triggers body validation before idempotency is exercised (missing `code` field → 400). No smoke test scenario sends a valid invite validation request. No scenario sends a duplicate request to verify replay behavior. No scenario checks the `X-Idempotency-Status` response header.

**The actual consequence:** Every `POST /auth/validate-invite` call always re-executes the handler rather than replaying a cached result. An agent retrying a timed-out invite validation may redeem the same code twice (if the race condition window is hit), or receive inconsistent responses. The failure is invisible — responses are 200 and look correct. The response carries `X-Idempotency-Status: unavailable` but callers are not expected to check this in the absence of documentation that it may be set.

**Suggested change:** Add `GetItem` and `PutItem` on `idempotencyTable` to `validateInviteFunction`'s IAM policy in `auth.stack.ts`:

```typescript
this.validateInviteFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
    resources: [idempotencyTable.tableArn],
  })
);
```

Add a smoke test scenario that sends a valid invite validation twice with the same `Idempotency-Key` and asserts `X-Idempotent-Replayed: true` on the second response.

**Priority:** High (silent idempotency failure; invite validation is the most sensitive mutation in the auth flow).

---

### 6.3 Smoke test AC14 (rate limiting) tests an endpoint with no Lambda-level rate limiting — would always fail if enabled

**Location:** `scripts/smoke-test/scenarios/rate-limiting.ts`.

**What's wrong:** AC14 sends 11 rapid requests to `GET /users/me` and expects at least one `429`. The `users-me` combined handler is wrapped with `{ requireAuth: true }` only — no `rateLimit` option. `GET /users/me` has no Lambda-level rate limiting. The WAF threshold is 500 requests per 5 minutes per IP (`infra/lib/stacks/api/rate-limiting.stack.ts`), and API Gateway throttling is set to 100 requests/second. Neither is reachable with 11 requests.

AC14 is currently always skipped in practice because `SMOKE_TEST_RATE_LIMIT_JWT` is not set. If a developer sets the env var and enables the scenario, it will always fail: 11 requests to `GET /users/me` will return 11 × 200 responses.

The rate limiting that was intended for this test is on `writeHandler` (profile updates) and `createHandler` (API key creation) — but both are dead code per Finding 1.1. The combined `handler` for `users-me` has no rate limiting.

**Suggested change:**

1. Fix the underlying rate limiting gap first (see Finding 1.1 — restore idempotency and rate limiting to production paths).
2. Once fixed, update AC14 to target a rate-limited mutation endpoint (e.g., `POST /users/api-keys` with `apiKeyCreateRateLimit`) rather than `GET /users/me`.
3. Document the correct endpoint and expected limit in the scenario comment.

**Priority:** Medium (latent test failure; currently masked by the skip mechanism).

---

### 6.4 `users-me` combined handler JSDoc makes a false factual claim about CDK wiring

**Location:** `backend/functions/users-me/handler.ts` (lines 217–221):

```typescript
/**
 * Main handler that routes between read and write operations.
 * CDK wires GET to readHandler and PATCH/POST to writeHandler separately,
 * but this combined handler is kept for flexibility/testing.
 */
export const handler = wrapHandler(usersMeHandler, {
```

**What's wrong:** The claim "CDK wires GET to readHandler and PATCH/POST to writeHandler separately" is factually incorrect. `infra/lib/stacks/api/auth-routes.stack.ts` (lines 117–126) routes both GET and PATCH to a single `LambdaIntegration(usersMeFunction)` in a `for` loop. Neither `readHandler` nor `writeHandler` is referenced anywhere in the CDK codebase. A developer tracing the production call path from this comment would reach the wrong conclusion about which code runs in production.

This is distinct from (and more specific than) the "backward compatibility" framing noted in Finding 5.2 for the other two handlers. The users-me comment makes an affirmative false statement about what CDK does, not merely uses an inapt framing.

**Suggested change:** Replace with an accurate description, e.g.:

```typescript
/**
 * Production handler. CDK entry point — routes GET, PATCH, and POST /update
 * for /users/me via a single LambdaIntegration in auth-routes.stack.ts.
 * Scope enforcement and If-Match extraction are applied imperatively per method branch.
 */
```

**Priority:** Low.

---

| #   | Category                     | Location (summary)                                                                          | Priority     |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------- | ------------ |
| 1.1 | Dead code + functional gap   | Named handlers unused by CDK; combined handlers missing idempotency and rate limiting       | **Critical** |
| 1.2 | Dead/redundant code          | JWT auth logic duplicated in api-key-authorizer JWT fallback                                | Medium       |
| 1.3 | Dead/redundant code          | `invite-codes/schemas.ts` pure re-export (carry-forward)                                    | Low          |
| 2.1 | Naming and consistency       | Combined handlers apply blanket scope; read ops over-restricted                             | **High**     |
| 2.2 | Naming and consistency       | Stale "stub/Epic 2" comments in `auth.ts`                                                   | Low          |
| 2.3 | Naming and consistency       | `keyIdPathSchema` inline instead of in shared validation                                    | Low          |
| 3.1 | Standardized patterns        | Rate limit configs live in `@ai-learning-hub/db`, not middleware                            | Low          |
| 3.2 | Standardized patterns        | `USERS_TABLE_NAME` test fallback inconsistent between `wrapper.ts` and `users.ts`           | Low          |
| 4.1 | New shared component         | Pagination link-building duplicated across 3 list handlers                                  | Medium       |
| 5.1 | Clarity (blocked)            | Auth Lambdas receive table env vars they don't use; blocked by barrel import constraint     | Low          |
| 5.2 | Clarity / false comments     | Combined handler comments make false factual claims about CDK wiring named exports          | Low          |
| 5.3 | Clarity                      | CI pipeline runs `npm run lint` twice (Stages 1 and 7)                                      | Low          |
| 6.1 | Missing permissions          | 4 auth Lambdas missing `PutItem` on events table — all Epic 2 mutation events silently lost | **High**     |
| 6.2 | Missing permissions          | `validateInviteFunction` missing idempotency table IAM — idempotency silently bypassed      | **High**     |
| 6.3 | Smoke test gap               | AC14 tests `GET /users/me` which has no rate limiting — would always fail if enabled        | Medium       |
| 6.4 | Incorrect self-documentation | `users-me` handler JSDoc falsely states CDK wires named exports separately                  | Low          |
| 7.1 | Smoke test gap               | No scenario verifies events table writes for any Epic 2 mutation                            | **High**     |
| 7.2 | Smoke test gap               | No replay assertion for `validate-invite` — broken idempotency is invisible                 | **High**     |
| 7.3 | Smoke test gap               | Idempotency keys sent on api-keys mutations but replay never verified                       | Medium       |

---

## 7. Smoke test coverage gaps

The deployed smoke test (`scripts/smoke-test/`) is well-structured and covers what it was designed to cover: route connectivity, auth chain correctness, CORS preflight, response shapes, scope enforcement, concurrency headers, and cursor pagination. Of its ~48 scenarios, roughly 45 are pure HTTP assertions (status code + response body shape).

**What the smoke test correctly does not do:** The smoke test is not a data audit tool. It does not query DynamoDB directly, and it should not need to for most scenarios. Its job is to confirm the API contract is correct from a caller's perspective.

**The gap:** Several Epic 2 behaviors are fail-open by design — `recordEvent()`, idempotency check/store, and rate limiting all catch DynamoDB errors and continue rather than failing the request. This means a broken IAM policy or missing table grant returns a normal 200/201/204 with no visible sign of failure. An HTTP-only smoke test cannot distinguish "mutation succeeded and side-effect was recorded" from "mutation succeeded and side-effect was silently dropped."

The existing smoke test already contains the right pattern for closing this gap. `scripts/smoke-test/scenarios/eventbridge-verify.ts` (EB1–EB3) makes an API call and then polls CloudWatch Logs to confirm an EventBridge event was delivered. That end-to-end side-effect verification is exactly what Epic 2 mutations need — but applied to the DynamoDB events table and idempotency table instead of CloudWatch.

### 7.1 No scenario verifies that Epic 2 mutations write to the events table

**What exists:** EB1–EB3 verify that saves operations (Epic 3) deliver events to CloudWatch Logs via EventBridge. AN2 verifies saves idempotency by replaying a `POST /saves` and asserting `X-Idempotent-Replayed: true`.

**What is missing:** No scenario queries the DynamoDB events table after an Epic 2 mutation to confirm a record was written. The four affected mutations are:

| Mutation                                                          | Event type            | Lambda                   |
| ----------------------------------------------------------------- | --------------------- | ------------------------ |
| `PATCH /users/me` or `POST /users/me/update`                      | `ProfileUpdated`      | `usersMeFunction`        |
| `POST /users/api-keys`                                            | `ApiKeyCreated`       | `apiKeysFunction`        |
| `DELETE /users/api-keys/:id` or `POST /users/api-keys/:id/revoke` | `ApiKeyRevoked`       | `apiKeysFunction`        |
| `POST /users/invite-codes`                                        | `InviteCodeGenerated` | `generateInviteFunction` |
| `POST /auth/validate-invite`                                      | `InviteCodeRedeemed`  | `validateInviteFunction` |

**Why this matters:** Finding 6.1 documents that all four Lambda IAM policies are missing `PutItem` on the events table, causing silent data loss on every mutation. The smoke test's status-code assertions pass regardless, so this bug has been undetected. Without a side-effect audit step, any future IAM regression on the events table would also go undetected.

**Suggested addition:** After the mutation scenarios run, add a Phase 8 "side-effects audit" that uses the AWS SDK directly (not via the API) to query the events table and assert at least one record exists per mutation type. This requires `SMOKE_TEST_AWS_REGION` and appropriate read-only IAM credentials for the smoke test runner — a lower-privilege role than the Lambda roles themselves.

---

### 7.2 No scenario verifies that `validate-invite` idempotency is functioning

**What exists:** AN2 verifies idempotency replay for `POST /saves`. It sends the same request twice with the same `Idempotency-Key` and asserts `X-Idempotent-Replayed: true` on the second response. This proves the idempotency record was stored in DynamoDB and replayed correctly — for the saves Lambda.

**What is missing:** No equivalent scenario exists for `POST /auth/validate-invite`, the only Epic 2 handler with `idempotent: true` in its production `wrapHandler`. There is no smoke test that:

- Sends a valid invite validation request with an `Idempotency-Key`
- Resends the identical request with the same key
- Asserts `X-Idempotent-Replayed: true` on the second response

**Why this matters:** Finding 6.2 documents that `validateInviteFunction`'s IAM policy is missing `GetItem`/`PutItem` on the idempotency table. The fail-open path means: (a) `X-Idempotency-Status: unavailable` is set on every response but no caller checks it, (b) every retry re-executes the handler. The replay assertion pattern from AN2 would catch this directly — if idempotency is broken, the second request would not return `X-Idempotent-Replayed: true`.

**Suggested addition:** Add a scenario (e.g., `VI1`) that sends two valid `POST /auth/validate-invite` requests with the same `Idempotency-Key` and asserts `X-Idempotent-Replayed: true` on the replay. Requires `SMOKE_TEST_INVITE_CODE` env var pointing to a reusable test invite code (or a freshly generated one). This scenario is a direct port of AN2 applied to the invite validation flow.

---

### 7.3 AC14 (rate limiting) targets an endpoint with no Lambda-level rate limiting

Documented as Finding 6.3. Recorded here as a smoke test coverage issue: AC14 is currently always skipped because `SMOKE_TEST_RATE_LIMIT_JWT` is not set. If enabled, it would always fail because `GET /users/me` has no Lambda rate limiting in the combined handler. The scenario needs to be retargeted to a rate-limited mutation endpoint (e.g., `POST /users/api-keys`, `POST /users/invite-codes`) once Finding 1.1 is resolved and rate limiting is restored to the production handlers.

---

### Summary of smoke test gaps

| Gap                                                                                                                              | Type                      | Finding |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- |
| No events table write verification for Epic 2 mutations                                                                          | Missing side-effect audit | 6.1     |
| No idempotency replay verification for `validate-invite`                                                                         | Missing replay assertion  | 6.2     |
| AC14 targets unrate-limited endpoint — always fails if enabled                                                                   | Wrong target endpoint     | 6.3     |
| Smoke test sends idempotency keys on api-keys/invite-codes mutations but never verifies replay — broken idempotency is invisible | Missing replay assertion  | 1.1     |

The last row is worth emphasizing: `api-key-auth.ts` sends `Idempotency-Key` headers on every `createKey()` call and CM4 sends them on revocation, but the combined handlers have no `idempotent: true`, so the keys are silently ignored. The smoke test never sends a duplicate request to notice. An AN2-style replay scenario for `POST /users/api-keys` would immediately reveal that `X-Idempotent-Replayed` is never returned, confirming idempotency is not active.

---

## What was checked and found OK

- **Auth handlers:** All Epic 2 handlers (`jwt-authorizer`, `api-key-authorizer`, `users-me`, `validate-invite`, `api-keys`, `invite-codes`) import from `@ai-learning-hub/*` correctly; no direct DynamoDB SDK usage; no `console.*` logging; all use `wrapHandler` or `createLogger` as appropriate for their context.
- **Authorizer policy helpers:** `generatePolicy` and `deny` are correctly shared via `@ai-learning-hub/middleware`; no duplication of IAM policy document construction.
- **SSM caching:** `getClerkSecretKey` in `@ai-learning-hub/middleware` uses module-level caching correctly; all Clerk-dependent handlers share the same SSM utility.
- **Scope resolution:** `SCOPE_GRANTS` and `checkScopeAccess` in `scope-resolver.ts` correctly implement the hierarchical scope model (e.g., `full` grants all ops); used consistently by `requireScope`.
- **DynamoDB keys:** All `USER#<id>`, `APIKEY#<id>`, `CODE#<id>`, `EVENTS#<type>#<id>` key patterns follow ADR-006 and are consistent across handlers and DB layer.
- **Idempotency and concurrency — `users-me` only:** `extractIfMatch` / `updateProfileWithEvents` are used correctly in the `users-me` mutation path. **Note:** idempotency middleware is NOT active in the production path for `api-keys` and `invite-codes` because the combined `handler` exports do not carry `idempotent: true` — only the dead named exports do. See Finding 1.1.
- **IAM least-privilege — authorizers only:** IAM policies for `jwt-authorizer` and `api-key-authorizer` are correctly scoped to only the actions they need. **Note:** IAM policies for `users-me`, `api-keys`, `generate-invite`, and `validate-invite` are all missing `PutItem` on the events table (silent event loss — see Finding 6.1), and `validate-invite` is additionally missing `GetItem`/`PutItem` on the idempotency table (idempotency silently bypassed on every call — see Finding 6.2). The smoke test does not surface either gap because `recordEvent()` swallows `AccessDeniedException` and idempotency is fail-open.
- **Tables:** `TablesStack` defines all 9 tables with correct key patterns, PITR enabled, AWS-managed encryption, pay-per-request billing, and `RETAIN` removal policy. TTL configured on idempotency and events tables.
- **CORS config:** Auth routes correctly re-declare CORS preflight options on every resource (required for imported REST APIs) and expose agent-native headers (`Idempotency-Key`, `If-Match`, `X-Agent-ID`, rate limit headers).
- **CI structure:** Lint → Type-check → Unit tests (80% gate) → CDK Synth + Nag → Deploy Dev (main only) pipeline is correct and follows the Epic 1 design. Review gate logic is sound.

---

_Generated from a full pass over Epic 2 deliverables and dependent shared code. Prioritization favors consistency and correctness wins over style-only refactors._
