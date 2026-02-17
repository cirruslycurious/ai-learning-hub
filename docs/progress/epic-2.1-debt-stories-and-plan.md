---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/implementation-artifacts/epic-2-retro-2026-02-16.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/epics.md
  - docs/progress/epic-2-stories-and-plan.md
  - _bmad-output/implementation-artifacts/sprint-status.yaml
---

# Epic 2.1: Technical Debt Paydown — Stories and Implementation Plan

**Date:** 2026-02-16
**Source:** Epic 2 Retrospective, Architecture ADRs (005, 008, 013, 014), PRD NFRs
**Gate:** All 5 tasks must complete before Epic 3 coding begins

---

## Epic Goal

Address technical debt identified during Epic 2 retrospective — most critically, create the API Gateway REST API so all Epic 2 endpoints become callable. Also enforce 80% coverage thresholds, deduplicate test mocks, propagate request-scoped logging, and verify the full HTTP chain end-to-end.

**User Outcome:** All Epic 2 endpoints (auth, profile, API keys, invites) are reachable via HTTP. Quality gates enforced. Logging is traceable. The platform is proven deployable before feature work resumes.

---

## Requirements Inventory

### Functional Requirements

No new FRs. Epic 2.1 completes deployment wiring for existing Epic 2 FRs:

| FR  | Description                      | Impact                                     |
| --- | -------------------------------- | ------------------------------------------ |
| FR1 | Sign up with social auth (Clerk) | JWT authorizer needs API Gateway route     |
| FR2 | Sign in with social auth         | JWT authorizer needs API Gateway route     |
| FR3 | Sign out from all devices        | Clerk-managed; authorizer enforces         |
| FR4 | View and edit profile            | GET/PATCH /users/me needs route            |
| FR5 | Generate API keys                | POST /users/api-keys needs route           |
| FR6 | Revoke API keys                  | DELETE /users/api-keys/:id needs route     |
| FR7 | Capture-only API keys            | Scope middleware needs gateway integration |
| FR8 | Redeem invite codes              | POST /auth/validate-invite needs route     |
| FR9 | Generate invite codes            | POST/GET /users/invite-codes needs route   |

### Non-Functional Requirements Addressed

| NFR          | Description                             | Task                   |
| ------------ | --------------------------------------- | ---------------------- |
| NFR-P2       | API response time < 1s (p95)            | D1, D5                 |
| NFR-S2       | TLS 1.2+ everywhere                     | D1                     |
| NFR-S4       | Per-user data isolation                 | D1 (Gateway Responses) |
| NFR-S9       | Rate limit abuse protection             | D1 (WAF + throttle)    |
| NFR-O1       | Request tracing (X-Ray correlation IDs) | D4                     |
| NFR-O2       | Structured logging with correlation IDs | D4                     |
| NFR-R1       | API error rate < 1%                     | D1, D5                 |
| NFR-I3       | API contract stability                  | D5                     |
| 80% coverage | CI-enforced test coverage gate          | D2                     |

### Additional Requirements (Architecture & Retrospective)

**Architecture ADRs:**

- ADR-005: All traffic through API Gateway (currently violated)
- ADR-008: Gateway Responses for standardized error formatting (401/403/429 → `{ error: { code, message, requestId } }`)
- ADR-013: JWT + API Key custom authorizer wiring
- ADR-014: API-first design (requires a gateway)
- CDK stack decomposition: `lib/stacks/api/` for API Gateway

**API Routes (Epic 2 endpoints to wire):**

- `POST /auth/validate-invite` → validateInviteFunction (JWT auth)
- `GET /users/me` → usersMeFunction (JWT or API key)
- `PATCH /users/me` → usersMeFunction (JWT or API key)
- `POST /users/api-keys` → apiKeysFunction (JWT or API key)
- `GET /users/api-keys` → apiKeysFunction (JWT or API key)
- `DELETE /users/api-keys/:id` → apiKeysFunction (JWT or API key)
- `POST /users/invite-codes` → inviteCodesFunction (JWT or API key)
- `GET /users/invite-codes` → inviteCodesFunction (JWT or API key)

**Existing Infrastructure to Consume:**

- `RateLimitingStack` exports WAF WebACL ARN + throttle settings
- `AuthStack` exports all Lambda function ARNs
- `backend/vitest.config.ts` has thresholds at 0

**Dependency Order:**

```
D2 (Coverage) ─────────┐
D3 (Mock dedup) ────────┼──► D1 (API Gateway) ──► D5 (E2E test)
D4 (Logger) ────────────┘
```

