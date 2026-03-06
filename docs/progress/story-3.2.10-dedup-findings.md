# Story 3.2.10 Dedup Scan Findings - Round 1

**Scanner:** Agent (Fresh Context)
**Date:** 2026-02-28
**Branch:** story-3-2-10-proactive-action-discoverability
**Handlers scanned:** 14 handler files + 3 route stacks + 1 API gateway stack

## Critical Issues (Must Fix)

None found.

## Important Issues (Should Fix)

### 1. Registry initialization block duplicated across both new handlers

- Files: `actions-catalog/handler.ts:16-17`, `state-graph/handler.ts:17-18`
- Fix: Extract `getInitializedRegistry()` in middleware

### 2. CORS preflight configuration duplicated across 4 files

- Files: `api-gateway.stack.ts`, `auth-routes.stack.ts`, `saves-routes.stack.ts`, `discovery-routes.stack.ts`
- Fix: Extract to `infra/config/cors.ts` — pre-existing issue, not introduced by this story

### 3. CDK Nag suppression arrays duplicated across route stacks

- Files: `saves-routes.stack.ts`, `discovery-routes.stack.ts`
- Fix: Extract to `infra/config/nag-suppressions.ts` — pre-existing issue

### 4. Discovery routes missing from route registry

- File: `infra/config/route-registry.ts` missing entries for GET /actions, GET /states/{entityType}
- Fix: Add entries + extend HandlerRef type

## Minor Issues (Nice to Have)

5. URLSearchParams self-link construction across multiple handlers (pre-existing)
6. Import set similarity between two new handlers (addressed by #1)
7. Lambda function definition boilerplate in CDK stacks (pre-existing)

## Summary

- Total: 7 (0 critical, 4 important, 3 minor)
- Recommendation: PROCEED — fix #1 and #4 before merge; #2-3 are pre-existing DRY issues
