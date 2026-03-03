# Adversarial API Review: AWS Direct Connect API — Agentic Compatibility for Action-Catalog Context

**Scope:** Evaluate the [AWS Direct Connect API](https://docs.aws.amazon.com/directconnect/latest/APIReference/Welcome.html) against the same agentic-friendly criteria used for the AI Learning Hub API. Evidence is from the published API reference and common AWS patterns only.

---

## A) Verdict

- **Score (0–100) for "Agentic Compatibility":** 32
- **One-sentence justification:** The API exposes a fixed, documented list of operations with request/response syntax and common errors, returns resource state (e.g. `connectionState`) and uses token-based pagination, but there is no runtime action catalog, no resource-scoped allowed-actions or state-machine guidance, no idempotency mechanism for mutations, no optimistic concurrency or conflict response contract, no machine-actionable "what to do next" in errors, no event history or request-scoped reconciliation, and throttling/retry behavior is documented at the SDK level rather than in response headers or body, so an autonomous agent cannot discover, choose, or safely retry operations from the API contract alone.

---

## B) Evidence Checklist (Pass/Fail/Not evidenced)

### 1. Action catalog exists (global)

| Item                                        | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Endpoint(s) that enumerate actions          | **Fail**    | There is no runtime endpoint that returns available actions. Discovery is via the static [Actions](https://docs.aws.amazon.com/directconnect/latest/APIReference/API_Operations.html) page (e.g. CreateConnection, DescribeConnections, UpdateConnection, DeleteConnection, etc.). The API is invoked as JSON over HTTP with an `Action` parameter (common to all actions); the list of actions is not returned by the service.                                    |
| Stable action identifiers                   | **Pass**    | Action names are stable (e.g. `CreateConnection`, `DescribeConnections`, `UpdateConnection`). The API reference lists them explicitly; they are the same names used in the request (e.g. in query string or body depending on invocation style).                                                                                                                                                                                                                   |
| Human description + machine-readable inputs | **Partial** | Each action has a short human description and documented request syntax (e.g. [CreateConnection](https://docs.aws.amazon.com/directconnect/latest/APIReference/API_CreateConnection.html): bandwidth, connectionName, location, lagId, providerName, requestMACSec, tags). Inputs are described in prose and request syntax; there is no single machine-readable catalog (e.g. OpenAPI or JSON schema) that aggregates all actions with input schemas in one call. |

**Example snippet (discovery):**

```
Actions page lists: CreateConnection, DescribeConnections, UpdateConnection, DeleteConnection, ... (static HTML/docs only; no GET /actions).
CreateConnection request: { "bandwidth": "string", "connectionName": "string", "location": "string", ... }
```

---

### 2. Resource-scoped discoverability (per entity instance)

| Item                                                                  | Status            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where can an agent find allowed actions for /{entity}/{id} right now? | **Fail**          | There is no `meta.actions` or equivalent. Describe operations return resources (e.g. [DescribeConnections](https://docs.aws.amazon.com/directconnect/latest/APIReference/API_DescribeConnections.html) returns `connections[]` with connectionId, connectionState, etc.). The API does not attach a list of valid operations per resource. The agent must infer from documentation which actions apply to which resource types (e.g. UpdateConnection takes connectionId). |
| Is it state-aware (currentState influences allowedActions)?           | **Fail**          | Resources include state (e.g. `connectionState`: ordering, requested, pending, available, down, deleting, deleted, rejected, unknown). The API reference does not document which operations are valid in which state or return allowedActions. An agent cannot determine from the response alone whether UpdateConnection or DeleteConnection is valid for the current state.                                                                                              |
| Is it version-aware (currentVersion/etag influences allowedActions)?  | **Not evidenced** | No version or ETag field is documented on Connection or other resources. UpdateConnection does not document If-Match or optimistic concurrency. No version-aware conflict response is described.                                                                                                                                                                                                                                                                           |

---

### 3. Action invocation contract

| Item                                                                            | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint shape for invoking actions                                             | **Pass**    | Actions are invoked by sending a request with the action name (e.g. via [Common Parameters](https://docs.aws.amazon.com/directconnect/latest/APIReference/CommonParameters.html): Action, Version, and signing params). Request body is JSON with action-specific parameters (e.g. CreateConnection: bandwidth, connectionName, location). Single endpoint per region; action is specified in the request. |
| Required/optional headers (Idempotency-Key, If-Match, X-Request-Id, X-Agent-ID) | **Fail**    | Common Parameters document signing (X-Amz-Algorithm, X-Amz-Credential, X-Amz-Date, X-Amz-Security-Token, X-Amz-Signature, X-Amz-SignedHeaders). No Idempotency-Key, If-Match, X-Request-Id, or X-Agent-ID. AWS typically returns request correlation in `x-amzn-RequestId` header; not client-sent.                                                                                                        |
| Deterministic response shapes (envelope consistency)                            | **Partial** | Success responses are JSON with action-specific shapes (e.g. CreateConnection returns a single Connection object; DescribeConnections returns `{ connections[], nextToken }`). No standard envelope like `{ data, meta, links }` across all actions; list vs. single-resource shapes differ.                                                                                                               |

---

### 4. Idempotency and safe retries

| Item                                                                          | Status            | Evidence                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is there an idempotency mechanism for non-idempotent actions?                 | **Fail**          | [CreateConnection](https://docs.aws.amazon.com/directconnect/latest/APIReference/API_CreateConnection.html) and other mutation requests do not document a ClientToken or Idempotency-Key. AWS EC2 documents ClientToken for some operations; Direct Connect API reference does not mention idempotency tokens. Retrying CreateConnection with the same parameters could create duplicate resources. |
| Does the server replay prior result for the same key (status code + body)?    | **Not evidenced** | No idempotency key is documented; replay behavior is not specified.                                                                                                                                                                                                                                                                                                                                 |
| How long are keys retained? What is the conflict behavior if payload differs? | **Not evidenced** | N/A; no idempotency mechanism documented.                                                                                                                                                                                                                                                                                                                                                           |

---

### 5. Concurrency control

| Item                                                                       | Status            | Evidence                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is optimistic concurrency supported (ETag/If-Match/version)?               | **Not evidenced** | [UpdateConnection](https://docs.aws.amazon.com/directconnect/latest/APIReference/API_UpdateConnection.html) accepts connectionId, connectionName, encryptionMode. No version or ETag is documented on the resource or in the request. No conditional update semantics are described. |
| On conflict, does the API return 409 with the current server version/etag? | **Not evidenced** | Common Errors list includes 400 and 503; no 409 or conflict-specific error is documented for Direct Connect. No currentVersion or equivalent in error body.                                                                                                                          |
| Can the agent deterministically re-read and retry?                         | **Partial**       | Agent can call DescribeConnections(connectionId) to re-read state. Without version or conflict response, the agent cannot know if a concurrent update occurred except by comparing fields.                                                                                           |

---

### 6. Error model is machine-actionable

| Item                                                                           | Status            | Evidence                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Structured error codes (enum/string)                                           | **Pass**          | [Common Errors](https://docs.aws.amazon.com/directconnect/latest/APIReference/CommonErrors.html) list named exceptions: AccessDeniedException, ThrottlingException, ValidationError, DirectConnectClientException, DirectConnectServerException, etc. AWS JSON error responses typically include a type/code (e.g. `__type`) and Message.                                      |
| Field-level validation errors with constraint and allowed values               | **Not evidenced** | ValidationError is listed as "The input fails to satisfy the constraints specified by an AWS service" with HTTP 400. The Direct Connect reference does not document a structured field_errors array with field, constraint, or allowed_values. Action-specific errors (e.g. DuplicateTagKeysException, TooManyTagsException) are named but not shown with per-field structure. |
| "What to do next" in fields (allowedActions, requiredConditions, currentState) | **Fail**          | No documented allowedActions, requiredConditions, or currentState in error responses. The agent cannot derive next valid operations from the error body.                                                                                                                                                                                                                       |
| Correlation id in response and body (requestId)                                | **Partial**       | AWS APIs typically return `x-amzn-RequestId` in the response header. The Direct Connect Common Errors page does not show requestId in the error body; correlation is usually header-only for AWS services.                                                                                                                                                                     |

---

### 7. Workflow navigation

| Item                                                             | Status            | Evidence                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does success response include links/next actions?                | **Fail**          | Success responses return resource data (e.g. connection object or connections array and nextToken). No documented links.self, links.next, or nextActions. Pagination uses nextToken in the response body for list operations; no HATEOAS-style links. |
| Are long-running actions modeled (operation id/status endpoint)? | **Not evidenced** | CreateConnection and similar return the resource (e.g. connection in requested/pending state). No separate operation resource or GET /operations/:id is documented. State is on the resource (connectionState); polling is via DescribeConnections.   |

---

### 8. Rate limiting and backpressure

| Item                                                           | Status            | Evidence                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are rate limit headers present on normal responses?            | **Not evidenced** | The Direct Connect API reference does not document X-RateLimit-\* or equivalent headers on success responses. AWS SDK retry behavior is documented elsewhere (exponential backoff, jitter); service-level rate limit headers are not described in the Direct Connect docs.                                                                               |
| On 429, is Retry-After present? Any reset timestamp?           | **Partial**       | [Common Errors](https://docs.aws.amazon.com/directconnect/latest/APIReference/CommonErrors.html) list ThrottlingException with HTTP Status Code 400 (documentation inconsistency; many AWS services return 429 for throttling). Retry-After is not mentioned in the Direct Connect reference. AWS guidance is to use SDK retry with exponential backoff. |
| Is throttling distinguishable from other errors (code/reason)? | **Pass**          | ThrottlingException is a distinct named error. When returned, the error type/code allows the client to distinguish throttling from ValidationError or DirectConnectClientException.                                                                                                                                                                      |

---

### 9. Event history / reconciliation

| Item                                                | Status            | Evidence                                                                                                                                                                                                        |
| --------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is there a per-entity event history endpoint?       | **Fail**          | The Direct Connect API reference does not describe an event or history endpoint per connection (or per resource). AWS CloudTrail can log API calls, but that is account-level and not a per-resource event API. |
| Does it include actor identity and correlation ids? | **Not evidenced** | N/A; no event history API documented.                                                                                                                                                                           |
| Can an agent reconcile state after partial failure? | **Partial**       | Agent can re-read resources (e.g. DescribeConnections) to see current state. Without event history or requestId-scoped queries, reconciliation is limited to comparing before/after state.                      |

---

### 10. Security model supports agents

| Item                                                  | Status      | Evidence                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authn/authz is clear for non-human clients            | **Pass**    | Authentication uses [Signature Version 4](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_aws-signing.html) and AWS credentials (access key, optional session token). IAM policies define which actions and resources are allowed. Non-human clients use IAM users, roles, or access keys; well documented across AWS. |
| Principle of least privilege is achievable per action | **Pass**    | IAM supports resource-level and action-level policies (e.g. directconnect:CreateConnection, directconnect:DescribeConnections). Scoping by resource (e.g. connection ID) is possible.                                                                                                                                             |
| Auditability (who did what) is evident                | **Partial** | CloudTrail logs API calls with identity and request parameters. The Direct Connect API itself does not return actor identity or requestId in resource responses; audit is via CloudTrail, not the API response.                                                                                                                   |

---

## C) Top Gaps (ranked)

1. **No runtime action catalog**
   - **Why it matters:** An agent cannot ask the API "what operations exist?" or "what can I call with my current permissions?". It must rely on out-of-band documentation or preloaded action lists.
   - **Minimal contract change:** Expose a read-only operation (e.g. DescribeActions or ListOperations) that returns operation names, required parameters, and optionally required IAM actions, or publish a machine-readable OpenAPI/JSON schema that enumerates all actions.
   - **Verification:** A single request returns a list of action identifiers and at least minimal metadata (e.g. required parameters); or a documented OpenAPI/schema URL returns the same.

2. **No resource-scoped allowed actions or state-machine guidance**
   - **Why it matters:** Resources have state (e.g. connectionState) but the API does not tell the agent which operations are valid in that state. The agent must hard-code or guess (e.g. "can I delete when state is deleting?").
   - **Minimal contract change:** Include in Describe\* responses an optional field such as allowedActions or validTransitions for the current state, or document a state machine (states and allowed operations per state) in the API reference and optionally expose it via an API (e.g. DescribeConnectionStateMachine).
   - **Verification:** GET/Describe a resource; response includes a list of operation names or links that are valid for the current state.

3. **No idempotency for mutations**
   - **Why it matters:** Retries (e.g. after timeout or 503) can create duplicate connections or double-applied updates. The agent cannot safely retry without application-level deduplication.
   - **Minimal contract change:** Accept an optional idempotency token (e.g. ClientToken) on create/update operations; document that same token + same parameters replay the same result without creating a duplicate resource.
   - **Verification:** Two identical CreateConnection requests with the same ClientToken return the same connectionId and 200 without creating two connections.

4. **Errors do not provide allowedActions or requiredConditions**
   - **Why it matters:** On validation or state errors, the agent cannot determine what to do next from the response alone; it must parse prose or use fixed rules.
   - **Minimal contract change:** For validation or state errors, include in the error response optional allowedActions, requiredConditions, or currentState (and optionally currentVersion) so the agent can choose a valid action or re-read and retry.
   - **Verification:** A request that is invalid for current state returns 4xx with a body containing machine-readable allowedActions or requiredConditions.

5. **No optimistic concurrency or conflict response**
   - **Why it matters:** Concurrent updates can overwrite each other; the agent has no way to detect conflict or get the latest version to retry.
   - **Minimal contract change:** Add version or ETag to resources and to update requests (e.g. If-Match or expectedVersion). On conflict, return 409 with current version/ETag and optionally allowedActions.
   - **Verification:** Update with stale version returns 409 and a body that includes the current resource version or ETag.

6. **Rate limit and retry not in API response**
   - **Why it matters:** The agent does not know from the response when it is close to limits or when to retry after throttling; it depends on SDK or custom backoff.
   - **Minimal contract change:** On success, optionally include rate limit headers (e.g. X-RateLimit-Remaining, X-RateLimit-Reset). On 429, return Retry-After or a reset timestamp in body or header.
   - **Verification:** Throttled response includes 429 (or documented code) and Retry-After or equivalent; success response optionally includes rate limit metadata.

7. **No per-resource event history**
   - **Why it matters:** After a partial failure, the agent cannot query "what happened to this connection for my request?" to reconcile.
   - **Minimal contract change:** Provide an operation to list events or changes for a resource (e.g. by connectionId), with optional filter by requestId or time range.
   - **Verification:** A request returns a list of events for a resource, with at least timestamp and event type; optionally requestId and actor.

---

## D) Agent Walkthrough Simulation

**Scenario:** Discover actions, choose an allowed action for a connection, invoke update, handle a failure, recover, and finish.

1. **Discover actions**
   - Not possible from the API alone. The agent must use the static [API_Operations](https://docs.aws.amazon.com/directconnect/latest/APIReference/API_Operations.html) list or a preloaded schema. No GET or DescribeActions returns the catalog at runtime.

2. **Choose allowed action for a resource**
   - Agent can call DescribeConnections(connectionId) and get connectionState (e.g. available). The response does not include allowedActions or validTransitions. The agent must know from documentation that UpdateConnection and DeleteConnection apply to connections; it cannot know from state alone whether Update is allowed in "available" or only in certain states.

3. **Invoke**
   - Agent sends UpdateConnection(connectionId, connectionName, encryptionMode). No Idempotency-Key or If-Match. If the request times out, the agent does not know if the update was applied; retry may double-apply or create ambiguity.

4. **Handle failure**
   - If the service returns DirectConnectClientException or ValidationError, the error body is not documented to include allowedActions or requiredConditions. The agent cannot deterministically choose a corrective action from the response. If ThrottlingException (doc says 400), the reference does not document Retry-After; the agent must use generic backoff.

5. **Recover and finish**
   - Agent can re-call DescribeConnections to see current state. Without version or event history, it cannot distinguish "my update succeeded" from "someone else updated" or "my update never applied."

**Missing for full simulation:** Runtime action catalog, resource-scoped allowed actions, idempotency token, machine-actionable error fields (allowedActions, requiredConditions, currentState), optimistic concurrency and 409 with current version, and rate limit/Retry-After in the API contract.

---

## E) Final Recommendation

**Option 1: Minimum viable agentic compatibility**

- Publish a machine-readable list of operations (e.g. OpenAPI or JSON schema) that includes action names and input/output shapes so agents can discover and validate without scraping HTML.
- Document the state machine for key resources (e.g. connectionState and which operations are valid in each state); optionally add allowedActions or validTransitions to Describe\* responses.
- Document error response shape (e.g. \_\_type, Message, requestId) and add optional allowedActions or requiredConditions for validation/state errors.

**Option 2: Best-in-class action-catalog target**

- Add a read-only DescribeActions (or equivalent) that returns operations and metadata (required params, IAM actions).
- Include in each Describe\* response: allowedActions or validTransitions for the current resource state.
- Support ClientToken (or equivalent) for create/update and document replay semantics.
- Add version/ETag to resources and update requests; return 409 with current version on conflict.
- Include rate limit headers on success and Retry-After (or body field) on throttle; document ThrottlingException with 429 where applicable.

**Option 3: Enterprise governance and observability**

- All of Option 2.
- Provide a per-resource event or history API (e.g. by connectionId) with optional requestId filter for reconciliation.
- Document or return requestId (and optionally actor) in mutation responses or a standard response header so agents can correlate with CloudTrail.

---

## Comparison: AWS Direct Connect vs. AI Learning Hub API

| Criterion                   | AWS Direct Connect                                         | AI Learning Hub (from prior review)                                                                                        |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Action catalog**          | No runtime catalog; static docs only                       | GET /actions with filters; stable actionIds; inputSchema, requiredHeaders, expectedErrors                                  |
| **Resource-scoped actions** | None                                                       | meta.actions on single-resource GET; state-aware where state graph exists                                                  |
| **Idempotency**             | Not documented                                             | Idempotency-Key; replay; 24h TTL; IDEMPOTENCY_KEY_CONFLICT for wrong path                                                  |
| **Concurrency**             | No version/ETag documented                                 | If-Match + version; 409 VERSION_CONFLICT with currentVersion                                                               |
| **Error model**             | Named exceptions; no allowedActions/requiredConditions     | Structured code, requestId, currentState, allowedActions, requiredConditions; field_errors with constraint, allowed_values |
| **Workflow navigation**     | nextToken only; no next actions                            | links.self/next; meta.actions on GET; no next actions on mutation success                                                  |
| **Rate limiting**           | ThrottlingException; no Retry-After in Direct Connect docs | X-RateLimit-\* headers; 429 + Retry-After; RATE_LIMITED code                                                               |
| **Event history**           | None in API                                                | GET /saves/:id/events with actorType, requestId                                                                            |
| **Security for agents**     | IAM + SigV4; least privilege via IAM                       | API keys + scoped permissions; required_scope, granted_scopes in 403                                                       |
| **Score**                   | 32                                                         | 68                                                                                                                         |

**Summary:** The AI Learning Hub API is significantly more agentic-friendly than the AWS Direct Connect API for autonomous action-catalog style use. Direct Connect is built for human-driven or SDK-driven workflows with out-of-band documentation; it does not expose discovery, state-aware allowed actions, idempotency, or machine-actionable error guidance in the API contract. The Learning Hub API already provides a global action catalog, resource-scoped meta.actions, idempotency with replay, optimistic concurrency, structured errors with recovery hints, rate limit transparency, and event history; its main gaps are post-mutation next actions, idempotency payload semantics, and richer meta.actions (e.g. input schema). Closing those would extend its lead over a typical AWS service API for agentic use cases.
