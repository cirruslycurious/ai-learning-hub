---
id: "3.2.8"
title: "Auth Domain Retrofit"
status: ready-for-dev
depends_on:
  - "3.2.1"
  - "3.2.2"
  - "3.2.3"
  - "3.2.4"
  - "3.2.6"
touches:
  - backend/functions/api-keys/handler.ts
  - backend/functions/api-keys/schemas.ts
  - backend/functions/users-me/handler.ts
  - backend/functions/invite-codes/handler.ts
  - backend/functions/invite-codes/schemas.ts
  - backend/functions/validate-invite/handler.ts
  - backend/shared/middleware/src/action-registrations.ts
  - backend/shared/validation/src/schemas.ts
  - backend/shared/types/src/entities.ts
  - infra/lib/stacks/api/auth-routes.stack.ts
risk: medium
---

# Story 3.2.8: Auth Domain Retrofit

Status: ready-for-dev

## Story

As a **developer building agent-native API endpoints**,
I want **response envelope, error contract, agent identity tracking, scoped permissions, rate limit transparency, and command pattern with idempotency applied to all auth domain handlers (api-keys, users-me, invite-codes, validate-invite)**,
so that **AI agents interacting with auth endpoints get the same consistent experience as saves — transparent rate limits, idempotent retries, conflict detection on profile updates, granular scope enforcement, and context metadata in the audit trail — completing the agent-native retrofit across both existing domains before future epics inherit these patterns automatically**.

## Acceptance Criteria

1. **AC1: Response envelope on users-me GET** — `GET /users/me` wraps the profile object in the standard `{ data, meta, links }` envelope. The `data` field contains the full profile (`userId`, `email`, `displayName`, `role`, `globalPreferences`, `createdAt`, `updatedAt`, `version`). `links.self` is `/users/me`. Previously returned a raw object without wrapping.

2. **AC2: Response envelope on users-me PATCH** — `PATCH /users/me` wraps the updated profile in `{ data, meta, links }`. The `data` field includes the updated profile with incremented `version`. Previously returned a raw object without wrapping.

3. **AC3: Response envelope on validate-invite** — `POST /auth/validate-invite` wraps the result in `{ data: { valid: true, code, redeemedAt } }` instead of the current `{ success: true }`. Error cases (invalid/expired/already-redeemed) use the standard error contract.

4. **AC4: Idempotency on API key creation** — `POST /users/api-keys` uses `idempotent: true` in `wrapHandler` options. Duplicate requests with the same `Idempotency-Key` replay the cached 201 response. Requests without `Idempotency-Key` receive `400 VALIDATION_ERROR`.

5. **AC5: Command endpoint for API key revocation** — A new `POST /users/api-keys/:apiKeyId/revoke` route is wired in API Gateway to the **same Lambda function** as `DELETE /users/api-keys/:apiKeyId`. Both routes execute identical revocation logic. The POST route follows the CQRS-lite command convention (path-segment style, matching 3.2.7's `/update-metadata` pattern) — agents should prefer it over DELETE for explicit command semantics. CDK wires both routes to the same function.

6. **AC6: Idempotency on API key revocation** — Both `DELETE /users/api-keys/:apiKeyId` and `POST /users/api-keys/:apiKeyId/revoke` use `idempotent: true`. Retried revocations with the same `Idempotency-Key` replay the cached 204 response. `Idempotency-Key` header is required.

7. **AC7: Idempotency on profile update** — `PATCH /users/me` and `POST /users/me/update` (AC9) use `idempotent: true`. Retried updates with the same `Idempotency-Key` replay the cached 200 response.

8. **AC8: Version field on user profiles** — User profiles include `version: number`. Profile creation sets `version: 1`. The `PATCH /users/me` handler uses `requireVersion: true` in `wrapHandler` — the `If-Match` header is required and carries the expected version. DynamoDB update uses condition expression `version = :expectedVersion`. On mismatch, returns `409 VERSION_CONFLICT` with `{ currentVersion: <actual> }` in error details. On success, `version` is incremented. **Greenfield note:** No existing profiles in DynamoDB — all new profiles get `version: 1` at creation. No migration needed.

9. **AC9: Command endpoint for profile update** — A new `POST /users/me/update` route is wired in API Gateway to the **same Lambda function** as `PATCH /users/me`. Both routes accept the same body schema and require `Idempotency-Key` and `If-Match` headers. CDK wires both routes to the same function. Uses path-segment style (`/update`) matching 3.2.7's `/update-metadata` convention.

10. **AC10: Idempotency on invite code generation** — `POST /users/invite-codes` uses `idempotent: true` in `wrapHandler` options. Duplicate requests with the same `Idempotency-Key` replay the cached 201 response. The existing manual `enforceRateLimit()` call is removed — rate limiting moves to `wrapHandler` options (AC13).

11. **AC11: Idempotency on invite validation** — `POST /auth/validate-invite` uses `idempotent: true`. Duplicate validations with the same `Idempotency-Key` replay the cached response. The existing application-level idempotency check (`redeemedBy` guard) remains as business logic — `wrapHandler` idempotency provides the transport-level dedup layer on top.

12. **AC12: Rate limiting via wrapHandler** — All mutation handlers use the `rateLimit` config in `wrapHandler` options instead of calling `enforceRateLimit()` directly. This ensures rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) and `meta.rateLimit` are automatically added to ALL responses (success and error). Manual `enforceRateLimit()` calls are removed from handler bodies. Rate limit configurations:
    - API key creation: 10/user/hour (existing limit preserved)
    - Invite code generation: 5/user/day (existing limit preserved)
    - Invite code validation: 5/user/hour (existing limit preserved, `identifierSource: "userId"` — endpoint requires auth so userId is always available; sourceIp is unreliable behind NATs/VPNs)
    - Profile update: 30/user/hour (new)

