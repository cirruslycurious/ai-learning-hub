---
id: "3.4"
title: "Save Filtering & Sorting"
status: ready-for-dev
depends_on:
  - 3-2-list-get-saves-api
touches:
  - backend/functions/saves-list/handler.ts
  - backend/shared/validation/src/schemas.ts (list filter/sort query schema — extend inline or add listSavesQuerySchema)
  - backend/shared/validation/src/index.ts (if listSavesQuerySchema added)
risk: low
---

# Story 3.4: Save Filtering & Sorting

Status: ready-for-dev

## Story

As a user,
I want to filter saves by type and linkage, search by title/source, and sort my list,
so that I can quickly find the saves I'm looking for.

## Acceptance Criteria

| #    | Given                                    | When                                                       | Then                                                                                                                                 |
| ---- | ---------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| AC1  | User has saves with various contentTypes | `GET /saves?contentType=video`                             | Returns only saves where `contentType` = video; combinable with other filters                                                        |
| AC2  | User has linked and unlinked saves       | `GET /saves?linkStatus=linked`                             | Returns saves where `linkedProjectCount > 0`                                                                                         |
| AC3  | User has linked and unlinked saves       | `GET /saves?linkStatus=unlinked`                           | Returns saves where `linkedProjectCount = 0`                                                                                         |
| AC4  | User has saves                           | `GET /saves?search=react`                                  | Returns saves where `title` or `url` contains "react" (case-insensitive)                                                             |
| AC5  | User has saves                           | `GET /saves?sort=createdAt&order=asc`                      | Returns saves sorted by creation date ascending                                                                                      |
| AC6  | User has saves                           | `GET /saves?sort=lastAccessedAt&order=desc`                | Returns saves sorted by last accessed date descending; saves never accessed sort to bottom                                          |
| AC7  | User has saves                           | `GET /saves?sort=title&order=asc`                          | Returns saves sorted alphabetically by title; saves without titles sort to bottom                                                   |
| AC8  | Multiple filters applied                 | `GET /saves?contentType=video&search=react&sort=createdAt`  | All filters AND-combined; sorting applied after filtering                                                                            |
| AC9  | Invalid filter or sort value             | `GET /saves?contentType=invalid`                           | Returns 400 `{ error: { code: 'VALIDATION_ERROR', message: '...', requestId } }` with valid options listed                          |
| AC10 | No saves match filters                   | `GET /saves?contentType=podcast`                           | Returns `{ items: [], hasMore: false }` (empty result, not an error)                                                               |
| AC11 | User has >1000 saves                     | Any filtered/sorted query                                  | Response includes `truncated: true` flag indicating results are from the most recent 1000 saves only. Logged as warning server-side. |

## Tasks / Subtasks

