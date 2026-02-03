---
stepsCompleted: [1, 2, 3, 4, 5]
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

An API-first, multi-user platform with per-user data isolation and auth, built on a unified save entity with three domain views — Resource Library, Tutorial Tracker, and My Projects. A URL is saved once per user and can serve as a resource, a tutorial, or both. These three "domains" are views into the same underlying data, not separate storage. Projects are the center of gravity and living notebooks: they store not just metadata and linked saves but also LLM conversation outputs (copy-pasted from Claude, ChatGPT, Gemini, etc.) — the actual thinking and iteration that happens during a build. This captures the builder's reasoning process, not just their sources. Resources and tutorials are the fuel: they can exist independently and link to projects when the time is right; unattached items are first-class, not orphans. Near-zero friction mobile capture via share sheet integration (MVP-required, two taps max) — the fuel harvesting must be effortless from day one. Desktop experience for connecting, exploring, and building — with equal UX priority to mobile capture. Manual linking is inline and contextual — not a separate workflow but surfaced where you're already working (e.g., viewing a project shows recent saves you can link with a tap). No flow is forced — a user can create a project first, start a tutorial first, or save a resource first. LLM-discovered connections (future) add a second layer that finds patterns the builder didn't see. V1 harvests the fuel; the LLM lights the engine. The two-layer data model (global content layer + per-user layer) means saves are deduplicated across users, enabling a collective learning graph and real network effects in V2. Two interaction surfaces: the web/mobile UI serves non-developer builders (V1's primary surface), while the API serves developers, agent builders, and V2's intelligence layer. Users who prefer programmatic interaction — custom clients, MCP servers, agentic workflows — use the API directly and may never touch the web UI. Both surfaces are first-class. Published learning trails for other builders are the tertiary audience (V3).

### Key Differentiators

**V1 Differentiators (shipped in the foundation):**

1. **Project-centric, builder-first** — Projects are the atom AND living notebooks: they store links, metadata, notes, and LLM conversation outputs (the actual thinking and iteration from Claude/ChatGPT/Gemini sessions). Resources and tutorials orbit them. Unattached items are welcome — they connect when the time is right, not when the system demands it
2. **Saves are fuel, building is the product** — Resources, tutorials, and content captures are not the point — they are the substrate. The product is enabling builders to act on what they're learning. The value of fuel compounds over time — the 50th save is more valuable than the 1st because the graph of connections is richer
3. **Multi-modal content, one system** — 10+ source types with type-appropriate metadata, all in one place. A single unified save entity with three domain views (Resource Library, Tutorial Tracker, My Projects) — no duplication
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
- **Three domain views, one unified data model** — Resource Library, Tutorial Tracker, and My Projects are views into the same save entity, not separate storage. A URL is saved once per user and can serve as a resource, tutorial, or both. Projects are at the center. (Resolved: "Project" is the entity name across API and UI. Research across 30+ products — no-code platforms, AI builders, learning platforms, creative tools — shows "project" is the universal term mixed audiences converge on. "Build" as a noun has zero market validation and collides with CI/CD terminology for developers. The verb "build" is used liberally in UX copy ("What are you building?", "Start building") while the noun remains "project." The domain view label is "My Projects" — warmer and more personal than "Project Tracker" while keeping the universally understood noun.)
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

- **Auto-associate saves to projects:** "Your project is about RAG pipelines — here are tutorials, podcasts, and blog posts from the collective graph that are relevant to what you're building." The platform looks at a user's open projects and proactively surfaces their own unlinked saves — and content from other users — that match. Saves that sat unlinked for weeks get surfaced when the user starts a relevant project.
- **Auto-suggest projects from saves:** "You saved 3 things about autonomous agents this week — here's a project idea based on what you're learning." The platform analyzes a user's recent save patterns and proactively suggests what they could build. This is the resource→project direction — saves generate project ideas, not just the reverse.
- **Cross-user content discovery:** "Another builder working on something similar found this podcast useful — you might too." The platform surfaces relevant content that a user has never seen, sourced from other users' saves. This is not "popular content" — it's "content relevant to what YOU are building and learning about." A niche podcast saved by one user gets surfaced to another user whose projects and saves indicate a topical match. The collective graph's power scales with users because the topic coverage gets broader and the relevance matching gets tighter.

**How V2 intelligence works — the pipeline:**
1. **V1 lays the foundation:** Every save gets batch-enriched with metadata (title, description, source type, domain, type-specific metadata). Users add tags, notes, and project links manually. All of this is stored and indexed in V1.
2. **V2 adds semantic understanding:** V2 runs agentic AI enrichment on the V1 metadata substrate — topic extraction, content summarization, relationship mapping, and vector embeddings. This transforms flat metadata into a semantic graph where the platform *understands* what content is about, not just what it's tagged.
3. **V2 matches across users:** The enriched metadata + embeddings enable semantic matching across the collective graph. User A's saves about "fine-tuning embedding models" match User B's project about "building a custom RAG pipeline" — not because they used the same tags, but because the enriched metadata reveals topical relevance. The two-layer data model (content layer + user layer) makes this possible: the content layer knows every URL and its enriched metadata globally, the user layer knows each user's projects, saves, notes, and context. V2 joins them.
4. **V2 delivers recommendations:** The three capabilities above (auto-associate, auto-suggest projects, cross-user discovery) all consume this same enriched semantic graph. The richer the metadata (from V1 batch enrichment + V2 AI enrichment + user-contributed tags/notes), the better the recommendations.

**Notes are fuel for the LLM, not just for the user — but raw notes are a data quality risk.** V1 captures notes because they're useful to the builder: paste a Claude conversation, jot down what you learned, save your reasoning. V1 stores this raw text as-is with no AI processing. This is deliberate — V1 is manual and gold, no AI in the capture path.

However, raw copy-pasted LLM conversations are noisy — false starts, corrections, tangents, repetition, formatting artifacts. **V2 cannot feed raw notes directly into the recommendation engine.** Doing so creates a garbage-in/garbage-out risk where messy, unstructured text degrades the quality of AI-generated recommendations and insights.

**V2 requires two distinct AI processes for notes:**

1. **Notes Ingestion AI (V2 — data quality layer):** A dedicated AI process that reads raw notes and produces structured, curated summaries. This process formats, cleans, extracts key concepts, and distills the raw text into high-quality signal. The output is a structured summary stored alongside the original raw text (never replacing it). This is its own AI pipeline with its own quality bar — it must handle messy paste, partial conversations, mixed formats, and non-English content gracefully. Failed or low-confidence ingestion is flagged, not silently passed through.

2. **Recommendation AI (V2 — intelligence layer):** The recommendation engine (auto-associate, auto-suggest projects, cross-user discovery) consumes the curated summaries from Process 1 — never the raw notes directly. This separation ensures the intelligence layer operates on clean, structured input. The curated summaries also feed the user's semantic profile: what they care about, how they think, where they're stuck.

**V1's job:** Capture everything. Store it raw. Make it useful to the human (search, display, Markdown rendering). Budget: 1.5 GB of text per user across all projects — generous for legitimate use, bounded enough to prevent abuse.

**V2's job:** Make it useful to the AI. The Notes Ingestion AI transforms raw text into structured signal. The Recommendation AI consumes that signal. Two processes, clear separation, no GIGO.

**The collective graph is a relevance engine, not a popularity engine.** It doesn't surface popular content; it surfaces *relevant* content. The more users contribute fuel, the tighter the relevance matching becomes — not because there are more saves of the same thing, but because the topic graph gets richer and the connections get more specific. The specific technology choices (Claude, Nova, prompts, tools, MCP server) are V2 decisions — not V1 distractions.

### How the System Works (End to End)

The full pipeline from save to intelligence, across V1 and V2:

| Step | What Happens | Version |
|------|-------------|---------|
| **1. User saves a link** | User shares a URL from any app (podcast, YouTube, blog, subreddit, etc.) via share sheet or web UI. No project association required — the save stands on its own as a first-class citizen. | V1 |
| **2. Async enrichment creates structured metadata** | A batch job (hourly Lambda) fetches the URL and extracts metadata: title, description, Open Graph tags, source type, type-specific fields (podcast show name, YouTube channel, etc.). The user doesn't wait — save is fire-and-forget. | V1 |
| **3. Metadata enables semantic understanding** | The enriched metadata — combined with user-contributed tags, notes, and project context — creates a structured representation of what each piece of content is about. V1 uses this for search and filtering. V2 adds vector embeddings and topic extraction on top. | V1 foundation, V2 deepens |
| **4. User has an active project → auto-link** | V2's intelligence layer compares the enriched metadata of a user's unlinked saves against their active projects. When relevance is high, the system suggests linking: "This tutorial you saved last week is relevant to your RAG Pipeline project." Saves that sat unlinked for weeks get surfaced when the user starts a matching project. | V2 |
| **5. User has no project → save becomes discovery input** | Unlinked saves aren't idle — they accumulate as signal about what the user is interested in and learning about. V2 treats these as discovery inputs that reveal emerging interests and patterns. | V2 |
| **6. Discovery inputs cluster → system proposes projects** | V2 analyzes a user's recent saves and detects patterns: "You saved 3 things about autonomous agents this week and 2 about tool-use patterns — here's a project idea: Build an Agent Orchestration System." Saves generate project ideas, not just the reverse. | V2 |
| **7. Cross-user matching via enriched metadata** | V2 compares enriched save metadata + project metadata across users via the collective graph. User A's saves about fine-tuning embeddings match User B's project about custom RAG — not because they used the same tags, but because the enriched semantic metadata reveals topical relevance. The two-layer data model (global content layer + per-user layer) enables this join. | V2 |
| **8. System surfaces relevant unseen resources** | From the cross-user match, V2 surfaces content the user has never seen: "A builder working on something similar found this podcast useful — you might too." This is the collective graph's core value — relevance, not popularity. A niche resource saved by one user reaches another user whose context indicates a match. | V2 |
| **9. System proposes enhancements to existing projects** | V2 looks at a user's active projects and finds opportunities: "Your existing project could benefit from this technique covered in a tutorial another user saved" or "This new tool release is relevant to your current build." Enhancement suggestions keep active projects growing. | V2 |

**The V1→V2 handoff:** Steps 1-3 are V1's job — capture and enrich. Steps 4-9 are V2's job — understand and connect. V1 must execute steps 1-3 flawlessly because every V2 capability depends on the quality and completeness of the metadata foundation. If V1 enrichment is broken, V2 intelligence is blind.

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
- Status — `exploring` | `building` | `live` | `improving` | `archived` (Resolved: Status labels use non-developer language per "Write for the marketer" UX principle. "deployed" → "live", "investigating/planning" → "exploring", "updating/enhancing" → "improving". These labels work for Maya's GPT automation and Marcus's RAG pipeline equally.)
- Linked saves — links to user-layer save records (resources, tutorials, or both)
- Notes — rich text field for manual notes AND LLM conversation outputs. This is the project's living notebook — the builder's reasoning process and iteration history. **Storage: S3 with DynamoDB pointers.** Notes can grow large (LLM conversations are lengthy); budget up to 1.5 GB of text per user across all projects. Client loads max 400KB at a time (paginated/lazy loading). DynamoDB holds metadata and S3 keys only — never the full note content. **Notes input format: Markdown-first.** The notes field accepts and renders Markdown. This is a deliberate choice because LLM outputs are naturally Markdown-formatted — the friction reduction strategy for capturing LLM conversations is progressive:
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

**A URL is saved once per user.** That single save can serve as a resource, a tutorial, or both — and can be linked to any number of projects. No duplication. The three "domains" (Resource Library, Tutorial Tracker, My Projects) are **views** into the same underlying data, not separate storage.

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
- **My Projects view** = projects with their linked saves (both resources and tutorials)

A save starts as whatever the user intends (resource or tutorial). They can later toggle it to be both. The URL exists once in the content layer regardless.

**Saves are independent by default.** A save does not require a project association. Users can save content freely — from the share sheet on a commute, from a browser on desktop — with zero obligation to link it to anything. Unlinked saves are first-class citizens, not orphans. They appear in the Resource Library and Tutorial Tracker views immediately. Users link saves to projects when they're ready — or never. V2's intelligence layer will suggest connections, but V1 linking is always manual and always optional. The data model enforces this: `linked_projects` on a user-layer save record is an empty list by default, not a required field.

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
- **S3** — blob store for project notes, save notes (rich text, LLM conversation outputs), and user-uploaded images. Cheap, scalable, pay-per-use. Budget: up to 1.5 GB of text content per user
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
- **UX Principle: "Simple to navigate, powerful to use."** The default experience uses accessible, non-technical language and navigation. But the workspace inside — project notebooks, notes fields, Markdown rendering, search — is deep and capable. You shouldn't need a tutorial to find things. You should be surprised by how much you can do once you're inside a project. This resolves the tension between Maya (needs simplicity) and Marcus (needs power): the wrapper is simple, the interior is powerful. Layered complexity, not dumbed-down uniformity.
- **UX Principle: "Write for the marketer, not the engineer."** All user-facing language — UI labels, status names, feature descriptions, onboarding copy, error messages, docs — must be written for the non-developer builder. Developer-brained terminology is a product failure. Resolved terminology decisions: "deployed" → "live", "investigating/planning" → "exploring", "updating/enhancing" → "improving", "LLM conversation outputs" → "AI chat history", "reasoning process" → "how I figured it out", "Project Tracker" → "My Projects". The verb "build" is the platform's native voice — used liberally in UX copy ("What are you building?", "Start building", "Your latest build") — while the noun "project" remains the entity name (universally understood, zero onboarding friction, validated across 30+ products serving mixed audiences). This is a tone-of-voice decision that applies to the entire product surface, not just individual labels. The UX designer must own this as a core principle.

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
- **Notes abuse monitoring** — the 1.5GB-per-user budget is generous. Monitor for abuse patterns: rapid bulk writes, Base64-encoded binary data in Markdown, or usage patterns that suggest the notes field is being used as a free file host rather than a notebook. Alerting, not blocking — flag for review.

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

## Product Analytics & Dashboards (Cross-Cutting Concern)

Product analytics is a V1 requirement with equal priority to operational observability. Operational monitoring answers "is the system running?" Product analytics answers "is the product *working*?" A platform with 100% uptime and zero engaged users is a perfectly operated failure. Product analytics catches that.

**Design principle: APIs first, dashboards are clients.** Every metric, chart, and table is backed by an API endpoint that returns structured JSON. The analytics web UI is a visual consumer of these APIs. This architecture ensures the same data is accessible via dashboards (visual review), admin CLI (quick queries), and future GenAI agents (automated analysis).

### Analytics Web UI — V1 Required

A dedicated, authenticated web interface for product analytics at a bookmarkable URL (e.g., `analytics.ailearninghub.com` or `/admin/analytics` route). Internal-only, accessible to admin accounts. Built with the same React/Vite stack. Functional styling — this is a workbench, not a showcase.

**Five dashboard views:**

**1. Adoption Dashboard — "Are people showing up?"**
- Signup velocity — signups per week, trend line
- Invite funnel — codes generated → codes redeemed → signups completed (conversion rates at each step)
- First-session source — mobile vs. desktop, share sheet vs. direct
- Time to signup — invite received to account created

**2. Engagement Dashboard — "Are people getting value?"**
- Saves per user per week — distribution histogram + trend
- Project creation rate — user-created (not seeded) per week
- Connection depth — projects with 0, 1-2, 3-5, 6+ linked saves (distribution)
- Notes activity — projects with notes vs. without, notes created per week
- Tutorial pipeline — saved → started → completed → archived (funnel)
- Platform mix — mobile vs. desktop saves, API vs. web UI saves
- Content mix — saves by source type (podcast, YouTube, blog, etc.), top domains

**3. Retention Dashboard — "Are people coming back?"**
- Cohort retention curves — W1 → W2 → W4 → W8 → W12 (the most important chart)
- DAU/WAU ratio trend
- Threshold crossings — users reaching 10+ saves, 3+ projects, first note
- Seeded project engagement — engaged vs. archived vs. ignored

**4. Churn & Risk Dashboard — "Are people leaving, and why?"**
- At-risk users — no activity in 14+ days, with last action and previous engagement level
- Save velocity declines — users whose weekly saves dropped >50% from their average
- Abandoned projects — created 30+ days ago with no updates
- Stuck tutorials — "started" for 30+ days with no progress
- Last action before churn — aggregate pattern

