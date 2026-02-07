# Story 1.8: DynamoDB Tables and S3 Buckets (Core Infrastructure)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer (human or AI agent)**,
I want **DynamoDB tables (7) and S3 buckets defined and deployable via CDK in the core stack**,
so that **all user data, content, and project notes have durable, encrypted storage with correct key patterns and GSIs, and later stories can depend on these resources**.

**Implementation & deployment:** When an agent implements this story, they must **build and deploy the infrastructure to AWS**. The deliverable is not only CDK code and passing tests — the agent must run deployment (e.g. `cdk deploy` from `infra/` or `npm run deploy:dev`) so that the DynamoDB tables and S3 bucket(s) actually exist in the target AWS account. CI may run `cdk synth` only; this story’s completion includes a successful deploy to AWS.

## Acceptance Criteria

1. **AC1: Seven DynamoDB tables exist per ADR-001**
   - GIVEN the architecture (ADR-001)
   WHEN the core infrastructure is deployed
   THEN the following tables exist with correct partition/sort keys:
   - `users` — PK: `USER#<clerkId>`, SK: `PROFILE` or `APIKEY#<keyId>`
   - `saves` — PK: `USER#<userId>`, SK: `SAVE#<saveId>`
   - `projects` — PK: `USER#<userId>`, SK: `PROJECT#<projectId>` or `FOLDER#<folderId>`
   - `links` — PK: `USER#<userId>`, SK: `LINK#<projectId>#<saveId>`
   - `content` — PK: `CONTENT#<urlHash>`, SK: `META`
   - `search-index` — PK: `USER#<userId>`, SK: `INDEX#<sourceType>#<sourceId>`
   - `invite-codes` — PK: `CODE#<code>`, SK: `META`
   AND table names are passed to consuming stacks via exports (no hardcoding)

2. **AC2: Ten GSIs defined per database-schema**
   - GIVEN the tables in AC1
   WHEN the stacks are synthesized
   THEN the following GSIs exist:
   - users: `apiKeyHash-index` (keyHash)
   - saves: `userId-contentType-index`, `userId-tutorialStatus-index`, `urlHash-index`
   - projects: `userId-status-index`, `userId-folderId-index`
   - links: `userId-projectId-index`, `userId-saveId-index`
   - search-index: `userId-sourceType-index`
   - invite-codes: `generatedBy-index`
   AND GSI names/ARNs are exported for Lambda and workflow stacks

3. **AC3: S3 bucket(s) for project notes**
   - GIVEN the architecture (notes in S3 per ADR-010, pipeline 2)
   WHEN the core stack is deployed
   THEN at least one S3 bucket exists for project notes (large Markdown content)
   AND bucket has encryption at rest (SSE-S3 or SSE-KMS per NFR-S1)
   AND bucket name is exported for API/workflow stacks
   AND lifecycle/versioning policy is defined (e.g. versioning for durability)

4. **AC4: Encryption and durability (NFR-S1, NFR-R3)**
   - GIVEN DynamoDB tables and S3 bucket(s)
   WHEN resources are created
   THEN DynamoDB uses server-side encryption (default or explicit SSE)
   AND Point-in-Time Recovery (PITR) is enabled for DynamoDB tables where required by NFR-R3
   AND S3 bucket has encryption at rest
   AND no plaintext storage of user data

5. **AC5: Core stacks integrated into CDK app**
   - GIVEN `infra/bin/app.ts` and ADR-006 stack structure
   WHEN `cdk synth` runs
   THEN a core stack (or split tables.stack + buckets.stack) is instantiated
   AND stack(s) use `awsEnv` (getAwsEnv()) for account/region — no hardcoded IDs
   AND stack outputs export table names/bucket names (or ARNs) for other stacks
   AND deployment order is Core → Auth → API → Workflows → Observability

6. **AC6: CDK Nag and tests**
   - GIVEN the new stacks
   WHEN `cdk synth` runs
   THEN CDK Nag (AwsSolutionsChecks) runs and critical findings are resolved or suppressed with justification
   AND unit tests exist for stack structure (table count, key attributes, GSI presence, S3 encryption)
   AND tests do not require live AWS (use assertions on synthesized template)

