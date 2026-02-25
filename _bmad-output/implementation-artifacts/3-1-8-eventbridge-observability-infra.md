# Story 3.1.8: EventBridge Observability Infrastructure

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer/operator**,
I want **a CloudWatch Log Group target on the EventBridge event bus so all events are logged**,
so that **we have observability into event flow and Story 3.1.9 can verify EventBridge wiring by querying CloudWatch Logs**.

## Acceptance Criteria

| #   | Given                                                            | When                                                                | Then                                                                                                                                         |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | EventBridge bus has no rules or targets for logging              | CDK stack updated with a rule + CloudWatch Log Group target         | New `events.Rule` on the bus matches all events (`{ source: [{ prefix: "ai-learning-hub" }] }`) and targets a CloudWatch Log Group           |
| AC2 | No explicit CloudWatch Log Group exists for event bus logging    | Log group created by CDK                                            | Log group named `/aws/events/ai-learning-hub-events` exists with retention policy of 14 days (dev) / 90 days (prod based on stage param)     |
| AC3 | EventBridge needs permission to write to CloudWatch Logs          | CDK grants necessary permissions                                    | The rule target has the correct resource policy allowing `events.amazonaws.com` to create log streams and put log events                     |
| AC4 | Observability stack exists but only has X-Ray sampling           | EventBridge logging added to events stack (not observability stack)  | Changes are in `infra/lib/stacks/core/events.stack.ts` (co-located with the bus); observability stack is not modified                      |
| AC5 | CDK Nag may flag new resources                                   | `cdk synth` runs                                                    | No new CDK Nag errors; suppressions added with documented reasons if needed                                                                  |
| AC6 | Infrastructure deploys cleanly                                    | `cdk deploy` runs                                                   | Stack deploys without errors; CloudWatch Log Group visible in AWS Console; creating a save via API produces a log entry in the new log group |
| AC7 | All existing tests pass                                         | After CDK changes                                                   | `npm test` passes; `npm run lint` passes; no changes to Lambda handler code                                                                  |

## Tasks / Subtasks

