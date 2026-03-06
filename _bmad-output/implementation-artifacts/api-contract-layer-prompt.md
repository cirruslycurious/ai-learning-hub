# Prompt: API Contract Layer Document

## Role and context

You are an expert technical writer and cloud systems auditor. You are writing documentation for a greenfield AWS serverless project (zero users, never deployed to production) called AI Learning Hub. The codebase is a TypeScript monorepo using AWS CDK, Lambda, DynamoDB, API Gateway, and Clerk for authentication.

You are producing ONE documentation artifact that describes the **current state of the API Contract Layer** — the cross-cutting response and interaction patterns that Epic 3.2 (Agent-Native API) established and that every domain handler in Epics 4+ must implement. This is NOT an Epic 3.2 story list or history lesson. It is a platform specification written in present tense.

Two prior documents already exist. You must read both before writing anything:

- `docs/architecture/foundational-baseline.md` — covers infrastructure, shared libraries, `wrapHandler` internals, logging, CI/CD, and developer tooling
- `docs/architecture/identity-access-layer.md` — covers authentication, `AuthContext`, role and scope enforcement, per-user data isolation

Do not re-document anything covered in those documents. Reference them by name and move on.

---

## Hard constraints

- **Output:** a single Markdown file at `docs/architecture/api-contract-layer.md`
- **Tense:** present tense throughout. "The envelope wraps..." not "Epic 3.2 added..."
- **No production names:** Do not write actual deployed resource names, physical ARNs, account IDs, or region identifiers. Use CDK logical IDs, naming patterns (`{env}-ai-learning-hub-{suffix}`), and code symbol references instead.
- **No em dashes.** Use commas or parentheses.
- **No domain walkthroughs:** The document describes the cross-cutting API contract mechanics. It does not describe what any specific endpoint does with saves, projects, or other domain data.
- **Uncertainty is explicit:** If something cannot be proven from repo source code or tests, label it "Unverified" or "Manual review" and state what evidence is missing.
- **Verification is strict:** "Verification" means a test that fails if the requirement breaks. Otherwise mark as "Manual review" or "No automated enforcement."
- **Prefer tables, type signatures, and invariant statements over prose.** Every claim about a response shape must be backed by a type or source reference. Every enforcement claim must name a test file or be labeled a gap.

---

## The API contract layer intent

Epic 1 established: "what exists before any handler runs."
Epic 2 established: "what is known about the caller before any domain logic runs."
Epic 3.2 establishes: "what any caller can rely on in any response, regardless of which domain produced it."

The API contract layer answers the question: _"What can every caller — human or agent — trust about the shape, behavior, and semantics of any API response from this system?"_

The document must describe:

- The standard response envelope all handlers return
- The error contract: shape, error codes, and gateway-level error responses
- Idempotency: how the `Idempotency-Key` header works, what replay guarantees exist, and what fail-open means
- Optimistic concurrency: how `If-Match` / version works, what conflict responses look like
- Cursor pagination: the opaque cursor contract, `links.next`, and what the absence of a cursor means
- Rate limit transparency: which headers expose rate limit state and when
- Agent identity: how `X-Agent-ID` is recorded and what `actorType` means
- Action discoverability: how `meta.actions` and the `GET /actions` catalog work
- Batch operations: the `POST /batch` contract

This does NOT include:

- What any specific endpoint does with domain data (saves, projects, links)
- Authentication and authorization mechanics (those are in the identity layer document)
- Infrastructure provisioning, table encryption, CI/CD (those are in the foundational baseline)
- Domain-specific state machines or entity lifecycles

---

## Classification rule for the API contract layer

A capability belongs to the API contract layer if and only if it meets **all five** criteria below. Apply this rule to decide what to include and exclude. Include the rule verbatim in Section 2 of the document.

| #   | Criterion                              | Test                                                                                                                                                                                                                     |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Client-observable**                  | It appears in an HTTP request header, response body, or response header. It is not an internal implementation detail. A caller can write a test against it without reading handler source code.                          |
| 2   | **Cross-domain uniform**               | It applies identically to saves endpoints, projects endpoints, and any future domain. The behavior does not vary by entity type or domain. A caller observing two different endpoints sees the same pattern.             |
| 3   | **Contract-stable**                    | An agent or integration built against it does not need to change when a new domain is added or an existing domain is extended. It is a platform promise, not a per-handler opt-in.                                       |
| 4   | **Handler-agnostic mechanism**         | A handler author implements the pattern via `wrapHandler` options or shared library primitives (`@ai-learning-hub/*`), not bespoke code. The mechanism is identical regardless of which domain the handler serves.       |
| 5   | **Enforced or explicitly labeled gap** | There is either (a) automated enforcement (unit test, integration test, CDK synth assertion) that fails if the contract breaks, or (b) an explicit "Manual review" or "No automated enforcement" label in this document. |

