---
id: "3.2.6"
title: "Scoped API Key Permissions"
status: ready-for-dev
depends_on: []
touches:
  - backend/shared/validation/src/schemas.ts
  - backend/shared/middleware/src/auth.ts
  - backend/shared/middleware/src/scope-resolver.ts
  - backend/shared/middleware/src/wrapper.ts
  - backend/shared/middleware/src/index.ts
  - backend/shared/types/src/api.ts
  - backend/shared/types/src/index.ts
  - backend/functions/api-keys/schemas.ts
  - backend/functions/api-keys/handler.ts
  - backend/functions/api-key-authorizer/handler.ts
  - backend/test-utils/mock-wrapper.ts
risk: medium
---

# Story 3.2.6: Scoped API Key Permissions

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer building agent-native API endpoints**,
I want **the API key system extended to support 5 named permission tiers (`full`, `capture`, `read`, `saves:write`, `projects:write`) with a hierarchical scope resolver that maps tiers to granular operation permissions, and a `SCOPE_INSUFFICIENT` error response that tells agents exactly what scope they need and what they have**,
so that **API keys can be precisely scoped to their use case (iOS Shortcut gets `capture`, analytics bots get `read`, learning scout agents get `saves:write`), the middleware enforces these boundaries consistently, and agents get machine-actionable 403 responses that let them request the correct key instead of retrying blindly**.

## Acceptance Criteria

### Scope Tier Model (FR7, Epic 3.2 description)

1. **AC1: Five named permission tiers** — The `apiKeyScopeSchema` in `@ai-learning-hub/validation` is updated to accept these values: `"full"`, `"capture"`, `"read"`, `"saves:write"`, `"projects:write"`. The legacy wildcard `"*"` remains valid as a backward-compatible alias for `"full"`. The legacy `"saves:read"` remains valid as a backward-compatible alias equivalent to specifying `"read"` (it resolves to the same read-only grant for saves). New keys should use the named tiers; legacy values continue to work indefinitely (no migration needed).

2. **AC2: Tier-to-operation resolution map** — A new `scope-resolver.ts` module in `@ai-learning-hub/middleware` exports a `SCOPE_GRANTS` constant and a `resolveScopeGrants(grantedScopes: string[]): Set<string>` function. The grants map defines which operation permissions each tier provides:

   | Tier (granted) | Operations resolved |
   |---|---|
   | `full` | `*` (wildcard — satisfies any required scope) |
   | `*` | `*` (wildcard — backward-compatible alias for `full`) |
   | `capture` | `saves:create` |
   | `read` | `saves:read`, `projects:read`, `links:read`, `users:read`, `keys:read` |
   | `saves:read` | `saves:read` (legacy — backward-compatible) |
   | `saves:write` | `saves:read`, `saves:write`, `saves:create`, `links:read`, `links:write` |
   | `projects:write` | `projects:read`, `projects:write` |

   Unrecognized scope strings passed through as-is (direct grants). Multiple tiers combine additively — `["capture", "read"]` resolves to `saves:create` + all read operations.

3. **AC3: Scope check uses hierarchical resolution** — The `requireScope(auth, requiredScope)` function in `auth.ts` is updated to use `resolveScopeGrants(auth.scopes)` instead of simple `includes("*") || includes(requiredScope)`. The inline scope check in `wrapHandler` (`wrapper.ts`, lines 199-213) is similarly updated. Behavior for JWT auth is unchanged — JWT bypasses scope check entirely (all scopes implicitly granted).

4. **AC4: Combined tiers** — A key can be created with multiple tiers (e.g., `["saves:write", "projects:write"]`). The resolved permissions are the union of all tier grants. This allows fine-grained combinations like "read+write saves AND projects" without needing `full`.

### Error Response Enhancement (Epic 3.2 description)

5. **AC5: SCOPE_INSUFFICIENT error includes required and granted scopes** — When scope check fails, the `SCOPE_INSUFFICIENT` (403) error response includes `details: { required_scope: string, granted_scopes: string[] }` where `required_scope` is the operation scope the endpoint requires (e.g., `"saves:write"`) and `granted_scopes` is the raw array of tiers on the key (e.g., `["capture", "read"]`). This gives agents machine-actionable information to request the correct key. The existing `keyScopes` detail field is renamed to `granted_scopes` for consistency with the PRD naming.

6. **AC6: Error response includes allowed_actions** — The `SCOPE_INSUFFICIENT` error includes `allowed_actions: ["request-api-key-with-scope"]` so agents know they can resolve the issue by requesting a new key with the correct scope. This follows the 3.2.2 error contract pattern (`currentState` + `allowedActions`).

### API Key Creation Update

7. **AC7: Create key with named tiers** — `POST /users/api-keys` accepts `scopes` containing any combination of the 5 named tiers. The `createApiKeyBodySchema` uses the updated `apiKeyScopesSchema`. Invalid scope values return `400 VALIDATION_ERROR` with field-level detail per ADR-008.

