# Interesting Repo Stats — AI Learning Hub

**Generated:** 2026-02-23  
**Repo path:** `/Users/stephen/Documents/ai-learning-hub`  
**Purpose:** Engineering discipline metrics (spec-driven, test-driven, deployable) — not vanity metrics.

---

## 1. Executive Summary (Headline Stats)

| Metric                               | Value                                                                                                          | Why it matters                                                      | Evidence                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Codebase size (TS/TSX)**           | ~31,165 LOC                                                                                                    | Scope of implementation (excl. \_bmad, dist, coverage).             | `find` + `wc -l` on `*.ts`/`*.tsx`                                               |
| **Backend / Frontend / Infra split** | 19,848 / 545 / 6,341 LOC                                                                                       | Backend-heavy; infra as code is material.                           | Per-folder `wc -l` (backend, frontend, infra)                                    |
| **Test files**                       | 83                                                                                                             | Every workspace has Vitest; tests co-located.                       | 83 `*.test.ts`/`*.test.tsx` files                                                |
| **Total tests (Vitest)**             | ~1,591                                                                                                         | Strong unit/contract/architecture test surface.                     | Sum of `Tests X passed` from `npm test -- --run`                                 |
| **Test-to-code ratio**               | ~0.67 (20,831 test LOC / 31,165 src)                                                                           | High test investment; TDD/quality emphasis.                         | Test file LOC vs TS/TSX LOC                                                      |
| **Coverage gate**                    | 80% (lines, functions, branches, statements)                                                                   | CI blocks merges below threshold.                                   | `backend/vitest.config.ts` + `.github/workflows/ci.yml`                          |
| **PRD FRs / NFRs**                   | 91 FRs, 28 NFRs                                                                                                | Full requirements inventory; traceable to epics.                    | `_bmad-output/planning-artifacts/prd.md`, `epics.md`                             |
| **ADRs**                             | 16                                                                                                             | Architecture decisions documented and referenced.                   | `_bmad-output/planning-artifacts/architecture.md`                                |
| **CI pipeline stages**               | 10 (lint → type-check → unit → CDK synth → integration → contract → security → deploy-dev → e2e → deploy-prod) | Multi-gate pipeline; deploy only after tests + security.            | `.github/workflows/ci.yml`                                                       |
| **API route registry**               | 12 route entries, 11 unique paths                                                                              | Single source of truth; enforced by tests.                          | `infra/config/route-registry.ts`                                                 |
| **Architecture enforcement tests**   | 6 test files                                                                                                   | Route completeness, authorizer types, handler wiring, API contract. | `infra/test/architecture-enforcement/*.test.ts`                                  |
| **TypeScript strict**                | `strict: true` (root + workspaces)                                                                             | No implicit any; safer refactors.                                   | `tsconfig.base.json`, workspace tsconfigs                                        |
| **Doc-to-code ratio (MD/code)**      | ~2.54 (79,328 MD / 31,165 TS)                                                                                  | Docs exceed code; spec-first posture.                               | MD LOC (excl. \_bmad) / TS LOC                                                   |
| **BMAD artifacts**                   | 69 files under `_bmad-output/`                                                                                 | Planning + implementation artifacts; AI-SDLC in use.                | `_bmad-output/` (planning + implementation)                                      |
| **Env discipline**                   | 3 env templates                                                                                                | No secrets in repo; config documented.                              | `.env.example`, `frontend/.env.example`, `scripts/smoke-test/.env.smoke.example` |

---

## 2. Full Metrics Catalog

### A) Codebase size & shape

