# Story 1.2: Shared Lambda Layer

Status: done

## Story

As a **developer (human or AI agent)**,
I want **shared Lambda utilities packaged as @ai-learning-hub/* imports**,
so that **all Lambda functions have consistent logging, error handling, validation, database access, and types**.

## Acceptance Criteria

1. **AC1: @ai-learning-hub/types provides shared TypeScript types**
   - GIVEN TypeScript code in any Lambda
   - WHEN I import from `@ai-learning-hub/types`
   - THEN I have access to: error types, entity types, API response types
   - AND all types compile without errors

2. **AC2: @ai-learning-hub/logging provides structured logging**
   - GIVEN a Lambda function
   - WHEN I import and use the logger
   - THEN logs are structured JSON with: timestamp, requestId, traceId, userId, level
   - AND X-Ray trace IDs are automatically captured
   - AND sensitive data (API keys) is redacted

3. **AC3: @ai-learning-hub/validation provides Zod schemas**
   - GIVEN an API request
   - WHEN I validate with the provided schemas
   - THEN request bodies are validated against Zod schemas
   - AND validation errors return standardized error format

4. **AC4: @ai-learning-hub/db provides DynamoDB utilities**
   - GIVEN a Lambda function needing database access
   - WHEN I import the db utilities
   - THEN I have a configured DynamoDB DocumentClient
   - AND common query patterns are provided as helpers
   - AND X-Ray tracing is enabled

5. **AC5: @ai-learning-hub/middleware provides Lambda middleware**
   - GIVEN an API Gateway Lambda
   - WHEN I wrap my handler with middleware
   - THEN authentication is verified (JWT or API key stub)
   - AND errors are caught and formatted per ADR-008
   - AND correlation IDs are added to context

6. **AC6: All packages have 80%+ test coverage**
   - GIVEN the shared packages
   - WHEN I run `npm test` with coverage
   - THEN each package has at least 80% line coverage
   - AND tests run successfully

## Tasks / Subtasks

- [x] **Task 1: Set up shared package structure** (AC: 1-5)
  - [x] Convert /backend/shared/* to npm workspaces
  - [x] Create package.json for each: types, logging, validation, db, middleware
  - [x] Configure TypeScript paths for @ai-learning-hub/* imports
  - [x] Update root package.json workspaces array

- [x] **Task 2: Implement @ai-learning-hub/types** (AC: 1)
  - [x] Create error types (AppError, ErrorCode enum)
  - [x] Create entity types (User, Save, Project, etc. stubs)
  - [x] Create API types (ApiResponse, ApiError)
  - [x] Export all types from index.ts

- [x] **Task 3: Implement @ai-learning-hub/logging** (AC: 2)
  - [x] Create Logger class with structured JSON output
  - [x] Add X-Ray trace ID capture
  - [x] Add API key redaction
  - [x] Add log levels (debug, info, warn, error)
  - [x] Create context interface for requestId, userId

- [x] **Task 4: Implement @ai-learning-hub/validation** (AC: 3)
  - [x] Add Zod as dependency
  - [x] Create common validation schemas (UUID, URL, pagination)
  - [x] Create validation error formatter
  - [x] Export validation helpers

- [x] **Task 5: Implement @ai-learning-hub/db** (AC: 4)
  - [x] Add @aws-sdk/lib-dynamodb as dependency
  - [x] Create configured DynamoDB DocumentClient
  - [x] Enable X-Ray tracing
  - [x] Create query helpers (getItem, putItem, query with pagination)

- [x] **Task 6: Implement @ai-learning-hub/middleware** (AC: 5)
  - [x] Create error handling wrapper (per ADR-008)
  - [x] Create auth middleware stub (JWT/API key verification placeholder)
  - [x] Create correlation ID middleware
  - [x] Create compose function for middleware chaining

- [x] **Task 7: Write tests for all packages** (AC: 6)
  - [x] types: Type compilation tests
  - [x] logging: Output format tests, redaction tests
  - [x] validation: Schema validation tests, error format tests
  - [x] db: Mock DynamoDB tests
  - [x] middleware: Error handling tests, context tests

- [x] **Task 8: Validate all packages** (AC: 1-6)
  - [x] Run `npm test` with coverage
  - [x] Run `npm run lint`
  - [x] Run `npm run type-check`
  - [x] Verify imports work from backend

## Dev Notes

### Architecture Compliance

This story implements per:
- **ADR-008: Standardized Error Handling** - Shared middleware for consistent error responses
- **ADR-015: Lambda Layers for Shared Code** - @ai-learning-hub/* packages

### Package Dependencies

```
@ai-learning-hub/types       → (no deps)
@ai-learning-hub/logging     → types
@ai-learning-hub/validation  → types, zod
@ai-learning-hub/db          → types, logging, @aws-sdk/lib-dynamodb
@ai-learning-hub/middleware  → types, logging, validation
```

### Error Response Shape (ADR-008)

```json
{
  "statusCode": 400 | 401 | 403 | 404 | 429 | 500,
  "body": {
    "error": {
      "code": "VALIDATION_ERROR | NOT_FOUND | RATE_LIMITED | ...",
      "message": "Human readable message",
      "requestId": "correlation-id"
    }
  }
}
```

### Log Format (ADR-008)

```json
{
  "timestamp": "2026-02-04T12:00:00.000Z",
  "level": "INFO",
  "requestId": "req-123",
  "traceId": "1-abc-def",
  "userId": "user_123",
  "message": "Save created",
  "data": {}
}
```

### Testing Requirements

- 80% minimum line coverage per package
- Unit tests for all exported functions
- Mock AWS SDK calls in db tests

### Dependencies

- **Blocks**: Story 1.3+ (all Lambda stories need shared libs)
- **Blocked by**: Story 1.1 (monorepo scaffold) - COMPLETE

## Dev Agent Record

### Agent Model Used

Claude Code / Cursor

### Completion Notes List

- Root package.json: added shared workspaces (backend/shared/types, logging, validation, db, middleware); added @vitest/coverage-v8 at root for workspace coverage.
- tsconfig.base.json: paths for @ai-learning-hub/types, logging, validation, db, middleware.
- All five packages: package.json, tsconfig (composite, ESM module/moduleResolution), vitest.config (coverage 80% thresholds), src + test; 80%+ line coverage met.
- types: errors.ts (ErrorCode, AppError, ApiErrorResponse), api.ts (ApiSuccessResponse, PaginationParams, AuthContext, etc.), entities.ts (User, Save, Project, ResourceType, ProjectStatus, etc.); index re-export test for coverage.
- logging: Logger (structured JSON, X-Ray traceId, API key redaction, levels), createLogger.
- validation: Zod schemas (uuid, url, pagination), validate, validateJsonBody, validatePathParams, formatZodErrors.
- db: DocumentClient with X-Ray, getItem, putItem, deleteItem, queryItems, updateItem, TableConfig.
- middleware: wrapHandler (requestId from header then requestContext), error-handler (createErrorResponse, normalizeError, handleError), auth (extractAuthContext, requireAuth, requireRole, requireScope).
- Vitest resolve aliases in validation, db, middleware so @ai-learning-hub/* resolve to source at test time (single AppError class instance).
- getRequestId: prefer x-request-id header over requestContext.requestId for client correlation ID.
- ESLint: argsIgnorePattern/varsIgnorePattern for unused _ prefixed vars. Lint and type-check pass.

### File List

- package.json (root: @vitest/coverage-v8)
- eslint.config.js (no-unused-vars argsIgnorePattern)
- backend/shared/types: package.json, tsconfig.json, vitest.config.ts, src/index.ts, api.ts, entities.ts, errors.ts, test/api.test.ts, entities.test.ts, errors.test.ts, index.test.ts
- backend/shared/logging: package.json, tsconfig.json, vitest.config.ts, src/index.ts, logger.ts, test/logger.test.ts
- backend/shared/validation: package.json, tsconfig.json, vitest.config.ts, src/index.ts, schemas.ts, validator.ts, test/schemas.test.ts, validator.test.ts
- backend/shared/db: package.json, tsconfig.json, vitest.config.ts, src/index.ts, client.ts, helpers.ts, test/client.test.ts, helpers.test.ts
- backend/shared/middleware: package.json, tsconfig.json, vitest.config.ts, src/index.ts, auth.ts, error-handler.ts, wrapper.ts, test/auth.test.ts, error-handler.test.ts, wrapper.test.ts
