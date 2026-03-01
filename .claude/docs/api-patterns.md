# API Patterns Summary

REST conventions and error handling. See ADR-008 in `_bmad-output/planning-artifacts/architecture.md` (canonical path: see .claude/docs/README.md).

## REST Conventions

- Resource URLs: `/saves`, `/saves/:id`, `/projects`, `/projects/:id`, `/links`, `/search`, `/content/:urlHash`, etc.
- Methods: GET (read), POST (create), PUT/PATCH (update), DELETE (delete).
- All API calls scoped to authenticated user (JWT or API key). No Lambda-to-Lambda direct invoke; use API Gateway or EventBridge.

## Error Response Shape (ADR-008 + Epic 3.2)

All Lambda responses use this shape via shared middleware:

```json
{
  "statusCode": 400 | 401 | 403 | 404 | 409 | 428 | 429 | 500,
  "body": {
    "error": {
      "code": "VALIDATION_ERROR | NOT_FOUND | RATE_LIMITED | VERSION_CONFLICT | SCOPE_INSUFFICIENT | ...",
      "message": "Human readable message",
      "requestId": "correlation-id-from-x-ray",
      "details": { "field_errors": [...] },
      "currentState": "optional for state-machine errors",
      "allowedActions": ["optional", "for state/conflict errors"],
      "requiredConditions": ["optional", "for precondition errors"]
    }
  }
}
```

- Error codes align with HTTP status; `requestId` is the correlation ID (X-Ray).
- **Field-level validation (3.2.2):** When `code` is `VALIDATION_ERROR`, `details.field_errors` (or `details`) can include `{ field, message, code, constraint, allowed_values }` per `FieldValidationError` from `@ai-learning-hub/types`.
- **Agent-native errors:** `VERSION_CONFLICT` (409), `PRECONDITION_REQUIRED` (428), `IDEMPOTENCY_KEY_CONFLICT` (409), `INVALID_STATE_TRANSITION` (409), `SCOPE_INSUFFICIENT` (403). State/conflict errors should include `currentState` and `allowedActions` when applicable.

## Success Response Envelope (Epic 3.2)

All successful list and single-resource responses use the envelope from `@ai-learning-hub/types`:

- **Shape:** `{ data, meta?, links? }`.
- **meta:** `cursor` (opaque pagination token), `total`, `cursorReset`, `truncated`, `rateLimit` (limit, remaining, reset), `actions` (for action discoverability).
- **links:** `self`, `next` (for paginated lists).
- Handlers use `createSuccessResponse(data, requestId, { meta, links })` from `@ai-learning-hub/middleware`; the wrapper adds rate-limit headers when configured.

## Agent-Native API (Epic 3.2)

- **Idempotency:** Mutating operations support `Idempotency-Key` header. Middleware checks/stores results in the idempotency table; replay cached response on retry. See `extractIdempotencyKey`, `checkIdempotency`, `storeIdempotencyResult` in `@ai-learning-hub/middleware`.
- **Optimistic concurrency:** Handlers that support it use `If-Match: <version>` and `ctx.expectedVersion`. Conflict returns `VERSION_CONFLICT` (409) with current version in details. See `extractIfMatch` and version helpers in `@ai-learning-hub/db`.
- **Agent identity:** `X-Agent-ID` header is extracted by middleware; `ctx.agentId` and `ctx.actorType` (`human` | `agent`) are available. Recorded in event history.
- **Rate limit transparency:** Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` when rate-limit middleware is active. Same values appear in `meta.rateLimit` in the envelope.
- **Cursor pagination:** List endpoints use opaque cursors (encode/decode via `@ai-learning-hub/db`). No offset/page numbers; use `cursor` query param and `meta.cursor` / `links.next` in the response.
- **Scoped API keys:** Handlers declare `requiredScope` in `wrapHandler` options (e.g. `*` or `saves:write`). Insufficient scope returns `403` with `SCOPE_INSUFFICIENT` and `required_scope` / `granted_scopes` in details. See `@ai-learning-hub/middleware` scope-resolver.

## Logging Contract (every log line)

- timestamp (ISO 8601), requestId, traceId (X-Ray), userId
- action, entityType, entityId, level (INFO | WARN | ERROR), durationMs

## Middleware

Lambdas use `@ai-learning-hub/middleware`:

- **Auth:** Verify JWT or API key; reject 401 if invalid.
- **Error handler:** Catch errors, map to ADR-008 shape (including details, currentState, allowedActions), log with correlation ID.
- **Wrapper:** Composes auth, optional idempotency/concurrency/rate-limit, agent identity, error handling, and response envelope/headers around handler.

All API handlers must use `wrapHandler`; do not return raw responses. Authorizers do not use the wrapper (they use `createLogger()` from `@ai-learning-hub/logging`).

## Rules

- **No Lambda-to-Lambda:** Call APIs via HTTP or emit events (EventBridge). Never `lambda.invoke()`.
- **Shared middleware:** Use `@ai-learning-hub/middleware` for auth, error handling, idempotency, concurrency, agent identity, and rate-limit headers.
- **Structured errors:** Use `AppError` and error codes from `@ai-learning-hub/types`; use `AppError.build().withState().withConditions().create()` for state-machine/precondition errors; middleware formats them.