---

## Red Team Findings (Applied)

The following gaps were identified via adversarial Red Team vs Blue Team analysis and incorporated into the epic design:

| #   | Finding                                                                                                  | Severity | Resolution                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | **D1 scope too large** — RestApi + routes + authorizers + Gateway Responses + WAF + CORS + extensibility | High     | D1 acceptance criteria broken into explicit sub-tasks                                                               |
| 2   | **CORS not explicit** — Frontend PWA on CloudFront needs CORS preflight on all API resources             | High     | Added as explicit D1 acceptance criterion                                                                           |
| 3   | **D5 approach ambiguous** — "E2E test" undefined: deployed stage vs mock, test runner, credentials       | High     | Rescoped: CDK synth + handler integration tests with real event shapes. Deployed smoke tests deferred to Epic 3.1b. |
| 4   | **D2 may break CI** — Setting 80% thresholds could fail build if handlers below threshold                | Medium   | D2 = audit → fix → set thresholds (handlers + shared packages)                                                      |
| 5   | **requestId propagation unclear** — API Gateway requestId must flow into handlers and DB layer           | Medium   | Assigned to D1 (extraction) + D4 (propagation)                                                                      |

## War Room Scope Adjustments (Applied)

| Task | Original Scope                       | Adjusted Scope                                                                                                                               | Rationale                                                             |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D2   | Set thresholds to 80%                | Audit → fix below-threshold handlers → set thresholds (handlers + shared packages). Add shared library import enforcement test.              | Prevents CI breakage; covers shared packages; enforces ADR-014        |
| D3   | Extract shared mock                  | Unchanged — recommend before D4 but not hard dependency                                                                                      | Cheap (Low), prevents duplicated effort in D4/D1                      |
| D4   | ~15 DB functions get optional logger | Handler-facing DB functions only (~8-10). Internal helpers already accept logger.                                                            | 80/20 — `getItem`/`updateItem`/`queryItems` already take logger param |
| D1   | API Gateway stack                    | API Gateway stack + conventions document (`.claude/docs/api-gateway-conventions.md`) + route registry + cross-stack dependency test          | Codifies extensibility pattern; prevents future wiring gaps           |
| D5   | "Full HTTP chain" E2E                | CDK synth + 5 architecture enforcement tests + handler integration tests with real event shapes. Deployed smoke tests deferred to Epic 3.1b. | Comprehensive automated architecture validation                       |

## Party Mode: API Gateway Conventions & Architecture Tests (Applied)

### API Gateway Conventions (D1 deliverable: `.claude/docs/api-gateway-conventions.md`)

**Path Naming:**

- Plural nouns: `/saves`, `/projects`, `/folders`
- Nested resources for owned relationships: `/projects/:id/saves`, `/projects/:id/notes`
- Sub-actions as verbs only when REST doesn't fit: `/saves/:id/restore`, `/admin/pipelines/:name/retry`
- No API version prefix in V1

**Auth Domains:**

- `/auth/*` — Pre-authentication routes (JWT required, `inviteValidated` NOT checked)
- `/users/*` — Authenticated user self-service (JWT or API key)
- `/saves/*`, `/projects/*`, `/folders/*`, `/search` — Authenticated user data (JWT or API key with scope)
- `/admin/*` — JWT + admin role required
- `/analytics/*` — JWT + admin-or-analyst role required
- `/content/*`, `/search-index/*` — AWS IAM auth (internal pipelines only)

**CDK Extensibility (Pattern A):**

- `api-gateway.stack.ts` → Creates RestApi, shared authorizers, CORS, WAF, Gateway Responses
- Domain route stacks (e.g. `auth-routes.stack.ts`, `saves-routes.stack.ts`) → Receive RestApi reference, add their routes
- Each route stack independently deployable

**Stage:** `dev`, `prod`. CloudFront strips prefix later.

**Response Convention (ADR-008):**

- Success: `{ data: ... }` or `{ data: [...], nextToken?: string }`
- Error: `{ error: { code, message, requestId } }`
- Gateway Responses handle non-Lambda errors

### 7 Required Architecture Enforcement Tests

