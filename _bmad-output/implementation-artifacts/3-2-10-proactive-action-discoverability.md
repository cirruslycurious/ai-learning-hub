# Story 3.2.10: Proactive Action Discoverability

Status: ready-for-dev

## Story

As an **AI agent integrating with the AI Learning Hub API**,
I want to **discover available operations, resource-scoped actions, and state machine transitions programmatically before attempting them**,
so that **I can plan multi-step workflows, avoid trial-and-error, and choose the correct action for a resource in its current state without failing first**.

## Acceptance Criteria

### Component 1: Global Action Catalog (`GET /actions`)

1. **AC1:** `GET /actions` returns a `200` response with the standard envelope `{ data: ActionDefinition[], meta, links }` listing all registered actions in the system.
2. **AC2:** Each `ActionDefinition` includes: `actionId` (stable string identifier, e.g. `saves:create`), `description` (human-readable summary), `method` (HTTP method), `urlPattern` (e.g. `/saves`, `/saves/:id:update-metadata`), `pathParams` (array of `{ name, type, description }` for URL placeholders like `:id`), `queryParams` (array of `{ name, type, required, description }` for query string filters), `inputSchema` (JSON Schema object describing the request body — uses standard JSON Schema `type`, `properties`, `required`, `enum`, `minLength`, `maxLength`, `pattern` vocabulary; `null` for actions with no body), `requiredHeaders` (array of `{ name, format, description }` objects — e.g. `{ name: "Idempotency-Key", format: "[a-zA-Z0-9_\\-.]  {1,256}", description: "Client-generated dedup key" }`), `requiredScope` (the `OperationScope` needed), and `expectedErrors` (array of `ErrorCode` values the action may return).
3. **AC3:** `GET /actions?entity=saves` returns only actions where `actionId` starts with `saves:`. Other entity filters work the same way.
4. **AC4:** `GET /actions?scope=read` returns only actions whose `requiredScope` is satisfied by the `read` permission tier (using existing `SCOPE_GRANTS` resolution logic).
5. **AC5:** `GET /actions?entity=saves&scope=read` combines filters (AND logic).
6. **AC6:** All `actionId` values are stable, machine-parseable identifiers — lowercase, colon-separated namespace:verb (no spaces, no prose).
7. **AC7:** Endpoint requires authentication (any valid JWT or API key). Returns `401` for unauthenticated requests.

### Component 2: Resource-Scoped Available Actions (`meta.actions[]`)

8. **AC8:** All single-resource GET responses (e.g. `GET /saves/:id`) include `meta.actions` — an array of `ResourceAction` objects describing operations valid for this specific resource instance.
9. **AC9:** Each `ResourceAction` includes: `actionId` (matches global catalog), `url` (fully resolved, e.g. `/saves/abc123:update-metadata`), `method` (HTTP method), and `requiredHeaders` (array of header name strings — lightweight form since full header details are in the global catalog).
10. **AC10:** For state-bearing entities (those with a registered state machine), `meta.actions[]` includes only actions/transitions legal from the resource's `currentState`. Illegal transitions are omitted, not listed with a "disabled" flag.
11. **AC11:** For non-state entities (e.g. saves in their current form), `meta.actions[]` includes all applicable command actions.
12. **AC12:** `meta.actions` is an empty array `[]` (never `null` or omitted) when no actions are available for the resource.
13. **AC13:** `meta.actions` is only added to single-resource GET responses, not to list/collection endpoints. This is a deliberate design decision: list endpoints return collections where per-item actions would multiply payload size; agents should `GET` individual resources to discover their available actions.

### Component 3: State Graph Endpoint (`GET /states/{entityType}`)