**Corollary:** If a behavior is specific to what a particular endpoint does with a particular entity (e.g., "a save has a `status` field that transitions from `active` to `deleted`"), that is a domain contract belonging to that epic's documentation. The API contract layer defines transport and envelope mechanics, not payload semantics.

**Allowed exceptions:** A domain-specific example may appear in this document only to illustrate a cross-cutting pattern, not to document the domain feature. Label it "illustrative example" and do not imply it is the full specification of that behavior.

---

## Required sections (use these headings verbatim)

### # API Contract Layer (Epic 3.2 Intent)

### ## 1. Purpose of the API Contract Layer

Describe what this layer establishes and what question it answers for every downstream caller. State the dependency on both prior documents (reference `docs/architecture/foundational-baseline.md` and `docs/architecture/identity-access-layer.md` by name). One short paragraph.

### ## 2. API Contract Layer Boundaries

Three sub-sections:

- **Belongs to the API contract layer** — table of categories and examples
- **Does not belong to the API contract layer** — bullet list
- **Classification rule** — the five-criterion table above, verbatim

### ## API Contract Layer Architecture Overview

A Mermaid diagram showing the `wrapHandler` middleware chain as a sequence of contract checkpoints for a generic handler invocation. Show the inbound contract checks (idempotency lookup, version read) and the outbound contract transformations (envelope wrapping, rate limit headers, idempotency store). Do not name specific domain handlers or routes. The diagram should show where each contract section applies in the chain.

A second Mermaid diagram showing the response envelope structure: the `{ data, meta, links }` shape, and which fields are always present vs optional. Use a simple block diagram or entity diagram, not a flowchart.

### ## 3. Error Contract

Document the ADR-008 error shape as it is actually implemented. Cover:

- **Error response shape:** the exact JSON structure for `{ error: { code, message, requestId } }`; read the type from `@ai-learning-hub/types`
- **Field-level validation errors:** the `FieldValidationError` type shape including `field`, `message`, `code`, `constraint`, `allowed_values`
- **State and conflict errors:** the extra fields (`currentState`, `allowedActions`, `requiredConditions`) on conflict and state-machine errors
- **Gateway-level error responses:** the four Gateway Responses configured in `ApiGatewayStack` (UNAUTHORIZED 401, ACCESS_DENIED 403, THROTTLED 429, DEFAULT_5XX 500); include the exact JSON template shape and the CORS headers injected
- **`ErrorCode` enum:** list the full enum from `@ai-learning-hub/types` with a brief description of each value

Include an exact TypeScript type signature for `ApiErrorBody` and `ApiErrorResponse` from source.

### ## 4. Response Envelope

Document the standard success response envelope. Cover:

- **`ResponseEnvelope<T>` type:** exact definition from `@ai-learning-hub/types`
- **`EnvelopeMeta` type:** all fields including `cursor`, `total`, `rateLimit`, `actions`
- **`ResponseLinks` type:** `self` and `next`
- **`RateLimitMeta` type:** `limit`, `remaining`, `reset`
- **When meta and links are included:** state which fields are always present, which are only present for list endpoints, and which are only present when rate limiting is active
- **Versioned entities:** the `VersionedEntity` type and `version` field; how handlers signal the current version so callers can construct an `If-Match` value

Read the exact types from `backend/shared/types/src/api.ts` and any related type files. Do not paraphrase — use the actual field names and types.

### ## 5. Idempotency Contract

Document the idempotency mechanism as a caller-facing contract (not its internal implementation). Cover:

