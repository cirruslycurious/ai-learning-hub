# Adversarial Architecture & Code Quality Review

**Date:** 2026-02-20
**Scope:** Full monorepo (`backend/`, `infra/`, `frontend/`, `shared/`)
**Reviewer:** Claude Opus 4.6 (adversarial review mode)
**Codebase snapshot:** commit `a60ac03` (branch `main`)

---

## Files Reviewed

- **Backend handlers:** 6 Lambda handlers in `backend/functions/`
- **Shared packages:** 5 packages in `backend/shared/` (db, logging, middleware, types, validation)
- **CDK stacks:** 7 stacks in `infra/lib/stacks/`, 2 config files, `bin/app.ts`
- **Tests:** 4 architecture enforcement suites (T1-T4), 6 handler test suites, 2 test utility suites, 14+ infra tests
- **Frontend:** All source files in `frontend/src/`, config, and tests
- **Total:** ~80 files across ~12,000 lines

---

## Findings

### [CRITICAL] F1: Architecture enforcement tests cannot detect wrong-handler wiring

**File:** `infra/test/architecture-enforcement/route-completeness.test.ts` (AC5, lines 108-127)
**File:** `infra/test/architecture-enforcement/lambda-route-wiring.test.ts` (AC9, lines 51-66)

**Issue:** The T2 and T4 architecture enforcement tests verify that each route registry entry has _some_ Lambda integration, but never verify it is the _correct_ Lambda. If `/users/me` were accidentally wired to `apiKeysFunction` instead of `usersMeFunction`, all four test suites (T1-T4) would pass. T4 AC9 uses an extremely weak substring check (`uriStr.includes("lambda") || uriStr.includes("Function")`) — any stringified URI containing "lambda" anywhere passes, regardless of whether it resolves to a real or correct function.

**Fix:** Add a test that, for each route in `ROUTE_REGISTRY`, resolves the `handlerRef` to the expected Lambda logical ID in the CDK template, then verifies the Method's `Integration.Uri` references that specific Lambda's ARN (not just any Lambda). This can be done by building a `handlerRef → Lambda logicalId` map from the template's `AWS::Lambda::Function` resources and cross-referencing against each Method's integration URI.

---

### [CRITICAL] F2: No typed API client or centralized auth flow in frontend

**File:** `frontend/src/App.tsx` (entire file — scaffold only)

**Issue:** The frontend has zero API integration code, zero Clerk auth setup, and zero shared type imports. As Epic 3 (Saves) adds frontend features, the absence of these foundations will force each component to independently implement `fetch()` calls with inline URLs, manual `Authorization` header injection, ad-hoc error parsing, and `any`-typed responses. The backend already exports well-defined types (`ApiSuccessResponse<T>`, `ApiErrorResponse`, `ErrorCode` enum) and the smoke test demonstrates a working centralized client pattern — but nothing bridges this to the frontend build.

**Fix:** Before Epic 3 frontend work begins:

1. Create `frontend/src/api/client.ts` — centralized API client (adapt from `scripts/smoke-test/client.ts`)
2. Create `frontend/src/api/hooks.ts` — `useApiClient()` hook that injects Clerk JWT automatically
3. Configure `frontend/tsconfig.json` or Vite aliases so `@ai-learning-hub/types` is importable
4. Create `frontend/.env.example` with `VITE_API_URL`

---

### [HIGH] F3: T2 AC6 / T4 AC10 orphan detection uses unreliable cardinality comparison

**File:** `infra/test/architecture-enforcement/route-completeness.test.ts` (lines 165-168)
**File:** `infra/test/architecture-enforcement/lambda-route-wiring.test.ts` (lines 116-125)

**Issue:** Both T2-AC6 and T4-AC10 detect "orphan" Lambdas by comparing `integratedArns.size >= handlerRefs.size`. This counts unique serialized URI strings, not actual Lambda ARNs. If two routes share one Lambda (e.g., `apiKeysFunction` handles both `/users/api-keys` and `/users/api-keys/{id}`), they share one URI — but the test counts it as one. Meanwhile if CDK generates slightly different URI serializations for the same Lambda on different methods, it could be over-counted. The comparison is a loose approximation, not a definitive check.

**Fix:** Parse each Method's integration URI to extract the Lambda function ARN reference (via `Fn::GetAtt` or `Fn::Join`), build a `handlerRef → Lambda ARN` mapping from CDK template resources, and verify every handler ref appears in at least one method's integration.

