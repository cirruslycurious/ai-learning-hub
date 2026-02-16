# Epic 3: Save URLs (Core CRUD) — Stories and Implementation Plan

**Date:** 2026-02-16 (revised after adversarial review rounds 1–4 + implementation readiness review)  
**Source:** PRD FR10–FR16, FR19, FR44–FR47, FR64–FR67; ADR-001, ADR-003, ADR-005, ADR-008, ADR-009, ADR-014, ADR-016  
**NFRs:** NFR-P1, NFR-P2, NFR-R7, NFR-S4, NFR-UX1

---

## Epic Goal

Users can save URLs from any source and view/manage their saves.

**User Outcome:** Users can save URLs via web, iOS Shortcut, or API; view saves in a list; edit, delete, filter, and sort. Mobile capture completes in <3 seconds.

---

## Architecture Decisions Made During Deep Dive

Before story creation, the following gaps were identified in the architecture and resolved:

| #   | Gap                                            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                         | Rationale                                                                                                                                                                           |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | URL normalization algorithm unspecified        | Custom normalization inspired by RFC 3986 §6: lowercase scheme+host, remove default ports (80/443), resolve `.`/`..` path segments, decode unreserved percent-encoded chars, sort query params, remove fragment, strip `www.` prefix, trailing slash on root only (add `/`; paths: preserve as-is), IDN domains stored as punycode. Preserve original scheme (do NOT rewrite http→https). Reject URLs with embedded credentials. | Maximizes dedup without silently changing the URL's target. Custom rules (query sort, www strip) go beyond RFC 3986 for better dedup. Credential stripping prevents security leaks. |
| 2   | Duplicate save behavior unspecified            | Reject with 409 Conflict + return existing save in response body. Duplicate check uses GSI query + TransactWriteItems with uniqueness marker as secondary guard.                                                                                                                                                                                                                                                                 | Users shouldn't have duplicate entries; returning the existing save enables idempotent Shortcut calls. Two-layer guard mitigates TOCTOU race.                                       |
| 3   | Content type detection timing                  | Basic domain-based detection at save-time; enrichment refines later. Default for unknown domains is `other` (not `article`).                                                                                                                                                                                                                                                                                                     | Immediate UX value (icons, filters work before enrichment); `other` avoids false semantic claims about unknown URLs.                                                                |
| 4   | `lastAccessedAt` missing from schema           | Add `lastAccessedAt` field; update via awaited-but-non-throwing call on GET /saves/:id. **Requires architecture.md amendment** — add field to saves table schema before implementation.                                                                                                                                                                                                                                          | Required for FR19 sort; non-blocking update avoids latency impact                                                                                                                   |
| 5   | FR13 (filter by project linkage) before Epic 5 | Use denormalized `linkedProjectCount` field on saves table (default 0). Epic 5 MUST use atomic DynamoDB `ADD` operations (not `SET`) for increment/decrement. Plan periodic reconciliation Lambda for drift correction.                                                                                                                                                                                                          | Self-contained within Epic 3; no dependency on links table schema. Atomic ADD prevents concurrent update races.                                                                     |
| 6   | Offline queue strategy for PWA                 | Use Background Sync API + IndexedDB for offline queue. Fall back to sync-on-next-visit on platforms without Background Sync (iOS).                                                                                                                                                                                                                                                                                               | Standard PWA pattern; browser handles retry; survives app close. iOS fallback ensures no data loss.                                                                                 |
| 7   | EventBridge event shape                        | Use CloudEvents-inspired structure with `source`, `detailType`, `detail` including `normalizedUrl` + all fields needed by enrichment pipeline. Includes `SaveRestored` event for undo consistency.                                                                                                                                                                                                                               | Enables Epic 9 without changes to Epic 3; consumers don't need to re-normalize. Full event coverage prevents downstream state drift.                                                |
| 8   | Idempotency keys for write operations          | Deferred to post-V1. V1 relies on duplicate detection (409 response) as sufficient idempotency mechanism for retries. iOS Shortcut handles 409 as "Already saved" success.                                                                                                                                                                                                                                                       | ADR-014 recommends `X-Idempotency-Key` but 409-based dedup is functionally equivalent for single-URL saves at boutique scale.                                                       |

---

## Story Dependency Order

```
3.1a Validation Modules  ──►  3.1b Create Save API  ──►  3.2 List & Get Saves  ──►  3.3 Update/Delete/Restore
                                      │                          │                           │
                                      └──────────────────────────┼───────────────────────────┘
                                                                 │
                                                                 ▼
                                                  3.4 Save Filtering & Sorting
                                                                 │
                                              ┌──────────────────┼──────────────────┐
                                              ▼                  │                  ▼
                                   3.5 iOS Shortcut     3.6 PWA Share    3.6a UI Foundation
                                                                                    │
                                                                                    ▼
                                                                         3.7 Saves List Page
                                                                                    │
                                                                                    ▼
                                                                  3.8 Filtering & Sorting UI
                                                                                    │
                                                                                    ▼
                                                                  3.9 Save Actions & Feedback
```

**Rationale:** 3.1a produces the shared validation/detection modules (pure functions, heavily unit-tested); 3.1b uses those modules in the Lambda handler with duplicate detection and EventBridge events; 3.2 adds read with in-memory pagination (designed for 3.4 compatibility); 3.3 adds update/delete/restore; 3.4 adds filtering/sorting API on top of 3.2's in-memory strategy; 3.5–3.6 enable mobile capture (parallel, depend on 3.1b only — no frontend dependency); 3.6a establishes the design system and UI component foundation; 3.7 builds the basic list page using 3.6a components; 3.8 adds filtering/sorting/search UI; 3.9 adds create/edit/delete UI + feedback patterns.

---

## Story 3.1a: Save Validation & Content Detection Modules

**As a** developer building the save system,  
**I want** reusable, well-tested URL normalization, validation schemas, and content type detection modules,  
**so that** all save operations use consistent, correct URL processing and validation.

### Acceptance Criteria

| #   | Given                                           | When                        | Then                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | A raw URL is provided                           | URL normalization runs      | Normalized form produced: lowercase scheme+host, remove default ports (80/443), resolve `.`/`..` path segments, decode unreserved %-encoded chars, sort query params, remove fragment, strip `www.`, trailing slash on root only, IDN→punycode. Preserve original scheme. `urlHash` = SHA-256 of `normalizedUrl` |
| AC2 | URL scheme is not http or https                 | Validation                  | Rejects with structured error: `{ code: 'VALIDATION_ERROR', message: 'Only http and https URLs are supported' }`                                                                                                                                                                                                 |
| AC3 | URL is empty, missing, or malformed             | Validation                  | Rejects with structured error: `{ code: 'VALIDATION_ERROR', message: 'A valid URL is required' }`                                                                                                                                                                                                                |
| AC4 | URL contains embedded credentials (user:pass@)  | Validation                  | Rejects with structured error: `{ code: 'VALIDATION_ERROR', message: 'URLs with embedded credentials are not allowed' }`                                                                                                                                                                                         |
| AC5 | URL from a known domain (e.g., youtube.com)     | Content type detection runs | Returns correct contentType from domain mapping table (see Technical Notes). Default for unrecognized domains: `other`.                                                                                                                                                                                          |
| AC6 | User provides explicit contentType              | Content type detection runs | User-provided `contentType` takes precedence over auto-detection                                                                                                                                                                                                                                                 |
| AC7 | Zod validation schema called with valid input   | Schema validation           | Passes: url (required, valid URL, no embedded credentials), title (optional, max 500 chars), userNotes (optional, max 2000 chars), contentType (optional, enum), tags (optional, array max 20, each max 50 chars, trimmed, deduplicated)                                                                         |
| AC8 | Zod validation schema called with invalid input | Schema validation           | Returns field-level validation errors                                                                                                                                                                                                                                                                            |
| AC9 | —                                               | —                           | URL normalizer has 40+ unit tests covering: percent-encoding (`%7E` → `~`), default port removal, path segments, embedded credential rejection, IDN→punycode, trailing slash rules, query param ordering, fragment removal                                                                                       |

