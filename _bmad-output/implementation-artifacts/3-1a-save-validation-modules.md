# Story 3.1a: Save Validation & Content Detection Modules

Status: ready-for-dev

## Story

As a developer building the save system,
I want reusable, well-tested URL normalization, validation schemas, and content type detection modules,
so that all save operations use consistent, correct URL processing and validation.

## Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | A raw URL is provided | URL normalization runs | Normalized form produced: lowercase scheme+host, remove default ports (80/443), resolve `.`/`..` path segments, decode unreserved %-encoded chars, sort query params, remove fragment, strip `www.`, trailing slash on root only, IDN to punycode. Preserve original scheme. `urlHash` = SHA-256 of `normalizedUrl` |
| AC2 | URL scheme is not http or https | Validation | Rejects with structured error: `{ code: 'VALIDATION_ERROR', message: 'Only http and https URLs are supported' }` |
| AC3 | URL is empty, missing, or malformed | Validation | Rejects with structured error: `{ code: 'VALIDATION_ERROR', message: 'A valid URL is required' }` |
| AC4 | URL contains embedded credentials (user:pass@) | Validation | Rejects with structured error: `{ code: 'VALIDATION_ERROR', message: 'URLs with embedded credentials are not allowed' }` |
| AC5 | URL from a known domain (e.g., youtube.com) | Content type detection runs | Returns correct contentType from domain mapping table (see Technical Notes). Default for unrecognized domains: `other`. |
| AC6 | User provides explicit contentType | Content type detection runs | User-provided `contentType` takes precedence over auto-detection |
| AC7 | Zod validation schema called with valid input | Schema validation | Passes: url (required, valid URL, no embedded credentials), title (optional, max 500 chars), userNotes (optional, max 2000 chars), contentType (optional, enum), tags (optional, array max 20, each max 50 chars, trimmed, deduplicated) |
| AC8 | Zod validation schema called with invalid input | Schema validation | Returns field-level validation errors |
| AC9 | -- | -- | URL normalizer has 40+ unit tests covering: percent-encoding (`%7E` -> `~`), default port removal, path segments, embedded credential rejection, IDN to punycode, trailing slash rules, query param ordering, fragment removal |

## Tasks / Subtasks

- [ ] Task 1: Update existing shared types to match Epic 3 architecture (AC: all)
  - [ ] 1.1 Rename `ResourceType` enum to `ContentType` with lowercase values: `article`, `video`, `podcast`, `github_repo`, `newsletter`, `tool`, `reddit`, `linkedin`, `other`
  - [ ] 1.2 Update `Save` interface with full schema: add `normalizedUrl`, `urlHash`, `tags`, `linkedProjectCount`, `isTutorial`, `tutorialStatus`, `lastAccessedAt`, `deletedAt`, `enrichedAt`, `userNotes`; rename `resourceType` to `contentType`; rename `notes` to `userNotes`; remove `description`, `favicon` (those belong on Content entity)
  - [ ] 1.3 Update `TutorialStatus` enum to lowercase values: `saved`, `started`, `in-progress`, `completed` (per PRD FR40; NOTE: architecture.md currently defines only 3 states — `saved | started | completed | null` — and needs an amendment to add `in-progress`; file a follow-up if not already amended)
  - [ ] 1.4 Add `DUPLICATE_SAVE` to `ErrorCode` enum + `ErrorCodeToStatus` (maps to 409)
  - [ ] 1.5 Update `resourceTypeSchema` in schemas.ts to `contentTypeSchema` with new lowercase values
  - [ ] 1.6 Update `tagsSchema` max from 10 to 20, add `.transform()` that trims each tag first, THEN deduplicates (order matters: `[' foo ', 'foo']` → trim → `['foo', 'foo']` → dedup → `['foo']`)
  - [ ] 1.7 Update `tutorialStatusSchema` to match new lowercase enum values
  - [ ] 1.8 Update `urlSchema` to reject embedded credentials
  - [ ] 1.9 Update all existing tests in `types/test/` and `validation/test/` to match new values
  - [ ] 1.10 Update all exports in `types/src/index.ts` and `validation/src/index.ts`:
    - [ ] 1.10.1 In `types/src/index.ts` (line 31): rename `ResourceType` export to `ContentType`
    - [ ] 1.10.2 In `validation/src/index.ts` (line 18): rename `resourceTypeSchema` export to `contentTypeSchema`