14. **AC14:** `GET /states/{entityType}` returns `200` with the standard envelope containing the full state machine definition for the requested entity type.
15. **AC15:** The `StateGraph` response includes: `entityType`, `states` (array of state identifiers), `initialState`, `terminalStates` (array), and `transitions` (array of `{ from, to, command, preconditions }` objects).
16. **AC16:** Each transition's `command` field matches an `actionId` in the global action catalog, creating a cross-reference between state graph and action catalog.
17. **AC17:** Returns `404 NOT_FOUND` with standard error contract for entity types that have no registered state machine (e.g. `saves` in current form).
18. **AC18:** Endpoint requires authentication. Returns `401` for unauthenticated requests.

### Cross-Cutting

19. **AC19:** All three endpoints use the standard response envelope `{ data, meta, links }` from Story 3.2.2.
20. **AC20:** The action registry is defined declaratively — actions are registered via a central registry module, not hardcoded in individual handler files. Future stories (3.2.7, 3.2.8) add domain actions by calling the registry, not by modifying discoverability handlers.
21. **AC21:** All discoverability payloads use only stable, machine-parseable identifiers. No prose in fields that agents parse programmatically.
22. **AC22:** `allowedActions` values in error responses (from Story 3.2.2 / FR100) MUST use the same `actionId` identifiers as the action catalog. If existing error responses emit bare verbs (e.g. `"resume"`) instead of namespaced IDs (e.g. `"projects:resume"`), add an alignment task to update the error builder so agents can cross-reference errors with the catalog. This ensures a single identifier namespace across proactive discoverability and failure-time hints.
23. **AC23:** `inputSchema` uses standard JSON Schema vocabulary (`type`, `properties`, `required`, `enum`, `minLength`, `maxLength`, `pattern`). Agents can validate inputs client-side before sending requests. Actions with no request body set `inputSchema: null`.
24. **AC24:** Minimum 80% test coverage across all new code. Unit tests for registry, state graph resolution, and meta.actions enrichment. Integration tests for all three endpoints.

## Tasks / Subtasks

- [ ] **Task 1: Action Registry Types** (AC: 2, 6, 9, 15, 16, 20, 21, 23)
  - [ ] 1.1 Define `ActionDefinition` interface in `@ai-learning-hub/types` — actionId, description, method, urlPattern, pathParams (`{ name, type, description }[]`), queryParams (`{ name, type, required, description }[]`), inputSchema (JSON Schema object | null), requiredHeaders (`{ name, format, description }[]`), requiredScope, expectedErrors, entityType
  - [ ] 1.2 Define `HeaderDefinition` interface — `{ name: string; format: string; description: string }`
  - [ ] 1.3 Define `ParamDefinition` interface — `{ name: string; type: string; description: string; required?: boolean }`
  - [ ] 1.4 Define `ResourceAction` interface in `@ai-learning-hub/types` — actionId, url, method, requiredHeaders (string[] — lightweight, full details in catalog)
  - [ ] 1.5 Define `StateGraph` interface in `@ai-learning-hub/types` — entityType, states, initialState, terminalStates, transitions[]
  - [ ] 1.6 Define `StateTransition` interface — from, to, command (actionId), preconditions[]
  - [ ] 1.7 Export all types from `@ai-learning-hub/types` index

- [ ] **Task 2: Action Registry Module** (AC: 1, 6, 20)
  - [ ] 2.1 Create `backend/shared/middleware/src/action-registry.ts` with `ActionRegistry` singleton
  - [ ] 2.2 Implement `registerAction(action: ActionDefinition)` — validates actionId format, deduplicates
  - [ ] 2.3 Implement `registerStateGraph(graph: StateGraph)` — validates state/transition consistency
  - [ ] 2.4 Implement `getActions(filters?: { entity?: string; scope?: string })` — with entity prefix and scope resolution via `SCOPE_GRANTS`
  - [ ] 2.5 Implement `getStateGraph(entityType: string): StateGraph | null`
  - [ ] 2.6 Implement `getActionsForResource(entityType: string, resourceId: string, currentState?: string): ResourceAction[]` — resolves state-aware available actions with fully-qualified URLs
  - [ ] 2.7 Export from `@ai-learning-hub/middleware` index
  - [ ] 2.8 Unit tests for registry (register, filter, dedup, state-aware resolution)