### Technical Notes

- **URL normalization module:** Create `shared/validation/url-normalizer.ts` — pure function, heavily unit-tested (40+ test cases including: percent-encoding normalization (`%7E` → `~`), default port removal (`:80`, `:443`), path segment resolution (`/.`, `/..`), embedded credential rejection, IDN→punycode conversion, trailing slash rules (root: `example.com` → `example.com/`; paths: preserve as-is), query param ordering, fragment removal)
- **Content type detection module:** Create `shared/validation/content-type-detector.ts` with domain mapping table:

  | Domain Pattern                                                            | ContentType   |
  | ------------------------------------------------------------------------- | ------------- |
  | `youtube.com`, `youtu.be`                                                 | `video`       |
  | `github.com`                                                              | `github_repo` |
  | `reddit.com`                                                              | `reddit`      |
  | `linkedin.com`                                                            | `linkedin`    |
  | `podcasts.apple.com`, `open.spotify.com/show`, `open.spotify.com/episode` | `podcast`     |
  | `medium.com`, `substack.com`                                              | `newsletter`  |
  | _(unrecognized)_                                                          | `other`       |

  Extensible: new domains added without code changes (config-driven). User-provided `contentType` always takes precedence.

- **ContentType values:** `'article' | 'video' | 'podcast' | 'github_repo' | 'newsletter' | 'tool' | 'reddit' | 'linkedin' | 'other'`. **Auto-detected at save time:** see mapping table above. **Set by enrichment (Epic 9):** All types may be refined based on metadata analysis (e.g., a `medium.com` URL might be reclassified from `newsletter` to `article`). **User override (Epic 8):** `tutorial` status is a separate flag (`isTutorial`), not a contentType.
- **Zod schema:** `createSaveSchema` in `@ai-learning-hub/validation` — url (string, URL, no embedded credentials), title (optional, max 500 chars), userNotes (optional, max 2000 chars), contentType (optional, enum), tags (optional, array max 20, each max 50 chars, trimmed, deduplicated — same validation as PATCH in Story 3.3). Both create and update share a common `tagsSchema` from `@ai-learning-hub/validation`.
- **ULID:** Use `ulid` package for sortable unique IDs (chronological order by default)

### FRs Covered

FR10 (save URLs from any source — validation layer)

### NFRs Covered

—

### Files to Create

- `shared/validation/url-normalizer.ts` + `shared/validation/__tests__/url-normalizer.test.ts`
- `shared/validation/content-type-detector.ts` + `shared/validation/__tests__/content-type-detector.test.ts`
- `shared/validation/schemas/save.ts` + `shared/validation/__tests__/save-schema.test.ts`

---

## Story 3.1b: Create Save API

**As a** user (web, Shortcut, or API),  
**I want** to save a URL with optional metadata,  
**so that** the URL is stored in my library and available for organization, enrichment, and recall.

### Acceptance Criteria

| #   | Given                                                    | When                                                                       | Then                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User authenticated (JWT or API key)                      | `POST /saves` with body `{ url, title?, userNotes?, contentType?, tags? }` | URL normalized using `url-normalizer` (Story 3.1a). `urlHash` = SHA-256 of `normalizedUrl`. Input validated using `createSaveSchema` (Story 3.1a).                                                                                                                                                                                                                                                 |
| AC2 | Normalized URL has not been saved by this user           | Save creation                                                              | New item written to `saves` table: `PK=USER#<userId>`, `SK=SAVE#<ULID>` with all attributes + `linkedProjectCount: 0`, `isTutorial: false`, `tutorialStatus: null`; returns 201 with save object                                                                                                                                                                                                   |
| AC3 | Normalized URL already saved by this user (same urlHash) | Save creation                                                              | Returns 409 with body `{ error: { code: 'DUPLICATE_SAVE', message: 'URL already saved', requestId: '<correlation-id>' }, existingSave: {...} }` — `existingSave` is a sibling of `error`, not nested inside it, to keep the `error` object compliant with ADR-008's standard shape (`{ code, message, requestId }`)                                                                                |
| AC4 | Save created successfully                                | After DynamoDB write                                                       | EventBridge event emitted: `source: 'ai-learning-hub.saves'`, `detailType: 'SaveCreated'`, detail includes `{ userId, saveId, url, normalizedUrl, urlHash, contentType }`                                                                                                                                                                                                                          |
| AC5 | URL provided without contentType                         | Save creation                                                              | System performs domain detection using `content-type-detector` (Story 3.1a). User-provided `contentType` takes precedence.                                                                                                                                                                                                                                                                         |
| AC6 | —                                                        | —                                                                          | Response time < 1 second on warm invocation (NFR-P2). First request after idle may exceed target per ADR-016 cold start acceptance. No external HTTP calls during save creation.                                                                                                                                                                                                                   |
| AC7 | —                                                        | —                                                                          | Lambda uses `@ai-learning-hub/logging`, `@ai-learning-hub/middleware`, `@ai-learning-hub/db`, `@ai-learning-hub/validation`. Rate limiting inherited from Epic 2 middleware (Story 2.7): POST /saves is a write operation.                                                                                                                                                                         |
| AC8 | Duplicate check                                          | Before DynamoDB write                                                      | **Layer 1:** Query GSI `urlHash-index` with KeyCondition `urlHash = <hash>`, FilterExpression `PK = USER#<userId> AND attribute_not_exists(deletedAt)`. **Layer 2:** TransactWriteItems atomically writes save item + uniqueness marker `PK=USER#<userId>, SK=URL#<urlHash>` with ConditionExpression `attribute_not_exists(SK)`. If condition fails → 409. Two-layer guard mitigates TOCTOU race. |
| AC9 | URL was previously saved then soft-deleted               | `POST /saves` with same URL                                                | Layer 1 passes (deleted save filtered out), Layer 2 fails (marker exists). Handler auto-restores the soft-deleted save (clears `deletedAt`), emits `SaveRestored` event, returns 200 with restored save. User intent is clearly to re-save — auto-restore is the correct UX.                                                                                                                       |

### Technical Notes

- **Depends on Story 3.1a** for `normalizeUrl()`, `detectContentType()`, and `createSaveSchema`.
- **Duplicate detection — two-layer guard against TOCTOU race:**
  1. **Layer 1 (GSI query):** Fast-path check. Query `urlHash-index` with `urlHash = <hash>`, FilterExpression `PK = USER#<userId> AND attribute_not_exists(deletedAt)`. This catches the common case. GSI has `urlHash` as sole PK; userId filter runs over GSI results.
  2. **Layer 2 (TransactWriteItems):** After Layer 1 passes, use `TransactWriteItems` to atomically write both the save item (`PK=USER#<userId>, SK=SAVE#<ULID>`) and a uniqueness marker item (`PK=USER#<userId>, SK=URL#<urlHash>`) with ConditionExpression `attribute_not_exists(SK)` on the marker. If the marker already exists, the transaction fails → return 409. This eliminates the TOCTOU window where two concurrent requests both pass the GSI check. **On delete:** The marker item is NOT removed (soft-deleted saves still occupy the url slot). **On restore:** No marker action needed (marker was never removed).
  3. **Layer 2 failure handling:** If TransactWriteItems fails (marker already exists):
     - **Re-query Layer 1** (GSI) to fetch existing active save. If found → return 409 with `existingSave` (standard duplicate case).
     - **If no active save found** (Layer 1 returns empty — meaning the URL was soft-deleted): query the main table for the soft-deleted save (`PK=USER#<userId>` with `begins_with(SK, 'SAVE#')` + `urlHash` filter, including deleted items). Auto-restore it by clearing `deletedAt`, emit `SaveRestored` event, and return 200 with the restored save. This handles the "re-save after delete" edge case seamlessly — the user's intent is clearly to have this URL in their library.
     - **iOS Shortcut impact:** Shortcut treats both 201 and 200 as success, so auto-restore is transparent.
  4. **Note:** At boutique scale (<100 users), the race is rare. Both layers together provide strong-enough uniqueness.
