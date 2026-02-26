---
id: "3.2.2"
title: "Consistent Error Contract & Response Envelope"
status: ready-for-dev
depends_on: []
touches:
  - backend/shared/types
  - backend/shared/validation
  - backend/shared/middleware
risk: low
---

# Story 3.2.2: Consistent Error Contract & Response Envelope

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer building agent-native API endpoints**,
I want **a consistent error contract with actionable context and a standardized response envelope in `@ai-learning-hub/middleware`**,
so that **all API responses — success and error — follow a single parseable shape, enabling AI agents to understand failures, determine next actions, and navigate paginated data without special-casing per endpoint**.

## Acceptance Criteria

### Enhanced Error Contract (FR100, NFR-AN7)

1. **AC1: Extended error body shape** — All error responses follow the shape: `{ error: { code, message, requestId, details?, currentState?, allowedActions?, requiredConditions? } }`. The three new fields (`currentState`, `allowedActions`, `requiredConditions`) are optional and present only when semantically relevant. The existing `code`, `message`, `requestId` fields remain mandatory. The existing `details` field remains an optional catch-all object. **Naming convention:** camelCase is used to match the existing `requestId` field, even though the PRD uses snake_case. The JSON wire format is camelCase throughout.

2. **AC2: State machine error enrichment** — When an error has `currentState` set (e.g., a future `INVALID_STATE_TRANSITION` error), the response includes `currentState` (string — the entity's current lifecycle state) and `allowedActions` (string array — the transitions valid from that state). This gives agents machine-readable context to choose the correct next action. Example: `{ error: { code: "INVALID_STATE_TRANSITION", message: "Cannot complete a paused project", currentState: "paused", allowedActions: ["resume", "delete"] } }`.

3. **AC3: Error builder helpers** — A new `AppErrorBuilder` in `@ai-learning-hub/types` provides a fluent API: `AppError.build(ErrorCode.FORBIDDEN, "msg").withState("paused", ["resume"]).withConditions(["must resume first"]).create()`. The builder is optional syntactic sugar — direct `new AppError(...)` still works. Builder sets the new fields via the existing `details` mechanism internally, and `toApiError()` promotes them to top-level error fields in the output.

4. **AC4: New error code — INVALID_STATE_TRANSITION** — `ErrorCode` enum extended with `INVALID_STATE_TRANSITION` mapped to HTTP 409. This code is defined now for future use by state machine middleware (Epic 3.2 Story 3.2.7+ and Epics 4, 8). Handlers are not required to use it yet.

5. **AC5: Backward compatibility & field promotion** — Existing error responses that do not set `currentState`, `allowedActions`, or `requiredConditions` remain unchanged. The `toApiError()` method only includes these fields when they have values. When promoted, these fields are **removed from `details`** to avoid duplication (single source of truth). If `details` becomes empty after stripping promoted fields, it is omitted from the response entirely. No existing tests break.

### Field-Level Validation Errors (FR101)

6. **AC6: Enhanced ValidationErrorDetail** — The `ValidationErrorDetail` interface in `@ai-learning-hub/validation` gains two optional fields: `constraint?: string` (human-readable constraint description, e.g., "minimum 1 character") and `allowed_values?: string[]` (list of valid values for enum fields, e.g., `["article", "video", "podcast"]`). Existing `field`, `message`, `code` fields remain.

7. **AC7: Zod error extraction — constraints** — `formatZodErrors` extracts constraint information from Zod error metadata where available: `too_small` errors include minimum value, `too_big` errors include maximum value, `invalid_string` errors include the expected format (e.g., "email", "url", "uuid"), `invalid_enum_value` errors include the allowed options as `allowed_values`. When Zod does not expose constraint info, the `constraint` field is omitted.

8. **AC8: Validation error response shape** — Validation errors use the standard error body with `details` containing a `fields` array: `{ error: { code: "VALIDATION_ERROR", message: "Validation failed", requestId, details: { fields: [{ field, code, message, constraint?, allowed_values? }] } } }`. The key is renamed from `errors` to `fields` to be more explicit and avoid ambiguity with the top-level `error` key. Existing handlers that throw `AppError(VALIDATION_ERROR, msg, { errors: [...] })` are migrated to use `{ fields: [...] }` instead. (The migration is confined to `validate()` in `@ai-learning-hub/validation` — handlers don't construct this manually.)

### Response Envelope (FR100 — success responses)

9. **AC9: Standard envelope shape** — All success responses (2xx) follow: `{ data: T | T[], meta?: { cursor?: string | null, total?: number, rateLimit?: { limit: number, remaining: number, reset: string } }, links?: { self: string, next?: string | null } }`. The `data` field wraps the primary payload. `meta` is included only when at least one sub-field is populated; omitted entirely otherwise. `links` is included only when `self` is provided; omitted entirely otherwise. Empty objects (`meta: {}`, `links: {}`) are never sent. Single-resource GETs typically omit both `meta` and `links`.

10. **AC10: createSuccessResponse enhancement** — The existing `createSuccessResponse` function is updated to use an options object for extensibility. New signature: `createSuccessResponse<T>(data: T, requestId: string, options?: { statusCode?: number, meta?: EnvelopeMeta, links?: ResponseLinks })`. The function builds the envelope, sets `Content-Type` and `X-Request-Id` headers, and returns the API Gateway response. Existing callers passing `(data, requestId)` continue to work (options defaults to `{}`). All existing callers that use the old positional form `(data, requestId, statusCode, meta)` are migrated to the new options form in this story — no overload detection needed since there are only ~5-8 call sites in the codebase.

11. **AC11: ApiResponseMeta type update** — The existing `ApiResponseMeta` interface is replaced with the new `EnvelopeMeta` interface: `{ cursor?: string | null, total?: number, rateLimit?: RateLimitMeta }`. The deprecated `page`, `pageSize`, `nextCursor`, `prevCursor` fields are removed (they are not used by any handler in the codebase — verified via grep). A new `ResponseLinks` interface is added: `{ self: string, next?: string | null }`. A new `RateLimitMeta` interface is added: `{ limit: number, remaining: number, reset: string }`. The `reset` field is an ISO 8601 datetime string (e.g., `"2026-02-25T13:00:00Z"`) per ADR-014.

12. **AC12: 204 No Content exclusion** — `createNoContentResponse` is unchanged. 204 responses have no body and are exempt from the envelope requirement.

13. **AC13: Backward compatibility — success shape** — Existing handlers that return plain objects from `wrapHandler` (auto-wrapped via `createSuccessResponse`) continue to work. They produce `{ data: <object> }` with no `meta` or `links`. All existing callers of `createSuccessResponse` that use the old positional form are migrated to the new options form in Task 4.

### Type Safety & Exports

14. **AC14: New types exported** — All new types exported from `@ai-learning-hub/types` index: `EnvelopeMeta`, `RateLimitMeta`, `ResponseLinks`, `ResponseEnvelope<T>`, `FieldValidationError`. The `AppErrorBuilder` class is NOT exported separately — it is an internal implementation detail, accessible only via `AppError.build()`. This ensures a single canonical path for building enhanced errors.

15. **AC15: Updated type imports** — All new types and the builder are importable from `@ai-learning-hub/types` and `@ai-learning-hub/middleware` (re-exported where used). No new packages created.

### Testing

16. **AC16: Unit tests — error contract** — Tests cover: basic error shape unchanged, error with `currentState` + `allowedActions`, error with `requiredConditions`, `INVALID_STATE_TRANSITION` error code, `AppErrorBuilder` fluent API, backward compatibility (existing AppError calls produce same output). Minimum 90% coverage for new error contract code.

17. **AC17: Unit tests — field-level validation** — Tests cover: Zod `too_small` → constraint extracted, Zod `too_big` → constraint extracted, Zod `invalid_enum_value` → `allowed_values` extracted, Zod `invalid_string` → format constraint extracted, nested field paths, `fields` key in validation error details. Minimum 90% coverage.

18. **AC18: Unit tests — response envelope** — Tests cover: basic `{ data }` envelope, envelope with `meta.cursor` + `meta.total`, envelope with `meta.rateLimit`, envelope with `links.self` + `links.next`, 204 responses unchanged, backward compatibility with existing `createSuccessResponse` callers (both old positional and new options forms). Minimum 90% coverage.

19. **AC19: wrapHandler normalization preserves new fields** — The ADR-008 normalization path in `wrapHandler` (which normalizes 4xx/5xx pass-through responses) preserves `currentState`, `allowedActions`, and `requiredConditions` fields when present in the error body. A handler that returns a raw API Gateway result with these fields does not have them stripped.

20. **AC20: Integration contract tests** — Test that the full middleware chain produces the correct envelope: wrapHandler auto-wraps handler return values in `{ data }`. Verify error responses include all specified fields. Verify existing handler tests still pass without modification (beyond the `errors` → `fields` key rename in validation error assertions).

## Tasks / Subtasks

### Task 1: Enhanced Error Types & Builder (AC: #1, #3, #4, #5, #14)

- [ ] 1.1 Add `INVALID_STATE_TRANSITION` to `ErrorCode` enum in `@ai-learning-hub/types/src/errors.ts`
- [ ] 1.2 Add status code mapping `INVALID_STATE_TRANSITION → 409` to `ErrorCodeToStatus`
- [ ] 1.3 Extend `ApiErrorBody` interface with optional fields: `currentState?: string`, `allowedActions?: string[]`, `requiredConditions?: string[]`
- [ ] 1.4 Update `AppError.toApiError()` to promote `currentState`, `allowedActions`, `requiredConditions` from `details` to top-level error fields when present
- [ ] 1.5 Create `AppErrorBuilder` class with fluent API: `.withState(currentState, allowedActions)`, `.withConditions(conditions)`, `.withDetails(details)`, `.create()`
- [ ] 1.6 Add static `AppError.build(code, msg)` factory method that returns an internal `AppErrorBuilder` instance. Do NOT export `AppErrorBuilder` as a standalone class — it is only accessible via `AppError.build()`
- [ ] 1.7 Write unit tests for new error code, builder, and toApiError promotion

### Task 2: Enhanced Validation Error Formatting (AC: #6, #7, #8)

- [ ] 2.1 Extend `ValidationErrorDetail` interface with `constraint?: string` and `allowed_values?: string[]`
- [ ] 2.2 Update `formatZodErrors` to extract constraint info from Zod error metadata: `too_small` → `"minimum {minimum}"`, `too_big` → `"maximum {maximum}"`, `invalid_enum_value` → `allowed_values: options`, `invalid_string` → `"expected {validation}"`
- [ ] 2.3 Update `validate()` to use `{ fields: [...] }` instead of `{ errors: [...] }` in AppError details
- [ ] 2.4 Update `validateJsonBody`, `validateQueryParams`, `validatePathParams` to use consistent `fields` key
- [ ] 2.5 Export updated `ValidationErrorDetail` (alias as `FieldValidationError`) from package index
- [ ] 2.6 Write unit tests for enhanced formatZodErrors (all Zod error types: too_small, too_big, invalid_enum_value, invalid_string, nested fields)

### Task 3: Response Envelope Types (AC: #9, #11, #14)

- [ ] 3.1 Create `EnvelopeMeta` interface in `@ai-learning-hub/types/src/api.ts`: `{ cursor?: string | null, total?: number, rateLimit?: RateLimitMeta }`
- [ ] 3.2 Create `RateLimitMeta` interface: `{ limit: number, remaining: number, reset: string }`
- [ ] 3.3 Create `ResponseLinks` interface: `{ self: string, next?: string | null }`
- [ ] 3.4 Create `ResponseEnvelope<T>` generic type: `{ data: T, meta?: EnvelopeMeta, links?: ResponseLinks }`
- [ ] 3.5 Remove deprecated `page`, `pageSize`, `nextCursor`, `prevCursor` from `ApiResponseMeta` (replace with `EnvelopeMeta`)
- [ ] 3.6 Export all new types from `@ai-learning-hub/types` index
- [ ] 3.7 Write type-level tests verifying generic type compatibility

### Task 4: Middleware Response Envelope Implementation (AC: #10, #12, #13)

- [ ] 4.1 Update `createSuccessResponse` to use options object pattern: `(data, requestId, options?: { statusCode?, meta?, links? })`
- [ ] 4.2 Migrate all existing callers of `createSuccessResponse` to the new options form:
  - `backend/functions/saves/handler.ts` — `createSuccessResponse(toPublicSave(saveItem), requestId, 201)` → `createSuccessResponse(toPublicSave(saveItem), requestId, { statusCode: 201 })`
  - `backend/functions/saves/handler.ts` (restore path) — `createSuccessResponse(..., requestId, 200)` → `createSuccessResponse(..., requestId, { statusCode: 200 })`
  - Any other callers found via grep for `createSuccessResponse(` across `backend/functions/`
- [ ] 4.3 Build response body as `{ data, meta?, links? }` — omit `meta` when empty/undefined, omit `links` when empty/undefined (never send `meta: {}` or `links: {}`)
- [ ] 4.4 Verify `createNoContentResponse` remains unchanged (204, no body)
- [ ] 4.5 Update `wrapHandler` auto-wrap path: handler results wrapped as `{ data: result }` (existing behavior preserved)
- [ ] 4.6 Export updated types from `@ai-learning-hub/middleware` index
- [ ] 4.7 Write unit tests for all envelope scenarios

### Task 5: Enhanced Error Response Formatting (AC: #2, #5, #19)

- [ ] 5.1 Update `createErrorResponse` in `error-handler.ts` to extract `currentState`, `allowedActions`, `requiredConditions` from `AppError.details` and include them as top-level fields in the error body (strip from `details` to avoid duplication)
- [ ] 5.2 Ensure existing errors without these fields produce identical output (backward compatibility)
- [ ] 5.3 Update ADR-008 normalization in `wrapHandler` (the 4xx/5xx pass-through path at lines 180-211) to preserve `currentState`, `allowedActions`, `requiredConditions` fields when present in parsed error bodies
- [ ] 5.4 Write unit tests for enhanced error response formatting and normalization preservation

### Task 6: Validation Error Migration (AC: #8)

Known locations using `{ errors: [...] }` key (exhaustive as of story creation):
- `backend/shared/validation/src/validator.ts` — `validate()` function (line 36)
- `backend/shared/validation/test/validator.test.ts` — test assertions checking `details.errors` or `errors` array
- Any handler integration tests that assert on validation error shape

- [ ] 6.1 Verify the known locations above with a grep for `errors:` near `VALIDATION_ERROR` — confirm no additional locations exist
- [ ] 6.2 Update `validate()` in `backend/shared/validation/src/validator.ts` to use `{ fields: [...] }` key
- [ ] 6.3 Update `backend/shared/validation/test/validator.test.ts` assertions from `details.errors` / `errors` to `details.fields` / `fields`
- [ ] 6.4 Grep for any handler-level tests asserting on `details.errors` and update them
- [ ] 6.5 Write migration verification test that confirms no response in the test suite uses `details.errors` key

### Task 7: Integration & Contract Tests (AC: #19, #20)

- [ ] 7.1 Integration test: wrapHandler auto-wraps plain object → `{ data: <object> }`
- [ ] 7.2 Integration test: wrapHandler with explicit `createSuccessResponse` + envelope meta (options object form)
- [ ] 7.3 Integration test: error response includes `currentState` and `allowedActions` when set
- [ ] 7.5 Integration test: 4xx pass-through normalization preserves `currentState`, `allowedActions`, `requiredConditions`
- [ ] 7.6 Integration test: validation error includes `fields` array with constraints
- [ ] 7.7 Integration test: backward compatibility — existing handler return patterns unchanged
- [ ] 7.8 Verify all existing middleware and handler tests still pass

## Dev Notes

### Architecture Patterns & Constraints

- **ADR-008 (Standardized Error Handling):** This story extends ADR-008's error contract for agent-native consumption. The base shape `{ error: { code, message, requestId } }` is preserved. New fields are additive (optional), maintaining full backward compatibility.
- **ADR-014 (API-First Design):** The response envelope and enhanced error contract are driven by API-first philosophy — agents parse one response shape for all endpoints.
- **ADR-015 (Lambda Layers):** All changes are in shared packages (`@ai-learning-hub/types`, `@ai-learning-hub/middleware`, `@ai-learning-hub/validation`), deployed via Lambda Layer.
- **No Lambda-to-Lambda (ADR-005):** This story is pure middleware/shared code — no inter-service calls.
- **FR100:** Error contract: `{ code, message, details, currentState, allowedActions, requiredConditions }` (camelCase in JSON; PRD uses snake_case — project convention is camelCase per existing `requestId`)
- **FR101:** Field-level validation: `{ field, code, message, constraint, allowed_values }`
- **NFR-AN7:** 100% of error responses include `code`, `message`; state machine errors include `allowed_actions`

### Existing Code to Extend

| Package | File | Changes |
|---------|------|---------|
| `@ai-learning-hub/types` | `src/errors.ts` | Add `INVALID_STATE_TRANSITION` to ErrorCode, extend `ApiErrorBody`, add `AppErrorBuilder` |
| `@ai-learning-hub/types` | `src/api.ts` | Replace `ApiResponseMeta` with `EnvelopeMeta`, add `RateLimitMeta`, `ResponseLinks`, `ResponseEnvelope<T>` |
| `@ai-learning-hub/types` | `src/index.ts` | Export new types |
| `@ai-learning-hub/validation` | `src/validator.ts` | Enhance `ValidationErrorDetail`, update `formatZodErrors` for constraint extraction, rename `errors` → `fields` |
| `@ai-learning-hub/validation` | `src/index.ts` | Export `FieldValidationError` alias |
| `@ai-learning-hub/middleware` | `src/error-handler.ts` | Enhance `createErrorResponse` for new fields, update `createSuccessResponse` for envelope |
| `@ai-learning-hub/middleware` | `src/wrapper.ts` | Ensure auto-wrap path produces correct envelope |
| `@ai-learning-hub/middleware` | `src/index.ts` | Export new types |

### Current Response Shapes (Before This Story)

**Error response (current):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "requestId": "abc-123",
    "details": {
      "errors": [{ "field": "url", "message": "Required", "code": "invalid_type" }]
    }
  }
}
```

**Error response (after this story):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "requestId": "abc-123",
    "details": {
      "fields": [
        {
          "field": "url",
          "message": "Required",
          "code": "invalid_type",
          "constraint": "minimum 1 character"
        }
      ]
    }
  }
}
```