## Tasks / Subtasks

- [ ] **Task 1: Create DynamoDB tables stack** (AC: 1, 2, 4, 5)
  - Add `infra/lib/stacks/core/tables.stack.ts` (or single core.stack.ts with tables)
  - Define 7 tables with exact PK/SK from .claude/docs/database-schema.md
  - Add 10 GSIs with correct partition/sort key projections
  - Enable encryption at rest; enable PITR for user/content tables per NFR-R3
  - Export table names (or ARNs) via CfnOutput or cross-stack references
  - Use `awsEnv` from config; no hardcoded account/region

- [ ] **Task 2: Create S3 buckets stack** (AC: 3, 4, 5)
  - Add `infra/lib/stacks/core/buckets.stack.ts` or include in core stack
  - Create project-notes bucket with encryption (SSE-S3 or SSE-KMS)
  - Configure versioning and/or lifecycle as per architecture
  - Export bucket name for API/workflow stacks

- [ ] **Task 3: Wire core stacks into app** (AC: 5)
  - In `infra/bin/app.ts`, instantiate core stack(s) with `awsEnv`
  - Ensure stack IDs follow convention (e.g. `AiLearningHubCore`, `AiLearningHubTables`)
  - Verify deployment order: core first, then auth/api/workflows/observability when added

- [ ] **Task 4: CDK Nag and unit tests** (AC: 6)
  - Run `cdk synth` and fix or document any AwsSolutionsChecks findings for new resources
  - Add tests in `infra/test/` that assert: 7 tables, correct key schemas, 10 GSIs, S3 bucket with encryption
  - Use `Template.fromStack()` or similar to assert on synthesized template; no live AWS calls

- [ ] **Task 5: Deploy to AWS and validate** (AC: 1–6)
  - Deploy the core stack(s) to AWS (e.g. `cdk deploy --all` from infra/ or `npm run deploy:dev`). The infrastructure must exist in the target AWS account when this story is complete.
  - Document table/bucket names and exports in infra README or .claude/docs
  - Run `npm run build` and `cdk synth` from infra; run `npm test` including new stack tests
  - Update this story with file list and completion notes

## Dev Notes

- **Architecture:** ADR-001 (multi-table DynamoDB), ADR-006 (multi-stack CDK). Core = tables + buckets; no Lambda in core. Keys must match `.claude/docs/database-schema.md` exactly (USER#, CONTENT#, CODE#, SAVE#, PROJECT#, FOLDER#, LINK#, INDEX#).
- **Project structure:** All new code under `infra/lib/stacks/core/`. Existing `infra/bin/app.ts` only has CDK Nag and tags; no stacks instantiated yet — this story adds the first real stacks.
- **Testing:** Use AWS CDK `assertions` (or `@aws-cdk/assertions`) to inspect synthesized CloudFormation template. Assert table count, key attributes, GSI count, S3 bucket encryption. No `cdk deploy` or live AWS in CI for this story.
- **NFRs:** NFR-S1 (encryption at rest), NFR-R3 (data durability / PITR). NFR-C1 (cost) — use on-demand DynamoDB, no provisioned capacity in V1.

### Project Structure Notes

- `infra/lib/stacks/core/` currently contains only `.gitkeep`. This story adds `tables.stack.ts` and `buckets.stack.ts` (or one `core.stack.ts`). ADR-006 shows both options; prefer two stacks if it keeps tables vs buckets clearly separated and avoids circular refs.
- Alignment with unified structure: stack config lives in `infra/config/` (aws-env, environments); stacks in `infra/lib/stacks/<domain>/`.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md] ADR-001 (Multi-Table DynamoDB), ADR-006 (Multi-Stack CDK), ADR-009/010 (content layer, S3 for notes)
- [Source: .claude/docs/database-schema.md] Tables and Keys, GSIs, conventions
- [Source: _bmad-output/planning-artifacts/epics.md] Epic 1 Story 1.8, NFR-S1, NFR-R3
- [Source: infra/bin/app.ts] CDK app entry, awsEnv, CDK Nag application

