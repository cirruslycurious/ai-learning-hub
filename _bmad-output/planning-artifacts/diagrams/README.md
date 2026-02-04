# Architecture Diagrams

Visual documentation for the AI Learning Hub architecture. All diagrams use Mermaid and render directly in GitHub.

## Diagram Index

| # | Diagram | Description |
|---|---------|-------------|
| 1 | [System Overview](./01-system-overview.md) | High-level view of users, clients, platform components, and external services |
| 2 | [User Flows](./02-user-flows.md) | Mobile (iOS Shortcut), desktop (PWA), and Android (Web Share Target) interaction flows |
| 3 | [Data & Pipeline Flow](./03-data-pipeline-flow.md) | Data architecture, table relationships, and the 3 async processing pipelines |
| 4 | [Authentication & Access](./04-authentication-access.md) | JWT and API Key auth flows, role-based access control |
| 5 | [Observability & Analytics](./05-observability-analytics.md) | Metrics collection, alerting, dashboards, and analytics API for agents |

## Quick Navigation

### For Understanding the System
Start with **[System Overview](./01-system-overview.md)** → then **[User Flows](./02-user-flows.md)**

### For Implementation
**[Data & Pipeline Flow](./03-data-pipeline-flow.md)** shows how data moves through the system

### For Security Review
**[Authentication & Access](./04-authentication-access.md)** covers all auth patterns and RBAC

### For Operations
**[Observability & Analytics](./05-observability-analytics.md)** shows monitoring and alerting

## Key Architectural Principles

These diagrams reflect the following ADRs:

- **ADR-014: API-First Design** — APIs are the product, UI is a reference implementation
- **ADR-005: No Lambda-to-Lambda** — All communication through API Gateway or EventBridge
- **ADR-003: EventBridge + Step Functions** — Async processing with independent failure domains
- **ADR-001: Multi-Table DynamoDB** — Separate tables per concern, USER# partition for isolation

## Related Documents

- [Architecture Decision Document](../architecture.md) — Full ADRs and technical decisions
- [PRD](../prd.md) — Product requirements
- [Product Brief](../product-brief-ai-learning-hub-2026-01-31.md) — Product vision

---

_Generated: 2026-02-04_
_Part of: BMAD Architecture Documentation_
