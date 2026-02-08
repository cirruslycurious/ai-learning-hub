# Safety Architecture: Three-Layer Defense Model

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Active in Epic 1 stories (1.1–1.9 complete, expanding to remaining stories)

## Overview

This project implements a **three-layer safety model** that protects against unintended actions, enforces quality standards, and provides strategic human decision points. This architecture provides defense-in-depth beyond typical single-layer guardrails by combining deterministic enforcement (hooks), workflow-level guarantees (orchestrator), and human-in-the-loop validation.

## The Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Human Checkpoints                                  │
│ Strategic approval gates at workflow milestones             │
│ • Epic scope confirmation                                   │
│ • Per-story approval                                        │
│ • Integration validation                                    │
│ • Completion review                                         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Escalates when needed
                              │
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Orchestrator Safety Invariants                     │
│ Workflow-level guarantees during autonomous execution       │
│ • 9 safety invariants (never auto-merge, never bypass, etc) │
│ • Multi-agent code review loops (up to 3 rounds)            │
│ • Integration checkpoints (file overlap, type changes)      │
│ • Secrets scan gates                                        │
│ • Error recovery with auto-fix + escalation                 │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Coordinates enforcement
                              │
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Hooks & Rules                                      │
│ Tool-call level enforcement (deterministic blocking)        │
│ • 6 Claude Code hooks (PreToolUse, PostToolUse, Stop)       │
│ • 11 Cursor rules (mirroring hooks for IDE)                 │
│ • Blocks dangerous commands (bash-guard)                    │
│ • Protects critical files (file-guard)                      │
│ • Enforces architecture (architecture-guard, import-guard)  │
│ • Enforces TDD (tdd-guard)                                  │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: Hooks & Rules (Tool-Call Enforcement)

**Purpose:** Deterministic blocking at the tool-call level. Prevents dangerous operations before they execute.

**Implementation:**

- **Claude Code hooks:** `.claude/hooks/` (6 scripts) + `.claude/settings.json`
- **Cursor rules:** `.cursor/rules/*.mdc` (11 files)

**Enforcement Points:**

- **PreToolUse:** bash-guard, file-guard, tdd-guard, architecture-guard, import-guard
- **PostToolUse:** auto-format, type-check
- **Stop:** test-validator (agent-based quality gate)

**Key Behaviors:**

- Blocks catastrophic commands (`rm -rf /`, fork bombs, `mkfs`)
- Blocks credential exposure (`cat .env`, echoing secrets)
- Blocks force push to main/master
- Protects human-owned files (`CLAUDE.md`, `.env*`, lockfiles)
- Enforces ADR compliance (no Lambda-to-Lambda calls, DynamoDB patterns)
- Enforces shared library usage (`@ai-learning-hub/*`)
- Enforces TDD (blocks implementation before tests)
- Auto-formats code after edits
- Validates TypeScript compilation
- Blocks task completion if tests fail

**Documentation:** [Hook System Details](./hook-system.md)

## Layer 2: Orchestrator Safety Invariants (Workflow Guarantees)

**Purpose:** Workflow-level safety during autonomous epic implementation. Coordinates enforcement across multiple stories, ensures quality convergence, validates integration points.

**Implementation:**

- **Epic orchestrator:** `.claude/skills/epic-orchestrator/SKILL.md`
- **Review loop protocol:** `.claude/skills/epic-orchestrator/review-loop.md`
- **Integration checkpoint:** `.claude/skills/epic-orchestrator/integration-checkpoint.md`
- **Subagents:** `.claude/agents/epic-reviewer.md`, `.claude/agents/epic-fixer.md`

**9 Safety Invariants:**

1. Never auto-merge PRs (all PRs remain open for human review)
2. Never bypass hooks (all commits go through hook validation)
3. Never force push (all pushes use standard `git push`)
4. Never push to base branch (all work on feature branches)
5. Never skip tests (all stories must pass tests before complete)
6. Never silently ignore failures (auto-fix max 2 attempts → escalate)
7. Idempotent operations (all GitHub ops reuse existing resources)
8. State persistence (progress saved continuously, --resume supported)
9. Human checkpoints (4 phases with explicit approval gates)

**Multi-Agent Code Review Loops:**

