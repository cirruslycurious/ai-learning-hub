# How This Project Is More Agent-Native Than Most Sites and Major Cloud Providers

This document compares the AI Learning Hub API (as shaped by Epic 3.2 and its foundations) to typical websites and to the REST/API design of major cloud providers: AWS, Azure, Google Cloud, and Oracle Cloud. The goal is to show that this project is deliberately more **agent-native**—easier and safer for LLMs and agentic workflows to consume—than most of the industry.

---

## The Bar: Most Websites and Typical APIs

Most websites are built for browsers and humans. They serve HTML, rely on sessions and cookies, use redirects and ad-hoc error messages, and offer no standard contract for retries, pagination, or rate limits. An agent scraping such a site must infer semantics, guess at idempotency, and handle failures with little structure. Many REST APIs are only slightly better: they target human developers or SDKs, with inconsistent error shapes, no standard idempotency mechanism, offset-based pagination that drifts under mutation, and little or no machine-readable “what to do next” in errors. LLMs and autonomous agents are an afterthought.

Major cloud providers improve on this with structured errors, request IDs, and (in many cases) token-based pagination. But their APIs are still optimized for traditional programmatic clients and SDKs, not for agents that must retry safely, interpret failures, and choose next actions without human intervention. The table below summarizes capability and contract surface across these categories; the sections that follow add detail.

| Capability / contract surface                                    | Typical website | Typical REST API | AWS                                                | Azure                                                                | Google Cloud                                            | Oracle Cloud (OCI)                               | AI Learning Hub (Epic 3.2)                                                   |
| ---------------------------------------------------------------- | --------------- | ---------------- | -------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Safe retries** for non-idempotent mutations (uniform contract) | No              | Inconsistent     | Often operation-specific; no universal HTTP header | Guidelines: Idempotency-Token (24h dedupe + replay); adoption uneven | request_id pattern: duplicate returns prior response    | opc-retry-token for some operations (24h)        | **Idempotency-Key** + cached replay (opt-in endpoints)                       |
| **Machine-actionable error details** (don’t parse prose)         | No              | Rare             | Structured codes; next-step hints not standardized | Structured errors vary by service                                    | google.rpc.Status + details/metadata for machine actors | Named codes; next-step hints not standardized    | **currentState** / **allowedActions** / **requiredConditions** when relevant |
| **Token/cursor pagination**                                      | No              | Mixed            | Token-based common                                 | Mixed                                                                | Token-based common (nextPageToken)                      | offset/count common; some APIs use opc-next-page | **Cursor-based** pagination                                                  |
| **Per-request correlation ID**                                   | No              | Mixed            | Request IDs common                                 | Correlation headers common                                           | Request IDs common                                      | opc-request-id common                            | **X-Request-Id**                                                             |
| **Resource-scoped event history** endpoint                       | No              | Rare             | Audit via CloudTrail (global)                      | Mixed                                                                | Mixed                                                   | Mixed                                            | **GET /:entity/:id/events**                                                  |

---

## AWS

AWS APIs are built for scale and automation. They use structured error codes (e.g. `ThrottlingException`, `ValidationException`), request IDs for correlation, and token-based pagination (e.g. `NextToken`, `NextPageToken`) that avoids offset drift. Conditional writes in services like DynamoDB support optimistic concurrency, but there is no standard **Idempotency-Key** header across AWS; idempotency is service- or operation-specific, and retries can still cause duplicate side effects where an operation is not naturally idempotent. When a version or condition check fails, responses do not follow a uniform **409 with currentVersion** pattern that tells an agent exactly what to re-read and retry.

AWS does not routinely expose **X-RateLimit-\*** on successful responses, so agents discover limits only when throttled. There is no “agent” identity in the API layer—only IAM principals—and no standard per-resource event history (audit is CloudTrail, global and not resource-scoped).

This project standardizes **Idempotency-Key** and cached replay; **If-Match** and **409** with **currentVersion**; rate limit headers; **X-Agent-ID** and **actor_type**; and **GET /:entity/:id/events**. Errors include **currentState**, **allowedActions**, and **requiredConditions** so an agent can choose the next action from the payload.

