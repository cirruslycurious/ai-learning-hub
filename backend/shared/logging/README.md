# @ai-learning-hub/logging

Structured JSON logger with X-Ray trace ID correlation. Use this in every Lambda — never `console.log` (enforced by import-guard hook).

## Quick start

```ts
import { logger } from "@ai-learning-hub/logging";

logger.info("Save created", { userId, saveId });
logger.error("DynamoDB write failed", { error: err.message });
```

For request-scoped logging (recommended in handlers), use the logger injected by `wrapHandler` — it already has `requestId` and `traceId` in context:

```ts
export const handler = wrapHandler(async (event, { logger }) => {
  logger.info("Processing request", { userId: context.auth?.userId });
});
```

## API

### `logger` (default singleton)

A module-level `Logger` instance with no context pre-set. Use as a fallback or for top-level module initialisation logging.

### `createLogger(context?, minLevel?)`

Create a new `Logger` with an initial `LogContext`. `minLevel` defaults to `"info"`.

```ts
import { createLogger } from "@ai-learning-hub/logging";

const log = createLogger({ requestId, traceId, userId });
log.info("Handler started");
```

### `Logger` methods

| Method              | Signature                    | Description                                       |
| ------------------- | ---------------------------- | ------------------------------------------------- |
| `debug`             | `(message, data?)`           | Debug — suppressed at `minLevel: "info"`          |
| `info`              | `(message, data?)`           | Standard operational log                          |
| `warn`              | `(message, data?)`           | Non-fatal issue                                   |
| `error`             | `(message, data?)`           | Error — always emitted; include `error` in `data` |
| `child`             | `(additionalContext)`        | Returns a new `Logger` with merged context        |
| `setRequestContext` | `({ requestId?, traceId? })` | Mutate context (used by `wrapHandler`)            |

### Log output format (ADR-008)

Every entry is a JSON object written to `stdout`:

```json
{
  "timestamp": "2026-03-06T10:00:00.000Z",
  "level": "info",
  "message": "Save created",
  "requestId": "abc-123",
  "traceId": "1-xxx-yyy",
  "userId": "user_abc",
  "durationMs": 42,
  "data": { "saveId": "sv_xyz" }
}
```

CloudWatch Logs Insights and X-Ray trace views consume this format automatically.

## X-Ray integration

The logger reads `_X_AMZN_TRACE_ID` from the Lambda environment (injected by the runtime) and extracts the `Root=` segment as `traceId`. `wrapHandler` passes this into the request-scoped logger automatically — no manual setup required.

DynamoDB subsegment capture via `aws-xray-sdk` is deferred; request-level tracing via the trace ID header is the current approach.

## Secret redaction

The logger automatically redacts common secret patterns before emitting:

- `api_key=`, `bearer <token>`, AWS access key IDs (`AKIA…`)
- Generic `secret=`, `password=`, `token=`, `credential=` patterns

Do not log raw API key values, tokens, or credentials. The redaction is a safety net, not a substitute for not logging them in the first place.

## Types

```ts
import type { LogLevel, LogContext, LogEntry } from "@ai-learning-hub/logging";

// LogLevel = "debug" | "info" | "warn" | "error"

// LogContext — arbitrary key/value pairs merged into every log entry
interface LogContext {
  requestId?: string;
  traceId?: string;
  userId?: string;
  [key: string]: unknown;
}
```