- Up to **3 review rounds** (2 fix attempts + 1 final review)
- **Fresh-context reviewers** (spawned via Task tool, no implementation bias)
- **Structured findings** (Critical / Important / Minor)
- **Auto-fix with epic-fixer** subagent (reads findings, fixes issues, commits)
- **Human escalation** at round 3 if issues remain
- **Hard cap:** 5 total rounds to prevent unbounded loops

**Integration Checkpoints:**

- Runs after completing stories with dependents
- **Shared file changes:** Git diff vs dependent stories' `touches` field
- **Interface/type changes:** TypeScript export diff analysis
- **Acceptance criteria:** Re-run full test suite
- **Result classification:** Green (continue) / Yellow (warn) / Red (escalate)

**Secrets Scan Gates:**

- Runs before marking story for review
- Detects AWS account IDs, access keys, resource IDs, private keys, API keys, connection strings
- **Pre-stage validation:** Blocks commit of `.env`, `.pem`, `.key`, etc.

**Error Recovery:**

- Test failures: Auto-fix (max 2 attempts) → escalate
- Hook violations: Self-correcting (agent reads error) → escalate after >3 violations
- Merge conflicts: Auto-resolve simple cases → escalate complex
- PR creation failures: Show manual fallback → mark blocked → ask continue/pause
- Dependency not met: Show options → ask skip/pause/override

**Documentation:** [Orchestrator Safety Details](./orchestrator-safety.md)

## Layer 3: Human Checkpoints (Strategic Approval Gates)

**Purpose:** Strategic human decision points at workflow milestones. User retains control over scope, story completion, integration risk, and final delivery.

**4 Human Checkpoints:**

### 1. Phase 1.4: Scope Confirmation

**When:** After loading epic, parsing stories, building dependency graph
**What User Sees:**

- Epic ID and title
- Story list with IDs, titles, dependencies
- Execution order (topological sort)
- Integration checkpoint markers

**User Decision:**

- (a) Implement all stories in order
- (b) Select specific stories (with dependency validation)
- (c) Cancel execution

### 2. Phase 2.6: Per-Story Completion

**When:** After story implementation, code review, commit, PR creation
**What User Sees:**

- PR number and URL
- Test results and coverage percentage
- Review rounds completed
- Findings fixed (Critical / Important / Minor counts)
- Progress (N/M stories complete)

**User Decision:**

- `y` → Continue to next story
- `n` → Stop execution, save progress
- `pause` → Pause epic (resume later with --resume)
- `skip` → Skip next story (with dependency validation)

### 3. Phase 2.7: Integration Checkpoint

**When:** After completing a story with dependents (before user approval)
**What User Sees:**

- Dependent stories list
- Shared file changes (actual vs expected)
- Interface/type changes detected
- Test results (pass/fail)
- Result classification (Green/Yellow/Red)

**User Decision:**

- `y` → Continue to next story
- `n` → Stop execution
- `pause` → Pause for manual investigation
- `review-X.Y` → Show detailed diff for dependent story X.Y

### 4. Phase 3: Completion & Reporting

**When:** After all stories complete (or user stops early)
**What User Sees:**

- Epic completion report (story summary, metrics, blockers, next steps)
- List of all PRs for review
- Blockers highlighted
- Duration and statistics

**User Decision:**

- Review PRs and merge (human controls final integration)
- Investigate blocked stories
- Update sprint status