| #   | Test Name                         | Validates                                                                                          | Story | Location              |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------- | ----- | --------------------- |
| T1  | API Gateway Contract              | Every route has authorizer; Gateway Responses configured; CORS on all resources; WAF associated    | D5    | `infra/test/`         |
| T2  | Route Completeness                | Every entry in route registry has matching CDK resource + method; no orphan Lambdas                | D5    | `infra/test/`         |
| T3  | Authorizer Type Correctness       | Auth type per route matches convention (JWT-only, JWT-or-APIKey, IAM, admin, analyst)              | D5    | `infra/test/`         |
| T4  | Lambda ↔ Route Wiring             | Every Lambda has ≥1 API Gateway integration; every integration points to existing Lambda           | D5    | `infra/test/`         |
| T5  | ADR-008 Error Response Shape      | Handler error responses match `{ error: { code, message, requestId } }`; codes from ErrorCode enum | D5    | `backend/test-utils/` |
| T6  | Shared Library Import Enforcement | No direct `@aws-sdk/client-dynamodb` in handlers; no `console.log`; `@ai-learning-hub/*` used      | D2    | `backend/test/`       |
| T7  | Cross-Stack Dependency Validation | No circular deps; dependency order matches documented order; cross-stack refs use CfnOutput        | D1    | `infra/test/`         |

### Route Registry (D1 deliverable)

Canonical source of truth for all API routes. Each epic adds entries; tests T1-T4 validate CDK matches.

Location: `infra/config/route-registry.ts`

---

## Story Dependency Order (Hardened)

```
D2 (Coverage: audit → fix → thresholds) ──┐
D3 (wrapHandler mock dedup) ───────────────┼──► D1 (API Gateway stack) ──► D5 (CDK synth + integration tests)
D4 (Logger: handler-facing DB fns) ────────┘
```

