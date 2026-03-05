# Story 3.5.2 Code Review Findings - Round 2

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-03-05
**Branch:** story-3-5-2-epic-2-code-cleanup
**Base:** main

## Round 1 Disposition

All Round 1 findings have been addressed:

### Critical (Resolved)

1. **Uncommitted working tree changes** — FIXED. All changes committed in `f4db749`.

### Important (Resolved / Deferred)

1. **CDK test IAM assertions verify action presence but not resource-level scoping** — DEFERRED. The test correctly validates that each function's role includes the expected DynamoDB actions. Per-resource assertion (`hasIamActionOnResource`) is a future enhancement; the current tests catch the primary risk (missing grants). No functional bug exists.

2. **Test cements over-provisioned env vars as "correct" behavior** — FIXED. Added comment above `toHaveLength(10)` assertion explaining Finding 5.1 workaround (`@ai-learning-hub/db` barrel import) and that the count should be updated when barrel imports are fixed.

3. **Smoke test rate-limiting scenario creates API keys without cleanup** — DEFERRED. The smoke test is run against a dedicated rate-limit test identity. Orphaned keys have no functional impact in dev. Cleanup logic would add complexity to a scenario focused on verifying 429 responses.

4. **`readUsersMeFunction` IAM test negative assertion coupled to CDK internals** — DEFERRED. Low probability of false failure. The test correctly validates that the read-only function does not have write actions. Filtering to custom-policy-only statements is a future refinement.

### Minor (Resolved)

1. **Idempotency replay test uses bare `{} as Context`** — FIXED. Replaced with `createMockContext()` from `test-utils/mock-wrapper.ts`.

2. **All 10 Lambda functions share identical memory/timeout** — DEFERRED per review recommendation. No change needed until usage data is available.

3. **`validateInviteFunction` has all table env vars including SAVES_TABLE_NAME** — DEFERRED per Finding 5.1.

## Round 2 New Findings

No new findings. All code changes from Round 1 fixes verified.

## Summary

- **Critical:** 0
- **Important:** 0
- **Minor:** 0
- **Recommendation:** PASS — all critical and important findings resolved or explicitly deferred with justification.
