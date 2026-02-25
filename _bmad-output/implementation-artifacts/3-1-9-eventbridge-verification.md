# Story 3.1.9: EventBridge Verification Smoke Scenarios

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want **smoke test scenarios that query CloudWatch Logs after save operations to verify EventBridge events are actually delivered**,
so that **silent EventBridge failures (missing IAM permissions, wrong bus name, broken rule targets) are caught before users hit them**.

## Acceptance Criteria

**Phase 7 — EventBridge Verification (EB1–EB3):**

| #   | Given                                                                    | When                                                                                                                  | Then                                                                                                                                            |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| EB1 | `SMOKE_TEST_EVENT_LOG_GROUP` env var set (or derived from stack outputs) | `POST /saves` with unique URL, then poll CloudWatch Logs (up to 3 retries, 5s intervals)                              | At least one log event found matching the test save's `saveId`; event `detail-type` is `SaveCreated`; event `source` is `ai-learning-hub.saves` |
| EB2 | Save from EB1 updated via PATCH                                          | Wait then poll CloudWatch Logs for `SaveUpdated`                                                                       | Log event found with `detail-type: SaveUpdated` and matching `saveId`; `detail.updatedFields` is present                                        |
| EB3 | Save from EB1 deleted via DELETE                                         | Wait then poll CloudWatch Logs for `SaveDeleted`                                                                       | Log event found with `detail-type: SaveDeleted` and matching `saveId`                                                                           |

**General:**

| #   | Given                                                           | When                                               | Then                                                                                                                                               |
| --- | --------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Scenario needs AWS SDK to query CloudWatch Logs                 | `@aws-sdk/client-cloudwatch-logs` added             | Package added as root devDependency; `FilterLogEventsCommand` used to query log group                                                              |
| AC2 | CloudWatch Log Group may not exist (3.1.8 not deployed)         | `SMOKE_TEST_EVENT_LOG_GROUP` not set               | Phase 7 is skipped with `SKIP` status and message: `"EventBridge log group not configured — set SMOKE_TEST_EVENT_LOG_GROUP or deploy Story 3.1.8"` |
| AC3 | CloudWatch Logs delivery has inherent latency                   | Scenario queries logs                              | Scenario retries `FilterLogEvents` up to 3 times with 5-second intervals (max 15s wait) before failing; first successful match short-circuits      |
| AC4 | All scenarios implemented                                       | Scenarios registered                               | Phase 7 (`eventbridge`) contains EB1–EB3; phase registry updated                                                                                   |
| AC5 | Smoke test runner needs AWS credentials for CloudWatch Logs API | Credentials available                              | Scenario uses default credential chain (same as `cdk deploy`); no new IAM users or keys needed; `logs:FilterLogEvents` permission required         |
| AC6 | Existing phases intact                                          | After adding Phase 7                               | All other phases unchanged; full suite still passes                                                                                                |
| AC7 | Lint passes                                                     | After all changes                                  | `npm run lint` passes                                                                                                                              |

## Tasks / Subtasks

