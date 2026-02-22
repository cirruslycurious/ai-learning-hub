# Story 2.1-D11: Fix Deploy to Dev — Delete Orphaned DynamoDB Tables

Status: done

## Story

As a **developer**,
I want **orphaned DynamoDB tables cleaned up and the CloudFormation stack restored to a deployable state**,
so that **the Deploy to Dev CI pipeline succeeds and `dev-ai-learning-hub-*` tables are created correctly**.

## Context

Story 2.1-D7 renamed all 7 DynamoDB tables from `ai-learning-hub-*` to `dev-ai-learning-hub-*` by adding an `environmentPrefix` prop to `TablesStack`. Because `tableName` is an immutable/create-time DynamoDB property, CloudFormation treated this as a **resource replacement**: it attempted to create new `dev-ai-learning-hub-*` tables first, then retain the old ones (due to `removalPolicy: RETAIN`).

The most likely failure scenario: the first deploy after D7 may have **partially succeeded** — creating some or all `dev-ai-learning-hub-*` tables — then hit an error or timeout, causing CloudFormation to **roll back**. Because of `removalPolicy: RETAIN`, the newly-created `dev-*` tables **survived the rollback**. Subsequent deploys then fail with `AlreadyExists` on the `dev-*` tables (CloudFormation tries to create them again since they're not in the stack's resource map after rollback).

Additionally, the old unprefixed `ai-learning-hub-*` tables may still exist as orphaned resources.

**Bottom line:** We need to diagnose the exact state (which tables exist, what state the CF stack is in), clean up all orphaned tables, fix the CF stack state if needed, and re-deploy.

The tables are empty — the project is still in foundation-building phase. Safe to delete.

## Acceptance Criteria

1. **AC1:** All orphaned DynamoDB tables (both old `ai-learning-hub-*` and any stale `dev-ai-learning-hub-*` from failed rollbacks) are deleted from the AWS dev account in **us-east-2**.

2. **AC2:** The `AiLearningHubTables` CloudFormation stack is in a deployable state (`CREATE_COMPLETE`, `UPDATE_COMPLETE`, or deleted and ready for recreation).

3. **AC3:** After cleanup, `cdk deploy --all` (via `infra/deploy.sh` or the GitHub Actions pipeline) completes successfully, creating all 7 `dev-ai-learning-hub-*` tables.

4. **AC4:** The full CI pipeline (`ci.yml`) passes end-to-end on the latest `main` commit, including Stage 8 (Deploy to Dev).

5. **AC5:** If code changes are needed (e.g., to fix CF stack state), they are minimal and scoped only to unblocking the deploy.

## Tasks / Subtasks