| Metric                       | Definition                                                                            | Value                                                                                                                                                      | How computed                                                                                                                                                 | Evidence                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **LOC by language (TS/TSX)** | Lines in `.ts` and `.tsx` files, excluding node_modules, .git, dist, coverage, \_bmad | 31,165                                                                                                                                                     | `find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/coverage/*" ! -path "./_bmad/*" \| xargs wc -l` | Sum of line counts                                     |
| **LOC by language (MD)**     | Lines in `.md` files (excl. node_modules, .git, \_bmad)                               | 79,328                                                                                                                                                     | Same pattern for `*.md`                                                                                                                                      | 428 MD files                                           |
| **File counts by extension** | Count of files per extension (excl. node_modules)                                     | ts: 174, tsx: 3, js: 37, md: 966, yaml: 72, yml: 1, json: 52                                                                                               | `find . -type f -name "*.<ext>" ! -path "*/node_modules/*" \| wc -l` per ext                                                                                 | Repo scan                                              |
| **Backend LOC**              | TS/JS LOC under `backend/` (excl. dist, coverage)                                     | 19,848                                                                                                                                                     | `find ./backend -type f \( -name "*.ts" -o "*.tsx" \) ! -path "*/dist/*" ! -path "*/coverage/*" \| xargs wc -l`                                              | Tail line                                              |
| **Frontend LOC**             | TS/TSX under `frontend/`                                                              | 545                                                                                                                                                        | Same for `frontend/`                                                                                                                                         | Tail line                                              |
| **Infra LOC**                | TS under `infra/`                                                                     | 6,341                                                                                                                                                      | Same for `infra/`                                                                                                                                            | Tail line                                              |
| **Churn (90 days)**          | Lines added/removed in last 90 days                                                   | +263,010 / −11,246                                                                                                                                         | `git log --since="90 days ago" --numstat --pretty=format: \| awk 'NF==3 {add+=$1; del+=$2} END {print add, del}'`                                            | Git numstat                                            |
| **Churn (30 days)**          | Lines added/removed in last 30 days                                                   | +263,010 / −11,246                                                                                                                                         | Same with `--since="30 days ago"`                                                                                                                            | Same as 90d (likely all recent commits in same window) |
| **Hotspots (90d)**           | Files with most commit touches in 90d                                                 | 1) sprint-status.yaml (28), 2) infra auth.stack.ts (14), 3) package-lock.json (13), 4) auth.stack.test.ts (12), 5) docs/progress/epic-2.1-auto-run.md (12) | `git log --since="90 days ago" --name-only --pretty=format: \| sort \| uniq -c \| sort -rn \| head -25`                                                      | Top 5 above                                            |

**Note on churn:** 30d and 90d totals matching suggests either few commits in the 30–90d window or that most edits fall in a short recent period; treat as “recent activity” rather than literal 30 vs 90.

---

### B) Documentation & spec rigor

| Metric                                   | Definition                                                          | Value                                                                                                                                                                                                                                                                            | How computed                                                                        | Evidence                                                      |
| ---------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------- |
| **Markdown LOC (excl. \_bmad)**          | Total lines in .md files outside \_bmad                             | 79,328                                                                                                                                                                                                                                                                           | `find . -name "*.md" ! -path "./_bmad/*" ! -path "*/node_modules/*" \| xargs wc -l` | Tail total                                                    |
| **Markdown file count (excl. \_bmad)**   | Number of .md files                                                 | 428                                                                                                                                                                                                                                                                              | `find . -name "*.md" ! -path "./_bmad/*" \| wc -l`                                  | Count                                                         |
| **Doc-to-code ratio**                    | MD LOC / TS+TSX LOC                                                 | ~2.54                                                                                                                                                                                                                                                                            | 79,328 / 31,165                                                                     | Ratio                                                         |
| **Planning artifact inventory**          | PRD, architecture, ADRs, epics, stories, retros under \_bmad-output | PRD: `planning-artifacts/prd.md`, Architecture: `planning-artifacts/architecture.md`, Epics: `planning-artifacts/epics.md`, Diagrams: `planning-artifacts/diagrams/` (7+), Implementation readiness: 4 reports, Research: 6+; Implementation: 50+ story/retro/artifact .md/.yaml | Manual inventory of `_bmad-output/`                                                 | See glob and listing                                          |
| **ADR count**                            | Number of ADRs in architecture doc                                  | 16                                                                                                                                                                                                                                                                               | `grep -E '^## ADR-                                                                  | ^### ADR-' \_bmad-output/planning-artifacts/architecture.md`  | ADR-001 through ADR-016 |
| **ADR status breakdown**                 | Accepted/Superseded/etc.                                            | Not available                                                                                                                                                                                                                                                                    | No structured status field in ADR headings; would require convention or frontmatter | N/A                                                           |
| **Cross-link density (docs)**            | Rough count of markdown links in docs                               | Low double digits in `docs/` (e.g. PRD, ARCHITECTURE, templates)                                                                                                                                                                                                                 | `grep -r '\[.*\](.*\.md\|.*#)' docs --include='*.md' \| wc -l` (approx.)            | Sparse explicit links; many refs by path                      |
| **Stories with “Acceptance Criteria”**   | Progress/story docs mentioning acceptance criteria                  | 19+ files in `docs/progress/`                                                                                                                                                                                                                                                    | `grep -l "Acceptance Criteria\|acceptance criteria" docs/progress/*.md`             | Multiple epic/story progress files                            |
| **Stories with Risk/Depends on/Touches** | Progress docs with metadata-style terms                             | 6 files (epic-2, epic-2.1, epic-3, epic-3.1, foundations reviews)                                                                                                                                                                                                                | `grep -l "Risk\|Depends on\|Touches" docs/progress/*.md`                            | Few files; not consistently structured                        |
| **Stories linking to PRD/ADR/epic**      | Explicit traceability links                                         | Epics and implementation reports reference FR/NFR IDs and epic IDs                                                                                                                                                                                                               | Grep for FRnn, NFR-\*, Epic-n in docs and \_bmad-output                             | Qualitative: present in epics.md and implementation-readiness |