- [ ] Task 1: Add `@aws-sdk/client-cloudwatch-logs` dependency (AC: #1)
  - [ ] 1.1 `npm install --save-dev @aws-sdk/client-cloudwatch-logs` at root
  - [ ] 1.2 Verify no dependency conflicts (the project already uses `@aws-sdk/client-eventbridge`, `@aws-sdk/client-dynamodb`, etc.)
- [ ] Task 2: Create CloudWatch Logs query helper (AC: #3)
  - [ ] 2.1 Create `scripts/smoke-test/cloudwatch-helpers.ts` (flat file — matches existing convention of `helpers.ts`, `client.ts`, `types.ts`)
  - [ ] 2.2 Implement `waitForLogEvent(logGroupName, saveId, detailType, options?)` that wraps `FilterLogEventsCommand` with retry
  - [ ] 2.3 Use **dynamic `import()`** for `@aws-sdk/client-cloudwatch-logs` inside the helper function — NOT top-level import. This prevents crashing the runner for non-Phase-7 runs if the package isn't installed. Matches the `auto-auth.ts` lazy-import pattern.
  - [ ] 2.4 Filter pattern must include BOTH `saveId` AND `detail-type`: `{ $.detail.saveId = "<saveId>" && $["detail-type"] = "<detailType>" }`. Without `detail-type`, EB2 could match EB1's `SaveCreated` event instead of `SaveUpdated`.
  - [ ] 2.5 Default: 3 retries, 5-second intervals, configurable via options
  - [ ] 2.6 Parse returned log events — EventBridge writes full JSON envelope as log message; extract and parse `detail-type`, `source`, `detail`
  - [ ] 2.7 Return parsed event detail on match, throw on timeout with clear message
  - [ ] 2.8 Wrap first `FilterLogEvents` call in try/catch — detect `AccessDeniedException` and re-throw with: `"Missing logs:FilterLogEvents permission. Ensure your AWS credentials have CloudWatch Logs read access."`
- [ ] Task 3: Create `scripts/smoke-test/scenarios/eventbridge-verify.ts` (EB1–EB3) (AC: #2, #4)
  - [ ] 3.1 Check `SMOKE_TEST_EVENT_LOG_GROUP` env var; throw `ScenarioSkipped` if missing (graceful Phase 7 skip)
  - [ ] 3.2 EB1: POST /saves with unique URL → wait → query CW Logs for `SaveCreated` with matching `saveId` → assert `source` is `ai-learning-hub.saves`
  - [ ] 3.3 EB2: PATCH /saves/:saveId with `{ title: "EB2 Smoke" }` → wait → query CW Logs for `SaveUpdated` → assert `detail.updatedFields` present
  - [ ] 3.4 EB3: DELETE /saves/:saveId → wait → query CW Logs for `SaveDeleted` → assert matching `saveId`
  - [ ] 3.5 Export `initEventBridgeCleanup(register)` hook to soft-delete the save after all scenarios
- [ ] Task 4: Register Phase 7 in phase registry (AC: #4, #6)
  - [ ] 4.1 Import `eventBridgeVerifyScenarios` and `initEventBridgeCleanup` in `phases.ts`
  - [ ] 4.2 Add Phase 7 entry: `{ id: 7, name: "EventBridge Verification", scenarios: [...eventBridgeVerifyScenarios], init: ... }`
- [ ] Task 5: Update `.env.smoke.example` with `SMOKE_TEST_EVENT_LOG_GROUP` documentation
  - [ ] 5.1 Add a new section for EventBridge verification env var
  - [ ] 5.2 Include instructions on how to get the value (stack output or AWS Console)
- [ ] Task 6: Verify (AC: #5, #6, #7)
  - [ ] 6.1 Run `npm run lint` — passes
  - [ ] 6.2 Run `npm run smoke-test -- --phase=1` — existing results unchanged
  - [ ] 6.3 Run `npm run smoke-test -- --phase=7` without `SMOKE_TEST_EVENT_LOG_GROUP` — Phase 7 skipped gracefully
  - [ ] 6.4 Run `npm run smoke-test -- --phase=7` with `SMOKE_TEST_EVENT_LOG_GROUP` set — EB1–EB3 pass against deployed env (requires 3.1.8 deployed)
  - [ ] 6.5 Run full suite — all phases pass

## Dev Notes

- **Scope:** Smoke test scenarios only. No Lambda handler changes, no CDK changes. This story consumes the infrastructure created by Story 3.1.8 (CloudWatch Log Group target on EventBridge bus). If 3.1.8 is not deployed, Phase 7 skips gracefully.
- **Location:** All changes in `scripts/smoke-test/`. New files: `cloudwatch-helpers.ts`, `scenarios/eventbridge-verify.ts`. Modified: `phases.ts`, `.env.smoke.example`.
- **Why this validates more than "events don't 500":** Without this scenario, EventBridge could silently fail — the handlers fire events fire-and-forget via `emitEvent()` and do not check the `PutEvents` response for errors. A missing IAM permission, wrong bus name, or bus deletion would be invisible. This scenario proves the full chain: Lambda → `emitEvent()` → EventBridge SDK → EventBridge Bus → Rule match → CloudWatch Logs target → log entry queryable.
- **Prerequisite check:** Before implementing EB2 and EB3, verify that `saves-update/handler.ts` and `saves-delete/handler.ts` actually call `emitEvent()` with `SaveUpdated` and `SaveDeleted` detail types. The event type definitions exist in `backend/shared/events/src/events/saves.ts`, but defining a type does not guarantee the handler emits it. If emission is missing from a handler, EB2/EB3 will correctly FAIL — which is the intended behavior (the smoke test surfaces the gap). Document the finding if emission is missing rather than skipping the scenario.

### CloudWatch Logs Event Envelope

When EventBridge delivers events to a CloudWatch Log Group target, each log entry is a JSON string with this structure:

```json
{
  "version": "0",
  "id": "unique-event-id",
  "detail-type": "SaveCreated",
  "source": "ai-learning-hub.saves",
  "account": "<aws-account-id>",
  "time": "2026-02-25T10:30:00Z",
  "region": "us-east-1",
  "resources": [],
  "detail": {
    "userId": "user_xxx",
    "saveId": "save_xxx",
    "url": "https://example.com",
    "normalizedUrl": "example.com",
    "urlHash": "abc123",
    "contentType": "blog"
  }
}
```

- **Query by:** `saveId` AND `detail-type` together. Use `FilterLogEvents` with `filterPattern: '{ $.detail.saveId = "<saveId>" && $["detail-type"] = "<detailType>" }'`. This ensures EB2 finds the `SaveUpdated` event, not EB1's `SaveCreated` event for the same saveId. Note: `detail-type` contains a hyphen, requiring bracket notation (`$["detail-type"]`).
- **Validate:** After parsing, confirm `source` matches `ai-learning-hub.saves` and `detail` contains expected fields.
- **Latency:** EventBridge → CloudWatch Logs delivery is typically 1–5 seconds but can spike to 10+ under load. The retry strategy (3 retries × 5s = 15s max) provides adequate headroom. If flaky, increase to 5 retries × 3s. Note: the 3.1.8 contract section suggests "2-second intervals" as an example, but the epic plan specifies 5-second intervals — use 5s as it provides better headroom for real-world latency spikes.
- **Log event message field:** The `FilterLogEvents` API returns `events[].message` which is the full JSON string above. Parse with `JSON.parse(event.message)` to access fields. After parsing, the `detail` field is already a JavaScript object (not a JSON string) — do NOT double-parse it. Access fields directly: `parsed.detail.saveId`, `parsed["detail-type"]`. This is different from the EventBridge API's `GetEvents` where `Detail` is a JSON string requiring `JSON.parse()`.
- **Delivery guarantees:** EventBridge → CW Logs is at-least-once delivery with no latency SLA. Occasional timeouts during AWS service degradation are expected, not bugs. If Phase 7 is flaky in CI, increase retry count before investigating further.
- **Filter pattern debugging:** CloudWatch Logs filter patterns fail silently — a syntax error (e.g., `$.detail-type` instead of `$["detail-type"]`) returns zero results, not an error. If `waitForLogEvent` always times out, first verify the filter pattern manually in the AWS Console (CloudWatch → Log Groups → filter events) before debugging code.
- **Why `FilterLogEvents` not Logs Insights:** `FilterLogEvents` is synchronous — one request, immediate results. Logs Insights (`StartQuery`/`GetQueryResults`) is async — start query, poll for completion, fetch results. For a smoke test checking one specific event, `FilterLogEvents` is simpler, faster, and sufficient. Do not "improve" by switching to Logs Insights.

### Retry Strategy for CloudWatch Logs Polling

```
Attempt 1: FilterLogEvents immediately after API call
  → If match found: short-circuit, return parsed event
  → If no match: wait 5 seconds
Attempt 2: FilterLogEvents again
  → If match found: short-circuit, return parsed event
  → If no match: wait 5 seconds
Attempt 3: FilterLogEvents final attempt
  → If match found: return parsed event
  → If no match: throw Error("EventBridge event not found in CloudWatch Logs after 15s")
```

Use `startTime` parameter set to ~30 seconds before the API call to bound the query window and avoid scanning old log entries from previous test runs.

### AWS SDK Pattern

```typescript
// CRITICAL: Use dynamic import() — NOT top-level import.
// Top-level import would make @aws-sdk/client-cloudwatch-logs a hard
// dependency for ALL phases, crashing the runner even for --phase=1
// if the package isn't installed. Matches the lazy-import pattern
// used by auto-auth.ts in run.ts.
const { CloudWatchLogsClient, FilterLogEventsCommand } = await import(
  "@aws-sdk/client-cloudwatch-logs"
);

const cwlClient = new CloudWatchLogsClient({});

const result = await cwlClient.send(
  new FilterLogEventsCommand({
    logGroupName: process.env.SMOKE_TEST_EVENT_LOG_GROUP,
    filterPattern: `{ $.detail.saveId = "${saveId}" && $["detail-type"] = "${detailType}" }`,
    startTime: queryStartEpochMs,
  })
);
```

The `CloudWatchLogsClient` uses the default credential chain — same credentials that run `cdk deploy`. The `logs:FilterLogEvents` permission is typically available via AdministratorAccess or the CDK bootstrap role. Wrap the first `FilterLogEvents` call in a try/catch that detects `AccessDeniedException` and re-throws with a helpful message: `"Missing logs:FilterLogEvents permission. Ensure your AWS credentials have CloudWatch Logs read access."`

### Scenario Chaining and Cleanup

EB1, EB2, EB3 form a chain (EB2 and EB3 operate on the save created in EB1). Module-level `createdSaveId` is shared across scenarios — same pattern as `saves-crud.ts`. Cleanup hook soft-deletes the save after all scenarios complete.

### `ScenarioSkipped` for Graceful Degradation

When `SMOKE_TEST_EVENT_LOG_GROUP` is not set, EB1 throws `ScenarioSkipped`. The runner catches this and marks EB1 as `SKIP`. EB2 and EB3 will also skip because `createdSaveId` will be null (same guard pattern as saves-crud scenarios).

### Project Structure Notes

- **New:** `scripts/smoke-test/cloudwatch-helpers.ts` — CloudWatch Logs query helper with retry logic (flat file, matching existing `helpers.ts` / `client.ts` / `types.ts` convention).
- **New:** `scripts/smoke-test/scenarios/eventbridge-verify.ts` — EB1–EB3 scenario definitions.
- **Modified:** `scripts/smoke-test/phases.ts` — Add Phase 7 registration.
- **Modified:** `scripts/smoke-test/.env.smoke.example` — Add `SMOKE_TEST_EVENT_LOG_GROUP` documentation.
- **Do not touch:** `backend/`, `infra/`, `shared/`, any Lambda handler code.

### References

- [Source: docs/progress/epic-3-1-stories-and-plan.md] — Story 3.1.9 goal, AC, tasks, Dev Notes.
- [Source: _bmad-output/implementation-artifacts/3-1-8-eventbridge-observability-infra.md] — 3.1.9 Contract: CloudWatch Logs Event Envelope, expected latency, CW Logs Insights query example.
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-003] — EventBridge for async communication; event catalog.
- [Source: backend/shared/events/src/events/saves.ts] — Event source (`ai-learning-hub.saves`), detail types (`SaveCreated`, `SaveUpdated`, `SaveDeleted`), detail shapes.
- [Source: scripts/smoke-test/scenarios/saves-crud.ts] — Existing scenario pattern: `ScenarioDefinition[]`, module-level state, cleanup hooks, `jwtAuth()`, `getClient()`.
- [Source: scripts/smoke-test/types.ts] — `ScenarioSkipped` class for graceful skip, `ScenarioDefinition` and `CleanupFn` types.
- [Source: scripts/smoke-test/phases.ts] — Phase registry: current phases (1, 2, 4); Phase 7 slot open.
- [Source: scripts/smoke-test/helpers.ts] — `jwtAuth()`, `assertSaveShape()`, `assertADR008()`, `assertStatus()` — reuse these in EB scenarios.

## Developer Context & Guardrails

### Technical Requirements

- **AWS SDK:** `@aws-sdk/client-cloudwatch-logs` (`FilterLogEventsCommand`, `CloudWatchLogsClient`). Add as root `devDependency` — it is only used by the smoke test runner, not by Lambda handlers.
- **Credential chain:** Default AWS credential provider. Same machine that runs `cdk deploy` already has the necessary permissions. No new IAM resources needed. Required permission: `logs:FilterLogEvents` on the log group ARN.
- **Filter pattern syntax:** CloudWatch Logs JSON filter: `{ $.detail.saveId = "<saveId>" }`. This filters server-side, reducing data transfer. The `$` references the root of the JSON message.
- **Retry timing:** 3 retries × 5-second sleep = max 15 seconds per event check. Start time bound: `Date.now() - 30_000` to exclude old events. This is smoke testing, not load testing — sequential polling is appropriate.
- **No new Lambda code.** No changes under `backend/functions/` or `shared/`.

### Architecture Compliance

- **ADR-003:** EventBridge for async communication. This story validates the infrastructure from ADR-003 works end-to-end in the deployed environment.
- **ADR-008:** Error shapes. The scenarios that call `/saves` reuse existing helpers (`assertSaveShape`, `assertADR008`, `assertStatus`) — no new error assertion logic needed.
- **File guard:** `scripts/smoke-test/` is NOT in the escalate zone. No infra or backend changes.
- **Import guard:** Smoke test files are standalone (run via `tsx`, not part of the vitest suite). They import from `../helpers.js`, `../client.js`, `../types.js` — not from `@ai-learning-hub/*`. The `@aws-sdk/client-cloudwatch-logs` import is in the helper file, not in Lambda code.

### Library / Framework Requirements

- **New dependency:** `@aws-sdk/client-cloudwatch-logs` — latest version. The project already uses multiple `@aws-sdk/*` packages (v3): `@aws-sdk/client-eventbridge`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-ssm`. Use the same v3 family for consistency.
- **Existing:** `tsx` (dev runner), native `fetch` (Node.js 20+). No additional packages needed.

### File Structure Requirements

- **Created:** `scripts/smoke-test/cloudwatch-helpers.ts` — flat file for CloudWatch Logs query helper (separate from `helpers.ts` to isolate the `@aws-sdk/client-cloudwatch-logs` import).
- **Created:** `scripts/smoke-test/scenarios/eventbridge-verify.ts` — Phase 7 scenarios.
- **Modified:** `scripts/smoke-test/phases.ts` — Phase 7 registration.
- **Modified:** `scripts/smoke-test/.env.smoke.example` — `SMOKE_TEST_EVENT_LOG_GROUP` env var documentation.
- **Optionally modified:** `scripts/smoke-test/.env.smoke` — add the env var (if the file exists and is gitignored, this is a local-only change).

### Testing Requirements

- **No vitest tests for smoke test scenarios.** The smoke tests themselves ARE the tests — they run against a deployed environment, not in vitest. This is consistent with the existing pattern (no `*.test.ts` files in `scripts/smoke-test/`).
- **Lint:** `npm run lint` must pass after all changes.
- **Manual verification:** Run `npm run smoke-test -- --phase=7` with `SMOKE_TEST_EVENT_LOG_GROUP` set to `/aws/events/ai-learning-hub-events` (or the value from the stack output `AiLearningHub-EventLogGroupName`). All three scenarios (EB1–EB3) should pass.
- **Graceful skip:** Run `npm run smoke-test -- --phase=7` without `SMOKE_TEST_EVENT_LOG_GROUP`. All scenarios should show `SKIP` status with clear message.
- **Regression:** Run `npm run smoke-test -- --phase=1` and `--phase=2` — unchanged behavior.

### Previous Story Intelligence (Epic 3.1 Track B)

- **3.1.5** introduced the phase runner infra (`phases.ts`, `getFilteredPhases()`, `Phase` interface). The `init` hook pattern for cleanup registration is established.
- **3.1.6** added saves-crud (Phase 2) and saves-validation (Phase 4) scenarios. The scenario file pattern (`saves-crud.ts`) is the template for this story: module-level state, `ScenarioDefinition[]` export, `initXxxCleanup` export, cleanup via `registerCleanupFn`.
- **3.1.8** is the infra prerequisite — creates the CloudWatch Log Group and EventBridge Rule. The log group name is `/aws/events/ai-learning-hub-events` (exported as stack output `AiLearningHub-EventLogGroupName`). The 3.1.8 story includes a "3.1.9 Contract" section documenting the exact event envelope, query approach, and expected latency.
- **Events package:** `backend/shared/events/src/events/saves.ts` defines the source constant (`SAVES_EVENT_SOURCE = "ai-learning-hub.saves"`) and detail types (`SaveCreated`, `SaveUpdated`, `SaveDeleted`). The smoke test should hardcode these strings rather than importing from the shared package (smoke tests are standalone, not part of the npm workspace build).
- **Phase numbering:** Story 3.1.7 was planned to add Phases 3, 5, 6 but those are not yet in the current `phases.ts`. Phase 7 can be added independently regardless of 3.1.7's smoke test status.
- **Runtime independence:** Phase 7 has NO runtime dependency on Phase 2. EB1 creates its own save — it does not reuse saves from Phase 2 scenarios. Phase 7 is runnable via `--phase=7` without running any other phase first. The dependency on Story 3.1.6 is a *story-level* dependency (the code pattern was established there), not a *phase runtime* dependency. The Phase 7 registry entry should NOT have a `dependsOn` field.

### Project Context Reference

- **Epic 3.1 plan:** `docs/progress/epic-3-1-stories-and-plan.md` — Track B, Story 3.1.9 section; dependencies: 3.1.6 + 3.1.8.
- **Event bus:** Name `ai-learning-hub-events`; sources use prefix `ai-learning-hub` (e.g. `ai-learning-hub.saves`).
- **Log group:** `/aws/events/ai-learning-hub-events` (created by Story 3.1.8).
- **Smoke test infra:** `scripts/smoke-test/` — runner, client, helpers, types, phases, scenarios.
- **Events stack:** `infra/lib/stacks/core/events.stack.ts` — currently: EventBus + 2 outputs. After 3.1.8: + LogGroup + Rule + output.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