8. **AC8: Tier description in key listing** — `GET /users/api-keys` response includes the raw `scopes` array as stored. No runtime resolution is exposed in the listing — the granted tiers are sufficient for human and agent understanding. The `scopes` field already exists in the `toPublicApiKey()` response shape.

### Backward Compatibility

9. **AC9: Existing keys with `*` continue working** — Keys created before this story with `scopes: ["*"]` continue to have full access. The `*` scope resolves to the wildcard grant, same as `full`. No data migration is required.

10. **AC10: Existing keys with `saves:write` continue working** — Keys with `scopes: ["saves:write"]` continue to grant saves read, write, create, and links read/write — the same permissions they had before (via direct string matching) plus the new hierarchical grants.

11. **AC11: Existing keys with `saves:read` continue working** — Keys with `scopes: ["saves:read"]` continue to grant saves read access. The scope is recognized as a legacy direct grant.

12. **AC12: Normalize `*` to `full` on key creation** — The `apiKeyScopesSchema` Zod transform normalizes `"*"` to `"full"` during key creation validation. New keys always store `"full"` instead of `"*"`. Existing keys in DynamoDB with `["*"]` are NOT migrated — they continue working via the `SCOPE_GRANTS` map. This gradual convergence means all new keys use canonical tier names while old keys phase out naturally as users rotate keys. The normalization is transparent — API consumers sending `"*"` see `"full"` in the stored key's scopes listing.

13. **AC13: Keys:manage scope unchanged** — The `requiredScope: "keys:manage"` on the api-keys handler continues to require `full` or `*` (the only tiers that resolve to wildcard). This is intentional — API key management should only be available to fully-scoped keys.

### Authorizer Alignment

14. **AC14: Authorizer passes scopes correctly** — The API key authorizer in `api-key-authorizer/handler.ts` already passes `scopes: JSON.stringify(apiKeyItem.scopes)` in the authorizer context. No change needed — the scopes are the raw tier names, and resolution happens in the middleware. Verify this works correctly with the new tier names.

### Type Safety & Exports

15. **AC15: ApiKeyScope type** — A new `ApiKeyScope` type union is exported from `@ai-learning-hub/types`: `"full" | "capture" | "read" | "saves:write" | "projects:write" | "*" | "saves:read"` (includes legacy values). The `AuthContext.scopes` field type is updated to `ApiKeyScope[]` (currently `string[]`).

16. **AC16: OperationScope type** — A new `OperationScope` type is exported from `@ai-learning-hub/types` representing the granular operation permissions that handlers require: `"saves:read" | "saves:write" | "saves:create" | "projects:read" | "projects:write" | "links:read" | "links:write" | "users:read" | "users:write" | "keys:read" | "keys:manage"`. The `WrapperOptions.requiredScope` field type is updated from `string` to `OperationScope`.

17. **AC17: Exports** — `resolveScopeGrants`, `checkScopeAccess`, `SCOPE_GRANTS` exported from `@ai-learning-hub/middleware`. `ApiKeyScope`, `OperationScope` exported from `@ai-learning-hub/types`. Updated `apiKeyScopeSchema` and `apiKeyScopesSchema` exported from `@ai-learning-hub/validation`.

### Testing

18. **AC18: Unit tests — scope resolver** — Tests cover: `full` grants everything, `*` grants everything (backward compat), `capture` grants only `saves:create`, `read` grants all read operations (saves, projects, links, users, keys), `saves:write` grants saves and links read+write+create, `projects:write` grants projects read+write, combined tiers resolve additively (`["capture", "read"]` → saves:create + all reads), `saves:read` legacy backward compat, unrecognized scopes pass through as direct grants. Minimum 90% coverage.

19. **AC19: Unit tests — requireScope with hierarchy** — Tests cover: `full` scope satisfies any required scope, `capture` scope satisfies `saves:create` but rejects `saves:read`, `read` scope satisfies `saves:read` but rejects `saves:write`, `saves:write` satisfies `saves:read` (implicit read from write), combined tiers work, JWT auth bypasses scope check, missing scopes array treated as empty, `SCOPE_INSUFFICIENT` error includes `required_scope` and `granted_scopes` and `allowed_actions`. Minimum 90% coverage.

20. **AC20: Unit tests — Zod schema validation** — Tests cover: all 5 named tiers accepted, `*` accepted (backward compat), `saves:read` accepted (backward compat), invalid scope rejected (e.g., `"admin"`, `"delete:all"`), array deduplication works, minimum 1 scope required, combined tiers accepted (e.g., `["saves:write", "projects:write"]`).

