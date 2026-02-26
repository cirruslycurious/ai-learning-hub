---
id: "3.2.4"
title: "Agent Identity, Context & Rate Limit Transparency"
status: ready-for-dev
depends_on: []
touches:
  - backend/shared/types/src/api.ts
  - backend/shared/types/src/events.ts
  - backend/shared/middleware/src/wrapper.ts
  - backend/shared/middleware/src/agent-identity.ts
  - backend/shared/middleware/src/rate-limit-headers.ts
  - backend/shared/middleware/src/index.ts
  - backend/shared/middleware/test/agent-identity.test.ts
  - backend/shared/middleware/test/rate-limit-headers.test.ts
  - backend/shared/validation/src/schemas.ts
  - backend/shared/validation/src/index.ts
  - backend/shared/db/src/rate-limiter.ts
  - infra/lib/stacks/api/api-gateway.stack.ts
risk: low
---

# Story 3.2.4: Agent Identity, Context & Rate Limit Transparency

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer building agent-native APIs,
I want shared middleware that extracts agent identity from request headers, provides a schema for context metadata pass-through, and adds rate limit transparency headers to all responses,
so that AI agents can self-identify on every request, provide context for their actions that flows into event history, and proactively self-throttle based on transparent rate limit information without discovering limits via 429 errors.

## Acceptance Criteria

### Agent Identity Middleware (FR103)

1. **AC1: X-Agent-ID header extraction** — Middleware extracts the `X-Agent-ID` header from incoming requests (case-insensitive lookup via `event.headers`). If the header is present and valid, `actorType` is set to `"agent"` and `agentId` is set to the header value. If the header is absent, `actorType` is set to `"human"` and `agentId` is set to `null`. Extraction runs on EVERY request — no opt-in flag needed.

2. **AC2: X-Agent-ID format validation** — The `X-Agent-ID` value must be a non-empty string, 1-128 characters, matching `^[a-zA-Z0-9_\-\.]+$`. Invalid format returns `400 VALIDATION_ERROR` with message "X-Agent-ID header must be 1-128 characters matching [a-zA-Z0-9_\\-.]+" and `details: { fields: [{ field: "X-Agent-ID", code: "invalid_format", message: "..." }] }`.

3. **AC3: HandlerContext enhancement** — `HandlerContext` gains two new fields: `agentId: string | null` and `actorType: ActorType` (imported from `@ai-learning-hub/types`). All handlers can access `ctx.agentId` and `ctx.actorType`. Existing handlers that don't use these fields are unaffected (backward-compatible).

4. **AC4: X-Agent-ID response echo** — All responses (success and error) include an `X-Agent-ID` response header echoing back the validated agent ID when present. When no agent ID was provided, the header is omitted. This lets agents confirm their identity was received.

### Context Metadata Pass-Through (FR104)

5. **AC5: Event context Zod schema** — A shared `eventContextSchema` Zod schema is added to `@ai-learning-hub/validation`: `z.object({ trigger: z.string().max(100).optional(), source: z.string().max(200).optional(), confidence: z.number().min(0).max(1).optional(), upstream_ref: z.string().max(500).optional() }).strict().optional()`. This validates the `context` field from request bodies. The schema is exported for handler-level body validation — it is NOT automatically parsed by `wrapHandler` (context is in the request body, not a header, so it's the handler's responsibility to parse it from the body schema).

6. **AC6: Context type alignment** — The `EventContext` type from `@ai-learning-hub/types/src/events.ts` (already defined in Story 3.2.3) is used as the TypeScript type. The Zod schema's inferred type matches `EventContext`. No new type definitions needed — this AC confirms alignment between the Zod schema and existing types.

### Rate Limit Transparency Headers (FR103, ADR-014)

7. **AC7: Rate limit headers on all rate-limited responses** — When rate limiting is active for an endpoint, ALL responses (2xx, 4xx, 5xx) include:
   - `X-RateLimit-Limit: <number>` — the rate limit ceiling for the current window
   - `X-RateLimit-Remaining: <number>` — requests remaining in the current window (`limit - current`, minimum 0)
   - `X-RateLimit-Reset: <unix epoch seconds>` — when the current rate limit window resets (e.g., `1740578400`). Unix epoch seconds for header (industry standard per GitHub, Stripe, Twitter APIs). The JSON body `meta.rateLimit.reset` remains ISO 8601 per ADR-014.

   These headers are present on successful responses, validation errors, not-found errors — every response from a rate-limited endpoint. 429 responses additionally include `Retry-After: <seconds>` (existing behavior from ADR-008).

8. **AC8: Rate limit middleware in wrapHandler** — `WrapperOptions` gains a new `rateLimit?: RateLimitMiddlewareConfig` field. When set, `wrapHandler`:
   - Calls `incrementAndCheckRateLimit()` AFTER auth extraction but BEFORE handler execution
   - Derives the identifier from `userId` (default) or `sourceIp` (configurable)
   - If rate limit exceeded: throws `RATE_LIMITED` error with rate limit headers + `Retry-After` header
   - If allowed: stores `RateLimitResult` in `HandlerContext` as `ctx.rateLimitResult`
   - After handler execution: adds rate limit headers to the response automatically

9. **AC9: RateLimitMiddlewareConfig interface** — The config interface:
   ```typescript
   interface RateLimitMiddlewareConfig {
     operation: string;
     windowSeconds: number;
     limit: number | ((auth: AuthContext | null) => number);
     identifierSource?: 'userId' | 'sourceIp';
   }
   ```
   - `limit` can be a static number OR a function receiving the auth context (for tier-based limits based on API key scope). If `limit` is a function and it throws, log WARN and skip rate limiting entirely (fail-open). The function MUST handle `null` auth gracefully.
   - `identifierSource` defaults to `'userId'`; `'sourceIp'` uses `event.requestContext.identity.sourceIp`
   - `operation` is the rate limit counter key (e.g., `"saves-write"`)