**State machine error (new pattern):**
```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Cannot complete a paused project",
    "requestId": "abc-123",
    "currentState": "paused",
    "allowedActions": ["resume", "delete"],
    "requiredConditions": ["Project must be in 'building' state to complete"]
  }
}
```

**Success response (current):**
```json
{
  "data": { "saveId": "01HX...", "url": "https://..." }
}
```

**Success response with envelope (after):**
```json
{
  "data": [{ "saveId": "01HX...", "url": "https://..." }],
  "meta": {
    "cursor": "eyJ...",
    "total": 42,
    "rateLimit": { "limit": 200, "remaining": 198, "reset": "2026-02-25T13:00:00Z" }
  },
  "links": {
    "self": "/saves?limit=25",
    "next": "/saves?limit=25&cursor=eyJ..."
  }
}
```

### Breaking Change: `errors` → `fields` Key Rename

The validation error details key changes from `errors` to `fields`. This is a minor breaking change for consumers that parse `details.errors`. The rename is necessary because:
- `errors` is ambiguous (could be confused with the top-level `error` key)
- `fields` is more descriptive for field-level validation detail
- FR101 specifies the field-level detail structure — `fields` aligns with the FR wording

**Migration scope:** The change is isolated to `validate()` in `@ai-learning-hub/validation`. All handlers use `validate()` or `validateJsonBody()` — none construct the details manually. Test assertions checking `details.errors` need updating to `details.fields`.

