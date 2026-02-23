# Dedup Scan Loop

Supporting reference for the epic orchestrator. Read this file when entering Step 2.3b (Dedup Scan Loop).

## Protocol Overview

Execute up to 2 dedup scan-fix cycles to eliminate cross-handler code duplication before the adversarial review. The orchestrator coordinates between a **scanner subagent** (fresh context, read-only, reads ALL domain handlers) and a **fixer subagent** (implementation context, full edit tools, extracts to shared packages).

**Max rounds:** 2 (scan rounds, meaning up to 1 fix cycle + 1 final scan)
**Clean state:** 0 MUST-FIX findings (Critical + Important)
**Exit conditions:** Clean state reached OR max rounds exceeded

**Round progression:** Round 1 scan → fix → Round 2 scan → escalate if still unclean. This gives 1 fix attempt before escalation.

## Applicability — Skip Rule

Before entering the scan loop, check whether it applies to the current story:

1. Extract handler directory paths from `story.touches` (e.g., `backend/functions/saves-update/handler.ts`)
2. **If NO paths under `backend/functions/` exist in `touches`, skip the dedup scan loop entirely.** Proceed directly to Step 2.4 (Code Review Loop). Stories that only touch shared packages, infrastructure, scripts, or documentation have no handler domain to scan.
3. Log: `[DEDUP] Skipped — story does not touch handler files`

## Domain Pattern Derivation

When the story does touch handler files, derive the domain pattern:

1. Extract handler directory paths from `touches` (e.g., `backend/functions/saves-update/handler.ts` → `backend/functions/saves-update`)
2. Find common prefix by stripping handler-specific suffixes (e.g., `-update`, `-delete`, `-get`, `-list`, `-restore`): `backend/functions/saves`
3. Build glob pattern: `backend/functions/saves*/handler.ts`
4. **Single primary domain:** If `touches` includes handlers from multiple disjoint domains (e.g., both `saves*` and `auth*`), use the domain with the most touched files as the primary. Do not scan across unrelated handler domains.
5. Also pass shared packages pattern: `backend/shared/*/src/**/*.ts`

For non-saves domains in future epics, the same logic applies: `backend/functions/auth*/handler.ts`, `backend/functions/projects*/handler.ts`, etc.

## Findings Output Path

Dedup scan findings use a distinct path from reviewer findings to avoid confusion:

- **Dedup findings:** `.claude/dedup-findings-{story.id}-round-{round}.md`
- **Review findings:** `docs/progress/story-{story.id}-review-findings-round-{round}.md`

## Step A: Spawn Scanner Subagent

Use Task tool to spawn the `epic-dedup-scanner` subagent with a fresh context window:

```
Task tool invocation:
  subagent_type: "epic-dedup-scanner"
  prompt: |
    Scan for cross-handler duplication in Story {story.id}: {story.title}
    Domain pattern: {domainPattern}
    Branch: {branchName}
    Base branch: {baseBranch}
    Story file: {storyFilePath}
    Round: {round}
    Output path: .claude/dedup-findings-{story.id}-round-{round}.md

    Read ALL handler files matching the domain pattern (not just the branch diff).
    Read shared package exports to know what is already centralized.
    Scan for: duplicate schemas, duplicate constants, duplicate helpers,
    local definitions that duplicate shared exports.
    Write your findings to the Output path above.
    Use the structured findings format with Critical/Important/Minor categories.
```

**CRITICAL:** The scanner has NO implementation context — it reads only the current state of all handler files in the domain. This ensures unbiased detection of duplication patterns.

**Output:** The scanner writes findings to `.claude/dedup-findings-{story.id}-round-{round}.md`

## Step B: Decision Point

After the scanner writes the findings document, the orchestrator reads it and counts findings.

**Finding categorization rules:**

- **MUST-FIX (Critical):** Semantic divergence — a local copy of a shared export that behaves differently, hiding a bug behind duplication
- **MUST-FIX (Important):** Identical code in 2+ handlers that should be in a shared package; local definition that already exists as a shared export
- **NICE-TO-HAVE (Minor):** Similar patterns, style inconsistencies, potential abstractions

**Decision matrix:**

| MUST-FIX Count | Round | Action                                                         |
| -------------- | ----- | -------------------------------------------------------------- |
| 0              | any   | Scan clean! Exit loop → proceed to Step 2.4 (Code Review Loop) |
| > 0            | < 2   | Continue to Step C (spawn fixer)                               |
| > 0            | == 2  | Max rounds exceeded! Escalate to human                         |

**Max rounds exceeded escalation:**

```
⚠️ Story X.Y Dedup Scan Blocked

After 2 scan rounds, duplication issues remain:
- Critical: {count}
- Important: {count}
- Minor: {count}

Findings document: .claude/dedup-findings-{story.id}-round-2.md

Options:
a) Fix manually (pause autonomous workflow)
b) Accept findings and proceed to adversarial review (not recommended)
c) Allow one additional dedup round (override limit)

Your choice:
```

- **(a)** Mark story as `blocked`, save state, user fixes manually
- **(b)** Proceed to Step 2.4 (Code Review Loop) despite remaining findings (user accepts risk). The reviewer may independently flag some of the same issues.
- **(c)** Increment max rounds by 1, loop back to Step A. **Hard cap: 3 total dedup rounds.** After 3 rounds, option (c) is no longer available — the user must choose (a) or (b).

## Step C: Spawn Fixer Subagent

Use Task tool to spawn the `epic-dedup-fixer` subagent with implementation context:

```
Task tool invocation:
  subagent_type: "epic-dedup-fixer"
  prompt: |
    Fix dedup scan findings for Story {story.id}: {story.title}
    Domain pattern: {domainPattern}
    Branch: {branchName}
    Base branch: {baseBranch}
    Story file: {storyFilePath}
    Findings: .claude/dedup-findings-{story.id}-round-{round}.md
    Round: {round}

    Read the findings document. Address all Critical and Important issues.
    Extract duplicated code to the appropriate shared package.
    Update all handler imports.
    Run tests after each extraction. Stage changes with `git add -A` before committing.
    Commit fixes with message:
      fix: address dedup scan round {round} - [brief description]
    Maintain 80%+ test coverage.
    Do NOT push. Do NOT switch branches. Commit only on the current branch.
```

**Fixer rules:**

- Fix ALL Critical and Important findings
- Fix Minor findings if time permits
- Run tests after each fix (must pass)
- Follow hook enforcement (architecture-guard, import-guard, etc.)
- Commit after each logical group of fixes
- Report which findings were addressed and any that could not be fixed

## Step D: Loop Back

1. Increment round counter
2. If round <= 2 (or overridden limit), spawn new scanner (Step A) with fresh context
3. Repeat until MUST-FIX count == 0 or round exceeds limit

**Key:** Each scanner round gets a FRESH context. The scanner never sees previous scan rounds or fixer actions. It only sees the current state of the handler files.

**Branch locality:** The fixer commits locally but does NOT push during the dedup loop. The scanner reads handler files directly from the working tree, so fixer commits are visible immediately. No push is needed until the review loop exits cleanly (push happens in Phase 2.5 Commit & PR).

## Dry Run Behavior

In `--dry-run` mode, skip actual subagent spawning:

```
[DRY-RUN] Would spawn epic-dedup-scanner for Story {story.id} round {round}
[DRY-RUN] Would spawn epic-dedup-fixer for Story {story.id} round {round}
```

No dedup findings document is created. Story proceeds directly to Step 2.4 (Code Review Loop).
