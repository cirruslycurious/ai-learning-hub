# Story 1.4: Custom Slash Commands for Workflows

Status: done

## Story

As a **developer (human or AI agent)**,
I want **custom slash commands for common workflows (.claude/commands/) with a 7-layer prompt structure and model selection**,
so that **I can invoke fix-issue, create-lambda, create-component, run-tests, and deploy consistently with the right model and context**.

## Acceptance Criteria

1. **AC1: Project slash commands exist for the five common workflows**
   - GIVEN the .claude/commands/ directory
   - WHEN I list project commands
   - THEN project-fix-github-issue, project-create-lambda, project-create-component, project-run-tests, project-deploy exist
   - AND each is invocable (e.g. /project-fix-github-issue N)

2. **AC2: Each command uses the 7-layer prompt structure**
   - GIVEN any project command file
   - WHEN I read the command content
   - THEN it contains sections: Role, Background, Rules, Context, Task, Output format, Prefill (optional)
   - AND the order is Role → Background → Rules → Context → Task → Format → Prefill

3. **AC3: Model selection is specified per command**
   - GIVEN any project command
   - WHEN I read the frontmatter or prompt
   - THEN a model is specified (Auto in Cursor, or Haiku/Sonnet/Opus when applicable)
   - AND README documents Cursor: prefer Auto; override for faster runs (e.g. run-tests) or stronger model (complex fixes)