### AppErrorBuilder Pattern

```typescript
// Simple error (existing pattern still works)
throw new AppError(ErrorCode.FORBIDDEN, "Insufficient permissions");

// Enhanced error with state context (new builder)
throw AppError.build(ErrorCode.INVALID_STATE_TRANSITION, "Cannot complete a paused project")
  .withState("paused", ["resume", "delete"])
  .withConditions(["Project must be in 'building' state to complete"])
  .create();

// Enhanced error with custom details + state
throw AppError.build(ErrorCode.CONFLICT, "Version conflict")
  .withDetails({ currentVersion: 5 })
  .withState("modified", ["re-read", "retry"])
  .create();
```

### Relationship to Other 3.2 Stories

- **3.2.1 (Idempotency & Concurrency):** Adds error codes `VERSION_CONFLICT`, `PRECONDITION_REQUIRED`, `IDEMPOTENCY_KEY_CONFLICT`. Those errors benefit from the enhanced contract (e.g., `VERSION_CONFLICT` can include `current_state`). 3.2.2 does NOT depend on 3.2.1 — both are shared infra that can be built in parallel.
- **3.2.3 (Event History):** No dependency in either direction.
- **3.2.4 (Agent Identity & Rate Limit):** Rate limit transparency headers (`X-RateLimit-*`) will populate `meta.rate_limit` in the envelope. 3.2.4 can use the envelope types defined here. No hard dependency.
- **3.2.5 (Cursor Pagination):** Cursor pagination will populate `meta.cursor` and `links.next`. 3.2.5 uses the envelope types defined here. No hard dependency.
- **3.2.7 (Saves Retrofit):** Will use the envelope, error contract, and builder when retrofitting saves handlers. Depends on this story.
- **3.2.8 (Auth Retrofit):** Same as 3.2.7 for auth handlers.

