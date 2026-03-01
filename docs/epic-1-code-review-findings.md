# Epic 1: Project Foundation & Developer Experience — Code Review Findings

**Scope:** Monorepo layout, shared packages (`@ai-learning-hub/*`), Lambda layer usage, `.claude/` (docs, commands, hooks, agents), CI/CD, infra (DynamoDB, S3, observability), and any app or infra code added or touched for Epic 1.

**Goal:** Improve clarity, consistency, and maintainability without changing behavior.

---

## 1. Dead or redundant code

### 1.1 Unused re-export file: `backend/functions/invite-codes/schemas.ts`

**Location:** `backend/functions/invite-codes/schemas.ts` (entire file).

**What’s wrong:** The file only re-exports `paginationQuerySchema` from `@ai-learning-hub/validation`. The handler imports `paginationQuerySchema` directly from `@ai-learning-hub/validation`; nothing imports from `invite-codes/schemas.ts`.

**Suggested change:** Remove `backend/functions/invite-codes/schemas.ts`. Keep the handler importing `paginationQuerySchema` (and `validateQueryParams`) from `@ai-learning-hub/validation`. If the “three-file pattern” (handler, test, schemas) is required for consistency, keep the file but document that it exists for pattern consistency and have the handler import from `./schemas.js` so the re-export is used.

**Priority:** Low.

---

### 1.2 Session artifacts in `.claude/` root

**Location:** `.claude/review-findings-*.md`, `.claude/dedup-findings-*.md` (e.g. `review-findings-3.2.3.md`, `dedup-findings-3.2.4.md`).

**What’s wrong:** These look like session/epic-specific review or dedup outputs. Keeping them in the root of `.claude/` mixes long-term docs (e.g. `docs/`, `commands/`, `hooks/`) with one-off artifacts and can confuse what is canonical.

**Suggested change:** Either (a) move such artifacts into a subfolder (e.g. `.claude/artifacts/` or `docs/review-artifacts/`) and add a one-line note in `.claude/docs/README.md`, or (b) add a short note in `.claude/docs/README.md` that `review-findings-*.md` and `dedup-findings-*.md` are ephemeral session outputs and may be archived or deleted.

**Priority:** Low.

---

## 2. Naming and consistency

### 2.1 Duplicate `AUTHORIZER_CACHE_TTL` constant

**Location:**

- `backend/functions/jwt-authorizer/handler.ts` (e.g. around line 34): `export const AUTHORIZER_CACHE_TTL = 300;`
- `backend/functions/api-key-authorizer/handler.ts` (e.g. around line 38): `export const AUTHORIZER_CACHE_TTL = 300;`

**What’s wrong:** The same constant and value are defined in two authorizer handlers. CDK or other consumers must import from one of them; if both are used, the concept is duplicated and could drift.

**Suggested change:** Move to a single source of truth. Options: (1) Add a small shared constant module (e.g. `backend/shared/middleware/src/authorizer-constants.ts` or `backend/shared/constants.ts`) exporting `AUTHORIZER_CACHE_TTL = 300` and have both authorizers and infra import it; or (2) Export it from `@ai-learning-hub/middleware` (e.g. alongside `getClerkSecretKey`) and use it in both authorizers and in CDK when setting `resultsCacheTtl`.

**Priority:** Medium.

---

### 2.2 Two names for the same validation error shape

**Location:**

- `backend/shared/validation/src/validator.ts`: `ValidationErrorDetail` (interface) and `formatZodErrors` return type.
- `backend/shared/validation/src/index.ts`: exports `ValidationErrorDetail` and `type ValidationErrorDetail as FieldValidationError`.
- `backend/shared/types/src/api.ts`: `FieldValidationError` interface that “mirrors ValidationErrorDetail”.

**What’s wrong:** The same structure is exposed as `ValidationErrorDetail` (validation) and `FieldValidationError` (types). Two names for one concept can cause confusion and unnecessary type imports.

**Suggested change:** Standardize on one name. Prefer keeping the shape in one place (e.g. `@ai-learning-hub/validation` as `ValidationErrorDetail`) and re-exporting or referencing it from `@ai-learning-hub/types` as a type alias (e.g. `export type { ValidationErrorDetail as FieldValidationError } from '@ai-learning-hub/validation'`) so API/ADR-008 code can use `FieldValidationError` from types while implementation stays in validation. Alternatively, define the interface only in `@ai-learning-hub/types` and have validation use/import it. Document the chosen convention in `.claude/docs/api-patterns.md` or the validation package README.

