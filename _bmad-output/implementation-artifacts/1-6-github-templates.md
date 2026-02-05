# Story 1.6: GitHub Issue/PR Templates for Agents

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer (human or AI agent)**,
I want **GitHub issue and PR templates structured for agent consumption (clear scope, acceptance criteria, related files, testing requirements, and PR checklist for agent-generated code)**,
so that **agents and humans can open consistent, actionable issues and PRs that support code review, security scan, test coverage, and pattern compliance**.

## Acceptance Criteria

1. **AC1: Issue templates support agent consumption (FR76)**
   - GIVEN `.github/ISSUE_TEMPLATE/`
   - WHEN I create a new issue (task, feature, bug, epic, or story)
   - THEN each template includes: clear scope, acceptance criteria section, related files (or placeholder), and testing requirements (or placeholder)
   - AND structure is consistent so agents can parse and fill them reliably

2. **AC2: A dedicated story template exists for development stories**
   - GIVEN the repo uses BMAD story artifacts and epic/story tracking
   - WHEN I need to open an issue for a development story (implementation task from epic/story)
   - THEN a "Story" or equivalent issue template is available (e.g. `.github/ISSUE_TEMPLATE/story.md`)
   - AND it includes: story/epic reference, acceptance criteria, file list / related files, testing requirements

3. **AC3: PR template includes agent code-review checklist (FR77)**
   - GIVEN `.github/PULL_REQUEST_TEMPLATE.md`
   - WHEN I open a PR (human- or agent-generated)
   - THEN the template includes checklist items for: security scan (or note), test coverage, shared library usage (@ai-learning-hub/*), pattern compliance (e.g. no Lambda-to-Lambda, ADR-008 errors)
   - AND the checklist is actionable (checkboxes) and aligned with CLAUDE.md / .claude/docs conventions

4. **AC4: Branch and commit conventions documented (FR78)**
   - GIVEN CLAUDE.md or .claude/docs
   - WHEN a developer or agent needs to follow repo conventions
   - THEN branch naming and commit message conventions are documented (e.g. "Reference issue numbers in commits", conventional commit style if used)
   - AND they are discoverable from CLAUDE.md or a linked doc (enforcement via hooks is Story 1.5)

## Tasks / Subtasks

- [ ] **Task 1: Audit and align issue templates for agent consumption** (AC: 1, 2)
  - [ ] Review existing `.github/ISSUE_TEMPLATE/` (task, feature, bug, epic)
  - [ ] Add or adjust sections: Acceptance Criteria, Related files / File list (or placeholder), Testing requirements (or placeholder)
  - [ ] Ensure each template has clear scope and consistent structure

- [ ] **Task 2: Add story.md (or equivalent) issue template** (AC: 2)
  - [ ] Create `.github/ISSUE_TEMPLATE/story.md` for development stories (epic/story ref, AC, related files, testing)
  - [ ] Align with BMAD story format (epic X, story Y, AC, file list) so agents can create issues from story artifacts

- [ ] **Task 3: Update PR template with agent code-review checklist** (AC: 3)
  - [ ] Add checklist items: security scan (or "N/A / documented"), test coverage (e.g. 80%), shared library usage (@ai-learning-hub/*), pattern compliance (no Lambda-to-Lambda, ADR-008, etc.)
  - [ ] Keep existing Summary, Related Issue, Changes, Testing, Checklist structure; extend Checklist per FR77

- [ ] **Task 4: Document branch and commit conventions** (AC: 4)
  - [ ] Ensure CLAUDE.md (or .claude/docs) documents: reference issue numbers in commits; branch naming if adopted (e.g. `feature/`, `fix/`, `story/1-6-...`)
  - [ ] If CLAUDE.md is human-owned and already has "Reference issue numbers in commits", add a short "Branch & commit" subsection or link to .claude/docs; otherwise add to .claude/docs and link from CLAUDE.md

- [ ] **Task 5: Validate templates and update config if needed** (AC: 1–4)
  - [ ] Confirm GitHub uses ISSUE_TEMPLATE (default) and PULL_REQUEST_TEMPLATE.md
  - [ ] Add this story artifact to File List; update sprint-status when done

## Dev Notes

- **Relevant architecture:** FR76–FR78 (Epic 1 Agentic GitHub workflow). Cross-cutting: "Complete PR checklist in `.github/pull_request_template.md`" (epics.md). CLAUDE.md is human-owned — document-only changes require approval.
- **Source tree:** `.github/ISSUE_TEMPLATE/*.md`, `.github/PULL_REQUEST_TEMPLATE.md`; optional: `.claude/docs/` for branch/commit doc if not in CLAUDE.md.
- **Testing:** No code tests; validation is manual (create a sample issue from each template, open a draft PR and verify checklist).

### Project Structure Notes

- Repo already has: `bug.md`, `epic.md`, `feature.md`, `task.md` in ISSUE_TEMPLATE; `PULL_REQUEST_TEMPLATE.md` at repo root under `.github/`. Add `story.md` and extend existing templates.
- Naming: GitHub expects `PULL_REQUEST_TEMPLATE.md` or `.github/pull_request_template.md`; confirm which is in use and keep consistent.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] Epic 1 stories table — Story 1.6 description; FR76–FR78; Key Deliverables "GitHub issue/PR templates for agent consumption"
- [Source: _bmad-output/planning-artifacts/epics.md] Recommended file structure — `.github/ISSUE_TEMPLATE/story.md`, `bug.md`; `pull_request_template.md` with "AI code review checklist"
- [Source: CLAUDE.md] ALWAYS — "Reference issue numbers in commits (e.g., "fix: resolve save error #42")"
- [Source: .github/ISSUE_TEMPLATE/*.md] Existing templates for current structure and labels
- [Source: .github/PULL_REQUEST_TEMPLATE.md] Current PR checklist to extend

## Dependencies

- **Depends on:** Story 1.1 (monorepo), Story 1.2 (shared libs), Story 1.3 (CLAUDE.md, .claude/docs)
- **Blocks:** None; improves consistency for all later PRs and issues. Story 1.5 (hooks) enforces conventions; 1.6 documents them.

## Out of Scope

- Implementing or changing commit hooks (Story 1.5)
- CI workflow changes (e.g. GitHub Actions that validate PR checklist) — Story 1.7
- Creating actual GitHub labels (task, bug, feature, epic, story-1-6, etc.) — assume they exist or are created separately

## File List

- _bmad-output/implementation-artifacts/1-6-github-templates.md
- .github/ISSUE_TEMPLATE/task.md
- .github/ISSUE_TEMPLATE/feature.md
- .github/ISSUE_TEMPLATE/bug.md
- .github/ISSUE_TEMPLATE/epic.md
- .github/ISSUE_TEMPLATE/story.md _(new)_
- .github/PULL_REQUEST_TEMPLATE.md
- _(Optional)_ .claude/docs/branch-commit-conventions.md — only if conventions are not added to CLAUDE.md

## Dev Agent Record

### Agent Model Used

_(To be filled by dev agent)_

### Debug Log References

_(Optional)_

### Completion Notes List

_(To be filled when story is implemented)_

### Review Follow-ups (AI)

_(To be filled after code review if any)_