---

## Azure

Azure has moved toward agent- and retry-friendly design in its guidelines. Microsoft’s API guidelines propose an **Idempotency-Token** header (GUID, 24-hour duplicate detection, repeat-original-response semantics) for non-idempotent operations, aligning with the emerging IETF idempotency-key draft and with patterns used by Stripe and others. Adoption across Azure services is still uneven: clients are told not to rely on support unless documented, and the header is optional. Long-running operations use an optional **operation-id** for idempotent status polling, but there is no single, universal idempotency story for all mutation APIs.

Azure’s REST APIs use correlation headers (e.g. **x-ms-client-request-id**) and structured error responses, and the architecture guidance emphasizes stateless REST and clear resource URIs. Pagination and error contract details are service-dependent. There is no standard “allowed actions” or “current state” in errors to drive agent behavior, and no standard rate limit visibility headers or agent-identity semantics in the API layer.

This project commits to **Idempotency-Key** as first-class middleware, a single envelope and error contract with **currentState** and **allowedActions**, rate limit and agent-identity headers, and cursor-based pagination and event history—a more consistent, agent-oriented contract than Azure’s guidelines imply across services.

---

## Google Cloud

Google Cloud’s API design is among the most structured. AIP-193 defines a standard error format (**google.rpc.Status** with **code**, **message**, **details**). **ErrorInfo** in details provides machine-readable **reason** and **domain**, and **metadata** key-value pairs so that “machine actors do not need to parse error messages to extract information.” Messages are intended to be actionable, and **Help** payloads can link to troubleshooting. Pagination is token-based (**nextPageToken** / **pageToken**), which avoids offset drift and is agent-friendly.

Idempotency is supported via an optional **request_id** on request messages: when provided, the server should treat duplicate requests as idempotent and return the original response. This is request-body or message-level rather than a single, universal HTTP header like **Idempotency-Key**, and support is per-API. Google does not standardize rate limit headers on every response, and there is no first-class “agent” identity in the API—only credentials and request identifiers.

This project’s design is complementary: a **header-driven Idempotency-Key** and cached replay give a uniform retry story across commands; errors add **currentState**, **allowedActions**, and **requiredConditions** so agents get explicit next-step hints; **X-RateLimit-\*** and **X-Agent-ID** provide rate limit and agent visibility; and a single **{ data, meta, links }** envelope keeps parsing consistent. For an LLM or agent, the combination of idempotency, next-action error fields, and rate limit transparency goes beyond what Google’s current design requires.

---

## Oracle Cloud

Oracle Cloud Infrastructure uses REST with versioned base paths, request signing, and a unique **opc-request-id** per request. Error responses use HTTP status codes and named error codes (e.g. **InvalidParameter**, **IncorrectState**, **Conflict**). Retry guidance is limited: most errors are non-retryable except certain 409s with backoff guidance. Pagination in Oracle’s APIs is often **offset** and **count** (e.g. default **offset=0**, **count=20**), which is prone to drift and duplicates when data changes between pages—exactly what cursor- or token-based pagination avoids for agents.

There is no standard idempotency header, no “current state” or “allowed actions” in errors, and no standard rate limit or agent-identity headers. The API targets traditional integration, not LLM- or agent-native consumption. This project’s cursor pagination, idempotency-by-key, next-action error fields, rate limit visibility, and event history provide a clearly more agent-native baseline.

---

## Action-Catalog Targets (Salesforce-like)

Some platforms act as **targets** for agentic workflows by exposing a **catalog of actions** that clients can discover and invoke, rather than forcing every integration into CRUD-only resource endpoints. In these systems, the API surface explicitly says: "Here are the operations you can perform; here is how to describe them; here is how to invoke them." That model is closer to how autonomous agents operate: pick an action, supply parameters, execute, then choose the next step. The table below contrasts action-catalog targets with AI Learning Hub on both discovery/invocation and execution/recovery.

