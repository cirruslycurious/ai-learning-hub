---
epic_id: "3.5"
epic_title: "Code Cleanup & Technical Integrity"
status: in-progress
started: "2026-03-03T16:24:50Z"
runner: github-cli
stories:
  "3.5.1":
    title: "Epic 1 Code Cleanup"
    status: pending
    file: "_bmad-output/implementation-artifacts/3-5-1-epic-1-code-cleanup.md"
    depends_on: []
    touches:
      - backend/functions/invite-codes/handler.ts
      - backend/functions/jwt-authorizer/handler.ts
      - backend/functions/api-key-authorizer/handler.ts
      - backend/shared/types/src/api.ts
      - backend/shared/middleware/src/authorizerConstants.ts
      - backend/shared/middleware/src/index.ts
      - infra/lib/stacks/api/api-gateway.stack.ts
      - infra/lib/stacks/auth/auth.stack.ts
      - infra/test/stacks/auth/auth.stack.test.ts
      - infra/lib/stacks/api/saves-routes.stack.ts
      - infra/test/stacks/api/saves-routes.stack.test.ts
      - infra/test/stacks/api/ops-routes.stack.test.ts
      - .claude/docs/api-patterns.md
      - .claude/docs/README.md
---

# Epic 3.5 Auto-Run — Code Cleanup & Technical Integrity

## Activity Log

### Story 3.5.1: Epic 1 Code Cleanup

- [16:24] Story loaded. Status: pending → in-progress