21. **AC21: Integration tests** — Full wrapHandler chain with scope enforcement: API key with `capture` scope can `POST /saves` (requiredScope: `saves:create`) but rejected from `GET /saves` (requiredScope: `saves:read`). API key with `read` scope can `GET /saves` but rejected from `POST /saves`. API key with `full` can do anything. Backward compat: `*` scope still works everywhere.

## Tasks / Subtasks

### Task 1: Scope Types (AC: #15, #16, #17)

- [ ] 1.1 Add `ApiKeyScope` type to `@ai-learning-hub/types/src/api.ts`: `"full" | "capture" | "read" | "saves:write" | "projects:write" | "*" | "saves:read"`
- [ ] 1.2 Add `OperationScope` type to `@ai-learning-hub/types/src/api.ts`: `"saves:read" | "saves:write" | "saves:create" | "projects:read" | "projects:write" | "links:read" | "links:write" | "users:read" | "users:write" | "keys:read" | "keys:manage"`
- [ ] 1.3 Update `AuthContext.scopes` from `string[]` to `ApiKeyScope[]`
- [ ] 1.4 Export new types from `@ai-learning-hub/types/src/index.ts`

### Task 2: Update Validation Schema (AC: #1, #7, #12, #17)

- [ ] 2.1 Update `apiKeyScopeSchema` in `backend/shared/validation/src/schemas.ts` from `z.enum(["*", "saves:write", "saves:read"])` to `z.enum(["full", "capture", "read", "saves:write", "projects:write", "*", "saves:read"])`
- [ ] 2.2 Add a `.transform()` to `apiKeyScopesSchema` that normalizes `"*"` to `"full"` before deduplication (AC12): `.transform((scopes) => Array.from(new Set(scopes.map(s => s === '*' ? 'full' : s))))`
- [ ] 2.3 Verify `apiKeyScopesSchema` (array with dedup) still works with expanded enum
- [ ] 2.4 Update any JSDoc comments describing valid scope values
- [ ] 2.5 Write Zod schema tests including `*` → `full` normalization (AC20)

### Task 3: Scope Resolver Module (AC: #2, #17)

- [ ] 3.1 Create `backend/shared/middleware/src/scope-resolver.ts`
- [ ] 3.2 Define `SCOPE_GRANTS` constant mapping each tier to its granted operation set
- [ ] 3.3 Implement `resolveScopeGrants(grantedScopes: string[]): Set<string>` — iterates granted scopes, looks up in SCOPE_GRANTS, combines results; unrecognized scopes added as-is (direct grants)
- [ ] 3.4 Implement `checkScopeAccess(grantedScopes: string[], requiredScope: string): boolean` — resolves grants then checks for `*` wildcard or direct match
- [ ] 3.5 Export from `backend/shared/middleware/src/index.ts`
- [ ] 3.6 Write unit tests in `backend/shared/middleware/test/scope-resolver.test.ts` (AC18)

### Task 4: Update requireScope in auth.ts (AC: #3, #5, #6)

- [ ] 4.1 Import `checkScopeAccess` from `./scope-resolver.js` in `auth.ts`
- [ ] 4.2 Update `requireScope()` to use `checkScopeAccess(scopes, requiredScope)` instead of `scopes.includes("*") || scopes.includes(requiredScope)`
- [ ] 4.3 Update `SCOPE_INSUFFICIENT` error details: rename `keyScopes` to `granted_scopes`, keep `requiredScope` as `required_scope`
- [ ] 4.4 Add `allowed_actions: ["request-api-key-with-scope"]` to the error details
- [ ] 4.5 Write unit tests for updated requireScope (AC19)

### Task 5: Update wrapHandler Scope Check (AC: #3)

- [ ] 5.1 Import `checkScopeAccess` from `./scope-resolver.js` in `wrapper.ts`
- [ ] 5.2 Update the inline scope check (lines 199-213) to use `checkScopeAccess(scopes, options.requiredScope)` instead of `!scopes.includes("*") && !scopes.includes(options.requiredScope)`
- [ ] 5.3 Update error details in the inline throw to match the updated `requireScope()` format (`required_scope`, `granted_scopes`, `allowed_actions`)
- [ ] 5.4 Optionally update `WrapperOptions.requiredScope` type from `string` to `OperationScope` (imported from types)
- [ ] 5.5 Verify all existing wrapper tests pass

### Task 6: Update API Key Creation Handler (AC: #7, #8)

- [ ] 6.1 Verify `api-keys/schemas.ts` `createApiKeyBodySchema` uses the shared `apiKeyScopesSchema` — it does, so the schema update in Task 2 automatically flows through
- [ ] 6.2 Verify `api-keys/handler.ts` stores `scopes` from the body directly to DynamoDB — it does, no change needed
- [ ] 6.3 Verify `GET /users/api-keys` response includes `scopes` in the listing — it does via the existing item projection
- [ ] 6.4 Update handler tests to include test cases with new tier values