---

### C) Requirements inventory

| Metric                          | Definition                               | Value                                                   | How computed                                                                                                            | Evidence                                    |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **# FRs**                       | Functional requirements in PRD/epics     | 91                                                      | Count of “FRnn:” / “- FRnn” in `_bmad-output/planning-artifacts/prd.md` and `epics.md`                                  | 91 FRs (FR1–FR91) in epics.md               |
| **# NFRs**                      | Non-functional requirements              | 28                                                      | Same for NFR-\* in planning-artifacts                                                                                   | 28 NFRs in epics.md (P, S, R, I, O, C, UX1) |
| **NFR breakdown by category**   | Performance, Security, Reliability, etc. | P: 5, S: 9, R: 7, I: 3, O: 5, C: 3, UX: 1               | From “NonFunctional Requirements” in `epics.md`                                                                         | \_bmad-output/planning-artifacts/epics.md   |
| **Acceptance criteria (total)** | Total ACs across stories                 | Not available as single number                          | Would require structured AC list or parse of story tables; stories are in epics.md as tables + implementation-artifacts | N/A                                         |
| **FR → epic mapping**           | % of FRs mapped to an epic               | 100% (all FRs in FR Coverage Map)                       | FR Coverage Map in epics.md                                                                                             | Table “FR Coverage Map” in epics.md         |
| **Epics → stories**             | Epics with story tables                  | 11+ epics with story lists                              | Epic List section in epics.md                                                                                           | Epic 1–11+ with Stories tables              |
| **Stories → PRs**               | % stories with PR numbers in progress    | Partial (e.g. epic-3.1-auto-run has issue/PR per story) | Progress frontmatter in docs/progress and \_bmad-output                                                                 | e.g. docs/progress/epic-3.1-auto-run.md     |

---

### D) Testing discipline

