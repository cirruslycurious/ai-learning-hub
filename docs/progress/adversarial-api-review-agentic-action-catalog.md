# Adversarial API Review: Agentic Compatibility for Action-Catalog (Salesforce-like) System

**Scope:** Evaluate whether the API is truly agentic-friendly for autonomous LLM agents in an Action-Catalog context. Grounded only in codebase evidence.

---

## A) Verdict

- **Score (0–100) for "Agentic Compatibility":** 68
- **One-sentence justification:** The API implements a global action catalog, resource-scoped `meta.actions`, idempotency with replay, optimistic concurrency with 409 + `currentVersion`, structured errors with `allowedActions`/`currentState`/`requiredConditions`, rate limit and Retry-After, event history with `actorType`/`requestId`, and scoped API keys with `required_scope`/`granted_scopes`, but lacks success-response workflow hints (next actions/links after mutations), idempotency payload conflict detection, and documented key retention; `meta.actions` omits input schema/constraints (agent must resolve via catalog).

---

## B) Evidence Checklist (Pass/Fail/Not evidenced)

### 1. Action catalog exists (global)

| Item                                        | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint(s) that enumerate actions          | **Pass** | `GET /actions` implemented in `backend/functions/actions-catalog/handler.ts`. Returns `createSuccessResponse(actions, requestId, { links: { self } })`; `actions = registry.getActions({ entity, scope })`. Route wired in `infra/lib/stacks/api/discovery-routes.stack.ts`.                                                                                                              |
| Stable action identifiers                   | **Pass** | `actionId` follows pattern `entity:verb` (e.g. `saves:create`, `saves:get`). Validated in `action-registry.ts`: `ACTION_ID_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/`.                                                                                                                                                                                                                 |
| Human description + machine-readable inputs | **Pass** | Each `ActionDefinition` in `action-registrations.ts` has `description`, `inputSchema` (JSON Schema), `pathParams`, `queryParams`, `requiredHeaders` (name, format, description), `requiredScope`, `expectedErrors`. Example: `saves:create` has `inputSchema` with `url`, `title`, `tags`, etc., and `requiredHeaders: [{ name: "Idempotency-Key", format: "...", description: "..." }]`. |

**Example snippet (GET /actions response shape):**

```json
{ "data": [ { "actionId": "saves:create", "description": "Create a new URL save", "method": "POST", "urlPattern": "/saves", "requiredHeaders": [{ "name": "Idempotency-Key", "format": "[a-zA-Z0-9_\\-.]{1,256}", "description": "Client-generated dedup key" }], "requiredScope": "saves:create", "expectedErrors": ["VALIDATION_ERROR", "DUPLICATE_SAVE", ...] } ], "links": { "self": "/actions" } }
```

---

### 2. Resource-scoped discoverability (per entity instance)

| Item                                                                  | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where can an agent find allowed actions for /{entity}/{id} right now? | **Pass** | Single-resource GET responses include `meta.actions`. Example: `backend/functions/saves-get/handler.ts` calls `buildResourceActions("saves", saveId)` and returns `createSuccessResponse(save, ctx.requestId, { meta: { actions } })`. `buildResourceActions` in `resource-actions.ts` delegates to `registry.getActionsForResource(entityType, resourceId, currentState)`. |
| Is it state-aware (currentState influences allowedActions)?           | **Pass** | `action-registry.ts` `getActionsForResource`: when a state graph is registered and `currentState` is provided, it filters to transitions where `t.from === currentState` and returns only actions whose `actionId` is in those commands. For entities with no state graph (e.g. saves), all instance-level actions (urlPattern contains `:id`) are returned.                |
| Is it version-aware (currentVersion/etag influences allowedActions)?  | **Fail** | `meta.actions` does not vary by version. Version is present on the resource body (e.g. `data.version` on GET /saves/:id via `toPublicSave` which keeps `version` from SaveItem). Agent must use `If-Match: <data.version>` when invoking mutations; the list of allowed actions does not change by version.                                                                 |

**Example snippet (GET /saves/:id with meta.actions):**

```json
{ "data": { "saveId": "...", "version": 2, "url": "...", ... }, "meta": { "actions": [ { "actionId": "saves:update", "url": "/saves/01ABC", "method": "PATCH", "requiredHeaders": ["If-Match", "Idempotency-Key"] }, ... ] } }
```

---

### 3. Action invocation contract