- [ ] **Task 3: Extend EnvelopeMeta Type** (AC: 8, 9, 12, 13)
  - [ ] 3.1 Add optional `actions?: ResourceAction[]` field to `EnvelopeMeta` in `@ai-learning-hub/types`
  - [ ] 3.2 Verify backward compatibility — existing code that omits `actions` still works
  - [ ] 3.3 Update `createSuccessResponse` JSDoc to document `meta.actions` usage

- [ ] **Task 4: Global Action Catalog Handler** (AC: 1, 2, 3, 4, 5, 7, 19)
  - [ ] 4.1 Create `backend/functions/actions-catalog/handler.ts` using `wrapHandler` pattern
  - [ ] 4.2 Parse query parameters: `entity` (string), `scope` (string)
  - [ ] 4.3 Call `ActionRegistry.getActions({ entity, scope })` and return with envelope
  - [ ] 4.4 Wire `GET /actions` route in API Gateway CDK stack
  - [ ] 4.5 Unit tests: all actions returned, entity filter, scope filter, combined filters, auth required
  - [ ] 4.6 Integration tests: end-to-end with registered actions

- [ ] **Task 5: State Graph Handler** (AC: 14, 15, 16, 17, 18, 19)
  - [ ] 5.1 Create `backend/functions/state-graph/handler.ts` using `wrapHandler` pattern
  - [ ] 5.2 Extract `entityType` from path parameter
  - [ ] 5.3 Call `ActionRegistry.getStateGraph(entityType)` — return 404 if null
  - [ ] 5.4 Wire `GET /states/{entityType}` route in API Gateway CDK stack
  - [ ] 5.5 Unit tests: valid entity type, unknown entity type returns 404, auth required
  - [ ] 5.6 Integration tests: end-to-end with registered state graph

- [ ] **Task 6: Resource-Scoped Actions Enrichment** (AC: 8, 9, 10, 11, 12, 13)
  - [ ] 6.1 Create `backend/shared/middleware/src/resource-actions.ts` helper
  - [ ] 6.2 Implement `buildResourceActions(entityType: string, resourceId: string, currentState?: string): ResourceAction[]`
  - [ ] 6.3 Integrate into `createSuccessResponse` or provide `withActions()` helper that handlers call when returning single-resource GET responses
  - [ ] 6.4 Ensure `meta.actions = []` (empty array) when no actions available, never null/omitted
  - [ ] 6.5 Unit tests: non-state entity gets all actions, state entity gets filtered actions, empty actions array
  - [ ] 6.6 Integration test: `GET /saves/:id` response includes `meta.actions[]`

- [ ] **Task 7: Seed Initial Action Registrations** (AC: 2, 6, 11, 20, 23)
  - [ ] 7.1 Create `backend/shared/middleware/src/action-registrations.ts` — declarative registration of all current saves domain actions (create, get, list, update, delete, filter, sort)
  - [ ] 7.2 Register discoverability actions themselves (actions-catalog, state-graph)
  - [ ] 7.3 Verify all actionId values follow `entity:verb` convention
  - [ ] 7.4 Each registration includes full `inputSchema` as JSON Schema, `pathParams`, `queryParams`, and structured `requiredHeaders` with format strings
  - [ ] 7.5 Document registration pattern for future stories (3.2.7, 3.2.8) in code comments

- [ ] **Task 9: Align Error Response `allowedActions` with Action Catalog IDs** (AC: 22)
  - [ ] 9.1 Audit existing `allowedActions` values emitted by `AppError` / error builder in `@ai-learning-hub/types` and `@ai-learning-hub/middleware`
  - [ ] 9.2 If existing values use bare verbs (e.g. `"delete"`), update to namespaced `actionId` format (e.g. `"saves:delete"`) — update error builder helpers and any hardcoded `allowedActions` arrays
  - [ ] 9.3 Update tests that assert on `allowedActions` values to use new namespaced format
  - [ ] 9.4 Add a test that validates all `allowedActions` values emitted by the codebase exist in the action registry