| Capability / contract surface                                 | Salesforce Actions                              | Microsoft Dataverse                     | OData (actions/functions)                             | AI Learning Hub (Epic 3.2)                                                     |
| ------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Action discovery / describe** (programmatic catalog)        | Describe support for invocable actions          | Actions in CSDL $metadata; discoverable | Actions/functions first-class in model; bound/unbound | Resource/command endpoints; no separate action catalog                         |
| **Invocation pattern**                                        | Common REST endpoint; describe then invoke      | POST to action URL; params in body      | POST to action; functions side-effect-free            | Command endpoints (e.g. POST /:entity/:id:action); Idempotency-Key on commands |
| **Safe retries** (idempotency)                                | Not a primary focus of the Actions API contract | Varies                                  | Not standardized in spec                              | **Idempotency-Key** + cached replay                                            |
| **Conflict resolution** (version / 409)                       | Not standardized at action level                | Varies                                  | Not standardized                                      | **If-Match** + **409** with **currentVersion**                                 |
| **Next-step hints in errors** (currentState / allowedActions) | Not standardized                                | Not standardized                        | Not standardized                                      | **currentState** / **allowedActions** / **requiredConditions** when relevant   |
| **Rate limit visibility**                                     | Varies                                          | Varies                                  | N/A                                                   | **X-RateLimit-Limit**, **Remaining**, **Reset**                                |
| **Agent identity**                                            | Not in API contract                             | Not in API contract                     | Not in spec                                           | **X-Agent-ID**; actor_type in event history                                    |

Action-catalog targets excel at **discovery and invocation**; Epic 3.2 focuses on **safe execution and machine-actionable recovery** once an action is chosen—so the two are complementary.

### Salesforce Actions (Invocable Actions)

Salesforce's Actions API is the canonical example of an action-catalog target. Salesforce documents that invocable actions can be invoked from a common endpoint in the REST API and that they provide "describe" support—a programmatic mechanism to learn about available invocable actions.

**How this resembles agentic interaction:** A client (human or agent) can discover capabilities and then invoke them, rather than hard-coding a set of endpoint semantics.

**How AI Learning Hub differs (per Epic 3.2 contract):** Salesforce's strength is action discovery + invocation. This project's Epic 3.2 contract pushes further on **deterministic autonomous operation once an action is chosen**: safe retries (Idempotency-Key + cached replay), deterministic conflict reconciliation (If-Match + 409 + currentVersion), and machine-readable next-step hints (currentState / allowedActions / requiredConditions) returned in error payloads when relevant. The "what next" fields are designed to make the next action selection explicit without parsing prose.

### Microsoft Dataverse (Dynamics / Power Platform) Web API Actions

Microsoft Dataverse exposes a similarly action-oriented surface: actions represent operations with side effects, are described in the service metadata (CSDL $metadata), and are invoked using HTTP POST to the action's URL with parameters in the body.

**Why this is an action-catalog target:** The platform explicitly treats actions as first-class operations, and the metadata model is designed so clients can discover them programmatically.

**How AI Learning Hub differs (per Epic 3.2 contract):** Dataverse standardizes action exposure via metadata; this project's differentiator is that the **runtime contract for agent autonomy** is standardized at the HTTP/middleware level (Idempotency-Key replay semantics, explicit 409 currentVersion, and "what next" hints in error payloads).

### The underlying pattern: OData Actions/Functions

There is also a broader, standards-based view: OData defines **actions** and **functions** to model operations that don't fit cleanly into CRUD. Functions must have no observable side effects; actions may have side effects; both can be bound or unbound to entity types.

**Why it matters for agentic clients:** OData's model makes "operations" a first-class concept alongside resources—much closer to an "agent picks an action" interaction model than pure CRUD.

**How AI Learning Hub differs:** This project's contract focuses less on modeling the action catalog (OData, Salesforce, and Dataverse already do that well) and more on **guaranteeing safe execution and machine-actionable recovery when actions fail**: deterministic retry, conflict resolution, and explicit next-step guidance.

### Where AI Learning Hub fits relative to action-catalog targets

Action-catalog targets (Salesforce Actions, Dataverse actions, OData actions) excel at **discoverability and invocation**: they offer a structured way to enumerate "things you can do" and then do them.