### Task 7: Verify Authorizer (AC: #14)

- [ ] 7.1 Read `api-key-authorizer/handler.ts` and verify `scopes: JSON.stringify(apiKeyItem.scopes)` passes through correctly for new tier names — it does, no change needed
- [ ] 7.2 Verify `extractAuthContext` in `auth.ts` deserializes the scopes JSON array correctly for new tier names — it does (generic JSON parse), no change needed
- [ ] 7.3 Add authorizer test cases with new tier values to confirm no issues

### Task 8: Update Test Utilities (AC: #9, #10, #11)

- [ ] 8.1 Update `createMockHandlerContext` in `backend/test-utils/mock-wrapper.ts` to accept `scopes` as `ApiKeyScope[]` in the override options
- [ ] 8.2 Add helper function `createApiKeyAuth(scopes: ApiKeyScope[]): AuthContext` for easier test setup
- [ ] 8.3 Verify all existing tests pass with the type narrowing from `string[]` to `ApiKeyScope[]`

### Task 9: Integration Tests (AC: #21)

- [ ] 9.1 Integration test: `capture` key satisfies `saves:create` required scope
- [ ] 9.2 Integration test: `capture` key rejected for `saves:read` required scope → 403 with correct error details
- [ ] 9.3 Integration test: `read` key satisfies `saves:read` required scope
- [ ] 9.4 Integration test: `read` key rejected for `saves:write` required scope
- [ ] 9.5 Integration test: `saves:write` key satisfies both `saves:read` and `saves:write`
- [ ] 9.6 Integration test: `full` key satisfies any required scope
- [ ] 9.7 Integration test: `*` key satisfies any required scope (backward compat)
- [ ] 9.8 Integration test: combined `["saves:write", "projects:write"]` satisfies both domain scopes
- [ ] 9.9 Integration test: error response includes `required_scope`, `granted_scopes`, `allowed_actions`
- [ ] 9.10 Verify all existing tests pass

### Task 10: Quality Gates

- [ ] 10.1 Run `npm test` — all tests pass with >=80% coverage on new files
- [ ] 10.2 Run `npm run lint` — no errors
- [ ] 10.3 Run `npm run build` — no TypeScript errors

## Dev Notes

### Architecture Patterns & Constraints

- **ADR-013 (Authentication):** API keys store scopes as `string[]`. JWT auth bypasses scope checks entirely (all scopes implicitly granted). This story does NOT change the authorizer Lambda — scope resolution happens in `wrapHandler` middleware.
- **ADR-008 (Standardized Error Handling):** `SCOPE_INSUFFICIENT` error (403) already exists. This story enhances the error details to include `required_scope`, `granted_scopes`, and `allowed_actions` per the 3.2.2 error contract.
- **ADR-014 (API-First Design):** Scoped permissions enable least-privilege API keys for agents. This is a foundational requirement for the agent-native API.
- **ADR-015 (Lambda Layers):** All new code goes in existing shared packages, deployed via Lambda Layer.
- **FR7:** "Users can generate capture-only API keys (limited to POST /saves only)." The `capture` tier fulfills this FR.
- **3.2.2 Error Contract:** SCOPE_INSUFFICIENT uses `allowed_actions` to guide agents toward resolution.

### Existing Code to Modify

| Package | File | Changes |
|---------|------|---------|
| `@ai-learning-hub/types` | `src/api.ts` | Add `ApiKeyScope`, `OperationScope` types; update `AuthContext.scopes` type |
| `@ai-learning-hub/types` | `src/index.ts` | Export new types |
| `@ai-learning-hub/validation` | `src/schemas.ts` | Expand `apiKeyScopeSchema` enum values |
| `@ai-learning-hub/middleware` | `src/scope-resolver.ts` (new) | `SCOPE_GRANTS`, `resolveScopeGrants()`, `checkScopeAccess()` |
| `@ai-learning-hub/middleware` | `src/auth.ts` | Update `requireScope()` to use `checkScopeAccess()` |
| `@ai-learning-hub/middleware` | `src/wrapper.ts` | Update inline scope check to use `checkScopeAccess()` |
| `@ai-learning-hub/middleware` | `src/index.ts` | Export scope resolver |
| `backend/functions/api-keys` | `handler.test.ts` | Add tests with new tier values |
| `backend/test-utils` | `mock-wrapper.ts` | Update scope types |

### New Files

| File | Package | Purpose |
|------|---------|---------|
| `backend/shared/middleware/src/scope-resolver.ts` | `@ai-learning-hub/middleware` | Scope tier resolution logic |
| `backend/shared/middleware/test/scope-resolver.test.ts` | `@ai-learning-hub/middleware` | Scope resolver unit tests |

### Scope Resolution Design

**Current implementation (simple string matching):**

