# Architecture

> **Canonical architecture:** The full Architecture Decision Document and diagrams are maintained in the BMAD planning artifacts.
>
> **→ [\_bmad-output/planning-artifacts/architecture.md](../_bmad-output/planning-artifacts/architecture.md)**

The canonical architecture includes:

- ADRs (ADR-001 through ADR-016) with rationale
- System architecture diagram, user flows, data pipeline, auth, observability
- DynamoDB table design (7 tables, 10 GSIs), Lambda layout, EventBridge + Step Functions
- API design, auth flow (Clerk JWT + API keys), CDK stack organization

Diagrams: [\_bmad-output/planning-artifacts/diagrams/](../_bmad-output/planning-artifacts/diagrams/) (01-system-overview, 02-user-flows, 03-data-pipeline-flow, 04-authentication-access, 05-observability-analytics)

---

**Quick reference (this repo):**

- Condensed ADR summary for agents: [.claude/docs/architecture.md](../.claude/docs/architecture.md)
- Database schema: [.claude/docs/database-schema.md](../.claude/docs/database-schema.md)
- API patterns: [.claude/docs/api-patterns.md](../.claude/docs/api-patterns.md)