10. **AC10: Rate limit header utility** — A standalone `addRateLimitHeaders(response, rateLimitResult, windowSeconds)` utility function decorates any `APIGatewayProxyResult` with the three rate limit headers. This utility is exported for handlers that manage rate limiting outside `wrapHandler` (backward-compatible bridge for existing handlers during retrofit in 3.2.7/3.2.8).

11. **AC11: Endpoints without rate limiting** — Endpoints that do not set `rateLimit` in `WrapperOptions` do NOT emit rate limit headers. No fake or placeholder values are sent. Rate limit headers are only present when actual rate limit data is available.

12. **AC12: EnvelopeMeta.rateLimit population** — When rate limit data is available and `createSuccessResponse` is used with `meta` options, the `rateLimit` field in `EnvelopeMeta` is populated with `{ limit, remaining, reset }`. Note: `reset` in the JSON body is ISO 8601 (per ADR-014), NOT Unix epoch seconds like the `X-RateLimit-Reset` header. This is a convenience for agents that prefer parsing JSON over headers. Handlers opt into this when constructing their response (not automatic — same pattern as `meta.cursor`).

### Infrastructure (CORS)

13. **AC13: CORS Allow Headers** — `X-Agent-ID` added to CORS `Access-Control-Allow-Headers` in both `api-gateway.stack.ts` (global default) and any per-route `corsOptions` definitions. This allows browser-based agents to send the header.

14. **AC14: CORS Expose Headers** — `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-Agent-ID` added to CORS `Access-Control-Expose-Headers` so browser-based clients can read these response headers.

### Type Safety & Exports

15. **AC15: New types exported** — All new types exported from package index files: `RateLimitMiddlewareConfig`, `AgentIdentity` (convenience type: `{ agentId: string | null; actorType: ActorType }`). The `eventContextSchema` is exported from `@ai-learning-hub/validation`. `addRateLimitHeaders` is exported from `@ai-learning-hub/middleware`.

16. **AC16: Backward compatibility** — Existing handlers without `rateLimit` in `WrapperOptions` are completely unaffected. The `agentId` and `actorType` fields on `HandlerContext` are additive — existing handlers that destructure only `{ event, auth, requestId, logger }` continue to work without modification. All existing tests pass without changes.

### Testing

17. **AC17: Unit tests — agent identity** — Tests cover: `X-Agent-ID` present → `actorType: "agent"` + `agentId` set, header absent → `actorType: "human"` + `agentId: null`, invalid format (too long, special chars) → 400 VALIDATION_ERROR, case-insensitive header lookup, empty string → 400 VALIDATION_ERROR, `X-Agent-ID` echoed in response header. Minimum 90% coverage for new agent identity code.

18. **AC18: Unit tests — rate limit transparency** — Tests cover: rate limit headers added to success response, rate limit headers added to error response, 429 response includes both rate limit headers AND `Retry-After`, `addRateLimitHeaders` utility decorates existing response, `remaining` is correctly calculated as `limit - current` (minimum 0), `reset` header is Unix epoch seconds, wrapHandler with `rateLimit` config enforces limit and adds headers, wrapHandler without `rateLimit` config does not add headers, dynamic `limit` function receives auth context, dynamic `limit` function receives `null` auth when `requireAuth: false`, dynamic `limit` function that throws → fail-open (log WARN, skip rate limiting), `identifierSource: 'sourceIp'` uses correct value. Minimum 90% coverage.

19. **AC19: Unit tests — context schema** — Tests cover: valid context with all fields, valid context with partial fields, valid context with no fields (empty object), `confidence` outside 0-1 range rejected, extra fields rejected (strict mode), `trigger` exceeding 100 chars rejected, `null` context treated as absent. Minimum 90% coverage.

20. **AC20: Integration tests** — Test that the full middleware chain produces correct results: auth → agent identity → rate limit check → handler execution → rate limit headers on response. Verify backward compatibility (handlers without `rateLimit` or `agentId` usage are unaffected).

## Tasks / Subtasks

### Task 1: Agent Identity Types & Extraction (AC: #1, #2, #3, #4, #15)

- [ ] 1.1 Create `AgentIdentity` type in `@ai-learning-hub/types/src/api.ts`: `{ agentId: string | null; actorType: ActorType }`
- [ ] 1.2 Export `AgentIdentity` from `@ai-learning-hub/types/src/index.ts`
- [ ] 1.3 Create `backend/shared/middleware/src/agent-identity.ts`
- [ ] 1.4 Implement `extractAgentIdentity(event: APIGatewayProxyEvent): AgentIdentity` — case-insensitive header lookup for `x-agent-id`, format validation via regex `/^[a-zA-Z0-9_\-\.]{1,128}$/`, throws `AppError(VALIDATION_ERROR)` on invalid format
- [ ] 1.5 Export `extractAgentIdentity` from `@ai-learning-hub/middleware/src/index.ts`
- [ ] 1.6 Write unit tests in `backend/shared/middleware/test/agent-identity.test.ts`

### Task 2: HandlerContext Enhancement (AC: #3, #16)

- [ ] 2.1 Add `agentId: string | null` and `actorType: ActorType` to `HandlerContext` interface in `wrapper.ts`
- [ ] 2.2 Add `rateLimitResult?: RateLimitResult` to `HandlerContext` interface (optional, populated when `rateLimit` is configured)
- [ ] 2.3 Import `ActorType` from `@ai-learning-hub/types` in wrapper.ts
- [ ] 2.4 Wire `extractAgentIdentity()` into `wrapHandler` execution chain — after auth extraction, before idempotency check
- [ ] 2.5 Pass `agentId` and `actorType` into the `HandlerContext` object
- [ ] 2.6 Add `X-Agent-ID` echo header to response (both success and error paths) when `agentId` is not null
- [ ] 2.7 Verify all existing middleware tests still pass

### Task 3: Event Context Zod Schema (AC: #5, #6)

