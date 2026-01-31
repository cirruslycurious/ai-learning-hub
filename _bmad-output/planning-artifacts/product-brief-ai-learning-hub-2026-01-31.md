---
stepsCompleted: [1, 2]
inputDocuments:
  - docs/PRD.md
  - docs/ARCHITECTURE.md
  - docs/epics/000-project-foundation.md
date: 2026-01-31
author: Stephen
---

# Product Brief: ai-learning-hub

## Executive Summary

**AI Learning Hub is a project-centric learning platform for people who build with AI.** Builders, creators, explorers — whatever they call themselves. We define our users by behavior, not identity: if you're building things with AI, this is for you.

**Saves are fuel. Building is the product.** Resources, tutorials, and content captures are not the point — they are the substrate that powers everything. The value of fuel compounds over time: the more you save, connect, and build, the richer your personal learning graph becomes — and the more powerful V2's intelligence layer will be.

**Projects are the center of gravity — and living notebooks.** They store not just links but also LLM conversation outputs (the actual thinking from Claude, ChatGPT, Gemini sessions). Everything else orbits projects, though unattached resources are first-class citizens with no pressure to link. Content flows in from 10+ source types with near-zero friction capture via share sheet integration (MVP-required). A single save can serve as a resource, a tutorial, or both — no duplication, three domain views into one unified data model.

**The platform is designed for collective intelligence — relevance, not popularity.** Saves contribute to an anonymous aggregate graph by default (opt-out available). The value isn't "47 users saved this" — it's "this content is relevant to what you're building." The platform never exposes who saved what. More users means tighter relevance matching, not bigger popularity numbers. This creates a collective learning graph where every user's fuel enriches the platform for everyone, without sacrificing privacy. The two-layer data model (global content layer + per-user layer) means a URL is stored once across the entire platform, with each user's personal relationship layered on top — powering V2's cross-user recommendations from day one.

**API-first and multi-user from day one** with per-user data isolation and auth, designed for boutique scale (hundreds to low thousands of users). The platform has two interaction surfaces serving two audiences: (1) **Web/mobile UI** — serves non-developer builders. V1's primary interaction surface. Language, UX, and complexity assume a non-developer. (2) **API** — serves developers, agent builders, and V2's intelligence layer. The API is the product — it lets anyone build their own skin, their own interaction model, their own MCP server integration. If the web UI isn't your thing, the API is. If the web UI is your thing and you never touch the API, that's fine too. The tertiary audience is other builders who can view published projects and the learning trails behind them (V3).

---

## Core Vision

### Problem Statement

AI builders learn by doing — moving fast between discovering an idea, practicing through tutorials, and building projects. This cycle is non-linear and faster than ever, but the tooling hasn't kept up. Learning resources are scattered across a dozen platforms and formats. Tutorials are discovered and forgotten. Project ideas are explored across multiple LLM conversations that fragment over weeks. There is no system that treats projects as the center of a builder's learning world, with resources and tutorials connected to what they're actually building — or waiting to connect when the time is right.

### Problem Impact

Builders lose track of valuable content, duplicate effort rediscovering things, and fail to connect insights to active projects. Project ideas decay as context fragments across conversations, platforms, and time. The gap between "I heard about this" and "I built something with it" is wider than it needs to be — not because of skill, but because of tooling. And when builders do ship, there's no way to share the learning trail that got them there.

### Why Existing Solutions Fall Short

- **Browser bookmarks / platform stars** — Scattered, no status tracking, no cross-linking, no project context
- **Notion / Obsidian** — General-purpose blank canvases requiring significant DIY setup with no builder-specific workflow
- **Raindrop / Pocket** — Flat bookmarks with no concept of project relationships, tutorial completion, or learning trails
- **GitHub** — Tracks code but not the podcasts, blogs, and tutorials that informed it. Stars tell you nothing about what you built with it
- **Dev.to / Hashnode** — Publishing platforms for articles, not living records of the build-and-learn process
- **Portfolio sites** — Static showcases, not dynamic workbenches that capture the evolving learning journey

None of these treat projects as the center, none connect multi-modal content to what you're building, and none let builders share the learning trail behind their work.

### Target Audience

**Primary: Self-directed AI builders ("next wave") — defined by behavior, not identity. Leaning toward non-developers.**

The primary user is the self-directed learner who builds WITH AI — whether they call themselves a builder, creator, explorer, or something else entirely. We don't care what label they use; we care about how they operate. They create applications, projects, tools, automations, custom GPTs, AI workflows, and prompt-driven solutions. They are the "next wave" after frontier AI researchers and early adopters: motivated, self-starting, and actively investing their own time to learn by doing. They're already on Udemy, Linux Academy, YouTube tutorials, podcasts, and GitHub. They don't wait for their company to train them. They are developing what industry calls "fusion skills" — learning to collaborate with AI systems through building, not just consuming content.

**Within builders, we lean toward non-developers and no-code/low-code builders.** Software developers adding AI to their existing skillset are welcome and well-served, but they are closer to "frontier learners" who may not need this. The larger, deeper pool is non-developers who are learning to build with AI tools — the marketer creating automated workflows, the analyst building custom GPTs, the entrepreneur prototyping with no-code platforms. No-code/low-code is the future, and this platform is built for that future. UX, language, and complexity should assume a non-developer builder. If a developer finds it too simple, that's fine. If a non-developer finds it too technical, that's a failure.

This is a large and growing cohort. Industry data shows 94% of professionals are ready to learn new AI skills, and 80-85% of developers are already using or exploring AI tools. The pace of AI advancement means continuous learning through building is not optional — it's how you stay relevant. AI Learning Hub is built for these people.

**Secondary: Aspiring builders / passive learners**

People who primarily consume AI content (podcasts, articles, courses) without yet actively building are not shut out — they're welcomed and *enabled*. The seeded onboarding gives them 3 starter projects with curated resources from day one. They don't need to arrive with a project in mind; they can explore, save content, and discover what's possible. The platform's design encourages the transition from passive consumer to active builder naturally — saves accumulate, patterns emerge, and the leap from "I've been reading about RAG" to "I'm building a RAG project" becomes smaller over time. Some users may stay passive indefinitely, and that's fine. But the product's design, UX priorities, and feature roadmap are driven by the builder, not the consumer. The aspiring builder is a welcome guest on a path to becoming a resident.

**The line:** If you're building things with AI — regardless of what you call yourself — this is for you. If you're aspiring to build, this is designed to get you there. If you're only here to consume, you're welcome but the product doesn't bend to your needs.

### Proposed Solution

An API-first, multi-user platform with per-user data isolation and auth, built on a unified save entity with three domain views — Resource Library, Tutorial Tracker, and Project Tracker. A URL is saved once per user and can serve as a resource, a tutorial, or both. These three "domains" are views into the same underlying data, not separate storage. Projects are the center of gravity and living notebooks: they store not just metadata and linked saves but also LLM conversation outputs (copy-pasted from Claude, ChatGPT, Gemini, etc.) — the actual thinking and iteration that happens during a build. This captures the builder's reasoning process, not just their sources. Resources and tutorials are the fuel: they can exist independently and link to projects when the time is right; unattached items are first-class, not orphans. Near-zero friction mobile capture via share sheet integration (MVP-required, two taps max) — the fuel harvesting must be effortless from day one. Desktop experience for connecting, exploring, and building — with equal UX priority to mobile capture. Manual linking is inline and contextual — not a separate workflow but surfaced where you're already working (e.g., viewing a project shows recent saves you can link with a tap). No flow is forced — a user can create a project first, start a tutorial first, or save a resource first. LLM-discovered connections (future) add a second layer that finds patterns the builder didn't see. V1 harvests the fuel; the LLM lights the engine. The two-layer data model (global content layer + per-user layer) means saves are deduplicated across users, enabling a collective learning graph and real network effects in V2. Two interaction surfaces: the web/mobile UI serves non-developer builders (V1's primary surface), while the API serves developers, agent builders, and V2's intelligence layer. Users who prefer programmatic interaction — custom clients, MCP servers, agentic workflows — use the API directly and may never touch the web UI. Both surfaces are first-class. Published learning trails for other builders are the tertiary audience (V3).

### Key Differentiators

**V1 Differentiators (shipped in the foundation):**

1. **Project-centric, builder-first** — Projects are the atom AND living notebooks: they store links, metadata, notes, and LLM conversation outputs (the actual thinking and iteration from Claude/ChatGPT/Gemini sessions). Resources and tutorials orbit them. Unattached items are welcome — they connect when the time is right, not when the system demands it
2. **Saves are fuel, building is the product** — Resources, tutorials, and content captures are not the point — they are the substrate. The product is enabling builders to act on what they're learning. The value of fuel compounds over time — the 50th save is more valuable than the 1st because the graph of connections is richer
3. **Multi-modal content, one system** — 10+ source types with type-appropriate metadata, all in one place. A single unified save entity with three domain views (Resource Library, Tutorial Tracker, Project Tracker) — no duplication
4. **API is the product** — Clean APIs that serve web, mobile, MCP servers, and LLM agents equally. Frontends are consumers, not the product
5. **Dual connection model** — Human-driven links (manual, inline, contextual) in V1. The manual layer must be dead simple and valuable on its own

