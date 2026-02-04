---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-ai-learning-hub-2026-01-31.md
  - _bmad-output/planning-artifacts/research/domain-ai-genai-learning-workflows-research-2026-02-02.md
  - _bmad-output/planning-artifacts/implementation-readiness-report-2026-02-03.md
workflowType: 'architecture'
project_name: 'ai-learning-hub'
user_name: 'Stephen'
date: '2026-02-03'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements: 69 FRs across 12 domains**

| Domain | Count | Key Architectural Implications |
|--------|-------|-------------------------------|
| User Management | 9 | Auth delegation (Clerk/Auth0), API key management, invite code system |
| Save Management | 10 | Core CRUD, async enrichment pipeline, three domain views into unified data |
| Project Management | 13 | Folders, Markdown notes (S3 storage), tagging, status workflow |
| Resource-Project Linking | 6 | Many-to-many relationships, bulk operations |
| Tutorial Lifecycle | 5 | Status state machine (saved→started→completed) |
| Mobile Capture | 4 | iOS Shortcut + PWA share target, <3 second latency requirement |
| Desktop Workspace | 4 | Side-by-side views, large Markdown rendering, screenshot-friendly |
| Search & Discovery | 4 | Full-text search across saves, projects, and notes content |
| Onboarding | 4 | Seeded starter projects, content seeding strategy |
| Admin & Operations | 4 | CLI tooling, analytics dashboards, rate limit management |
| User Feedback | 4 | Success confirmations, error messages, empty states, offline awareness |
| Notes Processing | 2 | Async processing pipeline, search indexing |

**Non-Functional Requirements: 28 NFRs**

Priority order: Security → Reliability → Cost → Performance

| Category | Count | Critical Targets |
|----------|-------|------------------|
| Security | 9 | Encryption at rest/transit, API key hashing, per-user isolation, SSRF protection |
| Reliability | 7 | 99% uptime, <1% error rate, <2h MTTR, <10min rollback |
| Cost | 3 | $50/month hard cap, <$4/user |
| Performance | 5 | <3s mobile save, <1s API (p95), <2s search |
| Observability | 5 | X-Ray tracing, structured logging, tiered alerting, 9 dashboards |
| Integration | 3 | Graceful degradation, YouTube API quota respect, contract stability |

### Scale & Complexity

| Indicator | Assessment | Evidence |
|-----------|------------|----------|
| User Scale | Boutique (10-20 users) | PRD explicit; invite-only |
| Data Scale | Small-medium | <1000 saves/user projected, 1.5GB notes/user budget |
| Technical Complexity | Medium-High | Two-layer data model, async enrichment, dual storage |
| Integration Complexity | Medium | YouTube API, external URL fetching, Clerk/Auth0 |
| Real-time Features | None in V1 | Search is sync, enrichment is async batch |
| Multi-tenancy | Soft | Per-user data isolation, shared content layer |

**Primary Domain:** API-first serverless platform (web_app + api_backend)

### Technical Constraints

| Constraint | Source | Impact |
|------------|--------|--------|
| AWS serverless only | PRD/Brief | Lambda, DynamoDB, S3, CloudFront, API Gateway |
| AWS CDK (TypeScript) | PRD | IaC-only, no ClickOps |
| Clerk or Auth0 | PRD | Auth delegation, no custom auth |
| $50/month budget | PRD | On-demand DynamoDB, Lambda pay-per-use |
| 80% test coverage | PRD | CI-enforced, non-negotiable |
| Solo operator | Brief | Tiered alerting, admin CLI critical |

### Cross-Cutting Concerns

1. **Per-User Data Isolation** — Every API call scoped to authenticated user
2. **Observability** — X-Ray tracing, structured logging, 4 operational + 5 analytics dashboards
3. **Security** — WAF, SSRF protection, Markdown sanitization, API key hashing
4. **Graceful Degradation** — Search failure ≠ save failure, enrichment failure ≠ save failure
5. **API Contract Stability** — OpenAPI from tests, additive-only changes
6. **CI/CD Pipeline** — Automated testing, no manual deployments, IaC-only

---

## Foundational Architecture Decisions

These decisions were made collaboratively during the architecture discovery session.

### ADR-001: Multi-Table DynamoDB Design

**Decision:** Use separate DynamoDB tables for each domain concern.

**Rationale:**
- Separation of concerns enables independent scaling
- Each table can have its own API surface
- Easier to evolve and modify individual tables
- No monolithic single-table design coupling
- **Security:** User-owned data always partitioned by `USER#<userId>` for isolation

**Tables (7 total):**

| # | Table | Partition Key | Purpose |
|---|-------|---------------|---------|
| 1 | `users` | `USER#<clerkId>` | Profiles + API keys |
| 2 | `saves` | `USER#<userId>` | User's saved URLs |
| 3 | `projects` | `USER#<userId>` | Projects + folders |
| 4 | `links` | `USER#<userId>` | Project ↔ Save relationships |
| 5 | `content` | `CONTENT#<urlHash>` | Global URL metadata (shared) |
| 6 | `search-index` | `USER#<userId>` | Search substrate |
| 7 | `invite-codes` | `CODE#<code>` | Invite system |

**Key Design Principle:** Every table with user-owned data has `USER#<userId>` as the partition key for security isolation. The `content` table is intentionally global (shared across users, no user attribution). The `invite-codes` table uses `CODE#<code>` because the primary access pattern is lookup by code during redemption.

**Consequences:**
- 10 GSIs to manage across 7 tables
- Cross-table queries require application-level joins
- Cleaner boundaries, easier testing
- Strong per-user data isolation

---

### ADR-002: DynamoDB for Search (V1)

**Decision:** Use DynamoDB for V1 search instead of OpenSearch.

**Rationale:**
- Simpler architecture, lower cost
- Sufficient for boutique scale (<1000 saves/user)
- API abstraction allows future swap to OpenSearch
- Search uses processed/indexed substrate, not raw text

**Search Strategy:**
- Pre-processed search index table with structured fields
- NOT searching raw notes — searching extracted substrate
- Trade-off accepted: semantic matches over arbitrary string matches
- V2 can add vector search without re-architecture

**Consequences:**
- No fuzzy matching in V1
- Search quality depends on processing pipeline quality
- Future OpenSearch migration is straightforward via API layer

---

### ADR-003: EventBridge + Step Functions for Async Processing

**Decision:** Use EventBridge for event routing and Step Functions for workflow orchestration.

**Rationale (vs SQS):**
- Enrichment is a workflow, not a queue — multiple steps with different failure modes
- Step Functions provides visual debugging and execution history
- Native retries with exponential backoff
- EventBridge enables fan-out to multiple consumers (V2 ready)
- Cost negligible at boutique scale

**Pattern:**
```
Entity Change → EventBridge Event → Step Function Workflow
                                        ├─ Step 1
                                        ├─ Step 2
                                        ├─ ...
                                        └─ API calls (no Lambda-to-Lambda)
```

**Consequences:**
- More infrastructure components
- Excellent observability for troubleshooting
- Easy to add steps later

---

### ADR-004: Lambda Per Concern

**Decision:** Organize Lambda functions by single responsibility, not by shared code.

**Rationale:**
- Security isolation between functions
- Independent failure domains
- Easier to reason about, test, and deploy
- Least-privilege IAM per function

**Structure:**
```
/backend/functions/
  /saves      — CRUD for saves
  /projects   — CRUD for projects
  /links      — project↔save relationships
  /search     — search queries
  /content    — content layer operations
  /admin      — admin CLI operations
  /enrichment — Step Function task handlers
```

**Consequences:**
- More Lambda functions to deploy
- Shared code via `/shared` utilities
- Clear ownership and boundaries

---

### ADR-005: No Lambda-to-Lambda Calls

**Decision:** All inter-service communication goes through API Gateway or EventBridge.

**Rationale:**
- Loose coupling — implementations can change without affecting callers
- Unified observability — all traffic through API Gateway
- Testability — every operation testable via API contract
- Future flexibility — backend could be replaced without changing callers

**Allowed Patterns:**
- Lambda → API Gateway → Lambda ✅
- Lambda → EventBridge → Step Function → Lambda ✅
- Lambda → Lambda (direct invoke) ❌

