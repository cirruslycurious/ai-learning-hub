# Architecture Documentation Index

Design records and deep-dive references for the AI Learning Hub.

**Canonical planning document:** [`_bmad-output/planning-artifacts/architecture.md`](../../_bmad-output/planning-artifacts/architecture.md) — full ADR write-ups, diagrams, NFRs, and deployment topology.  
**Quick-reference for agents:** [`.claude/docs/architecture.md`](../../.claude/docs/architecture.md)

---

## Design Docs (this directory)

Living reference documents produced as part of epic implementation. Each doc captures the verified as-built state of a layer, with cross-references to the source code that proves it.

| Document                                                 | Scope                                                                                                                                                 | Epic     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [`foundational-baseline.md`](./foundational-baseline.md) | DynamoDB tables, S3, shared libraries (`@ai-learning-hub/*`), `wrapHandler` middleware chain, CI/CD, observability infra                              | Epic 1   |
| [`identity-access-layer.md`](./identity-access-layer.md) | JWT authorizer, API key authorizer, `AuthContext`, role/scope enforcement, Clerk integration, invite system                                           | Epic 2   |
| [`api-contract-layer.md`](./api-contract-layer.md)       | Response envelope, error contract, idempotency, optimistic concurrency, cursor pagination, rate-limit headers, agent identity, action discoverability | Epic 3.2 |

---

## ADR Summary

All ADR decisions are fully documented in `_bmad-output/planning-artifacts/architecture.md`. Short-form reference:

| ADR         | Decision                                                                                                                              | Key Doc                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **ADR-001** | Multi-table DynamoDB (7 tables). `USER#<userId>` for user data, `CONTENT#<urlHash>` for content.                                      | [`foundational-baseline.md`](./foundational-baseline.md) |
| **ADR-002** | V1 search via DynamoDB processed index. OpenSearch deferred.                                                                          | —                                                        |
| **ADR-003** | EventBridge + Step Functions for async (enrichment, notes, search sync). No SQS for workflows.                                        | [`.claude/docs/events.md`](../../.claude/docs/events.md) |
| **ADR-004** | Lambda per concern (saves, projects, links, search, content, admin, enrichment). Shared code in `@ai-learning-hub/*`.                 | [`foundational-baseline.md`](./foundational-baseline.md) |
| **ADR-005** | **No Lambda-to-Lambda.** Use API Gateway for sync, EventBridge for async.                                                             | [`.claude/docs/events.md`](../../.claude/docs/events.md) |
| **ADR-006** | CDK multi-stack: core, auth, api/\*, workflows, observability, pipeline. Deploy order: Core → Auth → API → Workflows → Observability. | [`foundational-baseline.md`](./foundational-baseline.md) |
| **ADR-007** | CI/CD with 80% coverage gate, CDK Nag, contract tests.                                                                                | [`foundational-baseline.md`](./foundational-baseline.md) |
| **ADR-008** | Standardized error handling and logging via shared middleware. Error shape: `{ code, message, requestId }`.                           | [`api-contract-layer.md`](./api-contract-layer.md)       |
| **ADR-009** | Eventual consistency accepted between content and user layer.                                                                         | —                                                        |
| **ADR-010** | Search on processed substrate, not raw notes.                                                                                         | —                                                        |
| **ADR-011** | Platform strategy: V1 PWA + iOS Shortcut. Native apps planned for V2.5 (iOS) and V3.5 (Android).                                      | —                                                        |
| **ADR-012** | Web Share Target API in PWA for Android share sheet.                                                                                  | —                                                        |
| **ADR-013** | Authentication: Clerk for auth and user management (JWT + API keys).                                                                  | [`identity-access-layer.md`](./identity-access-layer.md) |
| **ADR-014** | API-first: APIs are the primary product; web UI is reference implementation.                                                          | [`api-contract-layer.md`](./api-contract-layer.md)       |
| **ADR-015** | Lambda Layers for shared utilities across all functions (`@ai-learning-hub/*`).                                                       | [`foundational-baseline.md`](./foundational-baseline.md) |
| **ADR-016** | Cold start latency accepted in V1; no provisioned concurrency at boutique scale.                                                      | —                                                        |

---

## Related Docs

| Doc                                                    | Location                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Database schema (all 7 tables + 10 GSIs)               | [`.claude/docs/database-schema.md`](../../.claude/docs/database-schema.md)         |
| API patterns (REST conventions, agent-native contract) | [`.claude/docs/api-patterns.md`](../../.claude/docs/api-patterns.md)               |
| Observability (logging, X-Ray, EMF metrics)            | [`.claude/docs/observability.md`](../../.claude/docs/observability.md)             |
| Events package (`@ai-learning-hub/events`)             | [`.claude/docs/events.md`](../../.claude/docs/events.md)                           |
| Safety architecture                                    | [`.claude/docs/safety-architecture.md`](../../.claude/docs/safety-architecture.md) |
| Secrets and config                                     | [`.claude/docs/secrets-and-config.md`](../../.claude/docs/secrets-and-config.md)   |
