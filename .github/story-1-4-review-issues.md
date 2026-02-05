# Story 1-4 Code Review — GitHub Issues (Created)

**Context:** BMAD code review follow-ups for Story 1.4 (Custom Slash Commands for Workflows).

## Created issues

| #   | Title                                                               | Issue                                                               | Status |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| 1   | [Story 1-4] Align CLAUDE.md Commands with hyphen syntax             | [#49](https://github.com/cirruslycurious/ai-learning-hub/issues/49) | Open   |
| 2   | [Story 1-4] Commit story 1-4 deliverables                           | [#50](https://github.com/cirruslycurious/ai-learning-hub/issues/50) | Open   |
| 3   | [Story 1-4] Clarify model-selection.md reference in commands README | [#51](https://github.com/cirruslycurious/ai-learning-hub/issues/51) | Open   |
| 4   | [Story 1-4] Consistent path placeholder in project-create-component | [#52](https://github.com/cirruslycurious/ai-learning-hub/issues/52) | Open   |
| 5   | [Story 1-4] Clarify default stack in project-deploy                 | [#53](https://github.com/cirruslycurious/ai-learning-hub/issues/53) | Open   |
| 6   | [Story 1-4] Clarify workspace scope in project-run-tests            | [#54](https://github.com/cirruslycurious/ai-learning-hub/issues/54) | Open   |

Issues created 2026-02-04 via `gh issue create`.

---

## How to create these issues

- **GitHub UI:** Repo → Issues → New issue → choose **Task** template (or blank). Paste the **Title** and **Body** from each section below. Add labels: `task`, and optionally `story-1-4`, `code-review` if they exist.
- **GitHub CLI:** After `gh auth login`, run for each issue (copy title and body from below):
  ```bash
  gh issue create --title "Title from below" --body "Body from below" --label "task"
  ```

---

## Issue 1 — [MEDIUM] Align CLAUDE.md Commands with hyphen syntax

**Labels:** `task`, `story-1-4`, `code-review`

**Title:** `[Story 1-4] Align CLAUDE.md Commands with hyphen syntax`

**Body:**

```markdown
## Summary

CLAUDE.md (Commands section) documents slash commands with a **colon**: `/project:fix-github-issue N`, `/project:create-lambda name`, etc. The story, README, and actual command filenames use **hyphens**: `project-fix-github-issue`, `project-create-lambda`. In Cursor, commands are derived from the file name (e.g. `project-fix-github-issue.md` → `/project-fix-github-issue`). Align CLAUDE.md with hyphen syntax so docs match invocation.

## Context

From BMAD code review of Story 1.4 (Custom Slash Commands). CLAUDE.md is human-owned; change requires approval.

## Acceptance Criteria

- [ ] In CLAUDE.md Commands section (lines 55–59), change all command examples from colon to hyphen: e.g. `/project:fix-github-issue` → `/project-fix-github-issue`, and same for create-lambda, create-component, run-tests, deploy.
- [ ] Check off the corresponding Review Follow-up (AI) item in `_bmad-output/implementation-artifacts/1-4-custom-slash-commands.md`.
```

---

## Issue 2 — [MEDIUM] Commit story 1-4 deliverables

**Labels:** `task`, `story-1-4`, `code-review`

**Title:** `[Story 1-4] Commit story 1-4 deliverables`

**Body:**

```markdown
## Summary

All story 1-4 deliverable files are currently untracked or uncommitted. For a "done" story, the repo state should include these changes committed so handoff and history are clear.

## Context

From BMAD code review of Story 1.4. File List: .claude/commands/README.md, .claude/commands/project-\*.md (five files), and \_bmad-output/implementation-artifacts/1-4-custom-slash-commands.md. Optionally include sprint-status.yaml if it was updated for story 1-4.

## Acceptance Criteria

- [ ] Commit .claude/commands/README.md and all five .claude/commands/project-\*.md files.
- [ ] Commit \_bmad-output/implementation-artifacts/1-4-custom-slash-commands.md (and sprint-status.yaml if applicable).
- [ ] Use a single logical commit (e.g. "feat: add custom slash commands for workflows (story 1-4)").
- [ ] Check off the corresponding Review Follow-up (AI) item in the story file.
```

---

## Issue 3 — [LOW] Clarify model-selection.md reference in commands README

**Labels:** `task`, `story-1-4`, `code-review`

**Title:** `[Story 1-4] Clarify model-selection.md reference in commands README`

**Body:**

```markdown
## Summary

.claude/commands/README.md says "See `.claude/docs/model-selection.md` when available (Story 1.12)." The phrase "when available" is vague. Add "Planned in Story 1.12 (not yet implemented)." for clarity.

## Context

From BMAD code review of Story 1.4. Low priority; improves clarity for readers.

## Acceptance Criteria

- [ ] In .claude/commands/README.md, update the model-selection.md sentence to include "Planned in Story 1.12 (not yet implemented)." or equivalent.
- [ ] Check off the corresponding Review Follow-up (AI) item in the story file.
```

---

## Issue 4 — [LOW] Consistent path placeholder in project-create-component

**Labels:** `task`, `story-1-4`, `code-review`

**Title:** `[Story 1-4] Consistent path placeholder in project-create-component`

**Body:**

```markdown
## Summary

In .claude/commands/project-create-component.md, Background uses `frontend/src/components/<Name>/` and Prefill uses `Name` without angle brackets. Use consistent placeholder notation (e.g. `<Name>` in both) or add one sentence that "Name" is the component name in PascalCase.

## Context

From BMAD code review of Story 1.4. Minor clarity improvement.

## Acceptance Criteria

- [ ] In project-create-component.md, make placeholder notation consistent (Background and Prefill) or add a brief clarification.
- [ ] Check off the corresponding Review Follow-up (AI) item in the story file.
```

---

## Issue 5 — [LOW] Clarify default stack in project-deploy

**Labels:** `task`, `story-1-4`, `code-review`

**Title:** `[Story 1-4] Clarify default stack in project-deploy`

**Body:**

```markdown
## Summary

.claude/commands/project-deploy.md Task step 2 gives two options ("cdk deploy --all" or "the main stack") without saying when to use which. Add one sentence: prefer `cdk deploy --all` from infra/ unless the user specified a single stack.

## Context

From BMAD code review of Story 1.4. Reduces ambiguity for agents running the command.

## Acceptance Criteria

- [ ] In project-deploy.md Task step 2 (or Rules), add one sentence clarifying default: prefer `cdk deploy --all` unless the user specified a single stack.
- [ ] Check off the corresponding Review Follow-up (AI) item in the story file.
```

---

## Issue 6 — [LOW] Clarify workspace scope in project-run-tests

**Labels:** `task`, `story-1-4`, `code-review`

**Title:** `[Story 1-4] Clarify workspace scope in project-run-tests`

**Body:**

```markdown
## Summary

When the user says "run backend tests only," .claude/commands/project-run-tests.md says "run `npm test` in that directory" but doesn't specify whether to use root `npm test` with a workspace filter (e.g. `npm test --workspace=...`) or `cd backend && npm test`. Add one line clarifying: use root `npm test` with workspace filter if the root package.json supports it, or `cd <workspace> && npm test`.

## Context

From BMAD code review of Story 1.4. Ensures consistent behavior when running a single workspace.

## Acceptance Criteria

- [ ] In project-run-tests.md (Background or Rules), add one sentence: for a single workspace, run `npm test` from repo root with workspace filter if supported, or `cd <workspace> && npm test`.
- [ ] Check off the corresponding Review Follow-up (AI) item in the story file.
```

---

_After creating issues, you can update the "Created issues" table above with issue numbers/URLs, or move this file to \_bmad-output/implementation-artifacts/ for history._
