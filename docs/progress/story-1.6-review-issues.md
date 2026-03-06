# Story 1-6 Code Review — Findings

**Story:** 1-6-github-templates.md  
**Reviewer:** Adversarial code review (BMAD workflow)  
**Date:** 2026-02-05

## Git vs Story Discrepancies

- **Uncommitted changes:** None (working tree clean).
- **File List vs repo:** All files in the story File List exist and match paths. No false claims.

## Summary

| Severity  | Count |
| --------- | ----- |
| High      | 0     |
| Medium    | 1     |
| Low       | 6     |
| **Total** | **7** |

All Acceptance Criteria are **implemented**. All tasks marked [x] are **done**. The following are quality and consistency improvements, not AC failures.

---

## MEDIUM

### M1: AC4 discoverability — branch/commit not listed in CLAUDE.md Context Loading

- **Where:** CLAUDE.md "Context Loading" (lines 64–71).
- **What:** The section lists four `.claude/docs/` files (architecture, database-schema, api-patterns, testing-guide) but does **not** list `branch-commit-conventions.md`. AC4 requires branch/commit conventions to be "discoverable from CLAUDE.md or a linked doc." They are only discoverable by opening `.claude/docs/README.md` and reading the table.
- **Evidence:** CLAUDE.md has "Reference issue numbers in commits" in ALWAYS and a general "read from `.claude/docs/`" pointer, but no explicit mention of branch/commit or the conventions doc.
- **Recommendation:** Add a bullet such as:  
  `- \`.claude/docs/branch-commit-conventions.md\` - Branch naming, commit style, issue refs`  
  (CLAUDE.md is human-owned; change requires explicit approval.)

---

## LOW

### L1: Planning doc PR template path case

- **Where:** `_bmad-output/planning-artifacts/epics.md` (e.g. "Complete PR checklist in `.github/pull_request_template.md`").
- **What:** Epics.md uses lowercase `pull_request_template.md`; repo and story use `.github/PULL_REQUEST_TEMPLATE.md`. No runtime impact (GitHub accepts both) but doc inconsistency.
- **Recommendation:** Note in story Dev Notes or completion notes which casing the repo uses; do not change planning-artifacts (human-owned).

### L2: task.md Acceptance Criteria — no example for agents

- **Where:** `.github/ISSUE_TEMPLATE/task.md` — "Acceptance Criteria" has "Testable criteria. Use checkboxes." and two empty `- [ ]`.
- **What:** feature.md and story.md give clearer guidance (e.g. Given/When/Then). task.md could add one line (e.g. "e.g. Given X, when Y, then Z.") for agent parsing.
- **Recommendation:** Add one example line under Acceptance Criteria in task.md.

### L3: epic.md Acceptance Criteria — no example

- **Where:** `.github/ISSUE_TEMPLATE/epic.md` — "How do we know this epic is done? Use checkboxes." and two empty `- [ ]`.
- **What:** Same as L2; no example criterion. Other templates give slightly more structure.
- **Recommendation:** Add one example epic AC (e.g. "All linked issues closed") for consistency.

### L4: No automated template validation

- **Where:** Story scope (Dev Notes: "Validation is manual").
- **What:** There is no automated check that issue/PR templates have required frontmatter (name, about, labels) or required sections. Manual validation only.
- **Recommendation:** Optional follow-up: add a small CI or script that validates YAML frontmatter and presence of key sections (e.g. Acceptance Criteria, Related Files, Testing Requirements) to reduce regression risk.

### L5: PR template shared-libraries item — docs-only PRs

- **Where:** `.github/PULL_REQUEST_TEMPLATE.md` — "Shared libraries: Lambdas/backend use `@ai-learning-hub/*` where applicable".
- **What:** For docs-only or frontend-only PRs this is N/A; "where applicable" covers it but could be clearer.
- **Recommendation:** Add "(or N/A for docs-only PRs)" to the shared-libraries bullet for clarity.

### L6: Story File List — PR template path casing

- **Where:** Story File List and completion notes use `.github/PULL_REQUEST_TEMPLATE.md`.
- **What:** Repo file is `.github/PULL_REQUEST_TEMPLATE.md` (uppercase). Story is consistent; epics.md is not (see L1). No change needed in story; cross-reference only.

---

## AC / Task Verification

| AC  | Status      | Notes                                                                                                                                                               |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Implemented | task, feature, bug, epic, story all have scope, AC, Related Files, Testing Requirements; structure consistent.                                                      |
| AC2 | Implemented | `.github/ISSUE_TEMPLATE/story.md` exists with Epic/Story Reference, AC, Related Files, Testing Requirements; aligned with BMAD.                                     |
| AC3 | Implemented | PR template has "Agent / Code Review (FR77)" with security, test coverage, @ai-learning-hub/\*, pattern compliance, CLAUDE.md/.claude/docs; all checkboxes.         |
| AC4 | Implemented | `.claude/docs/branch-commit-conventions.md` exists; linked from `.claude/docs/README.md`; CLAUDE.md links to .claude/docs (M1 is discoverability improvement only). |

| Task   | Status | Notes                                                                                       |
| ------ | ------ | ------------------------------------------------------------------------------------------- |
| Task 1 | Done   | All four existing templates updated with AC, Related Files, Testing Requirements.           |
| Task 2 | Done   | story.md added with required sections.                                                      |
| Task 3 | Done   | PR template extended with FR77 checklist.                                                   |
| Task 4 | Done   | branch-commit-conventions.md created; README updated; CLAUDE.md not modified (human-owned). |
| Task 5 | Done   | File List and sprint-status updated (1-6-github-templates: review).                         |

---

## Outcome

- **Recommendation:** **Approve with minor follow-ups.** No HIGH or CRITICAL issues; one MEDIUM (CLAUDE.md discoverability, subject to human approval) and six LOW improvements.
- **Story status after review:** Leave as **review** until you decide whether to apply fixes or add action items; then set to **done** or **in-progress** and sync sprint-status accordingly.

**GitHub issues created (one per action item):** #62 (M1), #63 (L1), #64 (L2), #65 (L3), #66 (L4), #67 (L5), #68 (L6).
