# @ai-learning-hub/middleware

Lambda middleware chain: handler wrapping, auth enforcement, idempotency, optimistic concurrency, rate limiting, response envelope, and action discoverability.

## Installation

Already available in every Lambda via the shared Lambda Layer deployed by CDK. Import directly:

```ts
import { wrapHandler } from "@ai-learning-hub/middleware";
```

## Core: `wrapHandler`

Wraps every Lambda handler. Handles auth, logging, idempotency, concurrency checks, rate limiting, error serialisation, and response envelope in one call.

```ts
import { wrapHandler, type WrapperOptions } from "@ai-learning-hub/middleware";

export const handler = wrapHandler(
  async (event, context) => {
    // context.auth       — AuthContext (userId, role, scopes, isApiKey, agentIdentity)
    // context.logger     — request-scoped Logger
    // context.requestId  — correlation ID
    // context.ifMatch    — ETag value if client sent If-Match header
    // context.idempotencyKey — key if client sent Idempotency-Key header
    return createSuccessResponse(result, { statusCode: 201 });
  },
  options // WrapperOptions — see below
);
```

### `WrapperOptions`

| Option               | Type                        | Default | Description                                             |
| -------------------- | --------------------------- | ------- | ------------------------------------------------------- |
| `requireAuth`        | `boolean`                   | `false` | Reject unauthenticated requests with 401                |
| `requiredRoles`      | `string[]`                  | —       | Require one of these roles (e.g. `["admin"]`)           |
| `requiredScope`      | `OperationScope`            | —       | Require this API key scope; returns 403 if insufficient |
| `idempotent`         | `boolean`                   | `false` | Enable idempotency-key dedup via DynamoDB               |
| `requireVersion`     | `boolean`                   | `false` | Require `If-Match` header for optimistic concurrency    |
| `rateLimit`          | `RateLimitMiddlewareConfig` | —       | Primary rate limit (per-user, per-operation)            |
| `secondaryRateLimit` | `RateLimitMiddlewareConfig` | —       | Secondary rate limit (e.g. IP-based)                    |

## Auth

```ts
import {
  extractAuthContext,
  requireAuth,
  requireRole,
  requireScope,
} from "@ai-learning-hub/middleware";
```

- `extractAuthContext(event)` — parses the `authorizerContext` injected by the custom authorizer into an `AuthContext`
- `requireAuth(context)` — throws 401 if no auth context
- `requireRole(context, role)` — throws 403 if role not present
- `requireScope(context, scope)` — throws 403 with `required_scope` / `granted_scopes` if insufficient

`AuthContext` shape:

```ts
{
  userId: string;
  role: string;          // "user" | "admin"
  isApiKey: boolean;
  scopes: ApiKeyScope[];
  agentIdentity?: AgentIdentity;
}
```

## Authorizer policy helpers

```ts
import { generatePolicy, deny } from "@ai-learning-hub/middleware";
```

Used by `jwt-authorizer` and `api-key-authorizer` to build IAM policy documents returned to API Gateway.

## Response envelope

```ts
import {
  createSuccessResponse,
  createNoContentResponse,
  createErrorResponse,
} from "@ai-learning-hub/middleware";
```

All responses follow the `{ data, meta?, links? }` envelope (ADR-008 / Epic 3.2).

```ts
createSuccessResponse(data, { statusCode: 200, meta, links });
createNoContentResponse();   // 204
createErrorResponse(code, message, statusCode, { field?, requestId? });
```

## Idempotency (Epic 3.2.1)

```ts
import {
  extractIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
} from "@ai-learning-hub/middleware";
```

When `options.idempotent: true`, `wrapHandler` automatically:

1. Extracts the `Idempotency-Key` header
2. Checks DynamoDB for a prior result with the same key
3. Returns the cached response on a match (no side effects)
4. Stores the result after the handler completes

Send `Idempotency-Key: <uuid>` in the request header to activate.

## Optimistic concurrency (Epic 3.2.1)

```ts
import { extractIfMatch } from "@ai-learning-hub/middleware";
```

When `options.requireVersion: true`, `wrapHandler` rejects requests missing `If-Match`. Use `context.ifMatch` in the handler and pass it to `updateItemWithVersion` from `@ai-learning-hub/db`. Conflicts return 409 with `currentState` and `allowedActions`.

## Rate limiting (Epic 3.2.4)

```ts
import {
  addRateLimitHeaders,
  buildRateLimitHeaders,
  type RateLimitMiddlewareConfig,
} from "@ai-learning-hub/middleware";
```

Pass a `RateLimitMiddlewareConfig` to `wrapHandler`. On every response, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers are added. Rate limit state is stored in DynamoDB (sliding window).

## Scope resolution (Epic 3.2.6)

```ts
import {
  SCOPE_GRANTS,
  VALID_SCOPES,
  resolveScopeGrants,
  checkScopeAccess,
} from "@ai-learning-hub/middleware";
```

API key scopes follow a hierarchy: `*` grants all operations; `saves:*` grants all saves operations; `saves:read` is the most specific. `resolveScopeGrants` expands a scope string into the full set of granted `OperationScope` values.

## Action discoverability (Epic 3.2.10)

```ts
import {
  ActionRegistry,
  getActionRegistry,
  buildResourceActions,
  registerInitialActions,
} from "@ai-learning-hub/middleware";
```

- `registerInitialActions()` — called at cold start to populate the global `ActionRegistry` with all endpoint definitions
- `getActionRegistry()` — returns the singleton registry
- `buildResourceActions(resourceType, resourceState, authContext)` — returns `ResourceAction[]` for `meta.actions` on a single-resource GET response

## Event history (Epic 3.2.3)

```ts
import { createEventHistoryHandler } from "@ai-learning-hub/middleware";
```

Generates a ready-to-deploy Lambda handler for `GET /entity/:id/events`. Accepts an `EventHistoryHandlerConfig` that specifies the entity type and auth requirements.

## SSM utilities

```ts
import {
  getClerkSecretKey,
  resetClerkSecretKeyCache,
} from "@ai-learning-hub/middleware";
```

Fetches the Clerk secret key from Parameter Store with a cold-start cache. `resetClerkSecretKeyCache()` is exposed for tests.

## Pagination (Epic 3.5.2)

```ts
import { buildPaginationLinks } from "@ai-learning-hub/middleware";
```

Builds `{ self, next? }` links for cursor-paginated list responses.

## Re-exported types

The following types are re-exported from `@ai-learning-hub/types` for handler convenience:

`EnvelopeMeta`, `RateLimitMeta`, `ResponseLinks`, `ResponseEnvelope`, `AgentIdentity`, `ApiKeyScope`, `OperationScope`, `ActionDefinition`, `ResourceAction`, `StateGraph`, `StateTransition`, `HeaderDefinition`, `ParamDefinition`, `HttpMethod`