- [ ] **Task 8: CDK Infrastructure** (AC: 1, 7, 14, 18)
  - [ ] 8.1 Add `actions-catalog` Lambda function to API stack
  - [ ] 8.2 Add `state-graph` Lambda function to API stack
  - [ ] 8.3 Wire API Gateway routes: `GET /actions`, `GET /states/{entityType}`
  - [ ] 8.4 Ensure both functions use shared Lambda Layer
  - [ ] 8.5 Build infra (`npm run build` in infra/) and verify `cdk synth` succeeds

## Dev Notes

### Architecture Context

This story closes the gap between **reactive discoverability** (error responses with `allowedActions`, `currentState`, `requiredConditions` — already implemented in 3.2.2) and **proactive discoverability** (agents learn what's available before failing). The three components form a complete discoverability surface:

| Level | Endpoint / Pattern | When Used |
|-------|-------------------|-----------|
| Global catalog | `GET /actions` | Agent onboarding — "what can I do here?" |
| Resource-scoped | `meta.actions[]` on GET | Per-resource — "what can I do with THIS resource NOW?" |
| State graph | `GET /states/{entityType}` | Workflow planning — "what's the full lifecycle?" |
| Error-time (existing) | `allowedActions` in error body | Recovery — "I failed, what CAN I do?" |

### Key Design Decisions

1. **Registry pattern, not handler-introspection:** Actions are registered declaratively in a central module. This keeps handlers clean and makes the catalog deterministic. Future stories call `registerAction()` — they don't modify discoverability code.

2. **`meta.actions` extends `EnvelopeMeta`:** The existing envelope `{ data, meta, links }` already has `meta` for cursor/total/rateLimit. Adding `actions` is non-breaking — existing responses that don't populate it just omit the field.

3. **State graphs are optional per entity type:** Not all entities have lifecycle states. Saves currently don't (no status field). Projects (Epic 4) and tutorials (Epic 8) will register their state machines. `GET /states/save` returns 404 today — that's correct, not an error.

4. **Scope filter uses existing `SCOPE_GRANTS`:** The `?scope=read` filter reuses `resolveScopeGrants()` from Story 3.2.6's `scope-resolver.ts`. No new permission logic needed.

5. **`meta.actions` on single-resource GETs only:** List endpoints return collections — per-resource actions would multiply payload size (20 items × 5 actions = 100 action objects). Agents that need actions for a specific resource should `GET` the individual resource. This is a deliberate trade-off: one extra GET per resource vs bloating every list response.

6. **`inputSchema` uses JSON Schema vocabulary:** Standard JSON Schema (`type`, `properties`, `required`, `enum`, `pattern`, etc.) was chosen because it's the most widely understood schema format for machine consumers. Agents can validate inputs client-side. MCP tool builders can auto-generate tool definitions. No custom schema language needed.

7. **`requiredHeaders` are structured objects, not bare strings:** Each header includes `{ name, format, description }` so agents and tool builders know the expected value format (e.g. `Idempotency-Key` is `[a-zA-Z0-9_\-.]` 1-256 chars, `If-Match` is a version integer). This eliminates a round-trip to documentation.

8. **`pathParams` and `queryParams` are separated from `inputSchema`:** `inputSchema` describes the request body. Path parameters (`:id`) and query parameters (`?entity=`) have their own typed arrays. This separation makes auto-generation of HTTP requests unambiguous — agents know exactly which values go where.

9. **`allowedActions` in errors MUST match catalog `actionId` values:** Error responses from Story 3.2.2 emit `allowedActions` arrays. These MUST use the same namespaced `entity:verb` identifiers as the catalog. If an error says `allowedActions: ["saves:update-metadata"]`, the agent can look up that exact ID in `GET /actions` for the full schema. A single identifier namespace eliminates cross-referencing ambiguity.

### Timing: What Gets Registered Now vs Later

| Domain | Registered in 3.2.10 | Registered later |
|--------|----------------------|------------------|
| Saves (current CRUD) | `saves:create`, `saves:get`, `saves:list`, `saves:update`, `saves:delete` | 3.2.7 adds CQRS commands (`saves:update-metadata`) |
| Auth | — | 3.2.8 adds auth domain actions |
| Discoverability | `discovery:actions`, `discovery:states` | — |
| Projects | — | Epic 4 + state graph registration |
| Tutorials | — | Epic 8 + state graph registration |

### Existing Patterns to Follow

- **Handler pattern:** Use `wrapHandler()` with `requireAuth: true`. See `backend/functions/saves/handler.ts`.
- **Response envelope:** Use `createSuccessResponse(data, requestId, { meta, links })`. See `backend/functions/saves-list/handler.ts` lines 225-266.
- **Error responses:** Use `AppError` with `ErrorCode`. See `backend/shared/types/src/errors.ts`.
- **Type exports:** Add to `backend/shared/types/src/index.ts`. Follow existing export grouping.
- **Middleware exports:** Add to `backend/shared/middleware/src/index.ts`. Follow existing pattern.
- **Test utilities:** Use `createMockEvent`, `createMockContext`, `assertADR008Error` from `backend/test-utils/`.

### Project Structure Notes

```
backend/shared/types/src/
  api.ts                    ← Add ActionDefinition, ResourceAction, StateGraph, StateTransition, HeaderDefinition, ParamDefinition
  index.ts                  ← Export new types

backend/shared/middleware/src/
  action-registry.ts        ← NEW: ActionRegistry singleton (register, query, resolve)
  resource-actions.ts       ← NEW: buildResourceActions() helper
  action-registrations.ts   ← NEW: Declarative action seed data
  index.ts                  ← Export new modules

backend/functions/
  actions-catalog/
    handler.ts              ← NEW: GET /actions handler
    handler.test.ts         ← NEW: Unit + integration tests
  state-graph/
    handler.ts              ← NEW: GET /states/{entityType} handler
    handler.test.ts         ← NEW: Unit + integration tests

infra/lib/
  api-stack.ts              ← Add routes: GET /actions, GET /states/{entityType}
```

### Critical Constraints

- **MUST use `@ai-learning-hub/*` shared libraries** — no inline utility functions
- **MUST follow ADR-008** — all errors use standard error contract
- **MUST NOT modify existing handler behavior** — `meta.actions` is additive only
- **MUST NOT create Lambda-to-Lambda calls** — discoverability endpoints are standalone
- **CDK build required** — run `npm run build` in `infra/` after TypeScript changes before `cdk synth`
- **80% minimum test coverage** enforced by CI

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3.2, Story 3.2.10]
- [Source: _bmad-output/planning-artifacts/prd.md — FR95 "entity summary endpoints" clause]
- [Source: _bmad-output/planning-artifacts/prd.md — FR100 error contract with allowedActions]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR-AN7 error contract completeness]
- [Source: _bmad-output/planning-artifacts/prd.md — NFR-I3 API contract stability]
- [Source: backend/shared/types/src/api.ts — EnvelopeMeta, ResponseEnvelope, OperationScope types]
- [Source: backend/shared/types/src/errors.ts — AppError.toApiError() promotes allowedActions]
- [Source: backend/shared/middleware/src/error-handler.ts — createSuccessResponse, SuccessResponseOptions]
- [Source: backend/shared/middleware/src/scope-resolver.ts — SCOPE_GRANTS, resolveScopeGrants]
- [Source: backend/shared/middleware/src/wrapper.ts — wrapHandler, HandlerContext, WrapperOptions]
- [Source: backend/functions/saves-list/handler.ts — envelope with meta + links pattern]
- [Source: .claude/docs/epic-3.2-story-10-update.md — Rationale, FR/NFR mapping, recommended FR113-FR115]
- [Source: docs/agent-native-api-comparison.md — "no separate action catalog" gap acknowledged]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
