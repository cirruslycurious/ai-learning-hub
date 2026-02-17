# Sprint Change Proposal — ADR-013 Auth Implementation Gaps

**Date:** 2026-02-14
**Author:** Stephen (via Correct Course workflow)
**Trigger:** Implementation readiness review of ADR-013 (Authentication & Identity)
**Scope:** Epic 2 (User Authentication & API Keys)
**Status:** Approved

---

## Section 1: Issue Summary

### Problem Statement

An implementation readiness review of ADR-013 (Authentication Provider — Clerk) identified 9 findings (2 critical, 5 medium, 1 low-medium, 1 low) that represent gaps in the architecture specification. ADR-013 provides solid high-level direction for Clerk JWT authentication, API key management, RBAC, and invite codes, but lacks implementation-level specifics that Epic 2 story writers need.

### Discovery Context

These gaps were discovered proactively during a planning validation pass — before Epic 2 stories were written and before any implementation began. This is the cheapest possible moment to resolve them.

### Key Evidence

- ADR-013 line 1034: States "synced to DynamoDB on first login" but specifies no sync mechanism
- ADR-013 line 1036: States "checked before Clerk account creation" but specifies no enforcement mechanism
- ADR-013 lines 997-1020: API key authorizer references `user.role` but GSI only returns APIKEY items
- ADR-013 lines 997-1020: Authorizer never checks `scopes` despite schema defining them
- ADR-013 lines 966-988: Neither authorizer checks `suspendedAt` despite table schema including it

---

## Section 2: Impact Analysis

### Epic Impact

| Epic                        | Impact Level | Details                                                                                                  |
| --------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| **Epic 2: Auth & API Keys** | **Direct**   | All 9 findings are ADR-013 gaps. Stories can't be written with clear acceptance criteria until resolved. |
| Epic 3: Saves               | Low          | Depends on auth working correctly; no changes needed if Epic 2 is fixed.                                 |
| Epic 4-8                    | None         | Same auth pattern — receives userId from authorizer context.                                             |
| Epic 9: Pipelines           | Low          | Suspended user saves still get enriched — acceptable behavior.                                           |
| Epic 10: Admin              | Medium       | Suspend/unsuspend endpoints need authorizer enforcement. Rate limit management needs architecture.       |
| Epic 11: Onboarding         | Low          | Invite code flow in Priya's journey needs enforcement mechanism defined.                                 |

### Artifact Conflicts

| Artifact                   | Conflict?           | Action                                                   |
| -------------------------- | ------------------- | -------------------------------------------------------- |
| **Architecture (ADR-013)** | **Yes — primary**   | 9 additions/clarifications needed                        |
| PRD (FR3)                  | Minor clarification | Sign out scope: web sessions only, API keys separate     |
| PRD (FR7)                  | No conflict         | Architecture must deliver scope enforcement as specified |
| DynamoDB schema            | No conflict         | Schema is correct; authorizer logic was incomplete       |
| CDK stacks                 | No conflict         | auth.stack.ts implements whatever is specified           |
| CI/CD pipeline             | No conflict         | No changes needed                                        |
| UX design                  | N/A                 | No formal UX spec exists                                 |

### Story Impact

Epic 2 stories have not been written yet. All findings will be incorporated as acceptance criteria during story creation — no rework required.

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

**Update ADR-013 with all 9 finding resolutions, then proceed to Epic 2 story writing.**

### Rationale

- **Timing is ideal** — Caught before story writing, not during implementation. Zero rework.
- **No code impact** — Epic 2 hasn't started. No rollback needed.
- **Scope is contained** — All 9 findings resolve into ADR-013 additions. No new epics, no reordering, no PRD rewrites.
- **Low risk** — Architecture document updates only.
- **Team momentum preserved** — One-session detour to patch architecture, then normal flow resumes.

### Alternatives Considered

| Option              | Viable? | Why Not                                                                |
| ------------------- | ------- | ---------------------------------------------------------------------- |
| Rollback            | No      | Nothing to roll back — Epic 2 hasn't started                           |
| MVP scope reduction | No      | MVP scope is intact — these are specification gaps, not scope problems |

