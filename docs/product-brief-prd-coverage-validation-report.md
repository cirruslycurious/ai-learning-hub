# Product Brief vs PRD Coverage Validation Report

**Date:** 2026-02-24  
**Product Brief:** `_bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md` (~2026 lines)  
**PRD:** `_bmad-output/planning-artifacts/prd.md` (~1255 lines)

## Executive Summary

The PRD provides **strong coverage** of the Product Brief's core vision, users, features, and requirements. Most critical areas are **Fully Covered**. Gaps are concentrated in: (1) detailed analytics/measurement infrastructure, (2) enrichment security (content poisoning prevention), (3) vertical slice implementation specifics (v0.x increment plan), and (4) API versioning (Brief specifies URL versioning; PRD uses additive-only, no versioning).

The **agent-native API patterns (FR92–FR107)** are PRD additions that extend and operationalize the Brief's "API is the product" and "MCP-ready" vision. No Brief content contradicts these FRs; they fill implementation detail the Brief left open.

---

## 1. Coverage Map by Key Area

### 1.1 Vision Statement / Executive Summary

| Brief Element                                                        | PRD Coverage                                     | Classification        | Notes                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------- |
| Save-to-build platform; projects as center of gravity                | Present in Executive Summary, Innovation section | **Fully Covered**     |                                                                               |
| Saves are fuel; building is the product                              | Present                                          | **Fully Covered**     |                                                                               |
| Three domain views (Resource Library, Tutorial Tracker, My Projects) | FR18, Journey requirements                       | **Fully Covered**     |                                                                               |
| API-first, multi-user                                                | Throughout API-First Platform section            | **Fully Covered**     |                                                                               |
| Collective intelligence (relevance, not popularity)                  | Innovation section, V2 Growth Features           | **Fully Covered**     |                                                                               |
| Two-layer data model (content + user layer)                          | Implied in domain model; not explicitly detailed | **Partially Covered** | Brief has extensive two-layer spec; PRD references it but lacks schema detail |

**Severity of gap:** Informational — two-layer model is architectural; PRD defers to architecture docs.

---

### 1.2 Target Users / Personas

