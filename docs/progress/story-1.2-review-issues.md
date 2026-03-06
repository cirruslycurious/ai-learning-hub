# Story 1-2 Code Review — GitHub Issues (Created)

**Context:** BMAD code review follow-ups for Story 1.2 (Shared Lambda Layer).

## Created issues

| #   | Title                                                           | Issue                                                               | Status |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| 1   | Enable or document X-Ray tracing for @ai-learning-hub/db        | [#55](https://github.com/cirruslycurious/ai-learning-hub/issues/55) | Fixed  |
| 2   | Add tsconfig.base.json to story File List                       | [#56](https://github.com/cirruslycurious/ai-learning-hub/issues/56) | Fixed  |
| 3   | Add Review Follow-ups (AI) section to story artifact            | [#57](https://github.com/cirruslycurious/ai-learning-hub/issues/57) | Fixed  |
| 4   | Gate auth stub x-dev-user-id on NODE_ENV or document deployment | [#58](https://github.com/cirruslycurious/ai-learning-hub/issues/58) | Fixed  |
| 5   | Use top-level import for @ai-learning-hub/types in wrapper.ts   | [#59](https://github.com/cirruslycurious/ai-learning-hub/issues/59) | Fixed  |
| 6   | Add coercion or docs for pagination schema with query params    | [#60](https://github.com/cirruslycurious/ai-learning-hub/issues/60) | Fixed  |
| 7   | Fix double space in Package Dependencies in story artifact      | [#61](https://github.com/cirruslycurious/ai-learning-hub/issues/61) | Fixed  |

---

## How to create these issues

- **GitHub UI:** Open your repo → Issues → New issue → paste the **Title** into the title field and the **Body** (code block) into the body. Use labels `task`, and optionally `story-1-2` / `code-review` if they exist.
- **GitHub CLI:** After `gh auth login`, run for each issue:
  ```bash
  gh issue create --title "Title from below" --body "Body from below" --label "task"
  ```
  (Copy each title and body from the sections below.)

---

## Issue 1 — [HIGH] Align @ai-learning-hub/db with AC4: X-Ray tracing

**Labels:** `task`, `story-1-2`, `code-review`

**Title:** `[Story 1-2] Enable or document X-Ray tracing for @ai-learning-hub/db`

**Body:**

```markdown
## Summary

AC4 states "X-Ray tracing is enabled" for the db package. The db client comments say "DynamoDB client with X-Ray tracing" but the code only creates a plain DynamoDBClient/DocumentClient with no aws-xray-sdk (or equivalent) instrumentation. DynamoDB calls are not captured as X-Ray subsegments.

## Context

From BMAD code review of Story 1-2 (Shared Lambda Layer). AC4: "X-Ray tracing is enabled."

## Acceptance Criteria

- [ ] Either: (a) Add X-Ray instrumentation to the DynamoDB client (e.g. aws-xray-sdk capture), or (b) Update AC4 and story artifact/comments to state that X-Ray trace ID is available via Lambda/env and that subsegment capture is deferred to a later story.
- [ ] Check off the corresponding Review Follow-up (AI) item in `_bmad-output/implementation-artifacts/1-2-shared-lambda-layer.md`
```

---

## Issue 2 — [HIGH] Add tsconfig.base.json to Story 1-2 File List

**Labels:** `task`, `story-1-2`, `code-review`

**Title:** `[Story 1-2] Add tsconfig.base.json to story File List`

**Body:**

```markdown
## Summary

Story 1-2 Completion Notes say "tsconfig.base.json: paths for @ai-learning-hub/...". The File List does not include `tsconfig.base.json`. For traceability and parity with stories 1-3/1-4, add it to the File List.

## Context

From BMAD code review of Story 1-2. Incomplete documentation of deliverables.

## Acceptance Criteria

- [ ] Add `tsconfig.base.json` to the File List in `_bmad-output/implementation-artifacts/1-2-shared-lambda-layer.md`
- [ ] Check off the corresponding Review Follow-up (AI) item in that story file
```

---

## Issue 3 — [HIGH] Add Review Follow-ups (AI) section to Story 1-2 artifact

**Labels:** `task`, `story-1-2`, `code-review`

**Title:** `[Story 1-2] Add Review Follow-ups (AI) section to story artifact`

**Body:**

```markdown
## Summary

Stories 1-3 and 1-4 include a "Review Follow-ups (AI)" section for BMAD code review items. Story 1-2 has no such section, so there is no standard place to track or check off follow-up tasks from the Story 1-2 code review.

## Context

From BMAD code review of Story 1-2. Consistency with other story artifacts.

## Acceptance Criteria

- [ ] Add a "Review Follow-ups (AI)" section to `_bmad-output/implementation-artifacts/1-2-shared-lambda-layer.md` (e.g. after Dev Agent Record or before Dependencies), with placeholder checkboxes for review items; link to this review and `.github/story-1-2-review-issues.md`
- [ ] As issues are created and fixed, add checkboxes and issue numbers to that section
```

---

## Issue 4 — [MEDIUM] Gate x-dev-user-id on explicit env or document NODE_ENV

**Labels:** `task`, `story-1-2`, `code-review`

**Title:** `[Story 1-2] Gate auth stub x-dev-user-id on NODE_ENV or document deployment`

**Body:**

```markdown
## Summary

In `backend/shared/middleware/src/auth.ts`, the dev header `x-dev-user-id` is accepted when `process.env.NODE_ENV !== "production"`. Lambda does not set NODE_ENV by default, so in production this may be undefined and the condition can be true, allowing the dev header in production.

## Context

From BMAD code review of Story 1-2. Security hardening of auth stub.

## Acceptance Criteria

- [ ] Either: (a) Document in auth.ts or .claude/docs that production deployments must set NODE_ENV=production (or equivalent) so the stub is safe, or (b) Gate the dev header on an explicit allowlist (e.g. stage name or env var) instead of relying on NODE_ENV
- [ ] Check off the corresponding Review Follow-up (AI) item in story 1-2 artifact
```

---

## Issue 5 — [MEDIUM] Use top-level import for types in middleware wrapper

**Labels:** `task`, `story-1-2`, `code-review`

**Title:** `[Story 1-2] Use top-level import for @ai-learning-hub/types in wrapper.ts`

**Body:**

```markdown
## Summary

In `backend/shared/middleware/src/wrapper.ts`, when throwing FORBIDDEN for roles/scopes the code uses `await import("@ai-learning-hub/types")`. The rest of the middleware (e.g. error-handler.ts) uses top-level imports. Use a top-level import for AppError and ErrorCode for consistency and to avoid unnecessary async import overhead.

## Context

From BMAD code review of Story 1-2. Code consistency.

## Acceptance Criteria

- [ ] Replace dynamic `await import("@ai-learning-hub/types")` in wrapper.ts with top-level `import { AppError, ErrorCode } from "@ai-learning-hub/types"`
- [ ] Check off the corresponding Review Follow-up (AI) item in story 1-2 artifact
```

---

## Issue 6 — [MEDIUM] Pagination schema and query param coercion

**Labels:** `task`, `story-1-2`, `code-review`

**Title:** `[Story 1-2] Add coercion or docs for pagination schema with query params`

**Body:**

```markdown
## Summary

`paginationSchema` in validation uses `z.number()` for `limit`. API Gateway query parameters are strings. Using `validateQueryParams(paginationSchema, event.queryStringParameters)` will fail without coercion. Add `z.coerce.number()` for limit (or a dedicated query pagination schema) or document that callers must preprocess query params before validation.

## Context

From BMAD code review of Story 1-2. Validation usability for API handlers.

## Acceptance Criteria

- [ ] Either: (a) Add a query-safe pagination schema (e.g. coerce limit from string) and export it, or (b) Document in validation package or .claude/docs that query params must be coerced before passing to paginationSchema
- [ ] Check off the corresponding Review Follow-up (AI) item in story 1-2 artifact
```

---

## Issue 7 — [LOW] Fix Package Dependencies spacing in story artifact

**Labels:** `task`, `story-1-2`, `code-review`

**Title:** `[Story 1-2] Fix double space in Package Dependencies in story artifact`

**Body:**

```markdown
## Summary

In `_bmad-output/implementation-artifacts/1-2-shared-lambda-layer.md`, the "Package Dependencies" block has `@ai-learning-hub/validation  →` (two spaces before the arrow). Use single space for consistency.

## Context

From BMAD code review of Story 1-2. Trivial doc consistency.
```

---

_Full adversarial findings (12 items) are in `_bmad-output/implementation-artifacts/1-2-bmad-code-review.md`. After creating issues, you can update the "Created issues" table above with issue numbers/URLs, or move this file to \_bmad-output/implementation-artifacts/ for history._
