---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
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

## User Journeys

### Journey 1: Maya — "The Commute Capture"
*Mobile capture → desktop build, primary happy path*

Maya hears a colleague mention an AI automation podcast during a team standup. She pulls out her iPhone, taps Share on the podcast app, taps "Save to AI Learning Hub" in her share sheet — the iOS Shortcut fires, a brief banner confirms the save. She's back in the meeting in under 5 seconds. She never opened the app.

Over the next three days, she saves two more things: a YouTube tutorial someone shared on LinkedIn, and a blog post she finds during lunch. Each save is two taps from whatever app she's in.

Saturday morning with coffee, Maya opens AI Learning Hub on her laptop. Her three saves from the week are there — titles and source types populated (enrichment ran overnight). She creates a new project: "Automated Competitive Analysis v2." She links the podcast and the blog post to the project, marks the YouTube video as a tutorial and sets its status to "started." She pastes in her latest Claude conversation about improving her prompt chain — the project notes field accepts the Markdown and renders it cleanly. Her project page now has linked resources on one side, her thinking process in the center, and her project status at the top.

When her VP asks "what are you doing with AI?", she screenshots the project page and drops it in Slack. It looks professional.

**Capabilities revealed:** Share sheet save (iOS Shortcut), sub-2-second capture, enrichment populating metadata, desktop project workspace, save-to-project linking, Markdown notes with LLM conversation paste, tutorial status tracking, screenshot-friendly project views.

### Journey 2: Marcus — "The Living Notebook"
*Deep desktop session, project-centric workflow*

Marcus has been saving architecture content all week from his phone — a blog post about GraphRAG tradeoffs, a conference talk on multi-model routers, a GitHub repo for an agent framework. Five saves, zero projects linked.

Saturday evening, he sits down at his desk. He opens AI Learning Hub and sees his unlinked saves in the Resource Library. He creates a new project: "Knowledge Graph RAG Experiment" in his "RAG Research" folder. He links three of the five saves. Then he opens the project notes and pastes in a 2,000-word Claude conversation where he worked through whether GraphRAG was right for his use case — the reasoning process, the false starts, the final decision.

He adds tags to the project: `rag`, `knowledge-graph`, `embeddings`. He changes the project status from "exploring" to "building." The two unlinked saves stay in his Resource Library — they're about autonomous agents, not RAG. They'll connect to something later.

Next week he finds a tutorial on hybrid retrieval strategies. He saves it, marks it as a tutorial, starts working through it. He links it to the RAG project and adds notes about what worked and what didn't. His project is now a living notebook: 4 linked resources, 1 active tutorial, 3 pages of notes capturing his architecture decisions and LLM conversations. When he interviews for a GenAI SA role, this is the depth of thinking he can point to — even before V3 publishes it as a learning trail.

**Capabilities revealed:** Resource Library browsing, project creation with folders, bulk linking, large Markdown notes (LLM conversation paste), tagging, project status transitions, tutorial lifecycle (save → start → complete), unlinked saves as first-class citizens.

### Journey 3: Priya — "From Curious to Builder"
*Onboarding → long-term conversion arc*

Priya gets an invite code from a colleague at lunch: "you should check this out for tracking AI stuff." She opens the link on her phone, signs up with Google auth, enters the invite code. The whole signup takes 30 seconds.

She lands on the home screen and sees three starter projects — "Build a Custom GPT", "AI Automation for Your Day Job", "Build a RAG Pipeline." Each has a description, a few linked resources, and a starter note. She's not staring at a blank screen. She taps into "Build a Custom GPT" and sees two podcast episodes, a YouTube tutorial, and a blog post — all curated and beginner-friendly.

Over the next few weeks, Priya saves things sporadically — a podcast someone mentions, a LinkedIn post about AI in HR, a YouTube video about ChatGPT tips. She saves maybe 1-2 things per week, always from her phone. She browses her saves occasionally but doesn't create any projects of her own.

After six weeks, she notices she has 12 saved resources and 8 of them are about AI + HR. She watches the "Build a Custom GPT" tutorial from the seeded project, follows along, and actually builds one — a GPT that helps draft job descriptions. She creates her first project: "AI Job Description Assistant." She links 4 of her HR+AI saves to it and writes a note about what she learned.

