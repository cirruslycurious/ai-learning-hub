# Multi-Agent Code Review Loop

Supporting reference for the epic orchestrator. Read this file when entering Step 2.5 (Code Review Loop).

## Protocol Overview

Execute up to 3 review-fix cycles to achieve code quality convergence. The orchestrator coordinates between a **reviewer subagent** (fresh context, read-only) and a **fixer subagent** (implementation context, full edit tools).

**Max rounds:** 3
**Clean state:** 0 MUST-FIX findings (Critical + Important)
**Exit conditions:** Clean state reached OR max rounds exceeded

## Step A: Spawn Reviewer Subagent

Use Task tool to spawn the `epic-reviewer` subagent with a fresh context window:

```
Task tool invocation:
  subagent_type: "epic-reviewer"
  prompt: |
    Review Story {story.id}: {story.title}
    Branch: {branchName}
    Base branch: {baseBranch}
    Round: {round}

    Review the code changes on this branch compared to the base branch.
    Write your findings to: docs/progress/story-{story.id}-review-findings-round-{round}.md

    Use the structured findings format with Critical/Important/Minor categories.
```

**CRITICAL:** The reviewer agent has NO implementation context — it sees only the code on the branch. This ensures genuinely adversarial review with no implementation bias.

**Output:** The reviewer writes findings to `docs/progress/story-{story.id}-review-findings-round-{round}.md`

## Findings Document Format

```markdown
# Story X.Y Code Review Findings - Round {round}

**Reviewer:** Agent (Fresh Context)
**Date:** YYYY-MM-DD HH:MM
**Branch:** story-X-Y-description

## Critical Issues (Must Fix)

1. **[Category]:** Description
   - **File:** path/to/file.ts:line
   - **Problem:** Specific problem description
   - **Impact:** Why this matters
   - **Fix:** Suggested fix

## Important Issues (Should Fix)

2. **[Category]:** Description
   - **File:** path/to/file.ts:line
   - **Problem:** Specific problem description
   - **Impact:** Why this matters
   - **Fix:** Suggested fix

## Minor Issues (Nice to Have)

3. **[Category]:** Description
   - **File:** path/to/file.ts:line
   - **Problem:** Specific problem description
   - **Impact:** Why this matters
   - **Fix:** Suggested fix

## Summary

- **Total findings:** N
- **Critical:** X
- **Important:** Y
- **Minor:** Z
- **Recommendation:** [action]
```

## Step B: Decision Point

After the reviewer writes the findings document, the orchestrator reads it and counts findings.

**Finding categorization rules:**

- **MUST-FIX (Critical):** Security vulnerabilities, crashes, data loss, ADR violations, hook violations, missing critical tests
- **MUST-FIX (Important):** Performance issues, incomplete implementation, architectural concerns, significant test gaps
- **NICE-TO-HAVE (Minor):** Code style, naming conventions, documentation, minor refactoring

**Decision matrix:**

| MUST-FIX Count | Round | Action                                        |
| -------------- | ----- | --------------------------------------------- |
| 0              | any   | Review clean! Exit loop → proceed to Step 2.6 |
| > 0            | < 3   | Continue to Step C (spawn fixer)              |
| > 0            | == 3  | Max rounds exceeded! Escalate to human        |

**Max rounds exceeded escalation:**

```
⚠️ Story X.Y Review Blocked

After 3 review rounds, issues remain:
- Critical: 1
- Important: 2
- Minor: 1

Findings document: docs/progress/story-X-Y-review-findings-round-3.md

Options:
a) Manual review and fix (pause autonomous workflow)
b) Accept findings and mark story complete (not recommended)
c) Continue with 1 more review round (override limit)

Your choice:
```

- **(a)** Mark story as `blocked`, save state, user fixes manually
- **(b)** Mark story as `done` despite findings (user accepts risk)
- **(c)** Increment max rounds by 1, loop back to Step A

## Step C: Spawn Fixer Subagent

Use Task tool to spawn the `epic-fixer` subagent with implementation context:

```
Task tool invocation:
  subagent_type: "epic-fixer"
  prompt: |
    Fix code review findings for Story {story.id}: {story.title}
    Branch: {branchName}
    Findings: docs/progress/story-{story.id}-review-findings-round-{round}.md
    Round: {round}

    Read the findings document. Address all Critical and Important issues.
    Fix Minor issues if time permits.
    Run tests after each fix. Commit fixes with message:
      fix: address code review round {round} - [brief description]
    Maintain 80%+ test coverage.
```

**Fixer rules:**

- Fix ALL Critical and Important findings
- Fix Minor findings if time permits
- Run tests after each fix (must pass)
- Follow hook enforcement (tdd-guard, architecture-guard, etc.)
- Commit after each logical group of fixes
- Report which findings were addressed and any that could not be fixed

## Step D: Loop Back

1. Increment round counter
2. If round <= 3 (or overridden limit), spawn new reviewer (Step A) with fresh context
3. Repeat until MUST-FIX count == 0 or round exceeds limit

**Key:** Each reviewer round gets a FRESH context. The reviewer never sees previous review rounds or fixer actions. It only sees the current state of the code.

## Dry Run Behavior

In `--dry-run` mode, skip actual subagent spawning:

```
[DRY-RUN] Would spawn epic-reviewer for Story {story.id} round {round}
[DRY-RUN] Would spawn epic-fixer for Story {story.id} round {round}
```

No review findings document is created. Story proceeds directly to finalization.
