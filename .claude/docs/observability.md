# Observability Guide

This document describes the observability foundation for AI Learning Hub, including structured logging, X-Ray tracing, and metrics (EMF).

## Architecture

Per ADR-006 and ADR-008, the observability stack includes:

- **X-Ray distributed tracing** for Lambda and API Gateway
- **Structured logging** with correlation IDs (requestId, traceId, userId)
- **EMF (Embedded Metrics Format)** for custom CloudWatch Metrics

## Structured Logging (ADR-008)

### Logger Usage

All Lambda handlers and API code MUST use `@ai-learning-hub/logging`:

```typescript
import { createLogger } from "@ai-learning-hub/logging";

const logger = createLogger();

// At request start, set correlation IDs
logger.setRequestContext({
  requestId: event.requestContext.requestId, // API Gateway request ID
  userId: claims.sub, // From JWT after authentication
  // traceId is auto-extracted from process.env._X_AMZN_TRACE_ID
});

// Log with structured fields
logger.info("User authenticated", { userId: claims.sub });
logger.timed("Save completed", startTime, { projectId, saveId });
logger.error("Save failed", error, { projectId });
```

### Log Contract (ADR-008)

Every log entry includes:

- `timestamp` - ISO 8601 timestamp
- `level` - DEBUG, INFO, WARN, ERROR
- `message` - Human-readable message
- `requestId` - Correlation ID from API Gateway (or generated)
- `traceId` - X-Ray trace ID from `_X_AMZN_TRACE_ID` env var
- `userId` - Authenticated user ID (when available)
- `durationMs` - Request/operation duration (when using `logger.timed()`)
- `action` - Semantic action name (e.g., "SaveProject", "GetUser")
- `entityType` - Entity type (e.g., "Project", "Save")
- `entityId` - Entity ID (e.g., project ID, save ID)
- `data` - Additional structured data (redacted for sensitive values)
- `error` - Error details (name, message, stack) when logging errors

### Redaction

The logger automatically redacts sensitive data:

- API keys, secrets, tokens, passwords (by key name or pattern)
- Bearer tokens
- AWS credentials (AKIA\* pattern)
- Any field containing "password", "secret", "token", "apikey", "authorization", "credential"

### Correlation ID Flow

1. **API Gateway** generates a unique `requestId` for each request
2. **Lambda** receives the request ID in `event.requestContext.requestId`
3. **Logger** is configured with `requestId` at handler start
4. **X-Ray** trace ID is automatically extracted from `_X_AMZN_TRACE_ID` environment variable
5. All log entries include both `requestId` and `traceId` for correlation

### No console.\* Allowed

**NEVER use `console.log()`, `console.error()`, or other console methods in Lambda/API code.**

- Import guard enforces this rule (ESLint: `no-console`)
- Use `@ai-learning-hub/logging` instead
- Logs are JSON-structured for CloudWatch Logs Insights queries

## X-Ray Tracing (NFR-O1)

### Lambda Tracing

All Lambda functions should enable X-Ray tracing:

```typescript
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Tracing } from "aws-cdk-lib/aws-lambda";

const fn = new NodejsFunction(this, "MyHandler", {
  entry: "src/handlers/my-handler.ts",
  tracing: Tracing.ACTIVE, // Enable X-Ray
  // ... other props
});
```

### API Gateway Tracing

When creating API Gateway, enable tracing:

```typescript
import { RestApi } from "aws-cdk-lib/aws-apigateway";

const api = new RestApi(this, "MyApi", {
  restApiName: "my-api",
  deploy: true,
  deployOptions: {
    tracingEnabled: true, // Enable X-Ray for API Gateway
    // ... other deploy options
  },
});
```

### Sampling Rule

The observability stack defines a sampling rule (`ai-learning-hub-lambda-sampling`) that samples:

- **5% of requests** (fixedRate: 0.05)
- **At least 1 request per second per host** (reservoirSize: 1)
- Applies to all Lambda functions (serviceType: "AWS::Lambda")

### Trace ID Access

The logger automatically extracts the X-Ray trace ID from `process.env._X_AMZN_TRACE_ID`:

```typescript
// Internal implementation in @ai-learning-hub/logging
function getTraceId(): string | undefined {
  const traceHeader = process.env._X_AMZN_TRACE_ID;
  if (!traceHeader) return undefined;

  // Extract Root trace ID: "Root=1-abc-def;Parent=xyz;Sampled=1"
  const match = /Root=([^;]+)/.exec(traceHeader);
  return match?.[1];
}
```

