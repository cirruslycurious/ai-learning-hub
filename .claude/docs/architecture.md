# Architecture Summary

Condensed reference for agents. Full document: `_bmad-output/planning-artifacts/architecture.md` (canonical path: see .claude/docs/README.md).

## Key ADRs

| ADR         | Decision                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **ADR-001** | Multi-table DynamoDB (7 tables). User data: `USER#<userId>`. Content: `CONTENT#<urlHash>`.                           |
| **ADR-002** | V1 search via DynamoDB (processed index). OpenSearch optional later.                                                 |
| **ADR-003** | EventBridge + Step Functions for async (enrichment, notes, search sync). No SQS for workflows.                       |
| **ADR-004** | Lambda per concern: saves, projects, links, search, content, admin, enrichment. Shared code in `@ai-learning-hub/*`. |
| **ADR-005** | **No Lambda-to-Lambda.** Use API Gateway or EventBridge.                                                             |
| **ADR-006** | CDK multi-stack: core, auth, api/\*, workflows, observability, pipeline.                                             |
| **ADR-007** | CI/CD with 80% coverage gate, CDK Nag, contract tests.                                                               |
| **ADR-008** | Standardized error handling and logging via shared middleware.                                                       |
| **ADR-009** | Eventual consistency accepted between content and user layer.                                                        |
| **ADR-010** | Search on processed substrate, not raw notes.                                                                        |
| **ADR-011** | Platform Strategy: V1 PWA + iOS Shortcut; native apps planned for V2.5 (iOS) and V3.5 (Android).                     |
| **ADR-012** | Web Share Target API in PWA for Android (share sheet receive).                                                       |
| **ADR-013** | Authentication: Clerk for auth and user management (JWT + API keys).                                                 |
| **ADR-014** | API-first: APIs are the primary product; web UI is reference implementation.                                         |
| **ADR-015** | Lambda Layers for shared utilities across all functions (@ai-learning-hub/\*).                                       |
| **ADR-016** | Cold start latency accepted in V1; no provisioned concurrency at boutique scale.                                     |

## Stack Layout

```
infra/lib/stacks/
  core/       # DynamoDB tables, S3 buckets
  auth/       # Clerk/Auth0
  api/        # saves, projects, links, search, content, admin
  workflows/  # enrichment, notes-processing, search-index-sync
  observability/
  pipeline/
```

Deploy order: Core → Auth → API stacks → Workflows → Observability.

## Rules

- **API-first:** All cross-service communication via API or events; no direct Lambda invoke.
- **Lambda per concern:** One Lambda per domain (saves, projects, links, etc.); shared logic in `backend/shared` and `@ai-learning-hub/*`.
- **Per-user isolation:** User tables use `PK=USER#<userId>`; every API scoped to authenticated user.
- **Content table is global:** `PK=CONTENT#<urlHash>`; no user partition.
