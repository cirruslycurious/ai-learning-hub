# AI Learning Hub

A project-centric learning platform for people who build with AI. Capture resources, track tutorials, manage projects — and connect them all together.

## What This Is

Builders learn by doing — discovering ideas, practicing through tutorials, and building projects. That cycle is fast and non-linear, but the tooling hasn't kept up. Learning resources are scattered across a dozen platforms. Tutorials are discovered and forgotten. Project ideas fragment across LLM conversations over weeks.

AI Learning Hub is a single place to capture, organize, and connect everything. Projects are the center of gravity. Resources and tutorials are the fuel. Cross-linking ties them together. The platform is designed for the self-directed AI builder — especially non-developers and no-code/low-code builders who are learning to build with AI tools.

## Core Capabilities

- **Resource Library** — Track podcasts, YouTube channels, blogs, Substacks, subreddits, GitHub repos, LinkedIn people, newsletters, tools, and more. 10+ source types with type-appropriate metadata.
- **Tutorial Tracker** — Save tutorials and walkthroughs with status tracking (saved / started / in-progress / completed).
- **Project Tracker** — Projects as living notebooks: status, linked resources, linked tutorials, notes, and LLM conversation outputs (the actual thinking from Claude/ChatGPT/Gemini sessions).
- **Cross-linking** — Resources and tutorials link to projects. A single save can be both a resource and a tutorial. Everything connects.
- **Mobile Capture** — PWA with home screen shortcut. iOS Shortcut for 2-tap save from any app's share sheet. Android share target API. Fire-and-forget — save and move on.

## Architecture

**API-first. Serverless. Multi-user.**

The API is the product — web and mobile UIs are "skins" over API calls. All operations (internal and external) flow through API Gateway. No Lambda-to-Lambda calls.

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite (PWA) |
| Auth | Clerk or Auth0 |
| Backend | AWS Lambda (Node.js/TypeScript) |
| Database | DynamoDB (single-table design + search index table) |
| Storage | S3 (static assets) |
| Infrastructure | AWS CDK (TypeScript) |
| Hosting | S3 + CloudFront |
| Observability | CloudWatch, X-Ray, structured logging |
| Mobile (V1) | PWA + iOS Shortcut |
| Mobile (V2.5) | Native iOS app |
| Mobile (V3.5) | Native Android app |

### Key Design Decisions

- **API-first architecture** — Programmatic/agentic access is the primary use case. Mobile capture is second. Desktop workspace is third. The UI is a consumer of the API, not the product itself.
- **Unified save entity** — A URL is saved once per user and can serve as a resource, tutorial, or both. Three domain views into one data model.
- **Two-layer data model** — Global content layer (URL stored once across platform) + per-user layer (personal notes, tags, status, project links). Powers the collective learning graph.
- **API-driven processing** — All internal processing (enrichment, notes indexing, search) flows through API Gateway. Enables loose coupling, unified observability, and backend flexibility.
- **Multi-user with per-user data isolation** from day one. Invite-only signup.
- **PWA + iOS Shortcut** for V1 mobile. Native iOS in V2.5, native Android in V3.5.

## Version Roadmap

| Version | Focus | Status |
|---------|-------|--------|
| **V1** | Foundation — API, capture, UI, data model, observability, security | Pre-development |
| **V2** | Intelligence — LLM-powered connections, collective learning graph, semantic search, MCP server | Planned |
| **V2.5** | Native iOS app | Planned |
| **V3** | Community — published learning trails, portfolio for builders | Planned |
| **V3.5** | Native Android app | Planned |
| **V4** | Business model (if ever) | Out of scope |

## Current Status

**Pre-development.** Building out specs using the [BMAD methodology](https://github.com/bmadcode/BMAD-METHOD).

| Artifact | Status |
|----------|--------|
| Product Brief | Complete |
| Domain Research | Complete |
| PRD | In progress (9/11 steps) |
| Architecture | Not started |
| Epics & Stories | Not started |
| UX Design | Not started |

Track progress: [GitHub Issue #39](https://github.com/cirruslycurious/ai-learning-hub/issues/39)

## Documentation

| Document | Description |
|----------|-------------|
| [Product Brief](_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md) | Comprehensive product vision, personas, entity model, security, observability |
| [Domain Research](_bmad-output/planning-artifacts/research/domain-ai-genai-learning-workflows-research-2026-02-02.md) | AI/GenAI learning landscape research |
| [PRD (in progress)](_bmad-output/planning-artifacts/prd.md) | Product requirements document (69 FRs, API-first architecture) |
| [CLAUDE.md](CLAUDE.md) | AI assistant context file |

### Legacy Docs (to be updated post-PRD)

| Document | Description |
|----------|-------------|
| [docs/PRD.md](docs/PRD.md) | Original PRD outline (will be replaced) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture placeholder (not yet written) |
| [docs/epics/000-project-foundation.md](docs/epics/000-project-foundation.md) | Epic 0 placeholder |

## Repository Structure

```
_bmad/                  # BMAD methodology agents, workflows, templates
_bmad-output/           # Planning artifacts (product brief, PRD, research)
docs/                   # Project documentation (to be updated)
frontend/               # React + Vite application (not yet started)
backend/                # Lambda function handlers (not yet started)
infra/                  # AWS CDK infrastructure code (not yet started)
.github/                # Issue templates, PR templates, workflows
```

## License

This project is **source-visible, all rights reserved**. You may view the code for reference and learning purposes. You may **not** copy, modify, distribute, or use this code (in whole or in part) for commercial purposes without explicit written permission from the author. See [LICENSE](LICENSE) for details.