| Item                                                                            | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint shape for invoking actions                                             | **Pass** | Actions are invoked via standard REST: POST /saves, PATCH /saves/:id, DELETE /saves/:id, POST /saves/:id/restore, etc. No dedicated `POST /actions/{actionId}` or `POST /{entity}/{id}:action`; each action maps to a method+path. Catalog documents `method` and `urlPattern` (e.g. `PATCH`, `/saves/:id`).                                                                                                                                |
| Required/optional headers (Idempotency-Key, If-Match, X-Request-Id, X-Agent-ID) | **Pass** | Per-action `requiredHeaders` in catalog (e.g. `Idempotency-Key`, `If-Match` for saves:update). `extractIdempotencyKey`, `extractIfMatch` in middleware; `extractAgentIdentity` sets `ctx.agentId`/`ctx.actorType`. `X-Request-Id` is set on response by `createSuccessResponse`/`createErrorResponse`; not required on request. CORS allows `Idempotency-Key`, `If-Match`, `X-Agent-ID` (saves-routes.stack.ts, discovery-routes.stack.ts). |
| Deterministic response shapes (envelope consistency)                            | **Pass** | Success: `createSuccessResponse` in `error-handler.ts` always produces `{ data, meta?, links? }`. List/single-resource use same envelope. Error: ADR-008 shape via `createErrorResponse` and `AppError.toApiError(requestId)` with `error: { code, message, requestId, details?, currentState?, allowedActions?, requiredConditions? }`.                                                                                                    |

---

### 4. Idempotency and safe retries

| Item                                                                          | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is there an idempotency mechanism for non-idempotent actions?                 | **Pass**    | Mutating handlers opt in via `wrapHandler(..., { idempotent: true })`. `extractIdempotencyKey(event)` validates header; `checkIdempotency` and `storeIdempotencyResult` in `idempotency.ts`. Saves create/update/delete/restore use idempotency (saves-routes.stack.ts grants idempotency table to those Lambdas).                                                                                                                                                                                                                                                                                                                          |
| Does the server replay prior result for the same key (status code + body)?    | **Pass**    | `checkIdempotency` returns cached `APIGatewayProxyResult` (statusCode, headers, body) when a record exists for (userId, idempotencyKey, operationPath), and sets `X-Idempotent-Replayed: true`. Only 2xx responses are stored; errors are not cached so agents can retry.                                                                                                                                                                                                                                                                                                                                                                   |
| How long are keys retained? What is the conflict behavior if payload differs? | **Partial** | **Retention:** TTL 24 hours in `idempotency.ts`: `const TTL_SECONDS = 24 * 60 * 60`; `expiresAt: nowSeconds + TTL_SECONDS` stored on record; application-level expiry check in `getIdempotencyRecord`. **Payload differs:** Not evidenced. Key is bound to `operationPath` (e.g. `POST /saves`) only. Same key + same path but different body results in replay of first response; no comparison of request body. Different path with same key returns `IDEMPOTENCY_KEY_CONFLICT` (409) with `details.boundTo` (e.g. `"POST /saves"`). Contract/docs do not state that duplicate key with different payload is undefined behavior (replay). |

**Example snippet (replay):**

```ts
// idempotency.ts: return { statusCode: record.statusCode, headers: { ...record.responseHeaders, "X-Idempotent-Replayed": "true" }, body: record.responseBody };
```

---

### 5. Concurrency control

| Item                                                                       | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is optimistic concurrency supported (ETag/If-Match/version)?               | **Pass** | Handlers use `requireVersion: true` in `wrapHandler` (e.g. saves-update, saves-update-metadata). `extractIfMatch` in concurrency.ts; `ctx.expectedVersion` passed to handler. DynamoDB condition `version = :expectedVersion` in versioned updates (version-helpers.ts, users.ts).                                                                      |
| On conflict, does the API return 409 with the current server version/etag? | **Pass** | `VersionConflictError` and handler code use `AppError.build(ErrorCode.VERSION_CONFLICT, ...).withDetails({ currentVersion: existingItem.version })`. `toApiError` keeps details; middleware preserves details in error response. Tests: `expect(body.error.details).toEqual({ currentVersion: 5 })` (error-handler.test.ts, types/test/errors.test.ts). |
| Can the agent deterministically re-read and retry?                         | **Pass** | 409 response includes `error.details.currentVersion`. GET /saves/:id returns `data.version`. Agent can GET resource and retry with `If-Match: <data.version>`.                                                                                                                                                                                          |

