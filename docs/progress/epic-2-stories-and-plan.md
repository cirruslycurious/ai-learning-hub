# Epic 2: User Authentication & API Keys — Stories and Implementation Plan

**Date:** 2026-02-14  
**Source:** PRD FR1–FR9, ADR-013, Implementation Readiness Report (ADR-013)  
**NFRs:** NFR-S3, NFR-S4, NFR-S8, NFR-S9

---

## Epic Goal

Users can sign up, sign in, and generate API keys for programmatic access. Invite-only access is enforced server-side.

**User Outcome:** Users have accounts, can authenticate via web (JWT) or API key (Shortcut/agents), and manage their access credentials. Invite-only access is controlled via codes.

---

## Story Dependency Order

```
2.1 JWT Authorizer  ──►  2.2 API Key Authorizer  ──►  2.3 Scope Middleware
         │                        │                            │
         ├────────────────────────┼────────────────────────────┤
         │                        │                            │
         ▼                        ▼                            ▼
    2.4 Invite Validation    2.5 User Profile    2.6 API Key CRUD
         │                        │                            │
         └────────────────────────┴────────────────────────────┘
                                 │
                                 ▼
            2.7 Rate Limiting  +  2.8 Auth Error Codes
                                 │
                                 ▼
                    2.9 Invite Code Generation
```

**Rationale:** 2.1 establishes web auth; 2.2 enables API key auth; 2.3 enforces scopes; 2.4 gates access; 2.5–2.6 provide self-service profile and keys; 2.7–2.8 harden; 2.9 enables invite sharing.

---

## Story 2.1: Clerk Integration + JWT Authorizer

**As a** web app user,  
**I want** to sign in with Google and have my identity validated on every API request,  
**so that** I can access my data securely and the system provisions my profile on first use.

### Acceptance Criteria

| #   | Given                                                      | When                                     | Then                                                                                                                                                                  |
| --- | ---------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | A valid Clerk JWT in `Authorization: Bearer <token>`       | The JWT authorizer runs                  | It validates the token via `@clerk/backend` `verifyToken()`, extracts `sub` and `publicMetadata`                                                                      |
| AC2 | JWT is valid and `publicMetadata.inviteValidated === true` | Authorizer runs                          | It returns IAM Allow policy with `userId`, `role`, `authMethod: 'jwt'` in context                                                                                     |
| AC3 | JWT is valid but `publicMetadata.inviteValidated !== true` | Authorizer runs                          | It returns IAM Deny with error code `INVITE_REQUIRED`; API Gateway returns 403                                                                                        |
| AC4 | No PROFILE exists for `USER#<clerkId>`                     | First authenticated request after signup | Authorizer calls `ensureProfile(sub, publicMetadata)` — conditional PutItem with `attribute_not_exists(PK)`; PROFILE created with email, displayName, role from Clerk |
| AC5 | PROFILE exists                                             | Subsequent requests                      | Authorizer does GetItem only (no PutItem); fast path                                                                                                                  |
| AC6 | PROFILE has `suspendedAt` set                              | Authorizer runs                          | It returns IAM Deny with `SUSPENDED_ACCOUNT`; API Gateway returns 403                                                                                                 |
| AC7 | JWT is expired or invalid                                  | Authorizer runs                          | It throws; API Gateway returns 401                                                                                                                                    |
| AC8 | —                                                          | —                                        | Authorizer cache TTL is 300 seconds (configurable)                                                                                                                    |
| AC9 | —                                                          | —                                        | All Lambdas use `@ai-learning-hub/logging`; API keys never logged (NFR-S8)                                                                                            |

### Technical Notes

- **ensureProfile signature:** `ensureProfile(clerkId: string, publicMetadata: { email?: string; displayName?: string; role?: string })` → DynamoDB PutItem with ConditionExpression `attribute_not_exists(PK)`
- **deny() helper:** Returns `{ policyDocument: Deny, context: { errorCode: string } }`; API Gateway maps to 403
- **Tables:** `users` table (PK: `USER#<clerkId>`, SK: `PROFILE`) — must exist from Epic 1