**Priority:** Medium.

---

## 3. Use of standardized components and patterns

### 3.1 Logger usage: authorizers vs wrapped handlers

**Location:**

- `backend/functions/jwt-authorizer/handler.ts`: `createLogger()` used at runtime.
- `backend/functions/api-key-authorizer/handler.ts`: `createLogger()` used at runtime.
- All other API handlers (e.g. `saves-get`, `saves-list`, `api-keys`, `invite-codes`, `users-me`): use `logger` from `ctx` (from `wrapHandler`).

**What’s wrong:** Nothing is broken; authorizers cannot use `wrapHandler`, so they correctly use `createLogger()`. The split can surprise maintainers (“why do some files use `createLogger` and others `ctx.logger`?”).

**Suggested change:** Add a short subsection to `.claude/docs/api-patterns.md` or `testing-guide.md`: “Logging: API handlers use `ctx.logger` from `wrapHandler`. Authorizers (JWT, API Key) do not use `wrapHandler` and must call `createLogger()` from `@ai-learning-hub/logging` once per invocation.” No code change required.

**Priority:** Low.

---

### 3.2 Envelope/pagination built manually in saves-list

**Location:** `backend/functions/saves-list/handler.ts` (roughly lines 224–258): builds `EnvelopeMeta`, `links.self` / `links.next`, and calls `createSuccessResponse(page.map(toPublicSave), requestId, { meta, links })`.

**What’s wrong:** Pagination and envelope building are implemented inline. `@ai-learning-hub/db` already exposes `buildPaginatedResponse`; middleware/types define envelope and rate-limit meta. The list handler uses in-memory filtering/sorting then manual cursor slicing and link building, so it may not map 1:1 to `buildPaginatedResponse` (which is item-based). The pattern is still slightly inconsistent with “use shared helpers where possible.”

**Suggested change:** Prefer leaving behavior as-is unless a refactor is planned. If you later introduce a shared “build list envelope” helper (e.g. in middleware or db) that accepts `items`, `nextCursor`, `total`, `links`, and optional `truncated`/`cursorReset`, consider using it here and in other list endpoints (e.g. invite-codes, api-keys) for consistency. Optional follow-up; not required for Epic 1.

**Priority:** Low.

---

## 4. Opportunities for new shared components

### 4.1 Shared authorizer cache TTL (same as 2.1)

**Location:** Same as finding 2.1.

**Suggested change:** Introduce a single shared constant (e.g. in `@ai-learning-hub/middleware` or a small `backend/shared/constants` package) for `AUTHORIZER_CACHE_TTL` and use it in both authorizers and in CDK when configuring `resultsCacheTtl`. This is both a naming consistency win and a small shared component.

**Priority:** Medium.

---

### 4.2 Optional: shared path param schema for API key ID

**Location:** `backend/functions/api-keys/handler.ts`: inline `deletePathSchema` for `DELETE /users/api-keys/:id` (e.g. `z.object({ id: z.string().min(1).max(128) })`).

**What’s wrong:** Only one handler uses it. The project already has `saveIdPathSchema` in `@ai-learning-hub/validation` for save IDs. Having a single “resource id path” schema in validation would be a small, reusable abstraction if more “:id” path params appear (e.g. folder, project).

**Suggested change:** Low priority. If you add more “:id” path params with the same rules (non-empty string, max length), add something like `resourceIdPathSchema` or `apiKeyIdPathSchema` in `backend/shared/validation/src/schemas.ts` and use it in the api-keys handler. Otherwise, leave the inline schema as-is.

**Priority:** Low.

---

## 5. Clarity and efficiency

### 5.1 TODO in authorizers about wiring cache TTL

**Location:**

- `backend/functions/jwt-authorizer/handler.ts`: comment “TODO: Wire into API Gateway TokenAuthorizer in the API story.”
- `backend/functions/api-key-authorizer/handler.ts`: comment “TODO: Wire into API Gateway RequestAuthorizer in the API story.”

