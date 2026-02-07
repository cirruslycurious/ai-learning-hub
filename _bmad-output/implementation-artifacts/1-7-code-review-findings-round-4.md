# Story 1.7 Code Review Findings - Round 4 (Adversarial)

**Story:** 1-7-ci-cd-pipeline  
**Reviewer:** Adversarial Senior Developer (workflow-driven)  
**Date:** 2026-02-07  
**Story file:** 1-7-ci-cd-pipeline.md  

## Git vs Story Discrepancies

**Discrepancy count:** 0 (working tree clean; all changes committed)

Story File List matches committed implementation. No uncommitted or undocumented files detected.

---

## Issues Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH     | 1 |
| MEDIUM   | 3 |
| LOW      | 2 |
| **Total**| **8** |

---

## CRITICAL ISSUES

### 1. Root-level CI/ESLint tests are never run in CI

**Files:** `package.json` (root), `test/ci-workflow.test.ts`, `test/eslint-rule.test.ts`

**Problem:** The story File List and Dev Agent Record claim "test/ci-workflow.test.ts", "test/eslint-rule.test.ts", and "Story-specific tests: 15/15 passing". The root test script is:

```json
"test": "npm run test --workspaces --if-present"
```

This only runs **workspace** test scripts (infra, frontend, backend, backend/shared/*). The root has a `test/` directory and `vitest.config.ts` at repo root, but **no root script invokes vitest**. Therefore:

- `test/ci-workflow.test.ts` (13 tests) and `test/eslint-rule.test.ts` (2 tests) are **never executed** when CI runs `npm test`.
- The pipeline does not validate the workflow YAML structure or the ESLint rule configuration in CI.
- Story claim that "15/15 passing" applies to CI is false for the CI environment.

**AC impact:** AC4 (unit tests for all workspaces); story-specific validation is not part of the gate.

**Fix:** Add a root-level test script that runs vitest for `test/**/*.test.ts` (e.g. `"test:root": "vitest run"` and either run it from root `test` or fold root tests into a workspace that is run). Prefer: root `test` script runs both workspace tests and root vitest, e.g. `"test": "vitest run && npm run test --workspaces --if-present"` with root vitest.config.ts, so root tests run first, then workspace tests.

---

### 2. Coverage not collected for backend, infra, frontend; 80% gate not monorepo-wide

**Files:** Root `package.json`, `.github/workflows/ci.yml`, workspace `package.json` files

**Problem:** CI runs `npm test -- --coverage`. The root script is `npm run test --workspaces --if-present`. The `--coverage` argument is **not** forwarded to workspace scripts (npm passes it to the root script, which does not use it). So:

- **Backend** runs `vitest run` (no `--coverage`).
- **Infra** runs `vitest run` (no `--coverage`).
- **Frontend** runs `vitest run` (no `--coverage`).
- Only **backend/shared/** packages have `vitest run --coverage` in their own script.

Root `vitest.config.ts` defines 80% thresholds but is **never used** (nothing runs vitest from repo root). So:

- Coverage is only collected for shared packages.
- Backend, infra, and frontend can have 0% coverage and the pipeline still passes.
- AC4 ("80% coverage … for all workspaces" / "shared packages … included in coverage") is not met monorepo-wide.

**Fix:** Either (a) make root `test` run vitest with coverage for root + aggregate, or (b) add `--coverage` to backend, infra, and frontend test scripts and ensure each has thresholds (or aggregate coverage and fail on a single threshold). Also ensure the CI job fails when coverage is below 80% (use vitest thresholds or a single check step that reads coverage output).

---

## HIGH ISSUES

### 3. COVERAGE_THRESHOLD env var is unused

**Files:** `.github/workflows/ci.yml`

**Problem:** The workflow sets `COVERAGE_THRESHOLD: 80` in `env` but no step reads or uses it. The unit-tests job does not reference `${{ env.COVERAGE_THRESHOLD }}`. Thresholds are only in vitest configs (and root config is unused). Dead configuration is misleading and suggests the gate is configurable when it is not.

**Fix:** Either (a) use `COVERAGE_THRESHOLD` in a step (e.g. a script that fails if coverage &lt; env value), or (b) remove the env var and document that thresholds are in vitest config only.

---

## MEDIUM ISSUES

### 4. .github/README.md format command is wrong

**Files:** `.github/README.md`

**Problem:** README says: "Runs `npm run format -- --check`". The workflow actually runs `npm run format:check`. Documentation drift can cause contributors to run the wrong command locally.

**Fix:** Change to: "Runs `npm run format:check`".

---

### 5. .github/README.md deploy behavior is wrong

**Files:** `.github/README.md`

**Problem:** README says deploy-dev "**Skips**: If AWS_ROLE_ARN secret not configured". The workflow was updated in a previous round to **fail** the job with a clear error when the secret is missing, not skip. README should not say "Skips".

**Fix:** Replace with: "**Fails if**: AWS_ROLE_ARN secret not configured (with clear error and setup link)."

---

### 6. ESLint rule test uses non-existent path for config

**Files:** `test/eslint-rule.test.ts`

**Problem:** Test uses `backend/functions/test/handler.ts` and `backend/functions/saves/create.ts`. `backend/functions/saves/` only has `.gitkeep`; `backend/functions/test/` does not exist. `calculateConfigForFile` still returns a config for the path, but the test is asserting on files that are not part of the implementation. If those paths are ever created with different structure, the test might not catch misconfiguration.

**Fix:** Use a path that exists (e.g. a real handler under `backend/functions/**`) or add a minimal fixture file used only for this test, and document that the test validates config for Lambda handler paths.

---

## LOW ISSUES

### 7. ESLint rule message references ADR-005

**Files:** `scripts/eslint-rules/enforce-shared-imports.js`

**Problem:** Message says "per ADR-005". Project rules (e.g. architecture-guard, import-guard) reference **ADR-014** for DynamoDB/shared lib usage in handlers. ADR-005 may be wrong or outdated.

**Fix:** Confirm correct ADR (e.g. ADR-014 or shared-libs ADR) and update the message.

---

### 8. Lint runs in two jobs

**Files:** `.github/workflows/ci.yml`

**Problem:** Lint runs in (1) `lint-and-format` and (2) `security-scan` (SAST with ESLint). Same `npm run lint` runs twice on main/PR. Redundant work and slightly longer pipeline.

**Fix:** Optional: have security-scan depend on lint-and-format and skip the lint step in security-scan, or document that SAST intentionally re-runs lint for the security context. Low priority.

---

## AC / Task Verification Summary

| AC / Task | Status | Note |
|-----------|--------|------|
| AC1 (triggers) | Met | push, pull_request, workflow_dispatch |
| AC2 (order) | Met | Jobs in correct order with needs |
| AC3 (lint, format, type-check) | Met | format:check, lint, type-check |
| AC4 (80% coverage) | **Not met** | Coverage not collected/aggregated for all workspaces; root tests not run |
| AC5 (CDK Nag) | Met | AwsSolutionsChecks in infra bin/app.ts; CI validates |
| AC6 (contract tests) | Met | Placeholder |
| AC7 (security scan) | Met | npm audit, TruffleHog, ESLint security |
| AC8 (deploy) | Met | OIDC, fail if creds missing |
| AC9 (E2E) | Met | Placeholder |
| AC10 (shared lib) | Met | enforce-shared-imports rule |
| Task 10 (run validation) | **Partial** | Root CI/ESLint tests not run in CI |

---

## Recommendation

**Do not mark story as done** until at least:

1. Root-level tests run in CI (Critical #1).  
2. Coverage is collected and 80% gate enforced monorepo-wide or per-workspace (Critical #2).  
3. COVERAGE_THRESHOLD is used or removed (High #3).  
4. README corrections (Medium #4, #5).

After fixes, re-run code review and then update story status and sprint-status.