**Documentation:** [Orchestrator Safety Details](./orchestrator-safety.md#human-checkpoints)

## How The Layers Interact

### Example: Attempting a Risky Operation

**Scenario:** Agent tries to force push to main branch during story implementation.

**Layer 1 (Hooks) Response:**

```
❌ bash-guard.js BLOCKED
Command: git push --force origin main
Reason: Force push to main/master is prohibited
Safe alternative: Use 'git push' or create feature branch
```

→ Command never executes. Agent receives error and learns the correct pattern.

**Layer 2 (Orchestrator) Backup:**

- Orchestrator invariant #3: "Never force push"
- Orchestrator invariant #4: "Never push to base branch"
- Even if hook somehow failed, orchestrator would not call this operation

**Layer 3 (Human) Final Safety:**

- All PRs remain open for human review (invariant #1)
- Human can inspect git history before merging
- Destructive changes are visible and reversible

### Example: Code Quality Convergence

**Scenario:** Agent implements a story with security vulnerabilities.

**Layer 1 (Hooks) Response:**

- PreToolUse hooks validate architecture, imports, TDD
- PostToolUse hooks auto-format and type-check
- Stop hook ensures tests pass
  → Basic quality enforced, but won't catch all issues

**Layer 2 (Orchestrator) Response:**

- Spawns **epic-reviewer** subagent (fresh context, adversarial)
- Reviewer finds: 1 Critical (SQL injection), 2 Important (missing tests)
- Spawns **epic-fixer** subagent (reads findings, fixes issues)
- Re-runs review round 2: All Critical fixed, 1 Important remains
- Spawns fixer again: Fixes remaining issue
- Re-runs review round 3: Clean (0 MUST-FIX findings)
  → Quality convergence achieved through multi-round review

**Layer 3 (Human) Final Check:**

- User sees PR with review summary (3 rounds, 3 findings fixed)
- User can review code before merging
- Review findings documents preserved for audit trail

### Example: Integration Risk Detection

**Scenario:** Story 1.2 modifies a shared type used by Stories 1.3 and 1.4.

**Layer 1 (Hooks) Response:**

- No hook violation (valid TypeScript change)
  → Hooks don't know about cross-story dependencies

**Layer 2 (Orchestrator) Response:**

- Story 1.2 completes, orchestrator sees `story.hasDependents === true`
- Runs integration checkpoint:
  - Git diff shows changes to `shared/types/Project.ts`
  - Dependent stories 1.3 and 1.4 both `touches: ["shared/types"]`
  - TypeScript export diff detects `ProjectStatus` enum changed
  - Test suite re-run passes (no regressions)
- Result: **Yellow (warnings)**
  - "Story 1.3: Type changes detected in shared files: ProjectStatus"
  - "Story 1.4: Type changes detected in shared files: ProjectStatus"

**Layer 3 (Human) Decision:**

```
⚠️ Integration Checkpoint: Story 1.2 has 2 dependent stories

Validation Results:
⚠️ Story 1.3: Shared type 'ProjectStatus' was modified
⚠️ Story 1.4: Shared type 'ProjectStatus' was modified
✅ Tests pass

Continue to Story 1.3? (y/n/pause/review-1.3)
```

→ User decides whether to continue or review dependent stories first

## Design Principles

### 1. Defense in Depth

Multiple layers provide redundancy. If one layer fails, others catch the issue.

### 2. Fail-Safe Defaults

System blocks by default, allows by exception. Safer operations proceed automatically; risky operations require explicit approval.

### 3. Deterministic Enforcement

Hooks provide deterministic blocking (not probabilistic). Same operation → same outcome every time.

### 4. Self-Correcting Agents

Hooks teach correct patterns via error messages. Agents read errors, adjust approach, retry. No user intervention needed for most violations.

### 5. Fresh Context for Adversarial Review

Code reviewers spawned with fresh context (no implementation bias). Ensures genuinely independent review.

### 6. Progressive Escalation

System tries to auto-fix (max 2 attempts) before escalating to human. Reduces toil while maintaining safety.

### 7. Human-in-the-Loop at Strategic Points

Humans decide: scope (what to build), integration risk (how to proceed), final delivery (when to merge). System handles tactical execution.

### 8. Auditability

All safety events logged: hook blocks, orchestrator decisions, review findings, human approvals. Full audit trail.

### 9. Reversibility

All operations designed for reversibility: PRs not merged, commits not force-pushed, branches preserved. Mistakes are cheap to undo.

## Risk Classification

Operations are classified by **reversibility** and **blast radius**:

**Low Risk (proceed automatically):**

- Reading files, git status, git diff, running tests
- Creating feature branches
- Making commits (reversible via git reset)

**Medium Risk (proceed with logging):**

- Running quality gates (lint, build, coverage)
- Auto-formatting code
- Type-checking

**High Risk (require approval or block):**

- Deploys (cdk deploy, terraform apply)
- Publishing (npm publish)
- Destructive git operations (force push, reset --hard, clean -fd)
- Recursive deletion (rm -rf)
- Editing protected files (CLAUDE.md, .env, lockfiles, infra/)
- Secrets exposure (reading/echoing .env, credentials)

**Catastrophic (always block):**

- rm -rf / (deleting root)
- Fork bombs
- Filesystem format (mkfs)
- Direct disk writes (dd of=/dev/sd\*)

**Detailed risk matrix:** [Tool Risk Classification](./tool-risk.md)

## Enforcement Locations

| Safety Mechanism        | Location                                                                       | Enforces              |
| ----------------------- | ------------------------------------------------------------------------------ | --------------------- |
| bash-guard              | `.claude/hooks/bash-guard.js` + `.cursor/rules/bash-guard.mdc`                 | Command safety        |
| file-guard              | `.claude/hooks/file-guard.js` + `.cursor/rules/file-guard.mdc`                 | Protected paths       |
| tdd-guard               | `.claude/hooks/tdd-guard.js` + `.cursor/rules/tdd-guard.mdc`                   | TDD workflow          |
| architecture-guard      | `.claude/hooks/architecture-guard.sh` + `.cursor/rules/architecture-guard.mdc` | ADR compliance        |
| import-guard            | `.claude/hooks/import-guard.sh` + `.cursor/rules/import-guard.mdc`             | Shared lib usage      |
| auto-format             | `.claude/hooks/auto-format.sh`                                                 | Code formatting       |
| type-check              | `.claude/hooks/type-check.sh`                                                  | TypeScript validation |
| test-validator          | `.claude/settings.json` (Stop hook, agent)                                     | Test coverage         |
| Orchestrator invariants | `.claude/skills/epic-orchestrator/SKILL.md`                                    | Workflow safety       |
| Review loop             | `.claude/skills/epic-orchestrator/review-loop.md`                              | Code quality          |
| Integration checkpoint  | `.claude/skills/epic-orchestrator/integration-checkpoint.md`                   | Dependency validation |
| Secrets scan            | Orchestrator Phase 2.2 (embedded)                                              | Credential safety     |
| Human checkpoints       | Orchestrator Phases 1.4, 2.6, 2.7, 3                                           | Strategic approval    |

## Coverage of Epic 1 Requirements

**FR82: Tool risk classification (low/medium/high)**
✅ Achieved via hook-level risk classification + orchestrator workflow-level risk + tool-risk.md documentation

**FR83: Human approval triggers for high-risk operations**
✅ Achieved via 4-phase human checkpoints + hook escalation points + error recovery escalation

**FR84: Explicit escalation points**
✅ Achieved via review loop escalation (round 3), error recovery escalation (max 2 auto-fix attempts), integration checkpoint escalation (Red classification)

**FR85: Documentation of where enforcement lives**
✅ Achieved via this document + hook-system.md + orchestrator-safety.md + tool-risk.md

## Comparison to Industry Standards

This system provides multiple layers of protection where typical workflows provide one:

| Practice             | Common Approach      | Our Implementation                                   |
| -------------------- | -------------------- | ---------------------------------------------------- |
| Pre-commit hooks     | Basic (format, lint) | 5 hooks (bash, file, tdd, arch, import)              |
| Code review          | Human-only           | Multi-agent adversarial (up to 3 rounds) + human     |
| Integration testing  | CI/CD only           | Integration checkpoints + CI/CD                      |
| Human approval gates | Deploy-time only     | 4 phases (scope, per-story, integration, completion) |
| Secrets scanning     | CI/CD only           | Pre-commit + pre-stage + CI/CD                       |
| Error recovery       | Fail-fast            | Auto-fix (max 2) → progressive escalation            |
| Context management   | Manual               | Fresh-context subagents + state persistence          |

## Further Reading

- [Hook System Details](./hook-system.md) — All 6 hooks + 11 rules with examples
- [Orchestrator Safety Details](./orchestrator-safety.md) — 9 invariants, review loops, checkpoints
- [Tool Risk Classification](./tool-risk.md) — Operation risk matrix with examples
- [Secrets and Config](./secrets-and-config.md) — What never goes in the repo

## Updates and Maintenance

This safety architecture is versioned and maintained:

- **Version 1.0** (2026-02-07): Initial documentation after Stories 1.1–1.9
- When hooks/orchestrator change, update this doc and increment version
- Review quarterly to ensure alignment with actual behavior

---

**Last Updated:** 2026-02-07
**Maintainer:** Stephen (human-owned)
**Status:** Active in Epic 1 (stories 1.1–1.9 complete, 1.10–1.14 remaining)