- [ ] 3.1 Create `eventContextSchema` in `backend/shared/validation/src/schemas.ts` (or new file `event-context.ts` if schemas.ts doesn't exist)
- [ ] 3.2 Schema: `z.object({ trigger: z.string().max(100).optional(), source: z.string().max(200).optional(), confidence: z.number().min(0).max(1).optional(), upstream_ref: z.string().max(500).optional() }).strict().optional()`
- [ ] 3.3 Export `eventContextSchema` from `@ai-learning-hub/validation/src/index.ts`
- [ ] 3.4 Write unit tests in `backend/shared/validation/test/event-context.test.ts`

### Task 4: Rate Limit Header Utility (AC: #7, #10, #12, #15)

- [ ] 4.1 Create `backend/shared/middleware/src/rate-limit-headers.ts`
- [ ] 4.2 Implement `calculateRateLimitReset(windowSeconds: number): number` — returns Unix epoch seconds for end of current window (ceiling to next window boundary)
- [ ] 4.3 Implement `buildRateLimitHeaders(rateLimitResult: RateLimitResult, windowSeconds: number): Record<string, string>` — returns `{ 'X-RateLimit-Limit': ..., 'X-RateLimit-Remaining': ..., 'X-RateLimit-Reset': ... }` and optionally `'Retry-After'` when `rateLimitResult.retryAfterSeconds` is set
- [ ] 4.4 Implement `addRateLimitHeaders(response: APIGatewayProxyResult, rateLimitResult: RateLimitResult, windowSeconds: number): APIGatewayProxyResult` — merges rate limit headers into existing response headers
- [ ] 4.5 Implement `buildRateLimitMeta(rateLimitResult: RateLimitResult, windowSeconds: number): RateLimitMeta` — returns `{ limit, remaining, reset }` object for use in `EnvelopeMeta` (JSON body). `reset` is ISO 8601 string per ADR-014 (different from the Unix epoch header value)
- [ ] 4.6 Export all functions from `@ai-learning-hub/middleware/src/index.ts`
- [ ] 4.7 Write unit tests in `backend/shared/middleware/test/rate-limit-headers.test.ts`

### Task 5: Rate Limit Middleware in wrapHandler (AC: #8, #9, #11)

- [ ] 5.1 Create `RateLimitMiddlewareConfig` interface in `@ai-learning-hub/middleware/src/rate-limit-headers.ts`
- [ ] 5.2 Add `rateLimit?: RateLimitMiddlewareConfig` to `WrapperOptions` in `wrapper.ts`
- [ ] 5.3 Wire rate limit check into `wrapHandler` execution chain — after auth extraction and agent identity, before idempotency check
- [ ] 5.4 Resolve `limit` value: if function, call with `auth` inside try/catch — if the function throws, log WARN and skip rate limiting entirely (fail-open, no headers); if number, use directly
- [ ] 5.5 Resolve `identifier`: default to `auth.userId`, or `event.requestContext.identity.sourceIp` if `identifierSource === 'sourceIp'`
- [ ] 5.6 Call `incrementAndCheckRateLimit(client, tableName, config, logger)` — read `USERS_TABLE_NAME` env var for table name
- [ ] 5.7 If `!result.allowed`: throw `AppError(RATE_LIMITED, ...)` — wrapHandler's error path adds rate limit headers
- [ ] 5.8 If allowed: store `result` in `ctx.rateLimitResult`
- [ ] 5.9 After handler execution (success or error): call `addRateLimitHeaders(response, result, windowSeconds)` to decorate final response
- [ ] 5.10 Fail-open on rate limit table errors: log warning, execute handler without rate limiting (same philosophy as idempotency fail-open in 3.2.1)
- [ ] 5.11 Write unit and integration tests

### Task 6: Modify `enforceRateLimit` Return Type (AC: #10)

- [ ] 6.1 Change `enforceRateLimit()` in `@ai-learning-hub/db/src/rate-limiter.ts` to return `Promise<RateLimitResult>` instead of `Promise<void>` — it already has the result internally, just needs to return it after the throw check
- [ ] 6.2 Update all existing callers of `enforceRateLimit()` — currently they don't capture the return value, so this is backward-compatible (adding a return to a void function doesn't break callers)
- [ ] 6.3 Update tests if `enforceRateLimit` has any test assertions on return type

### Task 7: CORS Configuration (AC: #13, #14)

- [ ] 7.1 Add `'X-Agent-ID'` to CORS `allowHeaders` in `infra/lib/stacks/api/api-gateway.stack.ts`
- [ ] 7.2 Add `'X-RateLimit-Limit'`, `'X-RateLimit-Remaining'`, `'X-RateLimit-Reset'`, `'X-Agent-ID'` to CORS `Access-Control-Expose-Headers` (may need to add `exposeHeaders` to CORS config)
- [ ] 7.3 Add `'X-Agent-ID'` to any per-route `corsOptions` in `saves-routes.stack.ts` and other route stacks that define their own CORS options
- [ ] 7.4 Run CDK synth to verify configuration compiles

### Task 8: Update Test Utilities (AC: #16)

- [ ] 8.1 Update `createMockHandlerContext` in `backend/test-utils/mock-wrapper.ts` to include `agentId: null` and `actorType: 'human'` defaults
- [ ] 8.2 Add optional `agentId` and `actorType` overrides to mock context factory
- [ ] 8.3 Verify all existing tests pass with the updated mock context defaults

### Task 9: Integration & Contract Tests (AC: #20)

- [ ] 9.1 Integration test: wrapHandler with agent identity — `X-Agent-ID` header → `ctx.agentId` set, `ctx.actorType === 'agent'`
- [ ] 9.2 Integration test: wrapHandler without agent identity — no header → `ctx.actorType === 'human'`, `ctx.agentId === null`
- [ ] 9.3 Integration test: wrapHandler with `rateLimit` config — rate limit check executes, headers added to response
- [ ] 9.4 Integration test: wrapHandler with `rateLimit` config — rate limit exceeded → 429 with headers
- [ ] 9.5 Integration test: wrapHandler without `rateLimit` config — no rate limit headers on response
- [ ] 9.6 Integration test: backward compatibility — existing handler patterns unaffected
- [ ] 9.7 Verify all existing middleware tests still pass

