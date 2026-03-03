---
id: "3.2.9"
title: "Health, Readiness & Batch Operations"
status: ready-for-dev
depends_on:
  - "3.2.1"
  - "3.2.2"
touches:
  - backend/functions/health/handler.ts
  - backend/functions/health/handler.test.ts
  - backend/functions/readiness/handler.ts
  - backend/functions/readiness/handler.test.ts
  - backend/functions/batch/handler.ts
  - backend/functions/batch/handler.test.ts
  - backend/functions/batch/schemas.ts
  - backend/shared/types/src/api.ts
  - backend/shared/middleware/src/action-registrations.ts
  - infra/config/route-registry.ts
  - infra/lib/stacks/api/ops-routes.stack.ts
  - infra/bin/app.ts
risk: medium
---

# Story 3.2.9: Health, Readiness & Batch Operations

Status: ready-for-dev

## Story

As an **AI agent interacting with the API**,
I want **health, readiness, and batch operation endpoints**,
so that **I can pre-flight check service availability before starting multi-step workflows, verify downstream dependencies are ready, and execute multiple commands in a single request to reduce round-trips**.

## Acceptance Criteria

1. **AC1: Health endpoint returns service availability** — `GET /health` returns `200` with `{ data: { status: "healthy", timestamp, version } }` wrapped in the standard response envelope. The endpoint does no downstream dependency checks — it confirms the Lambda is reachable and the API Gateway is routing correctly. Response includes `links.self: "/health"`.

2. **AC2: Health endpoint requires no authentication** — `GET /health` is publicly accessible (no JWT or API key required). The CDK route uses a new `"none"` auth type in the route registry, and the API Gateway method has `AuthorizationType.NONE`. The `wrapHandler` call uses `requireAuth: false`.

3. **AC3: Readiness endpoint checks downstream dependencies** — `GET /ready` returns `200` with `{ data: { ready: true, timestamp, dependencies: { dynamodb: "ok" } } }` when all dependencies are reachable. Uses a lightweight DynamoDB `GetItem` on a non-existent key (`PK=HEALTHCHECK, SK=PROBE`) against `USERS_TABLE_NAME` to verify data-plane connectivity and IAM permissions. The result is cached in-memory for 10 seconds to avoid hammering DynamoDB on rapid probes. Response includes `links.self: "/ready"`.

4. **AC4: Readiness reports degraded state** — When a dependency check fails (DynamoDB unreachable or timeout >3s), `GET /ready` returns `503` with `{ data: { ready: false, timestamp, dependencies: { dynamodb: "unhealthy" } } }`. The handler catches DynamoDB errors and returns structured degraded status rather than throwing.

5. **AC5: Readiness endpoint requires no authentication** — `GET /ready` uses `"none"` auth type, same as `/health`. Allows agents to verify service readiness before authenticating.

6. **AC6: Batch endpoint accepts operation array** — `POST /batch` accepts `{ operations: [...] }` where each operation is `{ method: "POST"|"PATCH"|"DELETE", path: string, body?: object, headers?: object }`. Maximum 25 operations per request (validated by Zod schema). Returns 400 `VALIDATION_ERROR` if array exceeds 25, is empty, or contains an operation targeting `/batch` (recursive batch prevention). All `Idempotency-Key` values across operations must be unique — duplicates return 400.

7. **AC7: Per-operation idempotency keys** — Each batch operation includes its own `Idempotency-Key` in the operation's `headers` object. Operations missing an `Idempotency-Key` receive a per-operation 400 error in the results array. Duplicate `Idempotency-Key` values across operations in the same batch are rejected with 400 at the batch level (before execution). The batch endpoint itself also requires a top-level `Idempotency-Key` header for the batch request envelope.

8. **AC8: Per-operation results** — Response is `{ data: { results: [...], summary: { total, succeeded, failed } }, meta, links }`. Each result includes `{ operationIndex: number, statusCode: number, data?: object, error?: object }`. Results are ordered by `operationIndex` matching input order.

9. **AC9: Batch is non-transactional** — Partial success is reported per-operation. If operation 3 of 5 fails, operations 1-2 and 4-5 still execute. Each operation is independent. The `summary.failed > 0` flag signals partial failure to the agent.