---

### [HIGH] F4: Wrapper does not log incoming request method or path

**File:** `backend/shared/middleware/src/wrapper.ts` (lines 95-177)

**Issue:** The `wrapHandler` middleware logs the completion of each request with `statusCode` (line 165-167) and creates a logger with `requestId` and `traceId` (lines 104-107), but never logs the HTTP method or resource path at request entry. When debugging operational issues via CloudWatch, you can see _that_ a request completed with a status code, but not _which endpoint_ was called without cross-referencing X-Ray traces. This becomes more important as the number of handlers grows in Epic 3+.

**Fix:** Add a request-entry log line after the logger is created:

```typescript
logger.info("Request received", {
  method: event.httpMethod,
  path: event.path,
  queryParams: Object.keys(event.queryStringParameters ?? {}),
});
```

---

### [HIGH] F5: Gateway Response status codes not validated by T1

**File:** `infra/test/architecture-enforcement/api-gateway-contract.test.ts` (AC2)

**Issue:** T1 AC2 validates that API Gateway's `GatewayResponse` templates contain `error.code` and `error.message` fields in the JSON body, but does NOT validate that the response's HTTP `StatusCode` matches the `ErrorCodeToStatus` mapping. A THROTTLED response could incorrectly return status 400 instead of 429, and this test would pass. Clients relying on status codes for backoff logic (429 → retry with Retry-After) would misbehave.

**Fix:** Enhance AC2 to extract the `StatusCode` property from each `AWS::ApiGateway::GatewayResponse` resource and verify it matches the expected HTTP status code for that response type (e.g., THROTTLED → 429, UNAUTHORIZED → 401).

---

### [MEDIUM] F6: Middleware declares unused `@ai-learning-hub/validation` dependency

**File:** `backend/shared/middleware/package.json` (line 22)

**Issue:** `@ai-learning-hub/validation` is listed as a runtime dependency but is never imported in any middleware source file. This adds unnecessary weight to Lambda bundles (if not tree-shaken), confuses the dependency graph, and suggests either an incomplete refactor or a premature dependency declaration.

**Fix:** Remove `"@ai-learning-hub/validation": "*"` from the `dependencies` section.

---

### [MEDIUM] F7: DynamoDB table names lack environment prefix

**File:** `infra/lib/stacks/core/tables.stack.ts`

**Issue:** All DynamoDB table names are hardcoded as `ai-learning-hub-users`, `ai-learning-hub-saves`, etc. without an environment prefix (e.g., `-dev`, `-staging`, `-prod`). This prevents deploying multiple environments to the same AWS account. The code includes a TODO comment acknowledging this, but it is not yet implemented.

**Fix:** Accept an `environmentPrefix` parameter in `TablesStack` and prepend it to all table names. Pass the prefix from `bin/app.ts` based on the deployment environment. This should be done before any multi-environment deployment story.

---

### [MEDIUM] F8: No handler tests verify rate-limit-before-action ordering

**File:** `backend/functions/api-keys/handler.test.ts`, `backend/functions/invite-codes/handler.test.ts`, `backend/functions/validate-invite/handler.test.ts`

**Issue:** Several handlers call `enforceRateLimit()` before the business operation (e.g., `createApiKey`, `createInviteCode`). Tests verify both functions are called, but don't verify the ordering. If a future refactor accidentally moves the rate limit check after the write, tests would still pass, allowing rate-limited users to perform the action before being blocked.

**Fix:** Track mock call order using a shared counter or ordered array:

```typescript
const callOrder: string[] = [];
mockEnforceRateLimit.mockImplementation(async () => {
  callOrder.push("rateLimit");
});
mockCreateApiKey.mockImplementation(async () => {
  callOrder.push("create");
  return result;
});
await handler(event, context);
expect(callOrder).toEqual(["rateLimit", "create"]);
```

---

### [MEDIUM] F9: No scope enforcement tests in handler test suites

**File:** `backend/functions/api-keys/handler.test.ts`, `backend/functions/invite-codes/handler.test.ts`

**Issue:** The `wrapHandler` middleware supports `requiredScope` enforcement for API key auth, and the mock middleware properly simulates it. However, none of the handler test suites test that a request with insufficient API key scopes returns `SCOPE_INSUFFICIENT` (403). If a handler omits the `requiredScope` option from its `wrapHandler` call, no test would catch it.