### FRs Covered

FR1, FR2, FR3 (Clerk handles sign up/sign in/sign out; authorizer enforces access)

### NFRs Covered

NFR-S4 (per-user isolation via userId in context), NFR-S8 (no key logging)

---

## Story 2.2: API Key Authorizer

**As a** developer or iOS Shortcut user,  
**I want** to authenticate with an API key in the `x-api-key` header,  
**so that** I can call the API without a browser session.

### Acceptance Criteria

| #   | Given                                     | When                    | Then                                                                                     |
| --- | ----------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| AC1 | Valid API key in `x-api-key` header       | API Key authorizer runs | It hashes key with SHA-256, queries `apiKeyHash-index` GSI on `users` table              |
| AC2 | APIKEY item found and `revokedAt` is null | Authorizer runs         | It fetches PROFILE via GetItem `USER#<clerkId>` SK `PROFILE`; checks `suspendedAt`       |
| AC3 | PROFILE not suspended                     | Authorizer runs         | It returns IAM Allow with `userId`, `role`, `scopes`, `authMethod: 'api-key'` in context |
| AC4 | PROFILE has `suspendedAt` set             | Authorizer runs         | It returns IAM Deny with `SUSPENDED_ACCOUNT`                                             |
| AC5 | Key not found or `revokedAt` set          | Authorizer runs         | It throws; API Gateway returns 401                                                       |
| AC6 | —                                         | After successful auth   | Authorizer fires-and-forgets `updateApiKeyLastUsed(keyHash)` (non-blocking)              |

### Technical Notes

- **Two-query pattern:** Query 1 → GSI by keyHash → APIKEY item (clerkId, scopes, revokedAt); Query 2 → GetItem PROFILE
- **Scope values:** `['*']` = full access; `['saves:write']` = capture-only (FR7) — passed in context for Story 2.3
- **GSI:** `apiKeyHash-index` on `users` table (PK: keyHash) — must exist from Epic 1

### FRs Covered

FR5 (API key auth path)

### NFRs Covered

NFR-S3 (key hashed, not stored plain), NFR-S4, NFR-S8

---

## Story 2.3: Scope Middleware

**As a** system,  
**I want** to enforce API key scopes on protected endpoints,  
**so that** capture-only keys can only call POST /saves (FR7).

### Acceptance Criteria

| #   | Given                                        | When                                                         | Then                                                                                    |
| --- | -------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| AC1 | Request uses API key auth                    | `requireScope('saves:write')` middleware runs on POST /saves | Request allowed if scopes include `*` or `saves:write`                                  |
| AC2 | Request uses API key with only `saves:write` | `requireScope('*')` or any non-saves:write scope             | Middleware returns 403 `SCOPE_INSUFFICIENT`                                             |
| AC3 | Request uses JWT auth                        | Any scope check                                              | Middleware bypasses (JWT = full access)                                                 |
| AC4 | —                                            | —                                                            | `requireScope()` lives in `@ai-learning-hub/middleware`; scopes from authorizer context |

### Technical Notes

- **Depends on:** 2.2 (authorizer passes scopes in context)
- **Scope values:** `['*']` = full access; `['saves:write']` = capture-only

### FRs Covered

FR7 (capture-only API keys)

### NFRs Covered

—

---

## Story 2.4: Invite Validation Endpoint

**As a** new user with an invite code,  
**I want** to validate my invite code during signup,  
**so that** I can access the app after creating my Clerk account.

### Acceptance Criteria

