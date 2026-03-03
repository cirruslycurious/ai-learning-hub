---
id: "3.5.1"
title: "Epic 1 Code Cleanup"
status: ready-for-dev
depends_on: []
touches:
  - backend/functions/invite-codes/handler.ts
  - backend/functions/jwt-authorizer/handler.ts
  - backend/functions/api-key-authorizer/handler.ts
  - backend/shared/types/src/api.ts
  - backend/shared/middleware/src/authorizerConstants.ts
  - backend/shared/middleware/src/index.ts
  - infra/lib/stacks/api/api-gateway.stack.ts
  - infra/lib/stacks/auth/auth.stack.ts
  - infra/test/stacks/auth/auth.stack.test.ts
  - infra/lib/stacks/api/saves-routes.stack.ts
  - infra/test/stacks/api/saves-routes.stack.test.ts
  - infra/test/stacks/api/ops-routes.stack.test.ts
  - .claude/docs/api-patterns.md
  - .claude/docs/README.md
risk: medium
---

# Story 3.5.1: Epic 1 Code Cleanup

## Story

As a **developer maintaining the ai-learning-hub codebase**,
I want **the Epic 1 code review findings resolved — type duplication eliminated, IAM permissions narrowed to least-privilege, missing CDK tests added, and stale TODOs/comments cleaned up**,
so that **the foundation is consistent, secure by default, and fully tested before building on top of it**.

## Acceptance Criteria

1. **AC1: FieldValidationError de-duplicated** — `backend/shared/types/src/api.ts` no longer declares its own `FieldValidationError` interface; it re-exports the canonical `ValidationErrorDetail` from `@ai-learning-hub/validation` as `FieldValidationError`. The `validation` package remains the single source of truth; all consumers receive structurally identical types regardless of which package they import from.

2. **AC2: AUTHORIZER_CACHE_TTL consolidated** — `AUTHORIZER_CACHE_TTL = 300` is defined exactly once, in `@ai-learning-hub/middleware`. Neither authorizer handler declares it locally. CDK's `api-gateway.stack.ts` uses `cdk.Duration.seconds(AUTHORIZER_CACHE_TTL)` for the JWT authorizer `resultsCacheTtl`, so the CDK-synthesized template reflects the value from the shared constant. The API Key authorizer CDK config continues to use `resultsCacheTtl: 0` — this is intentional and is not changed by this story.

3. **AC3: Invite-codes handler imports from local schemas** — `backend/functions/invite-codes/handler.ts` imports `paginationQuerySchema` (and `validateQueryParams`) from `./schemas.js` instead of directly from `@ai-learning-hub/validation`, so the three-file pattern is consistently applied and `schemas.ts` is actually consumed.

4. **AC4: Stale TODO comments removed from authorizers** — The "TODO: Wire into API Gateway TokenAuthorizer in the API story" comment is removed from `jwt-authorizer/handler.ts` and the equivalent "TODO: Wire into API Gateway RequestAuthorizer" from `api-key-authorizer/handler.ts`. Each is replaced with a one-line comment noting the constant is used by CDK for `resultsCacheTtl` (now referencing the shared import from AC2).

5. **AC5: validateInviteFunction IAM narrowed** — `infra/lib/stacks/auth/auth.stack.ts` replaces `inviteCodesTable.grantReadWriteData(this.validateInviteFunction)` with an explicit `addToRolePolicy` granting only `dynamodb:GetItem` and `dynamodb:UpdateItem` on the invite codes table ARN (and its index ARN). `DeleteItem`, `PutItem`, `BatchWriteItem`, `BatchGetItem` are no longer granted to this function.

6. **AC6: generateInviteFunction IAM narrowed** — `infra/lib/stacks/auth/auth.stack.ts` replaces `inviteCodesTable.grantReadWriteData(this.generateInviteFunction)` with an explicit `addToRolePolicy` granting only `dynamodb:PutItem` and `dynamodb:Query` on the invite codes table ARN (and its index ARN). `DeleteItem`, `GetItem` (single-item), `UpdateItem`, `BatchWriteItem` are no longer granted.

