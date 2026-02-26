---
id: "3.2.5"
title: "Cursor-Based Pagination"
status: ready-for-dev
depends_on: []
touches:
  - backend/shared/db/src/pagination
  - backend/shared/db/src/helpers
  - backend/shared/validation/src/schemas
  - backend/shared/middleware/src/error-handler
  - backend/functions/saves-list/handler
  - backend/functions/saves-filter/handler
  - backend/functions/saves-sort/handler
  - backend/functions/api-keys/handler
  - backend/functions/invite-codes/handler
risk: medium
---

# Story 3.2.5: Cursor-Based Pagination

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer building agent-native API endpoints**,
I want **a shared cursor-based pagination utility in `@ai-learning-hub/db` with opaque cursor encoding/decoding, and all existing list endpoints retrofitted to use standardized cursor tokens and the response envelope**,
so that **AI agents get consistent, stable pagination across every list endpoint — no offset/page patterns, unified `cursor` parameter naming, and response metadata in the standard envelope format (`meta.cursor`, `links.next`)**.

## Acceptance Criteria

### Shared Pagination Utility (FR105)

1. **AC1: Opaque cursor encoding/decoding** — A new `pagination.ts` module in `@ai-learning-hub/db` exports `encodeCursor(lastEvaluatedKey: Record<string, unknown>): string` and `decodeCursor(cursor: string): Record<string, unknown>`. Encoding uses `base64url` (URL-safe, no padding). Decoding validates the cursor and throws `VALIDATION_ERROR` with `{ field: 'cursor', message: 'Invalid cursor token', code: 'invalid_string' }` if the cursor is malformed (not valid base64url, not valid JSON, or not an object). Additionally, `decodeCursor` validates that all values in the decoded object are primitives (string, number, boolean, null) — objects, arrays, or functions are rejected with `VALIDATION_ERROR`. This prevents DynamoDB `SerializationException` from bubbling as a 500 when tampered cursors contain nested objects. The cursor is opaque to consumers — they must not parse or construct it.