Priya didn't plan to become a builder. The platform made the leap small enough that it happened naturally. The seeded projects showed her what was possible. The accumulated saves revealed a pattern she didn't consciously see. V2's intelligence layer will make this arc even more intentional — surfacing beginner content matched to her interests, suggesting project ideas from her save patterns — but V1's foundation already enables the transition through good UX and seeded content.

**Capabilities revealed:** Invite code signup, social auth, seeded onboarding (starter projects + curated resources), mobile-only save pattern, browse/filter saves, first project creation from seeded inspiration, save-to-project linking, tutorial completion tracking. Also validates: V1 data model must store visibility flags, tags, and content metadata that V2's intelligence layer will consume — even though V1 doesn't use them for recommendations.

### Journey 4: Dev — "The API Ecosystem"
*API-first, zero UI after setup*

Dev signs up on desktop, generates his API keys immediately, and never opens the web UI again. He sets up a shell alias: `alh-save <url> --project "agent-framework"`. He registers AI Learning Hub as an MCP server in Claude.

During a deep Claude session about agent orchestration, he says "save that article to my Agent Framework project." Claude calls the MCP tool, saves the URL, links it to the project. The conversation continues without interruption. Later he asks: "what tutorials do I have saved about tool use?" Claude queries his saves via MCP and surfaces three forgotten tutorials.

He builds a Learning Scout Agent that monitors his GitHub stars and RSS feeds. When it finds content relevant to an active project, it autonomously saves the URL, tags it, and links it. Dev wakes up to 3-4 new saves he didn't make — curated by his own agent. His agent respects the API rate limits (100 req/min per key, separate read/write counters) and handles 429 responses with standard Retry-After backoff.

V1 delivers the API contract and rate limiting that Dev's ecosystem depends on. The MCP server itself is a V2 deliverable, but V1's API must not fight against it — consistent resource naming, predictable CRUD patterns, well-typed schemas. Dev's journey validates that the API is truly the product.

**Capabilities revealed:** API key generation (full + capture-only), rate limiting with read/write split, all CRUD endpoints, contract stability (OpenAPI spec from tests), MCP-readiness of API design, agent-friendly 429 responses. Also validates: V1 API completeness is a prerequisite for V2's intelligence layer and Dev's agentic workflows.

### Journey 5: Stephen — "The 2am Alert"
*Operator incident investigation*

Stephen's phone buzzes at 2am: "CRITICAL: API error rate > 1% for 5 minutes." He opens CloudWatch on his phone, sees the System Health dashboard showing a spike in 5xx errors on the save endpoint.

He opens his laptop and runs `admin:enrichment:status` — the enrichment pipeline is healthy, not the issue. He checks X-Ray: the failing requests all trace to a DynamoDB throttling event on the `user-saves` table. He runs `admin:user:activity <user_id>` on the user generating the most traffic — it's a Dev-type user whose agent is firing 500 saves in 10 minutes, exceeding the rate limit but the rate limiter itself is consuming capacity.

He checks the WAF dashboard — no attack pattern, just legitimate overuse. He adjusts the rate limit threshold for that API key tier via a config change, deploys via `cdk deploy`, and verifies the alarm clears. Total time from alert to resolution: 8 minutes. He goes back to sleep.

The next morning he reviews the Security & Abuse dashboard — no other anomalies. He runs `admin:search:sync-status` to confirm the search index caught up after the throttling event. Everything's green.

**Capabilities revealed:** Tiered phone alerting (critical/warning/informational), CloudWatch dashboards, X-Ray distributed tracing, admin CLI tooling (user:activity, enrichment:status, search:sync-status), structured logging with correlation IDs, WAF monitoring, CDK deployment pipeline, per-API-key rate limiting.

### Journey 6: Stefania — "Sunday Evening Review"
*Product analytics and health*

Stefania opens the analytics dashboard with Sunday coffee. The Adoption dashboard shows 2 new signups this week — both from invite codes generated by Marcus. The invite funnel shows 4 codes generated, 2 redeemed, 2 completed signup. Conversion looks healthy.