```typescript
// In auth.ts
const hasWildcard = scopes.includes("*");
const hasScope = scopes.includes(requiredScope);
if (!hasWildcard && !hasScope) { throw ... }

// In wrapper.ts (lines 199-213)
if (!scopes.includes("*") && !scopes.includes(options.requiredScope)) { throw ... }
```

**After this story (hierarchical resolution):**

```typescript
// In scope-resolver.ts
export const SCOPE_GRANTS: Record<string, readonly string[]> = {
  'full': ['*'],
  '*': ['*'],
  'capture': ['saves:create'],
  'read': ['saves:read', 'projects:read', 'links:read', 'users:read', 'keys:read'],
  'saves:read': ['saves:read'],  // Legacy — intentionally narrower than 'read' tier. Do NOT expand.
  'saves:write': ['saves:read', 'saves:write', 'saves:create', 'links:read', 'links:write'],
  'projects:write': ['projects:read', 'projects:write'],
};

export function resolveScopeGrants(grantedScopes: string[]): Set<string> {
  const resolved = new Set<string>();
  for (const scope of grantedScopes) {
    const grants = SCOPE_GRANTS[scope];
    if (grants) {
      for (const g of grants) resolved.add(g);
    } else {
      resolved.add(scope);  // Unrecognized scope passes through as direct grant
    }
  }
  return resolved;
}

export function checkScopeAccess(grantedScopes: string[], requiredScope: string): boolean {
  const resolved = resolveScopeGrants(grantedScopes);
  return resolved.has('*') || resolved.has(requiredScope);
}
```

**Usage in auth.ts (after refactor):**

```typescript
export function requireScope(auth: AuthContext, requiredScope: string): void {
  if (!auth.isApiKey) return;  // JWT has all scopes

  const scopes = auth.scopes ?? [];
  if (!checkScopeAccess(scopes, requiredScope)) {
    throw new AppError(
      ErrorCode.SCOPE_INSUFFICIENT,
      `API key lacks required scope: ${requiredScope}`,
      {
        required_scope: requiredScope,
        granted_scopes: scopes,
        allowedActions: ['request-api-key-with-scope'],
      }
    );
  }
}
```

**Usage in wrapper.ts (after refactor):**

```typescript
// Replace lines 199-213 with:
if (options.requiredScope && auth.isApiKey) {
  const scopes = auth.scopes ?? [];
  if (!checkScopeAccess(scopes, options.requiredScope)) {
    throw new AppError(
      ErrorCode.SCOPE_INSUFFICIENT,
      `API key lacks required scope: ${options.requiredScope}`,
      {
        required_scope: options.requiredScope,
        granted_scopes: scopes,
        allowedActions: ['request-api-key-with-scope'],
      }
    );
  }
}
```

### Error Response Examples

**403 SCOPE_INSUFFICIENT (capture key trying to read saves):**

```json
{
  "error": {
    "code": "SCOPE_INSUFFICIENT",
    "message": "API key lacks required scope: saves:read",
    "requestId": "req-550e8400-e29b",
    "details": {
      "required_scope": "saves:read",
      "granted_scopes": ["capture"]
    },
    "allowedActions": ["request-api-key-with-scope"]
  }
}
```

**403 SCOPE_INSUFFICIENT (read key trying to create saves):**

```json
{
  "error": {
    "code": "SCOPE_INSUFFICIENT",
    "message": "API key lacks required scope: saves:create",
    "requestId": "req-661f9511-c38a",
    "details": {
      "required_scope": "saves:create",
      "granted_scopes": ["read"]
    },
    "allowedActions": ["request-api-key-with-scope"]
  }
}
```

### Tier Description Table (for developer reference)

| Tier | Use Case | Grants | Does NOT grant |
|------|----------|--------|----------------|
| `full` | Dev persona, trusted agents | Everything (wildcard) | — |
| `capture` | iOS Shortcut, simple bots | `saves:create` only | reads, updates, deletes, projects, keys |
| `read` | Analytics agents, read-only | `saves:read`, `projects:read`, `links:read`, `users:read`, `keys:read` | any write/create/delete |
| `saves:write` | Learning scout agents | `saves:read`, `saves:write`, `saves:create`, `links:read`, `links:write` | projects, keys:manage |
| `projects:write` | Project management bots | `projects:read`, `projects:write` | saves, links, keys:manage |

**Combination examples:**

| Key scopes | Effective permissions |
|---|---|
| `["full"]` | Everything |
| `["capture"]` | POST /saves only |
| `["read"]` | All GET endpoints |
| `["saves:write"]` | Saves + links CRUD |
| `["saves:write", "projects:write"]` | Saves + links + projects CRUD |
| `["capture", "read"]` | POST /saves + all GET endpoints |
| `["*"]` | Everything (backward compat for `full`) |

### Handler Required Scopes (for future retrofit reference)