2. **AC2: Cursor validation helper** — `validateCursor(cursor: string, expectedFields?: string[]): Record<string, unknown>` wraps `decodeCursor` with friendly error messages. Returns the decoded `ExclusiveStartKey` object or throws `AppError(VALIDATION_ERROR)`. When `expectedFields` is provided, verifies the decoded object contains all expected keys — throws `VALIDATION_ERROR` with `{ field: 'cursor', message: 'Cursor is not valid for this endpoint', code: 'invalid_string' }` if any expected field is missing. This prevents cross-endpoint cursor replay (a cursor from `/saves` encoding `{ saveId }` won't pass validation on `/users/api-keys` which expects `{ PK, SK }`). Exported from `@ai-learning-hub/db`.

3. **AC3: Paginated response builder** — `buildPaginatedResponse<T>(items: T[], nextCursor: string | null, options?: { total?: number, requestPath?: string, queryParams?: Record<string, string> }): { data: T[], meta: EnvelopeMeta, links?: ResponseLinks }` produces a response body conforming to the 3.2.2 envelope. `meta.cursor` is set to `nextCursor` (null if last page). `meta.total` is set if provided. `links.self` and `links.next` are populated when `requestPath` is provided. `links.next` is null when `nextCursor` is null. When `requestPath` is not provided, `links` is omitted entirely.

4. **AC4: queryItems cursor integration** — The existing `queryItems()` in `helpers.ts` is updated to use the shared `encodeCursor`/`decodeCursor` from `pagination.ts` instead of its inline implementations. Behavior is identical — this is a refactor for DRY, not a behavior change. All existing tests continue to pass.

5. **AC5: Pagination constants** — `DEFAULT_PAGE_SIZE = 25`, `MAX_PAGE_SIZE = 100` exported from `pagination.ts`. All list endpoints use these constants instead of hardcoding limits.

### Saves List Endpoint Retrofit (FR105)

6. **AC6: Parameter rename `nextToken` → `cursor`** — The `listSavesQuerySchema` in `@ai-learning-hub/validation/src/schemas.ts` replaces `nextToken` with `cursor`. The saves-list handler accepts `cursor` in query parameters. The old `nextToken` parameter is no longer accepted (breaking change — acceptable because no external consumers exist yet).

7. **AC7: Saves cursor standardization** — The saves-list handler's in-memory pagination cursor is encoded using the shared `encodeCursor`/`decodeCursor` utilities. The cursor payload wraps the last-seen saveId: `encodeCursor({ saveId: lastItem.saveId })`. Decoding extracts `saveId` and validates it is a 26-character ULID string. This standardizes the cursor format while preserving the in-memory pagination approach (necessary because filtering and sorting happen after DynamoDB fetch).

8. **AC8: Saves response envelope** — The saves-list handler returns responses using `createSuccessResponse` with the envelope format: `{ data: items[], meta: { cursor: nextCursor, total: filteredCount }, links: { self, next } }`. The old `{ items, nextToken, hasMore, truncated }` shape is replaced. The `truncated` flag is moved to `meta.truncated` (boolean, only present when true). `hasMore` is removed as a top-level field — it is implied by `meta.cursor !== null`.

9. **AC9: Stale cursor handling** — When a cursor references a saveId that no longer exists in the current result set (item deleted or filters changed), the endpoint returns the first page of results with `meta.cursor` set to the first page's cursor. Both a `X-Cursor-Reset: true` response header AND `meta.cursorReset: true` in the response body signal to agents that the cursor was reset. The body signal ensures agents that only parse JSON (not headers) still detect the reset. `meta.cursorReset` is only present when `true` — omitted on normal (non-reset) responses. No error is thrown — this is graceful degradation.

### Other Endpoint Standardization (FR105)

10. **AC10: API keys list — envelope format** — The `GET /users/api-keys` handler returns responses in the standard envelope: `{ data: items[], meta: { cursor }, links: { self, next } }`. The `items`, `hasMore`, `nextCursor` wrapper is replaced by the envelope.

11. **AC11: Invite codes list — envelope format** — The `GET /users/invite-codes` handler returns responses in the standard envelope, same as AC10.

12. **AC12: Event history — envelope alignment** — The `queryEntityEvents()` return type aligns with the envelope: `{ events }` is renamed to `{ data }` in the handler response. The `createEventHistoryHandler()` uses `createSuccessResponse` with `meta.cursor` instead of `meta.nextCursor`. `meta.hasMore` is removed — implied by cursor nullness.

13. **AC13: Consistent `paginationQuerySchema`** — A single canonical `paginationQuerySchema` is used across all list endpoints: `{ limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE), cursor: z.string().optional() }`. The saves-list extends this with its additional filter/sort parameters. No endpoint defines its own limit/cursor schema.

### Type Safety & Exports

14. **AC14: Pagination types** — New types exported from `@ai-learning-hub/types`: `CursorPayload` (generic cursor wrapper), `PaginationOptions` (limit + cursor query params). Existing `PaginatedResponse<T>` type updated to use `cursor` (not `nextCursor`). The `PaginationParams` type is aliased to `PaginationOptions` for backward compatibility. `EnvelopeMeta` is extended with `cursorReset?: boolean` and `truncated?: boolean` (both only present when `true`).

15. **AC15: Re-exports** — All pagination utilities (`encodeCursor`, `decodeCursor`, `validateCursor`, `buildPaginatedResponse`, constants) exported from `@ai-learning-hub/db` index. Pagination types exported from `@ai-learning-hub/types` index.

### Testing

16. **AC16: Unit tests — cursor utilities** — Tests cover: encode/decode round-trip, base64url encoding (no `+`, `/`, `=` characters), invalid cursor rejection (not base64, not JSON, not object, empty string), non-primitive value rejection (nested object, array, function values in decoded cursor), composite key encoding (PK + SK), single key encoding, `validateCursor` error messages, `validateCursor` with `expectedFields` — passes when fields present, rejects when fields missing (cross-endpoint replay prevention), rejects cursor from saves endpoint on api-keys endpoint. Minimum 90% coverage.

17. **AC17: Unit tests — buildPaginatedResponse** — Tests cover: response with cursor (has more pages), response without cursor (last page), response with total, response with links (self + next), response without links (no requestPath), empty items array, cursor=null produces `links.next=null`.

18. **AC18: Unit tests — saves-list retrofit** — Tests cover: cursor parameter replaces nextToken, cursor encode/decode round-trip with saveId, stale cursor returns first page with `X-Cursor-Reset` header, response in envelope format `{ data, meta, links }`, `meta.truncated` present only when true, backward compatibility of filtering and sorting with new cursor format.

19. **AC19: Unit tests — other endpoints** — Tests cover: API keys list returns envelope format, invite codes list returns envelope format, event history handler returns envelope format with `meta.cursor`. All existing pagination behavior preserved.

20. **AC20: Integration contract tests** — End-to-end pagination flow: first page → extract cursor from `meta.cursor` → second page → verify data continuity → last page → cursor is null. Test with saves-list (in-memory pagination) and api-keys (DynamoDB-native pagination).

## Tasks / Subtasks

### Task 1: Shared Cursor Utilities (AC: #1, #2, #5, #15)

- [ ] 1.1 Create `backend/shared/db/src/pagination.ts` with `encodeCursor(key)` and `decodeCursor(cursor)` using `base64url` encoding
- [ ] 1.2 Implement `validateCursor(cursor)` with friendly `VALIDATION_ERROR` on malformed input
- [ ] 1.3 Export `DEFAULT_PAGE_SIZE = 25`, `MAX_PAGE_SIZE = 100` constants
- [ ] 1.4 Export all from `backend/shared/db/src/index.ts`
- [ ] 1.5 Write unit tests in `backend/shared/db/test/pagination.test.ts` (AC16)

### Task 2: Pagination Types (AC: #14)

- [ ] 2.1 Add `CursorPayload` type to `@ai-learning-hub/types/src/api.ts`
- [ ] 2.2 Add `PaginationOptions` type (alias `PaginationParams` for backward compat)
- [ ] 2.3 Update `PaginatedResponse<T>` — rename `nextCursor` to `cursor`, drop `hasMore` (implied by cursor nullness)
- [ ] 2.4 Export from `@ai-learning-hub/types/src/index.ts`

### Task 3: buildPaginatedResponse Helper (AC: #3)

- [ ] 3.1 Create `buildPaginatedResponse<T>()` in `backend/shared/db/src/pagination.ts`
- [ ] 3.2 Populate `meta.cursor` and optionally `meta.total`
- [ ] 3.3 Populate `links.self` and `links.next` when `requestPath` is provided (append `cursor` query param to next link)
- [ ] 3.4 Write unit tests (AC17)

### Task 4: Refactor queryItems to Use Shared Utilities (AC: #4)

- [ ] 4.1 Remove inline `encodeCursor`/`decodeCursor` from `backend/shared/db/src/helpers.ts`
- [ ] 4.2 Import from `./pagination.ts` instead
- [ ] 4.3 Run all existing queryItems tests — verify no behavior change
- [ ] 4.4 Update `queryItems` return type to use `cursor` (not `nextCursor`)

### Task 5: Update paginationQuerySchema (AC: #13)

- [ ] 5.1 Update `paginationQuerySchema` in `backend/shared/validation/src/schemas.ts` to use `DEFAULT_PAGE_SIZE` and `MAX_PAGE_SIZE` from `@ai-learning-hub/db`
- [ ] 5.2 Update `listSavesQuerySchema` to extend `paginationQuerySchema` (rename `nextToken` to `cursor`)
- [ ] 5.3 Update any other schemas that define their own limit/cursor params
- [ ] 5.4 Update test assertions for schema changes

### Task 6: Retrofit Saves-List Handler (AC: #6, #7, #8, #9)

- [ ] 6.1 Update `saves-list/handler.ts`: replace `nextToken` with `cursor` in query param handling
- [ ] 6.2 Replace inline `encodeNextToken`/`decodeNextToken` with shared `encodeCursor({ saveId })` / `decodeCursor(cursor).saveId`
- [ ] 6.3 Update response format to use `createSuccessResponse(items, requestId, { meta: { cursor, total }, links: { self, next } })`
- [ ] 6.4 Implement stale cursor graceful degradation: reset to first page, add `X-Cursor-Reset: true` header
- [ ] 6.5 Move `truncated` flag to `meta.truncated` (only present when true)
- [ ] 6.6 Update `saves-list` tests for new cursor format and envelope response shape (AC18)

### Task 7: Retrofit API Keys & Invite Codes Handlers (AC: #10, #11)

- [ ] 7.1 Update `api-keys/handler.ts` list handler to use `createSuccessResponse` with envelope: `{ data: items, meta: { cursor }, links: { self, next } }`
- [ ] 7.2 Update `invite-codes/handler.ts` list handler similarly
- [ ] 7.3 Update handler tests for envelope response shape (AC19)

### Task 8: Align Event History Handler (AC: #12)

- [ ] 8.1 Update `createEventHistoryHandler()` to use `createSuccessResponse` with `meta.cursor` instead of `meta.nextCursor`
- [ ] 8.2 Ensure `queryEntityEvents()` return type uses `cursor` (not `nextCursor`) — or map in handler
- [ ] 8.3 Update event history handler tests (AC19)

### Task 9: Integration & Contract Tests (AC: #20)

- [ ] 9.1 Integration test: saves-list full pagination flow (first page → cursor → next page → last page cursor=null)
- [ ] 9.2 Integration test: API keys list pagination flow
- [ ] 9.3 Integration test: stale cursor reset behavior
- [ ] 9.4 Integration test: cursor from one endpoint rejected by another (opaque, endpoint-specific)
- [ ] 9.5 Verify all existing tests pass

### Task 10: Quality Gates

- [ ] 10.1 Run `npm test` — all tests pass with >=80% coverage on new files
- [ ] 10.2 Run `npm run lint` — no errors
- [ ] 10.3 Run `npm run build` — no TypeScript errors

## Dev Notes

### Architecture Patterns & Constraints

- **ADR-014 (API-First Design):** Cursor-based pagination is the only supported pagination method (FR105). No offset/page-number support. Cursors are opaque tokens — agents must not parse them.
- **ADR-008 (Standardized Error Handling):** Invalid cursors return `VALIDATION_ERROR` with field-level detail per the 3.2.2 error contract.
- **ADR-015 (Lambda Layers):** All new pagination utilities go in existing shared packages, deployed via Lambda Layer.
- **ADR-005 (No Lambda-to-Lambda):** This story is pure shared code and handler updates — no inter-service calls.
- **FR105:** "All list endpoints use cursor-based pagination with opaque cursor tokens. Responses include `next_cursor` (null if last page). Offset/page-number pagination is not supported."
- **3.2.2 Envelope:** Success responses use `{ data, meta: { cursor, total, rateLimit }, links: { self, next } }`. This story populates `meta.cursor` and `links.next`.

### Existing Code to Extend

| Package | File | Changes |
|---------|------|---------|
| `@ai-learning-hub/db` | `src/pagination.ts` (new) | Shared cursor encode/decode, validateCursor, buildPaginatedResponse, constants |
| `@ai-learning-hub/db` | `src/helpers.ts` | Remove inline cursor functions, import from pagination.ts |
| `@ai-learning-hub/db` | `src/index.ts` | Export pagination utilities |
| `@ai-learning-hub/types` | `src/api.ts` | Add CursorPayload, PaginationOptions, update PaginatedResponse |
| `@ai-learning-hub/types` | `src/index.ts` | Export new types |
| `@ai-learning-hub/validation` | `src/schemas.ts` | Update paginationQuerySchema, listSavesQuerySchema (nextToken→cursor) |
| `backend/functions/saves-list` | `handler.ts` | Retrofit to cursor, envelope response, stale cursor handling |
| `backend/functions/api-keys` | `handler.ts` | Envelope response format |
| `backend/functions/invite-codes` | `handler.ts` | Envelope response format |
| `backend/shared/middleware` | `src/handlers/event-history.ts` | Align response to envelope cursor format |

### Current vs Target Response Shapes

**Saves list — BEFORE:**
```json
{
  "data": {
    "items": [{ "saveId": "01HX...", "url": "https://..." }],
    "nextToken": "MDFBUks...",
    "hasMore": true,
    "truncated": false
  }
}
```

**Saves list — AFTER:**
```json
{
  "data": [{ "saveId": "01HX...", "url": "https://..." }],
  "meta": {
    "cursor": "eyJzYXZlSWQiOiIwMUhYLi4uIn0",
    "total": 42
  },
  "links": {
    "self": "/saves?limit=25&contentType=article",
    "next": "/saves?limit=25&contentType=article&cursor=eyJzYXZlSWQiOiIwMUhYLi4uIn0"
  }
}
```

**API keys list — BEFORE:**
```json
{
  "data": {
    "items": [{ "id": "01ARK...", "name": "My Key" }],
    "hasMore": false,
    "nextCursor": null
  }
}
```

**API keys list — AFTER:**
```json
{
  "data": [{ "id": "01ARK...", "name": "My Key" }],
  "meta": {
    "cursor": null
  },
  "links": {
    "self": "/users/api-keys?limit=20"
  }
}
```

### Saves-List In-Memory Pagination — Design Decision

The saves-list handler currently:
1. Fetches up to 1000 items via `queryAllItems()` (all user saves)
2. Filters in memory (contentType, linkStatus, search)
3. Sorts in memory (createdAt, lastAccessedAt, title)
4. Paginates over the in-memory sorted result using a ULID cursor

This approach **cannot** use DynamoDB's native `LastEvaluatedKey` pagination because:
- DynamoDB can't sort by `title` or `lastAccessedAt` without GSIs
- DynamoDB applies `Limit` before `FilterExpression`, making page sizes unpredictable with filters
- In-memory filtering is the simplest approach at boutique scale (<1000 saves per user)

**Decision:** Keep the in-memory approach but standardize the cursor format:
- Cursor encodes `{ saveId: string }` using the shared `encodeCursor()` utility
- The cursor is opaque to consumers — they don't know it's a saveId internally
- Stale cursors (deleted item, changed filters) gracefully reset to page 1

**Future optimization (not in scope):** When users exceed 1000 saves, add GSIs for common sort fields (createdAt, lastAccessedAt) to enable DynamoDB-native pagination. This would be a separate story.

### Cursor Encoding: base64 vs base64url

The existing `queryItems()` uses standard Base64 encoding (`Buffer.toString("base64")`). The new shared utility uses **base64url** (`Buffer.toString("base64url")`) because:
- URL-safe: no `+`, `/`, or `=` characters that need percent-encoding in query strings
- Standard: RFC 4648 Section 5
- Backward compatible: Node.js `Buffer.from(str, "base64url")` accepts both base64 and base64url

**Migration note:** Existing cursors encoded with standard Base64 will decode correctly with `base64url` decoder (Node.js handles both). No migration needed for in-flight pagination sessions.

### Truncated + Null Cursor Interaction

When the saves-list handler hits the 1000-item ceiling (`meta.truncated: true`) but all in-memory pages are exhausted (`meta.cursor: null`), the agent sees: "no more pages, but the result was incomplete." This is NOT a bug — it means the user has >1000 saves and the current filter/sort query can't show them all.

**Agent guidance:** When `meta.truncated === true && meta.cursor === null`, the agent should narrow filters (add `contentType`, `search`, etc.) to reduce the result set below the ceiling. Do NOT retry without filters — the same 1000-item cap will apply.

**Developer guidance:** The `meta.truncated` field is only present when `true`. When `false` or the ceiling was not hit, omit it entirely from the response.

### Stale Cursor Handling Strategy

When a cursor's saveId is not found in the current result set:

| Scenario | Current Behavior | New Behavior |
|----------|-----------------|--------------|
| Item deleted | Error: "cursor expired" | Return first page, `X-Cursor-Reset: true` header |
| Filters changed | Return first page silently | Return first page, `X-Cursor-Reset: true` header |
| Malformed cursor | Error 400 | Error 400 `VALIDATION_ERROR` via `validateCursor()` |

The `X-Cursor-Reset: true` header lets agents detect that their cursor was reset and handle accordingly (e.g., restart their pagination loop).

### Relationship to Other 3.2 Stories

- **3.2.1 (Idempotency):** No dependency.
- **3.2.2 (Error Contract & Envelope):** This story uses the `EnvelopeMeta`, `ResponseLinks`, and `createSuccessResponse` options pattern established in 3.2.2. Direct dependency on the types — they must exist.
- **3.2.3 (Event History):** Event history's `queryEntityEvents()` already returns `nextCursor`. This story aligns the handler response to use the standard envelope format. The cursor utilities in event history can be replaced with the shared ones.
- **3.2.4 (Agent Identity):** No dependency.
- **3.2.7 (Saves Retrofit):** Saves retrofit will build on the pagination changes from this story. It will also add command endpoints, idempotency, etc. — this story handles only the pagination aspect of saves endpoints.

### Scope Boundaries

- **In scope:** Shared cursor utilities, saves-list retrofit to `cursor` param, all list endpoint envelope standardization, stale cursor handling.
- **Not in scope:** Adding DynamoDB GSIs for native pagination of saves. The in-memory approach is preserved.
- **Not in scope:** Changing the `queryAllItems()` ceiling (1000). That's a capacity decision for a future story.
- **Not in scope:** Rate limit metadata in `meta.rateLimit`. That's Story 3.2.4's responsibility.
- **Not in scope:** Full saves domain retrofit (CQRS, idempotency, concurrency, event recording). That's Story 3.2.7.
- **Not in scope:** Command pattern endpoints. Only list (GET) endpoints are affected.

### Testing Standards

- **Framework:** Vitest (used across all shared packages)
- **Coverage target:** 90% for new code (above the 80% CI gate)
- **Test location:** Co-located `test/` directories in each shared package, handler tests alongside handlers
- **Mock pattern:** Use `vi.mock()` for DynamoDB client, following existing patterns in `backend/shared/db/test/`
- **Test factories:** Use existing `backend/test-utils/` mock helpers (save-factories, mock-events)

### Key Technical Decisions

1. **base64url encoding (not base64):** URL-safe without percent-encoding. Node.js `Buffer` supports both natively. Backward compatible with existing base64 cursors.
2. **Saves cursor wraps saveId in object:** `encodeCursor({ saveId })` not `encodeCursor(saveId)`. This matches the `LastEvaluatedKey` pattern (always an object with key attributes) and allows future extension (e.g., adding sort position).
3. **`hasMore` removed from response:** Per FR105, `next_cursor` being null indicates the last page. `hasMore` is redundant. The cursor's presence/absence is the canonical signal.
4. **Stale cursor returns first page (not error):** Agents shouldn't crash when their cursor becomes stale due to concurrent mutations. Graceful reset with a signal header is more resilient than a 400 error.
5. **Single `paginationQuerySchema`:** All list endpoints share the same base schema for `limit` + `cursor`. Endpoint-specific filters extend it. Prevents drift.
6. **`links.next` includes all current query params:** When building `links.next`, preserve all current filter/sort params and add/replace the `cursor` param. This lets agents follow the `next` link directly without reconstructing queries. **CRITICAL: Build links from Zod-validated/parsed params, NOT from raw `event.queryStringParameters`.** This ensures links contain only sanitized, validated values — preventing reflected injection if links are ever rendered.
7. **`meta.total` is optional:** Only populated when the handler knows the total count (e.g., saves-list knows it after in-memory filtering). DynamoDB-native pagination endpoints (api-keys, invite-codes) don't know the total and omit it.

### Project Structure Notes

- All new code goes into existing shared packages — no new packages created
- No new CDK changes — no new tables, no infrastructure changes
- No new npm dependencies — uses built-in `Buffer` for base64url encoding
- File changes span `backend/shared/db/`, `backend/shared/types/`, `backend/shared/validation/`, `backend/shared/middleware/`, and `backend/functions/` (saves-list, api-keys, invite-codes)

### Previous Story Intelligence

**Story 3.2.1 (Idempotency & Concurrency):**
- Pattern for extending `WrapperOptions`
- Pattern for response headers added by middleware (`X-Idempotent-Replayed`)
- DynamoDB conditional write patterns

**Story 3.2.2 (Error Contract & Envelope):**
- `EnvelopeMeta` type: `{ cursor?: string | null, total?: number, rateLimit?: RateLimitMeta }`
- `ResponseLinks` type: `{ self: string, next?: string | null }`
- `createSuccessResponse(data, requestId, { statusCode?, meta?, links? })` options pattern
- `VALIDATION_ERROR` with `{ fields: [...] }` for validation errors
- All handlers return raw data, middleware wraps in `{ data, meta?, links? }`

**Story 3.2.3 (Event History):**
- `queryEntityEvents()` returns `{ events, nextCursor }` — needs alignment to `{ data, meta: { cursor } }`
- Cursor encode/decode already implemented inline (base64url) — replace with shared utility
- `createEventHistoryHandler()` generator pattern — update response building

### Git Intelligence

Recent commits (Epic 3.2):
- `b564aa4` feat: Event History Infrastructure (Story 3.2.3) #229 — established cursor pattern in events
- `1582a6f` feat: Consistent Error Contract & Response Envelope (Story 3.2.2) #227 — established envelope types
- `9d17f52` feat: Idempotency & Optimistic Concurrency Middleware (Story 3.2.1) — established middleware extension patterns

The event history story (3.2.3) implemented cursor helpers inline in `events.ts`. This story should extract those into the shared `pagination.ts` and have `events.ts` import from there.

### Anti-Patterns to Avoid

- **Do NOT add DynamoDB GSIs for pagination.** In-memory pagination is sufficient at boutique scale. GSIs are a future optimization.
- **Do NOT change the `queryAllItems()` ceiling of 1000.** That's a separate capacity concern.
- **Do NOT make cursors endpoint-specific with embedded endpoint IDs.** Cursors are already inherently endpoint-specific because they encode endpoint-specific key structures. Adding explicit endpoint IDs would bloat the cursor.
- **Do NOT implement offset/page-number pagination as a fallback.** FR105 explicitly prohibits it.
- **Do NOT return `hasMore: true/false` alongside cursor.** Cursor nullness is the canonical signal per FR105. Returning both creates ambiguity.
- **Do NOT parse cursors on the client side.** They are opaque by design. Tests should verify that decoding a cursor on the client produces unusable data (or at minimum, that the format is not documented).
- **Do NOT use `console.log`.** Use `@ai-learning-hub/logging` structured logger.
- **Do NOT derive partition keys from cursor values for `KeyConditionExpression`.** Always use the authenticated user's ID from auth context (`ctx.userId`). The cursor's `ExclusiveStartKey` only controls pagination position within the query — DynamoDB validates it against the `KeyConditionExpression`. Using cursor-derived PKs would allow cross-user data access via tampered cursors.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#FR105] — Cursor-based pagination requirement
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-014] — API-First Design, consistent pagination
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3.2] — Story 3.2.5 definition and dependencies
- [Source: backend/shared/db/src/helpers.ts] — Existing queryItems() with inline cursor encode/decode
- [Source: backend/shared/db/src/query-all.ts] — queryAllItems() used by saves-list
- [Source: backend/shared/db/src/events.ts] — queryEntityEvents() cursor pattern from 3.2.3
- [Source: backend/shared/types/src/api.ts] — EnvelopeMeta, ResponseLinks, PaginatedResponse types from 3.2.2
- [Source: backend/shared/validation/src/schemas.ts] — paginationQuerySchema, listSavesQuerySchema
- [Source: backend/shared/middleware/src/error-handler.ts] — createSuccessResponse options pattern from 3.2.2
- [Source: backend/functions/saves-list/handler.ts] — Current saves-list with nextToken in-memory pagination
- [Source: backend/functions/api-keys/handler.ts] — API keys list with queryItems cursor pagination
- [Source: backend/functions/invite-codes/handler.ts] — Invite codes list with queryItems cursor pagination
- [Source: backend/shared/middleware/src/handlers/event-history.ts] — Event history handler from 3.2.3

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