**Consequences:**
- Slightly higher latency for internal calls
- API contracts are the source of truth
- All operations are observable and debuggable

---

### ADR-006: Multi-Stack CDK Decomposition

**Decision:** Decompose infrastructure into multiple CDK stacks by concern.

**Rationale:**
- Separation of concerns
- Faster deployments (only changed stacks)
- Easier debugging
- Independent scaling and configuration

**Stack Structure:**
```
/infra/stacks/
  /core
    tables.stack.ts          # DynamoDB tables
    buckets.stack.ts         # S3 buckets
  /auth
    auth.stack.ts            # Clerk/Auth0 integration
  /api
    saves-api.stack.ts       # /saves endpoints
    projects-api.stack.ts    # /projects endpoints
    links-api.stack.ts       # /links endpoints
    search-api.stack.ts      # /search endpoints
    content-api.stack.ts     # /content endpoints
    admin-api.stack.ts       # /admin endpoints
  /workflows
    url-enrichment.stack.ts
    notes-processing.stack.ts
    search-index-sync.stack.ts
  /observability
    dashboards.stack.ts
    alarms.stack.ts
    xray.stack.ts
  /pipeline
    pipeline.stack.ts
```

**Deployment Order:**
```
Core → Auth → API stacks (parallel) → Workflows → Observability
```

**Consequences:**
- More stacks to manage
- Cross-stack references via exports
- No circular dependencies allowed

---

### ADR-007: CI/CD with Automated Testing

**Decision:** GitHub Actions pipeline with mandatory test gates at every stage.

**Rationale:**
- Solo builder needs automated quality gates
- 80% coverage is PRD requirement
- IaC-only means pipeline IS the deployment mechanism
- Contract tests generate OpenAPI spec

**Pipeline Stages:**
```
Push/PR → Lint & Format → Type Check → Unit Tests (80% gate)
                                              ↓
                         ← Integration Tests ← CDK Synth
                                              ↓
                            Contract Tests → Deploy Dev
                                              ↓
                                E2E Tests (6 persona paths)
                                              ↓
                                         Deploy Prod
```

**Gates Enforced:**
- ESLint, Prettier, TypeScript strict
- CDK Nag (security/best-practice scanning)
- 80% test coverage minimum
- All 6 persona E2E golden paths green
- Contract tests pass (OpenAPI validation)

**Consequences:**
- Slower deployments (more gates)
- High confidence in releases
- No manual deployments ever

---

### ADR-008: Standardized Error Handling

**Decision:** All Lambda functions use shared error handling middleware with consistent response shapes.

**Rationale:**
- Consistent API contract for all consumers
- Centralized logging with correlation IDs
- Easier debugging and troubleshooting
- Dev persona agents depend on predictable errors

**Error Response Shape:**
```json
{
  "statusCode": 400 | 401 | 403 | 404 | 429 | 500,
  "body": {
    "error": {
      "code": "VALIDATION_ERROR | NOT_FOUND | RATE_LIMITED | ...",
      "message": "Human readable message",
      "requestId": "correlation-id-from-x-ray"
    }
  }
}
```

**Logging Contract (every log line):**
- `timestamp` — ISO 8601
- `requestId` — correlation ID
- `traceId` — X-Ray trace ID
- `userId` — authenticated user
- `action` — structured action name
- `entityType` — what was affected
- `entityId` — ID of affected entity
- `level` — INFO | WARN | ERROR
- `durationMs` — operation duration

**Consequences:**
- Shared middleware dependency
- Consistent observability
- Predictable error handling for all consumers

---

### ADR-009: Eventual Consistency Accepted

**Decision:** Accept eventual consistency between content layer and user layer.

**Rationale:**
- Two users saving same URL simultaneously is a race condition
- DynamoDB conditional writes handle deduplication
- Enrichment is async anyway — users don't expect instant metadata
- Simplifies architecture significantly

**Patterns:**
- Content layer uses conditional writes (PutItem with condition)
- User layer references content layer via `urlHash`
- If content doesn't exist, create it; if it does, link to it
- No distributed transactions needed

**Consequences:**
- Brief window where content metadata may be missing
- Idempotent operations everywhere
- Simpler, more resilient system

---

### ADR-010: Processed Search Index (Not Raw Text)

**Decision:** Search operates on processed/extracted substrate, not raw notes text.

**Rationale:**
- Faster queries on structured data
- Better relevance matching (semantic concepts vs string matching)
- Smaller index size
- V2-ready (substrate feeds AI recommendations)

**Trade-offs Accepted:**
- ❌ Cannot find arbitrary string matches in raw notes
- ✅ Searches find meaning, not just text
- ✅ Faster queries
- ✅ Future-proofed for V2 intelligence

**Processing extracts:**
- Topics, concepts, entities
- Key questions answered
- Key decisions made
- Tools mentioned
- Code snippets

**Consequences:**
- Search quality depends on processing quality
- Raw notes preserved in S3 (never lost)
- V2 can enhance processing without re-architecture

---

## Three Processing Pipelines

The system uses three distinct, independent processing pipelines. Each has its own Step Function, CDK stack, and failure domain.

### Pipeline 1: URL Enrichment

**Purpose:** Extract metadata from saved URLs into the Content Layer.

| Aspect | Detail |
|--------|--------|
| Trigger | EventBridge: `SaveCreated` event |
| Input | Raw URL from saves table |
| Output | Content Layer record (global, deduplicated) |
| Target Table | `content` |
| Schema | 200+ fields (type-specific) |

**Step Function Flow:**
1. Check if content layer record exists (GET /content/{urlHash})
2. Detect content type from URL/domain
3. Fetch metadata via appropriate API (YouTube, GitHub, RSS, HTML parse)
4. Sanitize and validate extracted data
5. Create/update content layer (PUT /content)
6. Link save to content layer (PATCH /saves/{id})

**Content-Type Specific Enrichment:**

| Content Type | Primary Source | Fields Extracted |
|--------------|----------------|------------------|
| Podcast | RSS feed, Apple Podcasts API | 29 type-specific fields |
| YouTube Video | YouTube Data API | 38 type-specific fields |
| YouTube Channel | YouTube Data API | 20 type-specific fields |
| Blog/Article | HTML parse (og tags, meta) | 30 type-specific fields |
| GitHub Repo | GitHub REST API | 39 type-specific fields |
| Newsletter | HTML parse, RSS | 15 type-specific fields |
| Tool | HTML parse | 18 type-specific fields |
| Reddit | Reddit API (limited) | 17 type-specific fields |
| LinkedIn | og tags only (restricted) | 9 type-specific fields |

---

### Pipeline 2: Notes Processing

**Purpose:** Process raw Markdown notes into searchable substrate.

| Aspect | Detail |
|--------|--------|
| Trigger | EventBridge: `NoteUpdated` event |
| Input | Raw Markdown from S3 |
| Output | Search Index record |
| Target Table | `search-index` |
| Schema | 39 fields (sourceType: 'note') |

**Step Function Flow:**
1. Fetch raw note from S3
2. Parse Markdown structure
3. Extract code blocks (with language detection)
4. Extract tools mentioned (keyword matching)
5. Build `searchableText` combined blob
6. Create/update search index (PUT /search-index)

**V1 Processing (no LLM):**
- Text extraction from Markdown
- Code block extraction (regex)
- Tool detection (keyword list)
- `processingVersion: 1`

**V2 Processing (adds LLM):**
- Topics, concepts, entities
- Key questions/decisions
- Sentiment, actionability
- `processingVersion: 2`

---

### Pipeline 3: Search Index Sync

**Purpose:** Keep search index in sync with save/project changes.

| Aspect | Detail |
|--------|--------|
| Trigger | EventBridge: `SaveUpdated`, `ProjectUpdated` events |
| Input | Save or Project entity from DynamoDB |
| Output | Search Index record |
| Target Table | `search-index` |
| Schema | 39 fields (sourceType: 'save' or 'project') |

**Step Function Flow:**
1. Fetch entity from source table (GET /saves/{id} or GET /projects/{id})
2. For saves: fetch content layer metadata (GET /content/{urlHash})
3. Merge user layer + content layer data
4. Build `searchableText` combined blob
5. Create/update search index (PUT /search-index)