- **Activation:** which `wrapHandler` option enables it; which endpoints in the current codebase use it (read the handler files to check which pass `idempotent: true`)
- **Request contract:** the `Idempotency-Key` header; format requirements; scope (per `userId` + key value)
- **On cache hit:** what the response looks like; the `X-Idempotent-Replayed: true` header; that the handler is not re-executed
- **On cache miss:** normal execution, then storage with 24-hour TTL in `IdempotencyTable`
- **Fail-open behavior:** what happens when DynamoDB storage fails; the `X-Idempotency-Status: unavailable` header; that the request still succeeds
- **Oversized response handling:** note if there is a size limit on stored responses and what happens when it is exceeded (read the idempotency middleware source to verify)
- **TTL:** 24 hours; keyed on `IDEMP#{userId}#{idempotencyKey}` in `IdempotencyTable`

Include the exact `IdempotencyRecord` type from `@ai-learning-hub/types`.

### ## 6. Optimistic Concurrency Contract

Document the versioned-write contract. Cover:

- **Activation:** which `wrapHandler` option enables it; which handlers use it
- **Request contract:** the `If-Match: {version}` header; where the version number comes from (the `version` field in response bodies)
- **On match:** normal execution
- **On conflict (409):** the exact error response shape including `currentState` and `allowedActions`; which `ErrorCode` is used
- **When `If-Match` is absent:** whether the handler rejects or proceeds (read the `extractIfMatch` implementation in middleware to verify)
- **The `VersionedEntity` type:** show the exact type; how handlers use `updateItemWithVersion` or `putItemWithVersion` from `@ai-learning-hub/db`

### ## 7. Cursor Pagination Contract

Document the pagination model. Cover:

- **Cursor opacity:** callers treat the cursor as an opaque string; the internal encoding (base64 JSON of DynamoDB `LastEvaluatedKey`) is not part of the contract
- **Request contract:** the `cursor` query parameter; the `limit` query parameter; default and maximum values (`DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE` from `@ai-learning-hub/db`)
- **Response contract:** `meta.cursor` (null or absent when no more pages); `links.next` (absent when no more pages); `meta.total` (present or absent — verify from source)
- **No offset or page numbers:** state this explicitly; only cursor-based navigation is supported
- **Cursor reset:** the `meta.cursorReset` flag; when it is set and what it signals to the caller

Include the `PaginatedResponse<T>` and `PaginationOptions` types from source.

### ## 8. Rate Limit Transparency

Document the rate limit response headers and how callers use them. Cover:

- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; when they appear (only when rate limiting is active on the endpoint)
- **429 response:** `Retry-After` header; the error body shape; which `ErrorCode` is used
- **`meta.rateLimit`:** the `RateLimitMeta` object in the envelope; when it is included
- **`identifierSource`:** distinguish `userId`-based and `sourceIp`-based limits; note that IP-based limits are not currently implemented (cross-reference the identity layer document's NFR-S9 gap)
- **Fail-open behavior:** what the caller observes when the rate limit DynamoDB check fails; that the request proceeds

### ## 9. Agent Identity and Actor Tracking

Document the agent identity contract. Cover:

- **Request contract:** the `X-Agent-ID` header; format requirements; what happens when absent
- **`AgentIdentity` and `ActorType` types:** exact definitions from `@ai-learning-hub/types`
- **What `actorType` means:** `"human"` vs `"agent"`; how it is determined (presence of `X-Agent-ID` header)
- **Response:** the `X-Agent-ID` header echoed in the response
- **Event history recording:** how `actorType` is written to `EventsTable` via `recordEvent`; that domain handlers are responsible for passing `actorType` to `recordEvent` (the contract layer provides the value but does not record events itself)
- **Scope:** every handler invocation via `wrapHandler` extracts agent identity; it is always available in `HandlerContext`

### ## 10. Action Discoverability

Document the action catalog contract. Cover:

- **`meta.actions` on single-resource GETs:** the `ResourceAction[]` type; what fields each entry contains (`actionId`, `url`, `method`, `requiredHeaders`); when it is included vs omitted
- **`GET /actions` catalog:** what the global catalog returns; the `ActionDefinition` type including all fields; how handlers register actions via `ActionRegistry`
- **State graph endpoint:** `GET /state-graph/{entityType}`; the `StateGraph` and `StateTransition` types; which entity types have state graphs registered
- **Registration mechanism:** how domain handlers register actions at module load via `getActionRegistry().register()`; read `action-registrations.ts` to find which actions are currently registered
- **Scope filtering:** whether the catalog filters by caller scope (verify from `actions-catalog/handler.ts`)

Include the exact `ActionDefinition`, `ResourceAction`, `StateGraph`, and `StateTransition` types from source.

### ## 11. Batch Operations Contract

Document the batch endpoint contract. Cover:

- **Endpoint:** `POST /batch` (note: this is itself a route; document only its cross-cutting contract properties)
- **`BatchOperation` type:** `method`, `path`, `body`, `headers`; constraints (which HTTP methods are supported, path format)
- **`BatchResponse` type:** `results[]` with per-operation `statusCode` and `data`/`error`; `summary.total/succeeded/failed`
- **Atomicity:** whether operations are atomic or independent (verify from source)
- **Authentication:** how `auth` is propagated to sub-operations (verify from `batch/handler.ts`)
- **Idempotency on batch:** whether `Idempotency-Key` applies to the batch request itself (verify from handler)
- **Limits:** maximum operations per batch request (verify from source or mark "Unverified")

Include exact `BatchOperation` and `BatchResponse` types from source.

### ## 12. FR and NFR Coverage (API Contract Layer)

Note at the top: the route handlers that implement individual endpoints are domain-layer concerns. This table records which contract-layer capabilities each FR and NFR depends on, not the full feature implementation.

**FRs to cover:** Read exact statements from `_bmad-output/planning-artifacts/epics.md`. Cover:

- FR64 (visual confirmation when save completes): the success envelope provides this signal
- FR65 (clear error messages when operations fail): the error contract provides this
- FR66 (helpful empty states): cursor absence in paginated responses signals empty
- FR67 (offline status): not within API contract scope; label accordingly

**NFRs to cover:**

- NFR-P2: API response time (95th percentile) < 1 second — note which contract features add latency (idempotency check, rate limit check) and whether there are performance tests
- NFR-I3: API contract stability — OpenAPI spec from tests, additive changes only — verify whether an OpenAPI spec is generated and where
- NFR-R7: User sees own writes immediately — strong consistency on user reads — note where this is enforced (DynamoDB `consistentRead` in query helpers) and where it is not
- NFR-UX1: Graceful degradation — clear error messages with retry option — how the error contract satisfies this

Apply the same strictness: "Implemented" requires a file path and symbol. "Verified" requires a named test file. Otherwise: "Manual review" or "No automated enforcement."

### ## 13. API Contract Invariants

State invariants as falsifiable assertions. For each, name the test that enforces it or label the gap explicitly.

Required invariants to include (add more if the code warrants it):

- Every 2xx response from a handler using `wrapHandler` is wrapped in `{ data, meta: { requestId }, links: { self } }`. No handler can return a bare object to the caller.
- Every 4xx/5xx response from a handler using `wrapHandler` conforms to `{ error: { code, message, requestId } }`. No handler can return an unstructured error body.
- A request with a previously-seen `Idempotency-Key` for the same `userId` returns the stored response and does not execute the handler again. The idempotency window is 24 hours.
- A `POST /batch` request propagates the caller's `AuthContext` to every sub-operation. No sub-operation can execute with a different identity than the parent request.
- Every paginated list response uses an opaque cursor. No endpoint returns a numeric offset or page number.
- When a rate-limited endpoint returns 429, it includes `Retry-After` and `X-RateLimit-Reset` headers so the caller knows exactly when to retry.
- The `version` field on a versioned entity response always reflects the current version in DynamoDB at the time of the read. Handlers never return a stale version number.

---

## Commands you must run and cite

Run these before writing. Cite the output (summarized, not pasted in full).

```bash
# Read the error handler and ADR-008 shapes
cat backend/shared/middleware/src/error-handler.ts

# Read the response envelope, wrapper chain, and HandlerContext
cat backend/shared/middleware/src/wrapper.ts

# Read idempotency middleware (caller-facing contract)
cat backend/shared/middleware/src/idempotency.ts

# Read concurrency / optimistic locking middleware
cat backend/shared/middleware/src/concurrency.ts

# Read pagination helpers (cursor encoding, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
cat backend/shared/db/src/pagination.ts  # or wherever pagination lives in @db
cat backend/shared/middleware/src/pagination.ts

# Read rate limit headers
cat backend/shared/middleware/src/rate-limit-headers.ts

# Read agent identity extraction
cat backend/shared/middleware/src/agent-identity.ts

# Read action registry and current registrations
cat backend/shared/middleware/src/action-registry.ts
cat backend/shared/middleware/src/action-registrations.ts

# Read the actions catalog handler
cat backend/functions/actions-catalog/handler.ts

# Read the state graph handler
cat backend/functions/state-graph/handler.ts

# Read the batch handler
cat backend/functions/batch/handler.ts

# Read all relevant types
cat backend/shared/types/src/api.ts
cat backend/shared/types/src/errors.ts
cat backend/shared/types/src/index.ts

# Find which handlers use idempotent: true
grep -r "idempotent: true" backend/functions --include="*.ts" | head -20

# Find which handlers use requireVersion: true
grep -r "requireVersion: true" backend/functions --include="*.ts" | head -20

# Find which handlers use rateLimit in wrapHandler
grep -r "rateLimit:" backend/functions --include="*.ts" | head -20

# Read the API Gateway stack for gateway response shapes
cat infra/lib/stacks/api/api-gateway.stack.ts

# Check what tests exist for contract-level behavior
find . -name "*.test.ts" | xargs grep -l "envelope\|idempotency\|ADR-008\|batchOperations\|cursor\|X-RateLimit\|Idempotency-Key" | head -20

# Run the full test suite and note results
npm test 2>&1 | tail -40

# Type check
npm run type-check 2>&1 | tail -10
```

---

## Process requirements

1. Read `docs/architecture/foundational-baseline.md` and `docs/architecture/identity-access-layer.md` first. Note what is already documented and do not repeat it. Cross-reference by section name when needed.
2. Read `_bmad-output/planning-artifacts/epics.md` to extract exact FR64-FR67 and NFR-P2, NFR-I3, NFR-R7, NFR-UX1 statements.
3. Read all type definitions from `@ai-learning-hub/types` (`api.ts`, `errors.ts`). Use exact field names and types in the document.
4. Read `wrapper.ts` to understand the full middleware chain order and which contract checkpoints run in which sequence.
5. Run the `grep` commands above to find which handlers currently activate idempotency, versioning, and rate limiting. This tells you which endpoints deliver which contract guarantees today.
6. Read each handler file listed in the grep output to verify the `wrapHandler` options are set correctly (not just that the option is imported).
7. Read `action-registrations.ts` to enumerate exactly which actions are currently registered. Do not assume all domains have registrations.
8. Read the `batch/handler.ts` to understand sub-operation execution, auth propagation, and atomicity behavior.
9. Run `npm test` and `npm run type-check`. Note results. If any tests are failing, call them out explicitly in the invariants section.
10. Produce the Mermaid diagrams based on the actual `wrapHandler` chain order, not assumptions. Verify the chain order from `wrapper.ts`.
11. For every "Implemented" claim in FR/NFR tables, include the exact file path and exported symbol. For every "Verified" claim, name the specific test file.

---

## What good looks like

A developer implementing Epic 4 (Projects) should be able to read this document and answer:

- My `POST /projects` handler uses `idempotent: true`. What header does the client send, what happens on the second identical request, and what header signals the replay?
- I want to support optimistic concurrency on `PATCH /projects/{id}`. What do I pass to `wrapHandler`, where does the `version` come from in the response, and what does the 409 response body look like?
- My `GET /projects` handler returns a paginated list. What does the response envelope look like? How does a caller know there are more pages?
- An agent calls `GET /projects/{id}`. What does `meta.actions` contain and how does the action catalog work?
- My handler returns a validation error for a missing field. What is the exact JSON shape the caller receives?
- API Gateway itself rejects a request with a missing auth token. What JSON does the caller receive?

If those six questions are answerable from this document alone, it is complete enough.

---

## Quality rules

- No filler prose. Prefer tables, code type signatures, and invariant statements over paragraphs.
- Every "Implemented" claim in the FR/NFR table must have a file path and symbol.
- Every "Verified" claim must name a specific test file and, where possible, the test description.
- Mermaid diagrams must reflect the actual `wrapHandler` chain order verified from `wrapper.ts`, not aspirational architecture.
- Do not claim something is "enforced" if the enforcement is only convention or documentation.
- If a test is currently failing (check `npm test` output), note it explicitly.
- Do not describe what a domain endpoint does with its payload. The moment you find yourself writing "the saves handler stores the URL in DynamoDB," you are out of scope.
- Oversized response handling, fail-open behavior, and TTL edge cases must be documented with source evidence, not assumed. If the source is ambiguous, label it "Unverified."