7. **AC7: Saves mutation function IAM narrowed for usersTable and eventsTable** — In `saves-routes.stack.ts`, the four mutation functions (`savesCreate`, `savesUpdate`, `savesDelete`, `savesRestore`) replace `usersTable.grantReadWriteData()` with explicit `addToRolePolicy` for only `dynamodb:UpdateItem` + `dynamodb:Query` on usersTable. They replace `eventsTable.grantReadWriteData()` with explicit `addToRolePolicy` for only `dynamodb:PutItem` on eventsTable (append-only). `DeleteItem`, `PutItem` (users), `GetItem` (events), `BatchGetItem`/`BatchWriteItem` on both tables are no longer granted to mutation functions.

8. **AC8: savesGetFunction IAM narrowed** — In `saves-routes.stack.ts`, `savesTable.grantReadWriteData(savesGetFunction)` is replaced with an explicit `addToRolePolicy` granting only `dynamodb:GetItem` and `dynamodb:UpdateItem` on savesTable ARN (and index ARN). `PutItem`, `DeleteItem`, `BatchGetItem`, `BatchWriteItem` on the saves table are no longer granted to the GET handler.

9. **AC9: NAG suppressions tightened after IAM narrowing** — After fixing AC5–AC8, the blanket `AwsSolutions-IAM5` suppressions in `saves-routes.stack.ts` and `auth.stack.ts` are updated: the `reason` text accurately reflects that wildcards are scoped to `index/*` only (not broad table-level wildcards), and `appliesTo` arrays limit each suppression to `Resource::<table-arn>/index/*` patterns where applicable.

10. **AC10: CDK test for SavesRoutesStack added** — `infra/test/stacks/api/saves-routes.stack.test.ts` is created following the `auth.stack.test.ts` pattern. It asserts: (a) Lambda function count and runtime for the seven saves functions, (b) IAM grants per function reflecting the narrowed permissions from AC7–AC8, (c) required environment variables on each function, (d) route resource and method presence matching the route registry.

11. **AC11: CDK test for OpsRoutesStack added** — `infra/test/stacks/api/ops-routes.stack.test.ts` is created. It asserts: Lambda function count and runtime for health, readiness, and batch functions; environment variables; route resource and method presence.

12. **AC12: Auth stack IAM tests made function-specific** — The generic "grants the Lambda read/write access to users table" test in `auth.stack.test.ts` is replaced with function-specific assertions. Each Lambda in `AuthStack` that has an explicit policy gets its own assertion verifying the actions and table ARN bound to that function's role (using CDK logical ID matching, as done in the existing API Key authorizer tests). A test that accidentally grants `DeleteItem` to `usersMeFunction` would now fail.

13. **AC13: Logger usage documented in api-patterns.md** — `.claude/docs/api-patterns.md` gains a "Logging" subsection explaining: API handlers receive `ctx.logger` via `wrapHandler`; authorizers (JWT, API Key) cannot use `wrapHandler` and must call `createLogger()` from `@ai-learning-hub/logging` once per invocation. No code changes.

14. **AC14: CORS intent documented in route stacks** — A short inline comment is added to the `allowOrigins: apigateway.Cors.ALL_ORIGINS` lines in `saves-routes.stack.ts` and `ops-routes.stack.ts` explaining the intent (agent callers may originate from arbitrary origins; frontend origin enforcement is at the CloudFront level). No functional change.

15. **AC15: All tests pass and lints clean** — `npm test` passes with no regressions. `npm run lint` passes. `npm run type-check` passes (type alias re-export is valid TypeScript). `cdk synth` succeeds with no new CDK Nag errors.

## Tasks / Subtasks