---

### Pipeline Independence

**Critical Design Principle:** Pipeline failures are isolated.

- Each pipeline has its own DLQ (Dead Letter Queue)
- URL Enrichment failure does NOT block Notes Processing
- Notes Processing failure does NOT block Search Index Sync
- All pipelines are idempotent (safe to retry)

```
┌─────────────────────────────────────────────────────────┐
│           PIPELINE FAILURE ISOLATION                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  YouTube API down?                                      │
│  └─▶ URL Enrichment fails → DLQ                        │
│  └─▶ Notes Processing continues ✓                       │
│  └─▶ Search Index Sync continues ✓                      │
│  └─▶ User's saves still work ✓                          │
│                                                         │
│  S3 temporarily unavailable?                            │
│  └─▶ Notes Processing fails → DLQ                       │
│  └─▶ URL Enrichment continues ✓                         │
│  └─▶ Search Index Sync continues ✓                      │
│  └─▶ User's saves still work ✓                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Search Index Schema

Designed for V1 search with V2 intelligence future-proofing. ~25% overshoot built in.

### Field Categories

| Category | Count | V1 Action | V2 Action |
|----------|-------|-----------|-----------|
| Core | 11 | ✅ Populate | Maintain |
| Enrichment | 7 | ✅ Populate | Maintain |
| Semantic | 7 | ⏳ Schema ready, null | LLM populate |
| Relationship | 4 | ⏳ Schema ready, null | LLM populate |
| Overshoot | 10 | ⏳ Schema ready, null | LLM populate |

**Total: 39 fields**

### Schema Definition

```typescript
interface SearchIndexRecord {
  // === PARTITION & SORT ===
  pk: string;              // 'USER#${userId}'
  sk: string;              // 'INDEX#${sourceType}#${sourceId}'

  // === CORE (V1 Search) ===
  id: string;
  userId: string;
  sourceType: 'save' | 'project' | 'note';
  sourceId: string;
  title: string;
  description?: string;
  tags: string[];
  contentType?: ContentType;
  createdAt: string;
  updatedAt: string;
  searchableText: string;

  // === ENRICHMENT (V1) ===
  domain?: string;
  favicon?: string;
  ogImage?: string;
  author?: string;
  publishedDate?: string;
  durationSeconds?: number;
  wordCount?: number;

  // === SEMANTIC (V2 Ready) ===
  topics?: string[];
  concepts?: string[];
  entities?: string[];
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  contentFormat?: 'tutorial' | 'reference' | 'opinion' | 'news';
  primaryLanguage?: string;
  summary?: string;

  // === RELATIONSHIP (V2 Graph) ===
  relatedTopics?: string[];
  prerequisites?: string[];
  buildsWith?: string[];
  mentionedUrls?: string[];

  // === OVERSHOOT (V2+ Maybe) ===
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  actionability?: 'reference' | 'actionable' | 'hands-on';
  freshnessSignal?: 'evergreen' | 'dated' | 'time-sensitive';
  audienceType?: 'developer' | 'non-technical' | 'mixed';
  learningOutcomes?: string[];
  keyQuestions?: string[];
  keyDecisions?: string[];
  codeSnippets?: CodeSnippet[];
  toolsMentioned?: string[];
  peopleMentioned?: string[];  // Podcasts/videos only

  // === PROCESSING METADATA ===
  processingVersion: number;
  processedAt?: string;
  enrichedAt?: string;
  enrichmentSource?: 'basic' | 'ai';
}
```

---

## Content Layer Schema

Global, deduplicated URL metadata. 200+ fields across content types with ~30% overshoot.

### Base Content Record (All URLs)

```typescript
interface BaseContentRecord {
  // === IDENTIFICATION ===
  urlHash: string;              // SHA256(normalizedUrl)
  normalizedUrl: string;
  originalUrls: string[];
  domain: string;
  contentType: ContentType;

  // === PROCESSING STATE ===
  firstSeenAt: string;
  lastEnrichedAt?: string;
  enrichmentVersion: number;
  enrichmentStatus: 'pending' | 'success' | 'failed' | 'partial';
  enrichmentErrors?: string[];

  // === BASIC METADATA ===
  title?: string;
  description?: string;
  favicon?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  language?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  siteName?: string;

  // === URL HEALTH ===
  lastVerifiedAt?: string;
  httpStatus?: number;
  isLikelyDead?: boolean;
  deadSince?: string;
  redirectsTo?: string;

  // === CROSS-USER SIGNALS (V2) ===
  saveCount: number;
  projectLinkCount: number;
  tutorialCount: number;
  completionCount: number;

  // === CROSS-REFERENCE (V2 Graph) ===
  mentionsUrls?: string[];
  mentionedByUrls?: string[];

  // === SEMANTIC (V2) ===
  topics?: string[];
  concepts?: string[];
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  contentQuality?: 'high' | 'medium' | 'low';
  summary?: string;

  // === OVERSHOOT (V2+) ===
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  audienceType?: 'developer' | 'non-technical' | 'mixed';
  freshnessSignal?: 'evergreen' | 'dated' | 'time-sensitive';
  contentDepth?: 'surface' | 'moderate' | 'deep';
  estimatedReadTime?: number;
  hasPaywall?: boolean;
  requiresAccount?: boolean;
}
```

### Content Type Extensions

Each content type extends BaseContentRecord with type-specific fields:

| Content Type | Additional Fields | Primary API Source |
|--------------|-------------------|-------------------|
| Podcast | 29 fields (show, episode, guests, transcript) | RSS, Apple Podcasts |
| YouTube Video | 38 fields (channel, chapters, captions) | YouTube Data API |
| YouTube Channel | 20 fields (stats, topics, frequency) | YouTube Data API |
| Blog/Article | 30 fields (author, series, code blocks) | HTML parse |
| GitHub Repo | 39 fields (languages, releases, readme) | GitHub REST API |
| Newsletter | 15 fields (frequency, links shared) | HTML, RSS |
| Tool | 18 fields (pricing, platforms, integrations) | HTML parse |
| Reddit | 17 fields (subreddit, engagement) | Reddit API |
| LinkedIn | 9 fields (minimal due to restrictions) | og tags only |

See full type definitions in `/backend/shared/types/content-layer.ts`.

---

## Starter Template & Platform Strategy

### Primary Technology Domain

**API-first serverless platform** with:
- Backend: AWS Lambda + DynamoDB + S3 + API Gateway (CDK)
- Frontend: React + Vite PWA
- Mobile: iOS Shortcut + PWA (V1), Native apps (V2.5+)

### Why Custom Scaffold Over Existing Starters

The architecture decisions made in this document (ADR-001 through ADR-010) define a specific structure that no existing starter provides:

| Requirement | Existing Starters | Our Architecture |
|-------------|-------------------|------------------|
| Multi-table DynamoDB | Single table or none | 6 separate tables |
| Multi-stack CDK | Monolithic stack | 15+ decomposed stacks |
| EventBridge + Step Functions | SQS or none | 3 distinct pipelines |
| Clerk/Auth0 | Cognito or none | Delegated auth |
| 80% test coverage from day 1 | Optional | CI-enforced gate |

**Decision:** Custom scaffold that implements our architecture patterns from line one.

### Project Structure

```
ai-learning-hub/
├── /infra                      # AWS CDK (TypeScript)
│   ├── bin/app.ts             # Stack composition
│   └── lib/stacks/
│       ├── core/              # Tables, buckets
│       ├── auth/              # Clerk/Auth0 integration
│       ├── api/               # API Gateway + Lambdas
│       ├── workflows/         # Step Functions
│       ├── observability/     # Dashboards, alarms
│       └── pipeline/          # CI/CD
│
├── /frontend                   # Vite + React (TypeScript)
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── vite.config.ts
│   └── package.json
│
├── /backend                    # Lambda handlers (TypeScript)
│   ├── functions/
│   │   ├── saves/
│   │   ├── projects/
│   │   ├── links/
│   │   ├── search/
│   │   ├── content/
│   │   └── admin/
│   ├── shared/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── types/
│   └── package.json
│
└── package.json                # Workspace root
```

### Initialization Commands

```bash
# 1. Initialize monorepo
npm init -y
# Configure workspaces: ["infra", "frontend", "backend"]