This story builds the scope resolution infrastructure. Handlers will declare their `requiredScope` in Stories 3.2.7 (saves retrofit) and 3.2.8 (auth retrofit). For reference, the expected required scopes per endpoint:

| Endpoint | HTTP Method | Required Scope | Satisfied by tiers |
|----------|-------------|----------------|-------------------|
| `/saves` | POST | `saves:create` | `full`, `capture`, `saves:write` |
| `/saves` | GET | `saves:read` | `full`, `read`, `saves:write` |
| `/saves/:id` | GET | `saves:read` | `full`, `read`, `saves:write` |
| `/saves/:id` | PATCH | `saves:write` | `full`, `saves:write` |
| `/saves/:id` | DELETE | `saves:write` | `full`, `saves:write` |
| `/saves/:id/restore` | POST | `saves:write` | `full`, `saves:write` |
| `/saves/:id/events` | GET | `saves:read` | `full`, `read`, `saves:write` |
| `/users/api-keys` | POST/GET/DELETE | `keys:manage` | `full` only |
| `/users/invite-codes` | POST/GET | `keys:manage` | `full` only |
| `/users/me` | GET | `users:read` | `full`, `read` |
| `/users/me` | PATCH | `users:write` | `full` only |

**Note:** The actual `requiredScope` values on handlers are NOT changed in this story. Only the api-keys handler currently uses `requiredScope: "keys:manage"`. Other handlers will get their `requiredScope` in 3.2.7/3.2.8 retrofit stories.

### Data Model — No Migration Needed

The `ApiKeyItem.scopes` field in DynamoDB stores raw scope strings as `string[]`. The new tier names are just new valid string values. No data migration is needed:

- Existing `["*"]` → `SCOPE_GRANTS["*"]` → wildcard (unchanged behavior)
- Existing `["saves:write"]` → `SCOPE_GRANTS["saves:write"]` → expanded resolution but same effective access for current endpoints
- Existing `["saves:read"]` → `SCOPE_GRANTS["saves:read"]` → `saves:read` only (unchanged behavior)
- New `["capture"]` → `SCOPE_GRANTS["capture"]` → `saves:create` only
- New `["full"]` → `SCOPE_GRANTS["full"]` → wildcard

### Rate Limit Differentiation (Future — NOT in this story)

The PRD defines different rate limits per tier:

| Tier | Read Limit | Write Limit |
|------|-----------|-------------|
| `full` | 100/min | 100/min |
| `capture` | 100/min | 20/min |
| `read` | 200/min | 0/min |
| scoped write | 100/min | 50/min |

This will be wired in Stories 3.2.7/3.2.8 using the `RateLimitMiddlewareConfig.limit` function that receives `auth` context (Story 3.2.4 infrastructure). Example:

```typescript
rateLimit: {
  operation: 'saves-write',
  windowSeconds: 60,
  limit: (auth) => {
    const scopes = auth?.scopes ?? [];
    if (scopes.includes('capture')) return 20;
    if (scopes.includes('full') || scopes.includes('*')) return 100;
    return 50; // scoped write default
  },
}
```

This story builds the scope model; 3.2.7/3.2.8 wire it into rate limiting.

### Relationship to Other 3.2 Stories

- **3.2.1 (Idempotency):** No dependency. Scope check runs before idempotency check in the middleware chain.
- **3.2.2 (Error Contract):** `SCOPE_INSUFFICIENT` error uses the enhanced error contract pattern (`allowedActions`). Direct dependency on `AppError.build()` or standard `AppError` constructor with details.
- **3.2.3 (Event History):** No dependency. Event history records `actorType` and `agentId` from 3.2.4, not scopes.
- **3.2.4 (Agent Identity):** No dependency. Agent identity extraction runs before scope check in the middleware chain. The `RateLimitMiddlewareConfig.limit` function can read scopes from `auth.scopes` once this story expands the scope model.
- **3.2.5 (Cursor Pagination):** No dependency.
- **3.2.7 (Saves Retrofit):** Will add `requiredScope` to all saves handlers, using the scope resolution infrastructure from this story. Will also wire scope-based rate limits.
- **3.2.8 (Auth Retrofit):** Will add `requiredScope` to auth handlers and wire scope-based rate limits.

### Scope Boundaries

- **In scope:** Scope tier model, resolution logic, schema updates, error enhancement, type safety, backward compatibility for `*` and `saves:read`.
- **Not in scope:** Adding `requiredScope` to saves/auth handlers (3.2.7/3.2.8). Rate limit differentiation by tier (3.2.7/3.2.8). Scope-based rate limit functions (3.2.7/3.2.8). UI for selecting scopes at key creation (future frontend story).
- **Not in scope:** API key expiration. The `expiresAt` field on `ApiKeyItem` is not used in V1 (revocation-only invalidation).
- **Not in scope:** Per-agent rate limiting based on `X-Agent-ID`. Rate limit identifier is `userId`, not `agentId`.