### Task 10: Quality Gates (AC: #17, #18, #19, #20)

- [ ] 10.1 Run `npm test` — all tests pass with >=80% coverage on new files
- [ ] 10.2 Run `npm run lint` — no errors
- [ ] 10.3 Run `npm run build` — no TypeScript errors
- [ ] 10.4 Run `npm run type-check` — passes

## Dev Notes

### Architecture Overview

This story builds the **agent identity, context metadata, and rate limit transparency** infrastructure for Epic 3.2 (Agent-Native API Foundation). It implements FR103 (agent identity), FR104 (context metadata), and the rate limit transparency requirement from ADR-014.

**Scope boundary:** This story delivers infrastructure only — the middleware, utilities, and types. No existing handlers are modified to use the new `rateLimit` WrapperOptions or to record agent identity on event writes. That happens in:
- Story 3.2.7 (Saves Domain Retrofit) — wires saves handlers to use `rateLimit` config, pass `actorType`/`agentId` to `recordEvent`, validate `context` from body
- Story 3.2.8 (Auth Domain Retrofit) — wires auth handlers similarly

The `X-Agent-ID` extraction and `actorType` derivation are always-on in `wrapHandler` (no opt-in) because they are zero-cost and universally useful. Existing handlers gain `ctx.agentId` and `ctx.actorType` for free.

### Three Deliverables

| Deliverable | FR/NFR | What It Does |
|-------------|--------|--------------|
| Agent Identity | FR103 | Extract `X-Agent-ID`, derive `actorType`, echo in response |
| Context Metadata | FR104 | Zod schema for `{ trigger, source, confidence, upstream_ref }` |
| Rate Limit Transparency | ADR-014 | `X-RateLimit-*` headers on all rate-limited responses |

### Middleware Chain Order (after this story)

```
Request → Extract Auth → Extract Agent Identity → Check Rate Limit
        → Check Idempotency Cache → Extract If-Match
        → Execute Handler
        → Store Idempotency Result → Add Rate Limit Headers → Add X-Agent-ID Echo
        → Return Response
```

Agent identity extraction runs BEFORE rate limiting because the identifier for rate limiting may consider agent ID in future tiers. Rate limiting runs BEFORE idempotency because a rate-limited request should not consume an idempotency key.

### Agent Identity Extraction

The `X-Agent-ID` header is read from `event.headers` (case-insensitive — API Gateway normalizes headers to lowercase). The extraction does NOT modify the authorizer or auth context — it's a separate middleware concern. The agent ID is informational and does NOT affect authorization (an agent with a valid API key has the same permissions regardless of `X-Agent-ID`).

**Why not in the authorizer?** API Gateway TOKEN authorizers cannot forward arbitrary request headers. REQUEST authorizers can, but the current API key authorizer is already a REQUEST authorizer that returns auth context. Adding `X-Agent-ID` to the authorizer context would work, but it couples identity extraction to a specific auth method. By extracting in `wrapHandler` (from `event.headers`), the agent identity works regardless of auth method (JWT, API key, or unauthenticated health endpoints in 3.2.9).

**Validation rationale:** The regex `^[a-zA-Z0-9_\-\.]{1,128}$` allows typical agent identifiers like `claude-code-v1`, `my-agent.prod.1`, `github_bot_42`. The 128-char limit prevents abuse via oversized headers.

```typescript
// In backend/shared/middleware/src/agent-identity.ts

import { AppError, ErrorCode, type ActorType } from '@ai-learning-hub/types';
import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface AgentIdentity {
  agentId: string | null;
  actorType: ActorType;
}

const AGENT_ID_PATTERN = /^[a-zA-Z0-9_\-\.]{1,128}$/;

export function extractAgentIdentity(event: APIGatewayProxyEvent): AgentIdentity {
  // API Gateway normalizes headers to lowercase
  const rawAgentId = event.headers?.['x-agent-id'] ?? event.headers?.['X-Agent-ID'] ?? null;

  if (rawAgentId === null || rawAgentId === undefined) {
    return { agentId: null, actorType: 'human' };
  }

  if (!AGENT_ID_PATTERN.test(rawAgentId)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'X-Agent-ID header must be 1-128 characters matching [a-zA-Z0-9_\\-.]', {
      fields: [{
        field: 'X-Agent-ID',
        code: 'invalid_format',
        message: 'X-Agent-ID header must be 1-128 characters matching [a-zA-Z0-9_\\-.]',
      }],
    });
  }

  return { agentId: rawAgentId, actorType: 'agent' };
}
```

### Context Metadata Schema

The `EventContext` type is already defined in `@ai-learning-hub/types/src/events.ts` (Story 3.2.3):

```typescript
export interface EventContext {
  trigger?: string;
  source?: string;
  confidence?: number;
  upstream_ref?: string;
}
```

The Zod schema mirrors this exactly:

```typescript
// In backend/shared/validation/src/event-context.ts

import { z } from 'zod';

export const eventContextSchema = z.object({
  trigger: z.string().max(100).optional(),
  source: z.string().max(200).optional(),
  confidence: z.number().min(0).max(1).optional(),
  upstream_ref: z.string().max(500).optional(),
}).strict().optional();
```

**Usage by handlers (in 3.2.7 retrofit):**

```typescript
// Example: saves create handler body schema
const createSaveBodySchema = z.object({
  url: z.string().url(),
  tags: z.array(z.string()).max(20).optional(),
  context: eventContextSchema,  // ← NEW: context metadata
});
```

Handlers parse `context` from the body, then pass it to `recordEvent()`:

```typescript
const body = validateJsonBody(createSaveBodySchema, event.body);
// ... create the save ...
try {
  await recordEvent(client, {
    entityType: 'save',
    entityId: save.saveId,
    userId,
    eventType: 'SaveCreated',
    actorType: ctx.actorType,      // ← from agent identity middleware
    actorId: ctx.agentId,          // ← from agent identity middleware
    context: body.context ?? null, // ← from parsed body
    requestId: ctx.requestId,
  }, logger);
} catch (err) {
  logger.warn('Failed to record event (non-fatal)', { error: err });
}
```