# 2. Initialize CDK
cd infra && npx cdk init app --language typescript
# Restructure for multi-stack architecture per ADR-006

# 3. Initialize Frontend
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa workbox-window
npm install react-router-dom @tanstack/react-query @clerk/clerk-react

# 4. Initialize Backend
mkdir backend && cd backend
npm init -y
npm install -D typescript @types/node @types/aws-lambda esbuild vitest
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

---

## ADR-011: Platform Strategy (PWA + Native Roadmap)

**Decision:** V1 uses PWA + iOS Shortcut. Native apps planned for V2.5 (iOS) and V3.5 (Android).

**Context:**

The primary mobile use case is **capture** (save URL in <3 seconds), not consumption. Users capture on mobile, consume on desktop.

**Rationale:**

| Approach | Capture Speed | App Store? | Dev Cost | User Value |
|----------|---------------|------------|----------|------------|
| PWA + iOS Shortcut | <3 seconds | No | Low | High for capture |
| Native iOS only | <3 seconds | Yes | High | Marginal improvement |
| PWA only (no Shortcut) | 10+ seconds | No | Lowest | Poor capture UX |

The iOS Shortcut provides:
- Share sheet integration (copy link → run Shortcut)
- Direct API call with authentication
- Haptic feedback confirmation
- Faster than opening a native app

**Platform Capabilities Matrix:**

| Capability | PWA (iOS) | PWA (Android) | Native iOS | Native Android |
|------------|-----------|---------------|------------|----------------|
| Share sheet receive | ❌ | ✅ Web Share Target | ✅ | ✅ |
| Push notifications | ❌ | ✅ | ✅ | ✅ |
| Background sync | ❌ | ✅ | ✅ | ✅ |
| Offline queue | ❌ | ✅ | ✅ | ✅ |
| Siri/Assistant | ❌ | ❌ | ✅ | ✅ |
| Spotlight/search | ❌ | ❌ | ✅ | ✅ |

**Platform Roadmap:**

| Phase | Platform | Delivery | Justification |
|-------|----------|----------|---------------|
| V1 | PWA + iOS Shortcut | Now | Core capture workflow |
| V1.5 | Web Share Target (Android) | Progressive | Android share sheet support |
| V2.5 | Native iOS (Swift) | When user value justifies | Push, Siri, share extension |
| V3.5 | Native Android (Kotlin) | Feature parity | Same as iOS |

**App Store Impact:**

- V1 architecture does NOT block future app store submission
- Native apps will be separate codebases calling the same API
- API-first design (ADR-005) means zero backend changes for native clients
- Clerk/Auth0 both provide native iOS/Android SDKs

**V2.5 Native App Checklist (Future):**

```
□ Apple Developer Account ($99/year)
□ App Store Connect setup
□ Privacy Policy URL (already in PRD)
□ Sign in with Apple (if social login offered)
□ Native share extension
□ Push notification via APNs
□ Siri Shortcuts integration
□ Spotlight search indexing
□ TestFlight beta program
```

**Consequences:**
- V1 optimized for capture-focused workflow
- iOS Shortcut onboarding is critical first-run experience
- Web Share Target adds Android progressive enhancement
- Native apps are additive, not replacement

---

## ADR-012: Web Share Target for Android PWA

**Decision:** Implement Web Share Target API in the PWA for Android users.

**Rationale:**

- Android Chrome fully supports Web Share Target
- Provides share sheet integration without native app
- Progressive enhancement (works where supported, graceful fallback elsewhere)
- Reduces friction for Android users who don't want iOS Shortcut equivalent

**Implementation:**

```json
// manifest.json
{
  "share_target": {
    "action": "/save",
    "method": "POST",
    "enctype": "application/x-www-form-urlencoded",
    "params": {
      "url": "url",
      "title": "title",
      "text": "text"
    }
  }
}
```

**Consequences:**
- Android users can share directly to PWA from any app
- iOS users still use Shortcut (Web Share Target not supported on iOS Safari)
- Service worker must handle offline share queue

---

### ADR-013: Authentication Provider — Clerk

**Decision:** Use Clerk for authentication and user management.

**Rationale:**
- Better developer experience for rapid development
- Excellent React SDK (`@clerk/clerk-react`)
- Unlimited social logins on all tiers
- Better pricing at scale (no "volume punishment")
- Free tier covers boutique scale (10K MAU)
- Native iOS/Android SDKs for V2.5+
- SOC 2 Type II compliant (sufficient for V1)

**Two Authentication Methods:**

| Method | Used By | Mechanism |
|--------|---------|-----------|
| JWT | Web app, Native apps (V2.5+) | Clerk-issued JWT, validated by Lambda authorizer |
| API Key | iOS Shortcut, Dev agents | User-generated, SHA256 hashed in DynamoDB |

**Authentication Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                    CLERK AUTH FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (React)                                           │
│  ┌─────────────────┐                                       │
│  │ ClerkProvider   │ ← Wraps app, manages session          │
│  │ SignIn/SignUp   │ ← Pre-built UI components             │
│  │ useAuth()       │ ← Hook for auth state                 │
│  │ useUser()       │ ← Hook for user data                  │
│  └────────┬────────┘                                       │
│           │ JWT in Authorization header                     │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │  API Gateway    │                                       │
│  │  + Lambda       │ ← Custom JWT Authorizer               │
│  │    Authorizer   │                                       │
│  └────────┬────────┘                                       │
│           │ Validated userId in context                     │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │  Lambda Handler │ ← All handlers receive userId         │
│  │  (saves, etc)   │                                       │
│  └─────────────────┘                                       │
│                                                             │
│  iOS Shortcut                                               │
│  ┌─────────────────┐                                       │
│  │ Stores API Key  │ ← User generates in web app           │
│  │ Calls API       │ ← x-api-key header                    │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │  API Gateway    │                                       │
│  │  API Key Auth   │ ← Validates against users table       │
│  └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**JWT Authorizer Implementation:**
```typescript
// Lambda authorizer for Clerk JWT
import { verifyToken } from '@clerk/backend';

export async function handler(event: APIGatewayTokenAuthorizerEvent) {
  const token = event.authorizationToken.replace('Bearer ', '');

  try {
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    return {
      principalId: verified.sub, // Clerk user ID
      policyDocument: generatePolicy('Allow', event.methodArn),
      context: {
        userId: verified.sub,
        role: verified.publicMetadata?.role || 'user',
      },
    };
  } catch (error) {
    throw new Error('Unauthorized');
  }
}
```

**API Key Authorizer Implementation:**
```typescript
// Lambda authorizer for API keys (iOS Shortcut, Dev agents)
import { sha256 } from './utils/crypto';
import { getUserByApiKeyHash } from './db/users';

export async function handler(event: APIGatewayRequestAuthorizerEvent) {
  const apiKey = event.headers['x-api-key'];
  if (!apiKey) throw new Error('Unauthorized');

  const keyHash = sha256(apiKey);
  const user = await getUserByApiKeyHash(keyHash);

  if (!user || user.revokedAt) {
    throw new Error('Unauthorized');
  }

  // Update lastUsedAt (fire and forget)
  updateApiKeyLastUsed(keyHash).catch(() => {});

  return {
    principalId: user.clerkId,
    policyDocument: generatePolicy('Allow', event.methodArn),
    context: {
      userId: user.clerkId,
      role: user.role,
      authMethod: 'api-key',
    },
  };
}
```

**Role-Based Access Control:**

| Role | Assigned To | Access |
|------|-------------|--------|
| `admin` | Stephen | Full access (all endpoints) |
| `analyst` | Stefania | `/analytics/*` only |
| `user` | Regular users | Own data only (`/saves/*`, `/projects/*`, `/search`, `/users/me`) |

**Consequences:**
- Single auth provider for web, mobile, and API key flows
- Clerk handles OAuth (Google, GitHub) complexity
- Role stored in Clerk `publicMetadata`, synced to DynamoDB on first login
- API keys are independent of Clerk session (long-lived)
- Invite code required at signup (checked before Clerk account creation)

---

## DynamoDB Table Designs