10. **AC10: Batch routes operations via HTTP loopback** — The batch handler executes each operation by making an HTTP request to the API Gateway URL (passed as `API_BASE_URL` environment variable). The original request's `Authorization` header is forwarded to each sub-operation. This reuses the full middleware chain (auth, idempotency, rate limiting, scopes) for each sub-operation without importing handler code.

11. **AC11: Batch operation timeout** — Each individual operation within the batch has a 4-second timeout. If an operation times out, its result is `{ statusCode: 504, error: { code: "OPERATION_TIMEOUT", message: "..." } }`. The batch Lambda itself has a 30-second timeout (CDK configuration).

12. **AC12: Batch requires authentication, scope, and rate limiting** — `POST /batch` uses `"jwt-or-apikey"` auth type with `requiredScope: "batch:execute"`. The `batch:execute` scope is added to the `full`/`*` tier in the scope resolver. Capture-only and read-only keys cannot execute batch operations. The batch endpoint has its own rate limit: 60 requests/user/hour (prevents concurrency amplification abuse — each batch request can fan out to 25 sub-operations).

13. **AC13: Batch uses idempotency** — The batch handler uses `idempotent: true` in `wrapHandler` options. The top-level `Idempotency-Key` caches the entire batch response. Retrying the same batch request replays the cached response without re-executing sub-operations.

14. **AC14: Route registry entries** — Three new entries in `ROUTE_REGISTRY`: `GET /health` (authType: `"none"`), `GET /ready` (authType: `"none"`), `POST /batch` (authType: `"jwt-or-apikey"`). The `HandlerRef` union is extended with `"healthFunction"`, `"readinessFunction"`, `"batchFunction"`. The `AuthType` union is extended with `"none"`.

15. **AC15: CDK infrastructure wiring** — A new `OpsRoutesStack` creates three Lambda functions and wires them to API Gateway. Health and readiness Lambdas get `USERS_TABLE_NAME` (readiness only needs one table for the check). The batch Lambda gets `API_BASE_URL`, `IDEMPOTENCY_TABLE_NAME`, and `USERS_TABLE_NAME` environment variables. Health/readiness methods use `AuthorizationType.NONE` with method-level throttling (100 req/s burst, 50 req/s sustained) to prevent abuse of unauthenticated endpoints. Batch method uses the shared authorizer. `ApiDeploymentStack` depends on `OpsRoutesStack`.

16. **AC16: Action registration for batch** — The `POST /batch` action is registered in `action-registrations.ts` with action ID `"batch:execute"`, description, HTTP method, URL pattern, input schema (operations array), required headers (`Idempotency-Key`), required scope (`batch:execute`), and expected error codes.

17. **AC17: Unit test coverage** — All three handlers have tests covering: health returns 200 with correct shape, readiness returns 200 when healthy and 503 when degraded, batch validates input schema, batch returns per-operation results, batch handles partial failure, batch enforces 25-operation limit, idempotency on batch, timeout handling. Minimum 80% line coverage per handler.

## Tasks / Subtasks

**Task ordering:** Tasks 1-2 (shared types + auth type) must complete first. Tasks 3-5 (health, readiness, batch handlers) can run in parallel. Task 6 (CDK wiring) can run in parallel with handlers since tests mock infrastructure. Task 7 (action registration) can run in parallel. Task 8 (final validation) runs last.

- [ ] Task 1: Shared types and schemas (AC: 1, 3, 6, 8)
  - [ ] 1.1 Add `HealthStatus`, `ReadinessStatus`, `BatchOperation`, `BatchOperationResult`, `BatchResponse` types to `backend/shared/types/src/api.ts`
  - [ ] 1.2 Create `backend/functions/batch/schemas.ts` with Zod schemas: `batchOperationSchema` (method enum, path string with `.refine()` rejecting `/batch` to prevent recursion, optional body/headers), `batchRequestSchema` (operations array, min 1, max 25, with `.superRefine()` validating unique `Idempotency-Key` values across all operations)
  - [ ] 1.3 Export new types from `backend/shared/types/src/index.ts` if needed

- [ ] Task 2: Extend route registry auth type (AC: 2, 5, 14)
  - [ ] 2.1 Add `"none"` to `AuthType` union in `infra/config/route-registry.ts`
  - [ ] 2.2 Add `"healthFunction"`, `"readinessFunction"`, `"batchFunction"` to `HandlerRef` union
  - [ ] 2.3 Add three route entries to `ROUTE_REGISTRY`
  - [ ] 2.4 Add `batch:execute` to the `full`/`*` tier in scope resolver (`backend/shared/middleware/src/scope-resolver.ts`)