## Developer Context (Dev Agent Guardrails)

### Technical Requirements

- **Language:** TypeScript (strict). Use AWS CDK v2 (`aws-cdk-lib`).
- **DynamoDB:** Use `Table` construct with `partitionKey` and `sortKey`; add `globalSecondaryIndexes` with `partitionKey` and `sortKey` for each GSI. Enable `pointInTimeRecovery: true` for tables holding user/content data. Do not use `BillingMode.PROVISIONED` in V1 (use on-demand).
- **S3:** Use `Bucket` construct with `encryption: BucketEncryption.S3_MANAGED` (or KMS if required). Enable `versioned: true` if architecture requires. Block public access.
- **Exports:** Export table names and bucket names via `new CfnOutput(this, 'TableSaves', { value: tableSaves.tableName, exportName: '...' })` or pass as props to dependent stacks. Lambdas will receive these via environment variables in later stories.
- **No real AWS IDs:** Do not hardcode account ID, region, or resource names in repo. Use `awsEnv` (from `getAwsEnv()`) and CDK default behavior.

### Architecture Compliance

- **ADR-001:** All 7 tables with exact key names from database-schema.md. User tables: `USER#<id>`. Content: `CONTENT#<urlHash>`. Invite: `CODE#<code>`.
- **ADR-006:** Core stacks only; no API Gateway or Lambda in core. Deployment order: Core → Auth → API → Workflows → Observability.
- **No Lambda-to-Lambda:** Not applicable (no Lambdas in this story).
- **Secrets:** No secrets in core stacks; Parameter Store/Secrets Manager in later auth/config stories.

### Library / Framework Requirements

- **CDK:** `aws-cdk-lib` (core, dynamodb, s3). Use `cdk-nag` (already applied in app.ts); fix or suppress findings for new resources.
- **Testing:** `aws-cdk-lib/assertions` or `@aws-cdk/assertions` for template assertions. Vitest for test runner (project standard).

### File Structure Requirements

- New files: `infra/lib/stacks/core/tables.stack.ts`, `infra/lib/stacks/core/buckets.stack.ts` (or single `core.stack.ts`). Update `infra/bin/app.ts` to instantiate and pass `awsEnv`.
- Tests: `infra/test/stacks/core/tables.stack.test.ts` (and buckets if split), or `core.stack.test.ts`. Assert on synthesized template only.

### Testing Requirements

- Unit tests must run without AWS credentials. Use `Template.fromStack(stack)` and assert resource count, properties (e.g. KeySchema, AttributeDefinitions, BillingMode, SSE for S3).
- Minimum 80% coverage for new code (CI gate). No integration tests against live DynamoDB/S3 in this story.

---

## Previous Story Intelligence (1-7 CI/CD Pipeline)

- **Learnings:** CI runs lint → type-check → unit tests (80% coverage) → CDK synth → CDK Nag → security scan → deploy. CDK Nag is applied at app level in `app.ts`; new stacks will be checked automatically. Ensure DynamoDB/S3 resources pass AwsSolutionsChecks or add justified suppressions.
- **Patterns:** Stack tests live under `infra/test/`; use Vitest and CDK assertions. No real deploys in CI without OIDC; `cdk synth` must succeed.
- **Relevant files:** `infra/bin/app.ts`, `.github/workflows/ci.yml`, `infra/package.json`, `vitest.config.ts` (root and infra).

---

## Project Context Reference

- **CLAUDE.md:** Essential commands, structure, NEVER/ALWAYS. Do not modify without approval.
- **.cursor/rules/architecture-guard.mdc:** No direct DynamoDB in handlers (use @ai-learning-hub/db); no real AWS identifiers in repo; keys must follow USER#/CONTENT#/CODE# patterns.
- **.claude/docs/database-schema.md:** Single source of truth for table names, PK/SK, GSI definitions.
- **infra/README.md:** Document how to deploy and what each stack provides.

---

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

(To be filled by dev agent)

### Completion Notes List

(To be filled by dev agent)

### File List

(To be filled after implementation: core stack file(s), app.ts changes, test files, any README updates)