Detailed schema definitions for all 7 tables. Key design principle: **USER always in PK for user-owned data** (security isolation).

### Table 1: users

User profiles and API keys stored in the same table with different sort keys.

```
PK: USER#<clerkId>
SK: PROFILE

Attributes:
  - email: string
  - displayName: string
  - role: 'user' | 'analyst' | 'admin'
  - globalPreferences: object
  - rateLimitOverride?: { requestsPerMinute: number } — admin-adjustable per-user rate limit
  - createdAt: string (ISO 8601)
  - updatedAt: string (ISO 8601)
  - suspendedAt?: string (ISO 8601)

---
For API Keys (same table, different SK):
PK: USER#<clerkId>
SK: APIKEY#<keyId>

Attributes:
  - keyHash: string (SHA256, for lookup)
  - name: string (user-friendly label)
  - scopes: string[] (['saves:write'] or ['*'])
  - createdAt: string (ISO 8601)
  - lastUsedAt?: string (ISO 8601)
  - revokedAt?: string (ISO 8601)

GSI1: apiKeyHash-index
  - PK: keyHash
  - Projects to: clerkId
  - Purpose: API key authentication lookup
```

---

### Table 2: saves

User's saved URLs with references to the global content layer.

```
PK: USER#<userId>
SK: SAVE#<saveId>

Attributes:
  - saveId: string (ULID)
  - url: string
  - urlHash: string (links to content layer)
  - title?: string (user override or from content)
  - userNotes?: string (short notes, NOT the big S3 notes)
  - tags: string[]
  - isTutorial: boolean
  - tutorialStatus?: 'saved' | 'started' | 'completed' | null
  - contentType?: ContentType (denormalized from content layer)
  - createdAt: string (ISO 8601)
  - updatedAt: string (ISO 8601)
  - enrichedAt?: string (ISO 8601)
  - deletedAt?: string (ISO 8601) — soft delete marker

Note: All list queries filter WHERE deletedAt IS NULL

GSI1: userId-contentType-index
  - PK: userId
  - SK: contentType
  - Purpose: Filter saves by type

GSI2: userId-tutorialStatus-index
  - PK: userId
  - SK: tutorialStatus
  - Purpose: Tutorial tracker view

GSI3: urlHash-index (sparse)
  - PK: urlHash
  - Purpose: Find all saves of same URL (for content layer updates, dedup)
```

---

### Table 3: projects

User's projects and folders (folders stored as items with different SK pattern).

```
PK: USER#<userId>
SK: PROJECT#<projectId>

Attributes:
  - projectId: string (ULID)
  - name: string
  - description?: string
  - status: 'exploring' | 'building' | 'paused' | 'completed'
  - folderId?: string
  - tags: string[]
  - notesS3Key?: string (pointer to S3 for large notes)
  - linkedSaveCount: number (denormalized count)
  - createdAt: string (ISO 8601)
  - updatedAt: string (ISO 8601)
  - deletedAt?: string (ISO 8601) — soft delete marker

Note: All list queries filter WHERE deletedAt IS NULL

---
For Folders (same table, different SK):
PK: USER#<userId>
SK: FOLDER#<folderId>

Attributes:
  - folderId: string (ULID)
  - name: string
  - color?: string
  - createdAt: string (ISO 8601)

GSI1: userId-status-index
  - PK: userId
  - SK: status
  - Purpose: Filter projects by status

GSI2: userId-folderId-index
  - PK: userId
  - SK: folderId
  - Purpose: Folder navigation
```

---

### Table 4: links

Many-to-many relationship between projects and saves. **Critical:** USER in PK for security isolation.

```
PK: USER#<userId>
SK: LINK#<projectId>#<saveId>

Attributes:
  - projectId: string
  - saveId: string
  - linkedAt: string (ISO 8601)
  - linkedBy: 'user' | 'system' (for V2 auto-linking)

GSI1: userId-projectId-index
  - PK: userId
  - SK: projectId
  - Purpose: Get all saves for a project

GSI2: userId-saveId-index
  - PK: userId
  - SK: saveId
  - Purpose: Get all projects for a save
```

---

### Table 5: content (Global Content Layer)

Global, deduplicated URL metadata shared across all users. **Intentionally NOT partitioned by user.**

```
PK: CONTENT#<urlHash>
SK: META

Attributes:
  - urlHash: string (SHA256 of normalizedUrl)
  - normalizedUrl: string
  - originalUrls: string[] (variants that resolved here)
  - domain: string
  - contentType: ContentType
  - enrichmentStatus: 'pending' | 'success' | 'failed' | 'partial'
  - enrichmentVersion: number
  - lastEnrichedAt?: string (ISO 8601)
  - lastVerifiedAt?: string (ISO 8601)
  - httpStatus?: number
  - isLikelyDead?: boolean

  // Basic metadata
  - title?: string
  - description?: string
  - favicon?: string
  - ogImage?: string
  - author?: string
  - publishedDate?: string

  // Cross-user signals (aggregate only, no user attribution)
  - saveCount: number
  - projectLinkCount: number

  // Type-specific metadata (200+ fields total)
  - podcast?: PodcastMetadata
  - youtube?: YouTubeMetadata
  - github?: GitHubMetadata
  - etc.

No GSIs needed — single access pattern by urlHash
```

---

### Table 6: search-index

Processed search substrate for fast queries. User-partitioned for isolation.

```
PK: USER#<userId>
SK: INDEX#<sourceType>#<sourceId>

Attributes:
  - sourceType: 'save' | 'project' | 'note'
  - sourceId: string
  - title: string
  - description?: string
  - tags: string[]
  - searchableText: string (combined text blob for search)
  - contentType?: ContentType
  - domain?: string
  - processingVersion: number
  - processedAt?: string (ISO 8601)

  // V2-ready semantic fields (nullable in V1)
  - topics?: string[]
  - concepts?: string[]
  - entities?: string[]
  - skillLevel?: 'beginner' | 'intermediate' | 'advanced'
  - (39 total fields — see Search Index Schema section)

GSI1: userId-sourceType-index
  - PK: userId
  - SK: sourceType
  - Purpose: Filter search by type (saves only, projects only, etc.)
```

---

### Table 7: invite-codes

Invite code management. Partitioned by CODE for lookup during redemption.

```
PK: CODE#<code>
SK: META

Attributes:
  - code: string
  - generatedBy: string (userId)
  - generatedAt: string (ISO 8601)
  - redeemedBy?: string (userId)
  - redeemedAt?: string (ISO 8601)
  - expiresAt?: string (ISO 8601)
  - isRevoked: boolean

GSI1: generatedBy-index
  - PK: generatedBy (userId)
  - Purpose: List codes a user generated (admin view)
```

---

## GSI Summary

All 10 Global Secondary Indexes across 7 tables:

| # | Table | GSI Name | PK | SK | Purpose |
|---|-------|----------|----|----|---------|
| 1 | users | apiKeyHash-index | keyHash | — | API key auth lookup |
| 2 | saves | userId-contentType-index | userId | contentType | Filter by type |
| 3 | saves | userId-tutorialStatus-index | userId | tutorialStatus | Tutorial tracker view |
| 4 | saves | urlHash-index | urlHash | — | Dedup, content layer linking |
| 5 | projects | userId-status-index | userId | status | Filter by status |
| 6 | projects | userId-folderId-index | userId | folderId | Folder navigation |
| 7 | links | userId-projectId-index | userId | projectId | Get saves for project |
| 8 | links | userId-saveId-index | userId | saveId | Get projects for save |
| 9 | search-index | userId-sourceType-index | userId | sourceType | Filter search by type |
| 10 | invite-codes | generatedBy-index | generatedBy | — | List user's generated codes |

---

## Access Patterns

How each query maps to table operations:

### User Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Get user by Clerk ID | users | PK: `USER#<clerkId>`, SK: `PROFILE` | GetItem |
| Get user by API key hash | users | GSI: apiKeyHash-index | Query |
| List user's API keys | users | PK: `USER#<clerkId>`, SK begins_with `APIKEY#` | Query |

