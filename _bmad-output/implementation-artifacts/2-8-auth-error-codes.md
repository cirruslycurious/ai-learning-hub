# Story 2.8: Auth Error Codes

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **client developer**,
I want **consistent, machine-parseable auth error responses across all auth flows**,
so that **I can handle errors correctly (retry on rate-limit, re-auth on expired token, show invite UI when needed, etc.)**.

## Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | Any auth error occurs in middleware or handler (not authorizer) | Response sent to client | Error body uses ADR-008 format: `{ error: { code, message, requestId } }` |
| AC2 | Auth-specific errors | Error code returned | Uses one of: `EXPIRED_TOKEN`, `INVALID_API_KEY`, `REVOKED_API_KEY`, `SUSPENDED_ACCOUNT`, `SCOPE_INSUFFICIENT`, `INVITE_REQUIRED`, `INVALID_INVITE_CODE`, `RATE_LIMITED` |
| AC3 | Authorizer denies via `deny()` | API Gateway returns 403 | The `errorCode` string is available in authorizer context for future Gateway Response formatting (deferred — no RestApi exists yet) |
| AC4 | Scope middleware denies | Response returned | Returns 403 with `SCOPE_INSUFFICIENT` code and details of required vs actual scopes |
| AC5 | Rate limiter denies | Response returned | Returns 429 with `RATE_LIMITED` code and `Retry-After` header (already implemented in Story 2.7 — verify preserved) |

## Scope Constraints

### Deferred: API Gateway Gateway Responses (IMPORTANT)

**No API Gateway RestApi resource exists in the CDK codebase yet.** The `RateLimitingStack` at `infra/lib/stacks/api/rate-limiting.stack.ts` line 9 explicitly states: "It will be associated with the API Gateway REST API when the API stack is created (future epic)."

Therefore, **Gateway Response configuration is OUT OF SCOPE** for this story. This means:
- Authorizer `deny()` calls (SUSPENDED_ACCOUNT, INVITE_REQUIRED) will correctly pass errorCode in context, but the client receives a generic API Gateway 403 until Gateway Responses are configured.
- Authorizer `throw` calls (expired JWT, invalid API key) produce generic API Gateway 401 — API Gateway does NOT expose thrown error messages in response templates.
- When the API stack is created (future epic), Gateway Responses should be added to format authorizer errors as ADR-008 bodies. Use `$context.authorizer.errorCode` for `ACCESS_DENIED` type.

**What IS in scope:** Standardize error codes in the ErrorCode enum, update all middleware/handler error paths that flow through `wrapHandler` + `createErrorResponse` (scope, invite validation, rate limiting), and prepare authorizer `deny()` context values for future Gateway Response use.

### API Gateway Authorizer Throw Limitation

API Gateway does **not** expose Lambda authorizer throw messages in Gateway Response templates. When an authorizer throws, the client always receives `{"message": "Unauthorized"}` with 401, regardless of the throw message. Therefore:
- Keep `throw new Error("Unauthorized")` in authorizers for the 401 path — changing it has no client-visible effect.
- Use `deny(principalId, errorCode)` for 403 paths — the errorCode IS available in `$context.authorizer.errorCode` for future Gateway Response templates.

## Tasks / Subtasks

> **⚠️ Task Ordering:** Task 1 (ErrorCode enum + ErrorCodeToStatus map) MUST be completed first. Tasks 2-5 depend on it — `AppError` reads `ErrorCodeToStatus[code]` to determine `statusCode`, and TypeScript will not compile if new enum members lack map entries.

