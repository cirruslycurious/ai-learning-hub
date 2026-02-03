---
stepsCompleted: [1, 2]
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

**Tables:**
- `users` — auth metadata, API keys, invite codes
- `saves` — user-layer save records
- `content` — global content layer (deduplicated URLs)
- `projects` — project metadata
- `links` — many-to-many project↔save relationships
- `search-index` — denormalized for query patterns

**Consequences:**
- More GSIs to manage
- Cross-table queries require application-level joins
- Cleaner boundaries, easier testing

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

## Next Steps

This document will continue to be built out with:

- [ ] API endpoint specifications
- [ ] Authentication flow details (Clerk vs Auth0)
- [ ] DynamoDB access patterns and GSI design
- [ ] Lambda function specifications
- [ ] Error handling patterns
- [ ] Observability implementation details

---

_Document generated: 2026-02-03_
_Workflow: BMAD Architecture Discovery_