### Save Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Get save by ID | saves | PK: `USER#<userId>`, SK: `SAVE#<saveId>` | GetItem |
| List user's saves (paginated) | saves | PK: `USER#<userId>`, SK begins_with `SAVE#` | Query |
| List saves by content type | saves | GSI: userId-contentType-index | Query |
| List saves by tutorial status | saves | GSI: userId-tutorialStatus-index | Query |
| Get saves by URL hash | saves | GSI: urlHash-index | Query |

### Project Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Get project by ID | projects | PK: `USER#<userId>`, SK: `PROJECT#<projectId>` | GetItem |
| List user's projects | projects | PK: `USER#<userId>`, SK begins_with `PROJECT#` | Query |
| List projects by status | projects | GSI: userId-status-index | Query |
| List projects in folder | projects | GSI: userId-folderId-index | Query |
| List user's folders | projects | PK: `USER#<userId>`, SK begins_with `FOLDER#` | Query |

### Link Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Get saves for project | links | GSI: userId-projectId-index | Query + BatchGetItem on saves |
| Get projects for save | links | GSI: userId-saveId-index | Query + BatchGetItem on projects |
| Check if link exists | links | PK: `USER#<userId>`, SK: `LINK#<projectId>#<saveId>` | GetItem |
| Create link | links | PK: `USER#<userId>`, SK: `LINK#<projectId>#<saveId>` | PutItem |
| Remove link | links | PK: `USER#<userId>`, SK: `LINK#<projectId>#<saveId>` | DeleteItem |

### Content Layer Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Get content by URL hash | content | PK: `CONTENT#<urlHash>`, SK: `META` | GetItem |
| Check if content exists | content | PK: `CONTENT#<urlHash>`, SK: `META` | GetItem |
| Create/update content | content | PK: `CONTENT#<urlHash>`, SK: `META` | PutItem (conditional) |

### Search Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Search user's content | search-index | PK: `USER#<userId>`, filter on searchableText | Query + FilterExpression |
| Filter search by type | search-index | GSI: userId-sourceType-index | Query |
| Get index record by source | search-index | PK: `USER#<userId>`, SK: `INDEX#<sourceType>#<sourceId>` | GetItem |

### Invite Code Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Validate invite code | invite-codes | PK: `CODE#<code>`, SK: `META` | GetItem |
| Redeem invite code | invite-codes | PK: `CODE#<code>`, SK: `META` | UpdateItem (conditional) |
| List user's generated codes | invite-codes | GSI: generatedBy-index | Query |

### Folder Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Create folder | projects | PK: `USER#<userId>`, SK: `FOLDER#<folderId>` | PutItem |
| List user's folders | projects | PK: `USER#<userId>`, SK begins_with `FOLDER#` | Query |
| Update folder | projects | PK: `USER#<userId>`, SK: `FOLDER#<folderId>` | UpdateItem |
| Delete folder | projects | PK: `USER#<userId>`, SK: `FOLDER#<folderId>` | DeleteItem + UpdateItem (clear folderId on projects) |

### Bulk Link Operations

| Access Pattern | Table | Key Design | Operation |
|----------------|-------|------------|-----------|
| Bulk link saves to project | links | Multiple PK/SK pairs | TransactWriteItems (max 100 items) |
| Bulk unlink saves from project | links | Multiple PK/SK pairs | TransactWriteItems (max 100 items) |

### Admin Operations (Scan-Based)

**Note:** These operations use DynamoDB Scan, which is acceptable at boutique scale (10-20 users, <1000 invite codes).

| Access Pattern | Table | Operation | Notes |
|----------------|-------|-----------|-------|
| List all users | users | Scan with FilterExpression `SK = 'PROFILE'` | Returns all user profiles |
| List all invite codes | invite-codes | Scan | Returns all codes (used + unused) |

**Admin Scan Implementation:**

```typescript
// List all users (admin only)
async function listAllUsers(): Promise<UserProfile[]> {
  const result = await db.scan({
    TableName: 'users',
    FilterExpression: 'sk = :profile',
    ExpressionAttributeValues: {
      ':profile': 'PROFILE',
    },
  });
  return result.Items as UserProfile[];
}

// List all invite codes (admin only)
async function listAllInviteCodes(): Promise<InviteCode[]> {
  const result = await db.scan({
    TableName: 'invite-codes',
  });
  return result.Items as InviteCode[];
}
```

**Why Scan is acceptable here:**
- Boutique scale: 10-20 users max
- Admin-only operations (infrequent)
- No real-time performance requirement
- Cost negligible at this scale

**V2 consideration:** If user count grows significantly, add GSI:
- `role-createdAt-index` (PK: role, SK: createdAt) for user listing
- `status-createdAt-index` (PK: 'unused'|'used', SK: createdAt) for invite codes

---

## Critical Query Examples

### Get Project with All Linked Saves

```typescript
async function getProjectWithSaves(userId: string, projectId: string) {
  // 1. Get project (1 read)
  const project = await db.get({
    TableName: 'projects',
    Key: { pk: `USER#${userId}`, sk: `PROJECT#${projectId}` }
  });

  // 2. Get links for project (1 query via GSI)
  const links = await db.query({
    TableName: 'links',
    IndexName: 'userId-projectId-index',
    KeyConditionExpression: 'userId = :uid AND projectId = :pid',
    ExpressionAttributeValues: {
      ':uid': userId,
      ':pid': projectId
    }
  });

  // 3. Batch get saves (1 batch read, max 100 items)
  const saveIds = links.Items.map(l => l.saveId);
  const saves = await db.batchGet({
    RequestItems: {
      'saves': {
        Keys: saveIds.map(id => ({
          pk: `USER#${userId}`,
          sk: `SAVE#${id}`
        }))
      }
    }
  });

  return { project, saves: saves.Responses.saves };
}
// Total: 3 DynamoDB operations
```

### Mobile Save (Critical Path — Must Be Fast)

```typescript
async function createSave(userId: string, url: string) {
  const saveId = ulid();
  const urlHash = sha256(normalizeUrl(url));

  // 1. Write save (1 write)
  await db.put({
    TableName: 'saves',
    Item: {
      pk: `USER#${userId}`,
      sk: `SAVE#${saveId}`,
      saveId,
      url,
      urlHash,
      createdAt: new Date().toISOString(),
      // No title yet — enrichment will add it
    }
  });

  // 2. Emit event for enrichment (async, non-blocking)
  await eventBridge.putEvents({
    Entries: [{
      Source: 'ai-learning-hub.saves',
      DetailType: 'SaveCreated',
      Detail: JSON.stringify({ userId, saveId, url, urlHash })
    }]
  });

  return { saveId };
}
// Total: 1 write + 1 async event. Fast. ✅
```

### Search Across Everything (V1)

```typescript
async function search(userId: string, query: string, filters?: SearchFilters) {
  const params: QueryCommandInput = {
    TableName: 'search-index',
    KeyConditionExpression: 'pk = :pk',
    FilterExpression: 'contains(searchableText, :q)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':q': query.toLowerCase()
    }
  };

  // Optional: filter by sourceType via GSI
  if (filters?.sourceType) {
    params.IndexName = 'userId-sourceType-index';
    params.KeyConditionExpression = 'userId = :uid AND sourceType = :st';
    params.ExpressionAttributeValues = {
      ':uid': userId,
      ':st': filters.sourceType,
      ':q': query.toLowerCase()
    };
  }

  const results = await db.query(params);
  return results.Items;
}
// Note: contains() is a scan within the partition.
// At <1000 items per user, this is acceptable for V1.
// V2 would move to OpenSearch for proper full-text.
```

---

## Data Isolation Security

All user-owned tables enforce per-user isolation:

| Table | PK includes userId? | Isolation Enforced? |
|-------|---------------------|---------------------|
| users | ✅ `USER#<clerkId>` | ✅ |
| saves | ✅ `USER#<userId>` | ✅ |
| projects | ✅ `USER#<userId>` | ✅ |
| links | ✅ `USER#<userId>` | ✅ |
| content | ❌ `CONTENT#<urlHash>` | ✅ Intentionally global |
| search-index | ✅ `USER#<userId>` | ✅ |
| invite-codes | ❌ `CODE#<code>` | ✅ Different access pattern |

**Security guarantees:**
- A user can only query their own partition (enforced at application layer)
- Content layer is intentionally shared (no user attribution in V1)
- Invite codes are looked up by code value, not by user

