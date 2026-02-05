# Story 1.6: GitHub Issue/PR Templates for Agents

Status: done

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

- [x] **Task 1: Audit and align issue templates for agent consumption** (AC: 1, 2)
  - [x] Review existing `.github/ISSUE_TEMPLATE/` (task, feature, bug, epic)
  - [x] Add or adjust sections: Acceptance Criteria, Related files / File list (or placeholder), Testing requirements (or placeholder)
  - [x] Ensure each template has clear scope and consistent structure

- [x] **Task 2: Add story.md (or equivalent) issue template** (AC: 2)
  - [x] Create `.github/ISSUE_TEMPLATE/story.md` for development stories (epic/story ref, AC, related files, testing)
  - [x] Align with BMAD story format (epic X, story Y, AC, file list) so agents can create issues from story artifacts

- [x] **Task 3: Update PR template with agent code-review checklist** (AC: 3)
  - [x] Add checklist items: security scan (or "N/A / documented"), test coverage (e.g. 80%), shared library usage (@ai-learning-hub/*), pattern compliance (no Lambda-to-Lambda, ADR-008, etc.)
  - [x] Keep existing Summary, Related Issue, Changes, Testing, Checklist structure; extend Checklist per FR77

- [x] **Task 4: Document branch and commit conventions** (AC: 4)
  - [x] Ensure CLAUDE.md (or .claude/docs) documents: reference issue numbers in commits; branch naming if adopted (e.g. `feature/`, `fix/`, `story/1-6-...`)
  - [x] If CLAUDE.md is human-owned and already has "Reference issue numbers in commits", add a short "Branch & commit" subsection or link to .claude/docs; otherwise add to .claude/docs and link from CLAUDE.md

- [x] **Task 5: Validate templates and update config if needed** (AC: 1–4)
  - [x] Confirm GitHub uses ISSUE_TEMPLATE (default) and PULL_REQUEST_TEMPLATE.md
  - [x] Add this story artifact to File List; update sprint-status when done

## Dev Notes

- **Relevant architecture:** FR76–FR78 (Epic 1 Agentic GitHub workflow). Cross-cutting: "Complete PR checklist in `.github/pull_request_template.md`" (epics.md). CLAUDE.md is human-owned — document-only changes require approval.
- **Source tree:** `.github/ISSUE_TEMPLATE/*.md`, `.github/PULL_REQUEST_TEMPLATE.md`; optional: `.claude/docs/` for branch/commit doc if not in CLAUDE.md.
- **PR template path:** Repo uses `.github/PULL_REQUEST_TEMPLATE.md` (uppercase). Planning doc `_bmad-output/planning-artifacts/epics.md` may refer to lowercase `pull_request_template.md`; GitHub accepts both; repo convention is uppercase.
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
- .claude/docs/branch-commit-conventions.md _(new)_
- .claude/docs/README.md
- scripts/validate-templates.mjs _(new, L4/#66)_

## Dev Agent Record

### Agent Model Used

_Dev story build (BMAD dev-story workflow)._

### Debug Log References

_(Optional)_

### Completion Notes List

- **Task 1:** Aligned task, feature, bug, epic templates with sections: Acceptance Criteria (or clarified), Related Files / File List, Testing Requirements. Clear scope in Summary where missing.
- **Task 2:** Added `.github/ISSUE_TEMPLATE/story.md` with Epic/Story Reference, AC, Related Files, Testing Requirements; aligned with BMAD story format.
- **Task 3:** Extended `.github/PULL_REQUEST_TEMPLATE.md` with "Agent / Code Review (FR77)" checklist: security scan, test coverage, shared libraries (@ai-learning-hub/*), pattern compliance (no Lambda-to-Lambda, ADR-008), CLAUDE.md/.claude/docs.
- **Task 4:** Created `.claude/docs/branch-commit-conventions.md` (commit messages, issue refs, optional branch naming). Linked from `.claude/docs/README.md`. CLAUDE.md not modified (human-owned); conventions discoverable via .claude/docs.
- **Task 5:** File List and sprint-status updated. Validation is manual (create sample issue from each template, draft PR with checklist).

### Review Follow-ups (AI)

- [ ] [AI-Review][Medium] **#62** Add `branch-commit-conventions.md` to CLAUDE.md Context Loading section (lines 64–71). Requires human approval — CLAUDE.md is human-owned. Suggested bullet: `` `.claude/docs/branch-commit-conventions.md` - Branch naming, commit style, issue refs ``. [CLAUDE.md]
- [x] [AI-Review][Low] **#63** Document in story Dev Notes: repo uses `.github/PULL_REQUEST_TEMPLATE.md` (uppercase); epics.md uses lowercase. Do not change planning-artifacts. [1-6-github-templates.md]
- [x] [AI-Review][Low] **#64** Add one example line under Acceptance Criteria in task.md (e.g. Given X, when Y, then Z). [.github/ISSUE_TEMPLATE/task.md]
- [x] [AI-Review][Low] **#65** Add one example epic AC in epic.md (e.g. All linked issues closed). [.github/ISSUE_TEMPLATE/epic.md]
- [x] [AI-Review][Low] **#66** Add CI or script to validate issue/PR template frontmatter and required sections (optional). [scripts/validate-templates.mjs + npm run validate-templates]
- [x] [AI-Review][Low] **#67** Add "(or N/A for docs-only PRs)" to PR template shared-libraries bullet. [.github/PULL_REQUEST_TEMPLATE.md]
- [x] [AI-Review][Low] **#68** L6 cross-ref only — no code change; story File List already correct. [N/A]

---

## Senior Developer Review (AI)

**Reviewer:** Adversarial code review (BMAD workflow)  
**Date:** 2026-02-05

**Git vs Story:** 0 discrepancies (no uncommitted changes; File List matches repo).

**Issues found:** 1 Medium, 6 Low (7 total). All ACs implemented; all [x] tasks done.

**Findings summary:**
- **M1:** AC4 discoverability — CLAUDE.md Context Loading omits `branch-commit-conventions.md`; add bullet (requires human approval; CLAUDE.md is human-owned).
- **L1–L6:** Doc casing (epics.md vs repo PR template path), task/epic template AC examples, optional automated template validation, PR shared-libraries N/A wording, cross-ref only for L6.

**Full details:** `.github/story-1-6-review-issues.md`

**Outcome:** Approve with minor follow-ups. No HIGH/CRITICAL.

**#62 (M1) — Suggested CLAUDE.md change (human approval required):** In CLAUDE.md, under "Context Loading", add a fifth bullet: `` `.claude/docs/branch-commit-conventions.md` - Branch naming, commit style, issue refs ``. CLAUDE.md is human-owned; apply this change only with explicit approval.