**Example snippet (409):**

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Resource has been modified",
    "requestId": "...",
    "details": { "currentVersion": 5 }
  }
}
```

---

### 6. Error model is machine-actionable

| Item                                                                           | Status   | Evidence                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured error codes (enum/string)                                           | **Pass** | `ErrorCode` enum in `backend/shared/types/src/errors.ts` (e.g. VALIDATION_ERROR, VERSION_CONFLICT, SCOPE_INSUFFICIENT, RATE_LIMITED). All errors go through `createErrorResponse(appError, requestId)`; body has `error.code`.                                                                 |
| Field-level validation errors with constraint and allowed values               | **Pass** | `FieldValidationError` in api.ts: `field`, `message`, `code`, `constraint?`, `allowed_values?`. Validation layer formats Zod errors with `constraint` and `allowed_values` (validator.ts, event-context). Error contract test: `allowed_values: ["article", "video", "podcast"]`.              |
| "What to do next" in fields (allowedActions, requiredConditions, currentState) | **Pass** | `AppError.toApiError` promotes `currentState`, `allowedActions`, `requiredConditions` from details to top-level of `error`. Wrapper test: `currentState: "paused", allowedActions: ["resume", "delete"]`. SCOPE_INSUFFICIENT includes `allowedActions: ["keys:request-with-scope"]` (auth.ts). |
| Correlation id in response and body (requestId)                                | **Pass** | `createErrorResponse` sets header `X-Request-Id: requestId` and body `error.requestId`. Success responses set same header; body does not duplicate requestId in envelope (only in errors).                                                                                                     |

---

### 7. Workflow navigation

| Item                                                                                          | Status            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Does success response include links/next actions? (HATEOAS-like or explicit nextActions list) | **Partial**       | List responses include `links.self` and `links.next` (pagination) via `createSuccessResponse(..., { links })` in list handlers (e.g. saves-list uses pagination helper that returns links). Single-resource GET includes `meta.actions` (allowed actions for this resource). Mutation success responses (e.g. PATCH /saves/:id 200) return updated resource in envelope but no explicit `nextActions` or `links.next` for "what to do next" after the mutation. Not evidenced: post-mutation workflow hints. |
| Are long-running actions modeled (operation id/status endpoint)?                              | **Not evidenced** | No async operation resource or status endpoint found in backend. Saves and auth flows are synchronous. Epic 9 (async pipelines) not implemented.                                                                                                                                                                                                                                                                                                                                                             |

---

### 8. Rate limiting and backpressure

| Item                                                           | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are rate limit headers present on normal responses?            | **Pass** | When rate limit middleware is enabled, `addRateLimitHeaders` in rate-limit-headers.ts adds `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Same values in `meta.rateLimit` (EnvelopeMeta). Integration test: `expect(response.headers?.["X-RateLimit-Limit"]).toBe("200")`.                                                                                                                                                                 |
| On 429, is Retry-After present? Any reset timestamp?           | **Pass** | `createErrorResponse` in error-handler.ts: when `error.code === ErrorCode.RATE_LIMITED` and `bodyDetails.retryAfter != null`, sets `headers["Retry-After"] = String(bodyDetails.retryAfter)`. Rate limiter provides `retryAfterSeconds` (rate-limiter.ts). Contract test: `expect(response.headers?.["Retry-After"]).toBe("1800")`. Reset is in `X-RateLimit-Reset` (Unix seconds) on normal responses; 429 body does not duplicate reset in documented shape. |
| Is throttling distinguishable from other errors (code/reason)? | **Pass** | 429 with `error.code === "RATE_LIMITED"`. ErrorCodeToStatus[ErrorCode.RATE_LIMITED] = 429. No other 4xx uses RATE_LIMITED.                                                                                                                                                                                                                                                                                                                                     |

---

### 9. Event history / reconciliation

| Item                                                | Status      | Evidence                                                                                                                                                                                                                   |
| --------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Is there a per-entity event history endpoint?       | **Pass**    | `GET /saves/:saveId/events` in saves-events/handler.ts using `createEventHistoryHandler`. Action registered as `saves:events`, urlPattern `/saves/:id/events`. Query params: limit, cursor, since.                         |
| Does it include actor identity and correlation ids? | **Pass**    | `EntityEvent` in types/events.ts: `actorType: ActorType` ("human" \| "agent"), `actorId: string                                                                                                                            | null`, `requestId: string`. Public event shape strips PK/SK/ttl only; actorType, actorId, requestId are in response. |
| Can an agent reconcile state after partial failure? | **Partial** | Event list is ordered and cursor-paginated; agent can use `since` and traverse. No evidenced "last N events" or "events for requestId" query; reconciliation is via replaying events and/or re-reading resource + version. |

**Example snippet (event record shape):**

```ts
// types/events.ts: EntityEvent has eventId, entityType, entityId, userId, eventType, actorType, actorId, timestamp, changes, context, requestId
```

---

### 10. Security model supports agents