- **EventBridge:** Use existing event bus from Epic 1; `PutEvents` call is awaited but non-throwing — the Lambda awaits the call and logs errors (with `requestId` for tracing) but does NOT fail the API response if event emission fails. Event includes `normalizedUrl` so consumers don't re-normalize.
- **Idempotency:** V1 defers `X-Idempotency-Key` header support (ADR-014 recommendation). Duplicate detection via 409 response is functionally sufficient — iOS Shortcut treats 409 as success ("Already saved"). Full idempotency keys planned for post-V1.
- **Error responses:** All errors wrapped per ADR-008: `{ error: { code, message, requestId } }`. Shared middleware handles wrapping automatically.

### FRs Covered

FR10 (save URLs from any source)

### NFRs Covered

NFR-P2 (API response < 1 second, warm invocation), NFR-S4 (per-user data isolation via userId scoping)

---

## Story 3.2: List & Get Saves API

**As a** user,  
**I want** to view all my saves in a list and see individual save details,  
**so that** I can browse my saved URLs and access their metadata.

### Acceptance Criteria

| #   | Given                            | When                                     | Then                                                                                                                                                                                                                          |
| --- | -------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User authenticated               | `GET /saves`                             | Returns paginated list of user's non-deleted saves (where `deletedAt` is null), sorted by `createdAt` descending (newest first)                                                                                               |
| AC2 | —                                | `GET /saves?nextToken=<token>&limit=<n>` | In-memory pagination: all user saves fetched (up to 1000-item ceiling), soft-deleted filtered out, then paginated. Default limit=25, max limit=100. Response shape: `{ items: Save[], nextToken?: string, hasMore: boolean }` |
| AC3 | User authenticated               | `GET /saves/:saveId`                     | Returns single save with all attributes; returns 404 if not found or belongs to another user                                                                                                                                  |
| AC4 | Save exists and is returned      | `GET /saves/:saveId`                     | `lastAccessedAt` updated via awaited-but-non-throwing UpdateItem (errors logged, not propagated); does NOT affect response time                                                                                               |
| AC5 | Save has been soft-deleted       | `GET /saves/:saveId`                     | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`                                                                                                                                          |
| AC6 | User has no saves                | `GET /saves`                             | Returns `{ items: [], hasMore: false }` (empty list, not an error)                                                                                                                                                            |
| AC7 | Save belongs to a different user | `GET /saves/:saveId`                     | Returns 404 (not 403 — no information leakage about other users' saves)                                                                                                                                                       |
| AC8 | —                                | —                                        | All main-table queries use strong consistency reads (NFR-R7: user sees own writes immediately). Note: GSI queries (used in other stories/epics) are eventually consistent by DynamoDB design.                                 |
| AC9 | —                                | —                                        | Response time < 1 second on warm invocation (NFR-P2). Cold start may exceed per ADR-016.                                                                                                                                      |

### Technical Notes

- **Pagination strategy (unified with Story 3.4):** Story 3.2 uses an in-memory pagination approach from day one, designed to be extended by Story 3.4's filtering/sorting without breaking the nextToken contract. All user saves are fetched from DynamoDB (up to 1000-item ceiling), soft-deleted items filtered out in-memory, then results sliced by `nextToken` offset + `limit`. This avoids the DynamoDB `FilterExpression` under-fill problem (where `Limit` applies before filter, causing underfull pages).
- **1000-item ceiling:** If a user has >1000 saves, only the most recent 1000 are fetched. DynamoDB Query with `begins_with(SK, 'SAVE#')`, `Limit=1000`, and `ScanIndexForward=false`. See Story 3.4 for truncation handling.
- **nextToken:** Encodes the last-seen ULID (`saveId`) from the in-memory result set, base64-encoded and opaque to client. Server slices results starting after the given ULID. This cursor approach is safe across concurrent inserts/deletes (unlike offset, which can skip or duplicate items). Response always includes `hasMore: boolean` per ADR-014.
- **lastAccessedAt update:** `updateItem(PK, SK, { lastAccessedAt: now() })` — awaited but non-throwing (errors logged with `requestId`, not propagated). **Note:** `lastAccessedAt` requires architecture.md amendment (not in current schema).
- **Query:** `KeyConditionExpression: PK = :pk AND begins_with(SK, :prefix)` with `:pk = USER#<userId>`, `:prefix = SAVE#`, `ScanIndexForward=false`, `Limit=1000`. The `begins_with(SK, 'SAVE#')` is **required** to exclude URL uniqueness marker items (`SK=URL#<urlHash>`) from the same partition (see Story 3.1 Layer 2). Without this SK condition, marker items would pollute the result set and the 1000-item ceiling.
- **Response shape (ADR-014):** `{ items: Save[], nextToken?: string, hasMore: boolean }`
- **Save response shape:** `{ saveId, url, normalizedUrl, urlHash, title, userNotes, contentType, tags, isTutorial, linkedProjectCount, createdAt, updatedAt, lastAccessedAt, enrichedAt? }`

### FRs Covered

FR11 (view all saves in unified list)

### NFRs Covered

NFR-P2 (API response < 1 second, warm), NFR-R7 (user sees own writes immediately — main table only), NFR-S4 (per-user isolation)

---

## Story 3.3: Update, Delete & Restore Saves API

**As a** user,  
**I want** to edit save metadata, delete saves I no longer need, and undo accidental deletes,  
**so that** I can keep my library organized and recover from mistakes.

### Acceptance Criteria