| #   | Given                                                    | When                                                                               | Then                                                                                                                                                                                               |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User has Clerk account (signed up) but not yet validated | User calls `POST /auth/validate-invite` with valid JWT and body `{ code: string }` | Endpoint validates JWT, looks up code in `invite-codes` table                                                                                                                                      |
| AC2 | Code exists, not redeemed, not expired, not revoked      | Validation succeeds                                                                | Endpoint: (1) conditional UpdateItem marks code redeemed (redeemedBy, redeemedAt); (2) calls Clerk Backend API to set `publicMetadata.inviteValidated = true`; (3) returns 200 `{ success: true }` |
| AC3 | Code invalid, expired, or already redeemed               | Validation fails                                                                   | Returns 400 `{ code: 'INVALID_INVITE_CODE', message: '...' }`                                                                                                                                      |
| AC4 | User not authenticated                                   | Request has no/invalid JWT                                                         | Returns 401                                                                                                                                                                                        |
| AC5 | —                                                        | —                                                                                  | Rate limit: 5 invite validations per IP per hour (auth-specific limit)                                                                                                                             |
| AC6 | Clerk Backend API fails after DynamoDB redemption        | Error handling                                                                     | Log error; return 500; consider idempotency (code already redeemed = success)                                                                                                                      |
| AC7 | Existing user with validated invite                      | User calls endpoint                                                                | Idempotent: if already validated, return 200                                                                                                                                                       |

### Technical Notes

- **Request body:** `{ code: string }` — code format: 8–16 alphanumeric chars (128-bit entropy)
- **Clerk API:** `users.updateUserMetadata(userId, { publicMetadata: { inviteValidated: true } })`
- **Table:** `invite-codes` (PK: `CODE#<code>`, SK: `META`) — attributes: generatedBy, generatedAt, redeemedBy?, redeemedAt?, expiresAt?, isRevoked
- **Idempotency:** If Clerk update fails after DynamoDB redemption, code is consumed; retry could re-call Clerk (user already has inviteValidated from first attempt if partial success)

### FRs Covered

FR8 (redeem invite codes during signup)

### NFRs Covered

NFR-S9 (rate limit on invite validation)

---

## Story 2.5: User Profile

**As a** signed-in user,  
**I want** to view and edit my profile,  
**so that** I can customize my display name and preferences.

### Acceptance Criteria

| #   | Given                               | When                                                               | Then                                                         |
| --- | ----------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| AC1 | User authenticated (JWT or API key) | `GET /users/me`                                                    | Returns profile: email, displayName, role, globalPreferences |
| AC2 | User authenticated                  | `PATCH /users/me` with body `{ displayName?, globalPreferences? }` | Updates PROFILE; returns updated profile                     |
| AC3 | —                                   | —                                                                  | All endpoints use `@ai-learning-hub/middleware` for auth     |

### Technical Notes

- **Table:** `users` (PK: `USER#<clerkId>`, SK: `PROFILE`)
- **Depends on:** 2.1 (JWT), 2.2 (API key with `*` scope)

### FRs Covered

FR4 (view and edit profile)

### NFRs Covered

—

---

## Story 2.6: API Key CRUD

**As a** signed-in user,  
**I want** to create, list, and revoke API keys,  
**so that** I can use them for Shortcut/agents and revoke compromised keys.

### Acceptance Criteria

| #   | Given                               | When                                                                               | Then                                                                                                                        |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User authenticated (JWT or API key) | `POST /users/api-keys` with body `{ name, scopes }` (scopes: `*` or `saves:write`) | Generates 256-bit random key; stores SHA-256 hash; returns `{ id, name, key, scopes, createdAt }` — **key shown only once** |
| AC2 | User authenticated                  | `GET /users/api-keys`                                                              | Returns list: `{ id, name, scopes, createdAt, lastUsedAt }` — **key value never returned**                                  |
| AC3 | User authenticated                  | `DELETE /users/api-keys/:id`                                                       | Sets `revokedAt` on APIKEY item; key immediately invalid                                                                    |
| AC4 | User creates capture-only key       | `POST /users/api-keys` with `scopes: ['saves:write']`                              | Creates key with saves:write only (FR7)                                                                                     |
| AC5 | —                                   | —                                                                                  | Rate limit: 10 key generations per user per hour                                                                            |
| AC6 | Invalid scopes in request body      | Validation                                                                         | Returns 400 validation error                                                                                                |

### Technical Notes

- **Key generation:** `crypto.randomBytes(32).toString('base64url')` or equivalent; SHA-256 hash for storage
- **API key SK:** `APIKEY#<keyId>` where keyId is ULID
- **GSI:** apiKeyHash-index for auth lookup

### FRs Covered