This wiring is NOT done in this story — it's shown here so the dev agent for 3.2.7 knows exactly how to connect the pieces.

### Rate Limit Transparency

**Current state:** Handlers call `enforceRateLimit(client, tableName, config, logger)` directly. This function throws `RATE_LIMITED` on exceed but returns void on success — the rate limit state (current count, limit, window) is lost.

**After this story:** Two patterns available:

**Pattern 1: wrapHandler integration (new pattern for all future handlers)**

```typescript
export const handler = wrapHandler(myHandler, {
  requireAuth: true,
  rateLimit: {
    operation: 'saves-write',
    windowSeconds: 3600,
    limit: 200,  // or: (auth) => getScopeBasedLimit(auth?.scopes ?? [])
  },
});
```

The wrapper handles everything: checks rate limit, enforces, stores result, adds headers.

**Pattern 2: Utility function (backward-compatible bridge for 3.2.7/3.2.8 retrofit)**

```typescript
// In handler code (existing pattern + rate limit return)
const rateLimitResult = await enforceRateLimit(client, tableName, config, logger);
// After handler logic, decorate response
return addRateLimitHeaders(
  createSuccessResponse(data, requestId),
  rateLimitResult,
  config.windowSeconds,
);
```

**Why both patterns?** The wrapHandler pattern is the clean forward path. But existing handlers (saves, api-keys, invite-codes) call `enforceRateLimit` directly with per-handler configs. Retrofitting them all in this story would exceed the scope boundary. The utility function lets 3.2.7/3.2.8 add rate limit headers incrementally while they retrofit.

### Rate Limit Header Calculation

```typescript
// X-RateLimit-Limit: the configured limit
// X-RateLimit-Remaining: max(0, limit - current)
// X-RateLimit-Reset: Unix epoch seconds for window end (header)
// meta.rateLimit.reset: ISO 8601 for JSON body (ADR-014)

export function calculateRateLimitReset(windowSeconds: number): number {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowEnd = Math.ceil(now / windowMs) * windowMs;
  return Math.floor(windowEnd / 1000); // Unix epoch seconds
}

export function buildRateLimitHeaders(
  result: RateLimitResult,
  windowSeconds: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.limit - result.current)),
    'X-RateLimit-Reset': String(calculateRateLimitReset(windowSeconds)),
  };
  if (result.retryAfterSeconds != null) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}
```

**Why Unix epoch seconds for the header?** Industry standard — GitHub API, Stripe, Twitter all use Unix epoch seconds for `X-RateLimit-Reset`. This avoids timezone parsing ambiguity and is trivially consumable by agents (`Date.now()/1000 < resetValue` → "am I in the window?"). The JSON body `meta.rateLimit.reset` uses ISO 8601 per ADR-014 for consistency with other API datetime values.

**Why `Math.ceil(now / windowMs) * windowMs`?** This rounds up to the next window boundary. The rate limiter uses a fixed-window strategy (from `backend/shared/db/src/rate-limiter.ts`), so the reset time is the end of the current window.

### `enforceRateLimit` Return Type Change

Currently:
```typescript
export async function enforceRateLimit(...): Promise<void>
```

After this story:
```typescript
export async function enforceRateLimit(...): Promise<RateLimitResult>
```

The function already computes `RateLimitResult` internally and uses it to decide whether to throw. The change is simply returning it instead of discarding it. All existing callers that don't capture the return value continue to work — adding a return to a previously-void function is backward-compatible in TypeScript (the returned value is simply ignored).

### wrapHandler Rate Limit Integration

```typescript
// In wrapper.ts — inside wrapHandler, after auth extraction

if (options.rateLimit) {
  const rateLimitClient = getDefaultClient();
  const tableName = requireEnv('USERS_TABLE_NAME', 'ai-learning-hub-users');

  // Resolve dynamic limit (fail-open if function throws)
  let limit: number;
  let skipRateLimit = false;
  try {
    limit = typeof options.rateLimit.limit === 'function'
      ? options.rateLimit.limit(auth)
      : options.rateLimit.limit;
  } catch (err) {
    logger.warn('Rate limit function threw (fail-open, skipping rate limit)', { error: err });
    skipRateLimit = true;
    limit = 0; // unused — skip path below
  }

  if (skipRateLimit) {
    // Skip rate limiting entirely — no headers emitted, proceed to handler
  } else {
    // Resolve identifier
    const identifier = options.rateLimit.identifierSource === 'sourceIp'
      ? event.requestContext?.identity?.sourceIp ?? 'unknown-ip'
      : auth?.userId ?? 'anonymous';

    const rateLimitConfig: RateLimitConfig = {
      operation: options.rateLimit.operation,
      identifier,
      limit,
      windowSeconds: options.rateLimit.windowSeconds,
    };

    try {
      const result = await incrementAndCheckRateLimit(
        rateLimitClient,
        tableName,
        rateLimitConfig,
        logger,
      );

      if (!result.allowed) {
        // Build rate limit headers for the 429 response
        const rlHeaders = buildRateLimitHeaders(result, options.rateLimit.windowSeconds);
        const error = new AppError(ErrorCode.RATE_LIMITED, 'Rate limit exceeded', {
          retryAfter: result.retryAfterSeconds,
          limit: result.limit,
          current: result.current,
        });
        const errorResponse = createErrorResponse(error, requestId);
        errorResponse.headers = { ...errorResponse.headers, ...rlHeaders };
        return errorResponse;
      }

      // Store for handler access and post-handler header decoration
      rateLimitResult = result;
    } catch (err) {
      // Fail-open: rate limiting is best-effort
      logger.warn('Rate limit check failed (fail-open)', { error: err });
    }
  }
}
```

