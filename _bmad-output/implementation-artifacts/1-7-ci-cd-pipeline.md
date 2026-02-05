# Story 1.7: CI/CD Pipeline with Quality Gates and Agent Security Scanning

Status: ready-for-dev

## Story

As a **developer (human or AI agent)**,
I want **a GitHub Actions CI/CD pipeline with mandatory quality gates and agent-specific security scanning**,
so that **every push and PR is validated (lint, type-check, tests, coverage, CDK synth, contract tests) and deployments are automated with no manual deploys**.

## Acceptance Criteria

1. **AC1: Pipeline runs on push and pull_request**
   - GIVEN a push or pull_request to the default branch (or any branch)
   WHEN the workflow is triggered
   THEN a single workflow runs the full gate sequence
   AND failed gates block progression (e.g. failing tests block deploy)

2. **AC2: Quality gates run in order per ADR-007**
   - GIVEN the pipeline runs
   WHEN each stage executes
   THEN the order is: Lint & Format → Type Check → Unit Tests (80% coverage gate) → CDK Synth → Integration Tests → Contract Tests → (Deploy Dev) → E2E Tests (6 persona paths) → (Deploy Prod)
   AND each stage fails the workflow if it fails
   AND 80% test coverage minimum is enforced (pipeline fails if below)

3. **AC3: Lint, format, and type-check gates**
   - GIVEN code in the repo
   WHEN the pipeline runs lint/format/type-check
   THEN `npm run format` (or equivalent) is enforced (e.g. check only or fix and fail if dirty)
   AND `npm run lint` runs and fails the job on errors
   AND `npm run type-check` (or `tsc --noEmit`) runs and fails on TypeScript errors
   AND all workspaces (frontend, backend, infra, shared) are included