- [ ] Task 1: Add list filter/sort query schema to `@ai-learning-hub/validation` (AC: #1–#9)
  - [ ] 1.1 Add optional query params: `contentType` (contentTypeSchema.optional()), `linkStatus` (z.enum(['linked','unlinked']).optional()), `search` (z.string().min(1).max(200).optional()), `sort` (z.enum(['createdAt','lastAccessedAt','title']).optional()), `order` (z.enum(['asc','desc']).optional()). Defaults: sort=createdAt, order=desc for date sorts and order=asc for title.
  - [ ] 1.2 Export schema (e.g. `listSavesQuerySchema`) from validation package and use in saves-list handler.
  - [ ] 1.3 Invalid values (e.g. contentType=invalid, linkStatus=foo, sort=invalid) → 400 VALIDATION_ERROR. For enum failures, ensure valid options are listed in `error.message` or in `error.details` so AC9 is satisfied (e.g. "contentType must be one of: article, video, podcast, ...").

- [ ] Task 2: Extend saves-list handler — filter/sort/search + truncated (AC: all)
  - [ ] 2.1 In `backend/functions/saves-list/handler.ts`, extend query validation to include new params (contentType, linkStatus, search, sort, order) using the new schema. Keep existing limit + nextToken validation.
  - [ ] 2.2 After fetching active saves via `queryAllItems` (unchanged call — same filterExpression, ceiling, scanIndexForward from Story 3.2), apply in-memory filters in order: contentType (if provided), linkStatus (linked ⇒ `(item.linkedProjectCount ?? 0) > 0`, unlinked ⇒ `(item.linkedProjectCount ?? 0) === 0`), search (case-insensitive includes on `(item.title ?? '')` and `item.url`).
  - [ ] 2.3 Apply in-memory sort: by sort key (createdAt | lastAccessedAt | title) and order (asc | desc). For lastAccessedAt: null/undefined sorts to bottom. For title: null/empty sorts to bottom. When `order` is omitted, set in handler after parse: `desc` when sort is createdAt or lastAccessedAt, `asc` when sort is title.
  - [ ] 2.4 Apply ULID cursor pagination on the filtered+sorted array (same semantics as Story 3.2). **nextToken + filter change (epic):** If nextToken resolves to a saveId that is **not present in the current filtered/sorted list** (e.g. client changed filters between requests), **ignore nextToken** and return the first page (same as omitting nextToken). Do not return 400. Return 400 only for **malformed** nextToken (unparseable or invalid ULID) or when the saveId is not in the **unfiltered** result set (stale cursor).
  - [ ] 2.5 Include `truncated` in the response **only when** `queryAllItems` returned truncated (remove TODO(story-3.4) comment). Use `...(truncated && { truncated: true })`; omit when not truncated. Response shape: `{ items, nextToken?, hasMore, truncated? }`.
  - [ ] 2.6 When sort=createdAt (default), keep using scanIndexForward: false in queryAllItems so DynamoDB returns newest-first; then apply order=asc in-memory if needed. When sort=lastAccessedAt or sort=title, fetch with same query (newest-first by SK) then sort in-memory (no DynamoDB sort key change).

- [ ] Task 3: Tests + quality gates
  - [ ] 3.1 Handler tests: filter by contentType; filter by linkStatus (linked / unlinked); search by title substring (including missing title); search by url substring; sort=createdAt&order=asc/desc; sort=lastAccessedAt&order=desc (null lastAccessedAt at bottom); sort=title&order=asc (empty title at bottom); default order when only sort provided (desc for dates, asc for title); combined filters + sort; invalid contentType/linkStatus/sort → 400; response body (message or details) includes valid options (AC9); use `assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400)` for validation error paths; no matches → { items: [], hasMore: false }; truncated=true in response only when ceiling hit; malformed nextToken → 400; nextToken with saveId not in filtered/sorted list → first page returned (no 400, per epic).
  - [ ] 3.2 Ensure existing saves-list and architecture enforcement tests still pass.
  - [ ] 3.3 Run `npm test`, `npm run lint`, `npm run build`, `npm run type-check`, `npm run format`.

## Dev Notes

- **Extends Story 3.2 only:** No new Lambdas, no new routes. Only `GET /saves` handler and optional validation schema changes.
- **In-memory strategy:** Story 3.2 already fetches up to 1000 active saves. Story 3.4 adds filter/sort/search on that same result set. Pagination contract unchanged (nextToken = base64url of saveId).
- **linkStatus:** Uses `linkedProjectCount` on Save (default 0). Treat missing as 0: linked ⇒ `(item.linkedProjectCount ?? 0) > 0`, unlinked ⇒ `(item.linkedProjectCount ?? 0) === 0`. Until Epic 5, all saves have 0 so linkStatus=linked returns empty.
- **Search:** Case-insensitive substring on `(item.title ?? '')` and `item.url` (full url). NOT full-text search (Epic 7).
- **Sort:** createdAt (default), lastAccessedAt, title. order: asc | desc. When `order` is omitted, set in handler after parse: `desc` for createdAt/lastAccessedAt, `asc` for title.
- **Truncation (AC11):** Include `truncated` in response only when true (`...(truncated && { truncated: true })`); omit when not truncated. Server-side warn log already exists; ensure it remains.

### Project Structure Notes

- Single handler change: `backend/functions/saves-list/handler.ts`.
- Use a single list query schema: either extend the inline schema in the handler with the new params, or add `listSavesQuerySchema` in `@ai-learning-hub/validation` and use it in the handler. If added to validation, export from the package index and reference in File Structure Requirements.

### References

- [Source: docs/progress/epic-3-stories-and-plan.md#Story-3.4] — ACs and technical notes
- [Source: _bmad-output/implementation-artifacts/3-2-list-get-saves-api.md] — queryAllItems, cursor pagination, TODO(story-3.4) truncated
- [Source: backend/shared/validation/src/schemas.ts] — contentTypeSchema for filter validation
- [Source: backend/shared/types/src/entities.ts] — Save has linkedProjectCount, lastAccessedAt, title, url

## Developer Context (Read First)

- **Do not add new endpoints or Lambdas.** This story extends the existing `GET /saves` handler only.
- **Reuse `queryAllItems`:** Same call as Story 3.2 (filterExpression for deletedAt, ceiling 1000, consistentRead). Filtering and sorting happen in-memory after the fetch.
- **Validation:** Add a list-query schema that allows optional contentType, linkStatus, search, sort, order. Use `validateQueryParams` with the extended schema. For invalid enum values return 400 with a message that lists valid options (AC9).
- **nextToken + filter change (epic):** If nextToken resolves to a saveId not in the current filtered/sorted list (e.g. filters changed between requests), **ignore nextToken** and return the first page. Do not return 400. Return 400 only for malformed nextToken (unparseable or invalid ULID) or when the cursor save is not in the unfiltered result set (stale).

## Technical Requirements

### GET /saves query parameters (extended)

- **Existing:** limit (1–100, default 25), nextToken (optional).
- **New (all optional):**
  - contentType: one of contentTypeSchema values (article, video, podcast, github_repo, newsletter, tool, reddit, linkedin, other).
  - linkStatus: `linked` | `unlinked`.
  - search: non-empty string, max length 200; applied as case-insensitive substring match on title and url.
  - sort: `createdAt` | `lastAccessedAt` | `title`. Default `createdAt`.
  - order: `asc` | `desc`. Default `desc` for createdAt/lastAccessedAt, `asc` for title.
- **Validation:** Invalid enum/value → 400 VALIDATION_ERROR. Message or error.details must list valid options (AC9); e.g. custom message "contentType must be one of: article, video, podcast, ...".

### Response shape

- `{ items: PublicSave[], nextToken?: string, hasMore: boolean, truncated?: boolean }`.
- Include `truncated` only when true (omit when not truncated). Set when the user has more than 1000 active saves and the list was capped at 1000 (AC11).

### Filter and sort order

1. Fetch: same as 3.2 (queryAllItems with filterExpression deletedAt, ceiling 1000, scanIndexForward: false).
2. Filter in-memory: contentType (if present) → linkStatus (if present) → search (if present). AND between filters.
3. Sort in-memory: by chosen sort key and order. lastAccessedAt null/undefined → bottom. title null/empty → bottom.
4. Paginate: slice filtered+sorted array using nextToken (cursor) and limit; compute nextToken and hasMore as in 3.2.

## Architecture Compliance

| ADR / NFR | How This Story Must Comply |
|-----------|----------------------------|
| **ADR-001 (DynamoDB keys)** | No schema change. Same PK/SK query as 3.2. |
| **ADR-008 (Standardized errors)** | 400 for invalid query params via AppError(ErrorCode.VALIDATION_ERROR, ...). |
| **ADR-014 (API-first)** | GET /saves remains the only list endpoint; query params extend the contract. |
| **NFR-P2 (Warm perf)** | In-memory filter/sort on ≤1000 items; stay under 1s warm. |

## Library / Framework Requirements

- `@ai-learning-hub/validation`: extend or add list query schema; use `validateQueryParams`, `contentTypeSchema`.
- `@ai-learning-hub/db`: `queryAllItems`, `SAVES_TABLE_CONFIG`, `toPublicSave` — no changes to db package.
- `@ai-learning-hub/middleware`: `wrapHandler`, `HandlerContext` — unchanged.
- `@ai-learning-hub/types`: `SaveItem`, `PublicSave`, `AppError`, `ErrorCode` — unchanged.

## File Structure Requirements

- **Modify:** `backend/functions/saves-list/handler.ts` (add query parsing, filter/sort/search logic, include truncated in response).
- **Schema:** Either extend the handler’s inline list query schema with new params or add `listSavesQuerySchema` in `backend/shared/validation/src/schemas.ts` and export from index.

## Testing Requirements

- **saves-list handler tests:** Cover AC1–AC11: each filter alone; linkStatus linked/unlinked (including items with missing linkedProjectCount); search on title (including missing title) and url; sort/order combinations; default order when only sort provided; lastAccessedAt null at bottom; title empty at bottom; combined filters + sort; invalid params → 400; response (message or details) includes valid options; use `assertADR008Error(result, ErrorCode.VALIDATION_ERROR, 400)` for validation error paths; empty result → items [], hasMore false; truncated present only when ceiling hit; malformed nextToken → 400; nextToken with saveId not in filtered/sorted list → first page (no 400).
- **No new infra or route registry changes** — same GET /saves route.

## Previous Story Intelligence (3.2, 3.3)

### From Story 3.2 (List & Get Saves API)

- **queryAllItems** already used with filterExpression, ceiling, scanIndexForward. Story 3.4 does not change the DynamoDB call; only post-processing.
- **TODO(story-3.4): expose truncated in response** — remove the TODO and add `truncated` to the returned object when `truncated === true`.
- **Cursor pagination:** nextToken = base64url(saveId); decode and find index in array; slice(startIndex, startIndex + limit). If nextToken decode fails or saveId not in list → 400.
- **ConsistentRead: true** and filterExpression for deletedAt remain as-is.

### From Story 3.3 (Update, Delete, Restore)

- No direct impact. 3.4 is read-only list extension. Save shape (linkedProjectCount, lastAccessedAt, contentType) is already used in 3.2/3.3.

## Git Intelligence Summary

- Recent work: 3.2 list/get, 3.3 update/delete/restore. Saves-list handler is in `backend/functions/saves-list/handler.ts`; extend it in place.
- Route registry and CDK: no changes for 3.4 (same GET /saves).

## Latest Tech Information

- No new dependencies. Use existing Zod schemas and query validation pattern from 3.2.

## Project Context Reference

- Story source: `docs/progress/epic-3-stories-and-plan.md` (Story 3.4).
- Prior story: `_bmad-output/implementation-artifacts/3-2-list-get-saves-api.md`.
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (ADR-001, ADR-008, ADR-014).

## Story Completion Status

- **Status**: ready-for-dev
- **Completion note**: Ultimate context engine analysis completed — comprehensive developer guide created

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