Epic 3.2's agent-native claim is **complementary**. It is about making action execution **safe and self-correcting** for autonomous clients, by standardizing:

- Idempotent retries via a first-class key and replay
- Deterministic optimistic concurrency with 409 + currentVersion
- Machine-readable "what to do next" fields (currentState / allowedActions / requiredConditions) surfaced in error responses when relevant

---

## Epic 3.2 actual contract (reference)

The following reflects the **in-code** contract from Epic 3.2 (error schema, headers, and an example 409 payload). Agents can rely on these shapes and headers when integrating.

### Error response schema

All error responses (4xx/5xx) use this envelope and body shape:

```json
{
  "error": {
    "code": "<ErrorCode string>",
    "message": "<human-readable string>",
    "requestId": "<uuid>",
    "details": { "<optional key-value context>" },
    "currentState": "<optional, e.g. lifecycle state>",
    "allowedActions": ["<optional array of valid next actions>"],
    "requiredConditions": ["<optional array of conditions to satisfy>"]
  }
}
```

- **code**: Enum value (e.g. `VALIDATION_ERROR`, `VERSION_CONFLICT`, `INVALID_STATE_TRANSITION`, `NOT_FOUND`).
- **details**: Optional. For validation errors it contains **fields**: an array of `{ field, message, code, constraint?, allowed_values? }`. For version conflicts it contains **currentVersion** (number).
- **currentState**, **allowedActions**, **requiredConditions**: Present only when relevant (e.g. state machine or conflict errors). Agents can use them to choose the next action without parsing prose.

### Key request/response headers

| Header                    | Direction                 | Purpose                                                                                                         |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Idempotency-Key**       | Request                   | Required on opted-in command endpoints. 1–256 chars, `[a-zA-Z0-9_\-.]`. Same key → same result (cached replay). |
| **If-Match**              | Request                   | Required on versioned mutations. Opaque version number (e.g. `5`). Mismatch → 409 with `currentVersion`.        |
| **X-Agent-ID**            | Request / Response (echo) | Optional. Identifies the agent (1–128 chars). Echoed on response for correlation.                               |
| **X-Request-Id**          | Response                  | Correlation ID for the request (every response).                                                                |
| **X-RateLimit-Limit**     | Response                  | Ceiling for current rate limit window (integer).                                                                |
| **X-RateLimit-Remaining** | Response                  | Requests remaining in window (integer, min 0).                                                                  |
| **X-RateLimit-Reset**     | Response                  | Unix epoch seconds when the window resets.                                                                      |
| **Retry-After**           | Response (on 429)         | Seconds to wait before retrying.                                                                                |
| **X-Idempotent-Replayed** | Response                  | `true` when the response was replayed from idempotency cache (no re-execution).                                 |

### Example: 409 version conflict

When a conditional write fails because the resource was modified (optimistic concurrency), the API returns **409 Conflict** with a body that includes the current server version so the agent can re-read and retry with **If-Match**:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Resource has been modified",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "details": {
      "currentVersion": 5
    }
  }
}
```

**Response headers** (typical): `Content-Type: application/json`, `X-Request-Id: <same as body>`, and when rate limiting is in use: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

Agent behavior: **GET** the resource again (to obtain the latest `version`), then retry the mutation with **If-Match: 5** (or the new version from the re-read).

---

## Summary: What “Agent-Native” Means Here

Across typical websites and the four major clouds, common gaps are: no universal header-driven idempotency; errors that describe what failed but not what to do next; little or no rate limit visibility before 429; no agent identity in the API; offset-based or inconsistent pagination; and no standard per-entity event history. This project addresses each.

Epic 3.2 makes the API agent-native by design: safe retries (Idempotency-Key + replay), clear concurrency (If-Match, 409, currentVersion), one envelope and error shape with currentState, allowedActions, requiredConditions, and field-level constraint and allowed_values; cursor-based pagination; rate limit headers; X-Agent-ID and actor_type; and GET /:entity/:id/events for reconciliation. That combination is rarer among major cloud providers than one might expect and puts this project ahead of most sites and many “API-first” products for LLM and agentic workflows.