- [ ] Task 2: Create URL Normalizer module (AC: #1, #2, #3, #4)
  - [ ] 2.1 Create `backend/shared/validation/src/url-normalizer.ts` with `normalizeUrl(rawUrl: string): NormalizeResult` function
  - [ ] 2.2 Implement normalization rules: lowercase scheme+host, remove default ports (80/443), resolve `.`/`..` path segments, decode unreserved %-encoded chars, sort query params, remove fragment, strip `www.` prefix, trailing slash on root only (add `/`; paths: preserve as-is), IDN domains via `url.domainToASCII()`. Preserve original scheme (do NOT rewrite http to https)
  - [ ] 2.3 Implement URL validation: reject non-http/https schemes, reject empty/malformed URLs, reject embedded credentials (`user:pass@`)
  - [ ] 2.4 Implement `urlHash` generation: SHA-256 of `normalizedUrl` using Node.js built-in `crypto.createHash('sha256')`
  - [ ] 2.5 Define and export `NormalizeResult` interface in `url-normalizer.ts` (co-located with implementation): `{ normalizedUrl: string; urlHash: string; }`
- [ ] Task 3: Create Content Type Detector module (AC: #5, #6)
  - [ ] 3.1 Create `backend/shared/validation/src/content-type-detector.ts` with `detectContentType(url: string, userProvided?: ContentType): ContentType`
  - [ ] 3.2 Implement domain mapping table (config-driven, extensible)
  - [ ] 3.3 Implement user-override precedence: user-provided contentType always wins
- [ ] Task 4: Create Save Zod Schemas (AC: #7, #8)
  - [ ] 4.1 Add `createSaveSchema` and `updateSaveSchema` to existing `backend/shared/validation/src/schemas.ts` (same file as other schemas — do NOT create a `schemas/` subdirectory)
  - [ ] 4.2 `createSaveSchema`: url (required, valid URL, no embedded credentials), title (optional, max 500 chars), userNotes (optional, max 2000 chars), contentType (optional, enum), tags (optional, array max 20, each max 50 chars, trimmed, deduplicated)
  - [ ] 4.3 `updateSaveSchema`: title (optional, max 500 chars), userNotes (optional, max 2000 chars), contentType (optional, enum), tags (optional, array max 20, each max 50 chars, trimmed, deduplicated). URL fields NOT included (immutable after creation). At least one field required.
  - [ ] 4.4 Share common `tagsSchema` between create and update
- [ ] Task 5: Write comprehensive tests (AC: #9)
  - [ ] 5.1 URL normalizer tests (40+ cases): percent-encoding (`%7E` to `~`), default port removal (`:80`, `:443`), path segment resolution (`/.`, `/..`), embedded credential rejection, IDN to punycode, trailing slash rules (root vs paths), query param ordering, fragment removal, scheme preservation, www stripping
  - [ ] 5.2 Content type detector tests: all domain mappings, user-override precedence, unrecognized domain returns `other`, subdomain matching (e.g., `open.spotify.com/show`)
  - [ ] 5.3 Save schema tests: valid inputs pass, missing url fails, invalid url fails, embedded credentials fail, title max length, userNotes max length, tags max count (20), tag max length (50), tags trimmed and deduplicated, invalid contentType fails, field-level error messages
- [ ] Task 6: Update exports and verify build
  - [ ] 6.1 Add all new exports to `backend/shared/validation/src/index.ts`:
    - `normalizeUrl`, `NormalizeResult` from `./url-normalizer.js`
    - `detectContentType` from `./content-type-detector.js`
    - `createSaveSchema`, `updateSaveSchema` from `./schemas.js` (already re-exported file, just add new names)
  - [ ] 6.2 Run `npm test` across all shared packages to verify no regressions
  - [ ] 6.3 Run `npm run build` to verify TypeScript compilation

## Dev Notes

### Critical: Existing Code Must Be Updated

The existing shared library types were stubs from Epic 1 that do NOT match the architecture spec for Epic 3. This story includes updating them. Here are the specific discrepancies:

**`backend/shared/types/src/entities.ts` changes:**
- `ResourceType` enum (line 43): rename to `ContentType`, change to lowercase values, add new types (`github_repo`, `newsletter`, `tool`, `reddit`, `linkedin`), remove `TUTORIAL` and `DOCUMENTATION` (not content types in Epic 3)
- `Save` interface (line 28): expand from stub to full schema per architecture
- `TutorialStatus` enum (line 56): change to lowercase values: `saved`, `started`, `in-progress`, `completed` (per PRD FR40). **NOTE:** architecture.md currently defines only 3 states (`saved | started | completed | null`) — it needs an amendment to add `in-progress`. If the amendment has not been applied, flag this before proceeding.

**`backend/shared/types/src/errors.ts` changes:**
- Add `DUPLICATE_SAVE = "DUPLICATE_SAVE"` to `ErrorCode` enum after `CONFLICT` (around line 11, in the Client errors 4xx section)
- Add `[ErrorCode.DUPLICATE_SAVE]: 409` to `ErrorCodeToStatus` map (after the `CONFLICT` entry, around line 37)

**`backend/shared/validation/src/schemas.ts` changes:**
- `resourceTypeSchema` (line 95): rename to `contentTypeSchema`, use new lowercase values
- `tagsSchema` (line 128): change `.max(10)` to `.max(20)`, add `.transform()` for trim + dedup
- `tutorialStatusSchema` (line 108): use new lowercase values including `in-progress`
- `urlSchema` (line 17): add `.refine()` for embedded credential rejection. This checks `new URL(url).username || new URL(url).password`. **Defense-in-depth:** Both `urlSchema` and the URL normalizer (Task 2.3) reject embedded credentials — this is intentional duplication. The schema catches it at validation time; the normalizer catches it if called independently.

**Impact analysis:** `ResourceType` is only used in:
- `types/src/entities.ts` (definition) + `types/src/index.ts` (export)
- `types/test/entities.test.ts` + `types/test/index.test.ts` (tests)
- `validation/src/schemas.ts` + `validation/src/index.ts` + `validation/test/schemas.test.ts` (schema)
- No Lambda functions import `ResourceType` — safe to rename.

### Existing Code to Reuse (DO NOT Reinvent)

| What | Import From | Usage |
|------|-------------|-------|
| `z` (Zod) | `import { z } from '@ai-learning-hub/validation'` | All schema definitions |
| `validateJsonBody()` | `@ai-learning-hub/validation` | Used by Story 3.1b Lambda handler |
| `AppError` | `@ai-learning-hub/types` | Throw structured validation errors |
| `ErrorCode.VALIDATION_ERROR` | `@ai-learning-hub/types` | Error code for invalid input |
| Existing `urlSchema` | `validation/src/schemas.ts` line 17 | Extend with credential check, don't create a second one |
| Existing `tagsSchema` | `validation/src/schemas.ts` line 128 | Update max and add transform, don't create a second one |
| Export pattern | `validation/src/index.ts` | Follow existing named export style |

### URL Normalization Technical Details

**Algorithm (RFC 3986 Section 6 inspired):**
1. Parse URL using `new URL(rawUrl)` (WHATWG URL parser)
2. Lowercase `protocol` and `hostname` (automatic via URL constructor)
3. Remove default ports: if `port === '80'` (http) or `port === '443'` (https), clear it
4. Resolve `.` and `..` path segments (automatic via URL constructor)
5. Decode unreserved percent-encoded chars: `%41`-`%5A`, `%61`-`%7A`, `%30`-`%39`, `%2D` (`-`), `%2E` (`.`), `%5F` (`_`), `%7E` (`~`)
6. Sort query params: `url.searchParams.sort()`
7. Remove fragment: set `url.hash = ''`
8. Strip `www.` prefix: `hostname.replace(/^www\./, '')`
9. Trailing slash: root path (`/`) preserved; other paths preserve as-is (no adding/removing)
10. IDN to punycode: use `domainToASCII(hostname)` via `import { domainToASCII } from 'node:url'` (NOT the deprecated `node:punycode` built-in). This handles IDNA 2008 processing correctly.
11. Preserve original scheme (do NOT rewrite http to https)
12. Reject embedded credentials: check `url.username || url.password`

**Hash generation:**
```typescript
import { createHash } from 'node:crypto';
const urlHash = createHash('sha256').update(normalizedUrl).digest('hex');
```

### Content Type Domain Mapping Table

| Domain Pattern | ContentType |
|----------------|-------------|
| `youtube.com`, `youtu.be` | `video` |
| `github.com` | `github_repo` |
| `reddit.com` | `reddit` |
| `linkedin.com` | `linkedin` |
| `podcasts.apple.com`, `open.spotify.com/show`, `open.spotify.com/episode`, `spotify.com/show`, `spotify.com/episode` | `podcast` |
| `medium.com`, `substack.com` | `newsletter` |
| _(unrecognized)_ | `other` |

**Design notes:**
- Extensible: new domains added without code changes (config-driven map)
- Match on normalized hostname (after www stripping)
- Some entries require path prefix matching (Spotify show/episode)
- User-provided `contentType` ALWAYS takes precedence over detection

### ContentType Values

`'article' | 'video' | 'podcast' | 'github_repo' | 'newsletter' | 'tool' | 'reddit' | 'linkedin' | 'other'`

- Auto-detected at save time: see mapping table above
- Set by enrichment (Epic 9): all types may be refined based on metadata analysis
- User override: user-provided value always takes precedence
- Tutorial status: separate flag (`isTutorial`), NOT a contentType

### Save Interface (Full Schema)

```typescript
export interface Save extends BaseEntity {
  userId: string;
  saveId: string;          // ULID
  url: string;             // Original URL as submitted
  normalizedUrl: string;   // Canonical form after normalization
  urlHash: string;         // SHA-256 of normalizedUrl
  title?: string;          // Max 500 chars
  userNotes?: string;      // Max 2000 chars
  contentType: ContentType; // Defaults to 'other'
  tags: string[];          // Max 20 tags, each max 50 chars
  isTutorial: boolean;     // Default false
  tutorialStatus?: TutorialStatus | null;
  linkedProjectCount: number; // Default 0
  lastAccessedAt?: string; // Updated on GET /saves/:id
  enrichedAt?: string;     // Set by Epic 9 enrichment
  deletedAt?: string;      // Soft delete marker
}
```

### Punycode / IDN Handling

Node.js built-in `punycode` module is deprecated since v7+. Use the modern approach:
- `url.domainToASCII(hostname)` from `import { domainToASCII } from 'node:url'` — handles IDNA 2008 processing
- The WHATWG `URL` constructor also handles IDN automatically when constructing URLs
- Do NOT import from deprecated `node:punycode`

### Testing Standards

- **Framework:** Vitest (used by all shared packages)
- **Coverage:** 80% minimum (CI-enforced)
- **Pattern:** Follow existing tests in `backend/shared/validation/test/` and `backend/shared/types/test/`
- **URL normalizer:** 40+ test cases required (see AC9 for categories)
- **Test file naming:** `*.test.ts` in `test/` directory (matches existing pattern in both `backend/shared/validation/test/` and `backend/shared/types/test/`)

### Project Structure Notes

- All new validation modules go in `backend/shared/validation/src/` (same package as existing schemas)
- Save schemas (`createSaveSchema`, `updateSaveSchema`) go in `backend/shared/validation/src/schemas.ts` (same file as existing schemas — do NOT create a `schemas/` subdirectory; the project uses a flat file pattern)
- Tests in `backend/shared/validation/test/` and `backend/shared/types/test/` (this is the existing pattern — do NOT use `__tests__/`)
- Type updates in `backend/shared/types/src/entities.ts` and `backend/shared/types/src/errors.ts`
- Export updates in both `validation/src/index.ts` and `types/src/index.ts`
- This story produces NO Lambda handlers — pure functions only, consumed by Story 3.1b

### Architecture Compliance

| ADR | How This Story Complies |
|-----|-------------------------|
| ADR-008 (Error Handling) | All validation errors use `{ code: 'VALIDATION_ERROR', message, requestId }` structure |
| ADR-001 (DynamoDB) | Save interface matches DynamoDB table schema exactly |
| ADR-014 (API-First) | Zod schemas validate API request bodies |

### References

- [Source: docs/progress/epic-3-stories-and-plan.md] — Story definition, ACs, technical notes (search for "Story 3.1a" section)
- [Source: _bmad-output/planning-artifacts/architecture.md] — Saves table schema, ADR-001, ADR-008, ADR-014
- [Source: backend/shared/types/src/entities.ts] — Current ResourceType enum, Save interface stub
- [Source: backend/shared/types/src/errors.ts] — Current ErrorCode enum, AppError class
- [Source: backend/shared/validation/src/schemas.ts] — Current resourceTypeSchema, tagsSchema, urlSchema
- [Source: backend/shared/validation/src/index.ts] — Export pattern to follow
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-epic3-2026-02-16.md] — Architecture amendments confirmed applied

## Dev Agent Record

### Agent Model Used



### Debug Log References



### Completion Notes List



### File List

