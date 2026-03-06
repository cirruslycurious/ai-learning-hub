---
id: "3.5.2"
title: "Epic 2 Code Cleanup"
status: ready-for-dev
depends_on: ["3.5.1"]
touches:
  - infra/lib/stacks/auth/auth.stack.ts
  - infra/lib/stacks/api/auth-routes.stack.ts
  - infra/test/stacks/auth/auth.stack.test.ts
  - backend/functions/api-keys/handler.ts
  - backend/functions/invite-codes/handler.ts
  - backend/functions/users-me/handler.ts
  - backend/functions/validate-invite/handler.ts
  - backend/functions/validate-invite/handler.test.ts
  - backend/shared/middleware/src/auth.ts
  - backend/shared/middleware/src/wrapper.ts
  - backend/shared/middleware/src/pagination.ts
  - backend/shared/middleware/src/index.ts
  - backend/shared/validation/src/schemas.ts
  - backend/shared/validation/src/index.ts
  - backend/functions/saves-list/handler.ts
  - scripts/smoke-test/scenarios/rate-limiting.ts
risk: high
---

# Story 3.5.2: Epic 2 Code Cleanup

## Story

As a **developer and operator of ai-learning-hub**,
I want **the Epic 2 code review findings resolved — dead CDK wiring fixed, missing IAM policies added, stale comments removed, and shared utilities extracted**,
so that **idempotency, rate limiting, and per-method scope enforcement are actually active in production, event history is written correctly, and the codebase is consistent and free of false documentation**.

## Acceptance Criteria

1. **AC1: Per-method Lambda functions for api-keys** — `AuthStack` creates three separate `NodejsFunction` instances for the api-keys domain: `createApiKeyFunction` (handler: `"createHandler"`), `listApiKeyFunction` (handler: `"listHandler"`), `revokeApiKeyFunction` (handler: `"revokeHandler"`). Each carries the correct IAM policies (see AC7). The existing single `apiKeysFunction` with `handler: "handler"` is removed.

2. **AC2: Per-method Lambda functions for invite-codes** — `AuthStack` creates two separate `NodejsFunction` instances: `generateInviteFunction` (handler: `"generateHandler"`) and `listInviteCodesFunction` (handler: `"listHandler"`). Each carries the correct IAM policies. The existing single `generateInviteFunction` with `handler: "handler"` is removed and replaced (the name may be reused for the POST-only function).

3. **AC3: Per-method Lambda functions for users-me** — `AuthStack` creates two separate `NodejsFunction` instances: `readUsersMeFunction` (handler: `"readHandler"`) and `writeUsersMeFunction` (handler: `"writeHandler"`). Each carries the correct IAM policies. The existing `usersMeFunction` with `handler: "handler"` is removed.

4. **AC4: AuthRoutesStack wires per-method Lambdas** — `AuthRoutesStack` props are updated to accept the new per-method function references. Routes are wired accordingly: `POST /users/api-keys` → `createApiKeyFunction`; `GET /users/api-keys` → `listApiKeyFunction`; `DELETE /users/api-keys/{id}` → `revokeApiKeyFunction`; `POST /users/api-keys/{id}/revoke` → `revokeApiKeyFunction` (both the DELETE path and the POST /revoke command endpoint use the same function — two separate `addMethod()` calls on two separate resources, both pointing to `LambdaIntegration(revokeApiKeyFunction)`); `POST /users/invite-codes` → `generateInviteFunction`; `GET /users/invite-codes` → `listInviteCodesFunction`; `GET /users/me` → `readUsersMeFunction`; `PATCH /users/me` and `POST /users/me/update` → `writeUsersMeFunction`.

5. **AC5: Dead combined handler exports removed** — The `export const handler = wrapHandler(...)` combined exports are deleted from `api-keys/handler.ts`, `invite-codes/handler.ts`, and `users-me/handler.ts`. The combined `apiKeysHandler`, `inviteCodesHandler`, and `usersMeHandler` router functions are also deleted. No combined handler remains as an entry point. All exported names (`createHandler`, `listHandler`, `revokeHandler`, `generateHandler`, `readHandler`, `writeHandler`) are the sole API-level exports. The `writeHandler` export's `requireVersion: true` middleware option handles `If-Match` header extraction for PATCH mutations — this responsibility moved from the `usersMeHandler` router to the middleware layer and must be verified to still work correctly after `usersMeHandler` is deleted.

