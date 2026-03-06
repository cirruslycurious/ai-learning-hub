# Backend — AI Learning Hub

AWS Lambda handlers (Node.js/TypeScript) and shared library packages. All Lambdas are deployed via CDK stacks in `../infra/`.

## Structure

```
backend/
  functions/          # One directory per Lambda handler
  shared/             # @ai-learning-hub/* packages (Lambda Layer)
  test/               # Integration / cross-function tests
  test-utils/         # Shared test factories and mock helpers
```

## Lambda functions

| Function             | Purpose                                                          | Auth            |
| -------------------- | ---------------------------------------------------------------- | --------------- |
| `jwt-authorizer`     | API Gateway custom authorizer — validates Clerk JWTs             | —               |
| `api-key-authorizer` | API Gateway custom authorizer — validates API keys               | —               |
| `saves`              | Create a save (POST /saves)                                      | JWT or API key  |
| `saves-get`          | Get a single save (GET /saves/:id)                               | JWT or API key  |
| `saves-list`         | List saves with cursor pagination and filtering (GET /saves)     | JWT or API key  |
| `saves-update`       | Update save metadata (PATCH /saves/:id)                          | JWT or API key  |
| `saves-delete`       | Soft-delete a save (DELETE /saves/:id)                           | JWT or API key  |
| `saves-restore`      | Restore a soft-deleted save (POST /saves/:id/restore)            | JWT or API key  |
| `saves-events`       | Event history for a save (GET /saves/:id/events)                 | JWT or API key  |
| `api-keys`           | CRUD for API keys (POST/GET/DELETE /api-keys)                    | JWT             |
| `users-me`           | User profile read/update (GET/PATCH /users/me)                   | JWT             |
| `invite-codes`       | Generate invite codes (POST /invite-codes)                       | JWT, admin role |
| `validate-invite`    | Validate and redeem invite codes (POST /validate-invite)         | —               |
| `health`             | Health check (GET /health)                                       | —               |
| `readiness`          | Readiness probe — checks DynamoDB + EventBridge (GET /readiness) | —               |
| `batch`              | Batch multiple API calls in one request (POST /batch)            | JWT or API key  |
| `actions-catalog`    | Action catalog for agent discoverability (GET /actions)          | —               |
| `state-graph`        | State graph for entity state machines (GET /state-graph)         | —               |
| `admin`              | Admin operations                                                 | JWT, admin role |
| `content`            | Content metadata (future)                                        | JWT             |
| `enrichment`         | URL enrichment pipeline (EventBridge target)                     | —               |
| `links`              | Link management (future)                                         | JWT             |
| `projects`           | Project management (future)                                      | JWT             |
| `search`             | Full-text search (future)                                        | JWT             |

## Shared packages

All Lambdas import exclusively from `@ai-learning-hub/*` — never from raw AWS SDKs directly. See each package's README for full API docs.

| Package                                                      | What it provides                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [`@ai-learning-hub/middleware`](shared/middleware/README.md) | `wrapHandler`, auth, idempotency, optimistic concurrency, rate limiting, response envelope |
| [`@ai-learning-hub/db`](shared/db/README.md)                 | DynamoDB client, table configs, query helpers, pagination, rate limiting                   |
| [`@ai-learning-hub/logging`](shared/logging/README.md)       | Structured logger with X-Ray correlation IDs                                               |
| [`@ai-learning-hub/validation`](shared/validation/README.md) | Zod schemas and validation utilities                                                       |
| [`@ai-learning-hub/types`](shared/types/README.md)           | Shared TypeScript types (entities, API shapes, errors)                                     |
| [`@ai-learning-hub/events`](shared/events/README.md)         | EventBridge client and typed event emitter                                                 |

## Commands

Run from the repo root (workspace):

```bash
npm test              # Run all backend tests with coverage
npm run build         # Compile all packages
npm run lint          # ESLint across backend
npm run type-check    # tsc --noEmit
```

Or from `backend/`:

```bash
cd backend
npm test
npm run build
npm run lint
```

## Handler pattern

Every handler uses `wrapHandler` from `@ai-learning-hub/middleware`. Direct `APIGatewayProxyHandler` implementations are not allowed (enforced by the import-guard hook).

```ts
import { wrapHandler } from "@ai-learning-hub/middleware";

export const handler = wrapHandler(
  async (event, context) => {
    // context.auth, context.logger, context.requestId available
    return { statusCode: 200, body: JSON.stringify({ data: result }) };
  },
  {
    requireAuth: true,
    requiredScope: "saves:read",
    idempotent: false,
    rateLimit: savesWriteRateLimit,
  }
);
```

See [`shared/middleware/README.md`](shared/middleware/README.md) for full `WrapperOptions` reference.

## Key patterns

- **No Lambda-to-Lambda calls** (ADR-005) — use API Gateway for sync, EventBridge for async
- **All DynamoDB access via `@ai-learning-hub/db`** (ADR-014) — no raw SDK in handlers
- **All logging via `@ai-learning-hub/logging`** — no `console.log` in handlers
- **80% test coverage gate** enforced in CI (ADR-007)
- **DynamoDB key patterns** (ADR-001): `USER#<userId>`, `CONTENT#<urlHash>`

## Test utilities

`backend/test-utils/` exports shared mock factories and helpers used across handler tests. Import from there rather than duplicating mock setup.