### Scope Boundaries

- **Non-goal: Retrofitting existing handlers.** This story creates the infrastructure (types, helpers, middleware). Actual handler retrofits to use the full envelope with `meta` and `links` are in Stories 3.2.7 and 3.2.8.
- **Non-goal: Rate limit header population.** The `rateLimit` field in `meta` is defined here but populated by Story 3.2.4 (Agent Identity & Rate Limit Transparency).
- **Non-goal: Cursor pagination implementation.** The `cursor` field in `meta` and `next` in `links` are defined here but populated by Story 3.2.5 (Cursor-Based Pagination).
- **Non-goal: Domain-specific error payloads.** The saves handler's `DUPLICATE_SAVE` response currently places `existingSave` as a sibling of `error` (e.g., `{ error: {...}, existingSave: {...} }`). Normalizing domain-specific error payloads into `error.details` or the envelope `data` field is deferred to Story 3.2.7 (Saves Retrofit). This story does not change existing handler response construction.
- **Non-goal: `links` population.** The `links` types are defined here, but populating `links.self` and `links.next` requires request context (path, query params) that is the handler's responsibility. Actual `links` population is deferred to retrofit stories (3.2.7, 3.2.8) which have access to request context.
- **Goal: The `errors` → `fields` rename IS in scope.** This is a one-time migration that's cleanest to do now, before more handlers are added.