She switches to the Engagement dashboard. Saves per active user this week: 3.2 (within the 2-5 target range). She notices one user has 0 projects despite 14 saves over 3 weeks — all unlinked. She drills into their save pattern via CLI: `admin:analytics:engagement --user <user_id>`. All mobile saves, all from podcast apps. Priya-type behavior. The seeded projects haven't hooked them yet.

The Retention dashboard shows the week-2 cohort table (small-N format, showing absolute numbers): "Week 1 cohort (Jan 15): 4 signed up, 3 returned week 2." 75% retention at this scale, with the absolute numbers visible so the percentage isn't misleading.

She checks the Persona Health dashboard — Marcus-types retain at 100% (both of them came back), Maya-types at 67% (2 of 3). She flags the passive user as an onboarding observation to revisit.

The whole review takes 15 minutes. The dashboards and CLI tell the same story from different angles. In V2, a GenAI agent will run this review autonomously and generate a weekly report via MCP tools — consuming the same analytics APIs.

**Capabilities revealed:** 5 analytics dashboards (Adoption, Engagement, Retention, Churn & Risk, Persona Health), analytics API, admin CLI analytics commands, small-N display rule, cohort tables, persona segmentation heuristics, per-user drill-down, invite funnel tracking.

### Journey Requirements Summary

| Journey | Primary Capabilities Required |
|---------|-------------------------------|
| Maya (Mobile Capture) | iOS Shortcut, share sheet, sub-2s save, enrichment pipeline, desktop workspace, Markdown notes, project linking, screenshot-friendly views |
| Marcus (Living Notebook) | Resource Library, project folders, bulk linking, large Markdown notes, tagging, status transitions, tutorial lifecycle |
| Priya (Curious → Builder) | Invite signup, social auth, seeded onboarding, mobile browse, first project creation, V2-ready data model (visibility flags, AI enriched flags) |
| Dev (API Ecosystem) | API key management, rate limiting, full CRUD API, contract stability, MCP-ready design, agent-friendly error handling |
| Stephen (Incident) | Alerting, CloudWatch dashboards, X-Ray tracing, admin CLI, structured logging, WAF monitoring, CDK pipeline |
| Stefania (Analytics) | 5 analytics dashboards, analytics API, admin CLI, small-N display, persona segmentation, cohort tables |

## Domain-Specific Requirements

### Domain Classification: Edtech-Adjacent (Personal Learning Tool)

AI Learning Hub operates in the personal knowledge management space for AI/GenAI learners. While superficially "edtech," it differs fundamentally from traditional educational software in ways that simplify the regulatory and compliance landscape.

### Why Standard Edtech Concerns Don't Apply

