---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md
  - _bmad-output/planning-artifacts/research/domain-ai-genai-learning-workflows-research-2026-02-02.md
  - docs/PRD.md
  - docs/ARCHITECTURE.md
  - docs/epics/000-project-foundation.md
documentCounts:
  briefs: 1
  research: 1
  brainstorming: 0
  projectDocs: 3
workflowType: 'prd'
classification:
  projectType: 'web_app + api_backend'
  domain: 'edtech'
  complexity: 'medium'
  projectContext: 'greenfield'
---

# Product Requirements Document - ai-learning-hub

**Author:** Stephen
**Date:** 2026-02-02

## Success Criteria

### User Success

- Per-persona aha moments as defined in the product brief (Maya: "this is MY workbench", Marcus: "this captures my thinking", Priya: "I keep saving HR+AI stuff", Dev: "it's already working for me")
- The mobile save → desktop organize → project build loop feels effortless and professional — not just functional, but polished enough that users trust it with their learning workflow
- The platform enables and accelerates building — users build more, build faster, or start builds they wouldn't have started without the platform organizing their learning inputs

### Business Success

- Weekly Active Builders (WAB) of 3-8 at boutique scale — if even half the users are building in a given week, the product is working
- Invite codes redeemed where invitees activate (not just codes generated)
- No monetization targets through V3 — success is measured by product utility, not revenue
- Infrastructure cost stays under $50/month hard cap

### Technical Success

- Capture latency (share sheet to save confirmed) < 2 seconds
- Search response time < 1 second (V1 full-text)
- API error rate < 0.5%
- Search sync lag < 5 minutes
- 80% test coverage threshold enforced in CI — no exceptions
- All persona E2E golden path tests green on every push
- End-to-end request tracing via X-Ray operational within first week

### Measurable Outcomes

- 7 primary KPIs instrumented and reportable from launch (Activation Rate, Saves/Active User, Project Creation Rate, Save-to-Project Link Rate, 7-Day Retention, Project Activity Depth, Project Stage Progression Rate)
- All 7 leading indicators trackable via user milestones table
- Per-persona success signals measurable (Marcus: 5+ LLM outputs in 30 days, Maya: first iOS Shortcut save within 24h, etc.)
- The experiential quality bar: the save → associate → build workflow looks and feels professional on both mobile and desktop — this is a design review gate, not just a functional test

## Product Scope

### MVP - Minimum Viable Product

V1 is all v0.1 through v0.10 — no partial credit. All of the following must ship:

- Complete save → project → link loop across mobile and desktop
- Three domain views (Resource Library, Tutorial Tracker, My Projects) into one unified data model
- API-first architecture with full CRUD, paginated, rate-limited, contract-tested
- iOS Shortcut + PWA share target for two-tap mobile capture
- Desktop workspace with Markdown notes, project management, search
- Seeded onboarding (3 starter projects with curated resources)
- Async enrichment pipeline (hourly batch, metadata extraction, SSRF protection)
- Full observability stack (structured logging, X-Ray, 4 operational dashboards, tiered alerting)
- Product analytics (5 dashboards, analytics API, admin CLI)
- Security hardened (WAF, per-user data isolation, Markdown sanitization, least-privilege IAM)
- Two documentation tracks (user guides for builders, API docs for developers)
- All v0.10 gates passed before V1 declaration

### Growth Features (Post-MVP)

V2 — The Intelligence Layer:

- Bidirectional LLM connections (project→resources, resources→project ideas)
- Cross-user content discovery via collective learning graph (relevance, not popularity)
- Agentic AI enrichment (deeper metadata, topic analysis, summaries)
- Notes ingestion AI (raw LLM conversation → structured signal)
- Spaced repetition (highest-value V2 feature per domain research)
- Data export (Obsidian, JSON — aligns with local-first trend)
- MCP server implementation for Dev's agentic workflows

### Vision (Future)

- V3: Published learning trails as portfolio and acquisition channel
- V2.5: Native iOS app eliminating Shortcut setup friction
- V3.5: Native Android app completing the native suite
- V4: Business model exploration (if ever relevant)