---

## API Endpoint Specification

Complete API surface organized by domain. Separate `/admin` and `/analytics` paths enable granular access control.

### Core User APIs

#### /saves

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| POST | `/saves` | Create save | Mobile capture, <3s target |
| GET | `/saves` | List user's saves | Filters: type, tag, status |
| GET | `/saves/:id` | Get single save | Includes content layer data |
| PATCH | `/saves/:id` | Update save | Tags, notes, status |
| DELETE | `/saves/:id` | Soft delete save | |

#### /projects

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| POST | `/projects` | Create project | |
| GET | `/projects` | List user's projects | Filters: status, folder |
| GET | `/projects/:id` | Get project | Includes linked saves count |
| PATCH | `/projects/:id` | Update project metadata | |
| DELETE | `/projects/:id` | Soft delete project | |
| PUT | `/projects/:id/notes` | Update project notes | → S3 |
| GET | `/projects/:id/notes` | Get project notes | ← S3 |
| GET | `/projects/:id/saves` | List saves linked to project | |

#### /folders

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| POST | `/folders` | Create folder | |
| GET | `/folders` | List user's folders | |
| PATCH | `/folders/:id` | Update folder | Name, color |
| DELETE | `/folders/:id` | Delete folder | Projects moved to uncategorized |

#### /links (project ↔ save relationships)

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| POST | `/projects/:id/saves` | Link save to project | |
| DELETE | `/projects/:id/saves/:saveId` | Unlink save from project | |
| POST | `/projects/:id/saves/bulk` | Bulk link/unlink saves | TransactWriteItems (max 100) |

#### /search

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| GET | `/search` | Search saves, projects, notes | `?q=term&type=save\|project\|note&limit=50` |

#### /users

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| GET | `/users/me` | Get current user profile | |
| PATCH | `/users/me` | Update profile | Display name, preferences |
| POST | `/users/api-keys` | Generate API key | For iOS Shortcut |
| GET | `/users/api-keys` | List API keys | Masked |
| DELETE | `/users/api-keys/:id` | Revoke API key | |

---

### Internal APIs (Pipeline Use)

These endpoints are used by the processing pipelines, not exposed to end users.

#### /content (URL Enrichment pipeline)

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| GET | `/content/:urlHash` | Get content layer record | |
| PUT | `/content` | Create/update content layer record | Conditional write |

#### /search-index (All 3 pipelines)

| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| PUT | `/search-index` | Create/update search index record | |
| DELETE | `/search-index/:id` | Delete search index record | |

#### Internal API Authentication (AWS IAM)

Internal APIs (`/content/*`, `/search-index/*`) use **AWS IAM authentication** for service-to-service calls. This is still API-first — Step Functions call API Gateway endpoints using SigV4-signed HTTP requests, not direct Lambda invocations.

```
Step Function Execution Role
    │
    │ sts:AssumeRole
    ▼
┌─────────────────────────────┐
│  StepFunctionExecutionRole  │
│  ─────────────────────────  │
│  Permissions:               │
│  - execute-api:Invoke on    │
│    /content/* endpoints     │
│  - execute-api:Invoke on    │
│    /search-index/* endpoints│
└─────────────────────────────┘
    │
    │ SigV4 signed request
    ▼
┌─────────────────────────────┐
│  API Gateway (IAM Auth)     │
│  ─────────────────────────  │
│  Authorization: AWS_IAM     │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Lambda Handler             │
│  (no user context needed)   │
└─────────────────────────────┘
```

**Why AWS IAM auth for internal APIs:**
- **Still API-first** — HTTP requests to API Gateway, not direct Lambda calls
- Step Functions cannot use Clerk JWT (no user session in background processing)
- IAM provides strong service-to-service authentication (SigV4 signing)
- Follows ADR-005 (no Lambda-to-Lambda calls) — all traffic through API Gateway
- Auditable via CloudTrail (who called what, when)
- No ClickOps — IAM roles defined in CDK

