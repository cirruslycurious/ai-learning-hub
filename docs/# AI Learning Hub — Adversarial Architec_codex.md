# AI Learning Hub — Adversarial Architecture & Code Quality Findings

## Overall Assessment

The codebase is functional and not in bad shape, but it is not yet structurally strong enough for rapid scaling across future epics.

Current state is best described as: **good implementation baseline, weak architecture enforcement**.

## Findings (Ordered by Severity)

### 1) Route registry is not truly authoritative

- **Severity:** Critical
- **Area:** Extensibility / Architecture
- **What’s wrong:** `infra/config/route-registry.ts` declares routes, but actual route creation is still hand-coded in `infra/lib/stacks/api/auth-routes.stack.ts`, and tests hardcode route expectations too.
- **Failure mode:** Route drift where registry and deployed API differ.
- **Impact:** High maintenance cost and brittle route growth.

### 2) Architecture enforcement tests can pass without real deployment wiring

- **Severity:** High
- **Area:** Test quality / Architecture enforcement (T2/T4)
- **What’s wrong:** `infra/test/helpers/create-test-api-stacks.ts` wires placeholder/imported Lambda ARNs (`fromFunctionArn`) instead of validating real function constructs from `AuthStack`.
- **Failure mode:** Tests stay green even if real handler deployment/wiring regresses.
- **Impact:** False confidence in architecture guardrails.

### 3) API contract test has a vacuous pass path

- **Severity:** High
- **Area:** Test quality (T1)
- **What’s wrong:** One T1 auth assertion inspects methods in `ApiGatewayStack`, which intentionally has no routes/methods.
- **Failure mode:** Critical auth checks can pass while not checking real routes.
- **Impact:** Security and contract regressions can slip through.

### 4) ADR-008 error contract is inconsistent for 405 responses

- **Severity:** High
- **Area:** ADR compliance / API consistency
- **What’s wrong:** Handlers return `METHOD_NOT_ALLOWED`, but this is not in shared `ErrorCode` enum (`backend/shared/types/src/errors.ts`).
- **Failure mode:** Client-side error handling tied to enum can break.
- **Impact:** Contract drift and integration fragility.

### 5) Request logging is incomplete for operational readiness

- **Severity:** High
- **Area:** Ops readiness / Observability
- **What’s wrong:** `wrapHandler` logs completion/error but does not consistently log sanitized incoming request metadata.
- **Failure mode:** Harder incident debugging and weaker traceability.
- **Impact:** Slower production troubleshooting.

### 6) Hardcoded table-name fallbacks in shared DB package

- **Severity:** Medium
- **Area:** ADR-014 intent / Configuration discipline
- **What’s wrong:** Shared DB config falls back to literal table names if env vars are absent.
- **Failure mode:** Misconfigured env can silently target wrong resources.
- **Impact:** Environment isolation risk and deploy-time surprises.

### 7) Rate limiter intentionally fails open on DynamoDB errors

- **Severity:** Medium
- **Area:** Operational readiness / Abuse protection
- **What’s wrong:** `backend/shared/db/src/rate-limiter.ts` allows requests if DDB update fails.
- **Failure mode:** During DDB incidents, protections are effectively disabled.
- **Impact:** Temporary abuse/exhaustion risk.

### 8) Shared package footprint is incomplete vs stated architecture

- **Severity:** Medium
- **Area:** Extensibility / Shared resource strategy
- **What’s wrong:** Only 5 backend shared packages are present/workspaced; expected event abstraction package is not currently in place.
- **Failure mode:** Future ad-hoc EventBridge code paths appear.
- **Impact:** Shared abstraction erosion over time.

### 9) Shared type model drift (`types` vs `db`)

- **Severity:** Medium
- **Area:** Type safety / Contract integrity
- **What’s wrong:** Invite code naming differs between shared entity types and DB models (`createdBy/usedBy` vs `generatedBy/redeemedBy`).
- **Failure mode:** Incorrect assumptions by consumers of `@ai-learning-hub/types`.
- **Impact:** Subtle integration bugs.

### 10) Frontend integration layer not yet established

- **Severity:** Medium
- **Area:** Frontend readiness
- **What’s wrong:** `frontend/src` is scaffold-level (no typed API client, no centralized auth-header flow).
- **Failure mode:** Future fetch/auth duplication across components.
- **Impact:** Technical debt once frontend stories accelerate.

### 11) `any` usage in architecture tests

- **Severity:** Low
- **Area:** Type safety
- **What’s wrong:** At least one architecture test uses explicit `any` for authorizer ID parsing.
- **Failure mode:** Reduced compile-time safety in guardrail tests.
- **Impact:** Small, but avoidable.

## Practical Meaning

- Not bad code.
- Not "just okay" for long-term architecture confidence.
- Needs targeted refactoring, not a rewrite.

## Recommended Refactor Scope

### Priority 1 (now)

1. Make route registry executable source of truth (generate route wiring from registry).
2. Rework T1-T4 to validate real stack/function wiring and fail on real drift.
3. Normalize ADR-008 errors (including 405) through shared error primitives.

### Priority 2 (next)

4. Remove hardcoded table fallbacks; fail fast on missing env in runtime.
5. Improve wrapper logging with sanitized inbound request metadata.
6. Decide/document fail-open vs fail-closed rate limiter behavior.

### Priority 3 (as epics continue)

7. Align shared types with DB models.
8. Add shared events package and enforce usage.
9. Establish frontend typed API client and centralized auth token/header pipeline.

## Bottom Line

The repo is viable and moving, but currently has architecture and test blind spots that will become expensive if left untreated.

Fixing the top structural issues now will move it into mostly good shape quickly.