4. **AC4: Unit tests with 80% coverage gate**
   - GIVEN the test suite
   WHEN the pipeline runs tests
   THEN `npm test` runs for all workspaces
   AND coverage is collected (e.g. vitest --coverage)
   AND the job fails if coverage is below 80% (configurable threshold)
   AND shared packages (@ai-learning-hub/*) are included in coverage

5. **AC5: CDK synth and CDK Nag**
   - GIVEN the infra workspace
   WHEN the pipeline runs CDK steps
   THEN `cdk synth` (or `npx cdk synth`) runs and fails on synth errors
   AND CDK Nag (security/best-practice rules) runs against the synthesized output
   AND Nag findings are reported; critical/high findings fail the job (or documented policy)

6. **AC6: Contract tests (OpenAPI validation)**
   - GIVEN API contracts (OpenAPI spec or equivalent)
   WHEN the pipeline runs contract tests
   THEN contract tests validate API behavior against the spec
   AND the job fails if contract tests fail
   AND contract tests can be implemented as a placeholder step if spec not yet final

7. **AC7: Agent-specific security scanning (FR79)**
   - GIVEN the repository
   WHEN the pipeline runs security scanning
   THEN dependency vulnerability scanning runs (e.g. OWASP dependency-check, npm audit, or equivalent)
   AND secrets detection runs (e.g. gitleaks, trufflehog, or GitHub secret scanning)
   AND SAST (static application security testing) runs where applicable (e.g. ESLint security plugin, CodeQL, or semgrep)
   AND the pipeline accounts for agent-generated code (e.g. 3x vulnerability rate per PRD) via policy or thresholds
   AND critical/high findings fail the job or are documented for human review

8. **AC8: Deploy stages (Dev and Prod)**
   - GIVEN successful gates up to deploy
   WHEN Deploy Dev runs (e.g. on merge to main or on workflow_dispatch)
   THEN deployment uses IaC only (e.g. `cdk deploy --all` or per-stack) from infra/
   AND deployment uses OIDC or stored credentials per security best practice (no long-lived secrets in repo)
   WHEN Deploy Prod runs (e.g. on tag or manual approval)
   THEN production deploy is gated by the same quality gates and optional manual approval
   AND no manual ad-hoc deployments are required for normal flow

9. **AC9: E2E tests (6 persona paths)**
   - GIVEN the E2E test suite (may be placeholder in V1)
   WHEN the pipeline runs E2E stage
   THEN up to 6 persona golden paths run (or placeholder jobs that document the paths)
   AND E2E failures block production deploy
   AND E2E can run against a deployed dev environment or local/containers as documented

10. **AC10: Shared library usage enforced in CI**
    - GIVEN backend/functions or any Lambda code
    WHEN the pipeline runs
    THEN lint/import rules enforce that Lambdas use @ai-learning-hub/* (logging, middleware, db, validation, types)
    AND the pipeline fails if forbidden imports or missing shared usage are detected (per Epic 1 cross-cutting constraint)

## Tasks / Subtasks

- [ ] **Task 1: Add GitHub Actions workflow file** (AC: 1, 2)
  - Create `.github/workflows/ci.yml` (or similar) with triggers: push, pull_request
  - Define jobs/steps in order: lint → type-check → unit-test (coverage) → cdk-synth → integration-tests → contract-tests → deploy-dev → e2e → deploy-prod
  - Use job dependencies (needs) so failure in one job fails the run
  - Document in README or .github/ that .github/ is human-escalate per file-guard

- [ ] **Task 2: Implement lint, format, type-check jobs** (AC: 3)
  - Run `npm run format` (check mode or write and fail if dirty)
  - Run `npm run lint` for all workspaces
  - Run `npm run type-check` (root or per workspace)
  - Use Node version from .nvmrc (e.g. 20.x)
  - Cache node_modules and optionally build outputs

- [ ] **Task 3: Implement unit test job with 80% coverage gate** (AC: 4)
  - Run `npm test` with coverage (e.g. vitest --coverage)
  - Configure coverage threshold 80% (e.g. in vitest.config or package.json)
  - Fail job if coverage below threshold
  - Include all workspaces that have tests (backend, shared/*, frontend, infra if any)

- [ ] **Task 4: Implement CDK synth and CDK Nag** (AC: 5)
  - Job: install deps, run `cdk synth` in infra/
  - Add CDK Nag (e.g. cdk-nag or aws-cdk-nag) and run against synth output
  - Define policy: fail on critical/high or document and log only for V1

- [ ] **Task 5: Add integration and contract test jobs** (AC: 6)
  - Integration tests: run any existing integration test suite (or placeholder script)
  - Contract tests: add step that runs OpenAPI/contract validation (or placeholder that echoes "contract tests" until spec is ready)
  - Fail job on failure

- [ ] **Task 6: Add agent-specific security scanning** (AC: 7)
  - Dependency scanning: npm audit (or OWASP dependency-check) — fail on critical/high per policy
  - Secrets: add step for secrets detection (e.g. Gitleaks, trufflehog, or GitHub advanced security)
  - SAST: add ESLint security plugin or CodeQL/semgrep step
  - Document FR79 (3x vulnerability rate for agent code) in workflow or README and set thresholds/review process

- [ ] **Task 7: Add deploy-dev and deploy-prod jobs** (AC: 8)
  - Deploy Dev: run `cdk deploy --all` (or approved subset) from infra/; use OIDC for AWS credentials where possible
  - Deploy Prod: same IaC, gated by branch/tag or workflow_dispatch; optional approval
  - Use environment secrets or OIDC; no long-lived keys in repo

- [ ] **Task 8: Add E2E job (6 persona paths)** (AC: 9)
  - Add job that runs E2E tests (Playwright or equivalent) for up to 6 persona paths
  - If E2E suite not yet implemented, add placeholder job with documented paths and skip/fake pass until Story implements them
  - E2E runs after deploy-dev if tests target deployed env

- [ ] **Task 9: Enforce shared library usage in CI** (AC: 10)
  - Add ESLint rule or script that fails if Lambda handlers import from non-@ai-learning-hub/* for logging, middleware, db, validation, types
  - Run this in lint or a dedicated CI step
  - Document in CLAUDE.md / .claude/docs that CI enforces this

- [ ] **Task 10: Document pipeline and run validation** (AC: 1–10)
  - Document pipeline in README or docs/ (stages, how to run locally, how to re-run)
  - Run the workflow on a branch and fix any failures
  - Update this story artifact with actual file list and any deviations

## Dependencies

- **Depends on:** Story 1.1 (monorepo, root scripts, workspaces), Story 1.2 (shared libs and tests), Story 1.3 (CLAUDE.md, .claude/docs), Story 1.4 (slash commands), Story 1.5 (hooks), Story 1.6 (issue/PR templates)
- **Blocks:** Reliable quality gates for all later stories; required for Epic 1 “CI/CD ensuring quality from day 1”

## Out of Scope

- Full E2E implementation of all 6 persona paths (can be placeholder in this story; detailed E2E in later stories)
- Deployment to real AWS from CI without user-configured OIDC/secrets (story implements structure; org configures credentials)
- Performance/load testing in pipeline
- Slack/Teams notifications (optional follow-up)

## Validation

- **AC1–AC10:** After implementation, trigger workflow on push/PR and confirm each gate runs in order and failures fail the run; confirm 80% coverage gate, CDK Nag, security scanning, and shared-library enforcement.

## References

- [Source: _bmad-output/planning-artifacts/architecture.md] ADR-007 (CI/CD with Automated Testing)
- [Source: _bmad-output/planning-artifacts/epics.md] Epic 1 Story 1.7, CI/CD Pipeline (ADR-007), FR79
- [Source: _bmad-output/planning-artifacts/prd.md] FR79 (agent security scanning, 3x vulnerability rate)
- [Source: .cursor/rules/file-guard.mdc] .github/ is ESCALATE — ask before modifying; story describes intended workflows

## File List (to be updated when implemented)

- _bmad-output/implementation-artifacts/1-7-ci-cd-pipeline.md
- .github/workflows/ci.yml (or similarly named workflow(s))
- (Optional) .github/README.md or docs/ci-cd.md describing pipeline stages and local checks