| #    | Given                                | When                                                                           | Then                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | User authenticated, save exists      | `PATCH /saves/:saveId` with body `{ title?, userNotes?, contentType?, tags? }` | Updates specified fields + sets `updatedAt`; returns updated save; omitted fields unchanged                                                                                                                                                                                                                                                     |
| AC2  | Save updated successfully            | After DynamoDB write                                                           | EventBridge event emitted: `detailType: 'SaveUpdated'`, detail includes updated fields + `userId`, `saveId`, `urlHash`, `normalizedUrl`                                                                                                                                                                                                         |
| AC3  | User authenticated, save exists      | `DELETE /saves/:saveId`                                                        | Sets `deletedAt` = ISO 8601 timestamp (soft delete); returns 204 No Content                                                                                                                                                                                                                                                                     |
| AC4  | Save soft-deleted                    | After DynamoDB write                                                           | EventBridge event emitted: `detailType: 'SaveDeleted'`, detail includes `userId`, `saveId`, `urlHash`, `normalizedUrl`                                                                                                                                                                                                                          |
| AC5  | Save does not exist or wrong user    | `PATCH /saves/:saveId`                                                         | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`                                                                                                                                                                                                                                                            |
| AC6  | Save does not exist or wrong user    | `DELETE /saves/:saveId`                                                        | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`                                                                                                                                                                                                                                                            |
| AC7  | Save already soft-deleted            | `PATCH /saves/:saveId`                                                         | Returns 404 (treat soft-deleted as not found for normal PATCH)                                                                                                                                                                                                                                                                                  |
| AC8  | Save already soft-deleted            | `DELETE /saves/:saveId`                                                        | Returns 204 (idempotent — already deleted)                                                                                                                                                                                                                                                                                                      |
| AC9  | Invalid field values in PATCH body   | Validation                                                                     | Returns 400 `{ error: { code: 'VALIDATION_ERROR', message: '...', requestId } }` with field-level error details                                                                                                                                                                                                                                 |
| AC10 | Save is soft-deleted (has deletedAt) | `POST /saves/:saveId/restore`                                                  | Clears `deletedAt` field; returns 200 with restored save. This endpoint bypasses the `attribute_not_exists(deletedAt)` guard. **Note:** Because the URL#<urlHash> uniqueness marker is never removed on delete, a re-save of the same URL during the soft-delete window would be blocked by Layer 2, preventing duplicate-on-restore conflicts. |
| AC11 | Save is NOT soft-deleted             | `POST /saves/:saveId/restore`                                                  | Returns 200 with current save (idempotent — already active)                                                                                                                                                                                                                                                                                     |
| AC12 | Save does not exist or wrong user    | `POST /saves/:saveId/restore`                                                  | Returns 404 `{ error: { code: 'NOT_FOUND', message: 'Save not found', requestId } }`                                                                                                                                                                                                                                                            |
| AC13 | Save successfully restored           | After DynamoDB write                                                           | EventBridge event emitted: `detailType: 'SaveRestored'`, detail includes `userId`, `saveId`, `urlHash`, `normalizedUrl`. Downstream consumers should treat as re-activation.                                                                                                                                                                    |

### Technical Notes

- **Soft delete:** Sets `deletedAt` timestamp; record remains for data recovery. **V1: No expiry on restore window.** When TTL-based cleanup is implemented (future), saves deleted more than N days ago will be permanently removed and cannot be restored. Frontend should not expose restore option beyond a reasonable window.
- **Restore endpoint:** `POST /saves/:saveId/restore` — separate from PATCH to avoid the `attribute_not_exists(deletedAt)` condition. Uses `UpdateExpression: REMOVE deletedAt` with ConditionExpression `attribute_exists(PK)`. Supports undo-delete in frontend (Story 3.9). Rate limiting: inherits write-operation rate limit from Epic 2 middleware (same as POST /saves).
- **SaveRestored event:** Emitted on successful restore so downstream consumers (Pipeline 3 search index sync, etc.) can re-index. Without this event, a delete followed by restore would leave the search index out of sync.
- **Undo-delete event timing:** The `SaveDeleted` event fires immediately on DELETE, but restore may come up to 5 seconds later (undo window). Downstream consumers MUST be idempotent and handle a `SaveDeleted` followed by `SaveRestored` gracefully. This is documented as accepted behavior — adding a delayed delete event would add unnecessary complexity for boutique scale.
- **PATCH semantics:** Only provided fields are updated; uses DynamoDB `UpdateExpression` with `SET` for each provided field
- **URL cannot be changed:** `url`, `normalizedUrl`, and `urlHash` are immutable after creation — not included in PATCH schema
- **tags validation:** Max 20 tags, each max 50 chars, trimmed, deduplicated
- **Conditional write (PATCH):** ConditionExpression `attribute_exists(PK) AND attribute_not_exists(deletedAt)` to prevent updating deleted saves
- **Conditional write (Restore):** ConditionExpression `attribute_exists(PK)` only — must work on soft-deleted saves
- **All events include `normalizedUrl`** for downstream pipeline consumers

### FRs Covered

FR15 (delete saves), FR16 (edit save metadata)

### NFRs Covered

—

---

## Story 3.4: Save Filtering & Sorting

**As a** user,  
**I want** to filter saves by type and linkage, search by title/source, and sort my list,  
**so that** I can quickly find the saves I'm looking for.

### Acceptance Criteria

| #    | Given                                    | When                                                       | Then                                                                                                                                 |
| ---- | ---------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | User has saves with various contentTypes | `GET /saves?contentType=video`                             | Returns only saves where `contentType` = video; combinable with other filters                                                        |
| AC2  | User has linked and unlinked saves       | `GET /saves?linkStatus=linked`                             | Returns saves where `linkedProjectCount > 0`                                                                                         |
| AC3  | User has linked and unlinked saves       | `GET /saves?linkStatus=unlinked`                           | Returns saves where `linkedProjectCount = 0`                                                                                         |
| AC4  | User has saves                           | `GET /saves?search=react`                                  | Returns saves where `title` or `url` contains "react" (case-insensitive)                                                             |
| AC5  | User has saves                           | `GET /saves?sort=createdAt&order=asc`                      | Returns saves sorted by creation date ascending                                                                                      |
| AC6  | User has saves                           | `GET /saves?sort=lastAccessedAt&order=desc`                | Returns saves sorted by last accessed date descending; saves never accessed sort to bottom                                           |
| AC7  | User has saves                           | `GET /saves?sort=title&order=asc`                          | Returns saves sorted alphabetically by title; saves without titles sort to bottom                                                    |
| AC8  | Multiple filters applied                 | `GET /saves?contentType=video&search=react&sort=createdAt` | All filters AND-combined; sorting applied after filtering                                                                            |
| AC9  | Invalid filter or sort value             | `GET /saves?contentType=invalid`                           | Returns 400 `{ error: { code: 'VALIDATION_ERROR', message: '...', requestId } }` with valid options listed                           |
| AC10 | No saves match filters                   | `GET /saves?contentType=podcast`                           | Returns `{ items: [], hasMore: false }` (empty result, not an error)                                                                 |
| AC11 | User has >1000 saves                     | Any filtered/sorted query                                  | Response includes `truncated: true` flag indicating results are from the most recent 1000 saves only. Logged as warning server-side. |

### Technical Notes