- [ ] Task 0: Diagnose current state (AC: #1, #2)
  - [ ] 0.1 Check CloudFormation stack state: `aws cloudformation describe-stacks --stack-name AiLearningHubTables --region us-east-2 --profile abstract`
  - [ ] 0.2 List ALL DynamoDB tables: `aws dynamodb list-tables --region us-east-2 --profile abstract`
  - [ ] 0.3 Identify which tables are orphaned — check for both `ai-learning-hub-*` (old) AND `dev-ai-learning-hub-*` (from failed rollback)
  - [ ] 0.4 Check CF stack resources: `aws cloudformation list-stack-resources --stack-name AiLearningHubTables --region us-east-2 --profile abstract` to see what CF thinks it owns
  - [ ] 0.5 Document findings before taking action
- [ ] Task 1: Clean up orphaned tables (AC: #1)
  - [ ] 1.1 Confirm orphaned tables are empty: `aws dynamodb scan --table-name <name> --select COUNT --region us-east-2 --profile abstract` for each
  - [ ] 1.2 Delete each orphaned table (both old unprefixed AND any stale dev-prefixed): `aws dynamodb delete-table --table-name <name> --region us-east-2 --profile abstract`
  - [ ] 1.3 Wait for all deletions: `aws dynamodb wait table-not-exists --table-name <name> --region us-east-2 --profile abstract` for each
- [ ] Task 2: Fix CloudFormation stack state if needed (AC: #2)
  - [ ] 2.1 **If stack is `ROLLBACK_COMPLETE`:** Delete the stack entirely: `aws cloudformation delete-stack --stack-name AiLearningHubTables --region us-east-2 --profile abstract` (CDK will recreate it on next deploy)
  - [ ] 2.2 **If stack is `UPDATE_ROLLBACK_COMPLETE`:** Stack is deployable — proceed to Task 3
  - [ ] 2.3 **If stack is `UPDATE_ROLLBACK_FAILED`:** May require `aws cloudformation continue-update-rollback` or manual stack deletion. Assess and resolve.
  - [ ] 2.4 **If stack doesn't exist:** Ready for fresh deploy — proceed to Task 3
  - [ ] 2.5 Check downstream stacks (AuthStack, ApiGatewayStack) for failed states too — they depend on TablesStack exports
- [ ] Task 3: Deploy and verify (AC: #3, #4)
  - [ ] 3.1 Run deploy locally: `cd infra && ./deploy.sh deploy --all` OR re-run GitHub Actions CI pipeline
  - [ ] 3.2 Confirm all 7 `dev-ai-learning-hub-*` tables exist: `aws dynamodb list-tables --region us-east-2 --profile abstract`
  - [ ] 3.3 Confirm CI pipeline passes end-to-end (all stages including Stage 8 Deploy to Dev)
- [ ] Task 4: Code changes if needed (AC: #5)
  - [ ] 4.1 Only if CF stack state requires it (e.g., temporary removal of RETAIN for clean teardown, or cross-stack export fixes)
  - [ ] 4.2 Keep changes minimal and revert any temporary modifications after deploy succeeds

## Dev Notes

- **Likely no code changes needed**, but do not rule them out until CF stack state is diagnosed (Task 0).
- **Region: `us-east-2`** — this project deliberately uses us-east-2 for isolation from existing us-east-1 resources.
- **AWS Profile: `abstract`** — all local CLI commands must use `--profile abstract`. The deploy wrapper (`infra/deploy.sh`) enforces this.
- **CI uses OIDC** (`role-to-assume`) for AWS auth, not profiles. The GitHub Actions pipeline configures `aws-region: us-east-2` in `ci.yml` line 285.
- The `removalPolicy: RETAIN` on all tables is intentional for production safety — it just means orphaned tables from renames need manual cleanup.
- All 7 tables follow the same pattern. Use a loop or run commands in parallel for efficiency.

### Root Cause

**Story 2.1-D7** changed `tableName` on all 7 DynamoDB tables by adding an `environmentPrefix` (default `"dev"`). Since `tableName` is immutable, CloudFormation treated this as a resource replacement: delete-old + create-new. With `removalPolicy: RETAIN`, the old tables were retained (by design) and the new tables were created. However, if the deploy hit any error mid-flight, CloudFormation rolled back — but RETAIN kept the partially-created `dev-*` tables alive. Subsequent deploys then fail because CF tries to re-create `dev-*` tables that already exist outside its state.

[Source: infra/lib/stacks/core/tables.stack.ts — all 7 tables have `removalPolicy: cdk.RemovalPolicy.RETAIN`]
[Source: infra/bin/app.ts line 25 — CF stack name is `AiLearningHubTables`]
[Source: .github/workflows/ci.yml line 285 — `aws-region: us-east-2`]

### CloudFormation Stack Name

`AiLearningHubTables` — defined in `infra/bin/app.ts`

### The 7 Tables (old → new naming)

| Old Name (orphaned)            | New Name (target)                  |
| ------------------------------ | ---------------------------------- |
| `ai-learning-hub-users`        | `dev-ai-learning-hub-users`        |
| `ai-learning-hub-saves`        | `dev-ai-learning-hub-saves`        |
| `ai-learning-hub-links`        | `dev-ai-learning-hub-links`        |
| `ai-learning-hub-projects`     | `dev-ai-learning-hub-projects`     |
| `ai-learning-hub-content`      | `dev-ai-learning-hub-content`      |
| `ai-learning-hub-search-index` | `dev-ai-learning-hub-search-index` |
| `ai-learning-hub-invite-codes` | `dev-ai-learning-hub-invite-codes` |

### Recovery Plan if Deploy Fails Again

1. Check CF stack events: `aws cloudformation describe-stack-events --stack-name AiLearningHubTables --region us-east-2 --profile abstract`
2. Check downstream stacks: AuthStack, ApiGatewayStack, SavesRoutesStack depend on TablesStack CfnOutput exports (`AiLearningHub-UsersTableName`, etc.)
3. If exports are stale/orphaned, downstream stacks may need deletion too (they can be recreated by CDK)
4. Nuclear option: delete all CDK stacks (`cdk destroy --all --profile abstract --region us-east-2`), clean up remaining RETAIN resources, redeploy from scratch. This is safe in dev — no user data exists.

### Diagnostic Commands Reference

```bash
# 1. Check CF stack state
aws cloudformation describe-stacks --stack-name AiLearningHubTables --region us-east-2 --profile abstract

# 2. List all DynamoDB tables (look for BOTH old and new names)
aws dynamodb list-tables --region us-east-2 --profile abstract

# 3. Check what CF thinks it owns
aws cloudformation list-stack-resources --stack-name AiLearningHubTables --region us-east-2 --profile abstract

# 4. Verify tables are empty before deleting
aws dynamodb scan --table-name ai-learning-hub-users --select COUNT --region us-east-2 --profile abstract
aws dynamodb scan --table-name ai-learning-hub-saves --select COUNT --region us-east-2 --profile abstract
aws dynamodb scan --table-name ai-learning-hub-links --select COUNT --region us-east-2 --profile abstract
aws dynamodb scan --table-name ai-learning-hub-projects --select COUNT --region us-east-2 --profile abstract
aws dynamodb scan --table-name ai-learning-hub-content --select COUNT --region us-east-2 --profile abstract
aws dynamodb scan --table-name ai-learning-hub-search-index --select COUNT --region us-east-2 --profile abstract
aws dynamodb scan --table-name ai-learning-hub-invite-codes --select COUNT --region us-east-2 --profile abstract

# 5. Delete orphaned tables (run for each orphaned table found in step 2)
aws dynamodb delete-table --table-name <TABLE_NAME> --region us-east-2 --profile abstract

# 6. Wait for deletions
aws dynamodb wait table-not-exists --table-name ai-learning-hub-users --region us-east-2 --profile abstract
aws dynamodb wait table-not-exists --table-name ai-learning-hub-saves --region us-east-2 --profile abstract
aws dynamodb wait table-not-exists --table-name ai-learning-hub-links --region us-east-2 --profile abstract
aws dynamodb wait table-not-exists --table-name ai-learning-hub-projects --region us-east-2 --profile abstract
aws dynamodb wait table-not-exists --table-name ai-learning-hub-content --region us-east-2 --profile abstract
aws dynamodb wait table-not-exists --table-name ai-learning-hub-search-index --region us-east-2 --profile abstract
aws dynamodb wait table-not-exists --table-name ai-learning-hub-invite-codes --region us-east-2 --profile abstract

# 7. Delete CF stack if in ROLLBACK_COMPLETE
aws cloudformation delete-stack --stack-name AiLearningHubTables --region us-east-2 --profile abstract
aws cloudformation wait stack-delete-complete --stack-name AiLearningHubTables --region us-east-2 --profile abstract

# 8. Deploy
cd infra && ./deploy.sh deploy --all

# 9. Verify new tables exist
aws dynamodb list-tables --region us-east-2 --profile abstract
```

### References

- [Source: infra/lib/stacks/core/tables.stack.ts] — Table definitions with `removalPolicy: RETAIN` and `environmentPrefix` prop
- [Source: infra/bin/app.ts line 25] — CF stack name `AiLearningHubTables`
- [Source: infra/deploy.sh] — Deploy wrapper enforcing `--profile abstract` and `us-east-2`
- [Source: .github/workflows/ci.yml lines 285, 373] — CI uses `aws-region: us-east-2` with OIDC role
- [Source: infra/config/environments.ts line 27] — Region hardcoded to `us-east-2`
- [Source: commit 48f3d76] — Story 2.1-D7 that introduced the table rename

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Story created as tech debt D11 under Epic 2.1
- Revised after adversarial review: corrected region (us-east-2 not us-east-1), corrected root cause analysis (replacement/rollback mechanism, not logical ID conflict), added CF stack state diagnosis as prerequisite, added recovery plan, softened no-code-changes constraint, added AWS auth guidance (--profile abstract), completed all wait commands
- **Completed 2026-02-22:** Diagnosis found AiLearningHubTables in UPDATE_ROLLBACK_COMPLETE with 14 tables (7 old + 7 orphaned dev-_). First attempted incremental fix (delete dev-_ tables, redeploy) but hit cross-stack export conflict (TablesStack exports consumed by AuthStack). Executed nuclear option: destroyed all 7 CDK stacks, deleted all 14 RETAIN tables, redeployed from scratch. All stacks CREATE_COMPLETE, all 7 dev-\* tables created, CI pipeline fully green (all 10 stages). No code changes needed.

### File List

No files modified — AWS CLI operations only.