**5. Persona Health Dashboard — "Is the product working for each audience?"**
- Per-segment metrics — engagement, retention, and funnel metrics broken out by inferred persona type
- Segment distribution — what percentage of users fall into each persona bucket?
- Cross-segment comparison — which persona retains best? Converts fastest? Generates most invites?
- Segment-level funnel — where does each persona type drop off?

### Analytics API — V1 Required

Every dashboard widget is backed by a REST API endpoint returning structured JSON. The APIs are the product; the dashboards are one consumer.

**Endpoint structure:**
- `GET /admin/analytics/adoption/signups` — signup velocity
- `GET /admin/analytics/adoption/invite-funnel` — invite conversion funnel
- `GET /admin/analytics/engagement/saves` — save activity (supports group_by, period, segment params)
- `GET /admin/analytics/engagement/connections` — project-save link depth
- `GET /admin/analytics/engagement/content-mix` — source type distribution
- `GET /admin/analytics/retention/cohort` — cohort retention curves
- `GET /admin/analytics/retention/thresholds` — threshold crossing rates
- `GET /admin/analytics/churn/at-risk` — users showing churn signals
- `GET /admin/analytics/churn/velocity-decline` — save velocity drops
- `GET /admin/analytics/funnel` — conversion between any two funnel stages
- `GET /admin/analytics/personas/health` — per-segment metrics
- `GET /admin/analytics/personas/comparison` — cross-segment analysis

**API design principles:**
- All endpoints return structured JSON — directly consumable by chart library OR by LLM
- All endpoints paginated where relevant
- All endpoints accept time range parameters (`period`, `weeks`, `from_date`, `to_date`)
- All endpoints support persona segment filtering (`?segment=<type>`)
- Admin-only authentication — not exposed to regular users
- Lambda-backed — same serverless architecture as the platform

**Admin CLI analytics commands** (wrap the same API endpoints):
- `admin:analytics:retention [--cohort <signup_week>] [--weeks <n>]`
- `admin:analytics:engagement [--user <user_id>] [--segment <persona_type>]`
- `admin:analytics:funnel [--from <step>] [--to <step>]`
- `admin:analytics:churn-risk [--threshold <days>]`
- `admin:analytics:growth` — invite generation, redemption, chain depth
- `admin:analytics:content-mix` — source type distribution, top domains
- `admin:analytics:personas [--compare] [--segment <type>]`
- `admin:analytics:report` — generates the full weekly summary

### Persona Segmentation — Behavioral Heuristics

User persona type is inferred from behavior, not self-reported. Lightweight heuristics for V1 using two signal layers — **behavioral signals** (how they use the platform) and **content signals** (what they save):

- **Marcus-type (Infrastructure Builder):** Desktop-heavy OR notes-heavy OR saves from technical domains (github.com, arxiv.org, medium.com engineering blogs, conference talk sites). Content signal is the key differentiator — Marcus on mobile looks like Maya by device, but his saved content reveals a different persona.
- **Maya-type (Lean-In Professional):** Mobile-heavy, tutorial-driven, non-technical domains (youtube.com, podcast apps, linkedin.com), no API calls. Projects focused on automations and workflows.
- **Priya-type (Curious Explorer):** Low frequency (<2 saves/week), mobile-only, no projects created beyond seeded, no tutorials completed. Save-heavy but project-light.
- **Dev-type (API Builder):** Any API/MCP activity outside the web UI. This is binary — if they're making programmatic API calls, they're a Dev-type regardless of other signals.

These are approximations, not identities. A user may shift between types over time (Priya becoming a Maya is the aspiring-builder arc in action). The heuristics enable per-segment analysis, not per-user labeling. Content domain signal (what URLs they save) is a stronger persona indicator than device signal (what device they save from) — prioritize content signal when behavioral signals are ambiguous.

**Additional UX consideration:** Project views should be screenshot-friendly. In V1, Maya's primary "sharing" mechanism is a screenshot to Slack or her manager. The project page should look good in a screenshot — clean layout, readable at reduced resolution, key information visible without scrolling. Zero-cost design consideration.

### V1 vs. V2 Scope

- **V1:** Analytics APIs (Lambda-backed), Analytics Web UI (5 dashboards), Admin CLI analytics commands, persona segmentation heuristics, activity event tracking in structured logs
- **V2:** LLM agent consuming analytics APIs via MCP tools for automated weekly reports, anomaly detection, trend analysis, and persona insights

### Three Access Paths, One Data Layer

| Consumer | Interface | Use Case | Version |
|----------|-----------|----------|---------|
| Stefania (browser) | Analytics Web UI dashboards | Visual weekly review, drill-down investigation | V1 |
| Stefania (terminal) | Admin CLI commands | Quick queries, scripted reports | V1 |
| GenAI agent | Analytics API via MCP tools | Autonomous weekly reports, anomaly detection | V2 |

---

## Target Users — Personas

Six personas define who AI Learning Hub serves and how they interact with the platform. Four user personas (3 full, 1 light sketch), two operator personas.

### Persona Summary

| # | Type | Name | Archetype | Tech Level | Primary Surface | V1 Priority | V2 Priority |
|---|------|------|-----------|------------|-----------------|-------------|-------------|
| 2 | User | Marcus Rivera | Infrastructure Builder | Low-code | Desktop + Mobile | **#1** | #2 |
| 5 | Operator | Stephen | Solo Platform Operator | Full-stack | CDK, CLI, CloudWatch | **#2** | #3 |
| 1 | User | Maya Chen | Lean-In Professional | No-code | Mobile + Web UI | **#3** | #3 |
| 3 | User | Priya Kapoor | Curious Explorer | Non-technical | Mobile-only | #4 | #4 |
| 6 | Operator | Stefania | Business Analyst | N/A | Analytics dashboards, CLI, APIs | #5 | #5 |
| 4 | User (light) | Dev Okafor | API Builder | Developer | API/MCP only | #6 | **#1** |