### Middleware Chain Order (after this story)

```
Request → Extract Auth → Check Role → Check Scope (UPDATED: hierarchical)
        → Extract Agent Identity → Check Rate Limit
        → Check Idempotency Cache → Extract If-Match
        → Execute Handler
        → Store Idempotency Result → Add Rate Limit Headers → Add X-Agent-ID Echo
        → Return Response
```

The scope check position is unchanged — it runs after auth extraction and role check, before agent identity and rate limiting.

### Testing Strategy

**Unit tests (Vitest):**

1. **scope-resolver.test.ts** — Pure function tests, no mocks needed:
   - Each tier resolves to its expected operations
   - `full` and `*` both resolve to wildcard
   - Combined tiers produce union of grants
   - `saves:read` legacy backward compat
   - Unrecognized scopes pass through as direct grants
   - Empty scopes array → empty resolved set
   - `checkScopeAccess` with wildcard grant satisfies any required scope
   - `checkScopeAccess` with specific grant matches specific requirement

2. **auth.test.ts updates** — Test `requireScope()` with new hierarchical resolution:
   - All existing `requireScope` tests should still pass (behavior preserved for `*` and direct matches)
   - New tests for tier-based resolution
   - Error response shape verification (`required_scope`, `granted_scopes`, `allowed_actions`)

3. **wrapper.test.ts updates** — Test inline scope check uses hierarchical resolution:
   - Existing scope tests preserved
   - New tests for tier-based enforcement in wrapHandler

4. **schemas.test.ts** — Zod schema validation for expanded enum:
   - All 7 valid values accepted
   - Invalid values rejected
   - Array deduplication works with new values

**Integration tests:**

- Full middleware chain with different tier combinations
- Backward compatibility with `*` and `saves:read`
- Error response format verification

### Anti-Patterns to Avoid

- **Do NOT store resolved operation scopes in DynamoDB.** Store tier names only. Resolution happens at runtime in middleware. This keeps the data model simple and allows changing the resolution logic without data migration.
- **Do NOT change the API key authorizer Lambda.** Scope resolution is a middleware concern, not an authorizer concern. The authorizer passes raw scopes through, and `wrapHandler` resolves them.
- **Do NOT add `requiredScope` to saves or auth handlers in this story.** That's 3.2.7 and 3.2.8. This story only updates the resolution logic and existing handler scope checks.
- **Do NOT create a new shared package.** All code goes in existing packages.
- **Do NOT use `console.log`.** Use `@ai-learning-hub/logging` structured logger.
- **Do NOT duplicate the scope check.** Both `requireScope()` in auth.ts and the inline check in wrapper.ts should use the same `checkScopeAccess()` function. DRY.
- **Do NOT make the SCOPE_GRANTS map dynamic or configurable.** It's a static constant. Changing it requires a code change, which is intentional — scope semantics should be explicit and version-controlled.
- **Treat `SCOPE_GRANTS` changes as security-sensitive code reviews.** Modifying the grants map effectively changes permissions for ALL existing keys that use the affected tiers. For example, adding `tags:write` to the `saves:write` tier immediately grants that operation to every existing `saves:write` key. This is by design (avoids data migrations), but changes must be reviewed with the same rigor as IAM policy changes.
- **Do NOT remove the `*` scope from the enum.** It must remain for backward compatibility with existing keys.
- **Do NOT change `requiredScope: "keys:manage"` on the api-keys handler to use a tier name.** `keys:manage` is an operation scope (what the handler requires), not a tier (what the key grants). The tier `full` satisfies `keys:manage` because `full` resolves to `*` (wildcard).

### Project Structure Notes

- All new code goes into existing shared packages — no new packages created
- No CDK changes — no new tables, no infrastructure changes
- No new npm dependencies
- The `scope-resolver.ts` module follows the same pattern as `agent-identity.ts`, `idempotency.ts`, `concurrency.ts` — a standalone module in `@ai-learning-hub/middleware` with pure functions and a clear single responsibility

### Previous Story Intelligence

**Story 3.2.1 (Idempotency & Concurrency):**
- Pattern for adding middleware modules (new file in middleware/src, export from index)
- Pattern for extending `WrapperOptions`
- Fail-open philosophy for non-critical middleware
- Test structure: unit tests in `middleware/test/`, integration tests testing the full chain

**Story 3.2.2 (Error Contract & Envelope):**
- `AppError` with `details` object pattern
- `allowedActions` promotion in `toApiError()` method
- Error response includes `currentState` and `allowedActions` at top level (not inside `details`)
- Use `AppError.build().withDetails({...}).create()` for enhanced errors, or standard constructor

