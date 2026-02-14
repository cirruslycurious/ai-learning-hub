# Story 1.13 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-14
**Branch:** story-1-13-specialist-subagent-library-agent-system-documentation

## Critical Issues (Must Fix)

1. **Changes are not committed to the branch**
   - **File:** All deliverables (`.claude/agents/README.md`, `.claude/docs/agent-system.md`, `.claude/docs/README.md`, story file, sprint-status)
   - **Problem:** The local branch `story-1-13-specialist-subagent-library-agent-system-documentation` has zero commits beyond `origin/main`. All deliverables exist only as uncommitted changes in the working tree (new files are untracked, modified files are unstaged). Running `git diff origin/main...story-1-13-specialist-subagent-library-agent-system-documentation --stat` returns no output. Meanwhile, the remote branch `origin/story-1-13-subagent-library` contains unrelated pipeline-guard hook code (341-line `pipeline-guard.cjs`, 95-line `pipeline-read-tracker.cjs`, settings changes) that are not part of Story 1.13's scope.
   - **Impact:** The branch cannot be reviewed as a PR, cannot be merged, and the story cannot progress through the workflow. A reviewer or orchestrator checking the branch diff sees nothing. The work is at risk of being lost if the working tree is cleaned.
   - **Fix:** Stage and commit all story 1.13 deliverables to the local branch. Ensure the branch name used for the PR matches. The remote branch `origin/story-1-13-subagent-library` should either be reconciled or a new push of the correct local branch should be done.

## Important Issues (Should Fix)

1. **AC5 partially met: Missing Claude Code `/agents` command example**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/agents/README.md`
   - **Problem:** AC5 requires: "If applicable, Using Claude Code's `/agents` command for creating/using custom agents." The README does not mention or demonstrate Claude Code's built-in `/agents` command at all. The "Examples" section (lines 110-148) covers spawning reviewer/fixer and using BMAD commands, but omits the `/agents` command reference.
   - **Impact:** Developers who discover the `/agents` command in Claude Code will not find guidance on how it relates to the project's `.claude/agents/` directory, creating confusion about the intended workflow.
   - **Fix:** Add a fourth example subsection under "Examples" that either (a) shows how to use Claude Code's `/agents` command to list/invoke custom agents, or (b) explicitly states it is not applicable with a brief explanation of why (e.g., "The current subagent workflow uses `Task` tool spawning rather than the `/agents` CLI command").

2. **Inconsistency: epic-reviewer documented as "no Edit" but has Write tool**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/agents/README.md`, lines 29 and 102-106
   - **Problem:** The inventory table (line 29) says `epic-reviewer` tools are "Read, Glob, Grep, Bash, Write (no Edit)". The tool restriction guidance table (lines 102-106) lists the "Reviewer (read-only)" role as having "Read, Glob, Grep, Bash, Write" and blocking "Edit, Task". Having the Write tool makes the reviewer NOT truly read-only -- it can write findings files, but it can also write arbitrary files. This is accurate to the actual `epic-reviewer.md` frontmatter, but the documentation labeling it "read-only" in the inventory table and in the agent-system doc (line 21 of agent-system.md: "fresh context, read-only") is misleading.
   - **Impact:** A developer creating a new read-only validator subagent could follow the "Reviewer (read-only)" template and include Write tool access when they actually want a truly read-only agent. The mislabeling could lead to subagents with more permissions than intended.
   - **Fix:** Either (a) clarify in the documentation that "read-only" means "no Edit" (the reviewer can Write its output findings doc but cannot Edit existing code), or (b) add the truly read-only "Validator" row as a separate pattern (which already exists at line 106) and relabel the reviewer as "review-only" or "no-edit" to distinguish it from the fully read-only Validator pattern.

3. **Remote branch contains out-of-scope pipeline-guard changes**
   - **File:** Remote branch `origin/story-1-13-subagent-library`
   - **Problem:** The remote branch associated with this story contains 621 lines of pipeline-guard hook code (`pipeline-guard.cjs`, `pipeline-read-tracker.cjs`, `.claude/settings.json` changes, `.claude/hooks/README.md` changes, `.gitignore` changes). These are writing-pipeline enforcement hooks that have nothing to do with Story 1.13 (Specialist Subagent Library documentation). The PR checklist instructions in `CLAUDE.md` state: "Do not mix multiple issues in one PR."
   - **Impact:** If this remote branch is used for the PR, reviewers will see unrelated code changes mixed with documentation changes, violating the one-issue-per-PR convention. The pipeline-guard code would ship without proper review under its own story/issue.
   - **Fix:** Either (a) create a fresh branch from main for story 1.13 deliverables only, or (b) cherry-pick the pipeline-guard commits to a separate branch/PR and reset this branch to only contain story 1.13 work.