### Testing Standards

- **Framework:** Vitest (already used across all shared packages)
- **Coverage target:** 90% for new code (above the 80% CI gate)
- **Test location:** Co-located `test/` directories in each shared package
- **Mock pattern:** Use `vi.mock()` for any mocked dependencies, following existing patterns
- **Test factories:** Use existing `backend/test-utils/` mock helpers where applicable

### Key Technical Decisions

1. **camelCase for new error fields:** The PRD specifies `current_state`, `allowed_actions`, `required_conditions` (snake_case), but the existing API uses camelCase throughout (`requestId`, `saveId`, `contentType`). Decision: use camelCase (`currentState`, `allowedActions`, `requiredConditions`) for consistency. The PRD's snake_case is treated as conceptual naming, not wire format.
2. **Promote fields from `details` in `toApiError()`:** The `currentState`, `allowedActions`, `requiredConditions` are stored internally as `details` properties (keeping `AppError` constructor simple) but are promoted to top-level error body fields in `toApiError()`. This avoids adding constructor parameters while giving a clean API output.
3. **Static `AppError.build()` factory — single canonical path:** The builder is a static method on `AppError` for discoverability. `AppError.build(code, msg)` returns an internal `AppErrorBuilder` (not exported) that collects state/conditions/details and produces the final `AppError` via `.create()`. This ensures one way to build enhanced errors — no competing imports.
4. **Options object for `createSuccessResponse` — no overload:** The new signature uses `(data, requestId, options?)` instead of positional parameters. All existing callers (~5-8 call sites) are migrated to the new form in this story. No overload detection is needed — simpler implementation, fewer edge cases.
5. **`EnvelopeMeta` replaces `ApiResponseMeta`:** The old type had `page`/`pageSize` fields that are incompatible with cursor pagination. Grep confirms no handler uses these fields — safe to remove. A type alias `ApiResponseMeta = EnvelopeMeta` can be kept briefly for transition if needed, but the old-shape fields (`page`, `pageSize`, `nextCursor`, `prevCursor`) must be removed.
6. **`fields` not `errors` for validation details:** The rename from `errors` to `fields` is deliberate — `errors` is confusing inside an `error` wrapper. FR101 says "field-level detail" so `fields` is the natural key.
7. **No CDK changes required:** This story is entirely shared library code. No new DynamoDB tables, no new Lambda functions, no infrastructure changes.