13. **AC13: Scope-based rate limits** — The `rateLimit.limit` field uses a function `(auth) => number` for API key creation and invite generation. JWT (web) users get default limits. API key tiers get differentiated limits: `full`/`*` keys get generous limits, other scoped keys get moderate limits. Read endpoints (GET) do not have rate limiting in V1.

14. **AC14: Correct requiredScope on all handlers** — Each handler declares the proper `requiredScope`:

    | Endpoint | Method | requiredScope |
    |----------|--------|---------------|
    | `/users/api-keys` | POST | `keys:manage` |
    | `/users/api-keys` | GET | `keys:read` |
    | `/users/api-keys/:apiKeyId` | DELETE | `keys:manage` |
    | `/users/api-keys/:apiKeyId/revoke` | POST | `keys:manage` |
    | `/users/me` | GET | `users:read` |
    | `/users/me` | PATCH | `users:write` |
    | `/users/me/update` | POST | `users:write` |
    | `/users/invite-codes` | POST | `invites:manage` |
    | `/users/invite-codes` | GET | `invites:manage` |
    | `/auth/validate-invite` | POST | (no scope — requires auth only) |

    **Note:** `GET /users/me` adds `requiredScope: "users:read"` — previously had no scope enforcement. `PATCH /users/me` adds `requiredScope: "users:write"`. The scope resolver (3.2.6) already includes `users:read` in the `read` tier and should be verified to include `users:write` in appropriate tiers.

    **Validate-invite scope rationale:** `POST /auth/validate-invite` intentionally has no `requiredScope` — it requires authentication only. This endpoint is called during the signup/onboarding flow before any API keys exist, so scope enforcement would block the primary use case. The `redeemedBy` guard provides application-level protection (each code redeemable once). If future requirements need tighter control, add a dedicated `invites:validate` scope.

15. **AC15: Context metadata on mutations** — All mutation request bodies accept an optional `context` field (same `eventContextSchema` from 3.2.7): `{ trigger?: string, source?: string, confidence?: number, upstream_ref?: string }`. Context flows into event recording. Schemas for `createApiKeyBody`, `updateProfileBody`, and `createInviteCodeBody` are extended with the optional `context` field.

16. **AC16: Event recording on API key mutations** — After successful API key creation, `recordEvent()` is called with `entityType: "apiKey"`, `entityId` set to the newly generated key ID, `eventType: "ApiKeyCreated"`, `actorType`/`actorId` from context, and `changes: { after: { name, scopes, createdAt } }`. After successful revocation, `recordEvent()` with `entityType: "apiKey"`, `entityId` set to the `apiKeyId` path parameter, `eventType: "ApiKeyRevoked"`. Recording is fire-and-forget (try/catch, log WARN on failure).

17. **AC17: Event recording on profile updates** — After successful profile update, `recordEvent()` is called with `entityType: "userProfile"`, `eventType: "ProfileUpdated"`, field-level `changes: { changedFields, before, after }` showing only modified fields, and `context` from the request body. Uses pre-read + ALL_NEW pattern from 3.2.7.