6. **AC6: Middleware is active in production** — As a result of AC1–AC5: `POST /users/api-keys` has `idempotent: true` and `rateLimit: apiKeyCreateRateLimit`; `DELETE /users/api-keys/{id}` and `POST /users/api-keys/{id}/revoke` have `idempotent: true`; `GET /users/api-keys` has `requiredScope: "keys:read"`; `POST /users/invite-codes` has `idempotent: true` and `rateLimit: inviteGenerateRateLimit`; `GET /users/invite-codes` has `requiredScope: "invites:read"`; `PATCH /users/me` and `POST /users/me/update` have `idempotent: true`, `requireVersion: true`, and `rateLimit: profileUpdateRateLimit`; `GET /users/me` has `requiredScope: "users:read"`.

7. **AC7: Events table PutItem IAM added to five mutation functions** — In `auth.stack.ts`, all five mutation functions (`createApiKeyFunction`, `revokeApiKeyFunction`, `generateInviteFunction`, `validateInviteFunction`, and `writeUsersMeFunction`) have an explicit `addToRolePolicy` granting `dynamodb:PutItem` on `eventsTable.tableArn` (no index ARN needed — events are append-only). This is added individually to each function to preserve explicit least-privilege documentation. Additionally, `writeUsersMeFunction` needs `dynamodb:GetItem` and `dynamodb:UpdateItem` on `usersTable` (read then write for profile).

8. **AC8: idempotencyTable IAM added to validateInviteFunction** — `validateInviteFunction` has `dynamodb:GetItem` and `dynamodb:PutItem` on `idempotencyTable.tableArn`. This allows `checkIdempotency` and `storeIdempotencyResult` to actually execute rather than silently fail-open with `X-Idempotency-Status: unavailable`.

9. **AC9: idempotencyTable IAM added to write functions** — `createApiKeyFunction`, `revokeApiKeyFunction`, `generateInviteFunction`, and `writeUsersMeFunction` each have `dynamodb:GetItem` and `dynamodb:PutItem` on `idempotencyTable.tableArn`, since all four use `idempotent: true` in their `wrapHandler` calls and therefore exercise the idempotency middleware path on every request.

10. **AC10: auth.stack.ts tests updated** — `infra/test/stacks/auth/auth.stack.test.ts` is updated to assert: (a) the new per-method Lambda functions exist with correct `handler` string values (`"createHandler"`, `"listHandler"`, etc.); (b) `eventsTable PutItem` is present on each mutation function's IAM policy; (c) `idempotencyTable GetItem/PutItem` is present on all five idempotent functions. Before deleting any existing assertion, grep the test file for all CDK logical ID references to the removed combined functions (`apiKeysFunction`, `generateInviteFunction`, `usersMeFunction`) to ensure no orphaned assertions remain that silently never match anything (CDK logical ID mismatches don't fail — they just produce no result, giving false confidence).

11. **AC11: validate-invite idempotency replay test** — A unit or handler integration test in `backend/functions/validate-invite/handler.test.ts` verifies idempotency replay: sending a valid invite validation request twice with the same `Idempotency-Key` returns `X-Idempotent-Replayed: true` on the second response. This test passes when idempotency middleware is properly configured (i.e., it tests the middleware wiring, not the DynamoDB layer).

12. **AC12: Smoke test AC14 retargeted** — `scripts/smoke-test/scenarios/rate-limiting.ts` AC14 is updated to target `POST /users/api-keys` (a rate-limited mutation endpoint) instead of `GET /users/me` (which has no Lambda-level rate limiting). The scenario comment is updated to document the endpoint, expected rate limit config (`apiKeyCreateRateLimit`), and the `SMOKE_TEST_RATE_LIMIT_JWT` env var requirement.

13. **AC13: Stale stub comments removed from auth.ts** — `backend/shared/middleware/src/auth.ts` file-level comment no longer reads "Authentication middleware stubs / Full implementation will come in Epic 2 (Authentication)". The function-level JSDoc for `extractAuthContext` no longer reads "This is a stub that will be fully implemented with Clerk in Epic 2". Both are replaced with accurate descriptions of what the module and function actually provide.