| Item                                                  | Status   | Evidence                                                                                                                                                                                                                           |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authn/authz is clear for non-human clients            | **Pass** | API keys supported; authorizer sets `isApiKey`, `apiKeyId`, `scopes` (auth, route config). Handlers declare `requiredScope`; `requireScope(auth, requiredScope)` throws SCOPE_INSUFFICIENT with required_scope and granted_scopes. |
| Principle of least privilege is achievable per action | **Pass** | Each action has `requiredScope` (e.g. saves:read, saves:write, batch:execute). Scope resolver maps API key tiers to granted operations; 403 with `required_scope` and `granted_scopes` when insufficient.                          |
| Auditability (who did what) is evident                | **Pass** | Event history records `userId`, `actorType`, `actorId`, `requestId`, `eventType`, `timestamp`. X-Agent-ID header extracted and stored in event context (recordEvent params include actorType, actorId).                            |

---

## C) Top Gaps (ranked)

1. **Idempotency: same key, different request body replays first response**
   - **Why it matters:** Agent retries with corrected payload (e.g. fixed title) but reuses same Idempotency-Key; server returns cached success for the first (wrong) payload. Agent believes the intended mutation was applied.
   - **Minimal contract change:** Define that idempotency is keyed by (userId, idempotencyKey, operationPath). Either (a) document that request body is not part of the key and duplicate key with same path replays regardless of body, or (b) add optional request-body hash to the key and return 409 with a distinct code (e.g. IDEMPOTENCY_PAYLOAD_MISMATCH) when key exists with different hash, including a hint to use a new key.
   - **Verification:** (a) Send POST /saves with key K and body A, then same key K and body B; expect 200 with replayed response for A and header X-Idempotent-Replayed: true. (b) If adding hash: same key K, body B returns 409 with code and message stating payload mismatch.

2. **Success responses after mutations do not include next actions or workflow links**
   - **Why it matters:** After PATCH /saves/:id, the agent must guess what to do next (e.g. GET same resource for updated meta.actions, or call another action). No deterministic "next best steps" from the API.
   - **Minimal contract change:** Add optional `meta.actions` (or `meta.suggestedNextActions`) to mutation success responses (200/201) with the same ResourceAction list the next GET would return, or add `links.self` to the updated resource so the agent can follow to get meta.actions.
   - **Verification:** PATCH /saves/:id returns 200 with body containing either `meta.actions` array or `links.self`; agent can use either without a follow-up GET.

3. **Resource-scoped meta.actions omits input schema and constraints**
   - **Why it matters:** Agent sees actionId, url, method, requiredHeaders but not request body shape or validation rules. It must call GET /actions and match by actionId to get inputSchema, adding latency and failure points.
   - **Minimal contract change:** Either extend ResourceAction with optional `inputSchema` and `expectedErrors` (or a link to the catalog entry), or document that agents must resolve actionId via GET /actions?entity=X for full schema.
   - **Verification:** GET /saves/:id returns meta.actions[].actionId; client can GET /actions?entity=saves and find same actionId with inputSchema; or meta.actions[] includes inputSchema for each entry.

4. **Idempotency key retention and conflict behavior not in API contract**
   - **Why it matters:** Agents cannot know how long they can safely retry with the same key or what to do when key is reused for a different path.
   - **Minimal contract change:** Document in API spec or error details: (1) key retention (e.g. 24 hours), (2) IDEMPOTENCY_KEY_CONFLICT when key was used for a different method+path, with `details.boundTo` and optional `details.retryAfter` (e.g. seconds until key expires). Optionally return 409 with `Idempotency-Key-Status: consumed` or similar header on replay.
   - **Verification:** GET a documented contract (OpenAPI or .well-known) that states retention and conflict semantics; 409 response for same key different path includes `boundTo` and optionally retention/expiry hint.

5. **No long-running operation or status endpoint**
   - **Why it matters:** If the system later adds async jobs (e.g. bulk export), agents cannot poll for completion or correlate by operation id without a defined contract.
   - **Minimal contract change:** When async operations exist, add operation resource (e.g. GET /operations/:id) with status and optional result link; or document that all current operations are synchronous.
   - **Verification:** Either no async operations exist (documented) or GET /operations/:id returns 200 with status and links.

6. **Version in 409 is best-effort, not guaranteed current**
   - **Why it matters:** Implementation note in 3.2.7 AC8: "currentVersion in the 409 response is a best-effort hint from the pre-read; under concurrent writes it may be stale. Clients MUST re-read (GET) before retrying." If the agent uses 409's currentVersion directly for If-Match without re-reading, it can still conflict.
   - **Minimal contract change:** In error body, add a machine-readable hint such as `requiredConditions: ["Re-read resource with GET before retrying with If-Match"]` or a link to the resource; or always require GET after 409 in documented flow.
   - **Verification:** 409 VERSION_CONFLICT response includes `requiredConditions` or `links.resource` so agent always performs GET before retry when following the contract.