### Project Structure Notes

- All changes go into existing shared packages — no new packages created
- No new npm dependencies required
- No CDK stack changes
- File changes are confined to `backend/shared/types/`, `backend/shared/validation/`, and `backend/shared/middleware/`

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Error Contract] — FR100 (consistent error contract), FR101 (field-level validation)
- [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements] — NFR-AN7 (100% error responses include code, message; state machine errors include allowed_actions)
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008] — Standardized error handling baseline
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-014] — API-first design, consistent response shapes
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-015] — Lambda Layers for shared code
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3.2] — Story definition and dependencies
- [Source: backend/shared/middleware/src/error-handler.ts] — Current error response builder (createErrorResponse, createSuccessResponse)
- [Source: backend/shared/middleware/src/wrapper.ts] — Current wrapHandler middleware chain and auto-wrap logic
- [Source: backend/shared/types/src/errors.ts] — Current ErrorCode enum, AppError class, ApiErrorBody interface
- [Source: backend/shared/types/src/api.ts] — Current ApiResponseMeta, ApiSuccessResponse types
- [Source: backend/shared/validation/src/validator.ts] — Current formatZodErrors, validate, ValidationErrorDetail

### Git Intelligence

Recent work (Epic 3.1) established patterns for:
- Shared schema extraction to `@ai-learning-hub/*` packages (PR #194)
- Shared test utilities in `backend/test-utils/` (PR #196)
- Handler consolidation using shared middleware (PR #198)
- Scope enforcement middleware in the handler pipeline (PR #204)

The error-handler.ts patterns from Epic 2 (PRs #123-#143) are the baseline being extended. The `createSuccessResponse` with `ApiResponseMeta` was added during saves list implementation (PR #186) and already wraps responses in `{ data, meta? }` — this story enhances that existing pattern.

### Previous Story Intelligence

Story 3.2.1 (Idempotency & Optimistic Concurrency) established:
- Pattern for extending `WrapperOptions` with new middleware flags
- Pattern for new error codes (`VERSION_CONFLICT`, `PRECONDITION_REQUIRED`, `IDEMPOTENCY_KEY_CONFLICT`)
- Pattern for response headers added by middleware (`X-Idempotent-Replayed`, `X-Idempotency-Status`)
- Pattern for `details` object carrying transport-only metadata (`responseHeaders`)

This story follows the same patterns: extending types, enhancing middleware, maintaining backward compatibility. The `responseHeaders` stripping in `createErrorResponse` (lines 27-44 of error-handler.ts) is a precedent for separating transport metadata from body content — the same principle applies to promoting `currentState`/`allowedActions` from details to top-level error fields.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