| Metric                 | Definition                                | Value                                                   | How computed                                                                   | Evidence                                                  |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **# test files**       | Files matching _.test.ts / _.test.tsx     | 83                                                      | `find . -name "*.test.ts" -o -name "*.test.tsx" \| wc -l` (excl. node_modules) | Glob search                                               |
| **# tests (Vitest)**   | Sum of “Tests X passed” across workspaces | ~1,591                                                  | `npm test -- --run` then sum of “Tests N passed”                               | 252+532+12+334+33+24+187+116+87+14 + remaining workspaces |
| **Coverage (backend)** | Vitest v8 coverage for backend            | 80% thresholds (lines, functions, branches, statements) | `backend/vitest.config.ts`: thresholds 80; shared packages have own configs    | backend/vitest.config.ts                                  |
| **Coverage (CI)**      | Gate in GitHub Actions                    | 80%; Codecov upload                                     | `npm test -- --coverage`; codecov-action (fail_ci_if_error: false)             | .github/workflows/ci.yml                                  |
| **Test-to-code ratio** | Test LOC / source LOC                     | ~0.67                                                   | 20,831 test LOC / 31,165 TS/TSX LOC                                            | find + wc for _.test.ts/tsx vs _.ts/tsx                   |
| **Test velocity**      | Tests added per week/PR                   | Not computed                                            | Would require git history of test file changes or PR metadata                  | N/A                                                       |
| **Flake indicators**   | Retries, quarantine, CI failure logs      | None found                                              | No retries/quarantine in vitest configs; CI logs not in repo                   | N/A                                                       |
| **Mutation testing**   | Mutation score                            | Not present                                             | No Stryker or similar config                                                   | Would need new tooling                                    |

---

### E) CI/CD & automation maturity

| Metric                 | Definition                         | Value                                                                                                                                                                                                                                         | How computed                                                                     | Evidence                                                                                             |
| ---------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **# GitHub workflows** | YAML workflow files                | 1                                                                                                                                                                                                                                             | `.github/workflows/ci.yml`                                                       | Single pipeline                                                                                      |
| **Pipeline stages**    | Jobs in CI                         | 10: lint-and-format, type-check, unit-tests (80% coverage), cdk-synth (CDK Nag), integration-tests (placeholder), contract-tests (placeholder), security-scan, deploy-dev (main only), e2e-tests (placeholder), deploy-prod (main, after e2e) | Read ci.yml                                                                      | .github/workflows/ci.yml                                                                             |
| **Gates enforced**     | What blocks merge / deploy         | Format check (Prettier), ESLint, type-check (tsc), 80% coverage, CDK synth + CDK Nag, npm audit (high/critical, continue-on-error), TruffleHog (PRs), ESLint SAST                                                                             | Steps in ci.yml                                                                  | format:check, lint, type-check, npm test -- --coverage, cdk synth, npm audit, trufflehog, lint again |
| **Release signals**    | Tags, releases, changelog          | Not observed                                                                                                                                                                                                                                  | No CHANGELOG or Releases in scanned paths                                        | N/A                                                                                                  |
| **IaC presence**       | Stacks/modules                     | CDK (TypeScript); 9 stack files under `infra/lib/stacks/` (core, auth, api, observability)                                                                                                                                                    | `infra/lib/stacks/**/*.ts`                                                       | tables, buckets, events, auth, api-gateway, auth-routes, rate-limiting, saves-routes, observability  |
| **Env templates**      | .env.example or equivalent         | 3                                                                                                                                                                                                                                             | `.env.example`, `frontend/.env.example`, `scripts/smoke-test/.env.smoke.example` | Glob .env\*                                                                                          |
| **Error contracts**    | Standardized errors (e.g. ADR-008) | ADR-008; shared middleware; assert-adr008 tests                                                                                                                                                                                               | backend/test-utils/assert-adr008.test.ts; middleware                             | .claude/docs/architecture.md, backend                                                                |

---

### F) Architecture & dependency health

