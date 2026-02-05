# API Patterns Summary

REST conventions and error handling. See ADR-008 in `_bmad-output/planning-artifacts/architecture.md`.

## REST Conventions

- Resource URLs: `/saves`, `/saves/:id`, `/projects`, `/projects/:id`, `/links`, `/search`, `/content/:urlHash`, etc.
- Methods: GET (read), POST (create), PUT/PATCH (update), DELETE (delete).
- All API calls scoped to authenticated user (JWT or API key). No Lambda-to-Lambda direct invoke; use API Gateway or EventBridge.

## Error Response Shape (ADR-008)

All Lambda responses use this shape via shared middleware:

```json
{
  "statusCode": 400 | 401 | 403 | 404 | 429 | 500,
  "body": {
    "error": {
      "code": "VALIDATION_ERROR | NOT_FOUND | RATE_LIMITED | ...",
      "message": "Human readable message",
      "requestId": "correlation-id-from-x-ray"
    }
  }
}
```

Error codes align with HTTP status; `requestId` is the correlation ID (X-Ray).

## Logging Contract (every log line)

- timestamp (ISO 8601), requestId, traceId (X-Ray), userId
- action, entityType, entityId, level (INFO | WARN | ERROR), durationMs

## Middleware

Lambdas use `@ai-learning-hub/middleware`:

- **Auth:** Verify JWT or API key; reject 401 if invalid.
- **Error handler:** Catch errors, map to ADR-008 shape, log with correlation ID.
- **Wrapper:** Composes auth + error handling around handler.

All handlers must use the wrapper; do not return raw responses.

## Rules

- **No Lambda-to-Lambda:** Call APIs via HTTP or emit events (EventBridge). Never `lambda.invoke()`.
- **Shared middleware:** Use `@ai-learning-hub/middleware` for auth and error handling.
- **Structured errors:** Use `AppError` and error codes from `@ai-learning-hub/types`; middleware formats them.