**COPPA (Children's Online Privacy Protection Act) — Not Applicable**
- COPPA applies to services directed at children under 13 or that knowingly collect data from children
- AI Learning Hub is invite-only, targeting adult self-directed learners (professionals, builders, explorers)
- No features designed for or marketed to minors
- Invite-only model with existing-user-generated codes creates an adult-to-adult distribution chain

**FERPA (Family Educational Rights and Privacy Act) — Not Applicable**
- FERPA applies to educational institutions that receive federal funding and their student records
- AI Learning Hub is not an educational institution
- No relationship with schools, universities, or funded programs
- Users are not "students" in the FERPA sense — they're independent adults managing their own learning

**Curriculum Standards and Learning Outcomes — Not Applicable**
- No courses, curriculum, or structured learning paths
- No assessment, grading, testing, or certification
- No learning outcomes to measure against standards
- Users define their own learning goals; the platform tracks, it doesn't teach

**Age Verification — Minimal Concern**
- Invite-only distribution means the bootstrap is controlled (Stephen seeds first users)
- Social auth (Google, etc.) provides basic age signals
- No need for formal age verification infrastructure
- If a minor somehow gets an invite, no special harm — it's a productivity tool, not age-restricted content

**Content Moderation — Minimal Concern**
- Users save URLs to external content; the platform doesn't host the content itself
- User notes are private by default (V1 has no public-facing user content)
- V3 introduces published learning trails — content moderation becomes relevant then
- V1 risk is low: worst case is a user saves a link to inappropriate content in their own private account

### What Actually Matters

**GDPR (General Data Protection Regulation) — Applies if EU Users**
- Privacy policy required
- Data deletion capability (right to be forgotten) — must support complete user data removal
- Consent management for any optional data collection
- Data processing transparency
- **Implementation:** Clerk/Auth0 handles consent flows; DynamoDB schema supports full user data deletion; privacy policy is a V1 deliverable

**CCPA/CPRA (California Consumer Privacy Act) — Applies if California Users**
- Right to know what data is collected
- Right to delete
- Right to opt-out of data sales (not applicable — we don't sell data)
- **Implementation:** Same infrastructure as GDPR; no additional work required

**API Terms of Service Compliance — Critical**
- YouTube Data API: Must use official API for metadata, not scraping. Quota limits apply.
- RSS Feeds: Designed for syndication; fetching metadata is expected and allowed
- General web scraping: Metadata (title, description, favicon) from public pages is legal; reproducing full content is not
- Platform-specific APIs (Reddit, Twitter/X): Use official APIs if integrating; avoid unauthorized scraping
- **Implementation:** Enrichment Lambda uses official APIs where available; stores metadata only, not full content; respects robots.txt and rate limits

**Standard SaaS Security — Required**
- Encryption at rest (DynamoDB default, S3 encryption)
- Encryption in transit (TLS 1.3 everywhere)
- Authentication via managed provider (Clerk/Auth0 — no custom auth)
- Secrets management (AWS Secrets Manager/Parameter Store)
- Input validation and sanitization
- Per-user data isolation
- **Implementation:** All specified in product brief Security Requirements section; enforced via CDK Nag and security tests in CI

**Markdown/Notes Security — Required**
- User notes can contain arbitrary Markdown including pasted LLM conversations
- V3 introduces public learning trails where notes may be visible
- Store original content; sanitize on render (DOMPurify, allowlist-only)
- Links rendered with `rel="noopener noreferrer"`
- **Implementation:** Sanitization is non-negotiable from V1, even though notes are private — prevents stored XSS in V3

### Compliance Roadmap by Version

| Version | Compliance Requirements |
|---------|------------------------|
| V1 (MVP) | GDPR/CCPA basics, privacy policy, data deletion, encryption, auth via managed provider, API ToS compliance, Markdown sanitization |
| V2 | Same as V1 (no new compliance surface — intelligence layer uses existing data) |
| V3 | Content moderation policy for published learning trails, review published content for policy violations |
| V4+ | If monetization: payment processor compliance (Stripe handles PCI-DSS), terms of service for paid features |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GDPR complaint from EU user | Low-Medium | Medium | Privacy policy, data deletion support, consent management via Clerk/Auth0 |
| YouTube/platform ToS violation | Medium | Low-Medium | Use official APIs only, metadata-only approach, respect rate limits |
| Minor accesses platform | Low | Low | Invite-only distribution, no harmful content hosted, social auth age signals |
| User stores sensitive data in notes | Medium | Low | User responsibility; notes are private; we don't parse note content in V1 |
| Markdown XSS in V3 published trails | Medium | Medium | Sanitize on render from V1, allowlist-only rendering, security tests in CI |

### Summary

AI Learning Hub is **not traditional edtech** and doesn't inherit traditional edtech compliance burden. It's a personal productivity tool for adult learners that happens to organize learning-related content. The compliance profile is closer to "standard SaaS" than "educational software":

- ✅ GDPR/CCPA basics (standard for any SaaS with user data)
- ✅ API Terms of Service (standard for any app that fetches external content)
- ✅ SaaS security baseline (encryption, auth, isolation)
- ❌ COPPA (not for children)
- ❌ FERPA (not an educational institution)
- ❌ Curriculum standards (not teaching anything)
- ❌ Assessment validity (no testing or certification)

This is a feature, not a gap. The lighter compliance burden means faster development and lower operational overhead — appropriate for a solo builder's boutique-scale project.

## Innovation & Novel Patterns

AI Learning Hub's innovation is **philosophical and structural** rather than technical. The novelty lies in design assumptions that don't exist in current tools.

### Detected Innovation Areas

#### 1. The Save-to-Build Assumption

Existing tools optimize for different endpoints:
- **Read-later apps** (Pocket, Instapaper): Assume you saved it to *consume* it
- **PKM tools** (Notion, Roam): Assume you saved it to *organize* it
- **Builder tools** (GitHub, Replit): Assume you already know what to build

AI Learning Hub occupies the gap: **the tool that assumes you saved something because you intend to BUILD with it.** The project-first data model isn't just organization — it's a forcing function. Every save implicitly asks "what will you build with this?" This philosophy shapes the entire UX: unlinked saves are incomplete states, not resting states.

#### 2. Collective Intelligence Without Publishing

The two-layer data model (content layer + user layer) enables a form of collective learning that doesn't require explicit sharing:

- Users link resources to projects privately
- The system learns which resources correlate with which project types across all users
- V2's intelligence layer can surface "resources that helped people build similar projects" without anyone publishing anything

This is distinct from:
- **Raindrop.io shared collections** (requires opt-in publishing)
- **Pocket's "popular"** (measures consumption, not building outcomes)

The innovation: **deriving collective value from private project-linking behavior.**

#### 3. AI Agents as First-Class Users

Most tools add APIs as an afterthought for power users. AI Learning Hub is designed with the assumption that **AI agents will be primary users from day one**:

- Dev's Learning Scout Agent autonomously saves and tags content
- MCP integration enables Claude to query and update the learning graph mid-conversation
- Rate limiting, error handling, and API contract stability are V1 requirements, not V2 nice-to-haves

The innovation: **building a personal tool with the expectation that AI operates it, not just the human.**

#### 4. Relevance Over Popularity

Every content discovery system today optimizes for engagement or popularity. AI Learning Hub's V2 vision explicitly rejects this:

- **Not:** "What's trending" or "What gets clicks"
- **Instead:** "What resources helped people who built similar things?"

This requires different data (project-resource links, not likes) and different algorithms (outcome correlation, not engagement prediction). V1's data model captures the linking behavior that makes this possible.

### Validation Approach

These innovations are philosophical bets, not technical risks. Validation focuses on user behavior:

| Innovation | Validation Signal | When We Know It Works |
|------------|-------------------|----------------------|
| Save-to-build assumption | Users link saves to projects | >50% of saves get project-linked within 30 days |
| Collective intelligence foundation | Data model captures rich linking | V2 can derive meaningful "similar builders used..." recommendations |
| AI agent users | Dev persona adopts API-first workflow | API usage grows independently of web UI usage |
| Relevance over popularity | (V2 validation) | Users find AI recommendations more useful than "popular" |

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Save-to-build philosophy doesn't resonate | Unlinked saves are still valuable; the tool works as a traditional bookmark manager if users don't adopt project-linking |
| Collective intelligence requires scale | V1 works perfectly as single-user; collective features are V2+ when/if user base grows |
| AI agent use case is too niche | API serves power users even without full agentic adoption; MCP is additive |
| "Relevance not popularity" is technically hard | V1 search is basic; relevance algorithms are V2 scope with time to iterate |

## API-First Platform Requirements

AI Learning Hub is an **API-first serverless platform** with web interfaces for human users. This is not "mobile-first responsive design" — it's **"API-first with mobile and desktop interfaces."**

### Architecture Priority Order

1. **API-first (Programmatic/Agentic)** — The API is the product. External consumers (Dev's agents, future MCP) and internal operations (admin CLI, observability) are first-class citizens. Every capability is API-accessible before it gets a UI.

2. **Mobile-second (Human capture)** — iOS Shortcut + PWA share target for frictionless capture. Humans save content on the go; the API receives it.

3. **Desktop-third (Human workspace)** — Rich project management, Markdown editing, search. Humans organize and build here; the API powers it.

| Traditional "Mobile-First" | AI Learning Hub "API-First" |
|---------------------------|----------------------------|
| Design for mobile screens, enhance for desktop | Design for programmatic access, add UIs for humans |
| Mobile web app is the product | API is the product |
| Desktop is progressive enhancement | Web UIs are convenience layers over the API |
| Responsive breakpoints drive architecture | API contract stability drives architecture |

### Why API-First Matters

- **Dev's Learning Scout Agent** doesn't care about responsive design — it cares about predictable endpoints and good error handling
- **Stephen's admin CLI** doesn't use the web UI — it calls the same APIs
- **V2's MCP server** wraps the existing API — no new backend needed
- **Future integrations** (Obsidian plugin, browser extension, Raycast) consume the API directly

The web app is one client among many. The API is the platform.

### API Backend Requirements

#### Authentication Model

| Method | Use Case | Implementation |
|--------|----------|----------------|
| Session auth (Clerk/Auth0) | Web app users | JWT tokens, secure cookies |
| API keys | Programmatic access | Full-access and capture-only tiers |
| Rate limiting | Abuse prevention | 100 req/min per key, read/write split |

#### API Design Principles

- **REST conventions** — predictable resource URLs, standard HTTP methods
- **JSON throughout** — request and response bodies
- **OpenAPI spec** — generated from contract tests, serves as documentation
- **No URL versioning** — additive-only changes; breaking changes coordinated directly at boutique scale (AWS-style approach)
- **MCP-ready / Agentic-ready** — consistent naming, typed schemas, predictable patterns that translate to MCP tools in V2

#### Core Endpoints (V1)

| Resource | Endpoints | Notes |
|----------|-----------|-------|
| Saves | CRUD + list/filter/search | Paginated, filterable by type/status/project |
| Projects | CRUD + list/filter | Folder support, status transitions |
| Tutorials | CRUD + status updates | Lifecycle: saved → started → completed |
| Tags | CRUD + bulk operations | User-scoped |
| Links | Create/delete (save↔project) | Many-to-many relationship |
| User | Profile, settings, API keys | Self-service key management |
| Admin | Analytics, user activity, system status | Internal APIs for operator workflows |

#### Error Handling

- **Standard HTTP status codes** — 200, 201, 400, 401, 403, 404, 429, 500
- **Structured error responses** — `{ error: { code, message, details } }`
- **429 responses** include `Retry-After` header for agent-friendly backoff
- **Correlation IDs** in all responses for debugging

#### Rate Limiting

| Tier | Read Limit | Write Limit | Notes |
|------|------------|-------------|-------|
| Standard | 100/min | 100/min | Web app users |
| API Key (full) | 100/min | 100/min | Dev persona |
| API Key (capture-only) | 100/min | 20/min | Limited write scope |

Separate read/write counters prevent read-heavy agents from blocking saves.

### Web Application Requirements

#### Browser Support

| Browser | Support Level | Notes |
|---------|---------------|-------|
| Chrome (desktop + mobile) | Full | Primary development target |
| Safari (desktop + iOS) | Full | Critical for iOS Shortcut integration |
| Firefox | Full | Standard modern browser |
| Edge | Full | Chromium-based, follows Chrome |
| IE11 | None | Not supported |

#### Responsive Design

- **Mobile-first** CSS approach — capture flows designed for phone-in-hand
- **Desktop-enhanced** — project workspace optimized for larger screens
- **Breakpoints:**
  - Mobile: < 768px (capture, browse, quick actions)
  - Tablet: 768px - 1024px (hybrid)
  - Desktop: > 1024px (full workspace with side panels)

#### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Time to Interactive | < 3s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Save action (iOS Shortcut) | < 2s | E2E test |

#### SEO Strategy

- **Public landing page** with moderate SEO optimization
  - Meta tags, Open Graph, structured data
  - Clear value proposition for organic discovery
  - Invite request flow for waitlist
- **Authenticated app** — no SEO needed for internal pages
- **V3 consideration** — published learning trails will need SEO; foundation laid in V1

#### Accessibility

Lighter-touch accessibility appropriate for boutique scale:
- Semantic HTML throughout
- Keyboard navigation for all interactive elements
- Sufficient color contrast (WCAG AA contrast ratios)
- Focus indicators visible
- Form labels and error messages accessible
- No formal WCAG audit in V1; revisit if user base grows

### PWA Requirements

- Service worker for offline awareness (not full offline mode in V1)
- Web app manifest for "Add to Home Screen"
- Share target registration for Android share sheet
- iOS Shortcut remains primary mobile capture path (more reliable than PWA share target on iOS)

### Infrastructure Alignment

- **Frontend:** S3 + CloudFront (static hosting, global CDN)
- **Backend:** API Gateway + Lambda (serverless, pay-per-use)
- **Database:** DynamoDB (single-table design with search index table)
- **All within $50/month** cost envelope at boutique scale