After handler execution:
```typescript
// Add rate limit headers to response (success or error)
if (rateLimitResult && options.rateLimit) {
  response = addRateLimitHeaders(response, rateLimitResult, options.rateLimit.windowSeconds);
}
```

### CORS Configuration

**`infra/lib/stacks/api/api-gateway.stack.ts`** — add to `allowHeaders`:

```typescript
allowHeaders: [
  'Content-Type',
  'Authorization',
  'x-api-key',
  'X-Amz-Date',
  'X-Api-Key',
  'X-Amz-Security-Token',
  'Idempotency-Key',     // Story 3.2.1
  'If-Match',            // Story 3.2.1
  'X-Agent-ID',          // Story 3.2.4 — NEW
],
```

Add `exposeHeaders` (allows JavaScript clients to read these response headers):

```typescript
exposeHeaders: [
  'X-Request-Id',
  'X-RateLimit-Limit',      // Story 3.2.4 — NEW
  'X-RateLimit-Remaining',  // Story 3.2.4 — NEW
  'X-RateLimit-Reset',      // Story 3.2.4 — NEW
  'X-Agent-ID',             // Story 3.2.4 — NEW
  'X-Idempotent-Replayed',  // Story 3.2.1
  'X-Idempotency-Status',   // Story 3.2.1
  'Retry-After',            // ADR-008
],
```

Check whether `Idempotency-Key` and `If-Match` were already added to `allowHeaders` by Story 3.2.1. If not, add them too for completeness.

### Existing Codebase Patterns — MUST Follow

**Agent identity extraction** — follows the same pattern as `extractIdempotencyKey()` in `backend/shared/middleware/src/idempotency.ts`: reads a header, validates format, returns parsed value or throws `AppError`.

**wrapHandler middleware wiring** — follows the pattern established by idempotency middleware (Story 3.2.1) and concurrency middleware (Story 3.2.1): new functionality is opt-in via `WrapperOptions` fields, wired into the execution chain at the appropriate point.

**Table config pattern** (`backend/shared/db/src/rate-limiter.ts`): `incrementAndCheckRateLimit` takes `tableName` as a parameter. In wrapHandler, read from `process.env.USERS_TABLE_NAME` with a fallback default. **Note:** Hoist `requireEnv('USERS_TABLE_NAME', ...)` to module scope (outside the handler function) to avoid re-reading env vars on every invocation — follow the same pattern as existing handlers that resolve env vars at module load time.

