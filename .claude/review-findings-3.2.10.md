# Story 3.2.10 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-28
**Branch:** story-3-2-10-proactive-action-discoverability

## Critical Issues (Must Fix)

1. **requiredScope mismatch between registrations and handlers** — Registrations declare specific scopes but handlers use `"*"` or different values
2. **AC8-13 / Task 6 not integrated** — `meta.actions[]` helper exists but never called from saves-get handler

## Important Issues (Should Fix)

3. `requiredScope: "*"` on discovery actions causes incorrect scope filter behavior
4. CORS config duplication (pre-existing, also flagged by dedup scan)
5. No validation of entity/scope query params on GET /actions
6. saves:restore URL pattern inconsistency with future CQRS convention

## Minor Issues

7. No idempotency guard on registerInitialActions
8. `as never` type assertion in test ErrorCode values
9. expectedErrors has no runtime validation (compile-time sufficient)
10. Story status not updated in spec file
11. CDK Nag IAM5 suppression reason incorrect for discovery Lambdas