18. **AC18: Event recording on invite operations** — After successful invite code generation, `recordEvent()` with `entityType: "inviteCode"`, `eventType: "InviteCodeGenerated"`. After successful invite validation/redemption, `recordEvent()` with `eventType: "InviteCodeRedeemed"`. Recording is fire-and-forget.

19. **AC19: Auth domain action registrations** — All auth domain actions are registered in `action-registrations.ts` with action ID, description, HTTP method, URL pattern, input schema, required headers (`Idempotency-Key`, `If-Match` where applicable), required scope, and expected error codes. Single-resource GET responses for `/users/me` include `meta.actions[]` listing available operations.

20. **AC20: CDK infrastructure wiring** — CDK auth route stacks are updated to: (a) wire new command endpoints (`POST /users/api-keys/:apiKeyId/revoke`, `POST /users/me/update`) to existing Lambda functions using path-segment style (matching 3.2.7's `/update-metadata`), (b) grant mutation Lambdas `Write` access to `idempotencyTable` and `eventsTable`, (c) pass `IDEMPOTENCY_TABLE_NAME` and `EVENTS_TABLE_NAME` environment variables to all mutation Lambdas.

21. **AC21: Unit test coverage** — All retrofitted handlers have tests covering: idempotency replay, version conflict (profile), rate limit headers in response, scope enforcement, event recording calls, context metadata pass-through, and envelope shape. Minimum 80% line coverage per handler.

## Tasks / Subtasks

**Task ordering note:** Task 1 (shared prep) must complete first. Tasks 2-6 can be done in parallel — handler retrofits and CDK wiring are independent. Unit tests mock all infrastructure, so CDK wiring is not a prerequisite for handler tests. Task 7 (action registrations) can run in parallel with 2-6. Task 8 (final validation) runs last after all changes.

- [ ] Task 1: Shared infrastructure prep (AC: 8, 14, 15)
  - [ ] 1.1 Add `version: number` to user profile type in `entities.ts`
  - [ ] 1.2 Verify scope resolver includes `users:read`, `users:write`, `keys:read` in appropriate tiers; add if missing
  - [ ] 1.3 Extend `createApiKeyBodySchema`, `updateProfileBodySchema`, `createInviteCodeBodySchema` with optional `context` field using `eventContextSchema`
  - [ ] 1.4 Define `authWriteRateLimit` config with scope-based dynamic limits

- [ ] Task 2: Users-me handler retrofit (AC: 1, 2, 7, 8, 9, 12, 17)
  - [ ] 2.1 Wrap GET response in `createSuccessResponse()` envelope with `links.self`
  - [ ] 2.2 Add `requireVersion: true` and `idempotent: true` to PATCH wrapHandler options
  - [ ] 2.3 Implement pre-read + ALL_NEW pattern for PATCH with version condition
  - [ ] 2.4 Add event recording on profile update (fire-and-forget)
  - [ ] 2.5 Remove any manual `enforceRateLimit()` calls, add `rateLimit` to wrapHandler
  - [ ] 2.6 Add `requiredScope: "users:read"` to GET, `requiredScope: "users:write"` to PATCH
  - [ ] 2.7 Write/update unit tests for envelope, idempotency, version conflict, events

- [ ] Task 3: API keys handler retrofit (AC: 4, 5, 6, 12, 16)
  - [ ] 3.1 Add `idempotent: true` to POST wrapHandler options
  - [ ] 3.2 Add `idempotent: true` to DELETE wrapHandler options
  - [ ] 3.3 Remove manual `enforceRateLimit()` call, add `rateLimit` to wrapHandler options
  - [ ] 3.4 Add event recording on create and revoke (fire-and-forget)
  - [ ] 3.5 Accept `context` field in POST body schema
  - [ ] 3.6 Write/update unit tests for idempotency, rate limit headers, events

- [ ] Task 4: Invite codes handler retrofit (AC: 10, 12, 18)
  - [ ] 4.1 Add `idempotent: true` to POST wrapHandler options
  - [ ] 4.2 Remove manual `enforceRateLimit()` call, add `rateLimit` to wrapHandler options
  - [ ] 4.3 Add event recording on invite generation (fire-and-forget)
  - [ ] 4.4 Accept `context` field in POST body schema
  - [ ] 4.5 Write/update unit tests

- [ ] Task 5: Validate-invite handler retrofit (AC: 3, 11, 12, 18)
  - [ ] 5.1 Wrap response in `{ data }` envelope
  - [ ] 5.2 Add `idempotent: true` to wrapHandler options
  - [ ] 5.3 Add event recording on successful redemption (fire-and-forget)
  - [ ] 5.4 Write/update unit tests for envelope, idempotency

- [ ] Task 6: Command endpoints & CDK wiring (AC: 5, 9, 20)
  - [ ] 6.1 Wire `POST /users/api-keys/:apiKeyId/revoke` to existing api-keys Lambda in CDK
  - [ ] 6.2 Wire `POST /users/me/update` to existing users-me Lambda in CDK
  - [ ] 6.3 Grant mutation Lambdas Write on idempotencyTable and eventsTable
  - [ ] 6.4 Pass `IDEMPOTENCY_TABLE_NAME` and `EVENTS_TABLE_NAME` env vars to mutation Lambdas
  - [ ] 6.5 Verify handler can serve both routes without branching on HTTP method

- [ ] Task 7: Action registrations (AC: 19)
  - [ ] 7.1 Register all auth domain actions in `action-registrations.ts`
  - [ ] 7.2 Add `meta.actions` to `GET /users/me` response
  - [ ] 7.3 Write/update unit tests for action registration

- [ ] Task 8: Final validation (AC: 21)
  - [ ] 8.1 Run `npm test` — all tests pass
  - [ ] 8.2 Run `npm run lint` — no lint errors
  - [ ] 8.3 Verify 80%+ coverage on all modified handlers
  - [ ] 8.4 Run `npm run build` — clean build
  - [ ] 8.5 Run `cd infra && npm run build && npx cdk synth` — CDK synth succeeds

## Dev Notes

### Architecture Patterns & Constraints

- **Follow 3.2.7 (Saves Domain Retrofit) as the reference implementation.** The saves retrofit established all patterns: `wrapHandler` middleware composition, pre-read + ALL_NEW for updates, fire-and-forget event recording, scope-based rate limit configs, command endpoint dual-routing.
- **Greenfield rules apply:** This project has zero users and zero live environments. Delete old patterns entirely — no compatibility shims, deprecated wrappers, or re-exports. Manual `enforceRateLimit()` calls are removed, not wrapped.
- **Agent identity is always-on via `wrapHandler`.** `ctx.agentId` and `ctx.actorType` are available in every handler. No opt-in flag needed. Echo `X-Agent-ID` header is automatic.
- **Rate limiting runs BEFORE body validation** in the middleware chain (fail-fast pattern). Handlers never call `enforceRateLimit()` directly.
- **Idempotency caches 2xx responses only.** Error responses are NOT cached so agents can retry failures. 24-hour TTL. Fail-open on DynamoDB errors.
- **ADR-008 error contract** is handled by `wrapHandler` error normalization. State/conflict errors include `currentState` and `allowedActions`. Field validation errors include `field`, `constraint`, `allowed_values`.

### Auth Domain Handler Inventory

| Handler | File | Current Agent-Native | Retrofit Needed |
|---------|------|---------------------|-----------------|
| POST /users/api-keys | `backend/functions/api-keys/handler.ts` | Envelope, scope | Idempotency, rate limit via wrapper, events |
| GET /users/api-keys | `backend/functions/api-keys/handler.ts` | Envelope, pagination, scope | Rate limit headers (read — optional V1) |
| DELETE /users/api-keys/:id | `backend/functions/api-keys/handler.ts` | 204 | Idempotency, events |
| GET /users/me | `backend/functions/users-me/handler.ts` | Auth only | Envelope, scope, meta.actions |
| PATCH /users/me | `backend/functions/users-me/handler.ts` | Auth only | Envelope, idempotency, version, rate limit, scope, events |
| POST /users/invite-codes | `backend/functions/invite-codes/handler.ts` | Envelope, scope, manual rate limit | Idempotency, rate limit via wrapper, events |
| GET /users/invite-codes | `backend/functions/invite-codes/handler.ts` | Envelope, pagination, scope | Rate limit headers (read — optional V1) |
| POST /auth/validate-invite | `backend/functions/validate-invite/handler.ts` | Auth, manual rate limit | Envelope, idempotency, events |

**Existing envelope note:** `GET /users/api-keys` and `GET /users/invite-codes` already return standard `{ data, meta, links }` envelopes with `meta.cursor` pagination from their Epic 2 implementations. Verify they include `links.self` — no retrofit needed if already compliant. These read endpoints do not get `meta.rateLimit` in V1 (no rate limiting on reads).

### Scope Resolver Verification

The scope resolver (`middleware/src/scope-resolver.ts`) currently maps tiers to operations. Verify these **specific** mappings exist before adding `requiredScope` to handlers — add any that are missing:

| Tier | Must Grant | Rationale |
|------|-----------|-----------|
| `read` | `users:read`, `keys:read` | Read-only keys can view profile and list API keys |
| `full` / `*` | All operations (wildcard) | Already handled by `*` grant — no change needed |
| `capture` | (none of the auth ops) | Capture keys only create saves — cannot manage profile/keys/invites |
| `saves:write` | (none of the auth ops) | Saves-focused keys should NOT manage profiles or keys |

- JWT auth bypasses scope checks entirely (full permissions) — no changes needed for JWT users
- No tier other than `full`/`*` should grant `users:write` or `keys:manage` — profile updates and key management are user-level privileged operations
- If `users:read` or `keys:read` are missing from the `read` tier, add them in Task 1.2

### Event Recording Pattern (from 3.2.7)

```
1. Pre-read entity for before snapshot + version hint
2. DynamoDB update with version condition + ALL_NEW return
3. recordEvent() fire-and-forget with:
   - entityType, entityId, userId
   - eventType (e.g., "ApiKeyCreated", "ProfileUpdated")
   - actorType from ctx.actorType ("human" | "agent")
   - actorId from ctx.agentId (agent name or null)
   - changes: { changedFields, before, after } (updates only)
   - context from request body (optional)
   - requestId for correlation
```

### Rate Limit Configurations

| Operation | Window | Default Limit | Capture Tier | Full Tier | Identifier |
|-----------|--------|---------------|-------------|-----------|------------|
| `apikey-create` | 3600s | 10 | N/A | 10 | userId |
| `invite-generate` | 86400s | 5 | N/A | 10 | userId |
| `invite-validate` | 3600s | 5 | N/A | 20 | userId |
| `profile-update` | 3600s | 30 | N/A | 30 | userId |

### CDK Wiring Notes

- **Idempotency table:** `ai-learning-hub-idempotency` — already exists, used by saves handlers
- **Events table:** `ai-learning-hub-events` — already exists, used by saves handlers
- Both tables are shared infrastructure created in earlier stacks
- Command endpoints use path-segment style: `/users/api-keys/{apiKeyId}/revoke`, `/users/me/update` — consistent with 3.2.7's `/saves/{saveId}/update-metadata`
- No colon-encoding concerns — standard REST path segments work natively with API Gateway

### Project Structure Notes

- All auth handlers are in `backend/functions/` — each has its own directory
- Shared schemas in `backend/shared/validation/src/schemas.ts`
- Shared types in `backend/shared/types/src/entities.ts`
- Action registrations in `backend/shared/middleware/src/action-registrations.ts`
- CDK auth routes in `infra/lib/stacks/api/` — may be `auth-routes.stack.ts` or integrated into existing route stacks

### Testing Standards

- Use `vitest` as test framework
- Mock db layer (`createApiKey`, `getItem`, `updateItem`, etc.)
- Mock logging layer
- Test envelope shape: `{ data, meta?, links? }`
- Test idempotency: 400 if missing key, replay on duplicate key
- Test version conflict: 409 with `currentVersion` in details
- Test rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` present
- Test scope enforcement: 403 with `required_scope`, `granted_scopes`
- Test event recording: `recordEvent()` called with correct params
- Test context metadata: optional `context` field flows to event recording
- Use `assertADR008Error()` utility for error shape validation

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3.2, Story 3.2.8]
- [Source: _bmad-output/implementation-artifacts/3-2-7-saves-domain-retrofit.md — Reference implementation]
- [Source: backend/shared/middleware/src/wrapper.ts — wrapHandler middleware chain]
- [Source: backend/shared/middleware/src/idempotency.ts — Idempotency middleware]
- [Source: backend/shared/middleware/src/concurrency.ts — Optimistic concurrency]
- [Source: backend/shared/middleware/src/agent-identity.ts — Agent identity extraction]
- [Source: backend/shared/middleware/src/rate-limit-headers.ts — Rate limit transparency]
- [Source: backend/shared/middleware/src/scope-resolver.ts — Scope resolution]
- [Source: backend/shared/middleware/src/error-handler.ts — Error contract + envelope]
- [Source: backend/shared/middleware/src/action-registrations.ts — Action registry]
- [Source: backend/shared/db/src/events.ts — Event recording]
- [Source: .claude/docs/api-patterns.md — ADR-008 error contract]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