FR5 (generate API keys), FR6 (revoke keys), FR7 (capture-only keys)

### NFRs Covered

NFR-S3 (hash only), NFR-S8 (keys never in logs)

---

## Story 2.7: Rate Limiting

**As a** system operator,  
**I want** rate limiting on API requests,  
**so that** abuse is prevented.

### Acceptance Criteria

| #   | Given                | When              | Then                                                                                                                                                                 |
| --- | -------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | —                    | —                 | Layer 1: API Gateway throttling 100 req/s; WAF rate-based rule 500 req/5min per IP                                                                                   |
| AC2 | —                    | —                 | Layer 2: Application middleware with DynamoDB counters — per-user, per-API-key; read/write split (100 read/min, 100 write/min full; 100 read, 20 write capture-only) |
| AC3 | Client exceeds limit | Request processed | Returns 429 `{ code: 'RATE_LIMITED', message: '...', retryAfter?: number }`                                                                                          |
| AC4 | —                    | —                 | Auth-specific limits: 5 invite validations/IP/hour, 10 key gens/user/hour (enforced in respective endpoints)                                                         |

### Technical Notes

- **DynamoDB counters:** Use `users` table or dedicated rate-limit table; increment with conditional update; TTL or sliding window per design
- **Retry-After:** Include in 429 response when applicable

### FRs Covered

—

### NFRs Covered

NFR-S9 (rate limit abuse protection)

---

## Story 2.8: Auth Error Codes

**As a** client developer,  
**I want** consistent auth error responses,  
**so that** I can handle errors correctly (retry, re-auth, etc.).

### Acceptance Criteria

| #   | Given                     | When        | Then                                                                                                                                              |
| --- | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | —                         | —           | Auth error responses use ADR-008 format: `{ code, message }`                                                                                      |
| AC2 | —                         | —           | Codes: EXPIRED_TOKEN, INVALID_API_KEY, REVOKED_API_KEY, SUSPENDED_ACCOUNT, SCOPE_INSUFFICIENT, INVITE_REQUIRED, INVALID_INVITE_CODE, RATE_LIMITED |
| AC3 | Authorizer denies         | API Gateway | Maps to 401 or 403 as per ADR-013 table                                                                                                           |
| AC4 | Middleware denies (scope) | Response    | Returns 403 with `SCOPE_INSUFFICIENT`                                                                                                             |
| AC5 | Middleware denies (rate)  | Response    | Returns 429 with `RATE_LIMITED`                                                                                                                   |

### Technical Notes

- **ADR-008:** Standardized error shape across all endpoints
- **ADR-013:** Auth-specific code table with HTTP mapping

### FRs Covered

—

### NFRs Covered

—

---

## Story 2.9: Invite Code Generation

**As an** existing user,  
**I want** to generate invite codes to share with colleagues,  
**so that** they can sign up and join the platform.

### Acceptance Criteria

| #   | Given                                    | When                                            | Then                                                                                                                                               |
| --- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | User authenticated with validated invite | `POST /users/invite-codes` (or `/invite-codes`) | Generates code (128-bit entropy); stores in `invite-codes` with generatedBy, generatedAt, expiresAt (e.g. 7 days)                                  |
| AC2 | —                                        | Code generated                                  | Returns `{ code, expiresAt }` — code shown only once                                                                                               |
| AC3 | User authenticated                       | `GET /users/invite-codes`                       | Returns list of user's generated codes (via GSI generatedBy-index): code (masked after redemption), status (unused/used), generatedAt, redeemedAt? |
| AC4 | —                                        | —                                               | Code format: URL-safe, 8–16 chars; one-time use                                                                                                    |
| AC5 | —                                        | —                                               | Rate limit: e.g. 5 codes per user per day (configurable)                                                                                           |

### Technical Notes

