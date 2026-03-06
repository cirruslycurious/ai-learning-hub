# @ai-learning-hub/types

Shared TypeScript type definitions for all Lambda handlers and the frontend. Single source of truth for error codes, API shapes, entity models, and event types.

## Quick start

```ts
import type {
  Save,
  PublicSave,
  AuthContext,
  ApiErrorResponse,
} from "@ai-learning-hub/types";
import { ErrorCode, AppError } from "@ai-learning-hub/types";
```

## Errors (ADR-008)

```ts
import { ErrorCode, ErrorCodeToStatus, AppError } from "@ai-learning-hub/types";
import type { ApiErrorBody, ApiErrorResponse } from "@ai-learning-hub/types";
```

`ErrorCode` is the canonical enum for all application errors. Throw `AppError` in handler logic — `wrapHandler` catches it and serialises to the standard error response.

```ts
throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
throw new AppError(ErrorCode.VERSION_CONFLICT, "Conflict", {
  currentVersion: 3,
});
```

### Error codes reference

| Code                       | HTTP | When                                                 |
| -------------------------- | ---- | ---------------------------------------------------- |
| `VALIDATION_ERROR`         | 400  | Request body / query string fails schema validation  |
| `UNAUTHORIZED`             | 401  | Missing or invalid auth token                        |
| `FORBIDDEN`                | 403  | Authenticated but lacks role or scope                |
| `NOT_FOUND`                | 404  | Resource does not exist                              |
| `CONFLICT`                 | 409  | General conflict (e.g. duplicate)                    |
| `DUPLICATE_SAVE`           | 409  | URL already saved by this user                       |
| `RATE_LIMITED`             | 429  | Rate limit exceeded                                  |
| `VERSION_CONFLICT`         | 409  | `If-Match` version mismatch (optimistic concurrency) |
| `PRECONDITION_REQUIRED`    | 428  | `If-Match` header required but absent                |
| `IDEMPOTENCY_KEY_CONFLICT` | 409  | Idempotency key reused with different payload        |
| `SCOPE_INSUFFICIENT`       | 403  | API key lacks required scope                         |
| `EXPIRED_TOKEN`            | 401  | JWT expired                                          |
| `INVALID_API_KEY`          | 401  | API key not found or malformed                       |
| `REVOKED_API_KEY`          | 401  | API key has been revoked                             |
| `INTERNAL_ERROR`           | 500  | Unhandled server error                               |

### Error response envelope

```ts
interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
    fields?: FieldValidationError[]; // VALIDATION_ERROR only
    currentState?: string; // VERSION_CONFLICT / state errors
    allowedActions?: string[];
    requiredConditions?: string[];
    required_scope?: string; // SCOPE_INSUFFICIENT
    granted_scopes?: string[];
  };
}
```

## API shapes

```ts
import type {
  ResponseEnvelope,
  EnvelopeMeta,
  RateLimitMeta,
  ResponseLinks,
  PaginatedResponse,
  CursorPayload,
  PaginationOptions,
  PaginationParams,
  AuthContext,
  RequestContext,
  AgentIdentity,
  ApiKeyScope,
  OperationScope,
  BatchOperation,
  BatchOperationResult,
  BatchResponse,
  HealthStatus,
  DependencyStatus,
  ReadinessStatus,
  IdempotencyRecord,
} from "@ai-learning-hub/types";
```

### `ResponseEnvelope<T>`

```ts
interface ResponseEnvelope<T> {
  data: T;
  meta?: EnvelopeMeta;
  links?: ResponseLinks;
}
```

### `AuthContext`

```ts
interface AuthContext {
  userId: string;
  role: string; // "user" | "admin"
  isApiKey: boolean;
  scopes: ApiKeyScope[];
  agentIdentity?: AgentIdentity;
}
```

### `AgentIdentity`

Populated when `X-Agent-ID` header is present:

```ts
interface AgentIdentity {
  agentId: string;
  actorType: "agent" | "human";
}
```

## Entity types

```ts
import type {
  Save,
  SaveItem,
  PublicSave,
  User,
  BaseEntity,
  VersionedEntity,
  Project,
  Folder,
  Link,
  Content,
  ApiKey,
  InviteCode,
} from "@ai-learning-hub/types";
import {
  ContentType,
  TutorialStatus,
  ProjectStatus,
  EnrichmentStatus,
  INITIAL_VERSION,
  nextVersion,
} from "@ai-learning-hub/types";
```

### Key entity shapes

**`Save`** — full internal entity with all fields including `version`, `deletedAt`, `urlHash`  
**`PublicSave`** — client-facing projection (strips DynamoDB keys and internal fields); returned by all API responses  
**`SaveItem`** — DynamoDB item shape (adds `PK`, `SK` to `Save`)

**`VersionedEntity`** — mixin interface adding `version: number`; use with `INITIAL_VERSION` (= 1) and `nextVersion(v)` for optimistic concurrency.

## Event history types (Epic 3.2.3)

```ts
import type {
  EntityEvent,
  PublicEntityEvent,
  RecordEventParams,
  EventHistoryQueryOptions,
  EventHistoryResponse,
  EventEntityType,
  ActorType,
  EventContext,
  EventChanges,
} from "@ai-learning-hub/types";
```

## Action discoverability types (Epic 3.2.10)

```ts
import type {
  ActionDefinition,
  ResourceAction,
  StateGraph,
  StateTransition,
  HeaderDefinition,
  ParamDefinition,
  HttpMethod,
} from "@ai-learning-hub/types";
```

## Frontend usage

The frontend resolves `@ai-learning-hub/types` directly to `backend/shared/types/src/` via a Vite alias — no build step required. Import types normally:

```ts
import type { PublicSave, ApiErrorResponse } from "@ai-learning-hub/types";
```
