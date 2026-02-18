# API Gateway Conventions

Conventions for the AI Learning Hub REST API (API Gateway). All route stacks and handler authors must follow these patterns.

## Path Naming

- Plural nouns: `/saves`, `/projects`, `/folders`
- Nested resources for owned relationships: `/projects/{id}/saves`, `/projects/{id}/notes`
- Sub-actions as verbs only when REST doesn't fit: `/saves/{id}/restore`, `/admin/pipelines/{name}/retry`
- No API version prefix in V1

## Auth Domains

| Path Pattern                                       | Auth Type                   | Description                                                                                             |
| -------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/auth/*`                                          | JWT only                    | Pre-authentication routes (JWT required, `inviteValidated` NOT checked by route — authorizer checks it) |
| `/users/*`                                         | JWT or API Key              | Authenticated user self-service                                                                         |
| `/saves/*`, `/projects/*`, `/folders/*`, `/search` | JWT or API Key (with scope) | Authenticated user data                                                                                 |
| `/admin/*`                                         | JWT + admin role            | Admin operations                                                                                        |
| `/analytics/*`                                     | JWT + admin-or-analyst role | Analytics access                                                                                        |
| `/content/*`, `/search-index/*`                    | AWS IAM                     | Internal pipelines only                                                                                 |

## JWT-or-API-Key Authorizer Pattern

Routes marked "JWT or API Key" use the `apiKeyAuthorizer` (REQUEST type) with no `identitySources` and caching disabled (`resultsCacheTtl: 0`). This configuration ensures API Gateway always invokes the authorizer Lambda regardless of which headers are present, allowing the Lambda to check both `Authorization` (JWT) and `x-api-key` headers.

**Current state:** The api-key-authorizer Lambda currently only checks `x-api-key` headers. A follow-up story will enhance it to also handle JWT tokens for jwt-or-apikey routes, with JWT taking precedence. Caching will be re-enabled at that time with proper multi-header identity sources.

**Decision rationale:** Setting `identitySources: [IdentitySource.header("x-api-key")]` would cause API Gateway to reject requests missing the `x-api-key` header BEFORE the Lambda is invoked, breaking JWT-only clients (e.g., the frontend web app using Clerk tokens).

## CDK Extensibility (Pattern A)

1. `api-gateway.stack.ts` creates the shared `RestApi`, authorizers, CORS, WAF association, Gateway Responses
2. Domain route stacks (e.g., `auth-routes.stack.ts`, `saves-routes.stack.ts`) import the RestApi by ID via `RestApi.fromRestApiAttributes()` and add their routes
3. Each route stack is independently deployable and depends on `ApiGatewayStack`
4. Route stacks use `fromRestApiAttributes()` so that API Gateway resources (methods, integrations) are created in the route stack's CloudFormation template, not in ApiGatewayStack

**Adding a new route stack (e.g., Epic 3 saves routes):**

```typescript
const savesRoutesStack = new SavesRoutesStack(app, "AiLearningHubSavesRoutes", {
  restApiId: apiGatewayStack.restApi.restApiId,
  rootResourceId: apiGatewayStack.restApi.restApiRootResourceId,
  jwtAuthorizer: apiGatewayStack.jwtAuthorizer,
  apiKeyAuthorizer: apiGatewayStack.apiKeyAuthorizer,
  savesFunction: savesStack.savesFunction,
});
savesRoutesStack.addDependency(apiGatewayStack);
```

No changes to `api-gateway.stack.ts` are needed.

## Stage & Deployment

- Stage name: `dev` (default), `prod` (future)
- CloudFront strips stage prefix (handled externally)
- Stage throttling: 100 req/s, burst 200

## Response Conventions (ADR-008)

**Success:**

```json
{ "data": <result> }
{ "data": [...], "nextToken": "..." }
```

**Error:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "requestId": "..."
  }
}
```

**Gateway Responses** (non-Lambda errors):

- 401 UNAUTHORIZED → `{ "error": { "code": "UNAUTHORIZED", "message": "...", "requestId": "$context.requestId" } }`
- 403 ACCESS_DENIED → `{ "error": { "code": "FORBIDDEN", ... } }`
- 429 THROTTLED → `{ "error": { "code": "RATE_LIMITED", ... } }`
- 500 DEFAULT_5XX → `{ "error": { "code": "INTERNAL_ERROR", ... } }`

## requestId Propagation

API Gateway's `$context.requestId` is passed to Lambda via `event.requestContext.requestId`. Handlers extract it in `wrapHandler` middleware and pass it to the DB layer logger for end-to-end tracing.

## Route Registry

Canonical source of truth: `infra/config/route-registry.ts`

All routes must be registered there. Architecture enforcement tests (T1-T4 in Story D5) validate that CDK resources match the registry.

## Mandatory Conventions

1. Every story that creates a Lambda handler MUST include an AC for its API Gateway route wiring in the corresponding route stack.
2. Before writing test setup code, check `backend/test-utils/` for existing utilities. If a pattern is used in 2+ test files, extract it to test-utils.