D2, D3, D4 can run in parallel. D3 recommended before D4 (shared mock simplifies D4's test changes). D1 after D4 (request-scoped logging). D5 last (Epic 3 gate).

---

## Stories

| Story  | Title                                      | Value Delivered                                                                    | Tests | Depends On                | Est. Complexity |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------- | ----- | ------------------------- | --------------- |
| 2.1-D2 | Backend Coverage + Import Enforcement      | Quality gate enforced — audit, fix, set 80%. Shared library import test (T6).      | T6    | None                      | Low-Medium      |
| 2.1-D3 | wrapHandler Test Mock Dedup                | DRY test infrastructure — shared mock utility                                      | —     | None                      | Low             |
| 2.1-D4 | Request-Scoped Logger in DB Layer          | Traceable logging — handler-facing DB functions (~8-10) accept optional logger     | —     | None (recommend after D3) | Medium          |
| 2.1-D1 | API Gateway + Conventions + Route Registry | All Epic 2 endpoints reachable. Conventions doc. Route registry. Cross-stack test. | T7    | D4                        | High            |
| 2.1-D5 | Architecture Enforcement Tests             | CDK synth + T1-T5 tests + handler integration tests. Epic 3 gate.                  | T1-T5 | D1, D2, D3, D4            | High            |

### Story 2.1-D2: Backend Coverage Thresholds + Import Enforcement

**As a** developer (human or AI agent),
**I want** CI to enforce 80% test coverage and block direct SDK imports in handlers,
**so that** no under-tested or non-compliant code ships to production.

**Acceptance Criteria:**

| #   | Given                                                                                     | When                                                                                | Then                                                                                         |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| AC1 | Current handler and shared package coverage is unknown                                    | Developer runs coverage audit across `backend/functions/**` and `backend/shared/**` | Coverage report shows per-package and per-handler line/function/branch/statement percentages |
| AC2 | Any handler or shared package is below 80% coverage                                       | Developer identifies the gap                                                        | Missing tests are written to bring coverage to ≥80%                                          |
| AC3 | All handlers and shared packages are at ≥80%                                              | Developer sets thresholds in `backend/vitest.config.ts`                             | `thresholds` set to `{ lines: 80, functions: 80, branches: 80, statements: 80 }`             |
| AC4 | Shared packages (`backend/shared/*`) have their own vitest configs                        | Developer audits each package config                                                | Each shared package vitest config also has 80% thresholds (or is added if missing)           |
| AC5 | A handler file in `backend/functions/**` imports directly from `@aws-sdk/client-dynamodb` | Shared library import enforcement test (T6) runs in CI                              | Test fails with clear message identifying the violating file and import                      |
| AC6 | A handler file uses `console.log` instead of `@ai-learning-hub/logging`                   | T6 test runs                                                                        | Test fails with clear message                                                                |
| AC7 | All handlers use `@ai-learning-hub/*` imports and no `console.log`                        | T6 test runs                                                                        | Test passes                                                                                  |
| AC8 | CI pipeline runs                                                                          | Coverage thresholds + T6 test execute                                               | Build fails if coverage < 80% or import violations detected                                  |

**Technical Notes:**

- T6 test location: `backend/test/import-enforcement.test.ts`
- T6 approach: scan handler `.ts` files (not `.test.ts`) for forbidden import patterns
- Coverage audit should be run first to identify gaps before setting thresholds
- Shared package configs: check `backend/shared/db/vitest.config.ts`, `backend/shared/logging/vitest.config.ts`, `backend/shared/middleware/vitest.config.ts`, `backend/shared/validation/vitest.config.ts`, `backend/shared/types/vitest.config.ts`

**FRs covered:** None directly (quality infrastructure)
**NFRs covered:** 80% coverage gate

---

### Story 2.1-D3: wrapHandler Test Mock Dedup

**As a** developer (human or AI agent),
**I want** a shared `wrapHandler` test mock utility,
**so that** handler tests are DRY and mock changes only need to happen in one place.

**Acceptance Criteria:**

| #   | Given                                                                             | When                                                                                                                                         | Then                                                                                                                                       |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | ~100 lines of `wrapHandler` mock setup is duplicated across 5+ handler test files | Developer creates `backend/test-utils/mock-wrapper.ts`                                                                                       | Shared mock exports `createMockContext()`, `createMockEvent()`, and `mockWrapHandler()` with configurable userId, role, scopes, authMethod |
| AC2 | Shared mock is created                                                            | Developer updates all handler test files (`jwt-authorizer`, `api-key-authorizer`, `users-me`, `validate-invite`, `api-keys`, `invite-codes`) | Each test file imports from `backend/test-utils/mock-wrapper` instead of inline mock definitions                                           |
| AC3 | Handler test needs JWT auth context                                               | Developer calls `createMockContext({ userId: 'user_123', role: 'user', authMethod: 'jwt' })`                                                 | Returns properly shaped API Gateway authorizer context object                                                                              |
| AC4 | Handler test needs API key auth context                                           | Developer calls `createMockContext({ userId: 'user_123', role: 'user', authMethod: 'api-key', scopes: ['saves:write'] })`                    | Returns context with scopes array for scope middleware testing                                                                             |
| AC5 | Handler test needs a request event                                                | Developer calls `createMockEvent({ method: 'POST', path: '/users/api-keys', body: {...}, pathParameters: {...} })`                           | Returns properly shaped `APIGatewayProxyEvent` with defaults for headers, requestContext, etc.                                             |
| AC6 | All handler tests updated                                                         | `npm test` runs                                                                                                                              | All existing tests pass with zero behavior changes (pure refactor)                                                                         |
| AC7 | —                                                                                 | —                                                                                                                                            | `backend/test-utils/mock-wrapper.ts` has its own unit tests verifying mock shape correctness                                               |

**Technical Notes:**

- Pure refactor — no behavior changes, all existing tests must pass as-is
- Export barrel: `backend/test-utils/index.ts`
- Mock should support both REST API event format (current) and future API Gateway proxy event format
- Consider exporting `createMockDynamoDBClient()` as well if duplicated across DB tests

**FRs covered:** None (test infrastructure)
**NFRs covered:** None directly (developer productivity)

---

### Story 2.1-D4: Request-Scoped Logger in DB Layer

**As a** system operator investigating an issue,
**I want** every DB operation log line to include the request's `requestId` and `traceId`,
**so that** I can trace a single API request from handler through DB layer in CloudWatch Logs Insights.

**Acceptance Criteria:**

| #   | Given                                                                                                                                                                                                                                                                     | When                                                                                | Then                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| AC1 | Handler-facing DB functions in `@ai-learning-hub/db` (e.g. `getProfile`, `ensureProfile`, `getInviteCode`, `redeemInviteCode`, `checkRateLimit`, `incrementRateLimit`, `createApiKey`, `listApiKeys`, `revokeApiKey`, `getApiKeyByHash`) do not accept a logger parameter | Developer adds optional `logger?: Logger` parameter to each handler-facing function | Each function signature gains `logger?: Logger` as the last parameter                                                    |
| AC2 | A handler-facing DB function is called without a logger                                                                                                                                                                                                                   | Function executes                                                                   | Falls back to `createLogger()` (module-level logger, no request context) — backward compatible                           |
| AC3 | A handler-facing DB function is called with a request-scoped logger                                                                                                                                                                                                       | Function uses the passed logger for all log statements                              | Log output includes `requestId` and `traceId` from the handler's request context                                         |
| AC4 | Handler code in `backend/functions/**` calls a DB function                                                                                                                                                                                                                | Developer updates call sites to pass the handler's request-scoped logger            | Logger propagation chain: API Gateway event → handler extracts requestId → creates scoped logger → passes to DB function |
| AC5 | Internal helper functions (`getItem`, `updateItem`, `queryItems` in `helpers.ts`)                                                                                                                                                                                         | —                                                                                   | Already accept logger parameter — no changes needed (verified)                                                           |
| AC6 | All handler tests are updated                                                                                                                                                                                                                                             | `npm test` runs                                                                     | All tests pass; tests verify logger is passed to DB functions where applicable                                           |
| AC7 | —                                                                                                                                                                                                                                                                         | Developer queries CloudWatch Logs Insights with `filter requestId = "abc-123"`      | Returns log lines from BOTH handler AND DB layer for the same request                                                    |

**Technical Notes:**

- Scope: ~8-10 handler-facing functions in `users.ts`, `invite-codes.ts`, `rate-limiter.ts`
- Internal helpers (`helpers.ts`: `getItem`, `updateItem`, `queryItems`) already accept logger — no changes
- `createLogger()` in `@ai-learning-hub/logging` already supports `{ requestId, traceId }` context
- Handlers extract `requestId` from `event.requestContext.requestId` (API Gateway) — this extraction pattern should be documented for D1
- If D3 is completed first, handler test updates use the shared mock utility

**FRs covered:** None directly (observability infrastructure)
**NFRs covered:** NFR-O1 (request tracing), NFR-O2 (structured logging with correlation IDs)

---

### Story 2.1-D1: API Gateway REST API Stack + Conventions + Route Registry

**As a** user of the AI Learning Hub,
**I want** all authentication and profile endpoints to be reachable via HTTP,
**so that** I can sign in, manage my API keys, validate invite codes, and access my profile through the web app or API clients.

**Acceptance Criteria:**

| #                                   | Given                                             | When                                                                        | Then                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Gateway Core**                |
| AC1                                 | No API Gateway REST API exists                    | Developer creates `infra/lib/stacks/api/api-gateway.stack.ts`               | Stack creates `RestApi` with stage deployment (`dev`), description, and `deployOptions` including stage-level throttling (100 req/s, burst 200)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| AC2                                 | `RateLimitingStack` exports WAF WebACL ARN        | API Gateway stack deploys                                                   | WAF WebACL is associated with the API Gateway stage via `CfnWebACLAssociation`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| AC3                                 | API Gateway exists                                | Any HTTP request arrives                                                    | CORS is configured: `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers` (`Content-Type, Authorization, x-api-key`), `Access-Control-Allow-Methods`. OPTIONS preflight on all resources returns 200.                                                                                                                                                                                                                                                                                                                                                                         |
| AC4                                 | API Gateway exists                                | Request fails at gateway level (not Lambda)                                 | Gateway Responses return ADR-008 format: `{ "error": { "code": "...", "message": "...", "requestId": "$context.requestId" } }` for `UNAUTHORIZED` (401), `ACCESS_DENIED` (403), `THROTTLED` (429), `DEFAULT_5XX` (500)                                                                                                                                                                                                                                                                                                                                                                |
| **Authorizer Wiring**               |
| AC5                                 | `AuthStack` exports `jwtAuthorizerFunction`       | API Gateway deploys                                                         | JWT custom authorizer is created with `resultsCacheTtl: 300s`, identity source `method.request.header.Authorization`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| AC6                                 | `AuthStack` exports `apiKeyAuthorizerFunction`    | API Gateway deploys                                                         | API Key custom authorizer is created with identity source `method.request.header.x-api-key`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Route Wiring (Epic 2 Endpoints)** |
| AC7                                 | Route registry lists `POST /auth/validate-invite` | Client sends `POST /auth/validate-invite`                                   | Request routed to `validateInviteFunction` with JWT authorizer only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| AC8                                 | Route registry lists `/users/me`                  | Client sends `GET /users/me` or `PATCH /users/me`                           | Request routed to `usersMeFunction` with JWT-or-API-Key authorizer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| AC9                                 | Route registry lists `/users/api-keys`            | Client sends `POST`, `GET /users/api-keys` or `DELETE /users/api-keys/{id}` | Request routed to `apiKeysFunction` with JWT-or-API-Key authorizer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| AC10                                | Route registry lists `/users/invite-codes`        | Client sends `POST` or `GET /users/invite-codes`                            | Request routed to `inviteCodesFunction` with JWT-or-API-Key authorizer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Extensibility**                   |
| AC11                                | Future epic needs to add routes (e.g. `/saves`)   | Developer creates a new route stack (e.g. `saves-routes.stack.ts`)          | Stack receives `RestApi` + authorizer references via props, adds resources via `api.root.addResource()`. No changes to `api-gateway.stack.ts` needed.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| AC12                                | —                                                 | —                                                                           | `api-gateway.stack.ts` exports `restApi`, `jwtAuthorizer`, `apiKeyAuthorizer` as public properties for route stacks to consume                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Conventions Document**            |
| AC13                                | No API Gateway conventions document exists        | Developer creates `.claude/docs/api-gateway-conventions.md`                 | Document covers: path naming (plural nouns, nested resources), auth domains (`/auth/*`, `/users/*`, `/saves/*`, `/admin/*`, `/analytics/*`, `/content/*`, `/search-index/*`), CDK extensibility pattern (Pattern A), stage prefix, response conventions (ADR-008). **Must include:** (1) "Every story that creates a Lambda handler MUST include an AC for its API Gateway route wiring in the corresponding route stack." (2) "Before writing test setup code, check `backend/test-utils/` for existing utilities. If a pattern is used in 2+ test files, extract it to test-utils." |
| **Route Registry**                  |
| AC14                                | No canonical route registry exists                | Developer creates `infra/config/route-registry.ts`                          | Registry lists all Epic 2 routes with path, methods, auth type, handler reference, and epic number                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| AC15                                | Route registry exists                             | Future epic adds an endpoint                                                | Developer adds entry to registry; T2 test (D5) validates CDK matches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Cross-Stack & Infrastructure**    |
| AC16                                | `infra/bin/app.ts` has no API Gateway stack       | Developer adds `ApiGatewayStack` + `AuthRoutesStack` to app                 | Correct dependency order: Tables → Auth → ApiGateway → AuthRoutes → Observability                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| AC17                                | Cross-stack dependency test (T7) runs             | `npm test` in infra workspace                                               | Test validates no circular dependencies, correct dependency order, all cross-stack refs use `CfnOutput` exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| AC18                                | —                                                 | `cdk synth` runs                                                            | All stacks synthesize without errors; CDK Nag passes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Technical Notes:**

- CDK Pattern A: `api-gateway.stack.ts` (shared) + `auth-routes.stack.ts` (Epic 2 routes). Epic 3 will add `saves-routes.stack.ts`.
- JWT-or-API-Key: Implement as a single custom authorizer that checks `Authorization` header first, falls back to `x-api-key`. OR use two separate authorizers and let the route choose. Document decision in conventions.
- `requestId` extraction: API Gateway's `$context.requestId` is passed to Lambda via `event.requestContext.requestId`. Document this in conventions for handler authors.
- CORS allowed origins: `*` for dev stage. Production will use specific CloudFront domain.
- CDK Nag suppressions will be needed for WAF association and any wildcard IAM permissions.

**FRs covered:** FR1–FR9 (all Epic 2 endpoints become callable)
**NFRs covered:** NFR-P2, NFR-S2, NFR-S4, NFR-S9, NFR-R1

---

### Story 2.1-D5: Architecture Enforcement Tests

**As a** developer (human or AI agent) adding new endpoints in future epics,
**I want** automated tests that catch missing authorizers, orphan Lambdas, incorrect auth types, and ADR-008 violations,
**so that** the infrastructure wiring bugs from Epic 2 can never happen again.

**Acceptance Criteria:**

| #                                    | Given                                                                                                                | When                                                                                    | Then                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1: API Gateway Contract**         |
| AC1                                  | API Gateway stack is synthesized                                                                                     | T1 test runs against CloudFormation template                                            | Every `AWS::ApiGateway::Method` (except OPTIONS) has `AuthorizationType` != `NONE`                                                                      |
| AC2                                  | API Gateway stack is synthesized                                                                                     | T1 test runs                                                                            | Gateway Responses exist for `UNAUTHORIZED`, `ACCESS_DENIED`, `THROTTLED`, `DEFAULT_5XX` with ADR-008 response templates                                 |
| AC3                                  | API Gateway stack is synthesized                                                                                     | T1 test runs                                                                            | Every resource has an OPTIONS method (CORS preflight)                                                                                                   |
| AC4                                  | API Gateway stack is synthesized                                                                                     | T1 test runs                                                                            | WAF `CfnWebACLAssociation` exists linking WebACL to the RestApi stage                                                                                   |
| **T2: Route Completeness**           |
| AC5                                  | Route registry in `infra/config/route-registry.ts` lists all expected routes                                         | T2 test runs against synthesized template                                               | Every registry entry has a matching `AWS::ApiGateway::Resource` + `AWS::ApiGateway::Method` in the template                                             |
| AC6                                  | A Lambda is defined in any CDK stack                                                                                 | T2 test runs                                                                            | Every Lambda that is a handler (not authorizer) has at least one API Gateway method integration pointing to it — no orphan Lambdas                      |
| **T3: Authorizer Type Correctness**  |
| AC7                                  | Route registry specifies auth type per route (`jwt`, `jwt-or-apikey`, `iam`, `admin`, `analyst`)                     | T3 test runs                                                                            | Each route's actual authorizer in the template matches the registry's declared auth type                                                                |
| AC8                                  | A route is accidentally set to `AuthorizationType: NONE`                                                             | T3 test runs                                                                            | Test fails with message: "Route {path} {method} has no authorizer but registry requires {authType}"                                                     |
| **T4: Lambda ↔ Route Wiring**        |
| AC9                                  | All Lambdas and API Gateway methods are synthesized                                                                  | T4 test runs                                                                            | Every `AWS::ApiGateway::Method` `Integration.Uri` resolves to an existing `AWS::Lambda::Function`                                                       |
| AC10                                 | A new Lambda is added without a route                                                                                | T4 test runs                                                                            | Test fails with message: "Lambda {name} has no API Gateway integration"                                                                                 |
| **T5: ADR-008 Error Response Shape** |
| AC11                                 | A shared test utility `assertADR008Error(response)` exists                                                           | Handler test calls utility with a handler error response                                | Asserts `response.body` parses to `{ error: { code, message, requestId } }`, code is from `ErrorCode` enum, HTTP status matches `ErrorCodeToStatus` map |
| AC12                                 | Every handler test file in `backend/functions/**`                                                                    | Test suite includes at least one error path test using `assertADR008Error`              | All handlers verified to return ADR-008 compliant errors                                                                                                |
| **Handler Integration Tests**        |
| AC13                                 | API Gateway event shapes are defined in `backend/test-utils/`                                                        | Handler integration tests use `createMockEvent()` with real API Gateway event structure | Tests verify: JWT auth happy path → handler → 200/201 response                                                                                          |
| AC14                                 | —                                                                                                                    | Handler integration tests run                                                           | Tests verify: invalid/missing auth → handler → 401 response with ADR-008 shape                                                                          |
| AC15                                 | —                                                                                                                    | Handler integration tests run                                                           | Tests verify: capture-only API key on non-saves endpoint → 403 `SCOPE_INSUFFICIENT`                                                                     |
| AC16                                 | —                                                                                                                    | Handler integration tests run                                                           | Tests verify: rate limit exceeded → 429 with `Retry-After` header                                                                                       |
| **CDK Synth Gate**                   |
| AC17                                 | All stacks (Tables, Buckets, Auth, ApiGateway, AuthRoutes, RateLimiting, Observability)                              | `cdk synth` runs in CI                                                                  | Synth succeeds; CDK Nag reports no errors                                                                                                               |
| **Quality Gate Self-Test**           |
| AC18                                 | All vitest configs exist across backend workspace and shared packages                                                | Meta-test runs                                                                          | Asserts every vitest config has coverage thresholds ≥80% (lines, functions, branches, statements). Prevents thresholds from being silently lowered.     |
| **DB Logger Signature Test**         |
| AC19                                 | All exported functions in `@ai-learning-hub/db` public API                                                           | T6-extended test runs                                                                   | Every handler-facing exported function accepts an optional `Logger` parameter. Prevents new DB functions from skipping logger support.                  |
| **Epic 3 Gate**                      |
| AC20                                 | All T1-T5 tests pass, CDK synth passes, all handler integration tests pass, meta-tests pass, all existing tests pass | Developer declares Epic 2.1 complete                                                    | Epic 3 coding may begin                                                                                                                                 |

**Technical Notes:**

- T1-T4 location: `infra/test/architecture-enforcement/` (new directory)
- T5 utility location: `backend/test-utils/assert-adr008.ts`
- T1-T4 use CDK `Template.fromStack()` and `Match` assertions — no deployment needed
- T2 imports route registry from `infra/config/route-registry.ts` — single source of truth
- T4 "orphan Lambda" detection: exclude authorizer Lambdas (they integrate via `AWS::ApiGateway::Authorizer`, not `Method`)
- Handler integration tests (AC13-AC16) use the shared mock utility from D3
- AC18 (quality gate self-test): scan all vitest configs programmatically, assert thresholds ≥80. Location: `backend/test/quality-gate-self-test.test.ts`
- AC19 (DB logger signature test): extend T6 or create separate test that parses `@ai-learning-hub/db` exports and checks for optional Logger param
- AC20 is the formal gate — all 706+ existing tests + new T1-T7 tests + handler integration tests + meta-tests must pass

**FRs covered:** None directly (architecture enforcement)
**NFRs covered:** NFR-I3 (API contract stability), NFR-R1 (error rate measurable)

---

---

## Implementation Plan Summary

| Order | Story  | Title                                      | Est. Complexity | Dependencies              | Key Deliverables                                                                         |
| ----- | ------ | ------------------------------------------ | --------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | 2.1-D2 | Backend Coverage + Import Enforcement      | Low-Medium      | None                      | 80% thresholds, T6 test                                                                  |
| 2     | 2.1-D3 | wrapHandler Test Mock Dedup                | Low             | None                      | `backend/test-utils/mock-wrapper.ts`                                                     |
| 3     | 2.1-D4 | Request-Scoped Logger in DB Layer          | Medium          | None (recommend after D3) | ~8-10 DB functions accept logger                                                         |
| 4     | 2.1-D1 | API Gateway + Conventions + Route Registry | High            | D4                        | `api-gateway.stack.ts`, `auth-routes.stack.ts`, conventions doc, route registry, T7 test |
| 5     | 2.1-D5 | Architecture Enforcement Tests             | High            | D1, D2, D3, D4            | T1-T5 tests, `assertADR008Error` utility, handler integration tests                      |

### Recommended Sprint Split

- **Sprint A (parallel):** D2, D3, D4 — independent quality improvements
- **Sprint B:** D1 — API Gateway (the critical deliverable)
- **Sprint C:** D5 — architecture enforcement tests (the Epic 3 gate)

### Files to Create/Modify

| Story | New Files                                                                                                                                                                                                                | Modified                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| D2    | `backend/test/import-enforcement.test.ts`                                                                                                                                                                                | `backend/vitest.config.ts`, shared package vitest configs                                         |
| D3    | `backend/test-utils/mock-wrapper.ts`, `backend/test-utils/index.ts`, `backend/test-utils/mock-wrapper.test.ts`                                                                                                           | All 6 handler test files                                                                          |
| D4    | —                                                                                                                                                                                                                        | `backend/shared/db/src/users.ts`, `invite-codes.ts`, `rate-limiter.ts`; all handler files + tests |
| D1    | `infra/lib/stacks/api/api-gateway.stack.ts`, `infra/lib/stacks/api/auth-routes.stack.ts`, `infra/config/route-registry.ts`, `.claude/docs/api-gateway-conventions.md`, `infra/test/stacks/api/api-gateway.stack.test.ts` | `infra/bin/app.ts`                                                                                |
| D5    | `infra/test/architecture-enforcement/` (4 test files: T1-T4), `backend/test-utils/assert-adr008.ts`                                                                                                                      | Handler test files (add ADR-008 assertions + integration tests)                                   |

### Test Count Projection

| Current | D2                                 | D3               | D4                 | D1                  | D5                       | Total    |
| ------- | ---------------------------------- | ---------------- | ------------------ | ------------------- | ------------------------ | -------- |
| 706     | +5-10 (coverage fix tests) +5 (T6) | +10 (mock tests) | +15 (logger tests) | +20 (CDK tests, T7) | +30 (T1-T5, integration) | ~790-800 |

### Epic 2.1 Completion Criteria

All of the following must pass before Epic 3 coding begins:

1. All existing tests pass (706+)
2. Coverage ≥80% on all handlers and shared packages (D2)
3. T6 import enforcement passes (D2)
4. T7 cross-stack dependency validation passes (D1)
5. `cdk synth` succeeds with CDK Nag clean (D1)
6. T1-T5 architecture enforcement tests pass (D5)
7. Handler integration tests pass (D5)
8. Quality gate self-test passes — all vitest configs have ≥80% thresholds (D5)
9. DB logger signature test passes — all handler-facing DB exports accept Logger (D5)
10. Sprint status updated to `done` for all 5 stories

---

_Generated by BMAD BMM create-epics-and-stories workflow for Epic 2.1 (Debt)._