**V2 Differentiators (shipped with the intelligence layer):**

6. **Bidirectional LLM connections** — V2 connections flow both ways: project→resources ("here's fuel for what you're building") AND resources→project ideas ("here's what you could build with what you're saving"). Both visible, both valued, weighted differently
7. **LLM integration is the engine, not a feature** — Without it, this is organized bookmarks. With it, this is a learning companion that knows you, cares about your growth, and proactively helps you build. V1 harvests the fuel and architects for this. The LLM layer is what transforms the platform from useful to indispensable
8. **Collective learning graph — relevance, not popularity** — Saves contribute to anonymous aggregate signal by default (opt-out available). The value isn't "589 people saved this" — it's "this content is relevant to what YOU are building." One person saved a niche podcast about fine-tuning embeddings, and your project is about exactly that — surface it. The collective graph's power scales with users not because it finds more duplicates, but because it finds tighter, more specific relevance matches. More users = richer signal = better recommendations. This is not Digg. This is a relevance engine powered by collective fuel. Never individual attribution. Every user's fuel enriches the platform for everyone. This is a real network effect and a real moat that no single-user tool can replicate

**V3 Differentiator (shipped with the community layer):**

9. **Published learning trails as acquisition channel** — Builders teaching builders through their actual work, not curated content. Published trails are the primary discovery and community-building mechanism. For non-developer builders who may not have a GitHub repo to show, a published learning trail becomes their portfolio — useful for job interviews, career growth, and professional credibility

---

## Strategic Phasing: V1 and V2 Are Two Distinct, Excellent Products

This is a deliberate two-phase strategy. There is no "V1.5" compromise. Each version must be excellent at what it does. No scope creep between them.

### V1: The Foundation — "Has to be gold"

V1 is a super valuable product on its own — not "okay until the AI arrives." It delivers:

- **Beautiful UI** — polished, responsive, mobile-first. If it looks like crap, nobody sticks around for V2.
- **Effortless mobile capture** — share sheet integration, two taps max. The fuel harvesting must be frictionless.
- **Multi-user with per-user data isolation** — properly engineered from day one. Auth, per-user scoping, security. Not enterprise multi-tenancy, but clean user isolation that scales to hundreds/thousands.
- **Clean API** — the real product surface. REST/GraphQL that any client can consume.
- **Three domain views, one unified data model** — Resource Library, Tutorial Tracker, and Project Tracker are views into the same save entity, not separate storage. A URL is saved once per user and can serve as a resource, tutorial, or both. Projects are at the center. (Note: "Project Tracker" naming may need softening for non-developer audience — consider "My Builds" or similar. A marketer building automated workflows may not think in "projects." Evaluate during UX design.)
- **Projects as living notebooks** — projects store not just metadata and linked resources but also LLM conversation outputs (copy-paste from Claude, ChatGPT, Gemini, etc.). This captures the builder's reasoning process and iteration history — often more valuable than the saved URLs. Rich text notes field per project for this purpose.
- **Manual cross-linking** — inline, contextual, dead simple. Human-driven connections.
- **Monitoring, logging, tracing** — operational excellence from the start. AWS X-Ray for distributed tracing (V1 requirement, not TBD), CloudWatch structured logging with a defined log event contract, CloudWatch Dashboards (4 minimum), and CloudWatch Alarms with phone push. See "Observability & Monitoring" section for full stack definition, logging contract, dashboard specs, admin CLI tooling, and GenAI readiness requirements.
- **Project folders** — projects can be organized into folders/groups by concept or topic. Prevents a flat list of 15+ projects from becoming unmanageable. Folders are user-created and flexible.

**Seeded onboarding** — every new user starts with content, not an empty screen. Seed each account with a "Getting Started" project folder containing 3 starter projects (one per category: e.g., AI Automation, Custom GPTs, AI-Assisted Development), each with curated resources (2 podcasts, 2 blogs, 2 YouTube channels). Consider including a seeded project that teaches users to interact with the platform programmatically — e.g., "Use an MCP Server to manage your learning hub" — to turn users into builders of their own workflows on top of the platform. No signup questions needed — just give them all three in a "Default" folder. They can delete seeds or reorganize later, but the first experience is "here's your workbench, already alive — now make it yours." **Signup is invite-only** — new users need an invite code from an existing user (each user gets 10 codes). Signup itself is dead simple (social auth, minimal steps, enter invite code). The on-ramp is capture (most users will arrive via share sheet), but the home base must never feel like a blank page.

V1 includes good engineering that is NOT AI: search, domain-based content type detection (instant, no network call), batch URL enrichment (metadata fetched async hourly), and activity-based dashboards. The line: **user-created connections = V1. System-inferred connections = V2.**

V1 scope boundary: **No LLM integration. No automated suggestions. No AI-assisted anything.** Everything is manual, everything is human-driven, and everything works beautifully.

**V1 data model must architect for V2:**
- Every save needs a **visibility flag** (public/private, opt-in by default) — V1 stores it, V2 uses it for cross-user recommendations
- Every save needs an **"AI enriched" flag** — V1 does basic metadata capture (URL parsing, content type detection, user-entered tags) with graceful degradation when parsing fails. V2 runs agentic AI enrichment on saved content: deeper metadata extraction, topic analysis, summary generation, relationship discovery. Both layers of metadata coexist — V1 basic metadata is always there, V2 AI-enriched metadata is additive. The flag tracks what has and hasn't been enriched yet.
- **Dual data store architecture** — V1 needs two separate data stores serving two separate functions: (1) a transactional store for user records, saves, projects, links, and (2) a search/discovery store for full-text search in V1 and vector/semantic search in V2. These are intentionally separate: different failure domains, different rate limiting, different scaling characteristics. A failure or throttle in search must not break saves/projects. Both stores must be built and populated in V1 even though the vector/semantic capabilities won't be used until V2 — we must capture and store appropriately FOR V2 to use later. This is a **data layer composition question** and the single biggest architecture decision.
- **Tagging and categorization** is a critical architecture decision. Tags must serve V1's manual workflows (search, filter, organize) AND V2's intelligence layer (semantic matching, cross-user recommendations). User-facing tags for V1 UX are stored in the transactional store. Embeddings for V2 semantic search are silently generated and stored in the search/discovery store. This is the connective tissue of the entire system and must be gotten right.
- API contract design is the **single most important technical artifact** in V1. If the API is wrong, every consumer is wrong. The API must understand the difference between "my data" and "data others have made discoverable" from day one — the visibility model must be baked into the API contract, not retrofitted. **All list endpoints must support pagination from day one.**
- **Test coverage is non-negotiable.** V1 data model and API must have comprehensive test coverage. We cannot discover in V2 that we made terrible choices in V1. Tests validate data model access patterns, API contract behavior, data isolation, visibility flag enforcement, and search sync. The test suite is what gives us confidence to build V2 on top of V1.
- **Measure everything — with a plan, not ad hoc.** Instrument all key operations: capture latency, search response times, API response times, sync lag between stores, error rates, usage patterns. CloudWatch Metrics, structured logging (with a defined contract), X-Ray distributed tracing, API Gateway access logging, and content layer mutation logging from day one. Four dashboards (System Health, Enrichment, Product Usage, Security & Abuse), tiered alerting (critical/warning/informational), admin CLI tooling for investigation, and API-accessible observability for future GenAI monitoring. Full specification in the "Observability & Monitoring" section.
- **Documentation from day one — two tracks.** Not afterthoughts — V1 deliverables. A tech writer agent must be involved from the start. Two tracks: (1) **User guides** for non-developer builders (UI workflows, capture, organizing, building). (2) **API & integration docs** for developers and agent builders (REST/GraphQL API, MCP server integration, agentic workflows, custom client development). The web/mobile UI is for the non-developer builder. The API is for developers, agents, and anyone who wants to build their own skin or interaction model on top of the platform.

### V2: The Engine — "Has to be good"

V2 is the payoff. Because V1 is gold, V2 gets to focus entirely on one thing: making the AI layer excellent.

- The data structure (fuel) is there.
- The multi-tenancy is there.
- The API structure is there.
- The mobile capture is there.
- All V2 has to focus on is the intelligence layer.

V2 delivers **bidirectional intelligence** — connections flow both ways:

- **Project → Resources:** "Your project is about RAG pipelines — here are tutorials, podcasts, and blog posts from the collective graph that are relevant to what you're building." The platform looks at your project and proactively surfaces fuel you didn't know existed.
- **Resources → Project Ideas:** "You saved 3 things about autonomous agents this week — here's a project idea based on what you're learning." The platform looks at your saves and proactively suggests what you could build with them.
- **Enhancement recommendations:** "Your existing project could benefit from this technique covered in a tutorial another user saved."

**Notes are fuel for the LLM, not just for the user.** V1 captures notes because they're useful to the builder. V2 uses those same notes — project notes, save notes, LLM conversation outputs — as the richest signal about who this builder is, what they care about, how they think, and where they're stuck. The 5GB-per-user text budget in V1 isn't just generous storage; it's the training data for a personalized learning companion. V2's LLM layer can: know the builder's interests and skill level from their notes and saves, care about their growth by surfacing patterns they haven't noticed ("you keep saving agent-related content but haven't started an agent project yet"), proactively help them build better by connecting dots across their entire learning history. Capturing notes in V1 is cool for the user. It's fuel for V2's intelligence.