14. **AC14: apiKeyIdPathSchema moved to shared validation** — `backend/shared/validation/src/schemas.ts` exports `apiKeyIdPathSchema` (the Zod object with `id: z.string().min(1).max(128)`). `backend/functions/api-keys/handler.ts` imports `apiKeyIdPathSchema` from `@ai-learning-hub/validation` and no longer declares `keyIdPathSchema` inline. `@ai-learning-hub/validation` barrel export includes `apiKeyIdPathSchema`.

15. **AC15: USERS_TABLE_NAME fallback aligned** — `backend/shared/middleware/src/wrapper.ts` line 251 uses `requireEnv("USERS_TABLE_NAME", "dev-ai-learning-hub-users")` (matching the fallback in `backend/shared/db/src/users.ts`). No more inconsistency between `"ai-learning-hub-users"` and `"dev-ai-learning-hub-users"` in tests that don't set `USERS_TABLE_NAME`.

16. **AC16: buildPaginationLinks helper extracted** — `backend/shared/middleware/src/pagination.ts` exports `buildPaginationLinks(basePath: string, queryParams: Record<string, string>, nextCursor: string | null): { self: string; next: string | null }`. The barrel export (`index.ts`) re-exports it. All three list handlers (`api-keys/handler.ts`, `invite-codes/handler.ts`, `saves-list/handler.ts`) replace their inline link-building blocks with `buildPaginationLinks(...)`. All three produce identical `{ self, next }` shapes.

17. **AC17: Handler comments accurate** — The removed combined handler exports eliminate the false "In production, CDK wires specific handlers for proper middleware" comments. Each remaining named handler export has a JSDoc that accurately describes its route, method, and middleware options. No handler file makes any false claim about CDK wiring.

18. **AC18: All quality gates pass** — `npm test` passes with no regressions and coverage remains ≥ 80%. `npm run lint` passes. `npm run type-check` passes. `cdk synth` succeeds with no new CDK Nag errors.

## Tasks / Subtasks

