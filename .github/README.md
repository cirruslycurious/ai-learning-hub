# GitHub Workflows

This directory contains CI/CD pipelines and GitHub configuration for ai-learning-hub.

## CI/CD Pipeline (`workflows/ci.yml`)

Comprehensive quality gates and deployment automation for all code changes.

### Pipeline Stages

The pipeline runs stages in strict order with dependency gates:

```
1. Lint & Format → 2. Type Check → 3. Unit Tests (80% coverage) →
4. CDK Synth → 5. Integration Tests → 6. Contract Tests →
7. Security Scan (parallel with 5-6) →
8. Deploy Dev (main only) → 9. E2E Tests → 10. Deploy Prod (manual approval)
```

### Quality Gates

#### Stage 1: Lint & Format

- Runs `npm run format -- --check` to verify code formatting
- Runs `npm run lint` across all workspaces
- **Fails if**: Format violations or lint errors exist

#### Stage 2: Type Check

- Runs `npm run type-check` (TypeScript compilation)
- **Depends on**: Lint & Format
- **Fails if**: TypeScript errors exist

#### Stage 3: Unit Tests with 80% Coverage Gate

- Runs `npm test -- --coverage` across all workspaces
- Enforces minimum 80% code coverage threshold
- Uploads coverage reports to Codecov (optional)
- **Depends on**: Type Check
- **Fails if**: Tests fail OR coverage < 80%

#### Stage 4: CDK Synth & CDK Nag

- Synthesizes CloudFormation templates from CDK code
- Runs CDK Nag security/best-practice checks
- **Depends on**: Unit Tests
- **Fails if**: CDK synth fails or critical CDK Nag findings

#### Stage 5: Integration Tests

- Placeholder for integration test suite
- Will test cross-component interactions
- **Depends on**: CDK Synth
- **Fails if**: Integration tests fail

#### Stage 6: Contract Tests (OpenAPI)

- Placeholder for API contract validation
- Will validate REST APIs against OpenAPI spec
- **Depends on**: Integration Tests
- **Fails if**: Contract violations detected

#### Stage 7: Security Scanning (Agent-Enhanced)

Runs in parallel with integration/contract tests. Per FR79 (PRD), AI-assisted code has 3x vulnerability rate, so extra scrutiny is applied.

- **Dependency Scan**: `npm audit` for vulnerable dependencies
- **Secrets Detection**: TruffleHog for leaked credentials
- **SAST**: ESLint security plugin for static analysis
- **Agent Code Notice**: Reminder that agent-generated code needs review
- **Depends on**: Unit Tests
- **Fails if**: Critical/high security findings

#### Stage 8: Deploy to Dev (Conditional)

- **Triggers**: Only on `push` to `main` branch
- Deploys all CDK stacks to dev environment
- Uses AWS OIDC for secure authentication (no long-lived keys)
- **Skips**: If AWS_ROLE_ARN secret not configured
- **Depends on**: Contract Tests + Security Scan
- **Fails if**: Deployment fails

#### Stage 9: E2E Tests (6 Persona Paths)

- **Triggers**: Only after successful dev deployment
- Placeholder for 6 golden-path persona tests:
  1. New User Onboarding
  2. Mobile Quick Save
  3. Resource Discovery
  4. Project Builder
  5. Tutorial Learner
  6. Power User (API)
- **Depends on**: Deploy Dev
- **Fails if**: E2E tests fail

#### Stage 10: Deploy to Production (Manual Approval)

- **Triggers**: Only on `push` to `main`, after E2E passes
- Requires manual approval via GitHub environment protection
- Uses separate AWS_ROLE_ARN_PROD secret
- **Depends on**: E2E Tests
- **Fails if**: Deployment fails

### Shared Library Enforcement (AC10)

The pipeline enforces use of `@ai-learning-hub/*` shared libraries in Lambda code:

- **ESLint Rule**: `local-rules/enforce-shared-imports`
- **Scope**: `backend/functions/**/*.{ts,js}`
- **Enforces**:
  - ✅ Use `@ai-learning-hub/logging` (not `console.*` or `winston`)
  - ✅ Use `@ai-learning-hub/db` (not raw `@aws-sdk/client-dynamodb`)
  - ✅ Use `@ai-learning-hub/validation` (not raw `zod`)
  - ✅ Use `@ai-learning-hub/middleware` for Lambda wrappers
  - ✅ Use `@ai-learning-hub/types` for shared TypeScript types

This rule runs during the lint stage and fails the build if violated.

### Local Development

Run the same quality gates locally before pushing:

```bash
# Full gate sequence
npm run format
npm run lint
npm run type-check
npm test -- --coverage

# CDK synth (from infra/)
cd infra && npx cdk synth

# Security checks
npm audit
```

### AWS Deployment Setup

To enable automated deployments:

1. **Dev Environment**:
   - Configure GitHub OIDC provider in AWS
   - Create IAM role with CDK deployment permissions
   - Add `AWS_ROLE_ARN` secret to GitHub (dev environment)

2. **Prod Environment**:
   - Create separate IAM role for production
   - Add `AWS_ROLE_ARN_PROD` secret to GitHub (production environment)
   - Enable environment protection rules (require approval)

See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

### Triggers

- **Push**: All branches → Runs quality gates (stages 1-7)
- **Pull Request**: To `main` → Runs quality gates (stages 1-7)
- **Main Branch Push**: → Full pipeline including deployment (stages 1-10)
- **Workflow Dispatch**: Manual trigger → Full pipeline

### Node.js Version

Pipeline uses Node.js **20** (from `.nvmrc`). All jobs use the same version for consistency.

### Coverage Threshold

Minimum **80% code coverage** enforced. Configurable via `COVERAGE_THRESHOLD` env var in workflow.

### Agent Security (FR79)

Per PRD requirement FR79, AI-assisted code has elevated vulnerability risk:

- Security scan findings are reviewed with extra scrutiny
- All findings documented and tracked
- Human review required for security-related changes

## Issue Templates

See `.github/ISSUE_TEMPLATE/` for standardized issue templates (configured in Story 1.6).

## Pull Request Template

See `.github/pull_request_template.md` for PR checklist (configured in Story 1.6).

## File Guard

⚠️ **IMPORTANT**: This directory (`.github/`) is protected by `file-guard.sh` hook.

Any modifications to `.github/` files will trigger **ESCALATE** mode, requiring:

- Human review and approval
- Explanation of changes
- Verification that changes don't bypass quality gates

This protection ensures CI/CD integrity and prevents accidental workflow modifications.