This bidirectional flow — plus relevance-based cross-user recommendations from the collective learning graph — is the core of V2's intelligence layer. The collective graph doesn't surface popular content; it surfaces *relevant* content. The more users contribute fuel, the tighter the relevance matching becomes — not because there are more saves of the same thing, but because the topic graph gets richer and the connections get more specific. The specific technology choices (Claude, Nova, prompts, tools, MCP server) are V2 decisions — not V1 distractions.

### Why This Matters (Scope Creep Prevention)

- **V1 does NOT include** "just a little AI" or "basic suggestions" or "simple tag matching." V1 is manual and gold.
- **V2 does NOT include** infrastructure rework, API redesign, or multi-tenancy retrofitting. V2 is intelligence and gold.
- If a feature idea doesn't clearly belong to V1's foundation or V2's engine, it goes to a V3 backlog.
- This separation ensures neither version is compromised by trying to do the other's job.

### V2.5: Native iOS App — "The capture promise delivered"

V2.5 ships the native iOS app, upgrading the V1 PWA + iOS Shortcut experience to a fully native one:

- **Native share sheet extension** — replaces the iOS Shortcut workaround. No setup required — install the app and share sheet integration works automatically. Lower friction for new users who don't need to configure a Shortcut + API key.
- **Push notifications** — reliable, native push for enrichment completion, project activity, and (with V2's engine) AI-suggested connections.
- **Background refresh** — saves sync even when the app isn't open. Offline queue built-in. Replaces the PWA's lack of background sync on iOS.
- **Siri integration** — "Hey Siri, save this to my AI Learning Hub" for voice-driven capture.
- **Native UI performance** — smoother animations, faster load times, better integration with iOS gestures and navigation patterns.

V2.5 timing is deliberate: the iOS app launches WITH V2's intelligence layer already running. iOS users get the full experience from day one — capture + AI-powered connections. This is a better first impression than launching a bare V1 iOS app. The V1 iOS Shortcut already proved the capture flow works; V2.5 removes the setup friction and adds native polish.

### V3 Horizon: The Community — "Learning trails as portfolio"

V3 is where published learning trails become a real product surface. A builder publishes what they built and the full trail of resources, tutorials, and insights that got them there. This becomes:

- **A portfolio for non-developers** — instead of a GitHub repo (which no-code/low-code builders may not have), a published learning trail shows what you built, how you learned to build it, and the journey you took. Useful for job interviews, career growth, and professional credibility.
- **The primary acquisition channel** — "Here's how a marketer built an automated AI workflow" gets shared on LinkedIn and pulls in the next user. The product markets itself through its users' published work.
- **Community discovery** — browse learning trails by topic, see what other builders are working on, discover resources and tutorials through other people's journeys.

V3 is not in scope for V1 or V2 planning but it shapes how we think about the data model (published/unpublished states, public profiles) and the long-term vision.

### V3.5: Native Android App — "Completing the native suite"

V3.5 ships the native Android app. Lower priority than iOS because the PWA already delivers a strong Android experience (share target API, install prompts, push notifications). The native Android app adds:

- **Deeper OS integration** — widgets, notification channels, intent filters for richer inter-app sharing.
- **Performance optimizations** — native rendering for large project notebooks and notes.
- **V3 community features** — launches with learning trails and community discovery already live.

Android users are well-served by the PWA through V1-V3. The native app is an enhancement, not a gap-filler.

### V4 Horizon: Business Model (Explicitly Out of Scope)

Monetization is not a V1, V2, or V3 concern. This is a personal project built for learning and utility, not revenue. The architecture (API-first, multi-user, collective graph) supports future monetization if it ever becomes relevant, but no pricing model, revenue targets, or business sustainability goals are in scope through V3. If a business model emerges, it's a V4 conversation — not a distraction from building a great product.

### Go-to-Market: Word of Mouth, Not Marketing

This is a personal/boutique project, not a VC-funded launch. GTM reflects that reality:

- **V1 launch is invite-only** — like early Facebook. A small group of builders gets access, experiences something cool, and tells their network. Exclusivity creates intrigue and keeps the user base manageable for a solo builder operating at boutique scale.
- **Word of mouth is the only channel.** No ad spend, no content marketing campaigns, no growth hacking. If the product is genuinely useful, builders will share it. If it's not, no marketing saves it.
- **V3 learning trails become the organic acquisition engine.** Published "how I built this" trails get shared on LinkedIn, Twitter, Reddit — and pull in the next wave of builders. The product markets itself through its users' work.
- **Invite-only also aligns with boutique infrastructure.** Hundreds to low thousands of users is the target. Controlled growth prevents surprise scaling costs and lets the solo builder maintain quality.

### Mobile vs. Desktop: Two Experiences, One Platform

Mobile and desktop are not the same experience scaled to different screens — they serve fundamentally different modes of the builder's workflow:

- **Mobile = Capture & Discover.** Builders learn all the time — on the train, between meetings, waiting in line. They don't have time to build, but they're still thinking about their projects. Mobile is for: saving content via share sheet (2 taps), browsing recent saves, jotting quick notes, discovering what's new. The mobile experience should feel like a pocket notebook — fast, lightweight, always ready to capture a thought or a link.
- **Desktop = Build.** When the builder sits down at their computer, the mode shifts. Desktop is for: organizing projects, writing detailed notes, reviewing LLM conversation outputs, linking saves to projects, working through tutorials step by step, and managing the workbench. The desktop experience should feel like a workshop — spacious, powerful, everything laid out.
- **Both are V1 deliverables with equal priority.** Mobile-first does not mean mobile-only. The desktop workbench needs its own UX design pass with the same rigor as mobile capture. Share sheet is the on-ramp; the desktop is where the value compounds.
- **Tablet = desktop experience with touch-friendly interactions.** iPads and tablets are a significant use case for non-developer builders (many no-code platforms work well on tablets). Tablets get the desktop/build experience — spacious layout, full project management, notes editing — but with touch-optimized tap targets and gestures. Tablets are NOT the mobile/capture experience scaled up.
- **Key engagement insight:** Mobile engagement (daily captures) feeds desktop/tablet engagement (weekly build sessions). A user who saves 5 things on their phone during the week has fuel ready when they sit down on Saturday to build. The two experiences are symbiotic, not competitive.

### Mobile Platform Strategy: PWA First, Native Later

**Decision: Progressive Web App (PWA) with home screen shortcut is the V1 mobile strategy. Native apps come later.**

| Platform | Version | Rationale |
|----------|---------|-----------|
| **PWA + Home Screen Shortcut + iOS Shortcut** | **V1** | Delivers mobile capture & discover experience across iOS and Android with zero app store overhead. Single codebase (React), instant updates, no app review process. "Add to Home Screen" provides app-like experience. **iOS Shortcut** bridges the iOS share sheet gap — a downloadable Siri Shortcut calls the save API directly from iOS's native share sheet. Service worker enables offline queue for saves (evaluated post-MVP per graceful degradation principle). |
| **iOS Native App** | **V2.5** | Full native iOS experience: share sheet extension (no Shortcut setup required), push notifications, background refresh, native UI performance. V2.5 timing means the V2 intelligence layer is available at iOS launch — users get capture + AI-powered connections from day one. |
| **Android Native App** | **V3.5** | Android's PWA support is strong — share target API, install prompts, push notifications all work well in PWA. Native Android app is lower priority because the PWA already delivers a good Android experience. V3.5 timing aligns with community features (V3) being available. |

**Why PWA first:**
- Solo builder, cost is king — no $99/year Apple Developer fee, no Play Store fee, no dual native codebases to maintain in V1
- React (already chosen stack) → PWA is a natural extension, not a separate project
- PWA delivers the "pocket notebook" mobile experience described above: fast capture, browse recent saves, quick notes
- Instant deployment — no app store review cycles, no version fragmentation
- "Add to Home Screen" makes the PWA feel native to non-developer builders who may not distinguish between a PWA and a native app

**iOS Shortcut — the share sheet bridge (V1):**
Safari does not support the Web Share Target API, so PWAs on iOS cannot register as share targets. The workaround: a downloadable **iOS/Siri Shortcut** that appears in the native share sheet and calls the save API directly. Flow: (1) user hits Share in any app (Safari, YouTube, Podcasts, Twitter, etc.), (2) taps "Save to AI Learning Hub" in the share sheet, (3) Shortcut sends the URL to the save API with the user's stored auth token. **Two taps. No App Store. No native code.** The Shortcut is distributed as an iCloud link from the onboarding flow. This is a V1 deliverable — the API-first architecture makes this trivial since the save endpoint already exists.

**iOS Shortcut onboarding — guided setup flow (V1 UX design deliverable):**
The one-time Shortcut setup must be guided, not self-service. iOS Shortcuts support **import questions** — setup prompts that fire automatically when a user taps "Add Shortcut." This eliminates the need for the user to manually configure anything inside the Shortcuts app. The full install flow:
1. User opens the onboarding page in the PWA (or linked from welcome email)
2. Page generates their personal API key with a prominent **"Copy Key"** button
3. User taps the iCloud Shortcut link directly below — iOS opens the Shortcuts app and shows a preview
4. User taps **"Add Shortcut"** — the Shortcut's import question fires: "Paste your API key"
5. User pastes the key, taps Done. Shortcut is installed and appears in the iOS share sheet.

**Total one-time setup: ~30 seconds.** After that, every save is 2 taps from any app's share sheet. The onboarding page with screenshots/walkthrough is a **V1 UX design deliverable** — if this page is confusing, non-developer iOS users will abandon. It must be tested with non-technical users before launch. The V2.5 native iOS app eliminates this setup entirely (install app → share sheet works automatically).

**Post-save feedback — fire and forget:**
Save confirmation must be instant, minimal, and non-interruptive. The user should trust it worked and move on with their life:
- **iOS Shortcut save:** Shortcut displays a brief banner notification — "Saved to AI Learning Hub" with a checkmark. User stays in whatever app they were sharing from. No redirect to PWA. No modal.
- **Android PWA share target save:** Brief toast confirmation, then user returns to their source app.
- **PWA direct save (paste URL):** Inline confirmation in the UI — the URL appears in the save list immediately with a domain icon. No page reload, no success modal.
- **Principle:** Save is fire-and-forget. Enrichment happens in the background (hourly batch). The user doesn't wait for metadata. If enrichment fails later, the URL remains saved with just the domain and raw URL — the user can edit manually next time they open the PWA. No error states in the capture flow. Never interrupt the capture moment.

**Remaining PWA limitations on iOS (accepted in V1):**
- Push notifications on iOS require iOS 16.4+ (widely adopted by V1 launch). Android push works well in PWA.
- No background sync on iOS — saves require the PWA to be open or the Shortcut to have network access (Shortcuts do have network access). Native iOS app resolves background sync fully in V2.5.
- The iOS Shortcut requires one-time guided setup (~30 seconds). The V2.5 native app eliminates this setup friction entirely.

**Impact on existing decisions:**
- "Share sheet integration (MVP-required)" in V1 Foundation is delivered via PWA share target API on Android and **iOS Shortcut** on iOS. The "2 taps max" aspiration is met on **both platforms** in V1 (after one-time iOS Shortcut setup).
- V1 must deliver: (a) the iOS Shortcut itself, (b) API key generation in account settings, (c) a guided onboarding page with import-question-based install flow — this is a critical first-run experience for iOS users and a V1 UX design deliverable.

---

## Entity Model Overview

This section defines the concrete entities and their relationships. The guiding principle is **simplicity that scales** — with a two-layer data model that supports both per-user workflows and the cross-user collective graph.

### Two-Layer Data Model

The data model has two distinct layers:

1. **Content Layer (global)** — a URL is stored ONCE globally. When any user saves a URL, the system first checks if that URL already exists in the content layer. If so, only a new user-layer record is created. The content layer holds canonical metadata about the URL itself: title, domain, auto-detected source type, and (in V2) AI-enriched metadata. This is the foundation of the collective learning graph — "20 users saved this podcast episode, 5 linked it to RAG projects" is instant signal, not fuzzy URL matching.

2. **User Layer (per-user)** — each user's personal relationship to a piece of content. This is where all per-user data lives: notes, tags, tutorial status, project links, visibility preference. One user may treat a YouTube video as a resource to reference; another may treat the same URL as a tutorial they're working through. The content is the same; the user's relationship to it is different.

**URL normalization** — to support the content layer, URLs must be canonicalized (strip tracking params, normalize protocols, handle redirects). This ensures the same content isn't stored as multiple content-layer records due to trivial URL differences. A normalized URL hash serves as the content-layer key.

**DynamoDB access patterns** — this two-layer model requires dual access:
- "Give me all MY saves" → user partition key (primary access pattern)
- "Give me all users who saved THIS URL" → content partition key (GSI, powers V2 collective graph)

Both patterns must be efficient from day one. The architecture decision on GSI design is critical.

### User Entity

**User** — minimal profile, created at signup
- Display name
- Avatar (URL pointer — external hosted or default generated)
- Global visibility preference (public by default, can opt out globally)
- created_at timestamp
- Auth handled by Clerk/Auth0 — User entity stores profile data only, not credentials

### Project Entity (center of gravity — home screen)

Projects are the home screen — always. Users land on their projects and navigate to tutorials and resources from there. This is a deliberate product decision: **we always start with what you are building.** Resources and discovery are accessible from the home screen (navigation to Resource Library, Tutorial Tracker), and users can go there to passively learn, browse, or save things they found — that's totally fine. But the center of gravity is never the save list; it's the build list. Even a brand-new user with zero personal projects sees seeded starter projects, not a feed of saves. The home screen is the workbench, not the inbox.

**No flow is forced** — a user can create a project first, start tracking a tutorial first, or save a resource first. Any entry point is valid. The seeded onboarding ensures the home screen is never blank regardless of how the user starts. A user can archive seeded projects they don't want (archived projects disappear from the home screen), but the product **always nudges toward building**. The target user is the builder and the creator — a save-heavy, project-light user is welcome but the UX should gently encourage the leap from "saving fuel" to "starting a build." This is not about forcing a flow; it's about keeping the builder identity front and center.

**Project Folder**
- User-created folders to group projects by concept or topic
- Seeded with "Default" folder containing 3 starter projects on signup
- Folders are flat (no nested folders)

**Project** (belongs to a folder)
- Title and description — what is the project, objectives, goals
- Status — `investigating/planning` | `building` | `deployed` | `updating/enhancing` | `archived` (Note: status labels need UX review for non-developer audience — "deployed" and "updating/enhancing" are developer-speak. A marketer building automated workflows doesn't "deploy." Consider: "exploring" | "building" | "live" | "improving" | "archived." Evaluate during UX design alongside domain naming.)
- Linked saves — links to user-layer save records (resources, tutorials, or both)
- Notes — rich text field for manual notes AND LLM conversation outputs. This is the project's living notebook — the builder's reasoning process and iteration history. **Storage: S3 with DynamoDB pointers.** Notes can grow large (LLM conversations are lengthy); budget up to 5 GB of text per user across all projects. Client loads max 400KB at a time (paginated/lazy loading). DynamoDB holds metadata and S3 keys only — never the full note content. **Notes input format: Markdown-first.** The notes field accepts and renders Markdown. This is a deliberate choice because LLM outputs are naturally Markdown-formatted — the friction reduction strategy for capturing LLM conversations is progressive:
  - **V1 baseline:** Accept any copy-paste (plain text, rich text, whatever). Render as-is. When the system detects non-Markdown paste, surface a gentle nudge: "Tip: Ask your AI to summarize as Markdown for better formatting." Link to a how-to guide.
  - **V1 stretch:** Instruct users to ask the LLM to "summarize this conversation as a Markdown file" and paste the result. This produces clean, structured notes with near-zero platform engineering cost — the LLM does the formatting work.
  - **V2/V3 exploration — direct LLM integrations:** (a) MCP server integration for Claude/ChatGPT that enables "Save to AI Learning Hub" directly from the LLM conversation. (b) A lightweight, scoped API endpoint that accepts Markdown notes from any LLM — user gets a project-scoped API key, selects which project, and the LLM sends Markdown directly to the endpoint. This reduces friction to near-zero for technical users and could become a powerful builder workflow. These are future explorations, not V1 commitments, but the API-first architecture and notes storage model must not preclude them.
  - **Security: Markdown sanitization is non-negotiable.** Store original content as-is; sanitize on render using DOMPurify or equivalent. Allowlist-only: headings, lists, code blocks, links, images, bold, italic, tables. Strip all scripts, iframes, event handlers, embedded HTML. Links get `rel="noopener noreferrer"`. This applies in V1 even though notes are currently private — V3 introduces public learning trails, and content stored without sanitization becomes a stored XSS vector. See Security Requirements section for full details.
- Images — two types supported: (1) **User-uploaded images** stored in S3 with DynamoDB pointers. Max 1 MB per image, max 5 uploaded images per project. Client loads one at a time. (2) **External image links** (Google Photos, Imgur, etc.) — just a URL pointer, zero storage cost. No limit on external links. Graceful degradation: if external link breaks, show placeholder
- Tags — user-created tags for organization and filtering (stored in transactional store; V2 adds embeddings in search/discovery store)
- Visibility flag — public/private (opt-in by default). V1 stores it, V2 uses it for cross-user recommendations
- AI enriched flag — V1: false. V2: set when agentic AI enrichment has been run
- created_at, updated_at timestamps

### Save Entity (unified — replaces separate Resource and Tutorial entities)

**A URL is saved once per user.** That single save can serve as a resource, a tutorial, or both — and can be linked to any number of projects. No duplication. The three "domains" (Resource Library, Tutorial Tracker, Project Tracker) are **views** into the same underlying data, not separate storage.

**Content Layer Record** (global, one per unique URL)
- Canonical URL + URL hash (normalized, deduped)
- Auto-detected source type — `podcast` | `youtube_channel` | `blog` | `substack` | `subreddit` | `github_repo` | `linkedin` | `corporate_blog` | `newsletter` | `tool` | `other`
- Canonical metadata — title, domain, description (auto-extracted where possible)
- Type-appropriate metadata — flexible field (e.g., podcast: show name; YouTube: channel name)
- AI enriched flag — V1: basic metadata only. V2: deeper extraction, topic analysis, summaries
- created_at timestamp (first time any user saved this URL)

**User Layer Record** (per-user, one per user per URL)
- Reference to content layer record
- **Roles** — `is_resource: true/false` | `is_tutorial: true/false` (a save can be both)
- Tutorial status — `not started` | `started` | `completed` | `archived` (only relevant when is_tutorial = true)
- Notes — user's personal notes on this content. Storage: S3 with DynamoDB pointers (same pattern as project notes)
- Tags — user-created tags (personal to this user)
- Linked projects — many-to-many links to the user's projects
- Visibility flag — public/private (opt-in by default, overrides global preference per save)
- created_at, updated_at timestamps

**How the three "domains" map to this model:**
- **Resource Library view** = all user-layer records where `is_resource = true`, grouped/filtered by source_type
- **Tutorial Tracker view** = all user-layer records where `is_tutorial = true`, with status tracking
- **Project Tracker view** = projects with their linked saves (both resources and tutorials)

A save starts as whatever the user intends (resource or tutorial). They can later toggle it to be both. The URL exists once in the content layer regardless.

**Note: How-tos/Guides are NOT saves.** How-tos are internal product documentation about how to use AI Learning Hub itself. They are V1 documentation deliverables, not user-created content entities. They live in the docs layer, not the data model.

### Relationships

- **Project ↔ Save** — many-to-many. A project can link to many saves; a save can link to many projects. Unlinked saves are first-class citizens
- **User ↔ Content** — many-to-many via user-layer records. Multiple users can save the same content; each has their own notes, tags, status, and project links
- **Cross-user signal** (V2) — the content layer knows how many users saved each URL and how they're using it. This powers the collective graph without exposing any individual user's private data

### Cross-cutting: Search

- V1: Full-text search across all saves and projects INCLUDING note content (transactional + search/discovery store). Both project notes and save notes are indexed in the search/discovery store
- V2: Semantic/vector search, cross-user discovery via collective graph
- V1 shows only "my" content. V2 adds a "discover" layer using visibility flags stored from day one

### Storage Architecture

- **DynamoDB** — transactional store for all entity metadata, relationships, tags, flags, and S3 pointers. Never stores large content blobs directly (400KB item limit). Content-layer and user-layer records both live here with appropriate partition keys and GSIs
- **S3** — blob store for project notes, save notes (rich text, LLM conversation outputs), and user-uploaded images. Cheap, scalable, pay-per-use. Budget: up to 5 GB of text content per user
- **Client loading pattern** — lazy load large content. Notes: max 400KB per request. Images: load one at a time. Never fetch all blobs upfront
- **External links** — images hosted elsewhere (Google Photos, Imgur, etc.) are just URL pointers in DynamoDB. Zero S3 cost. Graceful degradation if link breaks

### V1 Discoverability Design

V1 does **not** surface other users' saves in the UI. There is no "recommended" or "discover" tab. However, the data model is designed for it from day one:
- Every save has a visibility flag (public by default, opt-out available per item or globally)
- Every save has an AI enriched flag (false in V1)
- The search/discovery store is populated in V1 even though cross-user search isn't exposed yet
- The content layer tracks cross-user save counts from day one
- V2 flips on discovery using all this stored data

### Privacy Model: Aggregate Only, Never User-Attributed

**Visibility means aggregate signal, never individual attribution.** When a save is public, it contributes to the collective graph — but the platform **never** exposes *who* saved what. No usernames, no avatars, no "Stephen and 46 others saved this." Individual save activity is private. The collective graph is powered by anonymous aggregate data only. This is a core privacy principle, not a V1 shortcut — it applies to V2 and V3 as well.

**The collective graph is a relevance engine, not a popularity counter.** The value is not "47 users saved this podcast" — it's "this content is relevant to what you're building right now." If one person saved a niche tutorial and it's directly relevant to your project, that's gold — surface it. If 500 people saved something trending but it has nothing to do with your work, ignore it. More users in the system doesn't mean bigger numbers next to popular content — it means the relevance matching gets tighter and more specific. Cross-user recommendations in V2 surface content based on relevance to the builder's projects and learning trajectory, never based on popularity counts or individual user behavior attribution.

---

## Operational Constraints & Principles

This is a solo builder's personal project, not an enterprise product or VC-funded startup. Design decisions must reflect that reality — there is no team, no on-call rotation, no one else to fix things, and no funding. Build it like it could take off, but don't spend like it will. The architecture should scale to thousands of users without requiring re-architecture, but the operational posture is boutique: best-effort reliability, managed services for the heavy lifting, and controlled growth via invite-only access.

- **RTO/RPO: 24 hours.** No SLAs, no promises, best effort. Design reasonable and good — not enterprise-grade disaster recovery. Managed services (DynamoDB, CloudWatch, Clerk/Auth0) provide the reliability baseline.
- **Cost is king. Serverless is king.** Lambda, S3, DynamoDB, CloudFront — lean on AWS free tier and serverless pay-per-use. Only put things in "expensive" locations (vector stores, dedicated search instances) when absolutely necessary. Model and monitor costs from day one.
- **Search: reliable first, fast second.** Search must be reliable above all. Reasonably quick is fine. Lazy loading is acceptable. Lightning-fast is not a V1 requirement.
- **API pagination built in from day one.** All list endpoints paginated. No unbounded queries.
- **Graceful degradation everywhere.** URL parsing fails? Save anyway with manual content type. Search store lagging? Transactional store still works. Network offline? (Evaluate offline queue for post-MVP.) Never lose a save because a secondary system is down.
- **Automated alerting is non-negotiable.** Solo builder means no human watching dashboards. Tiered alerting: critical alerts (phone immediately), warning alerts (phone, batched hourly), informational (dashboard only, reviewed weekly). See "Observability & Monitoring" section for the full alert set. Alerts go to phone, not email. Graceful degradation must be real and visible to users ("search is temporarily limited"), not silent bad results.
- **URL normalization: pragmatic, not perfect.** Start with aggressive-but-imperfect normalization for the top 5 domains (YouTube, GitHub, Spotify, Apple Podcasts, general web). Accept that edge-case duplicates will happen. Build a merge/dedup tool for later. Don't let perfect normalization block launch.
- **Desktop UX parity with mobile.** Mobile = capture & discover. Desktop = build. These are two different experiences, not the same UI scaled. Both are V1 deliverables with equal priority. See "Mobile vs. Desktop" section for full breakdown.
- **Test coverage is non-negotiable.** V1 data model and API must have comprehensive test coverage. Tests validate data model access patterns, API contract behavior, data isolation, visibility flag enforcement, and search sync. The test suite is what gives us confidence to build V2 on top of V1.
- **Documentation from day one — two tracks.** Documentation is a V1 deliverable, not an afterthought. Two distinct documentation tracks serve two distinct audiences: (1) **User guides** — how to click around, use the UI, capture content, organize projects, work through tutorials. Written for non-developer builders. If these docs are unclear, the product fails. (2) **API & integration docs** — how to programmatically interact with the platform via REST/GraphQL API, build custom clients, connect MCP servers, and integrate with agentic workflows. Written for developers and technical builders. These two tracks reflect the product's dual nature: the web/mobile UI serves the non-developer builder; the API serves the developer, the agent builder, and V2's intelligence layer.
- **UX Principle: "Write for the marketer, not the engineer."** All user-facing language — UI labels, status names, feature descriptions, onboarding copy, error messages, docs — must be written for the non-developer builder. Developer-brained terminology is a product failure. Specific flags for UX review: "deployed" → "live"/"running"/"active", "LLM conversation outputs" → "AI chat history", "reasoning process" → "how I figured it out", "Project Tracker" → "My Builds" or similar. This is a tone-of-voice decision that applies to the entire product surface, not just individual labels. The UX designer must own this as a core principle.

---

## Security Requirements (Cross-Cutting Concern)

Security is a V1 requirement, not a V2 retrofit. The platform is multi-user with a shared content layer, an API designed for third-party consumers, and a roadmap that introduces public-facing content (V3 learning trails). The attack surface grows with each version — security foundations must be laid in V1.

**Design principle: "Trust but verify."** Users are assumed to be acting in good faith. Lightweight validation happens synchronously at save/input time (fast, keeps the experience snappy). Deeper, more comprehensive inspection happens asynchronously in batch jobs (the enrichment Lambda, scheduled scans). This two-pass approach preserves the near-zero-friction capture experience while catching malicious or problematic content before it reaches other users or V2's intelligence layer.

### Infrastructure Security (AWS-native)

- **CloudFront in front of everything** — all traffic (web, mobile, API) routes through CloudFront. This enables AWS Shield (DDoS protection, included at no extra cost with CloudFront), AWS WAF integration, and TLS termination. CloudFront flat-rate pricing plans bundle WAF, Shield, and CDN into a predictable monthly cost — evaluate during architecture phase.
- **AWS WAF on CloudFront and/or API Gateway** — rate limiting, IP-based throttling, bot detection, and common attack pattern blocking (SQL injection, XSS in request parameters). WAF costs ~$5/month per Web ACL + $1/month per rule + $0.60 per 1M requests — cheap for the protection it provides. Specific WAF rules to evaluate: AWS Managed Rules (pre-built rulesets for common threats), rate-based rules for API abuse prevention, and geo-restrictions if needed.
- **API Gateway** — built-in request validation, throttling (per-API-key and per-stage), and usage plans. Enforces request size limits, validates required parameters. Consider REST API (vs HTTP API) specifically for WAF integration and request/response validation — the cost difference ($3.50 vs $1.00 per million requests) may be worth it for the security features at boutique scale.
- **Lambda execution isolation** — each Lambda invocation runs in its own micro-VM (Firecracker). No shared state between invocations. The enrichment Lambda (which fetches external URLs) should run in a VPC with restricted outbound access — deny-list for private IP ranges (10.x, 172.16.x, 192.168.x), cloud metadata endpoints (169.254.169.254), and non-HTTPS URLs. This prevents SSRF attacks where a crafted saved URL tricks the Lambda into fetching internal AWS resources.

### Input Validation (Synchronous — "Trust" layer)

Fast, lightweight checks at save/input time. Never block a save for something the batch job can catch later.

- **URL validation on save** — reject obviously malformed URLs, enforce max length (2048 chars), validate scheme (HTTPS only, reject `data:`, `javascript:`, `file:` schemes), reject URLs with embedded credentials (`user:pass@host`). This is a synchronous format check, not a content check.
- **Field length limits** — enforce max lengths on all user input fields: project title, description, tags, notes per request (separate from total budget). Prevents storage abuse and oversized payloads.
- **Input encoding** — validate UTF-8 on all text inputs. Reject or sanitize invalid byte sequences.
- **API request size limits** — enforce via API Gateway. Max request body size appropriate for each endpoint (saves are small, notes can be larger but capped per request at 400KB per the lazy load spec).

### Content Sanitization (Asynchronous — "Verify" layer)

The batch enrichment job and scheduled scans handle deeper inspection. Users don't wait for this.

- **Metadata sanitization on enrichment** — the enrichment Lambda fetches Open Graph tags, page titles, and descriptions from arbitrary external URLs. All fetched metadata must be treated as untrusted: strip HTML tags, validate UTF-8, truncate to reasonable lengths, sanitize against XSS payloads. Open Graph tags are user-controlled content on the source website — they can contain anything.
- **URL normalization includes basic safety checks** — during normalization, reject known-bad patterns: homograph domains for top-5 normalized domains, data URIs, excessively long URL paths.
- **Notes abuse monitoring** — the 5GB-per-user budget is generous. Monitor for abuse patterns: rapid bulk writes, Base64-encoded binary data in Markdown, or usage patterns that suggest the notes field is being used as a free file host rather than a notebook. Alerting, not blocking — flag for review.

### Markdown Rendering (Non-Negotiable)

- **Sanitize on render, not on storage.** Store the original Markdown as-is (preserves user content, enables future re-processing). Sanitize at render time using a battle-tested library (DOMPurify or equivalent).
- **Allowlist-only rendering** — permit only safe Markdown elements: headings, lists, code blocks, links, images, bold, italic, tables. Strip all scripts, iframes, event handlers, `onclick`, `onload`, embedded HTML, and dangerous attributes.
- **Links rendered with `rel="noopener noreferrer"`** — prevent tab-nabbing attacks.
- **Image handling** — images in Markdown should be CSP-restricted. Evaluate whether to proxy external images (prevents tracking pixels but adds cost and complexity) or rely on CSP headers (cheaper, may be sufficient for V1). Decide during architecture phase.
- **This applies to V1 even though notes are currently private.** V3 introduces public learning trails — content stored without sanitization in V1 becomes a stored XSS vector in V3. Sanitize from day one.

### Authentication & Authorization

- **Auth delegated to Clerk/Auth0** — the platform never stores or handles credentials directly. Clerk/Auth0 provides bot detection, rate limiting on auth endpoints, MFA support, and social auth.
- **Per-user data isolation enforced at API layer** — every API request is scoped to the authenticated user's partition. A user must never be able to read, modify, or delete another user's saves, notes, projects, or tags regardless of query manipulation, parameter tampering, or direct DynamoDB key guessing. This is the most critical authorization requirement and a primary test coverage target.
- **API key management** — user API keys must be revocable, rotatable, and scoped. If project-scoped API keys are introduced (notes friction reduction), they must be write-only to a single project with no read access to other projects or user data. Separate from the main user API key.
- **Invite code hardening** — codes must be cryptographically random, minimum 12 characters alphanumeric. Rate limit signup endpoint (max 5 attempts per IP per hour). Generic error on invalid code (don't reveal whether code exists or is already used). Clerk/Auth0 bot detection on signup flow.

### Security Testing & Monitoring

- **Data isolation tests** — automated test suite that attempts cross-user data access via API. This is a V1 test coverage requirement, not optional.
- **WAF monitoring** — CloudWatch metrics on blocked requests, rate limiting triggers, and bot detection events. Alert on anomalies.
- **Enrichment Lambda monitoring** — track which URLs the Lambda fetches, alert on internal IP access attempts (SSRF detection), monitor for fetch failures and timeouts.
- **Dependency scanning** — automated scanning of npm/CDK dependencies for known vulnerabilities (npm audit, Dependabot or equivalent). Run in CI pipeline.

---

## Observability & Monitoring (Cross-Cutting Concern)

Observability is a V1 requirement with the same priority as security. A solo builder with no on-call rotation needs the system to tell them what's wrong, where, and why — automatically. "Measure everything" is not a plan. This section defines the specific observability stack, logging contracts, dashboards, audit trails, and admin tooling required for V1.

**Design principle: Operations must be planned, not winged.** Every component of the observability stack — what it does, which AWS service provides it, what data it captures, and how it's queried — must be documented and architected in V1. This is not something to figure out after launch. The observability layer is also designed to be API-accessible, enabling future GenAI-powered monitoring and diagnostics.

### Observability Stack (AWS-native)

| Component | Purpose | AWS Service | V1 Status |
|-----------|---------|-------------|-----------|
| **Structured logs** | All application events, queryable by user/request/action | CloudWatch Logs (JSON structured) | Required |
| **Metrics** | Quantitative operational data (latency, error rates, throughput) | CloudWatch Metrics (custom + built-in) | Required |
| **Traces** | End-to-end request flow across services | AWS X-Ray | Required |
| **Dashboards** | Visual operational health at a glance | CloudWatch Dashboards | Required |
| **Alerts** | Proactive issue detection, push to phone | CloudWatch Alarms → SNS → phone | Required |
| **API audit logs** | Who called what endpoint, when, from where | API Gateway access logs → CloudWatch Logs | Required |
| **Admin CLI tooling** | Investigation, moderation, troubleshooting | Lambda functions / CLI scripts | Required |

**AWS X-Ray is a V1 requirement, not TBD.** X-Ray provides end-to-end distributed tracing across API Gateway → Lambda → DynamoDB → S3 → search store. When a user reports "I saved something and it disappeared," X-Ray lets you trace that single request across every service it touched. Cost: ~$5 per million traces sampled, with a free tier of 100K traces/month — essentially free at boutique scale. X-Ray traces are retained 30 days by default.

### Structured Logging Contract

Every log event from every Lambda and service must include these fields. This is a contract, not a guideline — deviations break queryability.

```
{
  "timestamp": "ISO 8601",
  "request_id": "API Gateway request ID — correlation ID across all services for a single request",
  "trace_id": "X-Ray trace ID — links to distributed trace",
  "user_id": "Authenticated user ID (or 'anonymous' for pre-auth endpoints)",
  "action": "Structured action name (e.g., save.created, project.updated, enrichment.completed, enrichment.failed)",
  "entity_type": "What was affected (save, project, content_layer, invite_code, etc.)",
  "entity_id": "ID of the affected entity",
  "source": "Which Lambda/service emitted the log",
  "level": "INFO | WARN | ERROR",
  "duration_ms": "How long the operation took",
  "ip_address": "Client IP (from CloudFront/API Gateway headers)",
  "user_agent": "Client user agent string",
  "metadata": "Action-specific details (URL saved, error message, response code, enrichment results, etc.)"
}
```

**This contract enables the following queries via CloudWatch Logs Insights:**
- "Show me all actions by user X in the last 24 hours" — user activity timeline for investigation
- "Show me all enrichment failures this week" — enrichment health
- "Show me all saves from IP address Y" — abuse detection
- "Trace request ABC from API Gateway through Lambda to DynamoDB" — end-to-end debugging
- "Show me all ERROR-level events in the last hour" — incident response
- "Show me all content_layer mutations in the last 24 hours" — forensic audit

### Content Layer Mutation Logging

The shared content layer is the most sensitive data surface — one bad enrichment affects every user who saved that URL. All mutations to content-layer records must be logged with before/after state:

- **On enrichment metadata update:** log the previous metadata values and the new metadata values. If enrichment overwrites good metadata with bad metadata (from a malicious Open Graph tag that slipped through sanitization), this log lets you identify what changed, when, and revert it.
- **On URL normalization changes:** if a normalization_version upgrade re-normalizes existing URLs, log the old and new normalized forms and hashes.
- **On content-layer record deletion** (admin action): log full record state before deletion.
- **Storage:** these mutation logs are append-only and go to a separate CloudWatch Logs group with 90-day retention (longer than operational logs). They are the forensic audit trail for the shared data layer.

### API Audit Trail

Every API call must be logged with sufficient detail for forensic investigation. This serves two purposes: (1) troubleshooting user-reported issues, (2) investigating bad actor behavior.

- **API Gateway access logging** — enabled on all stages. Captures: request ID, timestamp, HTTP method, resource path, response status code, response latency, client IP, user agent, API key ID. These logs go to CloudWatch Logs with 90-day retention.
- **Application-level audit events** — in addition to API Gateway access logs, the application layer emits structured log events (per the logging contract above) for every state-changing operation: save created, project updated, note appended, tag added, project linked, visibility changed, etc. These are the "what happened" events that API Gateway access logs can't capture (Gateway only sees the HTTP layer, not the business logic).
- **Per-user activity reconstruction** — between API Gateway access logs and application audit events, it must be possible to reconstruct a complete timeline of any user's activity: what they saved, what they modified, what they deleted, what they searched for, what API keys they created, what invite codes they generated and who used them.

### V1 Dashboards (Minimum Required)

Four dashboards, each with a specific audience and purpose:

**1. System Health Dashboard** — "Is the system healthy right now?"
- API error rates (4xx, 5xx) by endpoint
- Latency percentiles (p50, p95, p99) by endpoint
- DynamoDB consumed read/write capacity vs. provisioned
- Lambda invocation counts, error counts, duration percentiles
- Search store sync lag (time since last successful sync)
- S3 request counts and error rates

**2. Enrichment Dashboard** — "Is the enrichment pipeline healthy?"
- URLs queued for enrichment (unenriched count)
- URLs processed per run (throughput)
- Enrichment success/failure rate per run
- Average enrichment time per URL
- Failure reasons breakdown (timeout, SSRF blocked, parse error, etc.)
- Content layer mutations per run (metadata updates)

**3. Product Usage Dashboard** — "Is the product being used?"
- Saves per day/week, projects created per day/week, notes created per day/week
- Active users per day/week (DAU/WAU)
- API calls per day by endpoint category (saves, projects, search, notes)
- Mobile vs. desktop save ratio
- New signups per week, invite codes generated vs. used
- Top saved domains (content type distribution)

**4. Security & Abuse Dashboard** — "Is anyone attacking or abusing us?"
- WAF blocked requests by rule
- Rate limiting triggers by endpoint and IP
- Signup attempts vs. successes (invite code brute-force detection)
- Failed API authentication attempts
- SSRF detection alerts from enrichment Lambda
- Per-user save velocity anomalies (one user making abnormal save volume)
- Notes storage velocity anomalies (rapid bulk writes)

### Alerting (Expanded)

The existing operational constraints section mentions 4 alerts. The full V1 alerting set:

**Critical (phone notification immediately):**
- API error rate > 1% for 5 minutes
- API latency p99 > 5 seconds for 5 minutes
- DynamoDB throttling events detected
- Lambda invocation errors > 5% for 5 minutes
- Search store sync lag > 10 minutes

**Warning (phone notification, batched hourly):**
- Search store sync lag > 5 minutes
- Enrichment Lambda failure rate > 10% in a single run
- Enrichment Lambda runtime > 5 minutes (approaching timeout)
- WAF blocked request spike (> 2x normal baseline)
- Any SSRF detection alert from enrichment Lambda
- DynamoDB consumed capacity > 80% of provisioned

**Informational (dashboard only, reviewed weekly):**
- Per-user activity anomalies (> 3 standard deviations from mean)
- Notes storage velocity anomalies
- Invite code generation patterns
- New user signup patterns
- Content layer mutation counts

### Admin CLI Tooling (V1 Required)

Solo builder needs tools, not a dashboard UI. These are Lambda functions or CLI scripts invokable from a terminal. Minimum required set:

- **`admin:user:activity <user_id> [--since <date>]`** — query a user's complete activity log (CloudWatch Logs Insights query, formatted output). Returns: saves, project actions, note actions, API calls, invite codes, login events.
- **`admin:user:suspend <user_id>`** — disable user's API key in Clerk/Auth0, flag account as suspended. Reversible.
- **`admin:user:unsuspend <user_id>`** — reverse suspension.
- **`admin:content:remove <url_hash>`** — remove a content-layer record and cascade-remove all user-layer references. Logs the full record state before deletion.
- **`admin:content:reenrich <url_hash>`** — re-queue a specific URL for enrichment (bypasses hourly batch, runs immediately).
- **`admin:invite:revoke <code>`** — invalidate a specific invite code.
- **`admin:invite:list <user_id>`** — list all invite codes generated by a user and their usage status.
- **`admin:enrichment:status`** — show current enrichment queue depth, last run time, last run results.
- **`admin:search:sync-status`** — show search store sync lag, last sync time, pending items.

These scripts are documented in the API & integration docs track (developer documentation). They are internal-only and not exposed via the public API.

### Observability APIs & GenAI Readiness

The observability stack must be API-accessible to support future GenAI-powered monitoring and diagnostics. This means:

- **All AWS observability services used have APIs.** CloudWatch Logs Insights has a query API (`StartQuery`/`GetQueryResults`). CloudWatch Metrics has `GetMetricData`. X-Ray has `GetTraceSummaries`/`BatchGetTraces`. These are the APIs that a future GenAI monitoring agent would consume.
- **Document the specific APIs, required IAM permissions, and query patterns during architecture phase.** An MCP server or LLM agent should be able to: query structured logs by user/action/time range, pull metric data for any dashboard widget, retrieve X-Ray traces for a specific request, and run the same CloudWatch Logs Insights queries that the admin CLI uses.
- **The admin CLI tooling doubles as the GenAI interface.** Each admin command is a Lambda function with a well-defined input/output contract. A future MCP server wraps these same Lambdas to give an LLM agent operational access. Build the CLI commands as invoke-able Lambda functions (not shell scripts) so they're equally accessible from a terminal, an API call, or an MCP tool.
- **Specific AWS APIs to document and architect for:**

| AWS API | Purpose | GenAI Use Case |
|---------|---------|----------------|
| CloudWatch Logs `StartQuery` / `GetQueryResults` | Query structured logs | "Show me what user X did yesterday" |
| CloudWatch `GetMetricData` | Pull metric time series | "What's the API error rate trend this week?" |
| CloudWatch `DescribeAlarms` / `GetAlarmHistory` | Check alarm states | "Are any alarms firing? What triggered the last alert?" |
| X-Ray `GetTraceSummaries` / `BatchGetTraces` | Retrieve request traces | "Trace this failed save request end-to-end" |
| X-Ray `GetServiceGraph` | Service dependency map | "Which services are experiencing latency?" |
| DynamoDB `DescribeTable` / CloudWatch metrics | Table health and capacity | "Is DynamoDB throttling? What's consumed vs. provisioned?" |
| Lambda `GetFunctionConfiguration` / CloudWatch metrics | Function health | "Which Lambda is erroring? What's the invocation trend?" |

- **IAM policy for observability agent:** define a read-only IAM role during architecture phase that grants access to all the above APIs but cannot modify any resources. This role is what a future GenAI monitoring agent would assume.

### Log Retention & Cost

- **Operational logs** (application structured logs): 30-day retention in CloudWatch Logs. Cost: ~$0.03/GB ingested. At boutique scale, this is negligible.
- **Audit/security logs** (API Gateway access logs, content layer mutation logs): 90-day retention. Slightly higher cost, still negligible at boutique scale.
- **CloudWatch Metrics:** automatically retained 15 months at standard resolution (free with CloudWatch).
- **X-Ray traces:** 30-day retention (default, free tier covers most boutique usage at 100K traces/month).
- **Estimated total observability cost at boutique scale: $10-20/month.** This includes CloudWatch Logs ingestion, custom metrics, X-Ray traces, and dashboard hosting. Not a meaningful cost line item — treat it as infrastructure, not a feature to optimize.

---

## Anti-Goals (What This Is NOT)

Explicit boundaries to prevent scope creep and keep the product focused:

- **Not a social network.** Saves are discoverable by default but there are no follows, feeds, likes, comments on other users' content, or social interaction in V1 or V2. The collective graph is a data layer for recommendations, not a social experience.
- **Not a content creation tool.** The platform captures and organizes content — it does not help you write blog posts, create videos, or generate content. (Exception: V2 may generate project suggestions and connection insights, but these are intelligence outputs, not content creation.)
- **Not a project management tool.** No Gantt charts, sprints, task assignments, kanban boards, or team collaboration features. Status tracking is simple (exploring → building → live → improving → archived), not PM-grade.
- **Not an LMS (Learning Management System).** No courses, certificates, grading, or structured learning paths. Tutorials are tracked by status, not by curriculum.
- **Not enterprise software.** No SSO federation, RBAC, org hierarchies, audit logs, or compliance features. Multi-user with per-user isolation, but boutique scale — not enterprise scale.
- **Not a search engine or aggregator.** The platform doesn't crawl the web, aggregate content, or compete with Google/Perplexity. Content enters the system only when a user explicitly saves it.

---

## V1 Success Metrics — How We Know V1 Worked

These metrics help determine when V1 is "gold" and it's time to start V2. They are not vanity metrics — they measure whether the core value proposition is working. **Build for scale, not for expected headcount.** The initial user base may be 1, 5, or 50 — the system should handle hockey-stick growth without re-architecture. Targets below are aspirational guideposts, not pass/fail thresholds. A product that works beautifully for 5 engaged users is a success; a product that falls over at 10 is a failure. Build the infrastructure for thousands, measure what matters at any scale.

**Adoption:**
- Active users (weekly) — aspirational target: 50+ within 3 months of launch. Actual may be much smaller. What matters: are the users who ARE active getting value?
- New signups per week — growth trajectory matters more than absolute numbers
- Mobile vs. desktop capture ratio — validates share sheet adoption

**Engagement (the fuel is flowing):**
- Saves per user per week — are people actually capturing content? Target: 3+ saves/week for active users
- Projects with 3+ linked saves — are users connecting fuel to projects, not just dumping saves?
- Tutorial completion rate — are users working through tutorials, not just saving them?
- Notes created per project — are projects being used as living notebooks?

**Retention (the value compounds):**
- Week 1 → Week 4 retention — do users come back after the first week?
- Users with 10+ saves — the value of fuel compounds; reaching 10+ saves suggests the user is invested
- Project creation rate — are users creating their OWN projects (not just the seeded ones)?

**Technical health:**
- Capture latency (share sheet to save confirmed) — must be < 2 seconds
- Search response time — must be < 1 second for V1 full-text
- API error rate — must be < 0.5%
- Search sync lag — must be < 5 minutes (alerted if exceeded)

---

## Open Architecture Decisions

Decisions surfaced during product brief elicitation that must be resolved during the Architecture phase. These are formally registered here to prevent them from getting lost between phases.

### ADR-1: Search/Discovery Store Technology Choice — OPEN

**Decision needed:** What technology backs the "search/discovery store" — the second data store for full-text (V1) and vector/semantic (V2) search?

**Options under consideration:**

| Option | Pros | Cons |
|--------|------|------|
| **PostgreSQL (RDS/Aurora Serverless v2)** | Full-text search via tsvector/tsquery, pgvector for V2 semantic search, JSON support, single engine for both needs, well-understood, strong ecosystem | Not truly serverless-to-zero (Aurora Serverless v2 has minimum ACU cost even idle), operational overhead vs. managed search services |
| **OpenSearch Serverless** | Managed, scales down, full-text + vector ready for V2, AWS-native | Expensive at rest, cold start latency, complex configuration |
| **Algolia / Typesense Cloud** | Best search UX out of the box, generous free tier | External dependency, may not support V2 vector needs, data egress costs |

**Constraints from product brief:**
- Must support full-text search including note content (V1)
- Must have a path to vector/semantic search (V2)
- Must be a separate failure domain from transactional store (DynamoDB)
- Cost is king — boutique scale, no VC funding
- "Reliable first, fast second" — search must be reliable above all

**Resolve during:** Architecture phase. This is, as stated in the brief, "the single biggest architecture decision."

### ADR-2: URL Normalization — Hash Algorithm & Key Design — DECIDED

**Decision:** SHA-256 hash of the normalized URL string serves as the content-layer partition key in DynamoDB. The full normalized URL is stored as an attribute (human-readable). A `normalization_version` field is stored alongside, enabling future re-normalization runs without breaking existing references.

**Normalization strategy:** Domain-specific normalizers for top 5 domains (YouTube: extract video ID, GitHub: owner/repo, Spotify: episode ID, Apple Podcasts: episode ID, general web: strip tracking params, lowercase, normalize protocol). Fallback: strip common tracking params (`utm_*`, `ref`, `fbclid`), lowercase host, normalize to HTTPS. Pragmatic, not perfect — accept edge-case duplicates, build merge/dedup tooling for later.

### ADR-3: Notes Storage — S3 Object Structure — DECIDED

**Decision:** Hybrid storage model. Notes under 50KB are stored inline in DynamoDB (covers ~90% of save notes and short project notes — fast, cheap, no S3 round-trip). Notes exceeding 50KB are stored in S3 as chunked objects (`{user-id}/notes/{entity-id}/chunk-001.json`, `chunk-002.json`, etc.). New content appends as new chunks (cheap write). Client loads max 400KB per request via paginated chunk fetching. DynamoDB holds metadata and S3 key pointers for large notes. Budget: up to 5GB of text content per user across all entities.

### ADR-4: Save Entity — Role Representation in DynamoDB — DECIDED

**Decision:** Boolean flags on the user-layer record (`is_resource: true/false`, `is_tutorial: true/false`). Sparse GSIs for efficient domain-view queries (e.g., "all my tutorials" uses a GSI that only includes items where `is_tutorial = true`). This is simple, queryable, and works well at boutique scale (hundreds to low thousands of users). Revisit if scale demands more efficient access patterns.

### ADR-5: Share Sheet Save Flow — Sync vs. Async Enrichment — DECIDED

**Decision:** Optimistic save with batch enrichment.

- **On share (synchronous, sub-second — "Trust" layer):** Save the URL immediately. Detect domain from URL string (no network call needed). Store with source type based on domain detection. Lightweight validation: URL format check, max length (2048), HTTPS-only scheme, reject embedded credentials. Return confirmation to user instantly.
- **Enrichment (asynchronous, batched hourly — "Verify" layer):** A scheduled job runs every hour. If there are unenriched URLs, it processes them all in a single invocation (one job with N URLs, not N separate jobs). Fetches page metadata (title, description, Open Graph tags), extracts type-appropriate metadata (podcast show name, YouTube channel, etc.), updates content-layer records. **Security responsibility:** the enrichment batch is also the deeper inspection pass — sanitize all fetched metadata (strip HTML, validate UTF-8, truncate), run URL normalization safety checks (homograph detection, known-bad patterns), and flag URLs that fail enrichment for potential review. One Lambda invocation per hour max — cheap and predictable. Lambda runs with SSRF protections (deny-list for private IPs and cloud metadata endpoints).
- **User experience:** User sees the URL with a domain icon immediately. Full metadata (title, description) populates within ~1 hour. Save 5 things on the morning commute, metadata is ready by the time you check at lunch. By the time you sit down at the desktop to organize, everything is enriched.
- **Failure handling:** If enrichment fails for a URL, it stays saved with just the domain and raw URL. User can manually edit metadata. Never lose a save because enrichment failed.

### ADR-6: Invite System — Implementation Strategy — DECIDED

**Decision:** Existing-user-generated invite codes. Each user gets 10 invite codes they can share. Codes are single-use. No referral chain tracking in V1 — the system records which code was used but does not build invite trees or analytics. Referral chain tracking and invite analytics are flagged as **future/nice-to-have** for a later version (useful for understanding organic growth patterns). Implementation: simple DynamoDB table of invite codes with `generated_by`, `used_by`, `used_at` fields. **Security hardening:** codes must be cryptographically random, minimum 12 characters alphanumeric (not sequential, not predictable). Rate limit signup endpoint (max 5 attempts per IP per hour). Generic error on invalid code (don't reveal whether code exists vs. already used). Clerk/Auth0 bot detection on signup flow.

**Bootstrap:** The admin (Stephen) seeds the first batch of user accounts directly — either by creating accounts in Clerk/Auth0 and generating the initial invite codes manually, or by having a simple admin script that creates seed codes without an existing user. These first users then generate their own codes and the invite chain begins organically.

### ADR-7: Mobile Platform Strategy — PWA First, Native Later — DECIDED

**Decision:** V1 ships as a Progressive Web App (PWA) with home screen shortcut. Native iOS app ships in V2.5. Native Android app ships in V3.5.

**Rationale:** Solo builder, cost is king. PWA leverages the existing React stack with zero app store overhead. Android gets a strong mobile experience via PWA (share target API, install prompts, push notifications). iOS PWA is more limited (no native share extension, no background sync), but acceptable for V1 — the native iOS app in V2.5 resolves these gaps and arrives with V2's intelligence layer. Android native is lowest priority because PWA already delivers well on Android; V3.5 timing aligns with community features.

**Trade-off accepted:** iOS capture requires one-time Shortcut setup (install Shortcut + enter API key). Once set up, it's 2 taps — same as Android. The setup friction is the cost of not having a native app; V2.5 eliminates it.

**Impact on V1 scope:** "Share sheet integration (MVP-required)" is delivered via PWA share target API on Android and iOS Shortcut on iOS. The "2 taps max" aspiration is met on both platforms. V1 must deliver: (1) a downloadable iOS Shortcut, (2) an API key generation flow in account settings, (3) onboarding docs/walkthrough for Shortcut installation.