7. **Event history has no filter by requestId**
   - **Why it matters:** After a partial failure, the agent cannot efficiently fetch "all events for my requestId" to reconcile; it must scan with since/cursor and filter client-side.
   - **Minimal contract change:** Add optional query param `requestId` to GET /saves/:id/events (and other event endpoints). Return only events matching that requestId.
   - **Verification:** GET /saves/:id/events?requestId=req-123 returns 200 with events where event.requestId === "req-123".

---

## D) Agent Walkthrough Simulation

**Scenario:** Agent discovers actions, chooses an allowed action for a save, invokes update, receives 409, recovers, then finishes.

1. **Discover actions**
   - Agent calls `GET /actions?entity=saves`. Evidence: actions-catalog handler supports `entity` and `scope` query params; returns `{ data: ActionDefinition[], links: { self } }`.
   - Agent parses `data[]` for actionIds and urlPatterns (e.g. `saves:update`, PATCH, `/saves/:id`). Required headers from each action: Idempotency-Key, If-Match.

2. **Choose allowed action for a resource**
   - Agent calls `GET /saves/:saveId` to get resource and allowed actions.
   - Response: `{ data: { saveId, version, url, ... }, meta: { actions: [ { actionId: "saves:update", url: "/saves/<id>", method: "PATCH", requiredHeaders: ["If-Match", "Idempotency-Key"] }, ... ] } }`.
   - Agent uses `data.version` for If-Match and picks `saves:update` from `meta.actions`.

3. **Invoke**
   - Agent sends `PATCH /saves/:saveId` with `Idempotency-Key: <unique>`, `If-Match: <data.version>`, body `{ title: "New title" }`.
   - Success: 200 with `{ data: updatedSave, ... }`. No explicit next steps in contract; agent must decide (e.g. GET again for meta.actions or stop).

4. **Handle failure (409)**
   - Suppose agent had stale version; server returns 409 with `error.code === "VERSION_CONFLICT"`, `error.details.currentVersion === 3`, `error.requestId`.
   - Agent does not use `currentVersion` directly for retry (per AC8 note). It re-reads: `GET /saves/:saveId` to get fresh `data.version`.

5. **Recover and finish**
   - Agent retries PATCH with new `If-Match: <fresh version>` and a new Idempotency-Key (or same key if intent is "retry same logical operation" and contract allows).
   - 200 with updated resource; workflow complete.

**Missing for full simulation:** (1) Documented guarantee that 409's currentVersion is hint-only and GET-before-retry is required. (2) Post-mutation next actions or links so the agent does not need to guess. (3) Idempotency key reuse policy (same key for retry after 409) so the agent knows whether to reuse or generate a new key.

---

## E) Final Recommendation

**Option 1: Minimum viable agentic compatibility**

- Publish API contract (OpenAPI or equivalent) that documents: idempotency key semantics (retention 24h, key bound to method+path, replay behavior when body differs), 409 VERSION_CONFLICT and requirement to re-read with GET before retry, and that mutation 200 responses do not include next actions (agent should GET resource for meta.actions if needed).
- Add `requiredConditions` or similar to 409 response when re-read is required (e.g. `["Re-read resource with GET before retrying"]`).
- No new endpoints; clarify existing behavior so agents can implement deterministic recovery.

**Option 2: Best-in-class action-catalog target**

- Implement all of Option 1.
- Add `meta.actions` (or `links.self` to resource) to mutation success responses so the agent has immediate next-step discovery without an extra GET.
- Extend ResourceAction in meta.actions with optional `inputSchema` reference (e.g. link to GET /actions#actionId) or inline minimal schema so agents can reduce round-trips.
- Document idempotency payload semantics: either explicitly "replay by path only" or add body hash and 409 IDEMPOTENCY_PAYLOAD_MISMATCH with guidance.
- Add GET /saves/:id/events?requestId= for reconciliation.

**Option 3: Enterprise governance and observability**

- All of Option 2.
- Add operation resource for any future async workflows (GET /operations/:id with status, result link).
- Standardize rate limit and retry hints in a machine-readable form (e.g. `meta.rateLimit` and 429 body with `retryAfterSeconds`, `resetAt`).
- Consider returning `X-Idempotency-Key-Status: replayed` or similar on replayed responses so agents can log and audit idempotent replays.