**What’s wrong:** If the API Gateway authorizers are already wired in CDK (e.g. `AuthStack` / `ApiGatewayStack` use `resultsCacheTtl`), the TODOs are obsolete and misleading.

**Suggested change:** If already wired: remove the TODO and replace with a one-line comment that the value is used by CDK for `resultsCacheTtl`. If not yet wired: keep the TODO or replace it with “Intended for use by CDK when configuring authorizer resultsCacheTtl” so the intent is clear.

**Priority:** Low.

---

### 5.2 Observability stack placeholder comments

**Location:** `infra/lib/stacks/observability/observability.stack.ts` (e.g. lines 59–72): “Future: CloudWatch Dashboards” and “Future: CloudWatch Alarms” with bullet lists.

**What’s wrong:** Placeholder comments are fine; they document intent. No change strictly required.

**Suggested change:** Optional: add a short “Observability roadmap” note in `.claude/docs/observability.md` or in the stack file that NFR-O2/O4/O5 (dashboards, alarms) will be implemented in a later story and reference this stack. Keeps the stack file as the single place for “what’s next” for observability.

**Priority:** Low.

---

### 5.3 Long comment in saves-delete handler

**Location:** `backend/functions/saves-delete/handler.ts` (lines 63–68): NOTE explaining why `returnValues: "ALL_OLD"` is used instead of `NONE` (to get `normalizedUrl`/`urlHash` for the event in one round-trip).

**What’s wrong:** Nothing; the comment is useful and explains a non-obvious trade-off.

**Suggested change:** None. Optionally add a one-line reference to the story/AC (e.g. “Story 3.3, Task 3”) at the start of the NOTE so future readers can trace the requirement.

**Priority:** Low (optional polish).

---

## Summary table

| #   | Category               | Location (summary)                                | Priority |
| --- | ---------------------- | ------------------------------------------------- | -------- |
| 1.1 | Dead/redundant code    | `invite-codes/schemas.ts` unused re-export        | Low      |
| 1.2 | Dead/redundant code    | `.claude/` review/dedup artifacts                 | Low      |
| 2.1 | Naming and consistency | Duplicate `AUTHORIZER_CACHE_TTL`                  | Medium   |
| 2.2 | Naming and consistency | `ValidationErrorDetail` vs `FieldValidationError` | Medium   |
| 3.1 | Standardized patterns  | Document logger usage (authorizers vs handlers)   | Low      |
| 3.2 | Standardized patterns  | saves-list envelope (optional shared helper)      | Low      |
| 4.1 | New shared component   | Shared `AUTHORIZER_CACHE_TTL` (same as 2.1)       | Medium   |
| 4.2 | New shared component   | Optional `apiKeyIdPathSchema`                     | Low      |
| 5.1 | Clarity                | TODO in authorizers (wire cache TTL)              | Low      |
| 5.2 | Clarity                | Observability stack “Future” comments             | Low      |
| 5.3 | Clarity                | saves-delete NOTE (keep; optional story ref)      | Low      |

---

## What was checked and found OK

- **Handlers:** All scanned handler files use `@ai-learning-hub/db`, `@ai-learning-hub/logging` (via `ctx.logger` or `createLogger` in authorizers), `@ai-learning-hub/validation`, and `@ai-learning-hub/middleware`; no direct DynamoDB SDK or console.\* in handlers; all API handlers use `wrapHandler`.
- **Shared packages:** Exports from `logging`, `middleware`, `db`, `validation`, `types`, and `events` are used; no obvious dead public API in the scope of this review.
- **Infra:** Tables, buckets, observability, auth, API Gateway, and route stacks follow a consistent naming and dependency order; table names use environment prefix; no hardcoded account/region in app code.
- **CI/CD:** Pipeline stages (lint, type-check, unit tests, CDK synth, integration/contract placeholders, security scan, deploy dev/E2E/deploy prod) are consistent with Epic 1; placeholders are clearly marked.
- **.claude/:** Docs, commands, and hooks are structured and referenced from READMEs; hooks mirror the rules in `.cursor/rules` as intended.

---

_Generated from a full pass over Epic 1 deliverables and dependent code. Prioritization favors consistency with shared packages and existing patterns; refactors that only move code without improving clarity or reuse were avoided._
