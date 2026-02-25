# Story 3.1.9 Review -- Round 2

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-25
**Branch:** story-3-1-9-eventbridge-verification-smoke

## Summary

Round 2 verification review of Story 3.1.9 (EventBridge verification smoke scenarios). All 5 actionable findings from Round 1 (1 Critical, 4 Important -- note: Important #1 was intentionally deferred) have been properly addressed in commit `0f00529`. The fixes are correct and introduce no new issues. The code is clean, follows established patterns, and meets acceptance criteria.

## Verdict: APPROVE

## Round 1 Fix Verification

| #            | Severity  | Finding                                                                                   | Status                 | Verification                                                                                                                                                                                                                                                                                                    |
| ------------ | --------- | ----------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical #1  | Critical  | Filter pattern injection -- no validation of `saveId`/`detailType` for double-quote chars | FIXED                  | Lines 45-50 of `cloudwatch-helpers.ts` now reject inputs containing `"` before constructing the filter pattern. The validation runs before the dynamic import and client creation, which is the correct placement.                                                                                              |
| Important #1 | Important | New CloudWatchLogsClient created on every call (no caching)                               | DEFERRED (intentional) | Acknowledged in R1 as acceptable for smoke test simplicity. No change needed.                                                                                                                                                                                                                                   |
| Important #2 | Important | Dead module-level `queryStartEpochMs` variable                                            | FIXED                  | Module-level `let queryStartEpochMs` removed from `eventbridge-verify.ts` line 22. EB1 now uses `const queryStartEpochMs` as a local variable (line 54), consistent with `updateStartEpochMs` in EB2 and `deleteStartEpochMs` in EB3.                                                                           |
| Important #3 | Important | EB3 double-delete with cleanup -- no explanatory comment                                  | FIXED                  | Lines 63-64 of `eventbridge-verify.ts` now contain a clear comment: "Register cleanup as a safety net: EB3 deletes the save in the happy path, but if EB2 or EB3 fails/is skipped, cleanup ensures the save is removed." This adequately explains the dual-deletion strategy.                                   |
| Important #4 | Important | AccessDeniedException only caught on attempt 1                                            | FIXED                  | The `attempt === 1` guard has been removed from `cloudwatch-helpers.ts` lines 73-80. The AccessDeniedException is now caught and rethrown with a helpful message on any attempt. The comment also now says "Permissions errors are not transient -- throw immediately" which correctly documents the rationale. |
| Minor #2     | Minor     | JSON.parse error handling                                                                 | FIXED                  | Lines 93-100 of `cloudwatch-helpers.ts` now wrap `JSON.parse(message)` in a try/catch with a contextual error message including the attempt number and a truncated preview of the message (first 200 chars).                                                                                                    |
| Minor #3     | Minor     | Stale phases.ts header comment                                                            | FIXED                  | Lines 12-13 of `phases.ts` now include `Phases 5-6: (reserved for future)` and `Phase 7: EventBridge Verification (EB1-EB3)`.                                                                                                                                                                                   |
| Minor #4     | Minor     | No explicit saveId assertion in EB1                                                       | FIXED                  | Lines 86-90 of `eventbridge-verify.ts` now explicitly assert `event.detail.saveId !== createdSaveId` with a descriptive error message, matching the "belt-and-suspenders" comment added on line 85.                                                                                                             |

All 7 fixable findings (1 Critical + 3 Important + 3 Minor) are properly addressed. The 1 deferred Important finding (client caching) was explicitly accepted in Round 1.

## New Findings

### Critical

None.

### Important

None.

### Minor

1. **EB3 does not assert `event.detail.saveId` like EB1 does**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/scripts/smoke-test/scenarios/eventbridge-verify.ts`, lines 170-181 (EB3 scenario)
   - **Problem:** The R1 fix added an explicit `event.detail.saveId` assertion to EB1 (line 86), but EB3 only checks `event.detailType`. For consistency across all three scenarios, EB3 could also assert `event.detail.saveId === createdSaveId`. EB2 similarly lacks the `saveId` assertion, though it has the `updatedFields` check which partially compensates by validating event-specific detail content.
   - **Impact:** No correctness issue -- the CloudWatch filter pattern already matches by saveId. This is purely a consistency and defense-in-depth point across the three scenarios.
   - **Fix:** Optionally add `if (event.detail.saveId !== createdSaveId)` assertions to EB2 and EB3, mirroring EB1.

## What Was Checked

- Full diff of all 7 changed files between `main` and `HEAD` (both commits)
- Isolated diff of fix commit (`81f69df..0f00529`) to verify each R1 finding was addressed
- Security scan: no hardcoded secrets, AWS account IDs, API keys, private key material, resource IDs, connection strings, or ARNs found
- Input validation logic in `waitForLogEvent` verified: double-quote rejection is correct and placed before filter pattern construction
- AccessDeniedException handling verified: throws immediately on any attempt (no longer gated by `attempt === 1`)
- JSON.parse error handling verified: contextual error message with truncated message preview
- Phase registry in `phases.ts` verified: Phase 7 correctly registered with init function, header comment updated
- Pattern consistency verified against existing `saves-crud.ts`: cleanup registration, module-level state, ScenarioSkipped usage all follow established conventions
- Type compliance verified: `ScenarioDefinition`, `CleanupFn`, `ScenarioSkipped` all used correctly
- No circular import risks: `cloudwatch-helpers.ts` has no imports from the scenario files
- `package.json` change is additive only: `@aws-sdk/client-cloudwatch-logs` added as devDependency, `tsx` reordered alphabetically
- `.env.smoke.example` additions are documentation-only with no actual secrets

## Totals

- **Total findings:** 1
- **Critical:** 0
- **Important:** 0
- **Minor:** 1
- **Recommendation:** APPROVE -- all Critical and Important issues from Round 1 have been properly resolved. The single Minor finding is a consistency nit that does not warrant another review round.
