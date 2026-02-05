# Story 1-3 Code Review — GitHub Issues (Created)

**Context:** BMAD code review follow-ups for Story 1.3 (CLAUDE.md and Progressive Disclosure).

## Created issues

| #   | Title                                                       | Issue                                                               | Status |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| 1   | Add CLAUDE.md to story File List                            | [#43](https://github.com/cirruslycurious/ai-learning-hub/issues/43) | Fixed  |
| 2   | Add ADR-011 through ADR-016 to .claude/docs/architecture.md | [#44](https://github.com/cirruslycurious/ai-learning-hub/issues/44) | Fixed  |
| 3   | Document \_bmad-output/ as BMAD planning output in README   | [#45](https://github.com/cirruslycurious/ai-learning-hub/issues/45) | Fixed  |
| 4   | Record CLAUDE.md line count in story Task 1                 | [#46](https://github.com/cirruslycurious/ai-learning-hub/issues/46) | Fixed  |
| 5   | Consider centralizing planning-artifacts path in docs       | [#47](https://github.com/cirruslycurious/ai-learning-hub/issues/47) | Fixed  |
| 6   | Expand persona paths in testing-guide.md                    | [#48](https://github.com/cirruslycurious/ai-learning-hub/issues/48) | Fixed  |

## Resolved (2026-02-04)

All six issues were fixed in repo: CLAUDE.md added to story File List; ADR-011–ADR-016 added to `.claude/docs/architecture.md`; `_bmad-output/planning-artifacts/` documented in `.claude/docs/README.md`; CLAUDE.md line count (98) recorded in Task 1; planning-artifacts path centralized in README with refs in architecture.md and CLAUDE.md; persona paths defined in `.claude/docs/testing-guide.md`. Review Follow-ups (AI) in `_bmad-output/implementation-artifacts/1-3-claude-md-progressive-disclosure.md` are all checked off. Close issues #43–#48 on GitHub when ready.

---

## Original issue definitions (for reference)

## How to create these issues (no longer needed — already created)

- **GitHub UI:** Open your repo → Issues → New issue → paste the **Title** into the title field and the **Body** (code block) into the body. Use labels `task`, and optionally `story-1-3` / `code-review` if they exist.
- **GitHub CLI:** After `gh auth login`, run for each issue:
  ```bash
  gh issue create --title "Title from below" --body "Body from below" --label "task"
  ```
  (Copy each title and body from the sections below.)

---

## Issue 1 — [HIGH] Add CLAUDE.md to Story 1-3 File List

**Labels:** `task`, `story-1.3`, `code-review`

**Title:** `[Story 1-3] Add CLAUDE.md to story File List`

**Body:**

```markdown
## Summary

Story 1-3 File List does not include CLAUDE.md even though AC1 deliverable is "CLAUDE.md is under 200 lines and essential-only." CLAUDE.md was changed in the story commit and should be listed for traceability.

## Context

From BMAD code review of Story 1-3 (CLAUDE.md and Progressive Disclosure). Incomplete documentation of deliverables.

## Acceptance Criteria

- [ ] Add `CLAUDE.md` to the File List in `_bmad-output/implementation-artifacts/1-3-claude-md-progressive-disclosure.md`
- [ ] Check off the corresponding Review Follow-up (AI) item in that story file
```

---

## Issue 2 — [HIGH] Complete ADR summary in .claude/docs/architecture.md

**Labels:** `task`, `story-1.3`, `code-review`

**Title:** `[Story 1-3] Add ADR-011 through ADR-016 to .claude/docs/architecture.md`

**Body:**

```markdown
## Summary

.claude/docs/architecture.md "Key ADRs" table only lists ADR-001 through ADR-010. The full architecture doc has 16 ADRs. Add the missing six so agents loading the summary get platform, auth, API-first, shared libs, and cold-start decisions.

## Context

From BMAD code review of Story 1-3. CLAUDE.md states "16 ADRs finalized"; AC3 requires "ADR list" in architecture.md.

## Missing ADRs (add to Key ADRs table)

- **ADR-011** — Platform Strategy (PWA + Native Roadmap)
- **ADR-012** — Web Share Target for Android PWA
- **ADR-013** — Authentication Provider (Clerk)
- **ADR-014** — API-First Design Philosophy
- **ADR-015** — Lambda Layers for Shared Code
- **ADR-016** — Cold Start Acceptance (V1)

Source: `_bmad-output/planning-artifacts/architecture.md`

## Acceptance Criteria

- [ ] Add rows for ADR-011 through ADR-016 to the Key ADRs table in `.claude/docs/architecture.md`
- [ ] Check off the corresponding Review Follow-up (AI) item in story 1-3
```

---

## Issue 3 — [MEDIUM] Document planning-artifact paths in .claude/docs/README.md

**Labels:** `task`, `story-1.3`, `code-review`

**Title:** `[Story 1-3] Document _bmad-output/ as BMAD planning output in .claude/docs/README.md`

**Body:**

```markdown
## Summary

Add a short note in .claude/docs/README.md that `_bmad-output/planning-artifacts/` is BMAD/planning output and may be regenerated, so maintainers know not to edit it directly for product docs.

## Context

From BMAD code review of Story 1-3. Multiple docs reference \_bmad-output/ without explaining what it is.

## Acceptance Criteria

- [ ] Add one or two sentences in the "Full Sources" (or equivalent) section of `.claude/docs/README.md` stating that \_bmad-output/planning-artifacts/ is BMAD planning output and may be regenerated
- [ ] Check off the corresponding Review Follow-up (AI) item in story 1-3
```

---

## Issue 4 — [MEDIUM] Record CLAUDE.md line count in Story 1-3

**Labels:** `task`, `story-1.3`, `code-review`

**Title:** `[Story 1-3] Record CLAUDE.md line count in story Task 1`

**Body:**

```markdown
## Summary

Story 1-3 Task 1 says "Confirm line count < 200" and is marked done, but the story does not record the actual line count. Recording it (e.g. "89 lines") makes re-verification and audits trivial.

## Context

From BMAD code review of Story 1-3. AC1 requires "line count is under 200."

## Acceptance Criteria

- [ ] In `_bmad-output/implementation-artifacts/1-3-claude-md-progressive-disclosure.md`, under Task 1, add the actual CLAUDE.md line count (e.g. "Confirmed: 89 lines")
- [ ] Check off the corresponding Review Follow-up (AI) item in that story file
```

---

## Issue 5 — [LOW] Centralize planning-artifacts path reference

**Labels:** `task`, `story-1.3`, `code-review`

**Title:** `[Story 1-3] Consider centralizing _bmad-output/planning-artifacts/ path in docs`

**Body:**

```markdown
## Summary

The path `_bmad-output/planning-artifacts/` appears in CLAUDE.md, .claude/docs/README.md, .claude/docs/architecture.md, and possibly others. Consider documenting it once (e.g. in README) and referencing "see README" elsewhere to reduce drift when the path changes.

## Context

From BMAD code review of Story 1-3. Low priority; improves maintainability.

## Acceptance Criteria

- [ ] Decide canonical place for the planning-artifacts path (e.g. .claude/docs/README.md)
- [ ] Add "see .claude/docs/README.md" or equivalent in other files that repeat the path, or leave as-is and close if not worth changing
- [ ] Check off the corresponding Review Follow-up (AI) item in story 1-3
```

---

## Issue 6 — [LOW] Expand "persona paths" in testing-guide.md

**Labels:** `task`, `story-1.3`, `code-review`

**Title:** `[Story 1-3] Expand persona paths in .claude/docs/testing-guide.md`

**Body:**

```markdown
## Summary

AC6 requires "persona paths" in the testing guide. .claude/docs/testing-guide.md mentions "Persona paths" in the E2E row but does not define them or link to where they are specified (e.g. epics). Add one sentence or a link so agents have context.

## Context

From BMAD code review of Story 1-3. Improves on-demand context for test work.

## Acceptance Criteria

- [ ] In `.claude/docs/testing-guide.md`, add one sentence explaining persona paths (e.g. golden paths for key user flows) or link to epics/architecture where they are defined
- [ ] Check off the corresponding Review Follow-up (AI) item in story 1-3
```

---

_After creating issues, you can delete this file or move it to \_bmad-output/implementation-artifacts/ for history._