- [ ] Task 3: Health handler (AC: 1, 2)
  - [ ] 3.1 Create `backend/functions/health/handler.ts` — simple handler returning `{ status: "healthy", timestamp, version: "1.0.0" }` via `createSuccessResponse`
  - [ ] 3.2 Use `wrapHandler` with `requireAuth: false`
  - [ ] 3.3 Create `backend/functions/health/handler.test.ts` — test 200 response shape, timestamp format, links.self

- [ ] Task 4: Readiness handler (AC: 3, 4, 5)
  - [ ] 4.1 Create `backend/functions/readiness/handler.ts` — checks DynamoDB data-plane connectivity via `GetCommand` on non-existent key (`PK=HEALTHCHECK, SK=PROBE`) against `USERS_TABLE_NAME`
  - [ ] 4.2 Cache the check result in module-scoped variable with 10-second TTL (reuse across rapid probes within same Lambda invocation)
  - [ ] 4.3 Return 200 with `{ ready: true, dependencies: { dynamodb: "ok" } }` on success
  - [ ] 4.4 Return 503 with `{ ready: false, dependencies: { dynamodb: "unhealthy" } }` on failure (catch errors, don't throw)
  - [ ] 4.5 Set 3-second timeout on the DynamoDB check using `AbortController`
  - [ ] 4.6 Use `wrapHandler` with `requireAuth: false`
  - [ ] 4.7 Create `backend/functions/readiness/handler.test.ts` — test healthy path, DynamoDB failure path, timeout path, cache hit path

- [ ] Task 5: Batch handler (AC: 6, 7, 8, 9, 10, 11, 12, 13)
  - [ ] 5.1 Create `backend/functions/batch/handler.ts` — fail-fast guard at module scope: throw if `API_BASE_URL` env var is missing. Validates request body against `batchRequestSchema`
  - [ ] 5.2 For each operation: construct HTTP request to `API_BASE_URL + operation.path`, forward `Authorization` header from original request, set operation's `Idempotency-Key` and other headers, set 4-second timeout per operation
  - [ ] 5.3 Use `Promise.allSettled()` for concurrent operation execution (all 25 can run in parallel)
  - [ ] 5.4 Map results to `{ operationIndex, statusCode, data?, error? }` shape
  - [ ] 5.5 Build summary: `{ total, succeeded, failed }` from results
  - [ ] 5.6 Use `wrapHandler` with `requireAuth: true`, `idempotent: true`, `requiredScope: "batch:execute"`, `rateLimit: { operation: "batch-execute", windowSeconds: 3600, limit: 60 }`
  - [ ] 5.7 Validate each operation has `Idempotency-Key` in its headers; return per-operation 400 if missing
  - [ ] 5.8 Create `backend/functions/batch/handler.test.ts` — test input validation, per-operation results, partial failure, timeout handling, idempotency replay, scope enforcement, 25-op limit, recursive `/batch` rejection, duplicate idempotency key rejection, missing `API_BASE_URL` throws at init

- [ ] Task 6: CDK wiring (AC: 15)
  - [ ] 6.1 Create `infra/lib/stacks/api/ops-routes.stack.ts` with three Lambda functions
  - [ ] 6.2 Health Lambda: minimal env vars, 256MB, 10s timeout
  - [ ] 6.3 Readiness Lambda: `USERS_TABLE_NAME` env var, `usersTable.grantReadData()`, 256MB, 10s timeout
  - [ ] 6.4 Batch Lambda: `API_BASE_URL`, `IDEMPOTENCY_TABLE_NAME`, `USERS_TABLE_NAME` env vars, `idempotencyTable.grantReadWriteData()`, `usersTable.grantReadData()` (for rate limiting), 512MB, 30s timeout
  - [ ] 6.5 Wire health/readiness routes with `AuthorizationType.NONE` (no authorizer) and method-level throttling (`throttle: { burstLimit: 100, rateLimit: 50 }`)
  - [ ] 6.6 Wire batch route with shared authorizer
  - [ ] 6.7 Add `OpsRoutesStack` to `infra/bin/app.ts` — depends on `apiGatewayStack`, `ApiDeploymentStack` depends on it
  - [ ] 6.8 Add CORS preflight for `/batch` with `Idempotency-Key` in allowed headers

- [ ] Task 7: Action registration (AC: 16)
  - [ ] 7.1 Register `batch:execute` action in `backend/shared/middleware/src/action-registrations.ts`
  - [ ] 7.2 Write/update action registration tests

- [ ] Task 8: Final validation (AC: 17)
  - [ ] 8.1 Run `npm test` — all tests pass
  - [ ] 8.2 Run `npm run lint` — no lint errors
  - [ ] 8.3 Verify 80%+ coverage on all three handlers
  - [ ] 8.4 Run `npm run build` — clean build
  - [ ] 8.5 Run `cd infra && npm run build && npx cdk synth` — CDK synth succeeds

## Dev Notes

### Architecture Patterns & Constraints

- **Follow existing handler patterns.** `backend/functions/actions-catalog/handler.ts` is the reference for simple GET handlers (health, readiness). The batch handler is more complex but follows the same `wrapHandler` + `createSuccessResponse` pattern.
- **Greenfield rules apply:** Delete old patterns entirely — no compatibility shims. There are zero users and zero live environments.
- **No Lambda-to-Lambda calls.** The batch handler uses HTTP loopback through API Gateway (`fetch()` to `API_BASE_URL + path`), which is architecturally clean — each sub-operation goes through the full middleware chain (auth, idempotency, rate limiting, scopes).
- **Health/readiness are unauthenticated.** This is a new pattern — the existing `AuthType` union needs `"none"` added, and CDK route wiring must use `AuthorizationType.NONE` from `aws-cdk-lib/aws-apigateway` instead of the shared authorizer. Apply method-level throttling (100 burst, 50 sustained) on these routes to prevent abuse since WAF/user-level rate limiting won't apply without a userId.
- **Agent identity is always-on via wrapHandler** for authenticated endpoints (batch). Health/readiness use `requireAuth: false`, so `ctx.auth` will be null.

### Batch Handler Design

The batch handler is the most complex piece. Key design decisions:

**HTTP Loopback Pattern:**
```
Client → POST /batch → Batch Lambda
  ├── fetch(API_BASE_URL + "/saves", { method: "POST", ... }) → API GW → Authorizer → Saves Lambda
  ├── fetch(API_BASE_URL + "/saves/abc/update-metadata", ...) → API GW → Authorizer → Saves Update Lambda
  └── fetch(API_BASE_URL + "/users/me/update", ...) → API GW → Authorizer → Users-Me Lambda
```

- **Why HTTP loopback:** Reuses all middleware (auth, idempotency, rate limiting, scopes) without importing handler code. Each sub-operation is fully isolated. No Lambda-to-Lambda coupling.
- **Fail-fast on missing config:** The batch handler must validate `API_BASE_URL` at module scope (outside the handler function). If undefined, throw immediately on cold start — don't wait for the first request to discover the misconfiguration.
- **Recursive batch prevention:** The Zod schema rejects operations with `path: "/batch"` to prevent infinite recursion. Without this guard, an agent could construct a batch containing a batch call, causing a loop until Lambda timeout.
- **Duplicate idempotency key prevention:** The Zod schema validates that all `Idempotency-Key` values across operations are unique. Duplicate keys could cause one operation to replay another's cached result from the idempotency store.
- **Auth forwarding:** The batch handler extracts the `Authorization` header from the incoming request and forwards it to each sub-operation. The same JWT/API key authenticates all sub-operations. **Important:** API Gateway lowercases all header names in the proxy event — use case-insensitive lookup (e.g., `event.headers["authorization"]` not `event.headers["Authorization"]`).
- **Concurrency:** Use `Promise.allSettled()` to execute all operations concurrently. Up to 25 parallel HTTP requests to API Gateway. API Gateway handles the concurrency internally.
- **Timeout:** Each sub-operation gets a 4-second timeout (via `AbortController`). The batch Lambda itself has a 30-second timeout. This leaves headroom for 25 sequential operations if needed, though parallel execution should complete much faster.
- **Node.js `fetch()`:** Available natively in Node.js 18+ (Lambda runtime). No external HTTP library needed.
- **Rate limiting interaction:** Each sub-operation goes through rate limiting independently. A batch of 25 API key creations would count as 25 against the rate limit. This is correct behavior — batch doesn't bypass rate limits.
- **Batch-level rate limit:** The batch endpoint itself is rate-limited at 60 requests/user/hour. This prevents concurrency amplification abuse — without it, an agent could send unlimited batch requests, each fanning out to 25 sub-operations.
- **Authorizer cache dependency:** API Gateway caches authorizer results (verify the TTL is non-zero in `AuthStack`). With caching, the 25 parallel sub-operations should hit the authorizer Lambda only once. If the cache TTL is 0, all 25 sub-operations invoke the authorizer independently — verify and document this.
- **NFR-AN5 (5-second batch completion):** With HTTP loopback, each sub-operation incurs ~50-150ms API Gateway overhead. 25 parallel operations should complete well within 5 seconds on warm Lambdas. If cold starts cause NFR violations, the fallback is to document that cold-start batches may exceed 5 seconds — this is acceptable for a boutique app.

### Readiness Check Pattern

The readiness handler uses a `GetItem` on a non-existent key to verify DynamoDB data-plane connectivity. This verifies both network connectivity AND IAM permissions in a single call, costs nothing (no read capacity for a miss), and has better throttle headroom than control-plane operations like `DescribeTable`.

```typescript
import { getDefaultClient } from "@ai-learning-hub/db";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

// Module-scoped cache: { result, expiresAt }
let cachedCheck: { result: "ok" | "unhealthy"; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10_000; // 10 seconds

async function checkDynamoDB(): Promise<"ok" | "unhealthy"> {
  if (cachedCheck && Date.now() < cachedCheck.expiresAt) return cachedCheck.result;

  const client = getDefaultClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    await client.send(
      new GetCommand({ TableName: process.env.USERS_TABLE_NAME!, Key: { PK: "HEALTHCHECK", SK: "PROBE" } }),
      { abortSignal: controller.signal }
    );
    cachedCheck = { result: "ok", expiresAt: Date.now() + CACHE_TTL_MS };
    return "ok";
  } catch {
    cachedCheck = { result: "unhealthy", expiresAt: Date.now() + CACHE_TTL_MS };
    return "unhealthy";
  } finally {
    clearTimeout(timeout);
  }
}
```

**Why `GetItem` over `DescribeTable`:** `DescribeTable` is a control-plane operation (100 req/s shared account quota). `GetItem` on a non-existent key is a data-plane operation — it verifies connectivity, IAM permissions, and table availability in one call with much higher throttle limits. A miss costs 0 read capacity units.

**Why 10-second cache:** Prevents rapid probe storms from hitting DynamoDB on every call. The Lambda's module-scoped variable persists across invocations (warm starts), so repeated probes within 10 seconds return the cached result.

**Why check only USERS_TABLE_NAME:** All tables are in the same DynamoDB region and account. If one table is reachable, they all are. No need to check every table — one connectivity proof is sufficient.

### Auth Type "none" — CDK Implementation

The existing route stacks wire API methods with the shared authorizer. For `AuthorizationType.NONE`, the CDK resource creation skips the authorizer:

```typescript
// Existing pattern (with auth):
healthResource.addMethod("GET", healthIntegration, {
  authorizationType: apigateway.AuthorizationType.CUSTOM,
  authorizer: props.authorizer,
});

// New pattern (no auth):
healthResource.addMethod("GET", healthIntegration, {
  authorizationType: apigateway.AuthorizationType.NONE,
});
```

The route registry's `authType: "none"` tells CDK to skip authorizer wiring. The architecture enforcement tests (T1-T4) validate that CDK resources match the route registry — update the test expectations to handle `"none"` auth type.

### Scope Resolver Update

Add `batch:execute` to the `full`/`*` tier in `backend/shared/middleware/src/scope-resolver.ts`. Only full-access API keys should execute batch operations. No other tier (capture, read, saves:write) gets batch access:

| Tier | Gets `batch:execute` | Rationale |
|------|---------------------|-----------|
| `full` / `*` | Yes | Full-access keys can batch |
| `capture` | No | Capture keys only create saves |
| `read` | No | Read-only keys can't execute commands |
| `saves:write` | No | Save-focused keys shouldn't batch across domains |

### Environment Variables

| Handler | Variable | Source |
|---------|----------|--------|
| Health | `NODE_OPTIONS` | Standard |
| Readiness | `USERS_TABLE_NAME`, `NODE_OPTIONS` | TablesStack |
| Batch | `API_BASE_URL`, `IDEMPOTENCY_TABLE_NAME`, `USERS_TABLE_NAME`, `NODE_OPTIONS` | ApiGatewayStack, TablesStack |

`API_BASE_URL` is the API Gateway invoke URL, e.g., `https://{restApiId}.execute-api.{region}.amazonaws.com/{stage}`. Construct it from `restApi.url` in CDK.

### Testing Standards

- **Test framework:** vitest
- **Mock patterns:** From `backend/test-utils/`:
  - `createMockEvent({ method, path, userId?, ... })` — creates API Gateway proxy event
  - `createMockContext()` — creates Lambda context
  - `mockCreateLoggerModule()` — mocks `@ai-learning-hub/logging`
  - `assertADR008Error(result, expectedCode)` — validates error response shape
- **Health/readiness tests:** No auth mocking needed (requireAuth: false)
- **Batch tests:** Mock `fetch()` globally to intercept HTTP loopback calls. Test each sub-operation response mapping.
- **DynamoDB mock for readiness:** Mock `@aws-sdk/client-dynamodb` `DynamoDBClient.send()` to simulate healthy/unhealthy states.

### Previous Story Intelligence (3.2.8)

Story 3.2.8 (Auth Domain Retrofit) established:
- `wrapHandler` middleware composition for all auth handlers — follow the same pattern for batch
- Fire-and-forget event recording pattern — NOT needed for health/readiness/batch (no domain entities modified)
- Command endpoint dual-routing pattern — NOT applicable here
- Rate limit configuration via `wrapHandler` options — batch has its own rate limit (60/user/hour) to prevent amplification abuse, plus sub-operations are individually rate-limited
- The `requiredScope` pattern works correctly with the scope resolver

### Git Intelligence

Recent commits (3.2.7, 3.2.8, 3.2.10) show:
- **File naming:** Handler files at `backend/functions/{name}/handler.ts`, test files as `handler.test.ts` in same directory, schemas as `schemas.ts`
- **CDK stacks:** Route stacks at `infra/lib/stacks/api/{name}-routes.stack.ts`
- **Route registry:** Entries appended to `ROUTE_REGISTRY` array with epic comment
- **Stack composition:** New stacks added to `infra/bin/app.ts` with dependency chain
- **Test patterns:** `vi.mock()` for logging and middleware, `createMockEvent` for event construction

### Project Structure Notes

```
backend/functions/health/handler.ts          # NEW — health check
backend/functions/health/handler.test.ts     # NEW — health tests
backend/functions/readiness/handler.ts       # NEW — readiness probe
backend/functions/readiness/handler.test.ts  # NEW — readiness tests
backend/functions/batch/handler.ts           # NEW — batch operations
backend/functions/batch/handler.test.ts      # NEW — batch tests
backend/functions/batch/schemas.ts           # NEW — Zod schemas
backend/shared/types/src/api.ts              # MODIFY — add types
backend/shared/middleware/src/action-registrations.ts  # MODIFY — register batch
backend/shared/middleware/src/scope-resolver.ts        # MODIFY — add batch:execute scope
infra/config/route-registry.ts               # MODIFY — add routes + auth type
infra/lib/stacks/api/ops-routes.stack.ts     # NEW — CDK stack
infra/bin/app.ts                             # MODIFY — wire stack
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3.2, Story 3.2.9]
- [Source: _bmad-output/planning-artifacts/prd.md — FR106, FR107, NFR-AN5]
- [Source: _bmad-output/implementation-artifacts/3-2-8-auth-domain-retrofit.md — Previous story patterns]
- [Source: backend/shared/middleware/src/wrapper.ts — wrapHandler middleware chain]
- [Source: backend/shared/middleware/src/error-handler.ts — createSuccessResponse, error contract]
- [Source: backend/functions/actions-catalog/handler.ts — Simple GET handler reference]
- [Source: infra/config/route-registry.ts — Route registry pattern]
- [Source: infra/lib/stacks/api/discovery-routes.stack.ts — CDK route stack reference]
- [Source: backend/shared/db/src/client.ts — DynamoDB client pattern]
- [Source: backend/shared/middleware/src/scope-resolver.ts — Scope tier mapping]
- [Source: .claude/docs/api-patterns.md — ADR-008 error contract]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