- [ ] Task 1: Add CloudWatch Log Group to events stack (AC: #2, #4)
  - [ ] 1.1 Import `aws-cdk-lib/aws-logs` in `events.stack.ts`
  - [ ] 1.2 Create `LogGroup` with name `/aws/events/ai-learning-hub-events` and appropriate retention
  - [ ] 1.3 Export log group name as stack output (`AiLearningHub-EventLogGroupName`)
- [ ] Task 2: Add EventBridge Rule with Log Group target (AC: #1, #3)
  - [ ] 2.1 Create `events.Rule` matching `source: [{ prefix: "ai-learning-hub" }]`
  - [ ] 2.2 Add `CloudWatchLogGroup` target pointing to the log group
  - [ ] 2.3 CDK handles the resource policy automatically via `targets.CloudWatchLogGroup`
- [ ] Task 3: Add CDK stack tests (AC: #7)
  - [ ] 3.1 Create `infra/test/stacks/core/events.stack.test.ts` (no existing test file for EventsStack)
  - [ ] 3.2 Assert template contains `AWS::Logs::LogGroup` with correct retention
  - [ ] 3.3 Assert template contains `AWS::Events::Rule` with source prefix pattern
  - [ ] 3.4 Assert template contains `AWS::CloudFormation::Output` for log group name
- [ ] Task 4: Handle CDK Nag (AC: #5)
  - [ ] 4.1 Run `cdk synth` and check for Nag findings
  - [ ] 4.2 Add suppressions with documented reasons if needed
- [ ] Task 5: Verify (AC: #6, #7)
  - [ ] 5.1 Run `npm test` — passes (including new stack tests)
  - [ ] 5.2 Run `npm run lint` — passes
  - [ ] 5.3 Run `cdk synth` — succeeds without errors
  - [ ] 5.4 After deploy: create a save via API, check CloudWatch Log Group for matching event entry

## Dev Notes

- **Scope:** Infrastructure only. No Lambda handler changes — handlers already call `emitEvent()` fire-and-forget. This story adds CDK to capture those events in CloudWatch Logs.
- **Location:** All changes in `infra/lib/stacks/core/events.stack.ts`. Do not modify `infra/lib/stacks/observability/observability.stack.ts` — the log group is coupled to the event bus, so it lives with the bus. Observability stack is for cross-cutting dashboards, alarms, X-Ray.
- **Retention:** 14 days for dev/staging (cost); 90 days for production (incident investigation). Use a stage parameter (CDK context or stack props) to vary retention; document how stage is passed if not already in app.
- **What gets logged:** Every event on the bus (source prefix `ai-learning-hub`). Detail includes full payload (e.g. `userId`, `saveId`, `normalizedUrl`, `urlHash` for `SaveCreated`). Event payloads include userId and URLs, which may contain sensitive data in query strings. CloudWatch Logs uses AWS-managed encryption at rest by default; CMK encryption and URL redaction are considerations for production hardening (Epic 10).
- **What this is NOT:** This is infrastructure event logging for operators (NFR-O1/O2), not the per-entity event history API for agents (FR102/NFR-AN4, which is Epic 3.2.3 scope). The 90-day production retention is for incident investigation, not agent-queryable event history.
- **Known event payload gaps:** Event detail types currently lack `requestId`/`correlationId` (limits tracing events back to originating API requests) and `actor_type` (human vs. agent attribution). These fields will be added when Epic 3.2 builds agent identity middleware (3.2.4). Once enriched, events captured by this log group gain correlation and agent attribution for free — no changes to this infrastructure needed.
- **Source convention:** The rule matches `source: [{ prefix: "ai-learning-hub" }]`. All event sources MUST follow the `ai-learning-hub.*` convention. The shared events package enforces this via constants (e.g. `SAVES_EVENT_SOURCE = "ai-learning-hub.saves"`).
- **Bus name:** Current stack uses `eventBusName: "ai-learning-hub-events"`. If the project uses `environmentPrefix` for multi-environment (see review finding in .claude/review-findings-3-1b.md), ensure log group name and rule are consistent with that pattern; otherwise keep as single-bus naming per existing stack.
- **Cost:** At boutique scale (~100 events/day x ~1KB/event), CloudWatch Logs cost is negligible (<$0.01/month for ingestion and storage). Well within NFR-C1 ($50/month cap).
- **Future scope:** Alarming on this log group (e.g. dead event bus detection, event throughput metrics) and CloudWatch Logs Insights saved queries are Epic 10 (Admin & Analytics) scope, not this story.
- **Story 3.1.9 dependency:** This story unblocks 3.1.9 (EventBridge verification smoke scenario). 3.1.9 will use `SMOKE_TEST_EVENT_LOG_GROUP` (or stack output) to query this log group after creating a save.

### 3.1.9 Contract: CloudWatch Logs Event Envelope

When EventBridge delivers events to a CloudWatch Log Group target, each log entry is a JSON object with this structure:

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

- **Query by:** `detail-type` (e.g. `SaveCreated`) and `source` (e.g. `ai-learning-hub.saves`). The `detail` object contains the domain-specific payload matching the event detail types in `backend/shared/events/src/events/saves.ts`.
- **Expected latency:** EventBridge to CloudWatch Logs delivery is typically 1-5 seconds. 3.1.9 smoke tests should poll with a short retry loop (e.g. 3 attempts, 2-second intervals) rather than a fixed sleep.
- **CloudWatch Logs Insights query example:** `fields @timestamp, detail.saveId, detail.userId | filter detail-type = "SaveCreated" | sort @timestamp desc | limit 10`

### Project Structure Notes

- **Touch:** `infra/lib/stacks/core/events.stack.ts` (primary). Create `infra/test/stacks/core/events.stack.test.ts` (no existing CDK stack tests for EventsStack — this story must add them).
- **Do not touch:** `backend/`, `shared/`, observability stack, Lambda code.
- **CDK patterns:** Follow existing events stack style (constructs, outputs). Use `aws-cdk-lib/aws-logs` for `LogGroup`, `aws-cdk-lib/aws-events-targets` for `CloudWatchLogGroup` target.

### References

- [Source: docs/progress/epic-3-1-stories-and-plan.md] — Story 3.1.8 goal, AC, tasks, Dev Notes (why events stack not observability; retention; no handler changes).
- [Source: infra/lib/stacks/core/events.stack.ts] — Current Events stack: EventBus, outputs; add LogGroup + Rule here.
- [Source: _bmad-output/planning-artifacts/architecture.md] — ADR-003 EventBridge + Step Functions; event catalog (SaveCreated, SaveUpdated, etc.).
- [Source: .claude/review-findings-3-1b.md] — EventBridge bus name / environment prefix consideration for multi-env.

## Developer Context & Guardrails

### Technical Requirements

- **CDK:** TypeScript, `aws-cdk-lib`. Use `events.Rule` with `eventPattern: { source: [{ prefix: "ai-learning-hub" }] }` so all project events are captured.
- **Log group:** `aws-cdk-lib/aws-logs`. Log group name `/aws/events/ai-learning-hub-events` (or parameterized if multi-env). Retention via `retention` property (e.g. `RetentionDays.FOURTEEN_DAYS` / `RetentionDays.NINETY_DAYS`).
- **Target:** `aws-cdk-lib/aws-events-targets`. `CloudWatchLogGroup` from `aws-events-targets` automatically sets the resource policy for EventBridge to write to the log group.
- **Output:** Export log group name (e.g. `AiLearningHub-EventLogGroupName`) so smoke test (3.1.9) can resolve it via stack output or env.
- **No new Lambda code.** No changes under `backend/functions/` or `shared/`.

### Architecture Compliance

- **ADR-003:** EventBridge for async; this story adds observability of that bus (logging), not new event producers.
- **ADR-006:** CDK multi-stack; changes stay in core events stack, not observability stack.
- **File guard:** `infra/` is ESCALATE — ask before modifying; this story explicitly scopes edits to `infra/lib/stacks/core/events.stack.ts` and `infra/test/stacks/core/events.stack.test.ts`.

### Library / Framework Requirements

- **AWS CDK:** Use existing `aws-cdk-lib` and construct patterns from the repo. No new CDK packages required; `aws-logs` and `aws-events-targets` are part of `aws-cdk-lib`.

### File Structure Requirements

- **Modified:** `infra/lib/stacks/core/events.stack.ts`.
- **Created:** `infra/test/stacks/core/events.stack.test.ts` (no existing test file — must be added).

### Testing Requirements

- **CDK stack tests (required):** Create `infra/test/stacks/core/events.stack.test.ts`. Assert: LogGroup exists with correct retention, EventBridge Rule exists with `ai-learning-hub` source prefix pattern, CloudWatchLogGroup target is wired, stack output for log group name is exported. No existing CDK test file for EventsStack — this story adds the first one.
- **Lint/build:** `npm run lint` and `npm test` must pass. `cdk synth` must succeed.
- **Manual verification:** After deploy, `POST /saves` and confirm a log entry appears in `/aws/events/ai-learning-hub-events` (AC6).

### Previous Story Intelligence (Epic 3.1 Track B)

- **3.1.5** introduced phase runner and phase registry; Phase 7 (`eventbridge`) is reserved for 3.1.9. This story (3.1.8) does not touch `scripts/smoke-test/` — it only adds infra so 3.1.9 can query logs.
- **3.1.6 / 3.1.7** added saves CRUD, validation, dedup, filtering, API key scenarios. They run against the API and do not depend on EventBridge logging. 3.1.8 has no dependency on 3.1.6 or 3.1.7; it can be implemented in parallel.
- **Events stack** was created in Story 3.1b; it currently defines the bus and two outputs (name, ARN). Adding a rule and log group in the same stack keeps event-bus concerns in one place.

### Project Context Reference

- **Epic 3.1 plan:** `docs/progress/epic-3-1-stories-and-plan.md` — Track B, Story 3.1.8 section; dependency: none (can start immediately); unblocks 3.1.9.
- **Event bus:** Name `ai-learning-hub-events` in current stack; sources use prefix `ai-learning-hub` (e.g. `ai-learning-hub.saves`).
- **Observability stack:** `infra/lib/stacks/observability/observability.stack.ts` — dashboards, alarms, X-Ray. Do not add EventBridge log group here.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