**CDK Implementation:**
```typescript
// Internal API routes use IAM authorization
const contentApi = api.root.addResource('content');
contentApi.addMethod('PUT', contentLambdaIntegration, {
  authorizationType: AuthorizationType.IAM,
});

// Step Function execution role gets invoke permission
stepFunctionRole.addToPolicy(new PolicyStatement({
  actions: ['execute-api:Invoke'],
  resources: [
    `arn:aws:execute-api:${region}:${account}:${api.restApiId}/*/PUT/content`,
    `arn:aws:execute-api:${region}:${account}:${api.restApiId}/*/PUT/search-index`,
    `arn:aws:execute-api:${region}:${account}:${api.restApiId}/*/DELETE/search-index/*`,
  ],
}));
```

---

### Admin APIs (Stephen Only)

Operational controls for system management. Requires `admin` role.

#### User Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List all users |
| GET | `/admin/users/:id` | User details + activity summary |
| POST | `/admin/users/:id/suspend` | Suspend user |
| POST | `/admin/users/:id/unsuspend` | Unsuspend user |

#### Invite Codes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/invite-codes` | List invite codes (used/unused) |
| POST | `/admin/invite-codes` | Generate invite code |
| DELETE | `/admin/invite-codes/:code` | Revoke invite code |

#### Operational Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/health` | System health check (all services) |
| GET | `/admin/pipelines` | Pipeline status summary |
| GET | `/admin/pipelines/:name` | Specific pipeline details |
| GET | `/admin/pipelines/:name/failures` | Recent failures from DLQ |
| POST | `/admin/pipelines/:name/retry` | Retry failed execution |

#### Rate Limits

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/rate-limits` | Current rate limit status by user |
| PATCH | `/admin/rate-limits/:userId` | Adjust user rate limit |

#### Troubleshooting

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/logs` | Query CloudWatch logs |
| GET | `/admin/traces/:traceId` | X-Ray trace lookup |

---

### Analytics APIs (Stephen + Stefania)

Read-only analytics endpoints. Requires `admin` or `analyst` role.

#### User Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/users/summary` | Total users, active, new |
| GET | `/analytics/users/active` | DAU, WAU, MAU time series |
| GET | `/analytics/users/retention` | Retention cohort analysis |
| GET | `/analytics/users/growth` | New user signups over time |

#### Save Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/saves/volume` | Saves per day/week/month |
| GET | `/analytics/saves/by-type` | Breakdown by content type |
| GET | `/analytics/saves/by-domain` | Top domains being saved |
| GET | `/analytics/saves/enrichment` | Enrichment success/failure rates |

#### Project Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/projects/volume` | Projects created over time |
| GET | `/analytics/projects/activity` | Active projects (recent edits) |
| GET | `/analytics/projects/saves-per` | Distribution of saves per project |

#### Tutorial Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/tutorials/funnel` | saved → started → completed |
| GET | `/analytics/tutorials/completion` | Completion rate over time |

#### Engagement Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/engagement/sessions` | Session duration, frequency |
| GET | `/analytics/engagement/features` | Feature usage breakdown |
| GET | `/analytics/engagement/mobile` | Mobile vs desktop activity |

#### Search Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/search/volume` | Searches per day |
| GET | `/analytics/search/queries` | Top search terms |
| GET | `/analytics/search/zero-results` | Queries with no results |

#### Notes Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/notes/volume` | Notes created/edited |
| GET | `/analytics/notes/size` | Average note size distribution |

#### Analytics Data Sources

Analytics endpoints pull from **CloudWatch Metrics** and **CloudWatch Logs Insights** — no separate analytics database in V1.

| Metric Category | Data Source | Implementation |
|-----------------|-------------|----------------|
| User summary | CloudWatch Metrics | Custom metric: `UserCount` |
| DAU/WAU/MAU | CloudWatch Logs Insights | Query auth events by unique userId |
| Retention cohorts | CloudWatch Logs Insights | Query first login vs subsequent logins |
| Save volume | CloudWatch Metrics | Custom metric: `SavesCreated` per day |
| Saves by type | CloudWatch Metrics | Dimension: `contentType` |
| Saves by domain | CloudWatch Logs Insights | Query save events, group by domain |
| Enrichment rates | Step Functions metrics | `ExecutionsSucceeded`, `ExecutionsFailed` |
| Project volume | CloudWatch Metrics | Custom metric: `ProjectsCreated` |
| Tutorial funnel | CloudWatch Metrics | Dimensions: `tutorialStatus` transitions |
| Session data | CloudWatch Logs Insights | Query API Gateway access logs |
| Search queries | CloudWatch Logs Insights | Query search Lambda logs |
| Notes volume | CloudWatch Metrics | Custom metric: `NotesUpdated` |

**Custom Metrics Pattern:**

All Lambda functions emit custom metrics via embedded metric format (EMF):

```typescript
// In Lambda handler
import { metricScope, Unit } from 'aws-embedded-metrics';

export const handler = metricScope(metrics => async (event) => {
  // ... handler logic ...

  metrics.setNamespace('AILearningHub');
  metrics.putMetric('SavesCreated', 1, Unit.Count);
  metrics.setDimensions({ contentType: 'youtube', userId: event.userId });
});
```

**CloudWatch Logs Insights Queries:**

Analytics Lambdas run Logs Insights queries on demand:

```typescript
// Example: Get DAU for last 7 days
const query = `
  fields @timestamp, userId
  | filter action = 'api_request'
  | stats count_distinct(userId) as dau by bin(1d)
  | sort @timestamp desc
  | limit 7
`;

const results = await cloudwatchLogs.startQuery({
  logGroupName: '/aws/lambda/api-gateway',
  queryString: query,
  startTime: sevenDaysAgo,
  endTime: now,
});
```

**V2 Consideration:** If analytics queries become expensive or slow, consider:
- Pre-aggregated metrics table (daily batch job)
- Athena + S3 for historical queries
- Third-party analytics (Amplitude, Mixpanel)

---

### Access Control Summary

| Path | Stephen | Stefania | Regular Users | iOS Shortcut | Dev Agent |
|------|---------|----------|---------------|--------------|-----------|
| `/saves/*` | ✅ own | ✅ own | ✅ own | ✅ (API key) | ✅ (API key) |
| `/projects/*` | ✅ own | ✅ own | ✅ own | ❌ | ✅ (API key) |
| `/folders/*` | ✅ own | ✅ own | ✅ own | ❌ | ✅ (API key) |
| `/search` | ✅ own | ✅ own | ✅ own | ❌ | ✅ (API key) |
| `/users/me` | ✅ | ✅ | ✅ | ❌ | ✅ (API key) |
| `/content/*` | ❌ | ❌ | ❌ | ❌ | ✅ AWS IAM (service-to-service) |
| `/search-index/*` | ❌ | ❌ | ❌ | ❌ | ✅ AWS IAM (service-to-service) |
| `/admin/*` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/analytics/*` | ✅ | ✅ | ❌ | ❌ | ❌ |

**Clerk Roles:**
- `admin` → Stephen (full access)
- `analyst` → Stefania (`/analytics/*` only)
- `user` → Regular users (own data only)

---

## Additional Architecture Decisions

### ADR-014: API-First Design Philosophy

**Decision:** APIs are the primary product. The web UI is a reference implementation.

**Context:**

This platform is designed for **agent integration from day one**. The primary consumers are:
1. LLMs and AI agents (programmatic access)
2. iOS Shortcuts (automated capture)
3. Dev persona agents (programmatic project management)
4. Future integrations (unknown but anticipated)

The web UI serves Stephen and close users but is not the primary value delivery mechanism.

**Rationale:**
- All functionality must be API-accessible — no UI-only features
- Response shapes optimized for machine consumption, not human readability
- OpenAPI spec is the **contract for AI agents**, not just documentation
- Error codes must be predictable and machine-parseable
- Rate limits designed for agent consumption patterns (bursty, automated)

**Implications:**
- Every endpoint is a potential integration point
- Contract tests are critical, not nice-to-have
- Error handling must be exhaustive (agents hit every edge case)
- Pagination, date formats, headers must be 100% consistent

**API Design Principles:**
- Consistent pagination: `{ items: [], nextToken?: string, hasMore: boolean }`
- ISO 8601 dates everywhere: `2026-02-03T12:00:00.000Z`
- Idempotency keys for write operations (header: `X-Idempotency-Key`)
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
- Correlation IDs in every response: `X-Request-Id`

**Consequences:**
- Higher API design standards than typical web backend
- More comprehensive OpenAPI documentation
- Test coverage must include agent consumption patterns
- UI is never the source of truth for functionality

---

### ADR-015: Lambda Layers for Shared Code

**Decision:** Use Lambda Layers for shared utilities across all functions.

**Rationale:**
- **Faster cold starts** — Shared code loaded once per execution environment
- **Smaller deployment packages** — Each function deploys only its handler code
- **Consistent dependencies** — All functions use same version of shared utilities
- **Cache efficiency** — AWS caches layers at the execution environment level

**Layer Structure:**
```
/infra/layers/
  /shared-utils/
    nodejs/node_modules/
      @ai-learning-hub/
        middleware/     → auth, error handling, request validation
        logging/        → structured logging with X-Ray integration
        types/          → shared TypeScript types (errors, entities)
        db/             → DynamoDB client + query helpers
        validation/     → request/response validation schemas
```

**Build Strategy:**
- Bundle with esbuild for tree-shaking
- Layer published via CDK as `SharedUtilsLayer`
- All Lambda functions reference the layer
- Version tracked in layer ARN

**CDK Implementation:**
```typescript
const sharedLayer = new LayerVersion(this, 'SharedUtilsLayer', {
  code: Code.fromAsset('layers/shared-utils'),
  compatibleRuntimes: [Runtime.NODEJS_20_X],
  description: 'Shared utilities for all Lambda functions',
});

// All functions reference the layer
const savesFunction = new Function(this, 'SavesHandler', {
  layers: [sharedLayer],
  // ...
});
```

**Consequences:**
- Layer must be deployed before functions that use it
- Version management required (semantic versioning recommended)
- Local development needs layer simulation or path aliasing
- Maximum 5 layers per function (AWS limit) — plan layer composition carefully

---

### ADR-016: Cold Start Acceptance (V1)

**Decision:** Accept cold start latency without mitigation in V1.

**Context:**

At boutique scale (10-20 users, sporadic usage), Lambda functions will frequently cold start. Provisioned concurrency costs ~$15-30/month per function, which would exceed the $50/month total budget with 15+ functions.

**Rationale:**
- First request of a session may exceed 3-second SLA
- Subsequent requests within ~15 minutes will be warm (<500ms)
- Provisioned concurrency cost-prohibitive at boutique scale
- User base (Stephen + friends) can tolerate occasional slow first-hit

**Expected Behavior:**
| Scenario | Expected Latency |
|----------|------------------|
| Cold start (first request) | 2-5 seconds |
| Warm invocation | 100-500ms |
| Warm with DynamoDB | 200-800ms |

**Monitoring Strategy:**
- CloudWatch alarm: p99 latency > 5s (indicates systemic issue, not cold start)
- Dashboard widget: Cold start percentage per function
- X-Ray traces tagged with `coldStart: true` for analysis

**Future Mitigation (V2+):**
If user base grows or cold starts become unacceptable:
1. Provisioned concurrency on critical path (saves, search)
2. CloudWatch Events scheduled warming (every 5 minutes)
3. Snap Start (if Java) or container image optimization

**Consequences:**
- First save of a session may feel slow
- Document in user onboarding ("first action may take a moment")
- CloudWatch will show p99 spikes — this is expected, not a bug
- Do not optimize prematurely

---

## Next Steps

This document will continue to be built out with:

- [x] ~~API endpoint specifications~~
- [x] ~~Authentication flow details (Clerk vs Auth0)~~
- [x] ~~DynamoDB access patterns and GSI design~~
- [x] ~~API-First Design Philosophy (ADR-014)~~
- [x] ~~Lambda Layers Strategy (ADR-015)~~
- [x] ~~Cold Start Acceptance (ADR-016)~~
- [ ] Lambda function specifications
- [ ] Observability implementation details

---

_Document generated: 2026-02-03_
_Last updated: 2026-02-03 (Party Mode Review — added ADR-014, ADR-015, ADR-016)_
_Workflow: BMAD Architecture Discovery_
