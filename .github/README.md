<!--
Optional: add a banner image once you have one.
Example:
<p align="center">
  <img src="docs/assets/banner.png" alt="AI Learning Hub banner" />
</p>
-->

# AI Learning Hub

> A save-to-build learning workbench for AI builders — **built in the open with AI agents** using the BMAD methodology.

[![CI](https://github.com/cirruslycurious/ai-learning-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/cirruslycurious/ai-learning-hub/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![Coverage gate](https://img.shields.io/badge/coverage-gate%20%E2%89%A580%25-brightgreen)
![License](https://img.shields.io/badge/license-source--visible-lightgrey)

AI Learning Hub connects what you’re learning (links, tutorials, conversations) to what you’re building (projects). It’s designed for **self-directed AI builders**—especially no-code/low-code and “non-traditional” builders—who are drowning in scattered resources and a tutorial graveyard.

This repo is also a **production-oriented case study in agentic software development**: a monorepo with CI gates, architecture decision records, and a workflow where AI subagents write tests, implement stories, and review code.

**System overview diagram:** [System overview](_bmad-output/planning-artifacts/diagrams/01-system-overview.md)

> Screenshot/demo: not yet available. (When UI work starts, add a screenshot/GIF here.)

**Fast paths (by audience):**

- **PMs**: jump to [📚 Documentation](#-documentation) → “For Product Managers”
- **Engineers**: jump to [Quick Start](#quick-start) and [Architecture highlights](#architecture-highlights-grounded-in-adrs)
- **AI/agent builders**: jump to [AI-Native Development Methodology](#ai-native-development-methodology-the-differentiator)
- **Contributors**: jump to [Contributing](#contributing)

## Table of contents

- [Why This Exists (Problem → Solution)](#why-this-exists-problem--solution)
- [Key Features (V1 product scope — specified in the PRD)](#key-features-v1-product-scope--specified-in-the-prd)
- [Tech Showcase (for PMs, recruiters, and technical readers)](#tech-showcase-for-pms-recruiters-and-technical-readers)
- [AI-Native Development Methodology (the differentiator)](#ai-native-development-methodology-the-differentiator)
- [Project Status & Roadmap](#project-status--roadmap)
- [📚 Documentation](#-documentation)
- [Quick Start](#quick-start)
- [Contributing](#contributing)
- [Credits & License](#credits--license)

---

## Why This Exists (Problem → Solution)

**The problem:** AI learning content is everywhere (podcasts, YouTube, blogs, repos, newsletters), but the workflow is fragmented across 3–5 tools. Even worse, the “thinking” that turns content into a build often lives in **LLM chats** that get lost over weeks.

**The solution:** AI Learning Hub is a **project-centric** system where:

- saves are **fuel** (captured fast, from anywhere)
- projects are **living notebooks** (links + notes + pasted AI chat history)
- linking creates a personal “learning graph” that compounds over time

**What makes it different:** it assumes the end goal is **building**, not “read later” or generic PKM. And it treats **AI agents as first-class users** via an API-first design (so an agent can save, link, and query on your behalf).

---

## Key Features (V1 product scope — specified in the PRD)

These are **intended product capabilities** (not all implemented yet). Each bullet links to the source spec.

- **⚡ 3-second capture (mobile-first)**: save a URL via iOS Shortcut / share sheet and move on. See [User flows](_bmad-output/planning-artifacts/diagrams/02-user-flows.md) and [PRD](_bmad-output/planning-artifacts/prd.md) (FR44–FR47).
- **🧰 One unified library (3 views)**: Resource Library + Tutorial Tracker + My Projects are views into the same “save” entity. See [PRD](_bmad-output/planning-artifacts/prd.md) (FR18).
- **🗂️ Projects as living notebooks**: store links + Markdown notes + pasted AI chat history (“how I figured it out”). See [PRD](_bmad-output/planning-artifacts/prd.md) (FR26–FR27, FR49).
- **🔗 Save-to-build linking**: connect fuel to outcomes (save ↔ project), including bulk linking on desktop. See [PRD](_bmad-output/planning-artifacts/prd.md) (FR33–FR38).
- **✅ Tutorial progress tracking**: mark a save as a tutorial and track status to completion. See [PRD](_bmad-output/planning-artifacts/prd.md) (FR39–FR43).
- **🔎 Fast search across saves/projects/notes**: V1 search via a processed index (DynamoDB) with a clean upgrade path. See [Architecture summary](.claude/docs/architecture.md) (ADR-002, ADR-010) and [PRD](_bmad-output/planning-artifacts/prd.md) (FR52–FR55).
- **🧪 Operable from day one**: structured logging, tracing, and CI gates (including an 80% coverage gate) are V1 requirements. See [PRD](_bmad-output/planning-artifacts/prd.md) (Technical Success) and [CI workflow](.github/workflows/ci.yml).

---

## Tech Showcase (for PMs, recruiters, and technical readers)

### Built in the open with AI agents

This project “dogfoods” agentic development:

- **BMAD methodology + autonomous epic workflow**: [bmad-bmm-auto-epic](.claude/commands/bmad-bmm-auto-epic.md)
- **Agentic workflow diagram**: [Agentic development workflow](_bmad-output/planning-artifacts/diagrams/07-agentic-development-workflow.md)
- **Deterministic guardrails (hooks)**: [Hooks README](.claude/hooks/README.md) and [Enforcement strategy diagram](_bmad-output/planning-artifacts/diagrams/06-hooks-enforcement-strategy.md)
- **Agent-friendly GitHub artifacts**: [.github issue templates](.github/ISSUE_TEMPLATE/) and [PR template](.github/PULL_REQUEST_TEMPLATE.md)

### Architecture highlights (grounded in ADRs)

- **API-first**: the API is the product; UIs are clients. See `.claude/docs/architecture.md` (ADR-014).
- **No Lambda-to-Lambda calls**: all cross-service communication via API Gateway or events. See `.claude/docs/architecture.md` (ADR-005).
- **Multi-table DynamoDB**: 7 tables + 10 GSIs, with strong per-user isolation and a global content layer. See `.claude/docs/database-schema.md` and `_bmad-output/planning-artifacts/architecture.md` (ADR-001).
- **Async pipelines**: EventBridge + Step Functions for enrichment / notes processing / search sync. See `_bmad-output/planning-artifacts/diagrams/03-data-pipeline-flow.md` and `.claude/docs/architecture.md` (ADR-003).
- **Production gates in CI**: lint/format → type-check → tests with **80% coverage gate** → CDK synth + CDK Nag. See `.github/workflows/ci.yml` and `_bmad-output/planning-artifacts/architecture.md` (ADR-007).

### Tech stack (as committed in `package.json`)

| Layer             | Technology                                                                              |
| ----------------- | --------------------------------------------------------------------------------------- |
| **Runtime**       | Node.js **>= 20**                                                                       |
| **Frontend**      | React **18.2**, Vite **5**, Tailwind CSS **3.4** (`frontend/package.json`)              |
| **Backend**       | AWS Lambda (TypeScript), Vitest **3.2** (`backend/package.json`)                        |
| **Infra**         | AWS CDK **2.170**, `cdk-nag` **2.37** (`infra/package.json`)                            |
| **Data**          | DynamoDB (7 tables, 10 GSIs), S3 for Markdown notes (`.claude/docs/database-schema.md`) |
| **Observability** | CloudWatch + X-Ray (per ADRs / PRD)                                                     |

---

## AI-Native Development Methodology (the differentiator)

**The short version:** stories are designed to be implemented by AI agents safely.

- **Progressive disclosure**: keep `CLAUDE.md` short and load topic docs from `.claude/docs/` as needed. See `.claude/docs/README.md`.
- **Guardrails over vibes**: hooks block risky commands and protected files; CI enforces formatting, type-checks, and test gates. See `.claude/settings.json` and `.github/workflows/ci.yml`.
- **Subagents for specialization**: test-writing, code review, debugging, and production validation are split into dedicated roles. See `_bmad-output/planning-artifacts/diagrams/07-agentic-development-workflow.md`.

Meta: **this README was updated by Claude** as part of the same “built-in-the-open” workflow.

---

## Project Status & Roadmap

### Current phase

Planning is complete (PRD + Architecture + Epics). Implementation is underway.

Specs in numbers (from the planning artifacts):

- **PRD**: 69 product functional requirements + 28 non-functional requirements ([PRD](_bmad-output/planning-artifacts/prd.md))
- **Agentic dev requirements**: 22 additional requirements for AI-assisted delivery (FR70–FR91 in the PRD)
- **Architecture**: 16 ADRs ([Architecture](_bmad-output/planning-artifacts/architecture.md))

Live implementation status: [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml)

As of `2026-02-04`:

- **Epic 1 (Foundation) is in progress**
  - done: stories 1.1–1.8
  - next up: **1.9 Observability Foundation** (`ready-for-dev`)
- Epics 2–11 (product features) are **backlog**

### Roadmap

- **Epics & story breakdown**: [Epics](_bmad-output/planning-artifacts/epics.md)
- Tracking issue: [GitHub Issue #39](https://github.com/cirruslycurious/ai-learning-hub/issues/39)

---

## 📚 Documentation

This README is intentionally a map, not a dump.

### Getting started

- **Quick Start (commands)**: see [Quick Start](#quick-start)
- **Development guide & conventions**: [CLAUDE.md](CLAUDE.md)
- **Architecture overview (condensed)**: [.claude/docs/architecture.md](.claude/docs/architecture.md)
- **Database schema (7 tables, 10 GSIs)**: [.claude/docs/database-schema.md](.claude/docs/database-schema.md)

### For Product Managers (vision → scope → roadmap)

- **Product brief (vision, personas, UX principles)**: [Product brief](_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md)
- **PRD (requirements + success criteria)**: [PRD](_bmad-output/planning-artifacts/prd.md)
- **User flows**: [User flows](_bmad-output/planning-artifacts/diagrams/02-user-flows.md)
- **Epics**: [Epics](_bmad-output/planning-artifacts/epics.md)

### For developers (how it’s built)

- **API conventions / error shapes**: [.claude/docs/api-patterns.md](.claude/docs/api-patterns.md)
- **Full ADRs & architecture spec**: [Architecture](_bmad-output/planning-artifacts/architecture.md)
- **CI pipeline**: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Issue / PR templates**: [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/) and [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)

### For AI enthusiasts (how agents build production software)

- **Autonomous epic workflow**: [bmad-bmm-auto-epic](.claude/commands/bmad-bmm-auto-epic.md)
- **Agentic workflow diagram**: [Agentic development workflow](_bmad-output/planning-artifacts/diagrams/07-agentic-development-workflow.md)
- **Hooks & enforcement strategy**: [Hooks enforcement strategy](_bmad-output/planning-artifacts/diagrams/06-hooks-enforcement-strategy.md)
- **Agentic development research (source)**: [AI coding agent best practices](_bmad-output/planning-artifacts/research/technical-ai-coding-agent-best-practices-2026-02.md)
- **Auto-epic validation notes**: [auto-epic validation findings](docs/research/auto-epic-validation-findings.md)

---

## Quick Start

```bash
git clone https://github.com/cirruslycurious/ai-learning-hub.git
cd ai-learning-hub
npm install
npm test
npm run build
```

Optional (deploy infrastructure; requires AWS credentials/config):

```bash
cd infra && npx cdk deploy
```

Config/secrets guidance: [.claude/docs/secrets-and-config.md](.claude/docs/secrets-and-config.md)

---

## Contributing

Contributions are welcome, especially on docs, tests, and implementation stories.

- **Start with an issue**: use the templates in `.github/ISSUE_TEMPLATE/` (they’re designed for both humans and AI agents).
- **PR expectations**: follow `.github/PULL_REQUEST_TEMPLATE.md` (includes the “Agent / Code Review” checklist).
- **AI agents are first-class contributors**: if you use an agent, link the issue, keep scope tight, and make CI gates the source of truth.

> Note: there’s no `CONTRIBUTING.md` yet; see “Suggested follow-ups” below.

---

## Credits & License

- **Methodology**: <a href="https://github.com/bmadcode/BMAD-METHOD" target="_blank" rel="noopener noreferrer">BMAD</a>
- **Infra**: <a href="https://aws.amazon.com/cdk/" target="_blank" rel="noopener noreferrer">AWS CDK</a>, Lambda, DynamoDB, EventBridge, Step Functions
- **Frontend**: React + Vite
- **Auth**: Clerk (per ADR-013)

License: **source-visible, all rights reserved**. See `LICENSE`.