- **Extends Story 3.2's in-memory strategy:** Story 3.2 already fetches up to 1000 saves into memory. Story 3.4 adds filter/sort/search logic on top of the same in-memory result set. No pagination contract change — the `nextToken` format and semantics remain identical.
- **Realistic performance bounds:** At 1000 items × ~2KB each (URL, normalizedUrl, title, userNotes, tags, all timestamps) = ~2MB in memory, fetched via 1–2 DynamoDB Query calls (1MB page limit). Filtering + sorting in-memory takes <50ms. Total well under 1 second warm. At >1000 saves, results are truncated.
- **Truncation signaling (AC11):** When the DynamoDB query returns `LastEvaluatedKey` (meaning more items exist beyond the 1000 ceiling), the response includes `truncated: true`. Frontend can display: "Showing results from your most recent 1000 saves." Response shape: `{ items: Save[], nextToken?: string, hasMore: boolean, truncated?: boolean }`.
- **linkStatus filter:** Uses denormalized `linkedProjectCount` field on saves table (set to 0 at creation, incremented/decremented by Epic 5 using **atomic DynamoDB `ADD` operations**, NOT `SET`). No cross-table query needed. Until Epic 5 is implemented, all saves have `linkedProjectCount = 0`, so `linkStatus=linked` returns empty and `linkStatus=unlinked` returns all — correct behavior.
- **linkedProjectCount consistency:** Atomic `ADD` prevents concurrent link/unlink races. A periodic reconciliation Lambda (planned for Epic 10 admin tooling) will detect and correct any drift caused by partial failures between link table write and counter update. **Negative guard:** `linkStatus=linked` filter uses `linkedProjectCount > 0` (not `!= 0`) to defensively handle any negative drift; Epic 5 unlink handler should include a ConditionExpression `linkedProjectCount > :zero` to prevent decrement below zero.
- **Search:** In-memory case-insensitive `includes()` on `title` and full `url` (not just domain — matches AC4 "title or url contains"). NOT full-text search (that's Epic 7).
- **Sort options:** `createdAt` (default), `lastAccessedAt`, `title`. Direction: `asc` or `desc` (default: `desc` for dates, `asc` for title).
- **nextToken + filter change:** If `nextToken` references a save not present in the current filtered/sorted result set (e.g., client changed filters between paginated requests), the server MUST ignore the token and return results from the beginning (equivalent to no `nextToken`). This ensures consistent behavior for API consumers that don't follow frontend UX conventions. The frontend resets pagination on filter change, so this is a defensive server-side safeguard.
- **Response shape (ADR-014):** `{ items: Save[], nextToken?: string, hasMore: boolean, truncated?: boolean }`

### FRs Covered

FR12 (filter by resource type), FR13 (filter by project linkage), FR14 (search by title and source), FR19 (sort by date saved, date last accessed, title)

### NFRs Covered

NFR-P2 (API response < 1 second, warm, up to 1000 saves)

---

## Story 3.5: iOS Shortcut Capture

**As a** mobile user,  
**I want** to save a URL from any iOS app via the share sheet,  
**so that** I can capture resources instantly without switching to the web app.

### Acceptance Criteria

| #   | Given                                               | When                                                     | Then                                                                                                                                        |
| --- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User has API key (full or capture-only) from Epic 2 | iOS Shortcut sends `POST /saves` with `x-api-key` header | Save created successfully; same endpoint as web save (Story 3.1)                                                                            |
| AC2 | URL shared from iOS app                             | Shortcut runs                                            | Total time from share sheet tap to success confirmation < 3 seconds (NFR-P1). Warm invocation; first use after idle may exceed per ADR-016. |
| AC3 | User has capture-only API key (`saves:write` scope) | Shortcut sends `POST /saves`                             | Save succeeds (scope allows POST /saves)                                                                                                    |
| AC4 | API is unreachable                                  | Shortcut runs                                            | Shortcut displays clear error message to user                                                                                               |
| AC5 | Duplicate URL saved                                 | Shortcut sends `POST /saves`                             | Shortcut handles 409 gracefully — shows "Already saved" confirmation (not error)                                                            |
| AC6 | —                                                   | —                                                        | Shortcut file (.shortcut) created and documented; installable via iCloud link                                                               |
| AC7 | —                                                   | —                                                        | Setup guide created with step-by-step screenshots: (1) install Shortcut, (2) set API key, (3) test save, (4) share sheet usage              |
| AC8 | URL shared with title (from share sheet metadata)   | Shortcut runs                                            | Title passed as body param if available; save created with title pre-populated                                                              |

### Technical Notes

- **No backend changes required:** iOS Shortcut calls the same `POST /saves` endpoint from Story 3.1 with `x-api-key` header
- **Shortcut definition:** Uses "Get URLs from Input" → "Get Contents of URL" (HTTP POST) → "Show Result" actions
- **API key storage:** Shortcut stores API key in a Text action (user pastes during setup); shown in setup guide
- **Quick-save (FR47):** The Shortcut IS the quick-save — user taps Share → runs Shortcut → done. No app to open.
- **Shortcut file location:** `docs/ios-shortcut/AI-Learning-Hub-Save.shortcut` + `docs/ios-shortcut/setup-guide.md`
- **Testing:** Manual E2E test on iOS device; automated: ensure API responds < 1s (warm) to POST /saves with API key auth

### FRs Covered

FR44 (save via iOS Shortcut), FR46 (mobile save < 3 seconds), FR47 (quick-save without opening app)

### NFRs Covered

NFR-P1 (mobile save latency < 3 seconds, warm invocation)

---

## Story 3.6: PWA Share Target

**As a** Android or desktop user,  
**I want** to save a URL via the browser's share menu,  
**so that** I can capture resources directly from any app that supports web share.

### Acceptance Criteria

| #    | Given                                       | When                                  | Then                                                                                                                                                     |
| ---- | ------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | PWA is installed on device                  | User shares URL via system share menu | PWA appears as share target in the share sheet                                                                                                           |
| AC2  | User selects PWA as share target            | Share action completes                | URL and title (if available) are captured and sent to `POST /saves`                                                                                      |
| AC3  | Device is online                            | Share target activated                | Save completes immediately via API call; success toast shown                                                                                             |
| AC4  | Device is offline                           | Share target activated                | Save queued in IndexedDB; "Saved offline — will sync when connected" message shown                                                                       |
| AC5  | Device comes back online after offline save | Network restored (Background Sync)    | Background Sync API triggers; queued saves sent to API; IndexedDB cleared on success                                                                     |
| AC6  | Multiple saves queued offline               | Network restored                      | All queued saves synced in order; failures retried with exponential backoff; permanent failures surfaced to user on next visit                           |
| AC10 | Save queued offline, URL already saved      | Queue sync returns 409                | 409 treated as success — URL is already in library. Item cleared from IndexedDB queue without retry. Toast: "Already saved" if user is in-app.           |
| AC7  | —                                           | —                                     | PWA manifest includes `share_target` configuration with `action: "/save"`, `method: 'POST'`, `enctype`, and `params`                                     |
| AC8  | —                                           | —                                     | Service worker handles `fetch` event for share target URL and routes to save logic                                                                       |
| AC9  | Background Sync unavailable (iOS Safari)    | User opens PWA after offline save     | Fallback: service worker syncs queued saves on next app visit (sync-on-next-visit). iOS users should prefer iOS Shortcut (Story 3.5) for mobile capture. |

### Technical Notes

- **PWA manifest addition (per architecture.md):**
  ```json
  {
    "share_target": {
      "action": "/save",
      "method": "POST",
      "enctype": "application/x-www-form-urlencoded",
      "params": { "url": "url", "title": "title", "text": "text" }
    }
  }
  ```
- **Service worker:** Intercept POST to `/save`; extract URL from params; call `POST /saves` API; fallback to IndexedDB queue if offline
- **IndexedDB schema:** `offlineSaves` object store with `{ url, title, queuedAt, retryCount }`
- **Background Sync:** Register sync event `'sync-saves'`; service worker processes queue on sync trigger. **iOS limitation:** Background Sync is not supported on iOS Safari (ADR-011 confirms). The service worker MUST detect Background Sync unavailability (`'SyncManager' in self`) and fall back to processing the offline queue on the next service worker `activate` or `fetch` event (sync-on-next-visit).
- **409 handling:** When the offline queue syncs a save that returns 409 (duplicate) or 200 (auto-restored), treat as success — clear the item from IndexedDB. Do NOT retry. This matches Story 3.5's behavior (iOS Shortcut treats 409 as "Already saved").
- **Max retries:** 5 attempts with exponential backoff (1s, 2s, 4s, 8s, 16s) for 5xx and network errors only; after max retries, flag as failed in IndexedDB. 4xx errors other than 409 are permanent failures (no retry).
- **Depends on:** Frontend app shell from Epic 1 (React + Vite PWA setup)

### FRs Covered

FR45 (save via PWA share target)

### NFRs Covered

NFR-UX1 (graceful degradation)

---

## Story 3.6a: UI Foundation & Design System Setup

**As a** developer starting the frontend stories,  
**I want** design system decisions locked down and a reusable component foundation in place,  
**so that** Stories 3.7–3.9 can focus on feature logic rather than library choices and styling debates.

### Acceptance Criteria

| #   | Given                                 | When                                  | Then                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Frontend project exists (from Epic 1) | UI Foundation story begins            | Tailwind CSS configured with project design tokens: color palette, spacing scale, border radius, typography (font family, sizes, weights)                                                                                                                                                   |
| AC2 | —                                     | Design tokens configured              | Light mode theme defined (dark mode deferred to post-V1). Colors include: primary, secondary, destructive (red for delete), success (green), muted, background, foreground                                                                                                                  |
| AC3 | —                                     | Toast library selected and configured | Toast/notification library installed and wrapped in a reusable `useToast()` hook. Position: bottom-right. Auto-dismiss: 5s (except errors). Supports: success, error, info, undo action.                                                                                                    |
| AC4 | —                                     | Icon library selected and configured  | Icon library installed. Content type icon mapping created: `video` → VideoIcon, `podcast` → HeadphonesIcon, `article` → FileTextIcon, `github_repo` → GithubIcon, `newsletter` → MailIcon, `tool` → WrenchIcon, `reddit` → MessageSquareIcon, `linkedin` → LinkedinIcon, `other` → LinkIcon |
| AC5 | —                                     | Layout shell created                  | App layout component with: responsive sidebar/nav (desktop), bottom nav or hamburger (mobile), main content area. Breakpoints: Mobile < 768px, Tablet 768-1024px, Desktop > 1024px                                                                                                          |
| AC6 | —                                     | Reusable UI primitives created        | Base components: Button (primary, secondary, destructive, ghost variants), Modal/Dialog (accessible, focus trap, ESC to close), Card, Badge/Chip, Skeleton loader, ErrorBoundary                                                                                                            |
| AC7 | —                                     | Accessibility baseline verified       | All base components pass: keyboard navigation, visible focus indicators, WCAG AA color contrast, proper ARIA labels. Verified via Storybook or manual check.                                                                                                                                |

### Technical Notes

- **Toast library recommendation:** Sonner (lightweight, accessible, supports undo actions natively). Wrap in `useToast()` hook for consistent API.
- **Icon library recommendation:** Lucide React (tree-shakeable, consistent style, good coverage). Content type → icon mapping exported as `CONTENT_TYPE_ICONS` constant.
- **Component approach:** Use a component library like shadcn/ui (copy-paste components built on Radix UI + Tailwind) for accessible primitives, or build lightweight custom components. Decision should be made in this story.
- **This story produces no user-visible pages** — it produces the foundation that Stories 3.7–3.9 build on.
- **Storybook (optional):** If time permits, set up Storybook for component development and visual testing. Not required for V1.

### FRs Covered

— (foundation story, enables FR11, FR64, FR65, FR66, FR67 implementation in subsequent stories)

### NFRs Covered

NFR-UX1 (graceful degradation — establishes the error/success feedback pattern)

### Files to Create

- `frontend/src/lib/design-tokens.ts` (or Tailwind config extension)
- `frontend/src/hooks/useToast.ts`
- `frontend/src/components/ui/Button.tsx`, `Modal.tsx`, `Card.tsx`, `Badge.tsx`, `Skeleton.tsx`
- `frontend/src/components/ui/ErrorBoundary.tsx`
- `frontend/src/components/layout/AppLayout.tsx`, `Sidebar.tsx`, `MobileNav.tsx`
- `frontend/src/lib/content-type-icons.ts`

---

## Story 3.7: Saves List Page

**As a** web user,  
**I want** to see all my saved URLs in a browseable list with pagination,  
**so that** I can browse my library and know when I haven't saved anything yet.

### Acceptance Criteria

| #   | Given               | When                                  | Then                                                                                                                                                                       |
| --- | ------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User is signed in   | Navigates to `/saves` (or `/library`) | Saves list loads with cards showing: title (or URL if no title), domain, contentType icon, date saved, tags                                                                |
| AC2 | User has many saves | Scrolls to bottom                     | Infinite scroll or "Load more" triggers cursor-based pagination; loading indicator shown while fetching                                                                    |
| AC3 | User has no saves   | Views saves page                      | Helpful empty state displayed: illustration + "Save your first URL" with guidance (link to Shortcut setup, share target info)                                              |
| AC4 | API call fails      | Page loads                            | Error message with retry button shown (NFR-UX1); no silent failures                                                                                                        |
| AC5 | Each save in list   | —                                     | Shows content type icon (video, podcast, article, etc.), domain favicon (or fallback), relative time ("2 hours ago")                                                       |
| AC6 | —                   | —                                     | Responsive layout: card grid on desktop, single-column list on mobile                                                                                                      |
| AC7 | User clicks a save  | Save card clicked                     | Navigates to `/saves/:saveId` detail view showing all metadata (title, URL, userNotes, tags, contentType, dates); triggers `GET /saves/:saveId` (updates `lastAccessedAt`) |

### Technical Notes

- **Components:** `SavesPage`, `SavesList`, `SaveCard`, `SaveDetailPage`, `EmptyState`, `ErrorBoundary`
- **State management:** React Query (TanStack Query) for server state with `useInfiniteQuery`; cursor from API `nextToken`
- **API calls:** `useSaves()` hook wrapping GET /saves
- **Content type icons:** Map of contentType → icon component (Lucide icons or similar)
- **Accessibility:** Keyboard navigation, ARIA labels, screen reader support for list/cards
- **This story delivers a usable page;** filtering/sorting/search UI added in Story 3.8

### FRs Covered

FR11 (view saves in unified list), FR66 (helpful empty states)

### NFRs Covered

NFR-UX1 (graceful degradation)

---

## Story 3.8: Save Filtering & Sorting UI

**As a** web user,  
**I want** to filter my saves by type, search by name, and change the sort order,  
**so that** I can quickly find specific resources in my library.

### Acceptance Criteria

| #   | Given                         | When                                      | Then                                                                                                                                   |
| --- | ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User has saves                | Selects contentType filter (e.g., video)  | List filters to show only videos; active filter shown as chip/badge; clearable                                                         |
| AC2 | User has saves                | Types in search box                       | List filters in real-time (debounced 300ms) by title and URL match (via API `?search=` param); "No results" message if nothing matches |
| AC3 | User has saves                | Changes sort (date, title, last accessed) | List re-orders; sort preference persisted in localStorage                                                                              |
| AC4 | User has filtered results     | Clears all filters                        | Full unfiltered list restored                                                                                                          |
| AC5 | API call fails                | Filter or sort applied                    | Error message with retry button shown; previous results preserved until retry                                                          |
| AC6 | No saves match filters        | Filter active                             | "No results" message with suggestion to clear filters; not a full empty state                                                          |
| AC7 | API returns `truncated: true` | Truncation flag present                   | Info banner: "Showing results from your most recent 1000 saves" displayed above results                                                |

### Technical Notes

- **Components:** `SavesFilter` (contentType chips), `SavesSearch` (debounced input), `SavesSort` (dropdown), `TruncationBanner`
- **State:** URL search params for filter/sort state (shareable/bookmarkable URLs): `?contentType=video&search=react&sort=title`
- **Debounced search:** `useDebouncedValue(searchTerm, 300)` before API call
- **API integration:** Extends `useSaves()` hook from Story 3.7 with query param support
- **linkStatus filter:** Included in filter UI but labeled "(coming soon)" until Epic 5 populates `linkedProjectCount`. All saves currently show as "unlinked".
- **Truncation handling:** If API response has `truncated: true`, display a non-dismissible info banner above the list.

### FRs Covered

FR12 (filter by type — UI), FR14 (search by title/source — UI), FR19 (sort — UI)

### NFRs Covered

—

---

## Story 3.9: Save Actions & User Feedback

**As a** web user,  
**I want** to create, edit, and delete saves with clear feedback at every step,  
**so that** I know my actions succeeded and can recover from errors.

### Acceptance Criteria

| #    | Given                                          | When                                     | Then                                                                                                          |
| ---- | ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| AC1  | User is on saves page                          | Clicks "Save URL" button                 | Modal/dialog opens with URL input (required), title, userNotes, content type picker, tags input               |
| AC2  | User enters valid URL and submits              | Save creation succeeds                   | Toast notification: "URL saved successfully"; new save appears at top of list; modal closes                   |
| AC3  | User enters duplicate URL                      | Save creation returns 409                | Toast: "This URL is already in your library" (info, not error); link to existing save                         |
| AC4  | Save creation fails (network/server error)     | API returns 5xx or network error         | Toast: "Failed to save URL. Please try again." with retry button; form data preserved                         |
| AC5  | User clicks edit on a save                     | Edit dialog opens                        | Pre-populated with current title, userNotes, contentType, tags; URL shown but not editable                    |
| AC6  | User edits and submits                         | Update succeeds                          | Toast: "Save updated"; save card refreshes with new data                                                      |
| AC7  | User clicks delete on a save                   | Confirmation dialog: "Delete this save?" | Two buttons: "Cancel" and "Delete"; destructive action styled in red                                          |
| AC8  | User confirms delete                           | Delete succeeds                          | Toast: "Save deleted"; save removed from list with animation; undo option in toast (5 second window)          |
| AC9  | User clicks undo within 5 seconds after delete | Undo action fires                        | Calls `POST /saves/:saveId/restore` (Story 3.3 AC10); toast: "Save restored"; save re-appears in list         |
| AC10 | Device goes offline                            | Network status changes                   | Persistent banner at top: "You're offline — some features may be unavailable"; banner clears when back online |
| AC11 | Device is offline                              | User attempts to create/edit/delete      | Appropriate error: "This action requires an internet connection"                                              |
| AC12 | —                                              | Any user action                          | Loading states shown during API calls (spinner on buttons, skeleton on list); no flash of empty content       |

### Technical Notes

- **Toast system:** Use a toast/notification library (e.g., Sonner or react-hot-toast); position: bottom-right; auto-dismiss 5s (except errors)
- **Undo delete:** Optimistic UI — remove from list immediately; if undo clicked within 5s, call `POST /saves/:saveId/restore` (Story 3.3 AC10). This triggers a `SaveRestored` event (Story 3.3 AC13) so downstream consumers re-index. If undo not clicked, save stays soft-deleted. **Note:** `SaveDeleted` fires immediately on delete; `SaveRestored` may follow up to 5s later. Downstream consumers must handle this sequence idempotently (documented in Story 3.3 technical notes).
- **Offline detection:** `navigator.onLine` + `online`/`offline` event listeners; React context for offline state
- **Form validation:** Client-side validation with same Zod schemas from `@ai-learning-hub/validation` (shared between frontend and backend). Field name is `userNotes` (consistent across create, update, and response).
- **Confirmation dialog:** Accessible modal with focus trap; ESC to cancel; styled as system-consistent dialog
- **Error boundary:** Wrap saves page in ErrorBoundary component; "Something went wrong" with refresh option

### FRs Covered

FR10 (save URLs — UI), FR64 (visual confirmation on save), FR65 (clear error messages), FR67 (offline status indicator)

### NFRs Covered

NFR-UX1 (graceful degradation — clear errors with retry, no silent failures)

---

## Implementation Plan Summary

| Order | Story | Focus                                              | Est. Complexity | Dependencies                              |
| ----- | ----- | -------------------------------------------------- | --------------- | ----------------------------------------- |
| 1     | 3.1a  | URL normalizer, content type detector, Zod schemas | Medium          | Epic 1 (shared libs)                      |
| 2     | 3.1b  | Create save API + dedup + events                   | Medium-High     | 3.1a, Epic 1 (saves table), Epic 2 (auth) |
| 3     | 3.2   | List/get saves + pagination                        | Medium          | 3.1b                                      |
| 4     | 3.3   | Update + delete + restore + events                 | Medium          | 3.1b                                      |
| 5     | 3.4   | Filtering, search, sorting API                     | Medium          | 3.2                                       |
| 6     | 3.5   | iOS Shortcut capture                               | Low             | 3.1b, Epic 2 (API keys)                   |
| 7     | 3.6   | PWA share target + offline                         | Medium          | 3.1b, Frontend app shell                  |
| 8     | 3.6a  | UI Foundation & design system setup                | Medium          | Frontend app shell (Epic 1)               |
| 9     | 3.7   | Saves list page (basic)                            | Medium          | 3.2, 3.6a                                 |
| 10    | 3.8   | Filtering & sorting UI                             | Medium          | 3.4, 3.7                                  |
| 11    | 3.9   | Save actions + user feedback                       | Medium          | 3.1b, 3.3, 3.7                            |

### Recommended Sprint Split

- **Sprint A (API Core):** 3.1a, 3.1b, 3.2, 3.3 — Validation modules + full CRUD + restore API with events
- **Sprint B (API Complete + Mobile):** 3.4, 3.5, 3.6 — Filtering/sorting + iOS Shortcut + PWA share target
- **Sprint C (Frontend):** 3.6a, 3.7, 3.8, 3.9 — UI Foundation + saves list page + filter UI + actions/feedback

### Test Requirements

- **3.1a:** Unit tests for URL normalizer (40+ cases: percent-encoding, default ports, path segments, embedded credentials, IDN→punycode, trailing slash root vs path), content type detector (mapping table coverage + user-override precedence), Zod schema validation (valid/invalid inputs, field-level errors, tag trimming/dedup)
- **3.1b:** Unit tests for create handler; integration: POST /saves → 201, duplicate → 409 (both GSI and conditional write paths), re-save after soft-delete → 200 (auto-restore + SaveRestored event), invalid URL → 400, embedded credentials → 400; verify EventBridge event includes `normalizedUrl`; concurrent duplicate test (verify Layer 2 TransactWriteItems guard); verify tags are trimmed and deduplicated on create
- **3.2:** Unit tests for in-memory cursor pagination (ULID-based cursor encoding, limit enforcement, hasMore logic, stability across concurrent inserts); integration: GET /saves → `{ items, nextToken, hasMore }`, GET /saves/:id → single, 404 for missing/other-user, empty list returns `{ items: [], hasMore: false }`
- **3.3:** Integration: PATCH → updated save, DELETE → 204, POST /restore → restored save + `SaveRestored` event, 404 for missing, idempotent delete, idempotent restore, verify all four event types emitted with `normalizedUrl`
- **3.4:** Integration: filter by contentType, linkStatus (with `linkedProjectCount`), search, sort; combined filters; empty results; invalid filter → 400; verify 1000-item ceiling with `truncated: true`; verify nextToken compatibility with Story 3.2
- **3.5:** Manual E2E: iOS Shortcut save < 3s (warm); Shortcut handles success, duplicate (409→"Already saved"), error
- **3.6:** Unit: service worker share target handler with `/save` action URL, offline queue logic, Background Sync detection + fallback, 409 treated as success (cleared from queue, not retried); E2E: share target appears, offline save queues, online sync works
- **3.6a:** Component tests for each UI primitive (Button variants, Modal focus trap + ESC, Card, Badge, Skeleton, ErrorBoundary); accessibility checks (keyboard nav, focus indicators, ARIA); content type icon mapping covers all types; toast hook: success/error/info/undo actions; responsive layout renders at all 3 breakpoints
- **3.7:** Component tests: SavesList renders saves, empty state, loading skeleton, error boundary; pagination trigger; responsive layout; SaveDetailPage renders all metadata, triggers lastAccessedAt update, 404 handling
- **3.8:** Component tests: filter chips, debounced search, sort dropdown, URL search params sync, "no results" state, truncation banner
- **3.9:** Component tests: create modal, edit modal, delete confirmation, toast notifications, undo calls POST /restore, offline banner, form validation; verify `userNotes` field naming consistency

### Files to Create/Modify

| Story | New Files                                                                                                                                                                                                                                                                      | Modified                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 3.1a  | `shared/validation/url-normalizer.ts`, `shared/validation/content-type-detector.ts`, `shared/validation/schemas/save.ts` + tests                                                                                                                                               | —                                        |
| 3.1b  | `backend/functions/saves-create/`                                                                                                                                                                                                                                              | CDK API stack, routes config             |
| 3.2   | `backend/functions/saves-list/`, `backend/functions/saves-get/`                                                                                                                                                                                                                | CDK, routes                              |
| 3.3   | `backend/functions/saves-update/`, `backend/functions/saves-delete/`, `backend/functions/saves-restore/`                                                                                                                                                                       | CDK, routes                              |
| 3.4   | — (modifies 3.2 handler)                                                                                                                                                                                                                                                       | `saves-list` handler, validation schemas |
| 3.5   | `docs/ios-shortcut/AI-Learning-Hub-Save.shortcut`, `docs/ios-shortcut/setup-guide.md`                                                                                                                                                                                          | —                                        |
| 3.6   | `frontend/src/sw-share-target.ts`, `frontend/src/lib/offline-queue.ts`                                                                                                                                                                                                         | `frontend/manifest.json`, service worker |
| 3.6a  | `frontend/src/components/ui/Button.tsx`, `Modal.tsx`, `Card.tsx`, `Badge.tsx`, `Skeleton.tsx`, `ErrorBoundary.tsx`, `frontend/src/components/layout/AppLayout.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, `frontend/src/hooks/useToast.ts`, `frontend/src/lib/content-type-icons.ts` | Tailwind config, `frontend/package.json` |
| 3.7   | `frontend/src/pages/SavesPage.tsx`, `frontend/src/pages/SaveDetailPage.tsx`, `frontend/src/components/saves/SavesList.tsx`, `SaveCard.tsx`, `EmptyState.tsx`                                                                                                                   | Frontend routing, navigation             |
| 3.8   | `frontend/src/components/saves/SavesFilter.tsx`, `SavesSearch.tsx`, `SavesSort.tsx`, `TruncationBanner.tsx`                                                                                                                                                                    | SavesPage                                |
| 3.9   | `frontend/src/components/saves/CreateSaveModal.tsx`, `EditSaveModal.tsx`, `DeleteConfirm.tsx`, `OfflineBanner.tsx`                                                                                                                                                             | SavesPage, SaveCard                      |

---

## FR Coverage Checklist

| FR   | Story           | Description                                       |
| ---- | --------------- | ------------------------------------------------- |
| FR10 | 3.1a, 3.1b, 3.9 | Save URLs from any source (validation + API + UI) |
| FR11 | 3.2, 3.7        | View all saves in unified list (API + UI)         |
| FR12 | 3.4, 3.8        | Filter saves by resource type (API + UI)          |
| FR13 | 3.4, 3.8        | Filter saves by project linkage (API + UI)        |
| FR14 | 3.4, 3.8        | Search saves by title and source (API + UI)       |
| FR15 | 3.3, 3.9        | Delete saves (API + UI)                           |
| FR16 | 3.3, 3.9        | Edit save metadata (API + UI)                     |
| FR19 | 3.4, 3.8        | Sort saves by date/title/last accessed (API + UI) |
| FR44 | 3.5             | Save via iOS Shortcut                             |
| FR45 | 3.6             | Save via PWA share target                         |
| FR46 | 3.5             | Mobile save < 3 seconds                           |
| FR47 | 3.5             | Quick-save without opening app                    |
| FR64 | 3.9             | Visual confirmation on save                       |
| FR65 | 3.9             | Clear error messages                              |
| FR66 | 3.7             | Helpful empty states                              |
| FR67 | 3.9             | Offline status indicator                          |

**All 16 FRs covered across 11 stories.**

---

## Architecture Compliance Notes

| ADR                            | How Epic 3 Complies                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 (DynamoDB)             | Uses `saves` table with `PK=USER#<userId>`, `SK=SAVE#<saveId>`; `urlHash-index` GSI for dedup (PK-only, FilterExpr)             |
| ADR-003 (EventBridge + SF)     | Emits `SaveCreated`, `SaveUpdated`, `SaveDeleted`, `SaveRestored` events with `normalizedUrl`; Step Functions consume in Epic 9 |
| ADR-005 (No L2L)               | All communication via API Gateway endpoints; EventBridge for async                                                              |
| ADR-008 (Error Handling)       | All errors use `{ error: { code, message, requestId } }` wrapper via shared middleware                                          |
| ADR-009 (Eventual Consistency) | Content layer populated async by enrichment (Epic 9); save works without it                                                     |
| ADR-014 (API-First)            | All list endpoints use `{ items, nextToken?, hasMore }` pagination; `X-Idempotency-Key` deferred to post-V1                     |
| ADR-016 (Cold Starts)          | All NFR-P1/P2 claims qualified as "warm invocation"; cold start (2-5s) accepted per ADR-016                                     |

---

## Required Architecture Amendments

Changes to `architecture.md` required before Epic 3 implementation. Status updated 2026-02-16.

1. ✅ **Add `lastAccessedAt` field** to saves table schema — APPLIED
2. ✅ **Add `linkedProjectCount` field** (default 0) to saves table schema — APPLIED
3. ✅ **Add `normalizedUrl` field** to saves table schema — APPLIED
4. ✅ **Add uniqueness marker item pattern** (`SK=URL#<urlHash>`) to saves table — APPLIED
5. ✅ **Confirm `DUPLICATE_SAVE` error code and 409 status** in ADR-008 error code registry — APPLIED (full error code registry table added)
6. ✅ **Add `SaveRestored` event type** to EventBridge event catalog — APPLIED (full event catalog table added)
7. ✅ **Add `POST /saves/:saveId/restore` endpoint** to API endpoint catalog — APPLIED
8. ⬜ **Document enrichment pipeline authentication** — Epic 9 concern, deferred
9. ✅ **Document Pipeline 3 (search index sync) triggers** — APPLIED (all 4 save events listed as triggers)
10. ⬜ **Document `linkedProjectCount` reconciliation** — Epic 10 concern, deferred
11. ⬜ **Note `X-Idempotency-Key` deferral** in ADR-014 — documentation-only, deferred

**Additional amendments applied:**

- ✅ **GSI projection types** specified for all 10 GSIs (ALL projection, with rationale)
- ✅ **Save access patterns** expanded with duplicate detection, lastAccessedAt update, and restore patterns
- ✅ **createSave code example** updated to reflect two-layer dedup and new schema fields

---

_Generated for Epic 3 story planning. Revised after adversarial review rounds 1–4. Updated 2026-02-16 after implementation readiness review: Story 3.1 split into 3.1a/3.1b, Story 3.6a (UI Foundation) added, architecture amendments applied. 11 stories total._