### Effort & Risk

- **Effort:** Low — document updates only, estimated one work session
- **Risk:** Low — architecture additions, no reversals or structural changes
- **Timeline impact:** Minimal — adds one session before Epic 2 story writing

---

## Section 4: Detailed Change Proposals

All changes target the Architecture document (ADR-013) unless noted otherwise. Each proposal was reviewed and approved incrementally.

---

### Change 1: User Provisioning Flow (CRITICAL)

**Location:** ADR-013, new subsection after Consequences block

**Resolution:** Add "create-on-first-auth" pattern to the JWT authorizer.

- User signs up via Clerk (frontend)
- First API request triggers JWT authorizer
- Authorizer validates JWT, checks DynamoDB for USER#\<clerkId\> PROFILE record
- If not found: create PROFILE via conditional PutItem (attribute_not_exists)
- Subsequent requests: GetItem only (fast path)

**Key decisions:**

- Create-on-first-auth over Clerk webhooks — simpler, no webhook infrastructure in V1
- Conditional write prevents duplicates (idempotent)
- First request ~200ms slower due to write — acceptable (happens 10-20 times total at boutique scale)
- No orphaned state: Clerk = identity, DynamoDB = app data

---

### Change 2: Invite Code Enforcement (CRITICAL)

**Location:** ADR-013, new subsection after User Provisioning Flow

**Resolution:** Decouple Clerk signup from app access (Option C).

- Anyone can create a Clerk account (Google OAuth)
- App access gated at provisioning: create-on-first-auth checks `inviteValidated` in JWT claims
- New endpoint: `POST /auth/validate-invite` validates code server-side, sets Clerk publicMetadata.inviteValidated = true
- JWT authorizer blocks unvalidated users (returns 403 INVITE_REQUIRED)

**Key decisions:**

- Server-side enforced — frontend can't bypass
- No Clerk allowlist management or webhook-based account deletion
- Clean separation: Clerk handles identity, app handles access
- Code redemption via conditional UpdateItem (idempotent)

---

### Change 3: API Key GSI & Two-Query Pattern (MEDIUM)

**Location:** ADR-013, replace API Key Authorizer Implementation

**Resolution:** Explicitly document the two-query pattern.

- Query 1: GSI lookup by keyHash → returns APIKEY item (clerkId, revokedAt, scopes)
- Query 2: GetItem USER#\<clerkId\> PROFILE → returns role, suspendedAt

**Key decisions:**

- Two queries over denormalization — avoids role sync burden across APIKEY items
- +10-20ms acceptable (API key auth not on mobile save critical path)
- Second query also provides suspension check (resolves Finding 9 for API keys)

---

### Change 4: API Key Scope Enforcement (MEDIUM)

**Location:** ADR-013, new subsection after authorizer updates

**Resolution:** Middleware-based scope checking in `@ai-learning-hub/middleware`.

- Authorizer passes scopes in request context
- `requireScope()` middleware validates against requested operation
- JWT users bypass scope check (full access)
- Scope definitions: `['*']` = full access, `['saves:write']` = capture-only

**Key decisions:**

- Middleware over authorizer IAM policies — no caching delay, specific error codes
- Directly satisfies FR7 ("capture-only API keys limited to POST /saves only")
- Extensible for V2 granular scopes (MCP server)

---

### Change 5: JWT Token Lifecycle (LOW-MEDIUM)

**Location:** ADR-013, new subsection after JWT Authorizer

**Resolution:** Document the frontend token refresh strategy and authorizer cache TTL.

- Frontend: Axios interceptor calling `useAuth().getToken()` before every API call
- Clerk SDK handles token caching and refresh internally
- Authorizer cache TTL: 300 seconds (conscious trade-off: cost vs security lag)
- Clock skew tolerance: 30 seconds (Clerk SDK default)

---

### Change 6: Sign Out Scope Clarification (MEDIUM)

**Location:** PRD (FR3) + ADR-013 Consequences