- **Table:** invite-codes (PK: CODE#<code>, SK: META)
- **GSI:** generatedBy-index (PK: generatedBy)
- **Admin:** Separate admin endpoints for listing/revoking codes (Epic 10)

### FRs Covered

FR9 (existing users generate invite codes)

---

## Implementation Plan Summary

| Order | Story | Focus                  | Est. Complexity | Dependencies                |
| ----- | ----- | ---------------------- | --------------- | --------------------------- |
| 1     | 2.1   | JWT authorizer         | High            | Epic 1 (users table, infra) |
| 2     | 2.2   | API key authorizer     | High            | 2.1, users table + GSI      |
| 3     | 2.3   | Scope middleware       | Low             | 2.2                         |
| 4     | 2.4   | Invite validation      | Medium          | 2.1, invite-codes table     |
| 5     | 2.5   | User profile           | Low             | 2.1, 2.2                    |
| 6     | 2.6   | API key CRUD           | Medium          | 2.1, 2.2                    |
| 7     | 2.7   | Rate limiting          | Medium          | 2.1–2.6                     |
| 8     | 2.8   | Auth error codes       | Low             | 2.1–2.7                     |
| 9     | 2.9   | Invite code generation | Low             | 2.4, 2.5                    |

### Recommended Sprint Split

- **Sprint A (Auth core):** 2.1, 2.2, 2.3 — Web + API key auth + scope enforcement
- **Sprint B (Invite + Profile + Keys):** 2.4, 2.5, 2.6 — Full signup flow + self-service profile and keys
- **Sprint C (Hardening):** 2.7, 2.8, 2.9 — Rate limits, error codes, invite generation

### Test Requirements

- **2.1:** Unit tests for authorizer (mock Clerk verify, DynamoDB); integration: valid JWT → 200, invalid → 401, unvalidated invite → 403
- **2.2:** Unit tests for API key authorizer; integration: valid key → 200, revoked key → 401
- **2.3:** Integration: capture-only key on POST /saves → 200, on GET /projects → 403; JWT bypasses scope
- **2.4:** Integration: valid code → 200 + Clerk metadata updated; invalid code → 400; rate limit → 429
- **2.5:** Integration: GET/PATCH /users/me
- **2.6:** Integration: create/list/revoke keys; capture-only key creation
- **2.7:** Integration: 429 when rate exceeded
- **2.8:** Integration: error code format validation across auth paths
- **2.9:** Integration: generate code, list codes, redeem flow E2E

### Files to Create/Modify

| Story | New Files                                                                             | Modified                           |
| ----- | ------------------------------------------------------------------------------------- | ---------------------------------- |
| 2.1   | `backend/functions/jwt-authorizer/`, `shared/db/users.ts` (ensureProfile, getProfile) | CDK auth stack, API Gateway config |
| 2.2   | `backend/functions/api-key-authorizer/`                                               | CDK, API Gateway                   |
| 2.3   | `shared/middleware/requireScope.ts`                                                   | API handlers                       |
| 2.4   | `backend/functions/validate-invite/`                                                  | CDK, routes                        |
| 2.5   | `backend/functions/users-me/`                                                         | CDK, routes                        |
| 2.6   | `backend/functions/api-keys/`                                                         | CDK, routes                        |
| 2.7   | `shared/middleware/rateLimit.ts`                                                      | All API handlers                   |
| 2.8   | `shared/middleware/` (error response helpers)                                         | Authorizers, middleware            |
| 2.9   | `backend/functions/invite-codes/` (user-facing)                                       | CDK, routes                        |

---

## FR Coverage Checklist

| FR  | Story    | Description                                |
| --- | -------- | ------------------------------------------ |
| FR1 | 2.1      | Sign up with social auth (Clerk)           |
| FR2 | 2.1      | Sign in with social auth                   |
| FR3 | 2.1      | Sign out from all devices (Clerk sessions) |
| FR4 | 2.5      | View and edit profile                      |
| FR5 | 2.2, 2.6 | Generate API keys                          |
| FR6 | 2.6      | Revoke API keys                            |
| FR7 | 2.3, 2.6 | Capture-only API keys                      |
| FR8 | 2.4      | Redeem invite codes during signup          |
| FR9 | 2.9      | Generate invite codes                      |

---

_Generated for Epic 2 story planning. Merge into `_bmad-output/planning-artifacts/epics.md` when approved._