- [ ] Task 1: Fix FieldValidationError duplication — types package (AC: #1)
  - [ ] 1.0 **Circular dependency check (pre-mortem guard):** Before writing any code, check `backend/shared/validation/package.json` — does it already import from `@ai-learning-hub/types`? If yes, adding a re-export from `types` back to `validation` creates a circular dependency. In that case, the direction must flip: define the canonical shape only in `@ai-learning-hub/types`, and have `validation` import from `types`. Document which direction was chosen (and why) in a comment in `api.ts`.
  - [ ] 1.1 Open `backend/shared/types/src/api.ts`; find the `FieldValidationError` interface (line ~61) and the comment "Mirrors ValidationErrorDetail"
  - [ ] 1.2 Delete the standalone `FieldValidationError` interface declaration
  - [ ] 1.3 Add `export type { ValidationErrorDetail as FieldValidationError } from '@ai-learning-hub/validation'` (or import + re-export pattern) at the appropriate location in the file
  - [ ] 1.4 Run `npm run type-check` in `backend/shared/types` to confirm no type errors; run in root to confirm all consumers still compile

- [ ] Task 2: Consolidate AUTHORIZER_CACHE_TTL (AC: #2)
  - [ ] 2.1 Create `backend/shared/middleware/src/authorizerConstants.ts` exporting `export const AUTHORIZER_CACHE_TTL = 300;` with a brief JSDoc comment
  - [ ] 2.2 Add export of `AUTHORIZER_CACHE_TTL` to `backend/shared/middleware/src/index.ts`
  - [ ] 2.3 In `jwt-authorizer/handler.ts`, remove the local `export const AUTHORIZER_CACHE_TTL = 300` declaration; add import from `@ai-learning-hub/middleware`
  - [ ] 2.4 In `api-key-authorizer/handler.ts`, remove the local `export const AUTHORIZER_CACHE_TTL = 300` declaration; add import from `@ai-learning-hub/middleware`
  - [ ] 2.5 In `infra/lib/stacks/api/api-gateway.stack.ts`, import `AUTHORIZER_CACHE_TTL` from `@ai-learning-hub/middleware`; replace the hardcoded `300` in `resultsCacheTtl` with `cdk.Duration.seconds(AUTHORIZER_CACHE_TTL)`
  - [ ] 2.6 **Build before CDK (pre-mortem guard):** Run `npm run build` in `backend/shared/middleware/` (or at the monorepo root) before running `cdk synth`. CDK resolves `@ai-learning-hub/middleware` from built output — if the package hasn't been rebuilt after adding `authorizerConstants.ts`, CDK will fail with "Cannot find module" even though TypeScript looks fine locally.

- [ ] Task 3: Fix invite-codes import and remove stale TODOs (AC: #3, #4)
  - [ ] 3.1 In `backend/functions/invite-codes/handler.ts`, change the import of `paginationQuerySchema` (and `validateQueryParams` if present) from `@ai-learning-hub/validation` to `./schemas.js`
  - [ ] 3.2 Confirm `backend/functions/invite-codes/schemas.ts` already re-exports these from validation (it should per finding 1.1 — no change needed to schemas.ts)
  - [ ] 3.3 In `jwt-authorizer/handler.ts`, remove the "TODO: Wire into API Gateway TokenAuthorizer in the API story" comment; replace with a one-line note like `// Imported by CDK api-gateway.stack.ts as resultsCacheTtl via @ai-learning-hub/middleware`
  - [ ] 3.4 In `api-key-authorizer/handler.ts`, remove the equivalent TODO comment with the same type of replacement note

- [ ] Task 4: Narrow IAM — auth.stack.ts (AC: #5, #6)
  - [ ] 4.1 In `infra/lib/stacks/auth/auth.stack.ts`, locate `inviteCodesTable.grantReadWriteData(this.validateInviteFunction)` (~line 384) and the follow-on `addToRolePolicy` calls
  - [ ] 4.2 Replace `grantReadWriteData` with an explicit `addToRolePolicy` for `dynamodb:GetItem` + `dynamodb:UpdateItem` on `inviteCodesTable.tableArn` and `${inviteCodesTable.tableArn}/index/*`; remove the existing narrow-scope TODO comment once done
  - [ ] 4.3 Locate `inviteCodesTable.grantReadWriteData(this.generateInviteFunction)` (~line 574) and replace with explicit `addToRolePolicy` for `dynamodb:PutItem` + `dynamodb:Query` on the same table/index ARNs; remove the existing narrow-scope TODO comment once done

- [ ] Task 5: Narrow IAM — saves-routes.stack.ts (AC: #7, #8, #9)
  - [ ] 5.0 **Audit actual DynamoDB calls (pre-mortem guard):** Before replacing any `grantReadWriteData`, grep each handler source for all DynamoDB SDK calls (`getItem`, `updateItem`, `query`, `putItem`, `deleteItem`, `batchWriteItem`, etc.). Produce a verified action list per function. Do not rely solely on the code review findings — verify directly in source. Any action found in code but not in the replacement policy is a latent runtime 403.
  - [ ] 5.1 For each of `savesCreateFunction`, `savesUpdateFunction`, `savesDeleteFunction`, `savesRestoreFunction`: replace `usersTable.grantReadWriteData(fn)` with explicit `addToRolePolicy` for `dynamodb:UpdateItem` + `dynamodb:Query` on usersTable ARN and index ARN
  - [ ] 5.2 For the same four functions: replace `eventsTable.grantReadWriteData(fn)` with explicit `addToRolePolicy` for `dynamodb:PutItem` only on eventsTable ARN (no index needed for append-only writes)
  - [ ] 5.3 Replace `savesTable.grantReadWriteData(savesGetFunction)` with explicit `addToRolePolicy` for `dynamodb:GetItem` + `dynamodb:UpdateItem` on savesTable ARN and index ARN
  - [ ] 5.4 Update CDK Nag suppressions in `saves-routes.stack.ts`: add `appliesTo: ["Resource::<saves-table-arn>/index/*", ...]` to each suppression so they only suppress the expected `index/*` wildcard, not any table-level wildcards introduced accidentally. Update `reason` to "Index ARN wildcards are standard CDK behavior for GSI access"

- [ ] Task 6: Add CDK tests for SavesRoutesStack (AC: #10)
  - [ ] 6.0 **Read constructor signature first (pre-mortem guard):** Before writing any test code, read `infra/lib/stacks/api/saves-routes.stack.ts` in full to identify the props interface and every required constructor argument (tables, API Gateway RestApi reference, authorizer constructs, etc.). `SavesRoutesStack` likely requires more than just tables — check `infra/test/stacks/api/auth-routes.stack.test.ts` and `api-gateway.stack.test.ts` for how route-level stacks are instantiated in tests. List all required props and plan stubs before writing any test code.
  - [ ] 6.1 Create `infra/test/stacks/api/saves-routes.stack.test.ts`
  - [ ] 6.2 Follow the `auth.stack.test.ts` setup pattern: create a test app and mock stacks for all dependent tables; instantiate `SavesRoutesStack`; call `Template.fromStack()`
  - [ ] 6.3 Assert Lambda function count (7 functions: create, list, get, update, delete, restore, events)
  - [ ] 6.4 Assert runtime is `NODEJS_22_X` for each function (or whatever the current project runtime is)
  - [ ] 6.5 Assert required environment variables on each function (e.g. `TABLE_NAME`, `USERS_TABLE_NAME`, `EVENTS_TABLE_NAME`, `POWERTOOLS_SERVICE_NAME`)
  - [ ] 6.6 Assert IAM policy actions per function — the narrowed permissions from Task 5, not broad `grantReadWriteData`
  - [ ] 6.7 Assert route resources and methods are present (e.g. `/saves` with GET and POST, `/saves/{saveId}` with GET/PUT/DELETE)

- [ ] Task 7: Add CDK tests for OpsRoutesStack (AC: #11)
  - [ ] 7.1 Create `infra/test/stacks/api/ops-routes.stack.test.ts`
  - [ ] 7.2 Set up test app, instantiate `OpsRoutesStack`, call `Template.fromStack()`
  - [ ] 7.3 Assert Lambda function count and runtime for health, readiness, and batch functions
  - [ ] 7.4 Assert environment variables on each function
  - [ ] 7.5 Assert route resources and methods (`/health`, `/readiness`, `/batch/*`)

- [ ] Task 8: Fix auth stack IAM tests to be function-specific (AC: #12)
  - [ ] 8.0 **Coverage map audit (pre-mortem guard):** Before removing any existing assertion, list ALL Lambda functions in `AuthStack` that have `addToRolePolicy` or `grantReadWriteData` calls. Create a coverage map: `function → expected actions → table`. Confirm a function-specific assertion exists (or will be added) for every single one. The old generic test may have implicitly covered functions not called out in finding 6.2 (e.g. `usersMeFunction`) — those cannot be left without an assertion.
  - [ ] 8.1 Open `infra/test/stacks/auth/auth.stack.test.ts`; find the "IAM Permissions" describe block (lines ~104–131)
  - [ ] 8.2 Replace the generic "grants the Lambda read/write access to users table" assertion with per-function assertions for each Lambda that has an explicit IAM policy — using CDK logical ID matching (the same pattern as the existing API Key authorizer tests at lines ~155–219)
  - [ ] 8.3 Specifically: `jwtAuthorizerFunction` → assert `GetItem`, `PutItem`, `UpdateItem`, `Query` on users table; `validateInviteFunction` → assert `GetItem`, `UpdateItem` on invite-codes table (post AC5 narrowing); `generateInviteFunction` → assert `PutItem`, `Query` on invite-codes table (post AC6 narrowing); `apiKeysFunction` → verify existing assertions still pass

- [ ] Task 9: Documentation updates (AC: #13, #14)
  - [ ] 9.1 Open `.claude/docs/api-patterns.md`; add a "## Logging" (or "### Logging") subsection documenting the authorizer vs handler logger split
  - [ ] 9.2 In `saves-routes.stack.ts`, add an inline comment on the `allowOrigins: apigateway.Cors.ALL_ORIGINS` line explaining agent-caller intent and CloudFront frontend enforcement
  - [ ] 9.3 In `ops-routes.stack.ts`, add the same CORS intent comment
  - [ ] 9.4 In `.claude/docs/README.md` (or whichever file describes the `.claude/` directory structure), add a one-line note that `review-findings-*.md` and `dedup-findings-*.md` files are ephemeral session outputs and may be archived or deleted — they are not canonical documentation (finding 1.2). No files need to be moved; the note is sufficient.

- [ ] Task 10: Verify (AC: #15)
  - [ ] 10.1 Run `npm run type-check` — no TypeScript errors
  - [ ] 10.2 Run `npm test` — all tests pass, no regressions
  - [ ] 10.3 Run `npm run lint` — no lint errors
  - [ ] 10.4 Run `cdk synth` — succeeds, no new CDK Nag errors
  - [ ] 10.5 (Recommended, post-deploy) Run the existing smoke test against the dev environment to confirm no IAM regressions — the IAM narrowing is verified statically by tests but real DynamoDB call paths are only exercised under live traffic

## Dev Notes

- **Scope:** Code cleanup only — no behavior changes, no new features, no API contract changes. Every change should be provably equivalent or strictly tighter (IAM narrowing). If a change is non-trivial to verify as equivalent, add a comment explaining why.
- **Greenfield rule:** Delete old patterns entirely. No `@deprecated` wrappers, no compatibility re-exports. The duplicate `FieldValidationError` interface in `types` should be removed, not deprecated.
- **Execution order matters:** Complete Tasks 4–5 (IAM narrowing) before Tasks 6–8 (CDK tests), so the new tests assert the correct narrowed permissions from the start. If you write tests first against current broad permissions, you'll have to rewrite them immediately after.
- **PR review guidance:** This PR touches two independent risk areas. Review IAM narrowing (Tasks 4–5, ACs 5–9) as a separate pass from the rest — type system, constant consolidation, and tests. Mixing them in one review pass increases the chance of approving an incorrect IAM grant alongside an unrelated doc change.
- **API Key authorizer TTL must stay at 0:** When consolidating `AUTHORIZER_CACHE_TTL` into `@ai-learning-hub/middleware`, both handlers import the constant — but CDK's `api-gateway.stack.ts` continues to set `resultsCacheTtl: cdk.Duration.seconds(0)` for the API Key authorizer. This is intentional (caching is disabled for API key auth). Do NOT replace the `0` with `AUTHORIZER_CACHE_TTL` for the API Key authorizer in CDK — that would silently enable caching and is a behavioral change.
- **Finding 6.3 deferred:** Code review finding 6.3 (CI does not run coverage with `--coverage` flag, only validates threshold config exists) is not addressed in this story. It requires a CI YAML change and a root `test:coverage` script, which is a CI infrastructure concern better handled in a dedicated CI hygiene story. Do not attempt to fix it here.
- **FieldValidationError re-export approach:** The cleanest pattern is a named re-export in `backend/shared/types/src/api.ts`:
  ```typescript
  export type { ValidationErrorDetail as FieldValidationError } from '@ai-learning-hub/validation';
  ```
  Confirm the `@ai-learning-hub/validation` package is already listed in `backend/shared/types/package.json` dependencies (it likely is via workspace). If not, add it. After this change, any consumer that `import { FieldValidationError } from '@ai-learning-hub/types'` will get the exact same type as `import { ValidationErrorDetail } from '@ai-learning-hub/validation'`.
- **authorizerConstants.ts location:** Place in `backend/shared/middleware/src/authorizerConstants.ts`. This is the right home because the constant governs the authorizer cache behavior configured in CDK — it's closer to "how the middleware layer (authorizers) is configured" than to types or validation. Export from the middleware `index.ts`.
- **IAM addToRolePolicy pattern (established in codebase):** Follow the existing pattern from `auth.stack.ts` lines 82–95:
  ```typescript
  fn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
      resources: [table.tableArn, `${table.tableArn}/index/*`],
    })
  );
  ```
  Import `* as iam from 'aws-cdk-lib/aws-iam'` (already imported in both stacks). Remove the `grantReadWriteData` call entirely — do not leave both.
- **⚠️ index/* ARN is not automatic with addToRolePolicy (pre-mortem guard):** `grantReadWriteData` silently adds `${table.tableArn}/index/*` to the resource list so GSI `Query` works. `addToRolePolicy` does NOT — you must add the index ARN explicitly. **Rule: every replacement policy that includes `dynamodb:Query` MUST have `resources: [table.tableArn, \`${table.tableArn}/index/*\`]`.** Omitting the index ARN compiles and synths cleanly but produces a runtime 403 on any GSI query. The only exception is `dynamodb:PutItem` on `eventsTable` (append-only, no GSI needed) which correctly uses only `eventsTable.tableArn`.
- **eventsTable for saves mutations:** Only `dynamodb:PutItem` is needed — events are append-only from the mutation path. No index ARN needed (PutItem always targets the base table). Use `resources: [eventsTable.tableArn]` only.
- **usersTable for saves mutations:** Mutations need `UpdateItem` (rate-limit counter increment) and `Query` (profile GSI lookup). Use `resources: [usersTable.tableArn, \`${usersTable.tableArn}/index/*\`]`.
- **SavesRoutesStack test setup:** The stack requires several DynamoDB table dependencies. Follow the exact same pattern as `auth.stack.test.ts` — create a `TestTablesStack`, create `Table` constructs for each required table, pass them to `SavesRoutesStack` constructor. Check `infra/lib/stacks/api/saves-routes.stack.ts` constructor props type to see exactly which tables are required.
- **OpsRoutesStack test setup:** Similar approach. Check `infra/lib/stacks/api/ops-routes.stack.ts` constructor signature.
- **CDK logical ID matching for IAM tests:** The pattern used in `auth.stack.test.ts` lines ~155–219 uses `Match.arrayWith([Match.objectLike({ Ref: Match.stringLikeRegexp("ApiKeyAuthorizer") })])` to scope assertions to a specific function's role. Use the same approach in the new SavesRoutesStack tests.
- **NAG suppressions `appliesTo`:** The CDK Nag `AwsSolutions-IAM5` suppression with `appliesTo` looks like:
  ```typescript
  NagSuppressions.addResourceSuppressions(fn, [{
    id: "AwsSolutions-IAM5",
    reason: "Index ARN wildcards are standard CDK behavior for GSI access",
    appliesTo: ["Resource::<SavesTableArn>/index/*"],
  }], true);
  ```
  Where `<SavesTableArn>` is the CDK token for the table ARN. After the IAM narrowing in Task 5, only the `index/*` wildcard should remain — the broad table-level wildcard from `grantReadWriteData` is eliminated.
- **invite-codes schemas.ts:** The file already exists with the re-exports (per the review — "the file exists intentionally"). Only the handler import path changes; `schemas.ts` itself is not modified.
- **api-patterns.md logger section:** Keep it concise — 3–5 lines. The key points: `ctx.logger` from `wrapHandler` for all API handlers; `createLogger()` from `@ai-learning-hub/logging` directly in authorizers (which cannot use `wrapHandler`). Add under a "## Logging" heading or as a subsection of the existing middleware/patterns section.

### Project Structure Notes

- **Backend shared packages** live in `backend/shared/`. The middleware package is at `backend/shared/middleware/src/`. Its barrel export is `backend/shared/middleware/src/index.ts`. The authorizerConstants file should follow the existing single-export-per-file pattern seen in the package.
- **CDK stacks path:** `infra/lib/stacks/`. Auth stack is `infra/lib/stacks/auth/auth.stack.ts`. Route stacks: `infra/lib/stacks/api/saves-routes.stack.ts` and `infra/lib/stacks/api/ops-routes.stack.ts`.
- **CDK tests path:** `infra/test/stacks/`. Existing examples: `infra/test/stacks/auth/auth.stack.test.ts`, `infra/test/stacks/api/api-gateway.stack.test.ts`.
- **File guard:** `infra/` is ESCALATE per workspace rules — the story explicitly scopes changes to the files listed in `touches`, all of which are within this cleanup scope. No new stacks or top-level CDK constructs are created.

### References

- [Source: _bmad-output/implementation-artifacts/epic-1-code-review-output.md] — All findings: 1.1, 2.1, 2.2, 3.1, 4.2, 5.1, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 7.5 — canonical source for each task
- [Source: infra/lib/stacks/auth/auth.stack.ts#lines 82-95] — Established `addToRolePolicy` pattern (jwt-authorizer)
- [Source: infra/test/stacks/auth/auth.stack.test.ts#lines 104-219] — IAM test patterns including logical ID matching
- [Source: backend/shared/validation/src/index.ts#lines 55-56] — Current `ValidationErrorDetail` / `FieldValidationError` re-export in validation package
- [Source: backend/shared/types/src/api.ts#lines 59-67] — Duplicate `FieldValidationError` interface to be removed
- [Source: infra/lib/stacks/api/saves-routes.stack.ts#lines 145-340] — Current broad `grantReadWriteData` calls to be replaced
- [Source: infra/lib/stacks/api/saves-routes.stack.ts#lines 436-453] — Current blanket NAG suppressions to be tightened

## Developer Context & Guardrails

### Technical Requirements

- **TypeScript:** All backend and CDK code is TypeScript. `npm run type-check` must pass after every change. The `FieldValidationError` re-export change is a type-only change — no runtime impact, but verify structural compatibility.
- **CDK:** `aws-cdk-lib` TypeScript. Use `iam.PolicyStatement` for all new explicit grants. IAM `addToRolePolicy` is the established project pattern for least-privilege access (see `auth.stack.ts`).
- **Shared packages workspace:** `@ai-learning-hub/middleware` is a pnpm workspace package. After adding `authorizerConstants.ts` and its export, run `npm install` at the root (or let the workspace resolve it) to ensure the new export is picked up by consumers (authorizers and CDK).
- **Test framework:** Vitest for all tests (backend + infra). CDK tests use `@aws-cdk/assertions` (via `aws-cdk-lib/assertions`). Pattern: `Template.fromStack(stack)` + `template.hasResourceProperties()` + `Match.*` helpers.

### Architecture Compliance

- **ADR-008 (Standardized error responses):** The `FieldValidationError` type is part of the standardized error contract. Keeping it as a re-export from `@ai-learning-hub/validation` (single source of truth) is the correct ADR-008-compliant approach.
- **ADR-006 (CDK multi-stack):** All IAM narrowing changes stay within the existing stacks — no new stacks created.
- **CLAUDE.md NEVER rules:** No utility functions created without checking `/shared` first; the `authorizerConstants.ts` file is specifically needed in `middleware` as that's where authorizer behavior is configured. No Lambda-to-Lambda calls involved.

### Library / Framework Requirements

- **`@ai-learning-hub/middleware`:** Add `authorizerConstants.ts` here. No new npm packages needed.
- **`aws-cdk-lib/aws-iam`:** Already imported in both stacks (`* as iam`). Use `iam.PolicyStatement`.
- **CDK Nag:** `cdk-nag` is already a dev dependency. `NagSuppressions.addResourceSuppressions()` already used in both stacks.

### File Structure Requirements

**New files:**
- `backend/shared/middleware/src/authorizerConstants.ts` — exports `AUTHORIZER_CACHE_TTL`
- `infra/test/stacks/api/saves-routes.stack.test.ts` — CDK tests for SavesRoutesStack
- `infra/test/stacks/api/ops-routes.stack.test.ts` — CDK tests for OpsRoutesStack

**Modified files:**
- `backend/functions/invite-codes/handler.ts` — update import path
- `backend/functions/jwt-authorizer/handler.ts` — remove local constant, add import, remove stale TODO
- `backend/functions/api-key-authorizer/handler.ts` — remove local constant, add import, remove stale TODO
- `backend/shared/types/src/api.ts` — remove duplicate interface, add re-export
- `backend/shared/middleware/src/index.ts` — add `authorizerConstants` export
- `infra/lib/stacks/api/api-gateway.stack.ts` — use imported `AUTHORIZER_CACHE_TTL`
- `infra/lib/stacks/auth/auth.stack.ts` — narrow inviteFunction IAM, remove TODO comments
- `infra/test/stacks/auth/auth.stack.test.ts` — make IAM tests function-specific
- `infra/lib/stacks/api/saves-routes.stack.ts` — narrow IAM, tighten NAG, add CORS comment
- `.claude/docs/api-patterns.md` — add Logging subsection

### Testing Requirements

- **CDK assertion tests (required):** `saves-routes.stack.test.ts` and `ops-routes.stack.test.ts` must be created with meaningful assertions covering Lambda config, environment variables, IAM, and routes. Follow `auth.stack.test.ts` as the model.
- **Regression:** All existing tests must still pass — no behavior changes means no test changes except: (a) fixing the generic IAM test in `auth.stack.test.ts` to be function-specific (AC12), and (b) any tests that directly import `FieldValidationError` from `@ai-learning-hub/types` should continue to work since it's still exported (as a re-export).
- **Type-check:** Run `npm run type-check` after Task 1 (type de-duplication) and again after Task 2 (authorizerConstants) to catch any import issues early.
- **Coverage:** `npm test` runs with coverage thresholds. The new test files should bring CDK infra test coverage up (SavesRoutesStack and OpsRoutesStack were previously untested stacks).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