- [x] Task 1: Add auth-specific error codes to ErrorCode enum (AC: #2)
  - [x] 1.1 Add `EXPIRED_TOKEN`, `INVALID_API_KEY`, `REVOKED_API_KEY`, `SUSPENDED_ACCOUNT`, `SCOPE_INSUFFICIENT`, `INVITE_REQUIRED`, `INVALID_INVITE_CODE` to `ErrorCode` enum in `backend/shared/types/src/errors.ts`. Note: `RATE_LIMITED` already exists in the enum — do NOT add it again.
  - [x] 1.2 Add entries to `ErrorCodeToStatus` map (NOT `statusCodeMap` — that name does not exist): EXPIRED_TOKEN→401, INVALID_API_KEY→401, REVOKED_API_KEY→401, SUSPENDED_ACCOUNT→403, SCOPE_INSUFFICIENT→403, INVITE_REQUIRED→403, INVALID_INVITE_CODE→400. **CRITICAL:** `ErrorCodeToStatus` is typed as `Record<ErrorCode, number>` — every new enum member MUST have a corresponding entry or TypeScript will fail to compile.
  - [x] 1.3 Update `backend/shared/types/test/errors.test.ts`: add new codes to the "should have all expected error codes" test (lines 5-15) and add new entries to `ErrorCodeToStatus` test (lines 18-29)
  - [x] 1.4 Export new codes — verify barrel exports in `@ai-learning-hub/types` already re-export all ErrorCode members (they should via the enum)

- [x] Task 2: Update Scope Middleware to use SCOPE_INSUFFICIENT (AC: #4)
  - [x] 2.1 Change `ErrorCode.FORBIDDEN` → `ErrorCode.SCOPE_INSUFFICIENT` in `backend/shared/middleware/src/auth.ts` (~line 122, in `requireScope()`)
  - [x] 2.2 **ALSO** change `ErrorCode.FORBIDDEN` → `ErrorCode.SCOPE_INSUFFICIENT` in `backend/shared/middleware/src/wrapper.ts` (~lines 133-136, in the inline scope check within `wrapHandler`). This file has a DUPLICATE scope check that also uses FORBIDDEN. **IMPORTANT:** The `wrapper.ts` throw is currently missing the `details` parameter entirely — add `{ requiredScope: options.requiredScope, actualScopes: scopes }` as the third argument to the `AppError` constructor. The `auth.ts` version already passes details; `wrapper.ts` does not. Without this, AC4 is only partially met.
  - [x] 2.3 Verify `auth.ts` scope error already includes `{ requiredScope, keyScopes: scopes }` details (it does at ~line 122). Note: existing code uses `keyScopes` rather than `actualScopes` — keep existing name for backward compatibility.
  - [x] 2.4 Update `backend/shared/middleware/test/auth.test.ts`: change `ErrorCode.FORBIDDEN` → `ErrorCode.SCOPE_INSUFFICIENT` assertions at lines ~340 and ~416 for scope tests. **DO NOT change** role check assertions (~lines 280-288) — those should remain `ErrorCode.FORBIDDEN`.
  - [x] 2.5 Update `backend/shared/middleware/test/wrapper.test.ts` scope test (~lines 248-269): the current test only asserts `statusCode === 403` and does **NOT** check the error code at all. **ADD** an assertion: parse `result.body` and assert `body.error.code === "SCOPE_INSUFFICIENT"`. Without this, wrapper scope path has zero test coverage for the error code value.

- [x] Task 3: Update Invite Validation error codes (AC: #2)
  - [x] 3.1 Change `ErrorCode.VALIDATION_ERROR` → `ErrorCode.INVALID_INVITE_CODE` in `backend/functions/validate-invite/handler.ts` for all invalid/expired/revoked invite code errors (~lines 91-124). There are THREE throw sites — update ALL of them. **ALSO** remove the redundant `{ code: "INVALID_INVITE_CODE" }` from the `details` parameter at each site — the top-level `error.code` in the ADR-008 response will already be `INVALID_INVITE_CODE`, so `details.code` becomes confusing duplication. Replace with more useful details (e.g., `{ reason: "expired" }` or `{ reason: "revoked" }`) or omit details entirely.
  - [x] 3.2 Update `backend/functions/validate-invite/handler.test.ts`: change ALL 5 assertions from `"VALIDATION_ERROR"` to `"INVALID_INVITE_CODE"` at lines ~300, ~319, ~337, ~355, ~377.
  - [x] 3.3 Verify error response still matches ADR-008 format (code, message, requestId)

- [x] Task 4: Verify authorizer deny() context values are correct (AC: #3)
  - [x] 4.1 Verify JWT authorizer `deny(clerkId, "INVITE_REQUIRED")` passes correct code (~line 56 in handler.ts)
  - [x] 4.2 Verify JWT authorizer `deny(clerkId, "SUSPENDED_ACCOUNT")` passes correct code (~line 81)
  - [x] 4.3 Verify API Key authorizer `deny(userId, "SUSPENDED_ACCOUNT")` passes correct code (~line 91)
  - [x] 4.4 **DO NOT change** authorizer `throw new Error("Unauthorized")` calls — these produce generic 401 from API Gateway regardless of message (see Scope Constraints above)
  - [x] 4.5 Update authorizer tests to assert errorCode values in deny context objects

- [x] Task 5: Verify RATE_LIMITED preservation (AC: #5)
  - [x] 5.1 Verify `ErrorCode.RATE_LIMITED` + `Retry-After` header still works in `backend/shared/db/src/rate-limiter.ts` (~line 173) and `backend/shared/middleware/src/error-handler.ts` (~lines 27-33)
  - [x] 5.2 Run existing rate limiter tests — no changes expected, just regression verification

- [x] Task 6: Add contract tests for auth error codes flowing through middleware (AC: #1, #2, #4, #5)
  - [x] 6.1 Create `backend/shared/middleware/test/auth-error-codes.contract.test.ts`
  - [x] 6.2 Test each new error code (SCOPE_INSUFFICIENT, INVALID_INVITE_CODE) returns correct HTTP status and ADR-008 body shape when thrown as AppError through `createErrorResponse`
  - [x] 6.3 Test RATE_LIMITED includes `Retry-After` header in response
  - [x] 6.4 Verify `requestId` (X-Request-Id header) is present in all error responses
  - [x] 6.5 Use `expect.assertions()` in all error-path tests (lesson from Story 2.7)

- [x] Task 7: Run full test suite and verify 80% coverage (AC: all)
  - [x] 7.1 `npm test` passes
  - [x] 7.2 No regressions in existing auth tests (Stories 2.1-2.7)
  - [x] 7.3 Verify no broken imports from new ErrorCode enum members

## Dev Notes

### Critical Architecture Context

**ADR-008 Error Shape (MANDATORY for all responses flowing through middleware):**
```json
{
  "statusCode": 401,
  "body": {
    "error": {
      "code": "EXPIRED_TOKEN",
      "message": "JWT token has expired. Please re-authenticate.",
      "requestId": "correlation-id"
    }
  }
}
```

**ADR-013 Auth Error Code → HTTP Status Mapping:**
| Error Code | HTTP Status | When | Flows Through |
|---|---|---|---|
| EXPIRED_TOKEN | 401 | JWT expired or invalid signature | Authorizer throw (generic 401 until Gateway Responses exist) |
| INVALID_API_KEY | 401 | API key missing, malformed, or not found | Authorizer throw (generic 401 until Gateway Responses exist) |
| REVOKED_API_KEY | 401 | API key exists but revoked | Authorizer throw (generic 401 until Gateway Responses exist) |
| SUSPENDED_ACCOUNT | 403 | User account suspended | Authorizer deny() context (generic 403 until Gateway Responses exist) |
| INVITE_REQUIRED | 403 | User hasn't validated invite code | Authorizer deny() context (generic 403 until Gateway Responses exist) |
| SCOPE_INSUFFICIENT | 403 | API key lacks required scope | Middleware `wrapHandler` + `createErrorResponse` — ADR-008 formatted |
| INVALID_INVITE_CODE | 400 | Invite code invalid/expired/revoked | Handler `wrapHandler` + `createErrorResponse` — ADR-008 formatted |
| RATE_LIMITED | 429 | Rate limit exceeded (includes Retry-After) | Middleware `enforceRateLimit` + `createErrorResponse` — ADR-008 formatted |

### Error Flow Architecture (Two Distinct Paths)

**Path A — Middleware/Handler errors (in scope, ADR-008 formatted):**
```
Handler/Middleware throws AppError(ErrorCode.SCOPE_INSUFFICIENT, msg, details)
  → wrapHandler catches → createErrorResponse formats ADR-008 body
  → Client receives: { statusCode: 403, body: { error: { code, message, requestId } } }
```
Applies to: SCOPE_INSUFFICIENT, INVALID_INVITE_CODE, RATE_LIMITED

**Path B — Authorizer errors (partially in scope, generic responses until API stack exists):**
```
Authorizer calls deny(principalId, "SUSPENDED_ACCOUNT")
  → API Gateway sees IAM Deny → returns generic 403 {"message": "Forbidden"}
  → errorCode available in $context.authorizer.errorCode for FUTURE Gateway Responses
```
Applies to: SUSPENDED_ACCOUNT, INVITE_REQUIRED (via deny), EXPIRED_TOKEN/INVALID_API_KEY/REVOKED_API_KEY (via throw — always generic 401)

### API Key Authorizer Outer Catch Block (TRAP!)

**File:** `backend/functions/api-key-authorizer/handler.ts` lines 134-140

The outer catch block re-throws ALL errors as generic `new Error("Unauthorized")`:
```typescript
} catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message !== "Unauthorized") {
      logger.error("API key verification failed", err);
    }
    throw new Error("Unauthorized");
  }
```

**DO NOT attempt to change individual throws inside the try block** to specific error codes — they will all be swallowed by this outer catch. This is intentional for the authorizer path since API Gateway ignores throw messages anyway. The error codes for API key auth (INVALID_API_KEY, REVOKED_API_KEY) will only become useful when Gateway Responses are configured, which requires converting the throw path to a deny path — a design decision for the future API stack story.

### JWT Authorizer — Multiple Throw Sites

`backend/functions/jwt-authorizer/handler.ts` has TWO `throw new Error("Unauthorized")`:
- Line ~75: Profile not found after ensureProfile (server consistency error)
- Line ~102: JWT verification failed (expired/invalid token)

Both are authorizer throws → generic 401 from API Gateway. Do not change.

### Existing Code Inventory (What EXISTS vs What NEEDS CHANGE)

| File | Current State | Required Change |
|---|---|---|
| `backend/shared/types/src/errors.ts` | Generic ErrorCode enum (9 codes), `ErrorCodeToStatus` map | **ADD** 7 auth-specific codes to enum + 7 entries to `ErrorCodeToStatus` |
| `backend/shared/types/test/errors.test.ts` | Tests 9 codes + 9 status mappings | **UPDATE** tests to include 7 new codes |
| `backend/shared/middleware/src/error-handler.ts` | ADR-008 formatter; Retry-After for RATE_LIMITED | **NO CHANGE** — handles new codes automatically via `ErrorCodeToStatus` |
| `backend/shared/middleware/src/authorizer-policy.ts` | `deny()` passes errorCode in context | **NO CHANGE** |
| `backend/shared/middleware/src/auth.ts` | Uses `ErrorCode.FORBIDDEN` for scope errors (~line 122) | **CHANGE** → `ErrorCode.SCOPE_INSUFFICIENT` |
| `backend/shared/middleware/src/wrapper.ts` | DUPLICATE scope check uses `ErrorCode.FORBIDDEN` (~lines 133-136) | **CHANGE** → `ErrorCode.SCOPE_INSUFFICIENT` |
| `backend/shared/middleware/test/auth.test.ts` | Asserts FORBIDDEN for scope (~lines 340, 416) | **CHANGE** scope assertions → `SCOPE_INSUFFICIENT`. Keep role assertions as FORBIDDEN. |
| `backend/shared/middleware/test/wrapper.test.ts` | Scope assertions use FORBIDDEN | **CHANGE** scope assertions → `SCOPE_INSUFFICIENT` |
| `backend/shared/db/src/rate-limiter.ts` | Uses `ErrorCode.RATE_LIMITED` with retryAfter | **NO CHANGE** — verify only |
| `backend/functions/jwt-authorizer/handler.ts` | `deny()` with correct error codes; throws "Unauthorized" | **NO CHANGE** — throws are authorizer path |
| `backend/functions/api-key-authorizer/handler.ts` | `deny()` with SUSPENDED_ACCOUNT; throws "Unauthorized" | **NO CHANGE** — outer catch swallows specifics; throws are authorizer path |
| `backend/functions/validate-invite/handler.ts` | Uses `ErrorCode.VALIDATION_ERROR` for bad invite codes | **CHANGE** → `ErrorCode.INVALID_INVITE_CODE` |
| `backend/functions/validate-invite/handler.test.ts` | 5 assertions check `"VALIDATION_ERROR"` (lines ~300, 319, 337, 355, 377) | **CHANGE** all 5 → `"INVALID_INVITE_CODE"` |

### Project Structure Notes

- All shared types: `backend/shared/types/src/errors.ts` — single source of truth for error codes
- Error handler: `backend/shared/middleware/src/error-handler.ts` — formats all non-authorizer errors
- Scope middleware: `backend/shared/middleware/src/auth.ts` — `requireScope()` function
- Wrapper inline scope check: `backend/shared/middleware/src/wrapper.ts` — `wrapHandler` scope enforcement
- Authorizer policy helper: `backend/shared/middleware/src/authorizer-policy.ts` — already passes errorCode
- Test naming: handler tests co-located (`handler.test.ts`), shared package tests in `test/` subdirectory
- Contract tests: new file in `backend/shared/middleware/test/`

### Previous Story (2.7) Intelligence

**Learnings to apply:**
- Retry-After header must be set as HTTP header, not just in body — already done in error-handler.ts
- DynamoDB TTL was missing in 2.7 — pattern of infrastructure gaps; verify nothing similar here
- Tests need `expect.assertions()` for error paths — apply to all new error contract tests
- Commit style: `feat:` for new codes, `fix:` for correcting existing error responses, reference issue number

**Code patterns from 2.7:**
- Rate limiter uses `AppError` class with `ErrorCode` enum and details object
- Error handler checks `details.retryAfter` to set Retry-After header
- Tests mock DynamoDB client and validate full error response shape

### Future Work (Out of Scope)

When the API Gateway RestApi is created (future epic):
1. Add Gateway Response for `ACCESS_DENIED` type — use `$context.authorizer.errorCode` to format ADR-008 body
2. Add Gateway Response for `UNAUTHORIZED` type — generic ADR-008 body with code "UNAUTHORIZED" (cannot distinguish specific auth error)
3. Consider converting API key authorizer throw paths to deny paths to pass specific error codes (INVALID_API_KEY, REVOKED_API_KEY) — this would change HTTP status from 401 to 403

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-008 Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-013 Authentication Provider]
- [Source: docs/progress/epic-2-stories-and-plan.md — Story 2.8 Requirements]
- [Source: backend/shared/types/src/errors.ts — ErrorCode enum + ErrorCodeToStatus map]
- [Source: backend/shared/middleware/src/error-handler.ts — createErrorResponse formatter]
- [Source: backend/shared/middleware/src/authorizer-policy.ts — deny() helper]
- [Source: backend/shared/middleware/src/auth.ts — requireScope middleware]
- [Source: backend/shared/middleware/src/wrapper.ts — wrapHandler inline scope check]
- [Source: backend/functions/jwt-authorizer/handler.ts — JWT auth flow]
- [Source: backend/functions/api-key-authorizer/handler.ts — API key auth flow + outer catch block]
- [Source: backend/functions/validate-invite/handler.ts — Invite validation]
- [Source: backend/shared/db/src/rate-limiter.ts — Rate limit errors]
- [Source: infra/lib/stacks/api/rate-limiting.stack.ts — "API stack created future epic" comment]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