4. **AC4: Commands reference project context**
   - GIVEN a project command
   - WHEN the agent runs it
   - THEN the command references CLAUDE.md, .claude/docs/, and project structure (frontend, backend, infra, shared)
   - AND rules align with NEVER/ALWAYS in CLAUDE.md (e.g. use @ai-learning-hub/*, run npm test, no Lambda-to-Lambda)

5. **AC5: Commands are documented**
   - GIVEN .claude/commands/
   - WHEN I read README or CLAUDE.md
   - THEN project commands are listed with description and model
   - AND the 7-layer structure and model selection are explained

## Tasks / Subtasks

- [x] **Task 1: Create project-fix-github-issue.md** (AC: 1, 2, 3, 4)
  - [x] 7-layer structure; model Sonnet; reference issue templates, progress docs, npm test, issue ref in commits

- [x] **Task 2: Create project-create-lambda.md** (AC: 1, 2, 3, 4)
  - [x] 7-layer structure; model Sonnet; reference backend/functions, shared libs, CDK, api-patterns, no Lambda-to-Lambda

- [x] **Task 3: Create project-create-component.md** (AC: 1, 2, 3, 4)
  - [x] 7-layer structure; model Sonnet; reference frontend structure, tests, TypeScript

- [x] **Task 4: Create project-run-tests.md** (AC: 1, 2, 3, 4)
  - [x] 7-layer structure; model Haiku; reference npm test, testing-guide, 80% coverage

- [x] **Task 5: Create project-deploy.md** (AC: 1, 2, 3, 4)
  - [x] 7-layer structure; model Sonnet; reference infra/, CDK, quality checks, dev default

- [x] **Task 6: Document commands and structure** (AC: 5)
  - [x] Add .claude/commands/README.md with command list, model table, 7-layer explanation

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Update CLAUDE.md Commands section to use hyphen syntax (e.g. `/project-fix-github-issue N`) so it matches README and actual Cursor invocation; CLAUDE.md is human-owned so change requires approval. [CLAUDE.md:55-59]
- [x] [AI-Review][MEDIUM] Commit story 1-4 deliverables: .claude/commands/*.md, README.md, and this story artifact (and sprint-status if desired) as a single logical change. [uncommitted files]
- [x] [AI-Review][LOW] In .claude/commands/README.md, clarify model-selection.md reference: add "Planned in Story 1.12 (not yet implemented)." [.claude/commands/README.md]
- [x] [AI-Review][LOW] In project-create-component.md, use consistent placeholder notation for component path (e.g. `<Name>` in both Background and Prefill). [.claude/commands/project-create-component.md]
- [x] [AI-Review][LOW] In project-deploy.md Task step 2, add one sentence: prefer `cdk deploy --all` from infra/ unless the user specified a single stack. [.claude/commands/project-deploy.md]
- [x] [AI-Review][LOW] In project-run-tests.md, clarify workspace scope: for "run backend tests only", add line: use root `npm test` with workspace filter if supported, or `cd <workspace> && npm test`. [.claude/commands/project-run-tests.md]

## Dependencies

- **Depends on:** Story 1.1 (monorepo), Story 1.2 (shared libs), Story 1.3 (.claude/docs/ for architecture, api-patterns, testing-guide)
- **Blocks:** None; enables consistent agent workflows for all later development

## Out of Scope

- Prompt evaluation tests and version changelog for commands — Story 1.11
- Model selection guide (.claude/docs/model-selection.md) — Story 1.12
- Specialist subagent library (.claude/agents/) — Story 1.13

## Validation (2026-02-04)

- **AC1:** All five command files exist and are invocable in Cursor.
- **AC2:** Each command has sections 1–7 in order (Role, Background, Rules, Context, Task, Output format, Prefill); spot-checked on fix-github-issue, create-lambda, run-tests.
- **AC3:** Frontmatter `model: auto` on all commands; README documents Cursor + Auto and when to override.
- **AC4:** Commands reference CLAUDE.md, .claude/docs/, frontend/backend/infra/shared; rules align with NEVER/ALWAYS (e.g. @ai-learning-hub/*, npm test, no Lambda-to-Lambda).
- **AC5:** .claude/commands/README.md lists commands with description and model; 7-layer structure and model selection explained.

**Deep dive:** Optional. For adversarial review (prompt clarity, edge cases, alignment with CLAUDE.md), run the code-review workflow with fresh context.

## File List

- _bmad-output/implementation-artifacts/1-4-custom-slash-commands.md
- .claude/commands/README.md
- .claude/commands/project-fix-github-issue.md
- .claude/commands/project-create-lambda.md
- .claude/commands/project-create-component.md
- .claude/commands/project-run-tests.md
- .claude/commands/project-deploy.md

---

## Senior Developer Review (AI)

**Reviewer:** BMAD code-review workflow (adversarial)  
**Date:** 2026-02-04  
**Story:** 1-4-custom-slash-commands  
**Git vs Story:** All listed files present; all are untracked (??). No staged/committed changes for story 1-4 deliverables.

### Summary

- **Issues found:** 2 Medium, 4 Low (6 total)
- **AC status:** AC1–AC5 implemented; one documentation inconsistency affects usability (CLAUDE.md vs actual invocation).

### 🔴 CRITICAL ISSUES

- None. All tasks marked [x] are implemented; all ACs are satisfied by the command files and README.

### 🟡 MEDIUM ISSUES

1. **CLAUDE.md command syntax disagrees with filenames and README**  
   CLAUDE.md (lines 55–59) documents commands with a **colon**: `/project:fix-github-issue N`, `/project:create-lambda name`, etc. The story, README, and actual filenames use **hyphens**: `project-fix-github-issue`, `project-create-lambda`, etc. In Cursor, slash commands are derived from the command file name (e.g. `project-fix-github-issue.md` → `/project-fix-github-issue`). **Action:** Update CLAUDE.md Commands section to use hyphens (e.g. `/project-fix-github-issue N`) so it matches README and actual invocation. *(Note: CLAUDE.md is human-owned; change requires approval.)*

2. **Story 1-4 deliverables are uncommitted**  
   All seven files in the story File List are untracked (`??`) or modified but uncommitted. If the story is considered "done", the repo state should include these changes committed so handoff and history are clear. **Action:** Commit the .claude/commands/* and story artifact (and any related sprint-status change) as a single logical change for story 1-4.

### 🟢 LOW ISSUES

3. **README reference to model-selection.md**  
   README says "See `.claude/docs/model-selection.md` when available (Story 1.12)." The phrase "when available" is vague. **Suggestion:** Add "Planned in Story 1.12 (not yet implemented)." for clarity.

4. **project-create-component path placeholder**  
   Background uses `frontend/src/components/<Name>/` and Prefill uses `Name`; angle-bracket vs plain placeholder is minor. **Suggestion:** Use consistent notation (e.g. `<Name>` in both) or add one sentence that "Name" is the component name in PascalCase.

5. **project-deploy default stack**  
   Task step 2 gives two options ("cdk deploy --all" or "the main stack") without saying when to use which. **Suggestion:** One sentence: e.g. "Prefer `cdk deploy --all` from infra/ unless the user specified a single stack."

6. **project-run-tests workspace scope**  
   If the user says "run backend tests only", the command says "run `npm test` in that directory" but doesn't specify whether to use `npm test --workspace=@ai-learning-hub/backend` (or similar) from root vs `cd backend && npm test`. **Suggestion:** Add one line: "For a single workspace, run `npm test` from the repo root with workspace filter if the root package.json supports it, or `cd <workspace> && npm test`."

### Outcome

- **Recommendation:** **Changes requested** (documentation and commit state). No blocking issues; ACs are met. Fix MEDIUM items (CLAUDE.md with approval, commit story 1-4 files) and optionally address LOW items.

---

### Re-review (2026-02-04)

**Story:** 1-4-custom-slash-commands  
**Git vs Story:** Story 1-4 deliverables committed in `a58027f` (feat: add custom slash commands for workflows (story 1-4)). All seven File List items are in repo history. Current uncommitted: `sprint-status.yaml` (modified), `.github/story-1-3-review-issues.md` and `.github/story-1-4-review-issues.md` (untracked).

**Verification:** All six Review Follow-ups (AI) are marked [x]. Spot-check of implementation:

- **MEDIUM 1 (CLAUDE.md hyphen syntax):** Fixed. CLAUDE.md Commands section (lines 58–62) uses `/project-fix-github-issue N`, `/project-create-lambda name`, etc.
- **MEDIUM 2 (commit deliverables):** Fixed. Commit `a58027f` includes story 1-4 deliverables.
- **LOW 3 (README model-selection):** Fixed. README says "planned in Story 1.12 (not yet implemented)."
- **LOW 4 (create-component placeholder):** Fixed. Prefill uses `frontend/src/components/<Name>/` and "(Name is the component name in PascalCase.)"
- **LOW 5 (deploy default stack):** Fixed. Rules include "Prefer `cdk deploy --all` from infra/ unless the user specified a single stack."
- **LOW 6 (run-tests workspace scope):** Fixed. Background specifies root workspace filter or `cd <workspace> && npm test`.

**Re-review outcome:** No open issues. Story 1-4 remains **done**; code review follow-ups are complete.

---

## Change Log

| Date       | Event                    | Notes |
| ---------- | ------------------------- | ----- |
| 2026-02-04 | Validation                | AC1–AC5 spot-checked; story marked done. |
| 2026-02-04 | Senior Developer Review   | Adversarial review: 2 Medium, 4 Low; CLAUDE.md command syntax and uncommitted deliverables. |
| 2026-02-04 | Re-review                 | All six Review Follow-ups verified implemented; no open issues. Story 1-4 done. |