**Resolution:** Clarify that FR3 revokes Clerk web sessions only. API keys managed separately via FR5/FR6.

- Sign out ≠ disable automations
- Maya's iOS Shortcut and Dev's agent survive web signout
- Users revoke API keys explicitly when needed
- PRD FR3 updated to: "Users can sign out from all devices (revokes Clerk web sessions only; API keys are managed separately via FR5/FR6)"

---

### Change 7: Rate Limiting Architecture (MEDIUM)

**Location:** ADR-013, new subsection

**Resolution:** Two-layer rate limiting approach.

- Layer 1: API Gateway throttling (100 req/s steady-state) + WAF rate-based rule (500/5min per IP)
- Layer 2: Application middleware with DynamoDB counters (per-user, per-key, read/write split)
- Auth-specific limits: 5 invite validations per IP/hour, 10 key generations per user/hour
- SHA-256 for API key hashing confirmed sufficient (256-bit random keys, not guessable)

---

### Change 8: Auth Error Code Table (LOW)

**Location:** ADR-013, new subsection extending ADR-008

**Resolution:** 12 auth-specific error codes with HTTP status, trigger, and consumer action.

Key codes: EXPIRED_TOKEN, INVALID_API_KEY, REVOKED_API_KEY, SUSPENDED_ACCOUNT, SCOPE_INSUFFICIENT, INVITE_REQUIRED, INVALID_INVITE_CODE, RATE_LIMITED

**Practical V1 split:**

- Authorizer: generic 401/403 (API Gateway limitation)
- Middleware: granular codes (SUSPENDED_ACCOUNT, SCOPE_INSUFFICIENT, RATE_LIMITED)
- Application endpoints: specific codes (INVITE_REQUIRED, INVALID_INVITE_CODE)

---

### Change 9: Suspended User Check (MEDIUM)

**Location:** ADR-013, updated JWT authorizer + new subsection

**Resolution:** Both authorizers check `suspendedAt`.

- API key authorizer: already addressed in Change 3 (two-query pattern includes profile check)
- JWT authorizer: DynamoDB GetItem on every request (cached by authorizer 300s TTL)
- Net effect: suspension takes effect within ~5 minutes for JWT, immediately for API keys
- Rejected alternative: Clerk metadata flag — adds coupling, still has propagation delay

---

## Section 5: Implementation Handoff

### Change Scope Classification: Minor

All changes are architecture document updates. No code exists to modify. No epics added or removed. No structural changes to the project plan.

### Handoff Plan

| Action                                            | Owner                 | Timing                            |
| ------------------------------------------------- | --------------------- | --------------------------------- |
| Apply all 9 changes to architecture.md (ADR-013)  | Dev (Stephen / agent) | Next work session                 |
| Update PRD FR3 with sign out scope clarification  | Dev (Stephen / agent) | Same session                      |
| Proceed to Epic 2 story writing with updated spec | SM / Dev workflow     | After architecture updates merged |

### Implementation Steps

1. **Update architecture.md** — Add all 9 new subsections to ADR-013
2. **Update prd.md** — Clarify FR3 sign out scope
3. **Validate** — Run implementation readiness review against updated ADR-013 to confirm gaps closed
4. **Proceed** — Write Epic 2 stories using the corrected architecture as the spec

### Success Criteria

- [ ] ADR-013 contains explicit user provisioning flow specification
- [ ] ADR-013 contains explicit invite code enforcement mechanism
- [ ] ADR-013 API key authorizer shows two-query pattern with role + suspension check
- [ ] ADR-013 contains scope enforcement middleware pattern
- [ ] ADR-013 documents JWT token lifecycle and authorizer cache TTL
- [ ] PRD FR3 clarifies sign out scope (web sessions only)
- [ ] ADR-013 contains rate limiting architecture (two-layer)
- [ ] ADR-013 contains auth error code table (12 codes)
- [ ] ADR-013 JWT authorizer includes suspension check
- [ ] Epic 2 stories can be written with unambiguous acceptance criteria

---

_Generated by: Correct Course workflow (BMAD Method)_
_Date: 2026-02-14_