| Metric                             | Definition                        | Value                                                                                                          | How computed                                                                  | Evidence                                                                                                                                                |
| ---------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependency count (root)**        | Production + dev deps             | 20 prod, 0 dev (root package.json shows no devDependencies in parsed output; workspace packages have dev deps) | `npm ls --all --json` parsed; root package.json                               | Root has workspaces; dev tooling at root (eslint, vitest, etc. in root package.json)                                                                    |
| **Outdated dependency hooks**      | CI step for outdated deps         | None                                                                                                           | No npm outdated or renovate/dependabot in workflows                           | N/A                                                                                                                                                     |
| **Security tooling**               | Scans in CI                       | npm audit (high+), TruffleHog (verified secrets), ESLint security plugin                                       | ci.yml security-scan job                                                      | .github/workflows/ci.yml                                                                                                                                |
| **Dependabot / Renovate**          | Config files                      | Not present                                                                                                    | No .github/dependabot.yml or renovate.json                                    | N/A                                                                                                                                                     |
| **API surface**                    | # route entries / paths           | 12 route entries, 11 unique paths                                                                              | `infra/config/route-registry.ts`: ROUTE_REGISTRY length and unique path count | route-registry.ts                                                                                                                                       |
| **Shared types/entities/errors**   | Packages for shared types         | @ai-learning-hub/types (entities, errors, api); referenced across backend                                      | backend/shared/types; imports in handlers                                     | backend/shared/types                                                                                                                                    |
| **Architecture enforcement tests** | Tests that enforce ADRs/contracts | 6 test files                                                                                                   | `infra/test/architecture-enforcement/*.test.ts`                               | route-completeness, authorizer-type-correctness, lambda-route-wiring, handler-miswiring-detection, api-gateway-contract, route-registry (in stacks/api) |

---

### G) Code quality & maintainability

| Metric                  | Definition                  | Value                                                                                                                                        | How computed                                                      | Evidence                                       |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| **TypeScript strict**   | strict mode in tsconfig     | true (root and workspaces)                                                                                                                   | `grep -r '"strict"\|strict:' tsconfig*.json`                      | tsconfig.base.json, backend, frontend, infra   |
| **Lint/format config**  | ESLint + Prettier           | ESLint 9 + TypeScript ESLint; Prettier for ts, tsx, json, md                                                                                 | eslint.config.js; package.json format/format:check                | package.json, eslint.config.js                 |
| **Complexity proxies**  | Cyclomatic complexity, etc. | Not computed                                                                                                                                 | Would need eslint-plugin-complexity or similar                    | N/A                                            |
| **Refactor indicators** | Shared libs, dedup          | Shared packages (@ai-learning-hub/logging, middleware, db, validation, types, events); Epic 3.1 dedup scan + fixer; import enforcement tests | Epics + backend/test/import-enforcement.test.ts; epic 3.1 stories | .cursor/rules/import-guard.mdc; epic-3.1 scope |

---

### H) BMAD / AI-SDLC uniqueness

| Metric                                            | Definition                                        | Value                                                                                                                                                                                     | How computed                                                                           | Evidence                                                         |
| ------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Epics in epics.md**                             | Number of epics listed                            | 11+ (Epic 1–11 and sub-epics e.g. 3.1)                                                                                                                                                    | “Epic List” in epics.md                                                                | \_bmad-output/planning-artifacts/epics.md                        |
| **Stories (listed)**                              | Story rows in epic tables                         | 50+ (Epic 1 alone has 14; others vary)                                                                                                                                                    | Count of story rows in epic tables                                                     | epics.md                                                         |
| **\_bmad-output artifact count**                  | Files under \_bmad-output                         | 69                                                                                                                                                                                        | `find _bmad-output -type f \| wc -l`                                                   | Glob list                                                        |
| **\_bmad-output breakdown**                       | By type                                           | planning-artifacts: prd, architecture, epics, diagrams (7+), research (6+), implementation-readiness (4); implementation-artifacts: 50+ (stories, retros, sprint-status, review findings) | List by directory/extension                                                            | \_bmad-output/                                                   |
| **Structured metadata (Touches, Risk, Gate, AC)** | Presence in stories                               | “Acceptance Criteria” in many progress docs; “Risk”/“Depends on”/“Touches” in a few; epic frontmatter (status, issue, pr, branch) in auto-run progress                                    | grep for Acceptance Criteria, Risk, Touches, gate; frontmatter in epic-3.1-auto-run.md | docs/progress/\*.md, epic-3.1-auto-run.md                        |
| **Automation scripts/commands**                   | Commands that generate or validate BMAD artifacts | validate-templates.mjs; smoke-test; slash commands (.cursor/commands, bmad-\*); epic-orchestrator skill                                                                                   | package.json scripts; .cursor/commands; .claude/skills                                 | package.json; .cursor/commands; .claude/skills/epic-orchestrator |