## EMF Custom Metrics (NFR-O2)

### Embedded Metrics Format

Use EMF to emit custom metrics to CloudWatch without a separate PutMetric API call:

```typescript
import { createMetricLogger } from "aws-embedded-metrics";

const metrics = createMetricLogger();

// Set namespace (all metrics use this namespace)
metrics.setNamespace("AILearningHub");

// Add dimensions (categorical labels)
metrics.setDimensions({ contentType: "video", userId });

// Put metric values
metrics.putMetric("SavesCreated", 1, "Count");
metrics.putMetric("SaveDuration", durationMs, "Milliseconds");

// Flush metrics (automatic at Lambda handler exit)
await metrics.flush();
```

### Metric Conventions

**Namespace:** `AILearningHub` (all metrics)

**Dimensions:**

- `contentType` - Type of content (video, article, tutorial)
- `userId` - User ID (for per-user metrics)
- `projectId` - Project ID (for per-project metrics)
- `operation` - Operation name (SaveProject, GetSaves, etc.)

**Metric Names:**

- `SavesCreated` - Count of new saves created
- `ProjectsCreated` - Count of new projects created
- `RequestCount` - Count of API requests
- `ErrorCount` - Count of errors
- `RequestDuration` - Duration of API requests (Milliseconds)
- `SaveDuration` - Duration of save operations (Milliseconds)

### EMF Pattern

Use EMF for:

- **Business metrics** (saves created, projects, tutorials completed)
- **Operational metrics** (request counts, error rates, durations)
- **Custom dashboards** (metrics can be graphed in CloudWatch)
- **Alarms** (metrics can trigger CloudWatch alarms)

EMF writes metrics as structured JSON logs that CloudWatch automatically parses into metrics:

```json
{
  "_aws": {
    "Timestamp": 1234567890000,
    "CloudWatchMetrics": [
      {
        "Namespace": "AILearningHub",
        "Dimensions": [["contentType", "userId"]],
        "Metrics": [
          { "Name": "SavesCreated", "Unit": "Count" },
          { "Name": "SaveDuration", "Unit": "Milliseconds" }
        ]
      }
    ]
  },
  "contentType": "video",
  "userId": "user-123",
  "SavesCreated": 1,
  "SaveDuration": 150
}
```

## CloudWatch Logs Insights Queries

With structured logs and correlation IDs, you can query across all Lambda/API logs:

### Find all logs for a specific request

```
fields @timestamp, level, message, action, entityType, entityId
| filter requestId = "abc-def-123"
| sort @timestamp asc
```

### Find all errors for a specific user

```
fields @timestamp, message, error.message, error.stack
| filter level = "ERROR" and userId = "user-123"
| sort @timestamp desc
```

### Trace a request across multiple Lambdas

```
fields @timestamp, message, action, durationMs
| filter traceId = "1-abc-def-ghi"
| sort @timestamp asc
```

### P99 duration by action

```
fields action, durationMs
| filter ispresent(durationMs)
| stats avg(durationMs), pct(durationMs, 50), pct(durationMs, 99) by action
```

## Deployment

The observability stack is deployed after core stacks (per ADR-006):

```bash
# Deployment order (from infra/bin/app.ts)
# 1. Core (Tables, Buckets)
# 2. Auth (future)
# 3. API (future)
# 4. Workflows (future)
# 5. Observability (this stack)

cdk deploy AiLearningHubObservability
```

The X-Ray sampling rule is global (applies to all Lambdas in the account/region) once deployed.

## Future Enhancements

The observability stack currently includes X-Ray sampling. Future stories will add:

- **CloudWatch Dashboards** - Visual dashboards for Lambda, DynamoDB, API Gateway
- **CloudWatch Alarms** - Automated alerts for error rates, latency, throttles
- **X-Ray Service Maps** - Visual service dependency maps
- **Log metric filters** - Extract metrics from logs (error counts, etc.)

## References

- ADR-006: Multi-stack CDK architecture (deployment order)
- ADR-008: Logging contract (correlation IDs, structured logs)
- NFR-O1: Request tracing via X-Ray
- NFR-O2: Structured logging with correlation IDs
- Diagram: `_bmad-output/planning-artifacts/diagrams/05-observability-analytics.md`