**Fix:** Add scope enforcement tests to handlers that should require specific scopes:

```typescript
it("returns 403 when API key lacks required scope", async () => {
  const event = createMockEvent({
    authMethod: "api-key",
    scopes: ["saves:read"],
  });
  const result = await handler(event, mockContext);
  assertADR008Error(result, "SCOPE_INSUFFICIENT", 403);
});
```

---

### [MEDIUM] F10: Frontend TypeScript config cannot resolve shared backend types

**File:** `frontend/tsconfig.json`

**Issue:** While `tsconfig.base.json` defines path aliases for `@ai-learning-hub/types` pointing to backend `.ts` source files, the frontend (built with Vite) cannot use these aliases because: (a) the backend packages are not compiled to frontend-compatible output, and (b) Vite needs explicit `resolve.alias` configuration. This means the frontend currently cannot import shared types from the backend without copying them.

**Fix:** Either (a) configure Vite aliases in `vite.config.ts` to resolve `@ai-learning-hub/types` to the source files, or (b) publish shared types as a workspace package the frontend can consume, or (c) use TypeScript project references.

---

### [LOW] F11: Authorizer handlers use `grantReadWriteData` when narrower grants would suffice

**File:** `infra/lib/stacks/auth/auth.stack.ts` (lines 37-115, 131-190)

**Issue:** The JWT and API Key authorizer Lambdas receive `grantReadWriteData` on the users table, which grants 7 DynamoDB actions including `Scan`, `BatchGetItem`, and `BatchWriteItem`. Authorizers only need `GetItem`, `PutItem` (for `ensureProfile`), `UpdateItem` (for `lastUsedAt`), and `Query` (for GSI lookup). The extra actions are unnecessary.

**Fix:** Replace `grantReadWriteData` with explicit `addToRolePolicy` statements scoping to only the required actions. This is a defense-in-depth measure — not urgent, but aligns with least-privilege principles.

---

### [LOW] F12: API Gateway stage name hardcoded to "dev"

**File:** `infra/lib/stacks/api/api-gateway.stack.ts`

**Issue:** The `stageName` for the REST API deployment is hardcoded to `"dev"`. While appropriate for the current single-environment setup, this will need parameterization when staging/prod environments are introduced.

**Fix:** Accept `stageName` as a stack property, defaulting to `"dev"`.

---

### [HIGH] F13: `METHOD_NOT_ALLOWED` error code not in `ErrorCode` enum (ADR-008 contract gap)

**File:** `backend/functions/api-keys/handler.ts` (line 133), `backend/functions/invite-codes/handler.ts` (line 105), `backend/functions/users-me/handler.ts` (line 90)
**File:** `backend/shared/types/src/errors.ts` (lines 4-27 — `ErrorCode` enum)

**Issue:** Three handlers return 405 responses with `code: "METHOD_NOT_ALLOWED"`, but this string literal is not a member of the `ErrorCode` enum. The responses are hand-built JSON objects that bypass `createErrorResponse`, so they don't go through the ADR-008 normalization path. `assertADR008Error` would reject these responses because it validates the `code` field against the enum. This means 405 error responses are technically non-compliant with ADR-008, and any client-side error handling keyed to `ErrorCode` values will fail to match.

**Fix:** Add `METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"` to the `ErrorCode` enum and `[ErrorCode.METHOD_NOT_ALLOWED]: 405` to `ErrorCodeToStatus`. Then replace the hand-built 405 JSON in each handler with `throw new AppError(ErrorCode.METHOD_NOT_ALLOWED, ...)` and let `wrapHandler` handle the response formatting.

---

### [MEDIUM] F14: DB config silently falls back to hardcoded table names

**File:** `backend/shared/db/src/users.ts` (line 19)
**File:** `backend/shared/db/src/invite-codes.ts` (lines 22-23)

**Issue:** Table configs use `process.env.USERS_TABLE_NAME ?? "ai-learning-hub-users"` and `process.env.INVITE_CODES_TABLE_NAME ?? "ai-learning-hub-invite-codes"`. If a Lambda is deployed without the env var (CDK misconfiguration, local testing mistake), it silently targets the fallback table name instead of failing fast. In a multi-environment setup, this could cause a Lambda in one environment to read/write data in another environment's table.

**Fix:** Remove the fallback values and fail fast on missing env vars:

```typescript
const tableName = process.env.USERS_TABLE_NAME;
if (!tableName)
  throw new Error("USERS_TABLE_NAME environment variable is required");
```

Alternatively, keep fallbacks but only when `NODE_ENV === "test"`.

---

### [MEDIUM] F15: Type model drift between `@ai-learning-hub/types` and `@ai-learning-hub/db`

**File:** `backend/shared/types/src/entities.ts` (lines 155-156 — `InviteCode.createdBy`, `InviteCode.usedBy`)
**File:** `backend/shared/db/src/invite-codes.ts` (lines 36-38 — `InviteCodeItem.generatedBy`, `InviteCodeItem.redeemedBy`)

**Issue:** The shared types package defines `InviteCode` with fields `createdBy` and `usedBy`, while the DB package's `InviteCodeItem` uses `generatedBy` and `redeemedBy` for the same concepts. Any consumer of `@ai-learning-hub/types` would expect `createdBy` but the actual DynamoDB items use `generatedBy`. This drift means the shared entity type does not accurately describe the stored data shape, and mapping code would silently produce undefined values.

**Fix:** Align the naming. Either rename the DB fields to match the types package (`createdBy`/`usedBy`), or update the types package to match the DB (`generatedBy`/`redeemedBy`). Given that the DB is the source of truth for stored data, updating `entities.ts` to use `generatedBy`/`redeemedBy` is likely the lower-risk change. Add a test that asserts field name alignment between the two packages.

---

## What's Working Well (not exhaustive — these are deliberately brief)

- Zero `console.log` calls in any handler — structured logging used everywhere
- Zero `any` types in production code (shared packages + handlers + CDK stacks)
- All handlers wrapped with `wrapHandler` — no naked Lambda exports
- ADR-008 error format enforced consistently through `handleError` + `createErrorResponse`
- `assertADR008Error` test utility is comprehensive and thoroughly tested (47 tests)
- Route registry is a genuine single source of truth with typed `HandlerRef` union
- No direct `@aws-sdk/*` imports in any handler — all DynamoDB access via `@ai-learning-hub/db`
- No Lambda-to-Lambda calls anywhere in the codebase
- Cross-stack dependencies properly managed (ARN strings, not construct references)
- Shared package dependency graph is acyclic: `types → logging → middleware`, `types → db`, `types → validation`

---

## Structural Soundness Score: 7 / 10

The backend is architecturally disciplined — shared libraries are used consistently, error handling follows ADR-008 in most paths, no `console.log` calls, no `any` types in production code, no hardcoded secrets, and the route registry + enforcement test pattern is a genuine strength. The CDK infrastructure is well-structured with proper stack isolation, least-privilege IAM (with minor exceptions), and documented deployment order. However, the architecture enforcement tests have a critical blind spot (wrong-handler wiring goes undetected), the 405 error responses bypass the ADR-008 contract (F13), the DB layer silently falls back to hardcoded table names (F14), there is naming drift between the types and DB packages (F15), the frontend is a blank slate that will accumulate debt rapidly without API client foundations, and several test suites miss important edge cases (ordering, scope enforcement). The codebase is solid for Epic 2 scope but has gaps that will compound as Epics 3-5 add saves, search, and async pipelines.

---

## Top 3 Priorities

### 1. Fix architecture enforcement test blind spot (F1, F3, F5)

The T1-T4 tests are the project's primary defense against CDK misconfiguration. Today they verify _presence_ of wiring but not _correctness_. As Epic 3 adds 3-5 new Lambdas and route stacks, a single mis-wiring (route pointing to wrong handler) would silently ship to production. Enhance tests to verify handler identity, not just handler existence.

### 2. Establish frontend API client and auth foundations before Epic 3 (F2, F10)

Epic 3 (Saves) will be the first story requiring real frontend-to-backend integration. Without a centralized API client, typed responses, and auth token management, each component will independently implement fetch logic. The cost of retrofitting 10+ components later is far higher than establishing the pattern once now. The smoke test's `SmokeClient` class provides a proven starting pattern.

### 3. Add request-entry logging to the wrapper (F4)

As the number of Lambda handlers grows from 6 to 15+, operational debugging becomes harder without knowing which endpoint was called. Adding method/path logging to `wrapHandler` is a one-line change that pays dividends across every handler immediately. This should ship before Epic 3's new handlers are deployed.