| Brief Element                                        | PRD Coverage                    | Classification        | Notes                                    |
| ---------------------------------------------------- | ------------------------------- | --------------------- | ---------------------------------------- |
| Maya Chen (Lean-In Professional)                     | Journey 1, FR44–FR50            | **Fully Covered**     |                                          |
| Marcus Rivera (Infrastructure Builder)               | Journey 2, FR20–FR32, FR48–FR51 | **Fully Covered**     |                                          |
| Priya Kapoor (Curious Explorer)                      | Journey 3, FR56–FR59            | **Fully Covered**     |                                          |
| Dev Okafor (API Builder)                             | Journey 4, FR5–FR7, FR92–FR107  | **Fully Covered**     | PRD adds agent-native FRs that serve Dev |
| Stephen (Solo Platform Operator)                     | Journey 5, FR60–FR63            | **Fully Covered**     |                                          |
| Stefania (Business Analyst)                          | Journey 6, analytics dashboards | **Fully Covered**     |                                          |
| Persona priority stack (Marcus #1, Stephen #2, etc.) | Implicit in journey ordering    | **Partially Covered** | Brief explicitly ranks; PRD does not     |

**Severity of gap:** Informational.

---

### 1.3 Problem Statement

| Brief Element                                   | PRD Coverage                         | Classification    | Notes                                    |
| ----------------------------------------------- | ------------------------------------ | ----------------- | ---------------------------------------- |
| Scattered learning resources across platforms   | Executive Summary                    | **Fully Covered** |                                          |
| Tutorials discovered and forgotten              | Implicit in tutorial lifecycle FRs   | **Fully Covered** |                                          |
| Project ideas fragment across LLM conversations | Executive Summary, project notes FRs | **Fully Covered** |                                          |
| No system connecting resources to projects      | Core value proposition               | **Fully Covered** |                                          |
| Why existing solutions fall short               | Not present                          | **Not Found**     | Brief lists Pocket, Notion, GitHub, etc. |

**Severity of gap:** Informational — competitive context, not functional requirement.

---

### 1.4 Key Features and Capabilities

| Brief Element                                              | PRD Coverage                 | Classification             | Notes                       |
| ---------------------------------------------------------- | ---------------------------- | -------------------------- | --------------------------- |
| Save → project → link loop                                 | FR10–FR38                    | **Fully Covered**          |                             |
| Unified save entity (resource/tutorial/both)               | FR18, FR39–FR43              | **Fully Covered**          |                             |
| Project notes with LLM conversation paste                  | FR26–FR27, FR49              | **Fully Covered**          |                             |
| Project folders                                            | FR24                         | **Fully Covered**          |                             |
| iOS Shortcut + PWA share target                            | FR44–FR47                    | **Fully Covered**          |                             |
| Async enrichment (hourly batch)                            | FR17                         | **Fully Covered**          |                             |
| Search (full-text)                                         | FR52–FR55                    | **Fully Covered**          |                             |
| Tags                                                       | FR28, FR39                   | **Fully Covered**          |                             |
| API keys (full + capture-only)                             | FR5–FR7                      | **Fully Covered**          |                             |
| Seeded onboarding (3 starter projects)                     | FR56–FR58                    | **Fully Covered**          |                             |
| 4 operational dashboards                                   | NFR-O4                       | **Fully Covered**          |                             |
| 5 analytics dashboards                                     | Journey 6, analytics section | **Fully Covered**          |                             |
| Admin CLI (10 commands)                                    | FR60–FR62, Journey 5         | **Partially Covered**      | See gaps below              |
| Enrichment change detection (content poisoning)            | Not present                  | **Not Found**              | **Critical gap**            |
| admin:content:review-flagged                               | Not present                  | **Not Found**              | Part of enrichment security |
| Seeded content flagging (exclude from V2 collective graph) | Not present                  | **Not Found**              | Brief v0.6 spec             |
| Project-scoped API keys (V2 exploration)                   | Not in V1 scope              | **Intentionally Excluded** | Brief marks as future       |
| MCP server                                                 | V2 Growth Features           | **Intentionally Excluded** | Correctly deferred          |

**Severity of enrichment/security gap:** **Critical** — Brief Security Audit applied this; prevents content poisoning.

---

### 1.5 Goals / Objectives / Success Criteria

| Brief Element                                          | PRD Coverage                          | Classification    | Notes                                              |
| ------------------------------------------------------ | ------------------------------------- | ----------------- | -------------------------------------------------- |
| North Star: Weekly Active Builders (WAB)               | Success Criteria, Measurable Outcomes | **Fully Covered** |                                                    |
| 7 primary KPIs                                         | Measurable Outcomes                   | **Fully Covered** |                                                    |
| Per-persona aha moments                                | User Success                          | **Fully Covered** |                                                    |
| Per-persona success signals                            | Measurable Outcomes                   | **Fully Covered** |                                                    |
| Technical health targets (capture <3s, search <2s)     | NFR-P1–P5                             | **Fully Covered** |                                                    |
| 80% test coverage                                      | Technical Success                     | **Fully Covered** |                                                    |
| 6 persona E2E golden paths                             | Success Gates                         | **Fully Covered** |                                                    |
| Small-N display rule                                   | Journey 6, analytics                  | **Fully Covered** |                                                    |
| user_milestones, daily_user_activity, cohort snapshots | Not present                           | **Not Found**     | **Moderate gap** — Brief has full analytics schema |
| Measurement pipeline smoke test                        | Not present                           | **Not Found**     | **Moderate gap** — Brief Layer 8 spec              |

**Severity of analytics infrastructure gap:** **Moderate** — PRD has analytics dashboards/API but not the detailed event catalog, rollup patterns, or measurement pipeline validation.

---

### 1.6 Differentiators / Innovation

| Brief Element                                      | PRD Coverage            | Classification    | Notes                                  |
| -------------------------------------------------- | ----------------------- | ----------------- | -------------------------------------- |
| Save-to-build assumption                           | Innovation section      | **Fully Covered** |                                        |
| Project-centric, living notebooks                  | Throughout              | **Fully Covered** |                                        |
| Collective intelligence (relevance not popularity) | Innovation, V2          | **Fully Covered** |                                        |
| AI agents as first-class users                     | Dev journey, FR92–FR107 | **Fully Covered** | PRD extends with agent-native patterns |
| Multi-modal content, one system                    | FR10–FR19               | **Fully Covered** |                                        |

**No gaps.**

---

### 1.7 Constraints (Budget, Scale, Team)

| Brief Element                | PRD Coverage             | Classification        | Notes                         |
| ---------------------------- | ------------------------ | --------------------- | ----------------------------- |
| Solo builder (Stephen)       | Resource Assessment      | **Fully Covered**     |                               |
| $50/month infrastructure cap | NFR-C1, Business Success | **Fully Covered**     |                               |
| Boutique scale (10–20 users) | Executive Summary        | **Fully Covered**     |                               |
| Invite-only                  | FR8–FR9                  | **Fully Covered**     |                               |
| RTO/RPO 24 hours             | Not explicit             | **Partially Covered** | Brief Operational Constraints |

**Severity of gap:** Informational.

---

### 1.8 Security Requirements

| Brief Element                                   | PRD Coverage               | Classification    | Notes                     |
| ----------------------------------------------- | -------------------------- | ----------------- | ------------------------- |
| WAF on CloudFront/API Gateway                   | NFR-S9, Risk Analysis      | **Fully Covered** |                           |
| SSRF protection (enrichment)                    | NFR-S5, Security Checklist | **Fully Covered** |                           |
| API key hashing, redaction                      | NFR-S3, NFR-S8             | **Fully Covered** |                           |
| Invite code hardening                           | Security Checklist         | **Fully Covered** |                           |
| Markdown sanitization                           | NFR-S6                     | **Fully Covered** |                           |
| Per-user data isolation                         | NFR-S4                     | **Fully Covered** |                           |
| Enrichment change detection (content poisoning) | Not present                | **Not Found**     | **Critical** — Brief v0.7 |
| admin:content:review-flagged                    | Not present                | **Not Found**     | Tied to above             |

**Severity of gap:** **Critical** — Security Audit finding applied in Brief.

---

### 1.9 Analytics Requirements

| Brief Element                           | PRD Coverage        | Classification    | Notes             |
| --------------------------------------- | ------------------- | ----------------- | ----------------- |
| 5 analytics dashboards                  | Journey 6           | **Fully Covered** |                   |
| Analytics API                           | Journey 6           | **Fully Covered** |                   |
| Admin CLI analytics commands            | FR62                | **Fully Covered** |                   |
| Persona segmentation heuristics         | Journey 6           | **Fully Covered** |                   |
| 7 KPIs instrumented                     | Measurable Outcomes | **Fully Covered** |                   |
| Event catalog (40+ event types)         | Not present         | **Not Found**     | **Moderate**      |
| Analytics summary table schema          | Not present         | **Not Found**     | **Moderate**      |
| Pattern A/B/C computation patterns      | Not present         | **Not Found**     | **Moderate**      |
| Measurement pipeline smoke test         | Not present         | **Not Found**     | **Moderate**      |
| Weekly batch rollup (Sunday + Thursday) | Not present         | **Not Found**     | **Informational** |

**Severity of gap:** **Moderate** — PRD covers what to measure; Brief specifies how (events, rollups, validation).

---

### 1.10 Onboarding / Seeded Content Requirements

| Brief Element                                           | PRD Coverage | Classification        | Notes                                     |
| ------------------------------------------------------- | ------------ | --------------------- | ----------------------------------------- |
| 3 starter projects                                      | FR56–FR58    | **Fully Covered**     |                                           |
| Curated resources per project                           | FR56         | **Fully Covered**     |                                           |
| Seeded content spec deliverable (v0.3)                  | Not present  | **Not Found**         | **Informational** — implementation detail |
| Project themes: Custom GPT, AI Automation, RAG Pipeline | Not explicit | **Partially Covered** | Journey 3 mentions "Build a Custom GPT"   |
| Consider MCP Server seeded project                      | Not present  | **Not Found**         | **Informational** — Brief "consider"      |
| Seeded content flagging (exclude from V2 graph)         | Not present  | **Not Found**         | **Moderate** — Brief v0.6                 |

**Severity of gap:** **Moderate** for seeded flagging — affects V2 collective graph quality.

---

## 2. FR92–FR107 (Agent-Native API) vs Product Brief

The Brief states:

- "API is the product"
- "MCP-ready" design
- Rate limiting with read/write split
- 429 with Retry-After
- Consistent resource naming, predictable CRUD

**FR92–FR107 add implementation detail the Brief does not specify:**

| FR Range                             | Brief Coverage                    | Assessment                                                            |
| ------------------------------------ | --------------------------------- | --------------------------------------------------------------------- | --- |
| FR92–FR93 (CQRS)                     | Brief says "predictable CRUD"     | **Extension** — Brief does not mandate command/query separation       |
| FR94–FR95 (State machine)            | Brief has project/tutorial status | **Extension** — Brief does not require server-enforced state machines |
| FR96–FR97 (Idempotency, concurrency) | Not in Brief                      | **Extension** — Agent-safe retry and concurrency                      |
| FR98–FR99 (Operation resources)      | Brief has async enrichment        | **Extension** — Explicit operation polling not in Brief               |
| FR100–FR101 (Error contract)         | Brief mentions error handling     | **Extension** — Structured, machine-parseable errors                  |
| FR102 (Event history)                | Brief has audit/activity          | **Extension** — Per-entity event history endpoint                     |
| FR103–FR104 (Agent identity)         | Brief mentions Dev's agents       | **Extension** — X-Agent-ID, context metadata                          |
| FR105 (Cursor pagination)            | Brief: "pagination from day one"  | **Extension** — Brief does not specify cursor vs offset               |
| FR106 (Batch)                        | Not in Brief                      | **Extension**                                                         |     |
| FR107 (Health/ready)                 | Not in Brief                      | **Extension**                                                         |     |

**Conclusion:** FR92–FR107 are **additive**, not conflicting. They implement the Brief's "API is the product" and "MCP-ready" vision for agent workflows. No Brief content is contradicted.

**Brief content not yet in FR92–FR107:**

- **Project-scoped API keys** (Brief V2 exploration) — PRD has scoped keys (saves:write, projects:write) but not project-scoped
- **URL versioning** — Brief ADR-8: `/api/v1/`; PRD: "No URL versioning, additive-only" — **intentional PRD change**

---

## 3. Specific Gaps with Severity

### Critical

| Gap                          | Brief Location       | PRD Gap                            | Recommendation                                                      |
| ---------------------------- | -------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Enrichment change detection  | v0.7, Security Audit | Not in PRD                         | Add NFR or security checklist item for content poisoning prevention |
| admin:content:review-flagged | v0.7, v0.8           | Not in FR60–FR63 or admin CLI list | Add to Admin & Operations FRs                                       |

### Moderate

| Gap                             | Brief Location      | PRD Gap                               | Recommendation                                     |
| ------------------------------- | ------------------- | ------------------------------------- | -------------------------------------------------- |
| Analytics event catalog         | Measurement Layer 1 | PRD has KPIs but not event taxonomy   | Add to analytics section or reference architecture |
| Analytics summary table schema  | Layer 2–4           | PRD has dashboards, not storage model | Document in architecture or analytics spec         |
| Measurement pipeline smoke test | Layer 8             | Not in PRD                            | Add to NFR or testing requirements                 |
| Seeded content flagging         | v0.6                | Not in onboarding FRs                 | Add FR or data model note for V2 graph exclusion   |

### Informational

| Gap                                         | Brief Location    | PRD Gap                                    |
| ------------------------------------------- | ----------------- | ------------------------------------------ |
| v0.1–v0.10 increment plan                   | MVP Scope         | PRD has MVP scope, not vertical slice plan |
| Competitive analysis (Pocket, Notion, etc.) | Problem Statement | Not in PRD                                 |
| Persona priority stack rank                 | Personas          | Implicit only                              |
| Seeded content spec deliverable             | v0.3              | Implementation detail                      |
| MCP Server seeded project (consider)        | Onboarding        | Optional                                   |
| URL versioning (Brief: /api/v1)             | ADR-8             | PRD uses additive-only; intentional change |

---

## 4. Project Status Terminology Discrepancy

| Source    | Project Status Values                                  |
| --------- | ------------------------------------------------------ |
| **Brief** | exploring \| building \| live \| improving \| archived |
| **PRD**   | exploring \| building \| paused \| completed           |

The PRD uses **paused** and **completed**; the Brief uses **live**, **improving**, and **archived**. Epics and architecture docs align with PRD. This appears to be an intentional UX simplification ("write for the marketer") — "live" and "improving" were resolved to "paused" and "completed" in later planning. **Recommendation:** Confirm in Brief or ADR that PRD terminology is canonical.

---

## 5. Overall Coverage Assessment

| Category         | Score | Summary                                                  |
| ---------------- | ----- | -------------------------------------------------------- |
| Vision & Problem | 95%   | Core vision and problem fully covered                    |
| Users & Personas | 98%   | All 6 personas with journeys                             |
| Features         | 90%   | Main features covered; enrichment security gap           |
| Goals & Success  | 92%   | KPIs and criteria covered; measurement infra light       |
| Differentiators  | 100%  | Fully covered                                            |
| Constraints      | 95%   | Budget, scale, team covered                              |
| Security         | 85%   | One critical gap (enrichment change detection)           |
| Analytics        | 80%   | Dashboards/API covered; event catalog and pipeline light |
| Onboarding       | 90%   | Core covered; seeded flagging gap                        |

**Overall:** ~92% coverage. Critical gaps are limited to enrichment security. Moderate gaps are in analytics/measurement infrastructure and seeded content handling.

---

## 6. Brief Content Completely Missing from PRD

1. **Enrichment change detection** — Content poisoning prevention on re-enrichment
2. **admin:content:review-flagged** — CLI for reviewing flagged content-layer records
3. **Measurement pipeline smoke test** — Staging full suite + production heartbeat
4. **Analytics event catalog** — 40+ event types with metadata
5. **Analytics summary table schema** — daily_user_activity, user_milestones, weekly_cohort_snapshot, etc.
6. **Pattern A/B/C computation** — Real-time increment, weekly batch, on-demand query
7. **Seeded content flagging** — `seeded: true` to exclude from V2 collective graph
8. **Vertical slice plan (v0.1–v0.10)** — Increment-by-increment implementation plan
9. **Dual-entry Lambda pattern** — Admin CLI and Analytics API share Lambdas
10. **Stream-based analytics consumer** — Pattern A via DynamoDB Streams, not inline

---

## 7. Recommendations

1. **Add enrichment change detection** to PRD Security section (NFR or checklist).
2. **Add admin:content:review-flagged** to Admin & Operations FRs.
3. **Reference or summarize** analytics event catalog and measurement pipeline in PRD, or point to architecture/analytics spec.
4. **Add seeded content flagging** to onboarding or data model section for V2 readiness.
5. **Clarify project status** — Confirm PRD (paused/completed) as canonical vs Brief (live/improving/archived).
6. **Keep FR92–FR107** — They correctly extend the Brief for agent-native use; no changes needed.
