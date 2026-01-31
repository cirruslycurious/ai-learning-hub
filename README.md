# AI Learning Hub

A project-centric learning platform for people who build with AI. Capture resources, track tutorials, manage projects — and connect them all together.

## What This Is

Builders learn by doing — discovering ideas, practicing through tutorials, and building projects. That cycle is fast and non-linear, but the tooling hasn't kept up. Learning resources are scattered across a dozen platforms. Tutorials are discovered and forgotten. Project ideas fragment across LLM conversations over weeks.

AI Learning Hub is a single place to capture, organize, and connect everything. Projects are the center of gravity. Resources and tutorials are the fuel. Cross-linking ties them together. The platform is designed for the self-directed AI builder — especially non-developers and no-code/low-code builders who are learning to build with AI tools.

## Core Capabilities

- **Resource Library** — Track podcasts, YouTube channels, blogs, Substacks, subreddits, GitHub repos, LinkedIn people, newsletters, tools, and more. 10+ source types with type-appropriate metadata.
- **Tutorial Tracker** — Save tutorials and walkthroughs with status tracking (not started / started / completed / archived).
- **Project Tracker** — Projects as living notebooks: status, linked resources, linked tutorials, notes, and LLM conversation outputs (the actual thinking from Claude/ChatGPT/Gemini sessions).
- **Cross-linking** — Resources and tutorials link to projects. A single save can be both a resource and a tutorial. Everything connects.
- **Mobile Capture** — PWA with home screen shortcut. iOS Shortcut for 2-tap save from any app's share sheet. Android share target API. Fire-and-forget — save and move on.

## Architecture

API-first, multi-user, serverless.

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite (PWA) |
| Auth | Clerk or Auth0 |
| Backend | AWS Lambda (Node.js/TypeScript) |
| Database | DynamoDB (transactional) + search/discovery store (TBD — ADR-1) |
| Storage | S3 (notes, images) |
| Infrastructure | AWS CDK (TypeScript) |
| Hosting | S3 + CloudFront |
| Observability | CloudWatch, X-Ray, structured logging |
| Mobile (V1) | PWA + iOS Shortcut |
| Mobile (V2.5) | Native iOS app |
| Mobile (V3.5) | Native Android app |

### Key Design Decisions

- **Unified save entity** — a URL is saved once per user and can serve as a resource, tutorial, or both. Three domain views into one data model.
- **Two-layer data model** — global content layer (URL stored once across platform) + per-user layer (personal notes, tags, status, project links). Powers the collective learning graph.
- **API is the product** — web/mobile UI is one consumer. The API serves developers, agent builders, MCP servers, and the future intelligence layer equally.
- **Multi-user with per-user data isolation** from day one. Invite-only signup.
- **PWA + iOS Shortcut** for V1 mobile. Native iOS in V2.5, native Android in V3.5.

## Version Roadmap

| Version | Focus | Status |
|---------|-------|--------|
| **V1** | Foundation — UI, capture, API, data model, observability, security | Pre-development |
| **V2** | Intelligence — LLM-powered connections, collective learning graph, semantic search | Planned |
| **V2.5** | Native iOS app | Planned |
| **V3** | Community — published learning trails, portfolio for builders | Planned |
| **V3.5** | Native Android app | Planned |
| **V4** | Business model (if ever) | Out of scope |

## Current Status

**Pre-development.** Building out specs using the [BMAD methodology](https://github.com/bmadcode/BMAD-METHOD).

- Product brief: complete (15+ elicitation rounds)
- PRD: not started
- Architecture: not started
- Epics & stories: not started

## Documentation

| Document | Description |
|----------|-------------|
| [Product Brief](_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md) | Comprehensive product vision, entity model, security, observability, ADRs |
| [PRD](docs/PRD.md) | Product requirements (not yet updated) |
| [Architecture](docs/ARCHITECTURE.md) | Technical decisions and constraints (not yet updated) |
| [Epic 0](docs/epics/000-project-foundation.md) | Project foundation epic |
| [CLAUDE.md](CLAUDE.md) | AI assistant context file |

## Repository Structure

```
_bmad/                  # BMAD methodology agents, workflows, templates
_bmad-output/           # Planning artifacts (product brief, etc.)
docs/                   # Project documentation (PRD, architecture, epics)
frontend/               # React + Vite application (not yet started)
backend/                # Lambda function handlers (not yet started)
infra/                  # AWS CDK infrastructure code (not yet started)
.github/                # Issue templates, PR templates, workflows
```

## License

This project is **source-visible, all rights reserved**. You may view the code for reference and learning purposes. You may **not** copy, modify, distribute, or use this code (in whole or in part) for commercial purposes without explicit written permission from the author. See [LICENSE](LICENSE) for details.