- [ ] Task 1: Split api-keys into per-method Lambda functions in auth.stack.ts (AC: #1, #7, #9)
  - [ ] 1.0 **Pre-mortem: audit all DynamoDB calls in api-keys handler** — Before writing any CDK, grep `backend/functions/api-keys/handler.ts` for all DynamoDB operations used by each named export (`createHandler` → `createApiKey`, `recordEvent`; `listHandler` → `listApiKeys`; `revokeHandler` → `revokeApiKey`, `recordEvent`). Produce action list per function: createApiKey needs `PutItem`, `Query` on usersTable + `PutItem` on eventsTable + `GetItem/PutItem` on idempotencyTable; listApiKeys needs `Query` on usersTable; revokeApiKey needs `UpdateItem`, `Query` on usersTable + `PutItem` on eventsTable + `GetItem/PutItem` on idempotencyTable.
  - [ ] 1.1 In `auth.stack.ts`, replace the single `this.apiKeysFunction` block with three `NodejsFunction` instances: `this.createApiKeyFunction` (`handler: "createHandler"`), `this.listApiKeyFunction` (`handler: "listHandler"`), `this.revokeApiKeyFunction` (`handler: "revokeHandler"`)
  - [ ] 1.2 Each new function receives the same entry, runtime, memory, timeout, bundling, tracing config as the removed `apiKeysFunction`. Environment variables: `createApiKeyFunction` and `revokeApiKeyFunction` need `USERS_TABLE_NAME`, `IDEMPOTENCY_TABLE_NAME`, `EVENTS_TABLE_NAME`; `listApiKeyFunction` needs only `USERS_TABLE_NAME`. **⚠️ Env var completeness check:** any function that calls `recordEvent()` MUST have `EVENTS_TABLE_NAME`; any function with `idempotent: true` in its wrapHandler MUST have `IDEMPOTENCY_TABLE_NAME`. Missing env var = Lambda cold-start crash (`requireEnv` throws) or silent wrong-table writes. Cross-reference the DynamoDB audit from Task 1.0 against this list before writing.
  - [ ] 1.3 Add IAM per function — **include index ARN for every table with GSIs that is Queried**: `createApiKeyFunction` → `PutItem, Query` on `usersTable.tableArn` AND `${usersTable.tableArn}/index/*` + `PutItem` on `eventsTable.tableArn` + `GetItem, PutItem` on `idempotencyTable.tableArn`; `listApiKeyFunction` → `Query` on `usersTable.tableArn` AND `${usersTable.tableArn}/index/*` (GSI required for user key listing); `revokeApiKeyFunction` → `UpdateItem, Query` on `usersTable.tableArn` AND `${usersTable.tableArn}/index/*` + `PutItem` on `eventsTable.tableArn` + `GetItem, PutItem` on `idempotencyTable.tableArn`
  - [ ] 1.4 Update CDK exports: export `createApiKeyFunction`, `listApiKeyFunction`, `revokeApiKeyFunction` as stack outputs (replace `apiKeysFunction` exports). Update `AuthStack` public properties accordingly
  - [ ] 1.5 Add NAG suppressions per new function following the established pattern

- [ ] Task 2: Split invite-codes into per-method Lambda functions (AC: #2, #7, #9)
  - [ ] 2.0 **Pre-mortem: audit DynamoDB calls** — `generateHandler` → `createInviteCode` (PutItem, Query on inviteCodesTable) + `recordEvent` (PutItem on eventsTable) + idempotency (GetItem/PutItem on idempotencyTable) + rate limit counter (UpdateItem on usersTable); `listHandler` → `listInviteCodesByUser` (Query on inviteCodesTable + Query on usersTable via GSI)
  - [ ] 2.1 Replace the single `this.generateInviteFunction` block with two `NodejsFunction` instances: keep the TypeScript property name `this.generateInviteFunction` AND keep the CDK construct ID string (first arg to `NodejsFunction`, e.g. `"GenerateInviteFunction"`) unchanged for the POST function — changing the CDK construct ID triggers a Lambda replacement in CloudFormation. For the new list function, use a new construct ID (`"ListInviteCodesFunction"` or similar). Add `this.listInviteCodesFunction` (handler: `"listHandler"`)
  - [ ] 2.2 Environment variables: `generateInviteFunction` → `INVITE_CODES_TABLE_NAME, USERS_TABLE_NAME, IDEMPOTENCY_TABLE_NAME, EVENTS_TABLE_NAME`; `listInviteCodesFunction` → `INVITE_CODES_TABLE_NAME, USERS_TABLE_NAME`
  - [ ] 2.3 Add IAM: `generateInviteFunction` → `PutItem, Query` on inviteCodesTable + `UpdateItem` on usersTable + `PutItem` on eventsTable + `GetItem, PutItem` on idempotencyTable; `listInviteCodesFunction` → `Query` on inviteCodesTable + `Query` on usersTable (for GSI)
  - [ ] 2.4 Export `listInviteCodesFunction` as new stack output; keep `generateInviteFunction` output

- [ ] Task 3: Split users-me into per-method Lambda functions (AC: #3, #7, #9)
  - [ ] 3.0 **Pre-mortem: audit DynamoDB calls** — `readHandler` → `getProfile` (GetItem on usersTable); `writeHandler` → `updateProfileWithEvents` (GetItem + UpdateItem on usersTable) + `recordEvent` (PutItem on eventsTable) + idempotency (GetItem/PutItem on idempotencyTable) + rate limit counter (UpdateItem on usersTable)
  - [ ] 3.1 Replace `this.usersMeFunction` block with two instances: `this.readUsersMeFunction` (handler: `"readHandler"`) and `this.writeUsersMeFunction` (handler: `"writeHandler"`)
  - [ ] 3.2 Environment variables: `readUsersMeFunction` → `USERS_TABLE_NAME`; `writeUsersMeFunction` → `USERS_TABLE_NAME, IDEMPOTENCY_TABLE_NAME, EVENTS_TABLE_NAME`
  - [ ] 3.3 **Audit DB layer first:** Read `backend/shared/db/src/users.ts` — specifically `getProfile` and `updateProfileWithEvents` — to confirm which DynamoDB operations each function executes. `getProfile` likely uses `GetItem`. `updateProfileWithEvents` likely uses `UpdateItem` with `ReturnValues: ALL_OLD/ALL_NEW` (no separate `GetItem` needed) OR uses `GetItem` then `UpdateItem`. Grant only what the code actually calls. Then add IAM: `readUsersMeFunction` → the actions `getProfile` actually uses on usersTable; `writeUsersMeFunction` → the actions `updateProfileWithEvents` actually uses on usersTable + `PutItem` on eventsTable + `GetItem, PutItem` on idempotencyTable
  - [ ] 3.4 Export both as stack outputs; update `AuthStack` public properties

- [ ] Task 4: Update validateInviteFunction IAM (AC: #8)
  - [ ] 4.1 In `auth.stack.ts`, add `dynamodb:GetItem, dynamodb:PutItem` on `idempotencyTable.tableArn` to `this.validateInviteFunction` — add as a new `addToRolePolicy` block after the existing invite-codes table grant
  - [ ] 4.2 Update NAG suppression for `validateInviteFunction` role to include `idempotencyTable` index patterns if applicable (idempotencyTable likely has no GSI, so `appliesTo` may not need updating)

- [ ] Task 5: Update AuthRoutesStack props and route wiring (AC: #4)
  - [ ] 5.1 Update `AuthRoutesStackProps` interface to add: `createApiKeyFunction`, `listApiKeyFunction`, `revokeApiKeyFunction`, `listInviteCodesFunction`, `readUsersMeFunction`, `writeUsersMeFunction` (all `lambda.IFunction`). Remove `apiKeysFunction`, `generateInviteFunction`, `usersMeFunction` from props (or mark as removed).
  - [ ] 5.2 Update route wiring: `POST /users/api-keys` → `createApiKeyFunction`; `GET /users/api-keys` → `listApiKeyFunction`; `DELETE /users/api-keys/{id}` → `revokeApiKeyFunction`; `POST /users/api-keys/{id}/revoke` → `revokeApiKeyFunction`; `POST /users/invite-codes` → `generateInviteFunction`; `GET /users/invite-codes` → `listInviteCodesFunction`; `GET /users/me` → `readUsersMeFunction`; `PATCH /users/me` → `writeUsersMeFunction`; `POST /users/me/update` → `writeUsersMeFunction`
  - [ ] 5.3 Update `infra/bin/app.ts` (or wherever `AuthRoutesStack` is instantiated) to pass the new per-method function references

- [ ] Task 6: Remove dead combined handler exports from handler files (AC: #5, #17)
  - [ ] 6.1 In `api-keys/handler.ts`: delete the `apiKeysHandler` router function and the `export const handler = wrapHandler(...)` line. Clean up the now-accurate comment on each named export.
  - [ ] 6.2 In `invite-codes/handler.ts`: delete the `inviteCodesHandler` router function and the `export const handler = wrapHandler(...)` line.
  - [ ] 6.3 In `users-me/handler.ts`: delete the `usersMeHandler` router function and the `export const handler = wrapHandler(...)` line. Also delete `buildResourceActions` usage if it was only in the combined handler path (verify it's still used by `handleGet`). **Verify If-Match handling:** `usersMeHandler` currently calls `extractIfMatch` imperatively before routing to `handleUpdate`. After deletion, `writeHandler` wraps `handleUpdate` with `requireVersion: true` — confirm this middleware option correctly extracts the If-Match header. If unsure, add a test for PATCH without If-Match header to verify the middleware handles it.
  - [ ] 6.4 **Check for import side-effects**: After deletions, run `npm run type-check` on each handler file to confirm no unused imports remain.
  - [ ] 6.5 **⚠️ Bundle verification (critical):** After deleting all combined `handler` exports, run `cdk synth` immediately. CDK's esbuild bundles each handler file at synth time — if any `NodejsFunction` still references `handler: "handler"` (from a missed update in Task 5), the synth will fail with a bundle error. This is the last safety net before deploy. Do NOT skip this step.

- [ ] Task 7: Update auth.stack.test.ts (AC: #10)
  - [ ] 7.0 **Pre-mortem: read full test file first** — Read `infra/test/stacks/auth/auth.stack.test.ts` in full. Map every existing assertion to the Lambda function it tests. Identify which assertions reference the now-removed `apiKeysFunction`, `generateInviteFunction`, `usersMeFunction` (by CDK logical ID regex). These must be replaced/split.
  - [ ] 7.1 Add assertions for the new per-method Lambda functions (handler string values: `"createHandler"`, `"listHandler"`, `"revokeHandler"`, `"generateHandler"`, `"readHandler"`, `"writeHandler"`)
  - [ ] 7.2 Add IAM assertions for events table `PutItem` on `createApiKeyFunction`, `revokeApiKeyFunction`, `generateInviteFunction`, `validateInviteFunction`, `writeUsersMeFunction`
  - [ ] 7.3 Add IAM assertions for idempotency table `GetItem/PutItem` — one assertion per function, individually: `createApiKeyFunction`, `revokeApiKeyFunction`, `generateInviteFunction`, `validateInviteFunction`, `writeUsersMeFunction`. A shared assertion covering "any function with the right ARN" is not sufficient — each must be individually verified so a missing grant on any one function produces a test failure (this is the exact gap that allowed Finding 6.2 to slip through previously)
  - [ ] 7.4 Update or remove assertions that reference the removed combined functions
  - [ ] 7.5 Confirm `listApiKeyFunction` and `listInviteCodesFunction` have NO idempotency table or events table grants (read-only paths, no side effects)

- [ ] Task 8: Add validate-invite idempotency replay test (AC: #11)
  - [ ] 8.1 Check if `backend/functions/validate-invite/handler.test.ts` already exists. If so, add to it; otherwise create following the existing test pattern.
  - [ ] 8.2 Write a test that: (a) mocks the DynamoDB client (the established pattern for this codebase — mock `getDefaultClient()` responses) so the first call stores an idempotency record and the second call returns it; (b) calls the handler twice with the same `Idempotency-Key` header; (c) asserts `X-Idempotent-Replayed: true` on the second response. Do NOT attempt to mock the internal `checkIdempotency` function directly — it is not a public export and is not designed to be mocked at that level. Use the same DynamoDB mock pattern as the existing idempotency tests in `@ai-learning-hub/middleware` test files
  - [ ] 8.3 The test should exercise the `validateInviteHandler` export's idempotency path — confirming the middleware is wired correctly

- [ ] Task 9: Fix smoke test AC14 (AC: #12)
  - [ ] 9.1 Open `scripts/smoke-test/scenarios/rate-limiting.ts` and find AC14
  - [ ] 9.2 Change the target endpoint from `GET /users/me` to `POST /users/api-keys` (which uses `apiKeyCreateRateLimit` once the CDK wiring fix lands)
  - [ ] 9.3 Update the skip guard: `SMOKE_TEST_RATE_LIMIT_JWT` should be a JWT with `keys:manage` scope so it can call `POST /users/api-keys`. Update the comment to document this requirement.
  - [ ] 9.4 Update the assertion comment to explain the rate limit is at the Lambda level via `apiKeyCreateRateLimit`, not WAF

- [ ] Task 10: Code quality fixes (AC: #13, #14, #15, #16)
  - [ ] 10.1 **auth.ts stale comments (AC13)**: Replace the file-level "Authentication middleware stubs / Full implementation will come in Epic 2" comment with "Authentication context extraction and scope enforcement middleware for API Gateway Lambda handlers." Remove "This is a stub that will be fully implemented with Clerk in Epic 2" from `extractAuthContext` JSDoc. No code changes.
  - [ ] 10.2 **apiKeyIdPathSchema (AC14)**: Add `export const apiKeyIdPathSchema = z.object({ id: z.string().min(1, "API key ID is required").max(128) })` to `backend/shared/validation/src/schemas.ts`. Export from `backend/shared/validation/src/index.ts`. In `api-keys/handler.ts`, import `apiKeyIdPathSchema` from `@ai-learning-hub/validation` and remove the inline `keyIdPathSchema` declaration.
  - [ ] 10.3 **USERS_TABLE_NAME fallback (AC15)**: In `backend/shared/middleware/src/wrapper.ts`, change `requireEnv("USERS_TABLE_NAME", "ai-learning-hub-users")` to `requireEnv("USERS_TABLE_NAME", "dev-ai-learning-hub-users")`.
  - [ ] 10.4 **buildPaginationLinks (AC16)**: **Before writing any code**, read the FULL `handleList` function body in all three handlers (`api-keys/handler.ts`, `invite-codes/handler.ts`, `saves-list/handler.ts`) and diff them side-by-side. Confirm which query params each includes in the `self` link — `saves-list` may include filter params (e.g., `type`, `status`, `search`) that `api-keys` and `invite-codes` do not. The `queryParams` argument passed to `buildPaginationLinks` must preserve ALL current params for each handler, not just `limit`. Then create `backend/shared/middleware/src/pagination.ts` with the helper, export from middleware barrel, and update all three handlers.
  - [ ] 10.5 Add unit tests for `buildPaginationLinks` in `backend/shared/middleware/src/pagination.test.ts`

- [ ] Task 11: Verify (AC: #18)
  - [ ] 11.1 `npm run type-check` — no TypeScript errors in any touched file
  - [ ] 11.2 `npm test` — all tests pass, no regressions
  - [ ] 11.3 `npm run lint` — no lint errors
  - [ ] 11.4 `cdk synth` — succeeds with no new CDK Nag errors

## Dev Notes

- **Scope:** This story is a production bug fix + code cleanup. No new API endpoints, no new features, no changes to the API contract from a consumer's perspective.
- **Greenfield rule:** Delete the combined handler exports entirely — no backward compatibility shims. The combined `handler` export was dead code in production; removing it makes no behavior worse and activates the correct middleware.
- **Lambda count increase is intentional:** Going from 3 shared Lambda functions to 7 per-method functions matches the SavesRoutesStack pattern. Each function is smaller and correctly scoped. Cold start overhead per-function is the same as before.
- **Execution order for Tasks 1–7:** Complete Tasks 1–5 (CDK restructuring) before Task 7 (CDK tests). This way tests assert the final correct state, not the old wrong state. If you update tests first against the current broken structure, you immediately have to rewrite them.
- **Task 6 (removing combined handler) must happen AFTER Task 5 (CDK rewiring).** If you delete the combined `handler` export before CDK is updated to use named exports, the CDK bundle compilation for `handler: "handler"` will fail with "handler is not a function."
- **CDK only specifies the entry point — middleware options live in the handler file:** When creating per-method `NodejsFunction` instances, CDK's `handler: "createHandler"` simply tells Lambda which exported function to invoke. The middleware options (`idempotent: true`, `rateLimit`, `requiredScope`, `requireVersion`) are already baked into each named export inside the handler file via `wrapHandler(...)`. Do NOT attempt to re-specify or duplicate middleware options in the CDK stack. CDK's only responsibility here is: (1) `handler:` string pointing to the right named export, (2) `environment:` block with correct table names, (3) `addToRolePolicy` grants for every table that function touches. Nothing else.

- **eventsTable IAM pattern (established in codebase):**
  ```typescript
  fn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["dynamodb:PutItem"],
      resources: [eventsTable.tableArn],
    })
  );
  ```
  Events are append-only (PutItem only). No `index/*` ARN needed — PutItem always targets base table.
- **idempotencyTable IAM pattern:**
  ```typescript
  fn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
      resources: [idempotencyTable.tableArn],
    })
  );
  ```
  Idempotency table likely has no GSI, so no `index/*` needed. Verify this by checking `infra/lib/stacks/core/tables.stack.ts` before writing the IAM policy.
- **⚠️ index/* ARN guard (pre-mortem):** `addToRolePolicy` does NOT automatically add index ARNs. Every replacement policy that includes `dynamodb:Query` on a table with GSIs MUST explicitly add `${table.tableArn}/index/*`. Missing index ARN compiles and synths cleanly but causes runtime 403 on any GSI query. Tables with known GSIs: `usersTable` (GSI for email lookup), `inviteCodesTable` (GSI for user listing).
- **`listInviteCodesFunction` IAM note:** `listInviteCodesByUser` queries `inviteCodesTable` (likely via a GSI keyed by userId) AND may query `usersTable` for rate limit counting. Audit the db layer before writing IAM.
- **AuthStack public properties:** Add public `readonly` properties for all new functions (e.g., `readonly createApiKeyFunction: lambda.Function`). Update `app.ts` instantiation to pass the new function references to `AuthRoutesStack`.
- **No new CDK stacks needed:** All changes stay within existing `auth.stack.ts` and `auth-routes.stack.ts`. No new stacks.
- **buildPaginationLinks shape:** Must produce identical output to all three current inline implementations. The helper signature:
  ```typescript
  export function buildPaginationLinks(
    basePath: string,
    queryParams: Record<string, string>,
    nextCursor: string | null
  ): { self: string; next: string | null }
  ```
  Implementation: serialize `queryParams` to `URLSearchParams`, prepend `basePath`, conditionally add `cursor` param to `next`. Verify against all three current implementations before writing to ensure no shape differences.
- **saves-list/handler.ts (Task 10.4):** This file was last touched in the saves domain retrofit (Story 3.2.7). When updating it to use `buildPaginationLinks`, confirm the import from `@ai-learning-hub/middleware` is already present (it uses other middleware helpers). If not, add the import cleanly.
- **apiKeyIdPathSchema validation message:** Preserve the exact validation message `"API key ID is required"` from the inline schema. `saveIdPathSchema` in the shared validation package uses a similar pattern — follow the same style.
- **PR review note:** IAM changes (Tasks 1–4) are the highest-risk part. Review CDK IAM policies as a dedicated pass separate from the code quality tasks (10.1–10.4). A wrong IAM grant is silent at test time (mocked AWS), only detectable in deploy.

### Project Structure Notes

- **CDK stacks:** `infra/lib/stacks/auth/auth.stack.ts`, `infra/lib/stacks/api/auth-routes.stack.ts`. CDK app entry: `infra/bin/app.ts`.
- **Handler files:** `backend/functions/api-keys/handler.ts`, `backend/functions/invite-codes/handler.ts`, `backend/functions/users-me/handler.ts`, `backend/functions/validate-invite/handler.ts`.
- **Shared packages:** `backend/shared/middleware/src/`, `backend/shared/validation/src/`.
- **Smoke test:** `scripts/smoke-test/scenarios/rate-limiting.ts`.
- **Existing CDK test pattern:** `infra/test/stacks/auth/auth.stack.test.ts` — use CDK logical ID regex `Match.stringLikeRegexp(...)` to scope per-function IAM assertions.
- **infra/ is ESCALATE per workspace rules** — this story explicitly scopes changes to the files listed in `touches`. No new stacks or top-level constructs outside auth domain.

### References

- [Source: docs/progress/epic-2-code-review-findings.md#Finding 1.1] — Root cause: named handlers dead; combined handlers lack idempotency and rate limiting → AC1–AC6
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 2.1] — Scope enforcement: combined handlers apply blanket scope → AC1–AC6
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 6.1] — Missing PutItem on eventsTable for 4 functions → AC7
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 6.2] — validateInviteFunction missing idempotencyTable IAM → AC8
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 7.2] — No idempotency replay test for validate-invite → AC11
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 7.3/6.3] — AC14 targets unrate-limited endpoint → AC12
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 2.2] — Stale stub comments in auth.ts → AC13
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 2.3] — keyIdPathSchema inline → AC14
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 3.2] — USERS_TABLE_NAME fallback inconsistent → AC15
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 4.1] — Pagination link-building duplicated → AC16
- [Source: docs/progress/epic-2-code-review-findings.md#Finding 5.2/6.4] — False CDK wiring comments → AC17
- [Source: backend/functions/api-keys/handler.ts] — Named exports with correct middleware already exist (from Story 3.2.8)
- [Source: infra/lib/stacks/api/auth-routes.stack.ts] — CDK still wires `LambdaIntegration(apiKeysFunction)` using combined handler
- [Source: infra/lib/stacks/auth/auth.stack.ts#lines 460–540] — Current `apiKeysFunction` IAM (missing eventsTable/idempotencyTable grants)
- [Source: infra/lib/stacks/api/saves-routes.stack.ts] — Reference for per-operation Lambda function pattern

### Deferred Findings (not in scope for this story)

- **Finding 1.2** (JWT auth deduplication across authorizers) — medium complexity refactor; better addressed in a dedicated middleware consolidation story or as part of a future Epic 3.5 story.
- **Finding 3.1** (rate limit configs in wrong package) — blocked by barrel import constraint documented in Finding 5.1. Schedule after the barrel import issue is resolved.
- **Finding 5.1** (Lambda env vars for tables they don't use) — blocked by `@ai-learning-hub/db` barrel import triggering `requireEnv()` at module load time.
- **Finding 5.3** (CI runs lint twice) — CI YAML change; separate PR scope, does not affect runtime behavior.
- **Finding 7.1** (smoke test events table DynamoDB audit) — requires read-only AWS SDK access and IAM role for the smoke test runner. Infrastructure concern scheduled separately.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
