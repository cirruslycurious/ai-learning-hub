# AI Learning Hub

A save-to-build learning workbench for AI practitioners, built in the open with AI coding agents using the BMAD methodology.

[![CI](https://github.com/cirruslycurious/ai-learning-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/cirruslycurious/ai-learning-hub/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Coverage gate](https://img.shields.io/badge/coverage-gate%20%E2%89%A580%25-brightgreen)](https://github.com/cirruslycurious/ai-learning-hub/blob/main/.github/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-source--visible-lightgrey)](./LICENSE)

## Product Preview

Landing page concept:

![AI Learning Hub landing page concept](docs/assets/screenshots/landing.png)

Project deep-dive concept:

![AI Learning Hub project deep-dive concept](docs/assets/screenshots/project-notes.png)

## Why This Exists

**The problem.** AI learning content is everywhere (podcasts, YouTube, blogs, repos, newsletters), but the workflow is fragmented across 3 to 5 tools. Worse, the thinking that turns content into a build often lives in LLM chats that get lost over weeks. Nothing bridges "what I'm learning" to "what I'm building."

**The solution.** AI Learning Hub is a project-centric system where saves are fuel (captured fast, from anywhere), projects are living notebooks (links + notes + pasted AI conversations), and linking creates a personal learning graph that compounds over time.

**What makes it different:**

- Read-later apps assume consumption. PKM tools assume organization. This assumes **building**. Unlinked saves are incomplete states, not resting states. ([PRD](/_bmad-output/planning-artifacts/prd.md), "Differentiator")
- The API is the product, not an afterthought. AI agents and iOS Shortcuts are first-class clients alongside the web UI. ([Architecture](/_bmad-output/planning-artifacts/architecture.md), ADR-014)
- The repo itself is a case study in agentic software development: AI agents write tests, implement stories, and review code, constrained by 20 guardrail hooks, architecture enforcement tests, and a 10-stage CI pipeline.

**Learn-through-building ethos.** This project exists as both a useful product and a deliberate exercise in modern software engineering: API-first design, spec-driven development, test-first discipline, and agentic workflows. Every planning artifact, retrospective, and architectural decision is committed to the repo as evidence.

## What We're Building

AI Learning Hub delivers a complete save-to-build loop:

1. **3-second capture (mobile-first):** Save a URL via iOS Shortcut or PWA share sheet and move on. Two taps from any app. (PRD FR44-FR47)
2. **One unified library, three views:** Resource Library, Tutorial Tracker, and My Projects are views into the same save entity. No data duplication. (PRD FR18)
3. **Projects as living notebooks:** Store linked resources, Markdown notes, and pasted LLM conversation history. (PRD FR26-FR27, FR49)
4. **Save-to-build linking:** Connect fuel to outcomes with save-to-project links, including bulk linking on desktop. (PRD FR33-FR38)
5. **Tutorial progress tracking:** Mark saves as tutorials and track status through completion. (PRD FR39-FR43)
6. **Full-text search:** Search across saves, projects, and notes content via a processed DynamoDB index with a clean upgrade path to OpenSearch. (PRD FR52-FR55, ADR-002, ADR-010)
7. **Operable from day one:** Structured logging, X-Ray tracing, tiered alerting, and CI gates are V1 requirements, not afterthoughts. (PRD "Technical Success")

### User Personas

These are behavioral archetypes from the [product brief](/_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md), not demographic labels.

| Persona      | Archetype              | Goal                                                               | Primary Surface                 |
| ------------ | ---------------------- | ------------------------------------------------------------------ | ------------------------------- |
| **Maya**     | Lean-In Professional   | Mobile capture during the day, desktop organize on weekends        | iOS Shortcut + PWA              |
| **Marcus**   | Infrastructure Builder | Deep desktop sessions with living notebook projects                | Desktop workspace               |
| **Priya**    | Curious Explorer       | Passive saver who converts to builder through accumulated patterns | Mobile browse + seeded projects |
| **Dev**      | API Builder            | Zero-UI workflow via API keys and future MCP integration           | API + CLI                       |
| **Stephen**  | Solo Operator          | 2am incident response, system health, analytics                    | CloudWatch + admin CLI          |
| **Stefania** | Product Analyst        | Weekly adoption/retention/engagement review                        | Analytics dashboards            |

Scale is intentionally boutique: 10-20 invite-only users, no monetization through V3. Success is measured by product utility, not revenue. Infrastructure budget hard-capped at $50/month. (PRD "Business Success")

## How It Works

```
                    +------------------+
                    |   Client Layer   |
                    |  React PWA       |
                    |  iOS Shortcut    |
                    |  AI Agents (API) |
                    +--------+---------+
                             |
                    JWT or API Key Auth
                             |
                    +--------v---------+
                    |   API Gateway    |
                    |  WAF + CORS +    |
                    |  Rate Limiting   |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v--+   +------v----+   +-----v------+
     | Core APIs |   | Admin APIs|   |Analytics   |
     | /saves    |   | /admin/*  |   |/analytics/*|
     | /projects |   +-----------+   +------------+
     | /search   |
     +-----+-----+
           |
     +-----v-----+        +----------------+
     | DynamoDB   |        | EventBridge    |
     | 7 tables   +------->+ Step Functions |
     | 10 GSIs    |        | (async pipes)  |
     +-----+------+        +-------+--------+
           |                        |
     +-----v-----+        +--------v-------+
     | S3 (notes) |        | External APIs  |
     +------------+        | YouTube, etc.  |
                           +----------------+

     Observability: CloudWatch + X-Ray across all layers
     Auth: Clerk (JWT for web, API keys for agents)
```

### Key Architecture Decisions (from [16 ADRs](/_bmad-output/planning-artifacts/architecture.md))

- **API-first (ADR-014):** The API is the product. UIs are clients. This enables AI agents, iOS Shortcuts, and future MCP integration without special-casing.
- **Multi-table DynamoDB (ADR-001):** 7 tables with strong per-user isolation (`USER#<userId>` partition key on all user-owned data). The `content` table is intentionally global for shared URL metadata.
- **No Lambda-to-Lambda calls (ADR-005):** All cross-service communication goes through API Gateway or EventBridge. No hidden coupling.
- **Processed search index (ADR-010):** V1 search queries a pre-processed DynamoDB substrate, not raw text. API abstraction enables a future OpenSearch swap without re-architecture.
- **EventBridge + Step Functions for async (ADR-003):** Enrichment, notes processing, and search sync run as decoupled async pipelines.
- **Standardized error handling (ADR-008):** Every Lambda returns typed `ApiSuccessResponse<T>` or `ApiErrorResponse` with `ErrorCode` enum. Enforced by tests in all 6 handler suites.

## Repo Layout

```
ai-learning-hub/
├── backend/
│   ├── functions/           # Lambda handlers (6 implemented: jwt-authorizer,
│   │                        #   api-key-authorizer, api-keys, users-me,
│   │                        #   validate-invite, invite-codes)
│   ├── shared/              # @ai-learning-hub/* packages
│   │   ├── db/              # DynamoDB client, query helpers, rate limiter
│   │   ├── events/          # EventBridge client and typed emitter
│   │   ├── logging/         # Structured JSON logger with X-Ray correlation
│   │   ├── middleware/      # Auth, error handling, scope enforcement, wrapper
│   │   ├── types/           # Shared TypeScript types and API contracts
│   │   └── validation/      # Zod schemas, URL normalizer, content type detection
│   └── test/                # Cross-cutting backend tests (import enforcement,
│                            #   handler integration, architecture consistency)
├── frontend/                # React 18 + Vite 5 + Tailwind CSS 3.4 (scaffold stage)
├── infra/
│   ├── lib/stacks/          # CDK stacks: api-gateway, auth-routes, rate-limiting,
│   │                        #   auth, tables, buckets, observability
│   ├── config/              # Route registry, environment config, AWS env
│   └── test/                # CDK synth tests + 5 architecture enforcement suites
├── scripts/
│   ├── smoke-test/          # Deployed-environment smoke tests (5 scenario files)
│   └── eslint-rules/        # Custom ESLint rule: enforce-shared-imports
├── test/                    # Root-level tests: CI workflow validation, hook tests (14 files)
├── .claude/
│   ├── docs/                # Progressive disclosure docs (13 topic files)
│   ├── commands/            # 7 project commands + BMAD methodology commands
│   ├── hooks/               # 20 guardrail hooks for agentic safety
│   └── skills/              # Epic orchestrator skill
├── _bmad-output/
│   ├── planning-artifacts/  # PRD, architecture, epics, diagrams, research
│   └── implementation-artifacts/  # Story artifacts, sprint status, retrospectives
├── docs/
│   ├── progress/            # Completion reports, review findings, auto-run logs
│   ├── research/            # Analysis docs, validation findings
│   └── writing-pipeline/    # Documentation generation system
├── CLAUDE.md                # Agent instructions (125 lines, progressive disclosure)
├── .github/workflows/ci.yml # 10-stage CI/CD pipeline
└── package.json             # npm workspaces root (8 workspaces)
```

## Current Status

### Progress by Epic

**Epic 1: Project Foundation and Developer Experience** (Done)
11 stories completed, 3 intentionally dropped. Delivered the monorepo scaffold (npm workspaces), 6 shared `@ai-learning-hub/*` packages, CLAUDE.md with progressive disclosure docs, 20 Claude Code hooks, GitHub issue/PR templates for agents, 10-stage CI/CD pipeline with 80% coverage gate, DynamoDB/S3 infrastructure (7 tables, 10 GSIs deployed), and observability foundation (X-Ray, structured logging, EMF metrics). Zero blockers, zero production incidents.
([Retrospective](/_bmad-output/implementation-artifacts/epic-1-retro-2026-02-14.md) | [Story artifacts](/_bmad-output/implementation-artifacts/))

**Epic 2: User Authentication and API Keys** (Done)
9/9 stories completed in approximately 2 days. Delivered Clerk JWT authorizer, API key authorizer with hash-based lookup, scope-based middleware, invite code system (validate + generate), user profile endpoint, full API key CRUD, DynamoDB-backed rate limiting with Retry-After headers, and systematic error codes (`ErrorCode` enum + `ErrorCodeToStatus` map). 706 tests passing at completion. 7 critical review findings caught by adversarial code review, including 3 release-blockers, all fixed before merge.
([Retrospective](/_bmad-output/implementation-artifacts/epic-2-retro-2026-02-16.md) | [Story artifacts](/_bmad-output/implementation-artifacts/))

**Epic 2.1: Technical Debt Paydown** (Done)
10/10 stories completed. Delivered API Gateway REST API stack (the Epic 2 endpoints were uncallable without it), route registry as single source of truth, 80% coverage thresholds enforced across all backend workspaces, shared `mock-wrapper.ts` utility (removed 488 lines of duplicated test code), request-scoped logger threading from handler through middleware to DB layer, 5 architecture enforcement test suites (15 CDK template assertions), handler integration tests, deployed-environment smoke test suite (14 acceptance criteria, 5 scenario files), 15 adversarial review fixes, JWT fallback for API key authorizer, and IAM permission hardening. 1,355+ tests passing at completion.
([Completion Report](docs/progress/epic-2.1-completion-report.md) | [Adversarial Review](docs/adversarial-architecture-review-2026-02-20.md))

**Epic 3: Save URLs, Core CRUD** (In Progress)
2 stories completed so far: save validation modules (URL normalizer, content type detector, Zod schemas) and EventBridge shared package (`@ai-learning-hub/events` at 97% coverage). Remaining: create/list/get/update/delete save APIs, filtering and sorting, iOS Shortcut capture, PWA share target, UI foundation, saves list page, and save actions feedback.
([Epic 3 Plan](docs/progress/epic-3-stories-and-plan.md) | [Completion Report](docs/progress/epic-3-completion-report.md))

**Epics 4-11** are in backlog. See the [epics breakdown](/_bmad-output/planning-artifacts/epics.md) for the full roadmap.

## Quality and Engineering Discipline

Every claim in this section is backed by a file path you can verify.

| Practice                     | Detail                                                                                                                                                               | Evidence                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test files**               | 74 test files across backend, infra, frontend, and root                                                                                                              | `find . -name '*.test.ts' -o -name '*.test.tsx'`                                                                                                                                           |
| **Test cases**               | 1,147 individual `it()` assertions                                                                                                                                   | `grep -rch 'it("' --include='*.test.ts'`                                                                                                                                                   |
| **Coverage gate**            | 80% minimum (lines, functions, branches, statements)                                                                                                                 | [`backend/vitest.config.ts`](/backend/vitest.config.ts), each `backend/shared/*/vitest.config.ts`                                                                                          |
| **CI pipeline**              | 10 stages: lint/format, type-check, unit tests + coverage, CDK synth + CDK Nag, integration tests, contract tests, security scan, deploy-dev, E2E tests, deploy-prod | [`.github/workflows/ci.yml`](/.github/workflows/ci.yml)                                                                                                                                    |
| **Security scanning**        | npm audit (high/critical), TruffleHog secrets detection on PRs, ESLint security plugin (SAST), gitleaks with 25+ custom rules                                        | [`.github/workflows/ci.yml`](/.github/workflows/ci.yml), [`.gitleaks.toml`](/.gitleaks.toml)                                                                                               |
| **Architecture enforcement** | 5 CDK test suites: API gateway contract, route completeness, authorizer type correctness, handler miswiring detection, Lambda-route wiring                           | [`infra/test/architecture-enforcement/`](/infra/test/architecture-enforcement/)                                                                                                            |
| **Import enforcement**       | Custom ESLint rule blocks direct AWS SDK imports; must use `@ai-learning-hub/*` shared packages                                                                      | [`scripts/eslint-rules/enforce-shared-imports.js`](/scripts/eslint-rules/enforce-shared-imports.js), [`backend/test/import-enforcement.test.ts`](/backend/test/import-enforcement.test.ts) |
| **Smoke tests**              | 5 deployed-environment scenarios: route connectivity, JWT auth, API key auth, rate limiting, user profile                                                            | [`scripts/smoke-test/scenarios/`](/scripts/smoke-test/scenarios/)                                                                                                                          |
| **Type checking**            | `tsc --build` across all workspaces, runs as CI gate before tests                                                                                                    | [`package.json`](/package.json) `type-check` script                                                                                                                                        |
| **Linting**                  | ESLint 9 flat config with TypeScript-ESLint + security plugin                                                                                                        | [`eslint.config.js`](/eslint.config.js)                                                                                                                                                    |
| **Formatting**               | Prettier enforced via `format:check` CI gate + Husky pre-commit hook                                                                                                 | [`.prettierrc`](/.prettierrc), [`.husky/pre-commit`](/.husky/pre-commit)                                                                                                                   |
| **CDK Nag**                  | AWS Solutions checks run during `cdk synth`; error-level findings fail the build                                                                                     | [`infra/bin/app.ts`](/infra/bin/app.ts), CI stage 4                                                                                                                                        |
| **Agentic guardrails**       | 20 Claude Code hooks: file guards, bash guards, TDD enforcement, architecture protection, auto-formatting, commit gates                                              | [`.claude/hooks/`](/.claude/hooks/)                                                                                                                                                        |
| **Code review process**      | Adversarial multi-round reviews on every story; findings tracked in docs/progress/                                                                                   | [`docs/progress/`](/docs/progress/) (30+ review findings files)                                                                                                                            |

## Quickstart

**Prerequisites:** Node.js >= 20 (see `.nvmrc`), npm. AWS credentials required only for deploy/smoke-test.

```bash
git clone https://github.com/cirruslycurious/ai-learning-hub.git
cd ai-learning-hub
npm install        # Install all workspace dependencies
npm test           # Run all tests with coverage
npm run build      # Build all packages
npm run lint       # Lint all code
npm run type-check # TypeScript compilation check
```

**Infrastructure (requires AWS credentials):**

```bash
cd infra && npx cdk synth   # Validate CDK templates + CDK Nag
cd infra && npx cdk deploy  # Deploy to AWS
```

**Smoke tests (requires deployed environment):**

```bash
cp scripts/smoke-test/.env.smoke.example scripts/smoke-test/.env.smoke
# Edit .env.smoke with your API URL and credentials
npm run smoke-test
```

Note: The frontend is in scaffold stage. `npm run dev` in `frontend/` will start the Vite dev server, but there is no functional UI yet beyond the initial React shell. Backend tests and CDK synth are the primary local development activities.

See [`.claude/docs/secrets-and-config.md`](/.claude/docs/secrets-and-config.md) for secrets and environment configuration.

## Roadmap

### Near-term: Epics 3 and 4

**Epic 3 (In Progress): Save URLs, Core CRUD**

- Create, list, get, update, delete, and restore saves via API
- URL normalization with duplicate detection (409 Conflict with existing save returned)
- Content type detection (domain-based at save-time, refined by enrichment)
- Filtering by type, project linkage, tutorial status; sorting by date and title
- iOS Shortcut capture and PWA share target for mobile
- UI foundation: design system, saves list page, filtering/sorting UI

**Epic 4 (Next): Project Management**

- Project CRUD with folder organization
- Status workflow (exploring, building, paused, completed)
- Markdown notes with LLM conversation paste support
- Tagging and filtering

### Mid-term: Epics 5-8

Epics 5 (Resource-Project Linking), 6 (Project Notes and Desktop Workspace), 7 (Search and Discovery), and 8 (Tutorial Tracking) complete the core product loop described in the user journeys.

### Later: Epics 9-11

Epic 9 (Async Processing Pipelines), 10 (Admin and Analytics), and 11 (Onboarding and Seeded Content) deliver operational maturity and the new-user experience.

### Intentionally Not Built Yet

- **No AI/LLM features in V1.** Bidirectional recommendations, content summarization, and MCP server integration are V2 scope.
- **No native mobile apps.** V1 uses iOS Shortcuts and PWA. Native iOS is V2.5, Android is V3.5.
- **No monetization.** No payment processing, subscription management, or pricing tiers through V3.
- **No multi-tenancy.** Single-tenant, invite-only, boutique scale.

## Docs and References

| Document                                                                                                 | What it covers                                 |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [Product Brief](/_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md)            | Vision, personas, UX principles                |
| [PRD](/_bmad-output/planning-artifacts/prd.md)                                                           | 69 functional + 28 non-functional requirements |
| [Architecture](/_bmad-output/planning-artifacts/architecture.md)                                         | 16 ADRs, full technical design                 |
| [Epics](/_bmad-output/planning-artifacts/epics.md)                                                       | Complete epic and story breakdown              |
| [Database Schema](/.claude/docs/database-schema.md)                                                      | 7 tables, 10 GSIs, access patterns             |
| [API Patterns](/.claude/docs/api-patterns.md)                                                            | Error shapes, conventions, middleware          |
| [Testing Guide](/.claude/docs/testing-guide.md)                                                          | Test structure, conventions, coverage          |
| [Sprint Status](/_bmad-output/implementation-artifacts/sprint-status.yaml)                               | Live implementation progress                   |
| [Epic 1 Retrospective](/_bmad-output/implementation-artifacts/epic-1-retro-2026-02-14.md)                | Foundation epic learnings                      |
| [Epic 2 Retrospective](/_bmad-output/implementation-artifacts/epic-2-retro-2026-02-16.md)                | Auth epic learnings                            |
| [Epic 2.1 Completion Report](docs/progress/epic-2.1-completion-report.md)                                | Technical debt paydown results                 |
| [Adversarial Review](docs/adversarial-architecture-review-2026-02-20.md)                                 | Full codebase adversarial review findings      |
| [System Overview Diagram](/_bmad-output/planning-artifacts/diagrams/01-system-overview.md)               | Mermaid system context diagram                 |
| [User Flows](/_bmad-output/planning-artifacts/diagrams/02-user-flows.md)                                 | Persona journey diagrams                       |
| [Agentic Workflow Diagram](/_bmad-output/planning-artifacts/diagrams/07-agentic-development-workflow.md) | How AI agents participate in development       |

## Contributing and Project Philosophy

Contributions are welcome, especially on docs, tests, and implementation stories.

**How to contribute:**

- Start with an issue using the templates in `.github/ISSUE_TEMPLATE/` (structured for both humans and AI agents)
- Follow the PR template in `.github/PULL_REQUEST_TEMPLATE.md` (includes agent/code review checklist)
- Run `npm run validate` before pushing (lint + type-check + test)
- AI agents are first-class contributors: link the issue, keep scope tight, and let CI gates be the source of truth

**Engineering principles:**

- **Spec-driven.** Every feature traces back to a PRD requirement, an architecture decision, and an epic story. No cowboy coding.
- **Test-first.** 80% coverage is a CI gate, not an aspiration. Architecture enforcement tests verify CDK templates match the route registry. Import enforcement tests prevent shared library bypass.
- **Contracts over convention.** Error shapes are typed (`ApiErrorResponse` with `ErrorCode` enum). API routes are defined in a single registry. Shared packages enforce consistent patterns.

**BMAD Methodology.** This project uses the [BMAD Method](https://github.com/bmadcode/BMAD-METHOD) for AI-assisted software delivery:

- Structured planning artifacts (product brief, PRD, architecture, epics) created by specialized AI agents before any code is written
- Stories designed for autonomous agent implementation with clear acceptance criteria, testing requirements, and scope boundaries
- Multi-round adversarial code review where a separate AI agent reviews every story with a fresh context
- Configuration in `.claude/` (docs, commands, hooks, skills) provides progressive disclosure so agents load context on demand rather than all at once

## License

Source-visible, all rights reserved. See [LICENSE](./LICENSE).

---

## Evidence Appendix

Key evidence used to build this README, grouped by category. Every claim above is traceable to these sources.

**PRD and Planning**

- [`_bmad-output/planning-artifacts/prd.md`](/_bmad-output/planning-artifacts/prd.md) (69 FRs, 28 NFRs, 6 user journeys)
- [`_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md`](/_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md) (personas, UX principles)
- [`_bmad-output/planning-artifacts/epics.md`](/_bmad-output/planning-artifacts/epics.md) (epic and story breakdown)

**Architecture and ADRs**

- [`_bmad-output/planning-artifacts/architecture.md`](/_bmad-output/planning-artifacts/architecture.md) (16 ADRs)
- [`.claude/docs/architecture.md`](/.claude/docs/architecture.md) (condensed architecture reference)
- [`.claude/docs/database-schema.md`](/.claude/docs/database-schema.md) (7 tables, 10 GSIs)
- [`_bmad-output/planning-artifacts/diagrams/`](/_bmad-output/planning-artifacts/diagrams/) (7 system diagrams)

**CI and Quality Gates**

- [`.github/workflows/ci.yml`](/.github/workflows/ci.yml) (10-stage pipeline)
- [`.gitleaks.toml`](/.gitleaks.toml) (25+ custom secret detection rules)
- [`eslint.config.js`](/eslint.config.js) (ESLint 9 + security plugin + custom import rule)
- [`.husky/pre-commit`](/.husky/pre-commit) (pre-commit formatting)

**Tests**

- [`backend/functions/*/handler.test.ts`](/backend/functions/) (6 handler test suites)
- [`backend/shared/*/test/`](/backend/shared/) (6 shared package test directories)
- [`infra/test/architecture-enforcement/`](/infra/test/architecture-enforcement/) (5 architecture enforcement suites)
- [`infra/test/stacks/`](/infra/test/stacks/) (CDK stack tests)
- [`test/hooks/`](/test/hooks/) (14 hook test files including 3 integration tests)
- [`scripts/smoke-test/scenarios/`](/scripts/smoke-test/scenarios/) (5 deployed-environment scenarios)

**Infrastructure**

- [`infra/lib/stacks/`](/infra/lib/stacks/) (7 CDK stacks: api-gateway, auth-routes, rate-limiting, auth, tables, buckets, observability)
- [`infra/config/route-registry.ts`](/infra/config/route-registry.ts) (single source of truth for API routes)

**Backend**

- [`backend/functions/`](/backend/functions/) (6 Lambda handlers implemented, 6 placeholder directories)
- [`backend/shared/`](/backend/shared/) (6 packages: db, events, logging, middleware, types, validation)
- [`backend/vitest.config.ts`](/backend/vitest.config.ts) (80% coverage thresholds)

**Frontend**

- [`frontend/`](/frontend/) (React 18 + Vite 5 + Tailwind CSS 3.4, scaffold stage)
- [`frontend/src/api/client.ts`](/frontend/src/api/client.ts) (API client foundation)

**Agentic Development**

- [`.claude/hooks/`](/.claude/hooks/) (20 guardrail hooks)
- [`.claude/docs/`](/.claude/docs/) (13 progressive disclosure topic docs)
- [`.claude/commands/`](/.claude/commands/) (7 project commands)
- [`CLAUDE.md`](/CLAUDE.md) (125-line agent instructions)

**Progress and Retrospectives**

- [`_bmad-output/implementation-artifacts/sprint-status.yaml`](/_bmad-output/implementation-artifacts/sprint-status.yaml) (live status tracker)
- [`_bmad-output/implementation-artifacts/epic-1-retro-2026-02-14.md`](/_bmad-output/implementation-artifacts/epic-1-retro-2026-02-14.md)
- [`_bmad-output/implementation-artifacts/epic-2-retro-2026-02-16.md`](/_bmad-output/implementation-artifacts/epic-2-retro-2026-02-16.md)
- [`docs/progress/epic-2.1-completion-report.md`](/docs/progress/epic-2.1-completion-report.md)
- [`docs/progress/epic-3-completion-report.md`](/docs/progress/epic-3-completion-report.md)
- [`docs/adversarial-architecture-review-2026-02-20.md`](/docs/adversarial-architecture-review-2026-02-20.md)
- [`docs/progress/`](/docs/progress/) (30+ review findings files across all stories)
