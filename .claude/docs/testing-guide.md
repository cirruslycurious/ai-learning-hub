# Testing Guide Summary

80% coverage enforced. Full pipeline and persona paths: `_bmad-output/planning-artifacts/architecture.md` (ADR-007) and epics.

## Coverage

- **Minimum:** 80% line coverage per package (CI gate).
- **Command:** From repo root: `npm test`. Per workspace: `npm test` in that directory.
- **Coverage report:** Run tests with coverage (e.g. Vitest `--coverage`); enforce in CI.

## Test Levels

| Level           | Where                               | Purpose                                                       |
| --------------- | ----------------------------------- | ------------------------------------------------------------- |
| **Unit**        | Same package `test/` or `*.test.ts` | Pure logic, mocks for DB/HTTP                                 |
| **Integration** | backend/test or infra/test          | Real DynamoDB/localstack, API contracts                       |
| **Contract**    | API tests                           | Validate request/response shape; can drive OpenAPI            |
| **E2E**         | Persona paths                       | Golden paths for key user flows (save, project, link, search) |

## Where Tests Live

- **Root:** `npm test` runs tests in all workspaces.
- **backend:** `backend/test/`, and per-package e.g. `backend/shared/middleware/test/`, `backend/shared/validation/test/`.
- **backend shared packages:** Each has its own `test/` (e.g. `backend/shared/logging/test/`).
- **frontend:** `frontend/test/` (e.g. Vitest + React Testing Library).
- **infra:** `infra/test/` (e.g. CDK assertions).

## Commands

- `npm test` — run all workspace tests.
- `npm run build` — build all (tests may run as part of CI after build).

## Rules

- Do not skip tests to hit coverage; add or fix tests.
- Use shared libs (`@ai-learning-hub/types`, `@ai-learning-hub/validation`) in tests for consistency.
- Contract tests should validate ADR-008 error shape and success response shapes.