**Story 3.2.4 (Agent Identity & Rate Limit Transparency):**
- `extractAgentIdentity()` always-on pattern (no opt-in flag)
- Rate limit middleware opt-in via `WrapperOptions.rateLimit`
- `RateLimitMiddlewareConfig.limit` accepts function `(auth: AuthContext | null) => number` for tier-based limits — will use scopes from this story

**Story 3.2.5 (Cursor Pagination):**
- Response envelope pattern `{ data, meta, links }`
- Schema extension pattern (extend base schema with endpoint-specific params)

### Git Intelligence

Recent commits (Epic 3.2):
- `581c708` refactor: clean up deferred review findings for Story 3.2.5
- `d740d02` feat: Cursor-Based Pagination (Story 3.2.5) #235
- `c76a438` feat: Agent Identity, Context & Rate Limit Transparency (Story 3.2.4) (#234)
- `9d17f52` feat: Idempotency & Optimistic Concurrency Middleware (Story 3.2.1) (#226)

The middleware pattern from PR #226 (idempotency) and PR #234 (agent identity) is the closest precedent for this story's scope-resolver module. Follow the same file organization, export pattern, and test structure.

### Key Technical Decisions

1. **Hierarchical scope resolution (not flat string matching):** The current `scopes.includes(requiredScope)` approach doesn't support the tier concept where `saves:write` implicitly grants `saves:read`. The `SCOPE_GRANTS` map + `resolveScopeGrants()` function enables hierarchical resolution while keeping the logic explicit and testable.

2. **Tier names stored in DynamoDB (not resolved operations):** Storing raw tier names (`["capture"]`) rather than resolved operations (`["saves:create"]`) means the resolution logic can evolve without data migration. If we later add `saves:delete` as a separate operation under `saves:write`, existing keys automatically gain it.

3. **`*` normalized to `full` on write, retained on read:** New keys sending `"*"` are normalized to `"full"` via a Zod transform during creation. Existing keys in DynamoDB with `["*"]` are NOT migrated — they continue working because `SCOPE_GRANTS["*"]` resolves to the wildcard grant. This gradual convergence means new keys always use canonical names while old keys phase out as users rotate them.

4. **`saves:read` retained as legacy scope (intentionally narrower than `read`):** Existing keys with `["saves:read"]` resolve to `saves:read` ONLY — they do NOT grant `links:read`, `projects:read`, `users:read`, or `keys:read`. The new `read` tier is deliberately broader (cross-domain reads). Do NOT expand `saves:read` grants in SCOPE_GRANTS — legacy keys with `saves:read` should upgrade to the `read` tier if they need cross-domain read access. No migration needed.

5. **`SCOPE_GRANTS` as a static constant (not DynamoDB configuration):** Scope semantics are a critical security boundary. Making them configurable via DynamoDB would introduce a risk where a misconfigured row could grant unintended access. A static constant ensures scope semantics are code-reviewed and version-controlled.

6. **Unrecognized scopes pass through as direct grants:** This forward-compatibility mechanism allows adding new scopes (e.g., `analytics:read`) to the `apiKeyScopeSchema` without immediately updating `SCOPE_GRANTS`. The new scope works as a direct match until a tier mapping is added.

7. **Error includes `allowed_actions: ["request-api-key-with-scope"]`:** Per the 3.2.2 error contract, errors should guide agents toward resolution. A `SCOPE_INSUFFICIENT` error means the agent needs a different key — the `allowed_actions` makes this explicit.

8. **`OperationScope` type for handler declarations:** Handlers declare `requiredScope: OperationScope` (e.g., `"saves:create"`) rather than tier names. This separation between "what the endpoint requires" (operation scope) and "what the key grants" (tier) keeps the model clean and extensible.

### References

- [Source: _bmad-output/planning-artifacts/prd.md — FR7: Capture-only API keys]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-013: Authentication Provider, API key scopes]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-008: Standardized Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture.md — ADR-014: API-First Design, rate limit by key type]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3.2, Story 3.2.6 description]
- [Source: backend/shared/middleware/src/auth.ts — requireScope() current implementation]
- [Source: backend/shared/middleware/src/wrapper.ts — inline scope check, WrapperOptions, HandlerContext]
- [Source: backend/shared/validation/src/schemas.ts — apiKeyScopeSchema, apiKeyScopesSchema]
- [Source: backend/shared/types/src/api.ts — AuthContext, ApiKeyScope type location]
- [Source: backend/shared/types/src/errors.ts — ErrorCode.SCOPE_INSUFFICIENT]
- [Source: backend/functions/api-keys/schemas.ts — createApiKeyBodySchema uses apiKeyScopesSchema]
- [Source: backend/functions/api-keys/handler.ts — requiredScope: "keys:manage"]
- [Source: backend/functions/api-key-authorizer/handler.ts — scopes serialization in authorizer context]
- [Source: backend/shared/db/src/users.ts — ApiKeyItem interface, scopes field]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