**V1 priority stack rank rationale:**
- **Marcus (#1):** The truest user — most like the builder OF the platform. If the product doesn't work for Marcus, it doesn't work. UX simplification flows downhill: what works for a low-code infrastructure builder works for a no-code marketer if the language is right.
- **Stephen (#2):** Operational excellence is a prerequisite, not a feature. Can't serve Marcus if the platform is down and you can't diagnose why.
- **Maya (#3):** Validates the UX is accessible to non-developers. Benefits from everything built for Marcus.
- **Priya (#4):** Welcome but not catered to. Validates onboarding. Product doesn't bend to her needs.
- **Stefania (#5):** Product health analytics. Important but less urgent than core user experience.
- **Dev (#6 for V1 product, but APIs are #1 for V1 architecture):** Dev doesn't touch the UI — his persona priority is low for V1 product. But the APIs he depends on are the #1 architecture priority because V2 REQUIRES them and in V2, Dev becomes the #1 persona. API completeness is a V1 architecture requirement, not a V1 persona requirement.

**V2 persona priority shift:** Dev rises to #1 in V2. The intelligence layer is consumed via API/MCP. Dev's agents become the most sophisticated consumers of V2's capabilities. The V1 API investment pays off here — V2 builds USING the API, not trying to build the API.

**Design principle: "When in doubt, optimize for Marcus."** This resolves UX debates in V1. Marcus is the primary design target. Maya validates accessibility. Priya validates onboarding.

**Onboarding is builder-first.** Seeded projects assume you're here to build — not to browse. The copy, project names, and language are written for someone who already has a project idea (even a vague one), not someone who's exploring. Priya still benefits (seeing a real build is more inspiring than "Welcome!"), but the tone is builder-first.

---

### Persona 1: Maya Chen — "The Lean-In Professional" (No-Code Builder)

**Who she is:**
Maya is a 34-year-old marketing operations manager at a mid-size B2B SaaS company. She's been in marketing for 10 years — started in content, moved into ops, and now manages the team's tech stack and campaign automation. She's not a developer and has never written code, but she's the person on her team who figures out how tools work. When the company adopted HubSpot, she was the one who built the workflows. When Notion replaced their wiki, she set it up.

**Where she is with AI:**
Maya started paying attention to AI about 18 months ago when her CEO started asking "what are we doing with AI?" She's been exploring on her own time — listening to AI podcasts on her commute, watching YouTube tutorials on weekends, building custom GPTs for personal use. She's built a few things she's genuinely proud of: a GPT that drafts competitive analysis reports from web research, an automation that generates weekly performance summaries from a spreadsheet, and a prototype that creates customer call prep decks.

None of these touch real company data — company policy restricts AI use on proprietary information. So she builds sandbox versions and example use cases to prove concepts and develop her skills. She's becoming the informal "AI person" on her team — the one who demos tools at team meetings and shares interesting articles in Slack. She wants to formalize this expertise but doesn't know how to show what she knows (she doesn't have a GitHub profile).

**How she experiences the problem:**
- She discovers AI content everywhere — podcasts during her commute, YouTube videos someone shares on LinkedIn, a tool mentioned in a Slack thread — and has no single place to put it all. Some things are in browser bookmarks, some in Apple Notes, some in a Notion page she started and abandoned.
- She's done 4-5 tutorials but can't remember which ones or where she found them. She rediscovered the same "Build a Custom GPT" tutorial twice.
- Her project ideas live across 3 different ChatGPT conversations, 2 Claude conversations, and a Notes app file. The thinking and iteration she did in those conversations is scattered and mostly lost.
- When her VP asks "what have you been learning about AI?", she can't point to anything coherent.

**What success looks like:**
Maya opens AI Learning Hub on her phone during her commute, saves a podcast episode someone mentioned in 2 taps, and moves on with her day. On Saturday morning with coffee, she opens the desktop app and sees her 8 saves from the week neatly organized. She links 3 of them to her "Automated Competitive Analysis" project, pastes in her latest Claude conversation about improving the prompt chain, and marks a tutorial as completed. When her VP asks what she's been doing with AI, she has a living record of everything — and in V3, she publishes it as a learning trail that becomes her AI portfolio for her next performance review.

**Platform relationship:**
- **Primary surface:** Mobile capture (commute, between meetings), Web UI desktop (Saturday build sessions)
- **V2 value:** "Based on your competitive analysis project, here's a tutorial on structured output parsing that would improve your report quality" — she didn't know she needed it, but it's exactly right
- **V3 value:** Medium. She'd share her learning trail internally with her team, maybe on LinkedIn. It's her proof of capability in a world where she has no code to show.

---

### Persona 2: Marcus Rivera — "The Infrastructure Builder" (Low-Code, Solutions Architect Path)

**Who he is:**
Marcus is a 41-year-old cloud infrastructure engineer at a large financial services firm. He's been in IT for 18 years — started on help desks, moved through network engineering, and spent the last 8 years in cloud infrastructure (AWS, Azure). He holds AWS Solutions Architect Professional and several other certs. He's the person who designs how systems run, not the person who writes the application code that runs on them. He can read Python and JavaScript well enough to review a PR or debug a deployment script, he writes Terraform and CloudFormation daily, and he's comfortable in a terminal — but he doesn't build applications from scratch.

**Where he is with AI:**
Marcus sees the industry shifting under his feet. His company is standing up an "AI Center of Excellence" and he wants to be in the room, not watching from outside. He's been spending evenings and weekends going deep — not surface-level "what is AI" content, but the architectural questions: How do you build a RAG pipeline that actually works at scale? When does GraphRAG make sense vs. vanilla RAG? How do you deploy LLM-powered services serverlessly? What are the real tradeoffs of multi-model routers? How do MCP servers work and when should you build one?

He's built several projects already: a RAG pipeline over internal documentation (sanitized, personal copy), an agent workflow that monitors AWS cost anomalies and suggests optimizations, and a multi-model router that sends different query types to different LLMs. He's exploring agentic use cases — not toy demos but architecture-level experiments about how agents should be orchestrated, monitored, and constrained in production.

His career goal is clear: he wants to be a GenAI Solutions Architect. Someone who sits at the intersection of cloud infrastructure and AI systems — who can make informed architecture decisions about AI deployments, evaluate vendor claims, and design systems that are reliable, cost-effective, and secure. He doesn't need to write the application code; he needs to understand the sharp edges well enough to architect around them.

**How he experiences the problem:**
- He's deep in technical content — architecture blogs, conference talks, GitHub repos, podcasts about MLOps and AI infrastructure. He has 200+ browser bookmarks with no organization. Half the links are dead or he can't remember why he saved them.
- His projects are documented across scattered Notion pages, a personal GitHub repo with READMEs he never updates, and dozens of Claude and ChatGPT conversations where he worked through architecture decisions. The conversations are where the real thinking happened — "should I use a vector DB or a graph DB for this?" — and they're basically lost after a few weeks.
- He reads something about a new embedding model and thinks "that would fix the retrieval problem in my RAG project" — but by the time he sits down to work on it, he can't find the article or remember which project it was relevant to.
- He's done 10+ tutorials but has no record of which ones, what he learned, or which are worth recommending to colleagues who ask "how do I get started with RAG?"
- When he interviews for GenAI SA roles, he struggles to articulate the breadth of what he's explored. He has no portfolio — his work is experiments and architecture decisions, not deployed applications with URLs.

**What success looks like:**
Marcus saves a deep-dive blog post about GraphRAG tradeoffs from his phone during lunch. That evening at his desk, he opens AI Learning Hub, links it to his "Knowledge Graph RAG Experiment" project, and pastes in the Claude conversation where he worked through whether GraphRAG was right for his use case. His project is a living notebook — not just "what I built" but "why I made these decisions, what I tried, what failed, and what I learned."

In V2, the platform tells him "3 users who built similar RAG projects found this tutorial on hybrid retrieval strategies useful" — not because it's popular, but because it's *relevant* to his specific architecture challenge. In V3, he publishes his learning trail for the RAG project: the 15 resources that informed his decisions, the 4 tutorials he completed, the architecture notes and LLM conversations that capture his reasoning. When he interviews for a GenAI SA role, he shares the link. It's his portfolio — proof of depth, judgment, and learning velocity that no cert or GitHub repo could show.

**Platform relationship:**
- **Primary surface:** Desktop for building and organizing (heavy notes, heavy project work). Mobile for saving articles, podcasts, and conference talk links throughout the day.
- **V2 value:** The relevance engine is transformative for him — he's working on niche, specific architecture problems and generic "trending in AI" content is useless. He needs signal that's matched to *his* projects and *his* skill level.
- **V3 value:** **High.** Published learning trails are his career differentiator. The non-code portfolio for a non-developer technical leader. This is how he proves he's a GenAI SA, not just a cloud engineer who read some articles.

---

### Persona 3: Priya Kapoor — "The Curious Explorer" (Passive Learner / Aspiring Builder)

**Who she is:**
Priya is a 29-year-old HR business partner at a healthcare company. She has zero technical background — her degree is in organizational psychology, her career has been in people ops and talent management. She's never written a line of code, never configured a tool beyond what the vendor's setup wizard offered, and has no interest in becoming technical. She's good at her job and plans to stay in HR.

**Where she is with AI:**
Priya keeps hearing about AI from every direction — her CEO's all-hands mentions it quarterly, LinkedIn is full of "AI will replace your job" posts, her friends talk about ChatGPT at dinner. She's used ChatGPT a handful of times (rewriting emails, brainstorming interview questions) but she doesn't think of herself as "building" anything. She's mostly curious and a little anxious — she doesn't want to be the person who gets caught flat-footed when AI changes her industry.

She heard a colleague mention a podcast — "something called Latent Space? or was it Lenny's Podcast talking about AI?" — and she wants to find it. She saw someone on LinkedIn recommend a YouTube channel about AI for non-technical people and saved the post but can't find it now. A friend told her about "Claude" and she's not sure if that's a person, a company, or an app. She's in the "what is all this and where do I start?" phase.

She's not opposed to building something someday — she's vaguely aware that people create "custom GPTs" and she thinks an AI assistant for screening resumes could be useful. But that's a distant maybe, not a current project. She's primarily here to discover, listen, read, and save things for later.

**How she experiences the problem:**
- She hears about AI content through conversations and social media, not through technical channels. The recommendations come with no context — just a name dropped in passing.
- When she tries to find what someone mentioned, she's lost. Google returns 10 different things for "AI podcast" and she doesn't know which one was recommended. She bookmarks things but never goes back to her bookmarks.
- She's tried subscribing to a few AI newsletters but they're either too technical (she doesn't know what "fine-tuning" means) or too hype-driven (just ads for AI tools). She can't find the signal.
- She has no system. Interesting things float past her and disappear. Three months later, she's no more informed than she was, despite genuine curiosity.

**What success looks like:**
Priya hears a colleague mention an AI podcast at lunch. She pulls out her phone, opens AI Learning Hub, and saves the podcast in 2 taps. Later that week, she browses her saved resources and sees she's accumulated 6 things about "AI in HR." The seeded starter project "AI for Your Day Job" has links to beginner-friendly tutorials. She watches one — a 20-minute YouTube video about building a custom GPT — and thinks "wait, I could actually do this." She marks it as a tutorial, starts it, and eventually completes it. Six months later, she has 40 saved resources, 3 completed tutorials, and her first project: a custom GPT that helps her draft job descriptions. She didn't plan to become a builder, but the platform made the leap small enough that it happened naturally.

In V2, the platform notices her HR + AI content pattern and surfaces relevant beginner resources she wouldn't have found on her own. She never feels pushed — just gently enabled.

**Platform relationship:**
- **Primary surface:** Almost entirely mobile. Saves from share sheet during the day. Occasionally browses on desktop, but rarely organizes deeply.
- **Capture behavior:** Sporadic — 1-2 saves per week, driven by social moments (someone mentions something). Not a daily user.
- **V2 value:** Curated discovery for her level and interests. The platform knows she's HR-focused and beginner-level — it doesn't surface RAG architecture content.
- **V3 value:** Low as publisher. But she might browse OTHER people's published trails — "How an HR Manager Built an AI Resume Screener" would pull her in.
- **The aspiring builder arc:** Priya represents the secondary audience's best case — she arrives as a passive consumer and the platform's design (seeded projects, beginner tutorials, zero-friction capture) gradually enables the transition to builder. Some Priyas will make the leap. Many won't. Both outcomes are fine. The product doesn't bend to her needs, but it doesn't shut her out either.

---

### Persona 4: Dev Okafor — "The API Builder" (Developer — Light Sketch)

**Who he is:**
Dev is a 37-year-old software engineer at a startup. Full-stack, 12 years of experience. Lives in VS Code, terminal, and GitHub. Writes TypeScript and Python daily. Has built and shipped production applications, internal tools, and developer platforms. He doesn't use other people's UIs when an API exists — and he judges platforms by the quality of their API documentation before he ever opens the web app.

**Where he is with AI:**
Dev is already building with AI — it's not a learning goal, it's his current reality. He's integrated LLM calls into production services, built custom MCP servers, wired up agentic workflows, and evaluates new models weekly. He doesn't need a platform to tell him what AI is. He needs a platform that *understands what he's building* and helps him go deeper.

**How he interacts with AI Learning Hub:**
Dev signed up because a friend (probably a Marcus-type) shared their learning trail and he was impressed by the data model — the structured relationship between projects, resources, and tutorials resonated with how he already thinks about his work. He opened the web UI once to set up his account and generate API keys. He hasn't been back since.

His interaction lives across **three layers** — each with a different relationship with the platform:

**Layer 1: Direct API Calls (Scripted/Deterministic)**
Dev has scripts and cron jobs that interact with the API predictably:
- A daily script that pulls his "unlinked saves" and formats them as a digest in his terminal
- A weekly script that queries his project statuses and surfaces tutorials he started but didn't finish
- CI/CD pipeline hooks that save relevant documentation URLs to a project when he deploys a new service
- A shell alias: `alh-save <url> --project "agent-framework"` — one command, no browser

**Layer 2: MCP Tool Integration (Human-in-the-Loop, Conversational)**
Dev has registered AI Learning Hub as an MCP server in Claude, ChatGPT, and his own custom LLM interfaces. During a conversation with an LLM, the model can read and write to AI Learning Hub on his behalf:
- Deep in a Claude conversation debugging agent orchestration — "save that article to my Agent Framework project." Claude calls the MCP tool, saves the URL, links it, conversation continues.
- "What tutorials do I have saved that are relevant to what we're working on right now?" Claude queries his saves via MCP, surfaces 3 forgotten tutorials, weaves them into the conversation.
- "Summarize what I saved this week and suggest which project each save should link to." Claude reads recent saves, reads project descriptions, proposes linkages — Dev approves, Claude executes via MCP.
- Pastes a Claude conversation into project notes directly from within Claude — "save this conversation to my RAG Pipeline project notes." MCP tool appends as Markdown.

**Layer 3: Agentic Workflows (Autonomous, Agent-Directed)**
Dev builds agents that use AI Learning Hub's API/MCP tools as part of their own autonomous workflows:
- **Learning Scout Agent:** Monitors his GitHub stars, Hacker News upvotes, and RSS feeds. When it identifies content relevant to an active project, it autonomously saves the URL, tags it, and links it to the relevant project. Dev wakes up to 3-4 new saves he didn't make — curated by his own agent based on project context.
- **Tutorial Discovery Agent:** Periodically queries Dev's projects via API, analyzes skill gaps and open questions in his project notes, then searches for tutorials that address those gaps. Saves candidates as "agent-suggested" saves (tagged distinctly for Dev to review and approve/dismiss).
- **Project Reflection Agent:** Weekly agent that reads project notes, linked resources, and tutorial history via API. Generates a structured "weekly learning summary" — what Dev worked on, what he learned, what patterns are emerging, what to explore next. Writes the summary back to a "Weekly Reflections" project. Dev reads on Monday mornings.
- **Build Journal Agent:** When Dev completes a significant milestone, the agent compiles relevant saves, notes, and tutorials into a draft V3 learning trail — the skeleton of a published trail. Dev edits and publishes; the agent did 80% of the assembly.

**What this means for the platform:**
Dev's interaction pattern validates "API is the product" more than any other persona. His agents treat AI Learning Hub the way a microservice treats a database — as a reliable, well-documented data layer with a clear contract. If the API is poorly designed, poorly documented, or unreliable, Dev's entire ecosystem breaks. He will find every API edge case, every rate limiting gap, every undocumented behavior. He'll also build things on the platform we never imagined — and that's the point.

**What he values from us:**
- **The data model** — structured, opinionated, well-designed. He'd rather consume it as a service than reinvent it.
- **The API contract** — clean, documented, paginated, predictable. His agents depend on it. Breaking changes break his workflows. API versioning matters more to him than any UI feature.
- **V2 intelligence via API** — accessible as endpoints and MCP tools, not trapped in a web UI. His agents will compose V2's intelligence into their own workflows in ways we can't predict.
- **Tutorials to build** — discovery matched to his projects. Not "intro to Python" but "build a multi-agent system with tool use and human-in-the-loop."
- **V3 publishing** — published learning trails with the pre/during/after arc. Build Journal Agent makes publishing near-effortless.

**Platform relationship:**
- **Primary surface:** API and MCP server exclusively. Zero web UI after initial setup.
- **Capture behavior:** Multi-layered — scripted batch saves, conversational MCP saves during LLM sessions, autonomous agent-driven saves running 24/7.
- **V2 value:** **Critical.** Intelligence layer accessible via API is the reason he stays. Without it, he'd build his own system. With it, his agents become dramatically more capable.
- **V3 value:** **High.** Active publisher. Agent-assisted trail assembly means low-effort, high-quality published trails.

---

### Persona 5: Stephen — "The Solo Platform Operator" (Operator Persona)

**Who he is:**
Stephen is the builder, owner, and sole operator of AI Learning Hub. He designed the architecture, wrote the CDK, deployed the infrastructure, and is the only person who gets paged when something breaks. There is no ops team, no on-call rotation, no SRE. It's him, his phone, and CloudWatch Alarms at 2am.

He's an intermediate-level builder with a cloud infrastructure background. He chose AWS serverless specifically because managed services do the heavy lifting — he doesn't want to manage servers, patch OS versions, or babysit databases. He wants to build a platform that runs itself 99% of the time and tells him clearly when it needs attention.

**What he operates:**
A multi-user serverless platform at boutique scale (hundreds to low thousands of users). The stack: CloudFront → API Gateway → Lambda → DynamoDB + S3 + search/discovery store. Auth via Clerk/Auth0. Observability via CloudWatch, X-Ray, structured logging. All infrastructure defined in CDK — no ClickOps, ever.

**Two operational lenses:**

#### Lens 1: Platform Operations — "Is the system running?"

**Monitoring & Observability:**
- The system tells him when something's wrong — he doesn't watch dashboards. Dashboards are for investigation, not surveillance.
- Critical alerts hit his phone immediately (API error rate >1%, latency p99 >5s, DynamoDB throttling, Lambda errors >5%, sync lag >10 min).
- Warning alerts hit his phone hourly (enrichment failures, WAF spikes, SSRF detection, capacity approaching limits).
- Informational signals go to dashboards he reviews weekly (usage patterns, anomalies, growth trends).
- From alert to root cause in under 5 minutes via X-Ray traces + structured logging + admin CLI.

**Investigation & Troubleshooting:**
- His "UI" is the terminal. Admin CLI commands backed by Lambda functions.
- `admin:user:activity <user_id>` — full activity timeline
- `admin:enrichment:status` — pipeline health
- `admin:search:sync-status` — search store sync lag
- `admin:content:reenrich <url_hash>` — re-run enrichment on a specific URL

**Moderation & Abuse Response:**
- Anomaly alerts trigger investigation (500 URLs in an hour, bulk notes writes, invite brute-forcing).
- `admin:user:suspend` / `admin:user:unsuspend` — account moderation
- `admin:content:remove` — remove bad content from shared layer with cascade
- `admin:invite:revoke` — kill compromised invite codes

**Backup & Recovery:**
- DynamoDB point-in-time recovery — continuous backups, restore to any second in last 35 days
- S3 versioning on notes and images buckets
- Content layer mutation logging with before/after state for selective revert
- Full platform recovery target: 24 hours. Single region, managed services handle availability.

**Cost Management:**
- Serverless pay-per-use — costs scale with usage, not time
- AWS Cost Explorer + billing alerts, monthly review
- Observability stack: $10-20/month. Total platform cost at boutique scale: predictable and low.

#### Lens 2: Development Pipeline — "Can I trust this code?"

A solo developer needs a pipeline more than a team does — there's no second pair of eyes. The pipeline IS the second pair of eyes.

**Pipeline mechanism: GitHub Actions** — YAML-configured, free tier generous, infrastructure-as-code for the pipeline itself. The pipeline is a V1 deliverable.

**On every push / PR (CI):**
1. **Linting & Formatting** — ESLint, Prettier, CDK Nag (security/best practice scanning of CDK constructs), Markdown lint for docs
2. **Type Checking** — TypeScript strict mode, CDK synth (validates CloudFormation without deploying)
3. **Automated Testing** — unit tests (handlers, data model, URL normalization, validation), integration tests (API contract, data isolation — can user A access user B's data?), security tests (cross-user access, Markdown sanitization)
4. **Test Coverage Threshold** — enforced minimum (e.g., 80%). Coverage drops → pipeline fails.
5. **Dependency Scanning** — npm audit, Dependabot/Snyk for vulnerability alerts, license compliance
6. **Build Verification** — frontend builds (Vite), CDK synthesizes, bundle size check

**On merge to main (CD):**
7. **Staging Deployment** — `cdk deploy --stage staging`, smoke tests against staging
8. **Production Deployment** — `cdk deploy --stage prod`, post-deploy smoke tests, CloudWatch Alarms catch regressions within minutes
9. **Rollback** — CDK rollback on failure, Lambda versioning + aliases for instant rollback

**What the pipeline catches:**

| Scenario | Safety Net |
|----------|------------|
| Lambda leaks user B's data to user A | Data isolation integration tests |
| Dependency has known CVE | npm audit / Dependabot |
| CDK creates unencrypted S3 bucket | CDK Nag |
| Frontend bundle doubles in size | Bundle size check |
| Markdown rendering lets script tag through | Sanitization security tests |
| Deploy breaks prod at 11pm | Post-deploy smoke tests + CloudWatch Alarms |
| Save API contract broken by refactor | API contract integration tests |

**Persona-specific E2E smoke tests in CI (golden path tests):**
Each persona gets at least one end-to-end test that exercises their primary flow. These run on every push and guarantee no persona's golden path is broken:
- **Marcus flow:** signup → create project → save URL (desktop) → link save to project → add Markdown notes → search notes content → verify enrichment after batch run
- **Maya flow:** share sheet save (API call simulating iOS Shortcut) → verify save exists → desktop session: browse saves → link to project → paste notes
- **Priya flow:** signup → seeded projects visible → save 1 URL → verify enrichment populates metadata → browse saves with filters
- **Dev flow:** API key generation → scripted save → MCP-style save (API call with agent tag) → query saves by project → verify agent-tagged saves appear correctly
- **Stephen flow:** deploy to staging → smoke test all endpoints → verify CloudWatch alarm configuration → verify structured log format matches contract

**Load test scenario for agent patterns:**
Simulates Dev's agent load pattern: 50 concurrent saves, 200 concurrent queries, sustained over 30 minutes. Verifies: no throttling below rate limit, correct 429 behavior above limit, no data corruption under load, DynamoDB capacity stays within bounds. Runs weekly (not per-push — too expensive), results feed into System Health dashboard.

**Contract tests as API documentation source:**
Every API endpoint has a contract test validating request/response schema. OpenAPI spec is generated from these tests — tests are the source of truth, docs are derived. If the schema changes, the test fails. This is what gives Dev's agents (and all API consumers) confidence the contract won't break.

**Test suite is agent-invokable:**
The test suite is designed for both human and agent operators:
- Test results available via API (not just CI logs) — a GenAI ops agent can ask "did the last test run pass? which tests failed?"
- Test runs as Lambda functions (same pattern as admin CLI) — an agent can trigger a test suite run and check results
- Structured test output (JSON) — machine-readable for agents, human-readable for Stephen
- Test coverage reporting feeds into the Product Usage Dashboard (Stefania's domain) — track coverage trends over time to catch drift as features are added

This aligns with the admin CLI pattern: everything is a Lambda, everything has an API, everything is accessible to both humans and agents. If we want to enable agentic workflows on this platform (which we do), the test suite is part of the trust layer that agents depend on.

**Operator journey:**
1. **Deploy:** `cdk deploy` — infrastructure from code. Repeatable, predictable.
2. **Monitor:** Alarms on phone, dashboards for weekly review.
3. **Investigate:** Admin CLI + X-Ray + CloudWatch Logs Insights. Alert to root cause in 5 minutes.
4. **Moderate:** Suspend, remove, revoke. Tools exist when needed.
5. **Recover:** Point-in-time restore, S3 versioning, mutation logs. 24-hour RTO.
6. **Evolve:** CDK changes, new features, V2 — all through the same IaC pipeline.

---

### Persona 6: Stefania — "The Business Analyst" (Operator Persona)

**Who she is:**
Stefania is the product health analyst for AI Learning Hub. In practice, she's Stephen wearing a different hat on Sunday evenings. But she gets her own persona because her concerns are fundamentally different from operations. Stephen asks "is the system running?" Stefania asks "is the product *working*?"

Separating her also future-proofs the thinking. Today she's Stephen with a different hat. Tomorrow she might be an actual person — a co-founder, an advisor, a contractor. Or she might be a V2 GenAI agent that runs these analyses autonomously. The persona's needs don't change regardless of who (or what) fills the role.

**What she cares about:**

**Adoption — "Are people showing up?"**
- Signup velocity and trajectory
- Invite code generation vs. redemption (word-of-mouth conversion rate)
- First-session source (mobile vs. desktop)
- Time from invite received to signup completed

**Engagement — "Are people getting value?"**
- Saves per user per week (fuel flow metric, segmented by persona type)
- User-created projects (not seeded — builder signal)
- Connection depth (projects with 3+ linked saves)
- Notes activity (living notebook signal)
- Tutorial pipeline (saved → started → completed)
- Platform mix (mobile vs. desktop, API vs. web UI)
- Content mix (source type distribution)

**Retention — "Are people coming back?"**
- Cohort retention curves (W1 → W2 → W4 → W8 — the most important chart)
- DAU/WAU ratio
- Threshold crossings (10+ saves, 3+ projects, first note)
- Seeded project interaction (engaged vs. archived vs. ignored)
- Time from signup to first user-created project (the conversion moment)

**Churn — "Are people leaving, and why?"**
- Users inactive 14+ days
- Save velocity decline (>50% drop from average)
- Abandoned projects (created 30+ days ago, no updates)
- Stuck tutorials ("started" for 30+ days)
- Last action before churn (aggregate pattern — what do people do right before they stop?)

**Persona-level health — "Is the product working for each audience?"**
- Per-segment engagement, retention, and funnel metrics
- Which persona retains best? Converts fastest? Generates most invites?
- Segment-level funnel — where does each persona type drop off?

**Funnel analysis — "Where do people drop off?"**
1. Invite received → signup completed
2. Signup → first save
3. First save → 10th save (compounding threshold)
4. First save → first project created
5. Project created → first save linked
6. Project created → first note added
7. Tutorial saved → started → completed

**How she accesses this:**
- **Analytics Web UI** — 5 dashboards at a bookmarkable URL (see Product Analytics section)
- **Admin CLI** — quick queries from terminal
- **Cadence:** Weekly. Sunday evening review. Pull up dashboards, run CLI queries, note observations.
- **V2:** GenAI agent runs the same queries autonomously and generates weekly product health reports

---

### User Journey: Cross-Persona Beats

**The Invite Experience (All Personas):**
Every user arrives via invite code from someone they know. The inviter has context — "you should check this out for your RAG project" or "this is great for tracking AI tutorials." The invitee arrives with someone else's framing of what the product is. Onboarding must be fast enough that the inviter's enthusiasm doesn't decay, and clear enough that the invitee understands the value proposition within 60 seconds.

**Journey: Discovery → First Save → First Project → Connected Fuel**

| Stage | Maya (No-Code) | Marcus (Infra Builder) | Priya (Explorer) | Dev (API) |
|-------|---------------|----------------------|-----------------|-----------|
| **Discovery** | Colleague shares invite at team meeting | Friend shares learning trail link | Colleague mentions at lunch | Sees published trail, impressed by data model |
| **Signup** | Mobile, social auth, enters invite code | Desktop, enters invite code | Mobile, social auth, enters invite code | Desktop, generates API keys immediately |
| **First experience** | Sees seeded projects, browses on phone | Dives into seeded projects, opens desktop | Sees seeded projects, glances on phone | Reads API docs, ignores web UI |
| **First save** | Share sheet from podcast app (commute) | Saves architecture blog from phone | Share sheet from LinkedIn (someone mentioned something) | Shell alias or MCP tool from Claude |
| **Aha moment** | Links 3 saves to a project — "this is MY workbench" | Pastes Claude conversation into project notes — "this captures my thinking" | Browses saves, sees pattern — "I keep saving HR + AI stuff" | Agent auto-saves relevant content — "it's already working for me" |
| **Value compounds** | Weekly saves + weekend build sessions become routine | Projects become living architecture notebooks | Seeded tutorial sparks first project attempt | Agent ecosystem builds on top of platform |
| **V2 unlock** | Relevant tutorial recommendations for her projects | Niche architecture content from collective graph | Beginner-level, interest-matched discovery | Intelligence layer accessible via API for his agents |
| **V3 unlock** | Shares trail on LinkedIn for team/career | Publishes trail as GenAI SA portfolio | Browses others' published trails for inspiration | Agent assembles and publishes trails automatically |

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

### North Star Metric

**Weekly Active Builders (WAB)** — Users who created/updated a project OR linked a save to a project in the last 7 days.

This is user-centric, directly measures the core behavior (building, not just saving), and is simple to explain. It goes up when the product is working and down when it isn't, regardless of which persona is using it.

### Primary KPIs (7)

| # | KPI | Definition | Target Range | What It Tells Us |
|---|-----|------------|-------------|------------------|
| 1 | **Activation Rate** | % of new users who complete onboarding + make their first save within 48 hours | 50-70% | Friends invited personally = high trust, low friction. Below 50% = onboarding is broken. |
| 2 | **Saves per Active User per Week** | Average saves (any source type) per user who logged in that week | 2-5 | 3 is the baseline expectation. Below 2 = capture friction. Above 5 = power user. |
| 3 | **Project Creation Rate** | % of activated users who create their first project within 14 days | 40-60% | Invited friends with context should create a project. Below 40% = seeded projects aren't helping. |
| 4 | **Save-to-Project Link Rate** | % of saves that get linked to at least one project (rolling 30-day) | 15-30% | At 1 link/week and 3 saves/week, ~33% is the math. Below 15% = linking is too hard or not obvious. |
| 5 | **7-Day Retention** | % of users active in week 1 who return in week 2 | 40-60% | Friends retain better than strangers. Below 40% with a personal invite = the product isn't sticky. |
| 6 | **Project Activity Depth** | Average number of content additions (notes, LLM outputs, linked saves, status changes) per active project per week | 1-3 | Even 1 note or 1 link per project per week means the living notebook is alive. |
| 7 | **Project Stage Progression Rate** | % of projects that advance at least one stage within 30 days of creation | 20-40% | Most projects will sit at "exploring" for a while. 20% progressing is healthy for casual builders. |

**Scale context:** This is a personal project shared among friends. We expect no more than ~2 new signups per week, users doing ~1 project/week, ~3 saves/week, ~1 link/week. Very low, very modest. These are not aspirational growth targets — they are descriptive of the user base we actually expect. If the numbers fall below these modest ranges, something is genuinely broken. The WAB North Star target is 3-8 weekly active builders — if even half the users are building in a given week, the product is working.

**Small-N display rule:** At boutique scale, every percentage is a lie unless you show the absolute numbers. All dashboards must display **percentage (N of total)** for any metric where the denominator is below 20 (configurable threshold). "Project Stage Progression: 33% (1 of 3)" is actionable. "33%" alone is misleading. Cohort retention curves should display as simple tables (not curves) when cohort size is below 10 — "Week 1 cohort (Jan 15): 2 signed up, 1 returned week 2" is honest. A retention curve with 2 data points is performance art, not analysis.

KPIs 6 and 7 measure what the other KPIs miss: **project depth and progression**. A project with 12 linked saves but no notes and stuck at "idea" for 2 months looks very different from one with 3 saves, 5 LLM conversation pastes, and a status of "building." The living notebook thesis requires its own signals.

### Leading Indicators

Early signals that predict whether the KPIs will go up or down before they actually move. The early warning system.

| # | Leading Indicator | What It Predicts | Signal |
|---|-------------------|------------------|--------|
| 1 | **First save within 5 minutes of signup** | Activation Rate | If users save something fast, onboarding is working. If not, there's friction. |
| 2 | **Second session within 72 hours** | 7-Day Retention | Users who come back within 3 days almost always retain into week 2. Users who don't, usually churn. |
| 3 | **3+ saves in first week** | Saves per Active User / Save-to-Project Link Rate | Hitting a critical mass of saves early predicts ongoing engagement and eventual linking behavior. |
| 4 | **First note or LLM output added to a project** | Project Activity Depth | The moment a user writes INTO a project (not just links TO it), they've crossed from organizing to building. Strongest engagement signal. |
| 5 | **Mobile vs. desktop session ratio** | Overall engagement breadth | Users who capture on mobile AND work on desktop are using the product as designed. Single-surface-only users may be underserving themselves. |
| 6 | **Share sheet / iOS Shortcut setup completion** | Saves per Active User | If mobile capture isn't set up, the effortless fuel harvesting loop never starts. A leading indicator of save volume. |
| 7 | **Seeded project engagement rate** | Project Creation Rate, Activation Rate | % of new users who interact with at least 1 seeded project (view, link a save, add a note) within 7 days. At ~2 signups/week, every user matters — if seeded projects are dead weight, onboarding is adding clutter instead of accelerating the save→project transition. |

### Per-Persona Success Signals

Each persona has two success signals: a **behavior signal** (is the infrastructure proving itself?) and a **value signal** (is it delivering real outcomes?).

| Persona | Signal 1 (Behavior) | Signal 2 (Value) |
|---------|---------------------|-------------------|
| **Marcus (#1)** | 5+ LLM outputs pasted into project notes within 30 days | At least 1 project reaches "building" stage with 3+ linked saves — the learning trail is forming |
| **Stephen (#2)** | Can trace a single user request end-to-end (API Gateway → Lambda → DynamoDB → response) via X-Ray + CloudWatch within first week — observability provides full request-level visibility, not just aggregate health | CI pipeline catches a failing deploy before production — the safety net works proactively |
| **Maya (#3)** | First save via iOS Shortcut within 24h of setup | 3+ mobile saves linked to a project within 14 days — mobile fuel is connecting to builds, not just piling up |
| **Priya (#4)** | 3+ projects with stage progression beyond "exploring" within 60 days | Tutorial completion rate > 50% on tutorials linked to active projects — she's following through, not just organizing |
| **Stefania (#5)** | All 7 funnel stages (invite received → tutorial completed) have non-zero conversion data within 30 days of launch — instrumentation captures the full user lifecycle, not just easy top-of-funnel | Identifies an actionable insight from funnel or retention data that drives a product change |
| **Dev (#6)** | API key generated + 10+ API calls in first week | Sustained API usage: 50+ calls/week by week 4 — his agent workflow depends on the platform, not just tried it |

**Design principle:** Signal 1 validates that the infrastructure/product is *proving itself* — not just that someone looked at it. Signal 2 validates that the proof *leads to real outcomes*. "She opened the dashboard" is a vanity metric. "The dashboard surfaced data that changed a decision" is a success signal.

### Anti-Metrics

Metrics we explicitly **do NOT optimize for** — to prevent the product from drifting toward the wrong incentives.

| # | Anti-Metric | Why We Don't Optimize For It |
|---|-------------|------------------------------|
| 1 | **Unconnected saves accumulation** | Saves piling up with no link to any project or learning path. Saving is good; hoarding without connecting is a signal the product isn't enabling the fuel-to-building loop. (Note: unlinked saves are first-class citizens — the anti-metric is the *pattern* of accumulation without ever connecting, not individual unlinked saves.) |
| 2 | **Time on platform** | This isn't a feed or social network. If a user saves in 10 seconds and leaves, that's a win. Engagement depth (project activity) matters, not session duration. |
| 3 | **DAU / daily logins** | Builders work in bursts — commute saves, weekend build sessions. Daily active is the wrong cadence. Weekly active builders is the right one. |
| 4 | **Link count as success proxy** | Don't treat more links per project as better in metrics, dashboards, or nudges. 30 links isn't better than 3 — V1 has no mechanism to assess connection quality. That's V2's intelligence layer. Don't build incentives around a number we can't evaluate. |
| 5 | **Invite codes generated** | Generation is free. Codes *redeemed* matters. Codes redeemed where the invitee *activates* matters more. |

### Technical Health

- Capture latency (share sheet to save confirmed) — must be < 2 seconds
- Search response time — must be < 1 second for V1 full-text
- API error rate — must be < 0.5%
- Search sync lag — must be < 5 minutes (alerted if exceeded)

### Measurement Infrastructure — How We Collect Everything Above

This section maps every metric to its event source, collection mechanism, computation method, and surfacing layer. If a metric isn't in this section, we can't measure it. If we can't measure it, it isn't a metric — it's a wish.

#### Layer 1: Event Emission — What Gets Tracked

Every user-facing and system action emits a structured event to CloudWatch Logs via the existing logging contract (`timestamp`, `request_id`, `trace_id`, `user_id`, `action`, `entity_type`, `entity_id`, `source`, `level`, `duration_ms`, `ip_address`, `user_agent`, `metadata`).

**V1 Required Event Catalog:**

| Event Action | Trigger | Metadata Fields | Feeds Metric(s) |
|-------------|---------|-----------------|-----------------|
| `user.signup.completed` | User completes onboarding | `invite_code_used`, `auth_provider`, `device_type`, `first_session_source` (mobile/desktop) | Activation Rate, Adoption funnel, Invite redemption |
| `user.session.started` | User opens app or authenticates | `device_type`, `client_type` (web/api/shortcut), `session_id` | WAB, Retention, DAU/WAU, Mobile/desktop ratio |
| `user.shortcut.setup.completed` | iOS Shortcut or share sheet configured | `platform` (ios/android), `setup_duration_seconds` | Leading Indicator #6, Maya Signal 1 |
| `save.created` | Any save via any surface | `source_surface` (share_sheet/ios_shortcut/web_ui/api/mcp), `device_type`, `url_domain`, `auto_detected_source_type`, `is_first_save` (boolean), `time_since_signup_seconds` | Saves/Active User, Leading Indicator #1, Content Mix, Maya Signal 1 |
| `save.enrichment.completed` | Async enrichment finishes | `url_hash`, `enrichment_outcome` (full/partial/failed), `failure_reason`, `metadata_fields_populated`, `duration_ms` | Enrichment dashboard, Technical health |
| `save.role.assigned` | Save marked as resource and/or tutorial | `is_resource`, `is_tutorial`, `changed_by` (user/system) | Resource Library metrics, Tutorial pipeline |
| `save.linked_to_project` | Save linked to a project | `project_id`, `project_status`, `total_project_links` (after this link), `link_source` (inline_suggestion/manual/search_result) | Save-to-Project Link Rate, Project Activity Depth, Marcus Signal 2 |
| `save.unlinked_from_project` | Save unlinked from a project | `project_id` | Save-to-Project Link Rate (decrement) |
| `project.created` | New project created | `is_seeded` (boolean), `is_first_user_project` (boolean), `time_since_signup_seconds`, `folder_id` | Project Creation Rate, Leading Indicator timing |
| `project.updated` | Any project metadata change | `fields_changed` (array), `previous_status`, `new_status` (if status changed) | WAB, Project Activity Depth |
| `project.status.changed` | Project stage transition | `previous_status`, `new_status`, `time_in_previous_status_days`, `project_age_days` | Project Stage Progression Rate, Priya Signal 1 |
| `project.note.added` | Note or LLM output added to project | `note_type` (manual_note/llm_output), `content_size_bytes`, `llm_source` (claude/chatgpt/gemini/other/null), `is_first_note` (boolean) | Project Activity Depth, Leading Indicator #4, Marcus Signal 1 |
| `project.note.updated` | Existing note edited | `note_type`, `size_delta_bytes` | Project Activity Depth |
| `tutorial.status.changed` | Tutorial progression | `previous_status`, `new_status` (not_started/started/completed/archived), `linked_project_ids` (array), `time_in_previous_status_days` | Tutorial pipeline, Priya Signal 2 |
| `invite.code.generated` | User generates invite code | `codes_generated_total` (cumulative for this user) | Invite funnel |
| `invite.code.redeemed` | Invite code used at signup | `code_id`, `generated_by_user_id` | Invite funnel, activation tracking |
| `api.key.generated` | API key created | `key_id`, `time_since_signup_seconds` | Dev Signal 1 |
| `api.request` | Any API call (from API Gateway access logs) | `key_id`, `endpoint`, `method`, `status_code`, `latency_ms` | Dev Signal 1 & 2, API health, Rate limiting |
| `search.executed` | User or API performs a search | `query_length`, `result_count`, `latency_ms`, `surface` (web/api) | Search health, engagement depth |
| `seeded_project.interacted` | User interacts with a seeded project | `interaction_type` (viewed/linked_save/added_note/archived/deleted), `project_template_id` | Seeded project engagement |
| `save.deleted` | User permanently removes a save | `had_project_links` (boolean), `linked_project_ids` (array), `save_age_days`, `was_resource`, `was_tutorial` | Save-to-Project Link Rate accuracy, Churn & Risk patterns, daily_user_activity.saves_deleted counter |
| `project.deleted` | User permanently deletes a project (not archives) | `project_status_at_deletion`, `linked_saves_count`, `notes_count`, `project_age_days` | Project Stage Progression accuracy, daily_user_activity.projects_deleted counter, active_project_count decrement |
| `project.note.deleted` | User removes a note from a project | `note_type` (manual_note/llm_output), `content_size_bytes` | Project Activity Depth accuracy, daily_user_activity.notes_deleted counter |
| `save.unlinked_from_project` | Save unlinked from a project | `project_id`, `link_age_days` | Save-to-Project Link Rate (decrement), daily_user_activity.links_removed counter |
| `user.account.deactivated` | User or admin disables account | `reason` (user_requested/admin_action/inactivity_cleanup), `total_saves`, `total_projects`, `days_since_signup` | Churn & Risk (explicit exit vs. silent churn), WAB exclusion |
| `api.key.revoked` | User or admin revokes an API key | `key_id`, `reason` (user_requested/admin_action/compromised), `total_requests_lifetime` | Dev persona churn signal, API health |

**Critical design decision:** Every event includes `device_type` and `client_type` where applicable. This is how we compute mobile/desktop ratio, share sheet adoption, and API vs. web UI split without needing a separate tracking system.

**What we do NOT track:** Page views, click paths, scroll depth, hover events, time-on-page. These are content-consumption metrics. We are not a content platform. We track *actions that change state* — saves, links, notes, status changes, project creation, **and deletions**. If it doesn't change state, it doesn't get an event.

#### Layer 2: Event Storage — Where It Lives

| Store | What Goes There | Retention | Query Method |
|-------|----------------|-----------|--------------|
| **CloudWatch Logs (operational)** | All events from the catalog above | 30 days | CloudWatch Logs Insights queries |
| **CloudWatch Logs (audit)** | Content-layer mutations, API access logs, security events | 90 days | CloudWatch Logs Insights queries |
| **DynamoDB (analytics summary table)** | Pre-computed daily/weekly rollups (see Layer 3) | Indefinite | Direct query via Analytics API |
| **DynamoDB (transactional)** | Entity state (saves, projects, users, invites) — the source of truth for current state | Indefinite | Application queries |
| **CloudWatch Metrics (custom)** | Numeric time-series: latency percentiles, error rates, save counts, active user counts | 15 months | CloudWatch Dashboards, Alarms |

**Why a separate analytics summary table in DynamoDB?** Raw CloudWatch Logs expire at 30 days. Cohort retention curves need data spanning months. Leading indicators need historical baselines. We cannot recompute "week 1 retention for the January 15 cohort" if the raw events are gone. The analytics summary table stores pre-computed rollups that survive beyond the 30-day log window.

**Analytics Summary Table — Key Records:**

| Record Type | Partition Key | Sort Key | Computed | Contains |
|-------------|--------------|----------|----------|----------|
| `daily_user_activity` | `user_id` | `date` | Real-time (on each event) | saves_count, projects_updated, notes_added, links_created, tutorials_progressed, sessions, device_types_used, client_types_used, saves_deleted, projects_deleted, notes_deleted, links_removed. **Purely daily counters — no current-state fields.** |
| `user_current_state` | `user_id` | (no sort key) | Real-time (on each event) | active_project_count, total_saves, total_links, persona_type (manual tag, set via `admin:user:set-persona`), automated_persona_type (heuristic output from weekly batch), account_status, last_active_at. **Always reflects current state — one DynamoDB get-item, no date scanning needed.** |
| `weekly_cohort_snapshot` | `cohort_week` (signup week) | `snapshot_week` | Weekly batch (Sunday + Thursday) | cohort_size, active_count, saves_total, projects_created, activation_rate, retention_rate, computed_at |
| `weekly_funnel_snapshot` | `FUNNEL` | `snapshot_week` | Weekly batch (Sunday + Thursday) | Per-stage counts and conversion rates for all 7 funnel stages, computed_at |
| `weekly_persona_snapshot` | `persona_type` | `snapshot_week` | Weekly batch (Sunday + Thursday) | Per-segment engagement, retention, funnel metrics, computed_at |
| `user_milestones` | `user_id` | `milestone_type` | Real-time (on milestone hit) | first_save_at, first_project_at, first_note_at, first_link_at, tenth_save_at, shortcut_setup_at, api_key_generated_at, first_api_call_at |

**`user_milestones` is critical infrastructure.** It's how we compute leading indicators and per-persona signals without scanning the full event log. When a user hits their first save, we write the timestamp once. When Stefania asks "what % of users made their first save within 5 minutes?" the query is a scan of milestone records comparing `first_save_at - signup_at`, not a CloudWatch Logs Insights query across millions of events.

**Milestone regression policy:** Milestones are **write-once** — they record "this user ever did this" and are never cleared, even if the user later deletes the entity. A user who creates a project and then deletes it still has `first_project_at` set, because they DID create a project (useful for funnel analysis). Current state is tracked separately via `user_current_state.active_project_count`, which decrements on deletion. This dual approach means funnel analysis ("did they ever create a project?") uses milestones, while engagement analysis ("do they currently have an active project?") uses `user_current_state`.

#### Layer 3: Computation — How Raw Events Become Metrics

Three computation patterns:

**Pattern A: Real-Time Increment (on each event)**
- Trigger: Lambda event handler, after the primary action succeeds
- Updates: `daily_user_activity` record for that user/date, `user_milestones` if a new milestone
- Latency: Synchronous with the request (adds ~10-20ms DynamoDB write)
- Used for: WAB, Saves/Active User, Project Activity Depth, all leading indicators, per-persona behavior signals

**Pattern B: Weekly Batch Rollup (Sunday + Thursday, scheduled Lambda)**
- Trigger: EventBridge scheduled rules — **Sunday midnight UTC** (primary) and **Thursday midnight UTC** (catch-up/self-healing)
- Reads: `daily_user_activity` records for the past 7 days, `user_milestones`, current entity state from transactional DynamoDB
- Writes: `weekly_cohort_snapshot`, `weekly_funnel_snapshot`, `weekly_persona_snapshot`. Each snapshot includes a `computed_at` timestamp for provenance — Stefania can see when data was computed vs. recomputed.
- Latency: Batch, minutes to complete
- Used for: Cohort retention curves, funnel conversion rates, persona health comparisons, Project Stage Progression Rate (30-day window)
- **Idempotent and re-runnable:** The batch can be triggered manually for any specific week via `admin:analytics:recompute --week 2026-02-01`. It re-reads `daily_user_activity` (indefinite retention) and rewrites snapshots. Never depends on CloudWatch Logs. Eliminates the "lost week" failure mode.
- **Thursday catch-up behavior:** Thursday's run recomputes the current partial week AND scans for missing prior-week snapshots. If any gaps are found (e.g., a failed Sunday run from 3 weeks ago), it backfills automatically. Thursday is self-healing, not just redundancy.

**Pattern C: On-Demand Query (Analytics API request)**
- Trigger: Stefania opens dashboard or runs CLI command
- Reads: Pre-computed rollups from analytics summary table (Pattern A and B outputs)
- Falls back to: CloudWatch Logs Insights for ad-hoc queries not covered by rollups (within 30-day window)
- Used for: All dashboard views, drill-downs, ad-hoc investigation

**Why not just query CloudWatch Logs for everything?** Three reasons: (1) Logs expire at 30 days — retention curves need months of history. (2) CloudWatch Logs Insights queries are slow at scale and cost per GB scanned. (3) Leading indicators and milestones need instant lookups, not log scans. The analytics summary table is cheap (DynamoDB on-demand pricing, small records) and makes the dashboards fast.

#### Layer 4: Metric-to-Infrastructure Mapping — The Complete Trace

Every metric, traced from definition to where Stefania (or Stephen) sees it:

**North Star: Weekly Active Builders**
- Event source: `user.session.started` + `project.created` + `project.updated` + `save.linked_to_project`
- Computation: Pattern A — `daily_user_activity` flags user as "builder-active" if any qualifying action occurs. Pattern B — weekly rollup counts distinct builder-active users.
- Surfaced: Analytics API → Engagement Dashboard (primary widget), Admin CLI `admin:analytics:engagement`

**KPI 1: Activation Rate**
- Event source: `user.signup.completed` + `save.created` (where `is_first_save = true`)
- Computation: Pattern A — `user_milestones` records `signup_at` and `first_save_at`. Pattern B — weekly cohort snapshot computes % where `first_save_at - signup_at < 48 hours`.
- Surfaced: Analytics API → Adoption Dashboard, Admin CLI `admin:analytics:funnel --from signup --to first_save`

**KPI 2: Saves per Active User per Week**
- Event source: `save.created`
- Computation: Pattern A — `daily_user_activity.saves_count` incremented per save. Pattern B — weekly rollup computes average across users with ≥1 session.
- Surfaced: Analytics API → Engagement Dashboard (distribution histogram + trend line)

**KPI 3: Project Creation Rate**
- Event source: `project.created` (where `is_seeded = false` and `is_first_user_project = true`)
- Computation: Pattern A — `user_milestones.first_project_at` written on first user-created project. Pattern B — weekly cohort snapshot computes % of activated users (milestone: first_save_at exists) where `first_project_at - first_save_at < 14 days`.
- Surfaced: Analytics API → Adoption Dashboard

**KPI 4: Save-to-Project Link Rate**
- Event source: `save.linked_to_project` + `save.unlinked_from_project`
- Computation: Pattern B — weekly rollup queries transactional DynamoDB for saves created in rolling 30-day window, counts those with ≥1 project link vs. total.
- Surfaced: Analytics API → Engagement Dashboard

**KPI 5: 7-Day Retention**
- Event source: `user.session.started`
- Computation: Pattern A — `daily_user_activity` records presence. Pattern B — weekly cohort snapshot: for cohort signed up in week N, what % had ≥1 session in week N+1?
- Surfaced: Analytics API → Retention Dashboard (cohort curves)

**KPI 6: Project Activity Depth**
- Event source: `project.note.added` + `project.note.updated` + `save.linked_to_project` + `project.status.changed`
- Computation: Pattern A — `daily_user_activity` tracks per-project content additions (via metadata). Pattern B — weekly rollup computes average additions per active project (projects with ≥1 event in past 7 days).
- Surfaced: Analytics API → Engagement Dashboard
- **Note:** This is the most instrumentation-heavy KPI. Every content addition type (note, LLM output, link, status change) must emit its own event with the project_id in metadata.

**KPI 7: Project Stage Progression Rate**
- Event source: `project.status.changed`
- Computation: Pattern B — weekly rollup queries all projects created in rolling 30-day window, counts those with ≥1 status advancement (status enum is ordered: investigating → building → deployed → updating → archived; any move forward counts).
- Surfaced: Analytics API → Engagement Dashboard
- **Edge case:** Status can move backward (e.g., deployed → building for a rework). Only forward transitions count for this KPI. Backward transitions are tracked separately as a churn/risk signal.

**Leading Indicators 1-7:**
- Indicators 1-6: All derived from `user_milestones` records (Pattern A, instant lookup)
- Indicator 7 (Seeded project engagement rate): Derived from `seeded_project.interacted` events. Pattern B weekly rollup computes: of users who signed up in the past 7 days, what % had at least 1 `seeded_project.interacted` event (view, link, note) within 7 days? At ~2 signups/week, every user matters.
- Surfaced: Analytics API → custom leading indicators widget on Adoption Dashboard
- Stefania can query: "Of users who signed up this week, what % hit milestone X within Y time?"

**Per-Persona Success Signals:**
- Marcus Signal 1 (5+ LLM outputs): `user_milestones` + count of `project.note.added` where `note_type = llm_output` per user over 30 days
- Stephen Signal 1 (end-to-end trace): Manual validation — not a dashboard metric. Verified during first week by Stephen running an X-Ray trace.
- Maya Signal 1 (iOS Shortcut save): `user_milestones.shortcut_setup_at` + first `save.created` where `source_surface = ios_shortcut`
- Priya Signal 1 (3+ projects progressing): Count of `project.status.changed` events per user where `new_status` is beyond "exploring"
- Stefania Signal 1 (7 funnel stages with data): `weekly_funnel_snapshot` — all 7 stages show non-zero counts
- Dev Signal 1 (API key + 10 calls): `user_milestones.api_key_generated_at` + count of `api.request` per key in first 7 days

#### Layer 5: Persona Segmentation — Manual-First with Automated Heuristics

Persona segmentation drives the Persona Health Dashboard. At V1 boutique scale (~2 signups/week among friends), Stephen knows his users personally. Automated heuristics need 2-4 weeks of behavioral data to classify — by which time Stephen already knows.

**V1 approach: Manual tagging as primary, automated heuristics as secondary.**

**Manual tagging (primary):**
- Stephen assigns persona type via admin CLI: `admin:user:set-persona <user_id> <type>`
- Stored on `user_current_state.persona_type`
- Dashboard shows manual tags as the primary persona classification
- Immediate, accurate from day one — no bootstrap problem, no "Unclassified" limbo

**Automated heuristics (secondary, evaluated weekly in Pattern B rollup):**
- Output stored on `user_current_state.automated_persona_type`
- Dashboard shows automated classification alongside manual tag as a secondary signal
- When automated heuristic disagrees with manual tag, dashboard flags it — either the heuristic is wrong (tune it) or Stephen misjudged (update the tag)
- When user base grows beyond "Stephen knows everyone," automated heuristics can become primary

**Heuristic definitions (still computed, stored, and compared):**

| Persona Type | Primary Signal | Secondary Signal | Override Signal |
|-------------|---------------|-----------------|-----------------|
| **Dev-type** | ANY `api.request` event from a user-generated API key (not web UI session) | — | Binary: any API key usage = Dev-type. This overrides all other signals. A user can be Dev-type AND another type. |
| **Marcus-type** | `project.note.added` where `note_type = llm_output` ≥ 3 in last 30 days | Desktop-heavy sessions (>60% desktop) OR saves from technical domains (github.com, arxiv.org, etc.) | — |
| **Maya-type** | Mobile-heavy sessions (>60% mobile) AND `save.created` where `source_surface` in (share_sheet, ios_shortcut) ≥ 50% of saves | Tutorial engagement (≥1 tutorial started) AND no API key usage | — |
| **Priya-type** | Low save frequency (<2 saves/week average) AND no user-created projects (only seeded) after 14+ days | Mobile-only sessions (100% mobile) | Transitions to Maya-type or Marcus-type when they create first user project |
| **Unclassified** | Does not match any heuristic | — | New users default to unclassified until manually tagged or heuristic classifies them. |

**Important constraints:**
- A user can belong to multiple types (Dev-type is additive; all others are mutually exclusive)
- Automated persona type is re-evaluated weekly, not in real-time. A user's automated type can change as their behavior evolves.
- Persona type history is stored (which type, from which week, to which week) to enable "persona migration" analysis: are Priya-types converting to Maya-types over time?
- Content domain signal is weighted: what users save matters more than what device they use. A mobile-heavy user who saves github.com and arxiv.org links is Marcus-type, not Maya-type.
- **No onboarding persona question in V1.** Self-reported persona hint deferred to V2 — at V1 scale, manual tagging is faster and more accurate than asking users to self-classify.

#### Layer 6: Gap Closure — Resolving Identified Measurement Gaps

The following gaps were identified during Step 4 analysis. Each is resolved or explicitly deferred:

**Gap 1: "Last action before churn" — how are action sequences reconstructed?**
- Resolution: `daily_user_activity` records provide a per-user daily action summary. For users flagged as at-risk (14+ days inactive), the weekly batch reads their last 7 `daily_user_activity` records before the inactivity period began. The "last action" is the most recent non-session event type. Aggregate pattern is computed across all at-risk users: "60% of churned users' last action was a save with no project link."
- Surfaced: Churn & Risk Dashboard

**Gap 2: Seeded project engagement — what is "engaged" vs. "archived" vs. "ignored"?**
- Resolution: Quantitative definitions:
  - **Engaged:** ≥1 `save.linked_to_project` OR ≥1 `project.note.added` on a seeded project
  - **Archived:** User explicitly archives seeded project (`project.status.changed` to archived)
  - **Ignored:** No events on seeded project after 14 days post-signup
- Surfaced: Retention Dashboard

**Gap 3: Tutorial completion tracking — how is "completed" determined?**
- Resolution: Manual user action. User changes tutorial status to "completed" via UI or API (`tutorial.status.changed` event). No automatic completion detection in V1. V2 may introduce heuristics (e.g., user spent X time on linked content), but V1 is explicit user action only.
- Surfaced: Engagement Dashboard (tutorial pipeline funnel)

**Gap 4: Enrichment success — what constitutes "full" vs. "partial" vs. "failed"?**
- Resolution: Enrichment outcome categories:
  - **Full:** Title + description + type-appropriate metadata all populated
  - **Partial:** Title populated but description or type-specific metadata missing
  - **Failed:** No metadata extracted (timeout, SSRF blocked, parse error, unreachable URL)
- Each `save.enrichment.completed` event includes `enrichment_outcome` field. Stefania tracks partial rate separately from failure rate — a high partial rate means the enrichment logic needs improvement for specific domains.
- Surfaced: Enrichment Dashboard (Stephen's operational domain, but Stefania cares about partial enrichment impacting content quality)

**Gap 5: Analytics query performance — no SLA defined**
- Resolution: All Analytics API endpoints must respond in < 3 seconds. This is achievable because dashboards query pre-computed rollups (Pattern A and B outputs), not raw logs. Ad-hoc CloudWatch Logs Insights queries (Pattern C) may take longer — up to 30 seconds — and are acceptable for drill-down investigation, not dashboard rendering.

**Gap 6: iOS Shortcut failure tracking**
- Resolution: The iOS Shortcut calls the save API directly. Failures are captured as standard API errors (`api.request` with non-2xx `status_code` where `client_type = ios_shortcut`). Shortcut setup completion is tracked via `user.shortcut.setup.completed` event (emitted when first successful save arrives from ios_shortcut surface). No separate Shortcut-specific error tracking needed — it's an API client like any other.

**Gap 7: Anonymous aggregate counts without user attribution**
- Resolution: Content-layer record in DynamoDB includes a `save_count` field (atomic counter, incremented on each `save.created`, decremented on delete). This stores "how many users saved this URL" without storing which users. The user-layer records are in a separate table with user_id partition keys — joining them requires deliberate cross-table query that is only used by V2's recommendation engine, never exposed in UI.
- Deferred: V2's recommendation engine will need a more sophisticated approach (collaborative filtering). V1 only needs the counter.

**Gap 8: Persona type re-evaluation cadence and migration tracking**
- Resolution: Covered above in Layer 5. Weekly evaluation, migration history stored. Re-evaluation is part of the Pattern B weekly batch.

#### Layer 7: Monitoring the Monitoring — Measurement Infrastructure Alerts

The measurement infrastructure itself must be monitored. If the system that measures the product is broken, every decision made from the dashboards is wrong.

| Alert | Level | Trigger | Why |
|-------|-------|---------|-----|
| **Weekly batch Lambda failure** | Warning | Pattern B Lambda errors or times out | Stefania's dashboards go stale. Must know immediately. |
| **Weekly batch Lambda staleness** | Warning | No `weekly_cohort_snapshot` written in 8+ days | Catches silent failures — Lambda ran but produced nothing. |
| **Daily user activity write failure** | Warning | Pattern A DynamoDB write errors > 0 in 5 minutes | Milestone tracking and daily rollups are degrading. |
| **Analytics API latency** | Warning | Analytics API p95 > 5 seconds for 10 minutes | Dashboards are slow — investigate query performance. |
| **Milestone write-behind** | Informational | Gap between event timestamp and milestone record timestamp > 60 seconds | Pattern A synchronous writes are lagging — early signal of throughput issue. |

These alerts are added to Stephen's existing tiered alert system (see Observability section). They monitor the measurement layer, not the product layer.

**Architecture note:** Pattern A (synchronous DynamoDB writes on each event, ~10-20ms) is appropriate at V1 boutique scale. If user base ever exceeds 500 concurrent active users, evaluate DynamoDB Streams + batch increment to avoid hot key contention on `daily_user_activity` records. This is a V4 concern at earliest.

#### Layer 8: Measurement Pipeline Smoke Test — Automated Day-Zero Validation

The measurement infrastructure must be tested the same way the product is tested — automated, in CI/CD, with structured output. No manual checklists.

**What it is:** A dedicated automated test suite (Lambda or test runner) that exercises the full measurement pipeline end-to-end using a synthetic test user.

**Test sequence:**

1. **Event emission check:** Creates a synthetic test user (flagged `synthetic: true` in metadata so dashboards can filter). Performs one of every action in the event catalog — save, link, note (manual + LLM output), project create, status change, tutorial progress, delete save, delete project, delete note, deactivate account. Asserts each event appears in CloudWatch Logs with all metadata fields populated and non-null.

2. **Pattern A validation:** After each action, reads the `daily_user_activity` record for the test user. Asserts: correct additive counter incremented, correct deletion counter incremented on deletes, `active_project_count` accurate after creates and deletes, all metadata fields non-null. Reads `user_milestones` and asserts: milestones set on first occurrence, milestones NOT cleared on deletion (write-once policy).

3. **Pattern B validation:** Triggers the weekly batch Lambda for the test cohort. Reads resulting snapshots and asserts: `weekly_cohort_snapshot` written with correct counts, `weekly_funnel_snapshot` has non-zero data for all 7 funnel stages, `weekly_persona_snapshot` classifies the test user correctly based on synthetic behavior. Validates `computed_at` timestamp is present.

4. **Analytics API validation:** Calls every Analytics API endpoint. Asserts: response < 3 seconds, response contains test user's data, small-N display format present when applicable, all endpoints return valid JSON.

5. **Alert validation:** Emits a deliberate error condition (e.g., malformed event). Asserts the appropriate CloudWatch Alarm transitions to ALARM state within 60 seconds. Resets alarm after validation.

6. **End-to-end trace validation:** Performs a save via the API, extracts the X-Ray trace ID from the response headers. Queries X-Ray and asserts: trace contains segments for API Gateway, Lambda, and DynamoDB. This is Stephen's persona signal 1, automated.

7. **Cleanup:** Deletes the synthetic test user and all their data. Verifies deletion events fire correctly.

**When it runs (staging — full smoke test):**
- **Post-deploy (staging):** Full suite runs as part of CD pipeline after staging deploy. Failure blocks production deploy.
- **Weekly (Thursday, after the catch-up batch):** Runs in staging to verify the measurement pipeline is still healthy. Catches drift — e.g., a frontend change that silently drops `device_type` from events.

**When it runs (production — lightweight heartbeat only):**
Production does NOT run the full smoke test (no synthetic data creation, no cleanup risk). Instead, a lightweight heartbeat runs:
- Calls one Analytics API endpoint, asserts response < 3 seconds and valid JSON
- Checks that the most recent `weekly_cohort_snapshot` is < 8 days old (staleness check)
- Checks that all CloudWatch Alarms are in OK state (not ALARM or INSUFFICIENT_DATA)
- **No synthetic data creation, no cleanup needed.** Zero risk to production data.
- Runs: post-deploy production, weekly Thursday after catch-up batch.
- Failure fires Warning alert.

**Output:** Structured JSON (same pattern as the agent-invokable test suite). Results available via API. A future GenAI ops agent can ask "did the measurement pipeline smoke test pass last Thursday?"

**V1 scope impact:** This is a new V1 deliverable. The measurement pipeline smoke test (staging) and heartbeat (production) are as important as the product E2E tests — if the measurement system is broken and we don't know, every decision from the dashboards is wrong.

**Explicitly deferred to V2 (not gaps — intentional non-requirements):**
- Connection quality assessment (V2 intelligence layer)
- Search quality metrics beyond latency (V2 semantic search)
- Cross-user recommendation relevance metrics (V2 collective graph)
- MCP server usage metrics (V2 feature)
- Agent-generated save/link tracking (V2 feature)
- A/B testing framework (V2, when there are enough users to test against)
- Real-time or daily monitoring cadence for product metrics (V4 — weekly is correct for boutique scale)

---

## MVP Scope

### Build Philosophy: Vertical Slices, Not Horizontal Layers

**V1 is the full scope defined in this brief. It is not V1 until all of it ships.** There is no "V1.0 MVP" that declares partial success. V1 means every feature, every dashboard, every doc track, every security hardening, every persona E2E test described in this brief is live. Calling something "V1" that delivers less than the full brief is an anti-pattern — it creates permission to declare success without finishing the work.

**The path to V1 is v0.x increments.** Each increment is a vertical slice — infrastructure + code + tests + documentation for that slice — not a horizontal layer (all infra, then all API, then all docs). The difference matters: horizontal layers produce months of invisible progress before anyone can use anything. Vertical slices produce usable capability at every step.

**Seven principles govern the increment sequence:**

1. **Every increment is usable by someone** — even if that someone is Stephen via curl. If an increment doesn't change what someone can DO, it's not an increment — it's busywork.
2. **Infrastructure grows with the product** — don't provision what you can't use yet. DynamoDB tables are created when the endpoints that query them ship. S3 buckets appear when notes are implemented. WAF ships when the API goes public (the API is internet-facing before the frontend). No idle resources burning money.
3. **Tests ship with the code they test** — not in a later phase. The pipeline enforces coverage from increment 1. If it deploys, it's tested. See "Testing Mandate" section below — this is non-negotiable.
4. **Docs ship with the feature they document** — not in a documentation phase. The API reference grows with every endpoint. The tech writer agent is involved from v0.2, not parachuted in later.
5. **Security ships with the feature it protects** — per-user data isolation is tested from the first endpoint. SSRF protection ships with the enrichment Lambda, not before it. WAF ships when the API goes public (v0.2), not when the frontend ships. An internet-facing API without WAF is an unnecessary risk.
6. **The most critical user flow (mobile capture) ships as early as physically possible.** The brief's own pre-mortem says "if capture isn't dead simple from day one, the platform becomes a graveyard." Mobile capture is v0.5, not v0.9.
7. **Dashboards and analytics ship when there's data to analyze.** Building charts that render zeros is waste. Operational monitoring ships incrementally as the things it monitors come online. Product analytics dashboards ship after real users generate real data.

**Anti-pattern this prevents:** Architecture astronaut syndrome — building the "final architecture" upfront and then filling it in. That's waterfall with version numbers. Each v0.x increment should change what the system can DO, not just what it COULD do.

### A Day With the Hub

Every technical decision in this brief exists to serve a human moment. These four sketches ground the architecture in real life — and become the test scripts for UX Design later.

**Morning commute — Maya captures.** Stephen hears a podcast mention a cool AI tool. He taps Share on his iPhone, the iOS Shortcut fires, and within a second his phone confirms the save. By the time he's off the train, the hub has the URL stored. By lunch, enrichment has populated the title, show name, and episode description. He never opened the app — the fuel loop ran in the background of his life.

**Weekend project time — Marcus builds.** Saturday morning, Marcus opens the hub on his laptop. He searches "RAG tutorial" and finds 3 saves he'd stashed over the past month — enriched with difficulty tags and time estimates. He creates a new project called "RAG Pipeline v1," links the tutorials, and pastes a Claude conversation into the project notes. The workspace is a living notebook: saves on the left, notes in the center, project status at the top. He marks a tutorial "completed" and moves the project to "building."

**Sunday evening — Stefania operates.** Stefania opens the analytics dashboard with her Sunday coffee. Adoption funnel shows 2 new signups this week, both from invite codes. Retention cohort table (small-N, showing absolute numbers because the denominator is 12) shows week-2 retention at 75%. She runs `admin:user:activity` on a quiet user — they saved 6 items but created zero projects. She flags this as an onboarding gap to investigate. The CLI and dashboards tell the same story from different angles.

**Tuesday deploy — Stephen ships.** Stephen merges a PR for v0.4 search. GitHub Actions runs: lint, type check, CDK synth, unit tests, integration tests against DynamoDB Local, contract tests, security tests (cross-user isolation), coverage gate (82% — passes). The pipeline deploys to staging. He runs the E2E smoke tests: Marcus flow saves → links → searches → finds. Green. He promotes to prod. CloudWatch dashboard shows the new search endpoint responding at p50=45ms. X-Ray trace confirms the full request path. The search latency alarm is armed at p95 >500ms. If something degrades, his phone buzzes before any user notices.

### Search Store Decision: DynamoDB-Only for V1

**Decision: No external search store in V1. DynamoDB is the search engine, using a dedicated search-index table.**

The brief previously assumed a "dual data store" (transactional + search/discovery) implemented as DynamoDB + OpenSearch or equivalent. That assumption was made under scale ambiguity. With the target audience defined at 20 users, ~80 saves/week, and ~20 active projects, the "dual store" architecture is implemented as **two sets of DynamoDB tables** — transactional tables and a dedicated search-index table — not DynamoDB + an external search service.

**How this works:**
- **Transactional tables** are the source of truth for all entity state (saves, projects, notes, etc.).
- **Search-index table** is a denormalized, read-optimized table combining save metadata + project metadata + note content previews. Optimized for scan + filter queries.
- **DynamoDB Streams** propagate changes from transactional tables to the search-index table automatically. When a save is created or updated, a stream trigger writes a flattened search record.
- **Search queries hit the search-index table only.** Never scan the transactional tables for search.
- **If DynamoDB search degrades:** replace the search-index table with Algolia, SQLite-on-Lambda, or another search engine. The DynamoDB Stream still feeds it. The search repository interface (see ADR-9) doesn't change. Swapping the search backend is an implementation change, not an architecture change.

**Search latency tripwire:** A CloudWatch alarm is set in v0.4 (when search ships) for search endpoint p95 latency > 500ms. This is the signal to evaluate an external search store. Don't wait for user complaints — instrument the degradation signal from day one.

**Scale expectations:**
- At 5,000-10,000 saves (year one): DynamoDB scan with filters on the search-index table is fast (~50-100ms). Adequate for V1.
- At 50,000+ saves: Re-evaluate. Options: Algolia free tier (10K records, 10K searches/month), SQLite FTS5 on Lambda via S3, or a managed service if budget allows.
- For V2 vector/semantic search: Evaluate pgvector, Pinecone free tier, or equivalent when V2 development begins. This is a V2 cost.

**Cost:** DynamoDB Streams are free for the first 2.5 million read requests/month. The search-index table costs the same as any other DynamoDB table — pennies on-demand at this scale. Total incremental cost: ~$0.

**This updates ADR-1 (Search/Discovery Store Technology Choice) from OPEN to DECIDED for V1.** V2 re-opens this decision when semantic search requirements are concrete.

### V1 Cost Target

**Total V1 infrastructure cost: < $50/month.** This is a hard constraint, not a guideline.

**Target usage profile:** 20 users, each active ~2x/week, ~4 saves per session, ~1 project per user.

| Service | Monthly Estimate |
|---------|-----------------|
| DynamoDB (on-demand) | $1-2 (free tier covers most at this scale) |
| DynamoDB Streams | $0 (free tier: 2.5M reads/month) |
| S3 (notes, images) | $0.50 |
| Lambda | $0-1 (free tier: 1M requests/month) |
| API Gateway | $1-3 |
| CloudFront | $1-2 |
| CloudWatch (logs, metrics, dashboards, alarms) | $5-10 |
| X-Ray | $0 (free tier: 100K traces/month) |
| WAF | $6-8 (1 Web ACL + managed rules) |
| Clerk/Auth0 | $0 (free tier covers 20 users) |
| **Total** | **$15-27/month** |

Any technology choice that pushes total cost above $50/month is rejected unless it replaces something more expensive. This constraint eliminates OpenSearch, Aurora, dedicated EC2 instances, and most managed search services. DynamoDB + Lambda + S3 + CloudFront is the cost floor. Everything else earns its place.

**Architecture phase deliverable: per-increment cost model.** The table above is a V1 steady-state estimate. The Architecture phase must produce a bottom-up cost projection for each increment (v0.1 through v0.10) showing expected monthly cost at that point in the build. This makes the <$50 target verifiable at every stage — not just at V1 declaration. If v0.4 is already costing $40/month, that's a signal to re-evaluate before v0.5 adds more services.

**Rate limiting as cost guardrail:** API key rate limits (per ADR-8: 100 req/min per key, separate read/write counters) are not just abuse prevention — they are cost protection. DynamoDB on-demand pricing scales linearly with requests. If an agent fires 10,000 requests in an hour, the bill spikes. Rate limits cap the per-user cost exposure. Standard 429 responses with `Retry-After` header.

### Testing Mandate (Non-Negotiable)

Testing is not an aspiration — it is a gate with teeth. The pipeline is the second pair of eyes for a solo builder. If the pipeline passes, you can deploy with confidence. If it doesn't, nothing ships.

**Test layers required for every increment:**

| Layer | What It Tests | When It Starts | Enforced By |
|-------|--------------|----------------|-------------|
| **Unit tests** | Every function, utility, repository method. Repository pattern (ADR-9) makes this clean: mock the DynamoDB client, test logic in isolation. | v0.1 | 80% coverage threshold in CI. PR fails if coverage drops. |
| **Integration tests** | Every API endpoint exercised with real DynamoDB Local. Request → Lambda handler → repository → DynamoDB Local → response. Catches wiring errors unit tests miss. | v0.2 (first endpoints) | CI pipeline. DynamoDB Local runs as Docker container in GitHub Actions. |
| **Contract tests** | Pin API response schema. Every endpoint has a test asserting response shape. New fields (backward compatible) pass. Removed/renamed fields fail. OpenAPI spec generated from these tests — tests are source of truth. | v0.2 (first endpoints) | CI pipeline. Schema violations block merge. |
| **Security tests** | Cross-user data isolation on every data-accessing endpoint. User A's JWT must never return User B's data regardless of parameter manipulation. Markdown sanitization with XSS payloads. | v0.2 (first endpoints) | CI pipeline. Runs on every push, not quarterly. |
| **E2E smoke tests** | Persona golden path flows. Accumulate from v0.5: Marcus flow first, then Maya, Priya, Dev, Stephen added as UI and features ship. By v0.10, all persona flows run on every push. | v0.5 (first UI) | CI pipeline. Catch cross-increment regressions. |
| **Measurement pipeline tests** | Full smoke test (staging): synthetic user exercises all events, validates Pattern A/B/C computation, analytics API responses. Lightweight heartbeat (production). Per Layer 8 spec. | v0.8 (analytics foundation) | CI pipeline (staging). Weekly scheduled run. |

**CI pipeline gates (every PR, no exceptions):**
- Coverage below 80% → PR blocked
- Any unit, integration, contract, or security test fails → PR blocked
- Linting or type checking fails → PR blocked
- CDK synth fails → PR blocked
- Dependency scan finds critical/high vulnerability → PR blocked (`npm audit`, Dependabot/Snyk)

**DynamoDB Local in CI from v0.1.** The test framework needs a local DynamoDB instance for integration tests. Docker container in GitHub Actions. Costs nothing. Without it, integration tests either hit real AWS (slow, costs money, flaky) or don't exist.

### Data Access Architecture (ADR-9 + ADR-10)

Two new architecture decisions that shape the entire V1 implementation:

**ADR-9: Repository Pattern with Interface Boundary**

All data access goes through repository interfaces. No Lambda handler calls the DynamoDB SDK directly. Ever.

- `SaveRepository`, `ProjectRepository`, `SearchRepository`, `InviteRepository`, `AnalyticsRepository`, etc.
- Each repository has an interface (what it does) and an implementation (how it does it with DynamoDB).
- Lambda handlers depend on the interface. Tests mock the interface. Integration tests use the real implementation against DynamoDB Local.
- Swapping a data store means writing a new implementation of the repository interface. No handler changes. No API contract changes. No test rewrites (except the implementation tests).

**Why this matters:** The brief says "dual data store" and "V2 may require different stores." The repository pattern is the insurance policy. It costs 1-2 files per entity type. The insurance is enormous: database portability, clean testing, separation of concerns.

**ADR-10: Multi-Table DynamoDB Design with Search Index**

Multi-table design. One table per entity type. Separate search-index table fed by DynamoDB Streams.

**Transactional tables (source of truth):**

| Table | Purpose | Partition Key | Sort Key |
|-------|---------|--------------|----------|
| `content-layer` | Global URL records (one per unique URL) | `url_hash` (SHA-256 of normalized URL) | — |
| `user-saves` | Per-user save records | `user_id` | `save_id` |
| `projects` | Per-user projects | `user_id` | `project_id` |
| `project-folders` | Per-user folder organization | `user_id` | `folder_id` |
| `invite-codes` | Invite system | `code` | — |
| `analytics-summary` | Rollups, milestones, snapshots | Varies by record type (see Layer 4 spec) | Varies |

**GSIs on transactional tables:**
- `user-saves` GSI: partition by `url_hash` → "give me all users who saved this URL" (V2 collective graph)
- `user-saves` GSI: sparse index on `is_tutorial = true` → efficient Tutorial Tracker view
- `projects` GSI: partition by `folder_id` → projects in a folder
- Additional GSIs defined during architecture phase per access pattern analysis

**Search table:**
- `search-index` — denormalized, read-optimized. Flattened fields from saves + projects + note content previews. Fed by DynamoDB Streams from transactional tables. All search queries hit this table only.

**Why multi-table over single-table:** At boutique scale (20 users), single-table design's performance advantage is meaningless. Multi-table is dramatically easier to test, debug, and reason about for a solo builder. Each repository maps cleanly to one table. Each table can be independently migrated if needed. Single-table design is the right call at Netflix scale; it's premature optimization here.

### Seeded Onboarding Content Spec

Seeded onboarding is a product quality item, not a side task. The content must be curated, reviewed, and finalized before the UI that renders it exists.

**Deliverable: `/docs/seeded-content-spec.md` — due by v0.3.**

**3 Starter Projects:**

| # | Project Title | Theme | Target Persona | Description Tone |
|---|--------------|-------|---------------|-----------------|
| 1 | "Build a Custom GPT" | Gentlest on-ramp. Creating a custom GPT for a real use case. | Maya / Priya | Accessible, encouraging. "You can build this in an afternoon." |
| 2 | "AI Automation for Your Day Job" | Automating real workflows with AI tools. No code required. | Maya | Practical, outcome-focused. "Save 2 hours a week." |
| 3 | "Build a RAG Pipeline" | Deeper technical build. Retrieval-augmented generation. | Marcus | Still accessible but assumes comfort with technical concepts. |

**Per project:** Title, 2-3 sentence description, 5-6 linked saves (curated real URLs — 2 podcasts, 2 blogs/YouTube, 1-2 tutorials), 1 starter note with a "what you'll learn" overview. All language follows the "write for the marketer" UX principle.

**Curation owner:** Stephen (editorial work, not engineering). Spec written and reviewed by v0.3. Content loaded into the system during v0.6 when seeded onboarding ships.

### V0.x Increment Plan: The Path to V1

Ten increments. Each one deployable, testable, and usable. The pipeline is the first thing built; every subsequent increment flows through it.

---

**v0.1 — Pipeline + Skeleton**
*Deploy nothing. Deploy it safely.*

- CDK project (TypeScript), multi-stage config (dev, staging, prod)
- GitHub Actions CI/CD: lint, type check, CDK synth, test, deploy
- Test framework initialized (unit + integration, 80% coverage threshold enforced)
- DynamoDB Local in CI pipeline (Docker container in GitHub Actions for integration tests)
- Dependency scanning: `npm audit` in CI pipeline + Dependabot/Snyk configured on the repository. Runs on every push. Vulnerability alerts block merge for critical/high severity.
- Branch protection, PR template, issue templates
- Repository structure (`/infra`, `/backend`, `/frontend`)
- Repository pattern scaffolding: base interfaces for repository pattern (ADR-9)
- Structured logging utility (the logging contract — reusable across all future Lambdas)
- X-Ray tracing utility (handler wrapper — every Lambda gets tracing automatically)
- Input validation middleware (reusable: URL scheme, field lengths, UTF-8)
- **Security principle established:** Every Lambda gets a custom least-privilege IAM policy defined in CDK. No managed broad-access policies (e.g., `AmazonDynamoDBFullAccess`) anywhere in the stack. Each Lambda's IAM role grants only the specific actions on the specific resources it needs. This is enforced by CDK Nag rules from v0.1 onwards.
- **Credential policy established:** No long-lived credentials anywhere in the system. All Lambda access via IAM roles (temporary credentials). All user auth via Clerk/Auth0 JWTs (short-lived tokens). User API keys are the only long-lived credential — and they are user-managed with revocation capability.
- **Gate:** Pipeline deploys an empty CDK stack to AWS. A dummy Lambda logs a structured event with all contract fields and appears in X-Ray. Tests run and pass (unit + integration against DynamoDB Local). Coverage gate works. Dependency scan runs clean.

---

**v0.2 — Auth + First Save**
*Stephen can curl a save.*

- DynamoDB tables: `content-layer`, `user-saves` (with GSIs for user partition + content partition)
- DynamoDB Streams configured on `user-saves` (ready for search-index sync in v0.4)
- Clerk/Auth0 integration (social auth, JWT validation on API Gateway)
- Invite code system: `invite-codes` table, generation, validation, redemption (crypto-random, rate-limited). **Invite code validation happens ONLY during the signup transaction** — no standalone `/validate-invite` endpoint. No way to probe code validity without attempting a full signup with a valid Clerk/Auth0 token. Generic error on invalid code (don't reveal whether code exists vs. already used).
- API Gateway: authenticated, throttled, usage plans, rate limiting per API key (cost guardrail)
- **WAF on CloudFront** (AWS Managed Rules, rate-based rules, bot detection). Deployed now — the API is internet-facing from this increment. An API without WAF is an unnecessary risk regardless of whether a frontend exists yet. Cost: ~$6-8/month, already budgeted.
- **CORS policy on API Gateway:** Restrictive from day one. Only the CloudFront origin is allowed. Preflight caching enabled. No wildcard origins. Dev's agents and iOS Shortcut don't use browsers so CORS doesn't affect them.
- Repository implementations: `SaveRepository`, `ContentLayerRepository`, `InviteRepository`
- Save endpoints: POST /saves, GET /saves (paginated), GET /saves/:id, DELETE /saves/:id
- **API key scoping model:**
  - **Full API key** — all endpoints, read + write. Generated in account settings. For Dev's agents and general API use.
  - **Capture-only key** — POST /saves only. Write-only, single endpoint. No read access, no project access, no admin access. Generated during iOS Shortcut onboarding. If compromised, attacker can only create saves in the user's account — no data exfiltration, no project modification, no account takeover. User revokes and regenerates.
- URL normalization (top 5 domains: YouTube, GitHub, Spotify, Apple Podcasts, general web)
- Content layer dedup (normalized URL hash lookup before insert)
- Auto-detect source type from domain (instant, no network call)
- User layer record: roles (is_resource, is_tutorial), tags, visibility flag
- Per-user data isolation enforced at repository layer
- Structured logging + X-Ray on all Lambdas
- CloudWatch alarm: API error rate > 1% → phone
- **Tests:** Unit (repository logic, normalization, dedup), integration (save CRUD against DynamoDB Local), contract (save API response schema pinned), security (cross-user isolation — User A cannot read User B's saves, capture-only key cannot call GET endpoints)
- **Docs:** Save API endpoint documented (OpenAPI spec from contract tests)
- **Gate:** Stephen signs up with invite code, saves 5 URLs via curl, gets them back paginated. Cross-user data access attempt returns 403. Capture-only key rejected on GET /saves. WAF blocks a simulated SQL injection attempt. Alert fires on simulated error. Contract tests pin the v1 save response schema. iOS Shortcut prototype works with capture-only key (Shortcut → save API → confirmed).

---

**v0.3 — Projects + Links**
*The core loop works: save → project → link.*

- DynamoDB tables: `projects`, `project-folders`
- Repository implementations: `ProjectRepository`, `FolderRepository`
- Project endpoints: CRUD, status transitions (exploring → building → live → improving → archived), folders CRUD
- Link/unlink endpoints: save ↔ project (many-to-many)
- Tags CRUD on saves and projects
- Save role toggling (is_resource, is_tutorial)
- Tutorial status tracking (not started → started → completed → archived)
- All V1 Event Catalog events emitting to structured logs
- CloudWatch alarms: DynamoDB throttling, Lambda errors > 5%
- Contract tests: project + link API response schemas pinned (backward compatibility enforced)
- **Tests:** Unit (project lifecycle, status transitions), integration (link/unlink, folder operations, tutorial status, event emission against DynamoDB Local), contract (project/link schemas), security (cross-user project isolation)
- **Docs:** Project + Link + Tutorial API documented
- **Deliverable:** Seeded content spec (`/docs/seeded-content-spec.md`) — 3 project themes, curated URLs, descriptions, starter notes. Reviewed and finalized.
- **Gate:** Stephen creates a project, saves 3 URLs, links them, changes project status to "building," marks a tutorial as "completed." Full activity trail visible in structured logs. Seeded content spec reviewed.

---

**v0.4 — Notes + Search**
*Projects become living notebooks. Content is findable.*

- S3 bucket for notes (versioning enabled)
- DynamoDB table: `search-index` (denormalized, read-optimized)
- DynamoDB Streams: `user-saves` and `projects` changes propagate to `search-index`. **Stream consumer Lambda IAM:** custom least-privilege policy — read from Stream ARN only, write to `search-index` table only. No S3 access, no other table access, no internet access (no VPC NAT gateway). This Lambda sees all user data flowing through the Stream; minimal IAM limits blast radius if compromised. **Critical implementation detail:** The Stream consumer must use `UpdateItem` with specific attribute updates (read-modify-write), NOT `PutItem` (full replace). A save is written to the search-index on creation (user tags, roles, project links). Enrichment updates the content-layer later, triggering a second Stream event. If the consumer does a full `PutItem` on the second write, it overwrites the user's tags/links with just the enrichment metadata. `UpdateItem` merges both writes correctly.
- DynamoDB Streams also feed a **real-time analytics consumer Lambda** (Pattern A). Instead of inline analytics writes in every action handler, the analytics increment (`daily_user_activity`, `user_milestones`) is handled by a dedicated Stream consumer. This decouples action reliability from analytics reliability — if the analytics Lambda fails, the save/project action already succeeded and the Stream retries. Action handlers stay fast (one DynamoDB write, not two). Analytics are eventually consistent (milliseconds behind, acceptable at weekly reporting cadence). Uses the same Stream infrastructure as search-index sync. The analytics consumer Lambda gets its own least-privilege IAM: read from Stream ARNs, write to `analytics-summary` table only.
- Repository implementations: `NotesRepository` (ADR-3 hybrid storage), `SearchRepository` (interface boundary — currently backed by DynamoDB search-index, swappable per ADR-9)
- Notes endpoints: CRUD for project notes and save notes (S3-backed via ADR-3 hybrid storage, DynamoDB pointers)
- Markdown storage (raw, as-is). Sanitization on read (DOMPurify or equivalent, allowlist-only).
- Lazy loading: 400KB max per request, chunked S3 fetch for large notes
- Search: queries hit `search-index` table only. Filters by source type, role, tags, project. Full-text matching on denormalized searchable text field.
- CloudWatch alarm: search endpoint p95 latency > 500ms (search latency tripwire — signals need for external search store)
- **Tests:** Unit (notes repository, search repository, Markdown sanitization), integration (notes CRUD, large note pagination, search accuracy against DynamoDB Local, DynamoDB Streams propagation), contract (notes/search schemas), security (Markdown XSS payloads rejected, search returns only authenticated user's data)
- **Docs:** Notes + Search API documented
- **Gate:** Stephen pastes a Claude conversation into project notes (Markdown), searches for a phrase from it, finds it via search-index table. `<script>` tag stripped on render. Search returns only authenticated user's data. Search latency alarm configured and tested.

---

**v0.5 — Mobile UI + iOS Shortcut**
*Maya can save. The fuel loop starts.*

- React + Vite frontend deployed to S3 + CloudFront (WAF already deployed on CloudFront in v0.2 — frontend inherits protection automatically)
- Mobile-optimized responsive layout
- Auth flow (Clerk/Auth0 social login + invite code entry)
- Save flow: paste URL, auto-detect content type, optional tags
- Browse saves: filter by source type, role, tags
- Project list: folders, project cards with status
- Project detail: linked saves, notes (Markdown rendered + sanitized), status management
- Link saves to projects (inline, contextual — not a separate workflow)
- Search bar (full-text via search-index)
- iOS Shortcut: built, tested, distributed as iCloud link
- Guided onboarding page for iOS Shortcut setup (import question flow)
- API key generation in account settings
- Android share target via PWA manifest
- Post-save feedback (inline confirmation, no page reload)
- **Tests:** E2E smoke — Marcus flow (save → project → link → notes → search). This is the first persona E2E test; subsequent increments add more.
- **Docs:** iOS Shortcut setup guide, user-facing "Getting Started" draft
- **Gate:** Maya signs up on her phone, saves a podcast via iOS Shortcut in 2 taps, opens the web app, sees her save, links it to a project. Marcus E2E smoke test passes in CI. The fuel loop works on mobile.

---

**v0.6 — Desktop UI + Seeded Onboarding**
*Marcus can build. New users see a live workbench, not a blank screen.*

- Desktop-optimized layout (different information density and navigation from mobile — not mobile scaled up)
- Project workspace: Markdown notes editor with preview, linked saves panel, tags, status management
- Resource Library view: grouped/filtered by source type
- Tutorial Tracker view: pipeline (status-based filtering/grouping)
- My Projects view: folders, search within projects
- Tablet layout: desktop experience with touch-friendly tap targets
- Seeded onboarding: "Getting Started" folder with 3 starter projects + curated resources (loaded from seeded content spec finalized in v0.3). **Seeded content flagging:** Content-layer records for seeded URLs get a `seeded: true` flag. When V2's collective graph computes cross-user recommendations, seeded saves are excluded from relevance signals — every user has them, so they carry zero discovery value. `save_count` on seeded URLs reflects onboarding automation, not organic user discovery. Without this flag, seeded content dominates the collective graph with artificial signal.
- Screenshot-friendly project views (Maya's Slack screenshot use case)
- **Tests:** E2E smoke — Maya flow added (share sheet save → browse → link to project → view on desktop). Marcus + Maya flows now both run on every push.
- **Docs:** User guide updated for desktop workflows
- **Gate:** Marcus opens his laptop, creates a project, pastes a Claude conversation into notes, links 3 saves, searches his notes. New user signs up and sees seeded projects with curated resources. Project page looks clean in a screenshot. Marcus + Maya E2E tests green.

---

**v0.7 — Enrichment + Operational Monitoring**
*The system gets smarter about saved content. The platform tells Stephen when something's wrong.*

- Enrichment Lambda: hourly batch, fetch OG tags, titles, descriptions, type-specific metadata. **Backfill on first run:** v0.7 is the first increment with enrichment. All saves created during v0.2-v0.6 are unenriched. The enrichment Lambda's first run must process the full backlog of unenriched saves, not just new ones. This backfill is critical because persona heuristics in v0.8 depend on enriched content metadata for classification (Marcus-type vs Maya-type is determined partly by what domains they save from, which requires enriched type-specific metadata). Subsequent runs process only newly unenriched saves (normal hourly cadence).
- Lambda VPC config (SSRF protection — deny private IPs, metadata endpoints, non-HTTPS)
- Enrichment metadata sanitization (strip HTML, validate UTF-8, truncate, XSS prevention)
- Content layer mutation logging (before/after state, separate log group, 90-day retention)
- Graceful degradation: enrichment fails → save keeps raw URL and user-entered metadata
- **Enrichment change detection:** On re-enrichment of previously enriched URLs, compare new metadata to existing. If title changed >50% (Levenshtein distance) OR description changed >80%, flag the content-layer record as `enrichment_status: review_needed` instead of auto-updating. Prevents content poisoning where a malicious actor serves benign content initially then changes it to malicious Open Graph tags after first enrichment. `admin:content:review-flagged` CLI command to list flagged records and approve/reject. Normal metadata evolution (minor SEO tweaks, typo fixes) auto-updates as expected.
- 4 CloudWatch operational dashboards (System Health, Enrichment, Product Usage, Security & Abuse — now populated with real traffic from v0.2-v0.6)
- Full alerting set: all critical + warning + informational thresholds from the brief
- API Gateway access logging (90-day retention)
- **Tests:** Unit (enrichment parsing, metadata sanitization), integration (enrichment success/failure/partial paths, SSRF rejection, mutation logging, graceful degradation, content-layer update via repository). E2E smoke — Priya flow added (signup → seeded projects visible → save URL → enrichment populates metadata).
- **Docs:** Enrichment pipeline documented, observability guide (log queries, X-Ray traces, dashboard walkthrough)
- **Gate:** Save a YouTube URL → enrichment populates title + channel name within an hour. Save a URL pointing to 169.254.169.254 → SSRF blocked, alert fires. Dashboards show real API traffic and enrichment stats. Stephen can trace a request end-to-end via X-Ray. Marcus + Maya + Priya E2E tests green.

---

**v0.8 — Admin Tooling + Analytics Foundation**
*Stephen and Stefania can operate and analyze. Real users are generating real data.*

- Admin CLI: all 10 commands as Lambda functions (user:activity, user:suspend/unsuspend, content:remove/reenrich, content:review-flagged, invite:revoke/list, enrichment:status, search:sync-status)
- Analytics summary table: `analytics-summary` in DynamoDB. Weekly rollups computed by Pattern B batch Lambda. Real-time increments (`daily_user_activity`, `user_milestones`) now handled by the Stream-based analytics consumer Lambda deployed in v0.4 — Pattern A is already running and populating data by the time v0.8 ships.
- Analytics API: all endpoints (adoption, engagement, retention, churn, funnel, personas)
- **Dual-entry Lambda pattern:** Admin CLI and Analytics API are backed by the SAME Lambda functions with two invocation paths. Each analytics Lambda detects its invocation source (API Gateway HTTP event vs. direct `aws lambda invoke` from CLI) and formats output accordingly (JSON for API, formatted terminal output for CLI). This halves the number of Lambda functions to build and maintain, and guarantees CLI and API always return identical data. The pattern also future-proofs for V2's GenAI agent, which will invoke the same Lambdas via MCP tools — a third entry point, same functions.
- Persona segmentation heuristics (manual-first with automated secondary, per Layer 5 spec)
- Admin CLI analytics commands (retention, engagement, funnel, churn-risk, growth, content-mix, personas, report)
- User milestones tracking (write-once, per Layer 4 spec)
- Measurement pipeline smoke test (staging — full suite, production — lightweight heartbeat)
- **Tests:** Unit (analytics rollup logic, persona heuristics), integration (admin CLI commands, analytics API endpoints, milestone writes, measurement pipeline smoke test). E2E smoke — Dev flow added (API key generation → scripted saves → query via API). Measurement pipeline smoke test green in staging.
- **Docs:** Admin CLI documentation, investigation playbooks, analytics API reference
- **Gate:** `admin:user:activity <user_id>` returns a full timeline. Analytics API returns real cohort retention data. Persona heuristics classify a mobile-heavy user as Maya-type. Measurement pipeline smoke test passes in staging. Marcus + Maya + Priya + Dev E2E tests green.

---

**v0.9 — Analytics UI + PWA Polish**
*Stefania's Sunday evening review works. The mobile experience feels native.*

- Analytics web UI (React/Vite, admin-only auth, bookmarkable URL)
- 5 product analytics dashboards: Adoption, Engagement, Retention, Churn & Risk, Persona Health
- Small-N display rule enforced (percentage + absolute numbers when denominator < 20)
- Cohort retention as tables when cohort size < 10
- All dashboard widgets consume Analytics API from v0.8
- PWA polish: service worker, offline handling, "Add to Home Screen" refinement
- Push notifications (iOS 16.4+, Android — enrichment completion, project activity)
- **Tests:** Integration (dashboards render with real data, small-N rule works, PWA install flow). E2E smoke — Stephen flow added (deploy → smoke test endpoints → verify structured log format → verify alarm config).
- **Docs:** Analytics dashboard guide (Stefania's Sunday workflow)
- **Gate:** Stefania's Sunday review works end-to-end — every funnel stage renders with real data, persona health shows per-segment breakdown. PWA installs cleanly on iOS and Android. All 5 persona E2E tests green (Marcus, Maya, Priya, Dev, Stephen).

---

**v0.10 — Load Test, Security Review, User Docs, V1 Declaration**
*The last mile. Every gate must pass before V1 is declared.*

- Load test: modest V1 load (10 concurrent saves, 50 concurrent queries, 30 minutes) — sufficient for actual V1 usage patterns. Full agent-pattern load test (50 concurrent saves, 200 queries) deferred to V2 when Dev's agents are the primary consumer.
- All persona E2E smoke tests verified in CI (Marcus, Maya, Priya, Dev, Stephen flows — accumulated since v0.5)
- Final security review: Markdown sanitization, data isolation, WAF rules, SSRF protection, invite code hardening, CORS policy verification, API key scoping (capture-only vs. full), least-privilege IAM audit across all Lambdas
- **Backup restore drill:** Restore a DynamoDB table to a point in time in a test account. Restore an S3 object version. Verify data integrity. A backup you've never tested restoring is not a backup — it's a hope. This proves the 24-hour RTO/RPO story is real, not theoretical.
- Performance validation against technical health targets: capture < 2s, search < 1s, API error rate < 0.5%
- User documentation: complete guides for non-developer builders (getting started, capturing content, organizing projects, building with notes, tracking tutorials, search tips). Written for Maya, not Marcus.
- API + integration documentation: final review, MCP server integration guide, agentic workflow patterns
- Architecture decision records (all ADRs documented — ADR-1 through ADR-10)
- Contract tests verified against OpenAPI spec (tests are source of truth, docs are derived)
- **Gate:** All persona E2E tests green. Load test passes. Security review clean. Performance targets met. A non-technical user reads the user guide and completes the full save → organize → build flow without help.

**v0.10 passes all gates → V1 is declared.**

### Out of Scope for MVP

**Everything not in the v0.1-v0.10 plan above is out of scope for V1.** Explicitly:

- **LLM integration of any kind** — no AI suggestions, no automated connections, no content analysis. V1 is manual and gold. This is the V1/V2 phasing firewall.
- **Cross-user content discovery** — no "discover" tab, no recommendations. The visibility flags are stored; the intelligence that uses them is V2.
- **Native mobile apps** — iOS native is V2.5, Android native is V3.5. V1 is PWA + iOS Shortcut.
- **Published learning trails** — V3 feature. The data model supports it (visibility flags, project status) but no publishing UI.
- **MCP server** — the API is MCP-ready (ADR-8) but the actual MCP server implementation is a V2 deliverable for Dev's agentic workflows.
- **Business model / monetization** — V4 conversation, not a V1 distraction.
- **Offline-first / background sync** — evaluated during v0.9 PWA polish. If not feasible in PWA, deferred to V2.5 native iOS app.
- **OpenSearch / dedicated external search service** — DynamoDB search-index for V1. Re-evaluate when search latency tripwire fires or when V2 semantic search requires it.
- **Full agent-pattern load testing** — V1 runs a modest load test appropriate for actual usage (10 concurrent, 50 queries). The 50/200 agent-pattern load test is a V2 deliverable when Dev's agents are live.

### MVP Success Criteria

**V1 is successful when all of the following are true:**

1. **All v0.10 gates pass** — load test, security review, performance targets, persona E2E tests, documentation review.
2. **The core value loop works for all personas:**
   - Maya saves from her phone in 2 taps and links saves to projects on desktop.
   - Marcus uses project notes as a living notebook with pasted LLM conversations.
   - Priya signs up and sees seeded projects, not a blank screen.
   - Dev generates an API key and programmatically saves, queries, and links via API.
   - Stephen traces a request end-to-end and gets an alert on his phone when something breaks.
   - Stefania reviews product health via dashboards and CLI with real data.
3. **The North Star metric is measurable** — Weekly Active Builders (WAB) can be computed from the analytics infrastructure.
4. **All 7 primary KPIs are instrumented and reportable** — the measurement infrastructure from Step 4 is live and producing data.
5. **Infrastructure cost is within budget** — total monthly cost < $50 at target usage (20 users, 2x/week, 4 saves/session).
6. **The V2 foundation is laid** — visibility flags stored, content layer supports cross-user queries via GSI, AI enriched flags on all entities, API contract stable and documented, repository pattern enables data store swaps. V2 can build the intelligence layer WITHOUT re-architecting V1.

**V1 success is not measured by user count.** A V1 that works flawlessly for 5 engaged builders is a success. A V1 that falls over at 10 users is a failure. Build for reliability and correctness. Growth is a V2/V3 concern.

### Future Vision

The future vision is already defined in the Strategic Phasing section of this brief:

- **V2: The Engine** — LLM-powered intelligence layer. Bidirectional connections, cross-user discovery, agentic enrichment. The collective learning graph comes alive. Dev becomes the #1 persona. The API investment pays off.
- **V2.5: Native iOS App** — eliminates Shortcut setup friction, adds push notifications and background sync. Launches WITH V2 intelligence for a complete first impression.
- **V3: The Community** — published learning trails as portfolio and acquisition channel. Builders teaching builders through their actual work.
- **V3.5: Native Android App** — completes the native suite. PWA served Android well through V1-V3.
- **V4: Business Model** — if monetization ever becomes relevant, the architecture supports it. Not a current concern.

Each version is excellent at what it does. No compromises between them. The V1/V2 phasing firewall prevents "just a little AI" from creeping into V1, and prevents "just a little infrastructure rework" from bloating V2.

### Step 5 Quality Gate

This MVP Scope section has been stress-tested through: one Party Mode session (Winston, John, Murat — surfacing repository pattern, multi-table design, testing mandate, seeded content spec), one Security Audit (hacker + defender + auditor — 9 findings applied including WAF timing, capture-only key scope, least-privilege IAM, enrichment change detection), one Graph of Thoughts analysis (5 emergent requirements applied including UpdateItem pattern, Stream-based analytics, enrichment backfill, seeded content flagging, dual-entry Lambda), and one Meta-Prompting Analysis (methodology review identifying journey narrative gap, cost model gap, and effort validation gap — all addressed).

**Remaining validation deferred to later phases:**
- **Effort and dependency validation** — the increment plan reads well but has not been validated for executability. The Epic planning phase (BMAD Phase 2) must validate increment sequencing with dependency mapping and rough effort estimates. If v0.2 is actually 3 sprints of work, it should be split.
- **UX journey design** — the "A Day With the Hub" sketches above are product-level anchors, not UX specs. The UX Design phase produces the real interaction flows, wireframes, and design decisions.

**This section is ready for the Architecture phase.**

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

**`normalization_version` usage note:** This field is stored in V1 but not operationalized — no admin tooling reads or acts on it. Its purpose is future migration safety: if URL normalization rules change (e.g., adding a 6th domain-specific normalizer, fixing a normalization bug), a one-time migration script can query records with the old version number, re-normalize them, and update the version. Without this field, re-normalization would require reprocessing every URL blindly. No V1 admin CLI command required — the field is passive insurance.

### ADR-3: Notes Storage — S3 Object Structure — DECIDED

**Decision:** Hybrid storage model. Notes under 50KB are stored inline in DynamoDB (covers ~90% of save notes and short project notes — fast, cheap, no S3 round-trip). Notes exceeding 50KB are stored in S3 as chunked objects (`{user-id}/notes/{entity-id}/chunk-001.json`, `chunk-002.json`, etc.). New content appends as new chunks (cheap write). Client loads max 400KB per request via paginated chunk fetching. DynamoDB holds metadata and S3 key pointers for large notes. Budget: up to 1.5GB of text content per user across all entities.

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

### ADR-8: API Contract Design Principles — DECIDED

**Decision:** The API is the #1 V1 architecture priority. V2 builds USING the API, not trying to build the API. Dev (Persona 4) is #6 for V1 product priority but #1 for V2 — the API must be complete, stable, and well-documented in V1 to support V2's intelligence layer and Dev's agentic workflows.

**URL-based versioning from day one:** `/api/v1/saves`, `/api/v1/projects`. Not header-based, not query param — URL path. Simple, cacheable, debuggable. Semver commitment: breaking changes require a version bump. Non-breaking additions (new optional fields, new endpoints) happen within a version.

**Per-API-key rate limiting with read/write split:**
- Default tier: generous enough for Dev's agent pattern (e.g., 100 requests/minute per key). V2 can introduce tier differentiation if needed.
- Separate rate limit counters for reads vs. writes. Dev's agents query heavily (reads) and save selectively (writes). Maya does few of both. Don't let read-heavy agent patterns throttle writes.
- Standard 429 responses with `Retry-After` header. Predictable, agent-friendly — Dev's agents respect it automatically.

**MCP readiness:** The API contract is designed so wrapping it as an MCP server is trivial. Consistent resource naming, predictable CRUD patterns, well-typed request/response schemas. The MCP server itself isn't a V1 deliverable, but the API must not fight against it.

**Contract tests as documentation source:** API contract tests validate request/response schemas on every push. OpenAPI spec is generated from the tests — tests are the source of truth, docs are derived. If the schema changes, the test fails. This is what gives Dev (and his agents) confidence that the API won't break under them.

**V1 API documentation is a V1 deliverable** — not just for Dev, but because the web UI, iOS Shortcut, and future MCP server are all API consumers. If the docs are wrong, every consumer is wrong.