---

## 3. Evidence & Reproduce

### Commands used (reproducible)

```bash
# Repo root
cd /Users/stephen/Documents/ai-learning-hub

# --- A) Codebase size ---
# TS/TSX LOC (excl. node_modules, dist, coverage, _bmad)
find . -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "./node_modules/*" ! -path "./.git/*" ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/coverage/*" ! -path "./_bmad/*" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1

# Backend / frontend / infra LOC
for dir in backend frontend infra; do
  find ./$dir -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/coverage/*" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1
done

# File counts by extension
for ext in ts tsx js jsx md yaml yml json; do
  echo -n "$ext: "
  find . -type f -name "*.$ext" ! -path "./node_modules/*" ! -path "./.git/*" ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/coverage/*" 2>/dev/null | wc -l
done

# Churn 90d / 30d
git log --since="90 days ago" --numstat --pretty=format: 2>/dev/null | awk 'NF==3 {add+=$1; del+=$2} END {print "90d_add", add+0, "90d_del", del+0}'
git log --since="30 days ago" --numstat --pretty=format: 2>/dev/null | awk 'NF==3 {add+=$1; del+=$2} END {print "30d_add", add+0, "30d_del", del+0}'

# Hotspots (files with most commits in 90d)
git log --since="90 days ago" --name-only --pretty=format: 2>/dev/null | sort | uniq -c | sort -rn | head -25

# --- B) Docs ---
# MD LOC excluding _bmad
find . -type f -name "*.md" ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./_bmad/*" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1
find . -type f -name "*.md" ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./_bmad/*" 2>/dev/null | wc -l

# --- D) Tests ---
# Test file count
find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" \) ! -path "./node_modules/*" ! -path "./.git/*" 2>/dev/null | wc -l
# Test LOC
find . -type f \( -name "*.test.ts" -o -name "*.test.tsx" \) ! -path "./node_modules/*" ! -path "./.git/*" ! -path "*/dist/*" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1
# Run tests (get counts)
npm test -- --run 2>&1 | grep -E "Tests |Test Files "

# --- ADRs ---
grep -E '^## ADR-|^### ADR-' _bmad-output/planning-artifacts/architecture.md

# --- Route registry ---
# Count entries
grep -c 'path:' infra/config/route-registry.ts  # or inspect ROUTE_REGISTRY length
```

### Key paths

| Purpose                        | Path                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| PRD                            | `_bmad-output/planning-artifacts/prd.md`                                         |
| Architecture & ADRs            | `_bmad-output/planning-artifacts/architecture.md`                                |
| Epics & stories                | `_bmad-output/planning-artifacts/epics.md`                                       |
| Route registry                 | `infra/config/route-registry.ts`                                                 |
| CI pipeline                    | `.github/workflows/ci.yml`                                                       |
| Coverage config (backend)      | `backend/vitest.config.ts`                                                       |
| Architecture enforcement tests | `infra/test/architecture-enforcement/*.test.ts`                                  |
| Env templates                  | `.env.example`, `frontend/.env.example`, `scripts/smoke-test/.env.smoke.example` |

### Inconsistencies / notes

- **Churn 30d = 90d:** Same totals; likely all measured commits are in the same window or very recent. Treat as “recent churn” only.
- **Test count:** Sum of workspace “Tests N passed” (~1,591) is the source of truth; a simple `rg -c '\bit\s\('`-style sum can undercount due to nested describes. Prefer `npm test -- --run` output.
- **Root dependencies:** Root package.json has devDependencies (eslint, vitest, etc.); `npm ls --all --json` parsing may show 20 deps at root; workspace packages have their own deps. Total dependency count would require aggregating all workspace package.json files.
- **Coverage number:** Actual coverage percentage is not stored in repo; CI and local `npm test -- --coverage` produce it. Threshold is 80% in backend vitest.config.ts and CI runs with `--coverage`.

---

_End of report._