4. **Missing cross-reference from agent-system.md to agents/README.md role-mapping table**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/docs/agent-system.md`, lines 61-68
   - **Problem:** The "Adding to the Agent System" section at the end of `agent-system.md` tells readers to consult `.claude/agents/README.md` for the role-to-asset mapping. However, the Two Categories table (line 7-10) and the orchestrator usage section (lines 14-38) do not mention the role-to-asset mapping at all. A reader looking for "where does the Test Expert role live?" in `agent-system.md` would not find even a summary -- they would have to know to navigate to agents/README.md separately.
   - **Impact:** The progressive disclosure strategy works best when the summary doc provides enough context to know what exists. Missing even a one-line mention of the 12-role mapping reduces discoverability.
   - **Fix:** Add a one-line note near the "Two Categories" table or after the orchestrator section: "For a complete mapping of PRD roles (code-reviewer, test-expert, debugger, architect, etc.) to existing assets, see `.claude/agents/README.md#role-to-asset-mapping`."

## Minor Issues (Nice to Have)

1. **Decision tree uses plain text instead of a structured flow**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/agents/README.md`, lines 15-21
   - **Problem:** The "When to Use What" decision tree is a flat code block with arrow notation. AC1 calls for a way to "choose: spawn a subagent vs run a workflow/command vs work inline." The current format works but does not distinguish "work inline" as a clear option, and does not provide a branching decision structure (e.g., "Is fresh context needed? Yes -> subagent, No -> Is it a workflow? Yes -> command, No -> work inline").
   - **Impact:** Minor usability issue. Developers can still find the right tool, but a true branching decision tree would be more actionable for newcomers.
   - **Fix:** Consider restructuring as a numbered decision flow or mermaid flowchart. Alternatively, add "Work inline" as an explicit row: "Simple debugging, quick fixes? -> Work inline (no agent needed)".

2. **agent-system.md references "three-layer model summary" but only gives a brief overview**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/docs/agent-system.md`, lines 39-59
   - **Problem:** The "Safety Invariants for Subagents" section mentions the three-layer safety model and provides a very abbreviated list (4 hooks for Layer 1, 3 invariants for Layer 2, 1 line for Layer 3). This is appropriate for progressive disclosure, but the section title implies a "summary" while it only covers a subset. For example, Layer 1 lists 4 hooks but the actual system has 6+ hooks (plus the new pipeline-guard).
   - **Impact:** A reader may believe only 4 hooks exist. The discrepancy could cause confusion when they encounter additional hooks.
   - **Fix:** Either enumerate all hooks or add "key hooks include (not exhaustive):" before the list, with a pointer to `.claude/hooks/README.md` for the full inventory.

3. **No mention of MultiEdit tool in tool restriction guidance**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/agents/README.md`, lines 102-107
   - **Problem:** The Tool Restriction Guidance table lists Edit and Write but does not mention the MultiEdit tool, which is referenced in `.claude/settings.json` (tdd-guard triggers on `Write|Edit|MultiEdit`). If a fixer-type subagent uses MultiEdit, the restriction guidance does not cover it.
   - **Impact:** A developer creating a new subagent might allow MultiEdit inadvertently because it is not listed in the blocking guidance.
   - **Fix:** Add MultiEdit to the "Block" column for read-only agents and validators, and note it as allowed for fixers alongside Edit.

4. **Typo-level: "Further Reading" link to hook-system.md uses an inconsistent name**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/.claude/agents/README.md`, line 183
   - **Problem:** Line 183 references `.claude/docs/hook-system.md` as "Layer 1 enforcement details." While the file exists, other docs in the project refer to it differently (e.g., safety-architecture.md calls it "Hook System Details"). The reference label should be consistent to aid searchability.
   - **Impact:** Very minor. The link works and the file exists. Just a consistency nit.
   - **Fix:** Use the canonical title "Hook System Details" to match the heading in the actual file.

## Summary

- **Total findings:** 8
- **Critical:** 1
- **Important:** 4
- **Minor:** 4
- **Recommendation:** MUST FIX the critical issue (uncommitted work) before the branch can be reviewed as a PR. The important issues should be addressed for completeness and accuracy. The documentation content itself is well-structured, comprehensive, and meets the majority of the acceptance criteria (AC1-AC5). Once the work is actually committed to the branch and the out-of-scope pipeline-guard code is separated, this story is in good shape.

### Acceptance Criteria Compliance Summary

| AC  | Status        | Notes                                                                                           |
| --- | ------------- | ----------------------------------------------------------------------------------------------- |
| AC1 | Met           | README.md explains subagents, commands, decision tree, how to add, enforcement (hooks)          |
| AC2 | Met           | Inventory table lists epic-reviewer and epic-fixer with links to orchestration docs             |
| AC3 | Met           | Role-to-asset mapping table covers 12 PRD roles with asset type and usage guidance              |
| AC4 | Met           | Frontmatter conventions documented with field table; existing subagents match documented format |
| AC5 | Partially Met | Reviewer, fixer, and BMAD command examples included; missing `/agents` command example or note  |

### What Was Checked

- All three new/modified files for content accuracy and AC compliance
- Cross-references to existing files (all referenced files verified to exist: `epic-reviewer.md`, `epic-fixer.md`, `orchestrator-safety.md`, `safety-architecture.md`, `hook-system.md`, `SKILL.md`, `review-loop.md`, all BMAD commands in the mapping table)
- Frontmatter conventions vs actual subagent frontmatter (consistent)
- Branch state and commit history (critical gap found)
- Secrets scan (no hardcoded secrets, AWS IDs, API keys, or private key material found)
- Remote branch content (out-of-scope code detected)