**DB operation pattern**: All DB functions accept an optional `Logger` parameter (established in PR #151). Use `incrementAndCheckRateLimit(client, tableName, config, logger)`.

**Error codes**: Use `ErrorCode.VALIDATION_ERROR` for invalid `X-Agent-ID`, `ErrorCode.RATE_LIMITED` for rate limit exceeded (already exists).

**Handler context pattern**: New fields are additive. `expectedVersion` was added in 3.2.1 — follow the same pattern for `agentId`, `actorType`, `rateLimitResult`.

### File Locations

**New files:**

| File | Package | Purpose |
|------|---------|---------|
| `backend/shared/middleware/src/agent-identity.ts` | `@ai-learning-hub/middleware` | `extractAgentIdentity()`, `AgentIdentity` type |
| `backend/shared/middleware/src/rate-limit-headers.ts` | `@ai-learning-hub/middleware` | `addRateLimitHeaders()`, `buildRateLimitHeaders()`, `calculateRateLimitReset()`, `buildRateLimitMeta()`, `RateLimitMiddlewareConfig` |
| `backend/shared/middleware/test/agent-identity.test.ts` | `@ai-learning-hub/middleware` | Agent identity unit tests |
| `backend/shared/middleware/test/rate-limit-headers.test.ts` | `@ai-learning-hub/middleware` | Rate limit header unit tests |
| `backend/shared/middleware/test/rate-limit-integration.test.ts` | `@ai-learning-hub/middleware` | wrapHandler + rate limit integration tests |
| `backend/shared/validation/src/event-context.ts` | `@ai-learning-hub/validation` | `eventContextSchema` Zod schema |
| `backend/shared/validation/test/event-context.test.ts` | `@ai-learning-hub/validation` | Context schema unit tests |

**Modified files:**

| File | Change |
|------|--------|
| `backend/shared/types/src/api.ts` | Add `AgentIdentity` type |
| `backend/shared/types/src/index.ts` | Export `AgentIdentity` |
| `backend/shared/middleware/src/wrapper.ts` | Add `agentId`, `actorType`, `rateLimitResult` to `HandlerContext`; add `rateLimit` to `WrapperOptions`; wire agent identity + rate limit middleware |
| `backend/shared/middleware/src/index.ts` | Export new modules |
| `backend/shared/validation/src/index.ts` | Export `eventContextSchema` |
| `backend/shared/db/src/rate-limiter.ts` | Change `enforceRateLimit` return to `Promise<RateLimitResult>` |
| `backend/test-utils/mock-wrapper.ts` | Add `agentId`, `actorType` to mock context defaults |
| `infra/lib/stacks/api/api-gateway.stack.ts` | Add `X-Agent-ID` to CORS allowHeaders, add exposeHeaders |

### Anti-Patterns to Avoid

- **Do NOT put agent identity in the authorizer.** Keep it in `wrapHandler` so it works regardless of auth method (JWT, API key, unauthenticated health endpoints).
- **Do NOT validate `X-Agent-ID` against a registry.** It's self-reported by the agent. Validation is format-only, not identity verification. Trust is established via auth (API key), not agent ID.
- **Do NOT make rate limit headers mandatory on non-rate-limited endpoints.** Only emit headers when real data is available. Fake `X-RateLimit-Remaining: Infinity` headers are worse than no headers.
- **Do NOT retrofit existing handlers in this story.** Agent identity, context pass-through, and rate limit transparency middleware are built here. Wiring them into saves/auth handlers is 3.2.7/3.2.8 scope.
- **Do NOT use `console.log`.** Use `@ai-learning-hub/logging` structured logger.
- **Do NOT hardcode table names.** Use `requireEnv()` pattern with sensible dev defaults.
- **Do NOT let rate limit middleware failures propagate.** Rate limiting is fail-open (same as idempotency in 3.2.1). If the rate limit table is unreachable, log warning and execute handler normally.
- **Do NOT create a new shared package.** All code goes in existing `@ai-learning-hub/middleware`, `@ai-learning-hub/validation`, `@ai-learning-hub/types`, and `@ai-learning-hub/db` packages.
- **Do NOT add per-agent rate limiting.** The rate limit identifier is `userId` (or `sourceIp`), not `agentId`. Per-agent limits could be a future enhancement but are not in scope for V1.

### Testing Strategy

**Unit tests (Vitest):**
- Mock DynamoDB client using existing mock patterns from `backend/shared/db/test/`
- Mock `incrementAndCheckRateLimit` in middleware tests using `vi.mock('@ai-learning-hub/db')`
- Test `extractAgentIdentity()`: header present → agent, absent → human, invalid → 400, case-insensitive, edge cases (empty string, 129 chars, special chars)
- Test `buildRateLimitHeaders()`: correct header values, `remaining` clamped to 0, reset is Unix epoch seconds, `Retry-After` only when `retryAfterSeconds` set
- Test `addRateLimitHeaders()`: merges with existing headers, doesn't clobber `Content-Type`
- Test `calculateRateLimitReset()`: returns Unix epoch seconds (number as string), rounds up to window boundary. **Use `vi.useFakeTimers()` to mock `Date.now()` for deterministic reset calculations** — time-dependent tests will be flaky otherwise
- Test `eventContextSchema`: valid inputs, boundary values for confidence (0, 1, 0.5), max lengths, strict mode rejects extra fields

**Integration tests:**
- Full wrapHandler chain with agent identity + rate limit config
- Verify `ctx.agentId`, `ctx.actorType`, `ctx.rateLimitResult` available to handler
- Verify rate limit headers on success response
- Verify rate limit headers on error response (handler throws)
- Verify 429 response has rate limit headers + Retry-After
- Verify dynamic `limit` function is called, evaluated, and 429 includes the dynamically-resolved limit in `X-RateLimit-Limit`
- Verify fail-open when rate limit DB unreachable
- Verify fail-open when dynamic `limit` function throws (no rate limit headers emitted)
- Backward compatibility: handlers without new options unaffected

### Dependencies and Risks

| Dependency | Status | Impact |
|-----------|--------|--------|
| 3.2.1 (Idempotency) | Merged (PR #226) | `WrapperOptions` extension pattern established. Follow same pattern for `rateLimit`. |
| 3.2.2 (Error contract) | Merged (PR #228) | `RateLimitMeta`, `EnvelopeMeta`, `createSuccessResponse` with options pattern available. Use `fields` key in validation errors. |
| 3.2.3 (Event history) | Merged (PR #230) | `ActorType`, `EventContext`, `RecordEventParams` types available. No code changes needed. |
| 3.2.5 (Cursor pagination) | Not started | Independent — no overlap. |
| 3.2.6 (Scoped API keys) | Not started | Independent — no overlap. The `limit` function in `RateLimitMiddlewareConfig` can read scopes from auth context once 3.2.6 extends the scope model. |

**Risk:** The `enforceRateLimit` return type change (void → RateLimitResult) touches a function called by 7+ handlers. It's backward-compatible (callers that don't capture the return are unaffected), but if any test asserts on the exact return type being void, it will need updating.

### Key Technical Decisions

1. **Always-on agent identity (no opt-in flag):** Unlike idempotency (opt-in) and rate limiting (opt-in), agent identity extraction is zero-cost (one header lookup) and universally useful. Every handler benefits from knowing `actorType`. No reason to gate it behind a flag.

2. **Agent ID validation is format-only:** The `X-Agent-ID` header is self-reported. We validate format (no injection, reasonable length) but do not verify the agent exists in any registry. Trust comes from the API key, not the agent ID. This follows the same philosophy as `X-Request-Id` — we accept whatever the client sends as long as the format is valid.

3. **Rate limit middleware is opt-in via WrapperOptions:** Mirrors the idempotency pattern from 3.2.1. Handlers that don't set `rateLimit` get no rate limit behavior. This is backward-compatible and allows incremental adoption.

4. **Dynamic `limit` via function:** The `limit` field accepts `number | ((auth: AuthContext | null) => number)`. This enables tier-based limits (e.g., capture keys get 20/min write, full keys get 100/min) without hardcoding per-handler. The function receives the already-extracted auth context. **Error handling:** If the function throws, the rate limit middleware logs WARN and skips rate limiting entirely (fail-open, no rate limit headers emitted). The function MUST handle `null` auth gracefully (e.g., return a default limit for unauthenticated requests).

5. **Fail-open on rate limit errors:** Same philosophy as idempotency (3.2.1). If the rate limit table is unreachable, handlers execute normally. At boutique scale, a brief rate limit outage is less damaging than rejecting all requests. The response includes no rate limit headers in fail-open mode.

6. **Rate limit reset header as Unix epoch seconds:** The `X-RateLimit-Reset` HTTP header uses Unix epoch seconds (industry standard per GitHub, Stripe, Twitter APIs). This avoids timezone parsing and enables trivial comparison: `Date.now()/1000 < resetValue`. The JSON body `meta.rateLimit.reset` uses ISO 8601 per ADR-014 for consistency with other API datetime values. This dual-format approach gives agents the most convenient format in each context.

7. **Event context is handler-parsed, not middleware-parsed:** The `context` field is in the request body, not a header. Different handlers have different body schemas. Parsing `context` from the body is the handler's responsibility using the shared `eventContextSchema`. The middleware provides the schema; handlers compose it into their body schema.

8. **X-Agent-ID response echo:** Echoing the agent ID back in the response confirms receipt and aids debugging (the agent can verify its identity was recognized). This is zero-cost and follows the same pattern as `X-Request-Id` echo.

### Response Examples

**Request with agent identity + context:**
```
POST /saves
X-Agent-ID: claude-code-v1
Idempotency-Key: save-abc-123
Content-Type: application/json

{
  "url": "https://example.com/article",
  "context": {
    "trigger": "user-share-command",
    "source": "claude-code-cli",
    "confidence": 0.95,
    "upstream_ref": "conversation-xyz-456"
  }
}
```

**Success response with rate limit headers:**
```
HTTP/1.1 201 Created
Content-Type: application/json
X-Request-Id: req-550e8400-e29b
X-Agent-ID: claude-code-v1
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 198
X-RateLimit-Reset: 1740578400

{
  "data": {
    "saveId": "01HX4Z3NDEKTSV4RRFFQ69G5FAV",
    "url": "https://example.com/article",
    ...
  }
}
```

**429 Rate Limited response:**
```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-Request-Id: req-661f9511-c38a
X-Agent-ID: claude-code-v1
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1740578400
Retry-After: 1847

{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "requestId": "req-661f9511-c38a",
    "details": {
      "retryAfter": 1847,
      "limit": 200,
      "current": 200
    }
  }
}
```

**Invalid X-Agent-ID response:**
```
HTTP/1.1 400 Bad Request
Content-Type: application/json
X-Request-Id: req-772a0622-d49c

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "X-Agent-ID header must be 1-128 characters matching [a-zA-Z0-9_\\-.]",
    "requestId": "req-772a0622-d49c",
    "details": {
      "fields": [{
        "field": "X-Agent-ID",
        "code": "invalid_format",
        "message": "X-Agent-ID header must be 1-128 characters matching [a-zA-Z0-9_\\-.]"
      }]
    }
  }
}
```

**Request without agent identity (human user):**
```
GET /saves
Authorization: Bearer eyJ...
```

**Response (no X-Agent-ID echo, rate limit headers present if endpoint is rate-limited):**
```
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: req-883b1733-e5ad

{
  "data": [...]
}
```

### Project Structure Notes

- All new code goes into existing shared packages — no new packages created
- New CDK changes are CORS-only — no new tables, no new Lambdas
- No new npm dependencies required
- The `agent-identity.ts` and `rate-limit-headers.ts` files follow the same module pattern as `idempotency.ts` and `concurrency.ts` from Story 3.2.1

### Previous Story Intelligence

**Story 3.2.1 (Idempotency & Optimistic Concurrency)** established:
- Pattern for extending `WrapperOptions` with new middleware flags (`idempotent`, `requireVersion`)
- Pattern for wiring new middleware into `wrapHandler` execution chain
- Pattern for header extraction (`extractIdempotencyKey`, `extractIfMatch`)
- Fail-open philosophy for non-critical middleware
- Pattern for new HandlerContext fields (`expectedVersion`)
- Files: `middleware/src/idempotency.ts`, `middleware/src/concurrency.ts`

**Story 3.2.2 (Error Contract & Response Envelope)** established:
- `RateLimitMeta` type already defined with `{ limit, remaining, reset }` — 3.2.4 populates it
- `EnvelopeMeta.rateLimit` field ready for population
- `createSuccessResponse` with options object pattern for extensibility
- `fields` key (not `errors`) for validation error details — use in `X-Agent-ID` validation errors
- `AppError.build()` fluent builder for enhanced errors

**Story 3.2.3 (Event History Infrastructure)** established:
- `ActorType = "human" | "agent"` already defined
- `EventContext = { trigger?, source?, confidence?, upstream_ref? }` already defined
- `RecordEventParams` with `actorType`, `actorId`, `context` fields already defined
- `recordEvent()` fire-and-forget pattern — callers wrap in try/catch, log WARN, continue

### Git Intelligence

Recent commits (Epics 3.2) established patterns for:
- Middleware module creation: `idempotency.ts`, `concurrency.ts` (PR #226, Story 3.2.1)
- Type extension: `ErrorCode` enum, `WrapperOptions`, `HandlerContext` (PR #226)
- Response envelope types: `EnvelopeMeta`, `RateLimitMeta`, `ResponseEnvelope` (PR #228, Story 3.2.2)
- Event types: `ActorType`, `EventContext`, `EntityEvent` (PR #230, Story 3.2.3)
- CDK table addition: events table in `tables.stack.ts` (PR #230)

The middleware pattern from PR #226 (idempotency) is the closest precedent for this story's rate limit wrapHandler integration. Follow the same code organization, test structure, and wrapHandler wiring approach.

### Sprint Status Note

The sprint-status.yaml currently shows stories 3.2.1-3.2.3 as `backlog`, but they are actually merged (PRs #226, #228, #230). The sprint status file was not updated during those stories' completion. This story should NOT fix the stale status — that's a separate concern.

### References

- [Source: _bmad-output/planning-artifacts/prd.md — FR103: Agent Identity]
- [Source: _bmad-output/planning-artifacts/prd.md — FR104: Context Metadata Pass-Through]
- [Source: _bmad-output/planning-artifacts/prd.md — Rate Limit Transparency section]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-008: Standardized Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-013: Authentication Provider]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-014: API-First Design Philosophy]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3.2, Story 3.2.4 description]
- [Source: backend/shared/middleware/src/wrapper.ts — wrapHandler, HandlerContext, WrapperOptions]
- [Source: backend/shared/middleware/src/idempotency.ts — extractIdempotencyKey pattern (model for extractAgentIdentity)]
- [Source: backend/shared/middleware/src/error-handler.ts — createSuccessResponse, createErrorResponse]
- [Source: backend/shared/db/src/rate-limiter.ts — incrementAndCheckRateLimit, enforceRateLimit, RateLimitResult]
- [Source: backend/shared/types/src/events.ts — ActorType, EventContext, RecordEventParams]
- [Source: backend/shared/types/src/api.ts — RateLimitMeta, EnvelopeMeta, AuthContext]
- [Source: infra/lib/stacks/api/api-gateway.stack.ts — CORS configuration]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
