# How Auto Epic Command Works: Agent Flow and System Architecture

## Overview

You run Auto Epic to autonomously implement entire epics with code review loops and human checkpoints.

Auto Epic (`/bmad-bmm-auto-epic`) runs as a long-lived Claude Code session that implements all stories in an epic in dependency order. For each story, it creates a git branch, writes code via the `/bmad-bmm-dev-story` skill, runs lint/build/test gates, performs multi-agent code review with fresh-context adversarial reviewers, commits locally, and opens a pull request. Human checkpoints appear at four strategic points: scope confirmation before implementation begins, per-story completion decisions, integration validation for stories with dependents, and epic completion review (`.claude/skills/epic-orchestrator/SKILL.md:12-24`).

Key benefits include autonomous supervised execution, quality convergence through adversarial review (fresh-context reviewer finds issues the implementer missed), dependency-aware execution (topological sort ensures prerequisites complete first), resumability, and safety by design.

Use Auto Epic for implementing entire epics (5-15 stories) with defined dependencies. Use `/bmad-bmm-dev-story` for single stories. Use `/bmad-bmm-code-review` for one-shot reviews without epic orchestration.

## Architecture Layers

You understand Auto Epic through four architectural layers: command entry point, orchestrator skill, hook system, and subagents.

### Layer 1: Command entry point

The command file at `.claude/commands/bmad-bmm-auto-epic.md` (~55 lines) parses arguments (`Epic-1`, `--stories=1.1,1.2`, `--resume`, `--dry-run`) and delegates to the orchestrator skill. This thin layer handles only argument validation and skill invocation, not business logic.

### Layer 2: Orchestrator skill

The orchestrator at `.claude/skills/epic-orchestrator` consists of six modules loaded on-demand to prevent context bloat. Each module is under 200 lines and loaded when entering specific phases:

- `SKILL.md`: Core workflow definition (Phases 1-3), always loaded
- `dependency-analysis.md`: Topological sort algorithm, loaded at Phase 1.3
- `state-file.md`: State persistence and resume logic, loaded at Phase 1.6
- `story-runner.md`: GitHub CLI vs. dry-run adapter selection, loaded at Phase 1.5
- `review-loop.md`: Multi-round code review protocol, loaded at Phase 2.4
- `integration-checkpoint.md`: Dependent validation, loaded at Phase 2.7

This modular decomposition keeps each agent invocation under context limits while providing deep protocol documentation when needed.

### Layer 3: Hook system and safety enforcement

Eight hooks intercept tool calls at three lifecycle points: PreToolUse (blocks before action), PostToolUse (auto-corrects after action), and Stop (validates quality gates at completion) (`.claude/hooks/README.md:8-20`).

#### PreToolUse hooks (gate enforcement)

- `bash-guard.js`: Implements tiered safety (critical/high/strict via `CLAUDE_SAFETY_LEVEL` env var). Critical level blocks catastrophic commands (rm -rf /, fork bombs, mkfs). High level blocks destructive git operations and credential exposure. Strict level blocks any force push. Escalates 6 high-risk patterns for human approval: git push main, npm publish, cdk deploy, aws delete, rm -rf, terraform destroy (`.claude/hooks/bash-guard.js:16-285`).
- `file-guard.js`: Validates file paths and permissions before Write/Edit operations.
- `tdd-guard.js`: Enforces test-first development by blocking implementation file writes unless failing tests exist in test.json. Test file writes always allowed.
- `architecture-guard.sh`: Enforces ADR-007 (no Lambda-to-Lambda calls), ADR-006 (DynamoDB key patterns), ADR-014 (handlers use @ai-learning-hub/db).
- `import-guard.sh`: Denies Lambda/backend files using DynamoDB/Logger/Zod/middleware without @ai-learning-hub/\* shared library imports.

#### PostToolUse hooks (auto-correction)

- `auto-format.sh`: Runs Prettier + ESLint auto-fix asynchronously after file changes.
- `type-check.sh`: Runs tsc --noEmit and reports TypeScript errors without blocking.

#### Stop hook (quality validation)

Validates quality gates when agent attempts completion: runs npm test, npm run lint, npm run build. If any gate fails, blocks agent completion and requires fixes.

Hooks block invalid operations and return error messages that explain violations and suggest correct approaches. The agent reads the error and adjusts. Repeated violations (more than 3 times) escalate to human intervention.

### Layer 4: Subagents

Two specialized agents spawn via Task tool with fresh contexts:

- `epic-reviewer` (`.claude/agents/epic-reviewer.md`): Read-only analysis, tools: Read/Glob/Grep/Bash/Write. Disallowed: Edit (prevents code modification), Task (prevents agent chains).
- `epic-fixer` (`.claude/agents/epic-fixer.md`): Full edit capabilities, tools: Read/Glob/Grep/Bash/Write/Edit. Disallowed: Task (prevents unbounded sub-subagents).

Tool restrictions enforce the separation: reviewers cannot modify code they critique; fixers cannot spawn additional agents that would create unbounded chains.

## Command Flow and Phases

You trace execution through three phases: Planning & Scope (Phase 1), Story Implementation Loop (Phase 2), and Completion & Reporting (Phase 3).

### Phase 1: Planning & Scope

Six steps prepare the workflow:

1. **Load epic file (1.1):** Read epic file from `_bmad-output/planning-artifacts/epics/epic-{id}.md` containing title, description, story references.
2. **Load story files (1.2):** Read story files from `_bmad-output/implementation-artifacts/stories/{story_id}.md` with YAML frontmatter (id, title, depends_on, touches, risk).
3. **Dependency analysis (1.3):** Parse YAML frontmatter, build adjacency list, apply topological sort to determine execution order. Cycle detection terminates with a fatal error (`.claude/skills/epic-orchestrator/dependency-analysis.md:32-131`).
4. **Scope confirmation checkpoint (1.4):** Human chooses: implement all stories, select specific stories (with dependency validation), or cancel.
5. **Initialize StoryRunner (1.5):** Select DryRunStoryRunner for `--dry-run` flag (deterministic mocks) or GitHubCLIRunner for real repos with `.github/` directory (`.claude/skills/epic-orchestrator/story-runner.md:70-84`).
6. **Create or resume state file (1.6):** State file at `docs/progress/epic-{id}-auto-run.md` uses YAML frontmatter (primary source of truth) with regenerated markdown table (human display). Resume reconciles with GitHub (see State Management section).

**Warning:** Cycle detection terminates the workflow with a fatal error. Ensure story dependencies form a directed acyclic graph before running Auto Epic.

### Phase 2: Story Implementation Loop

Seven substeps per story in topological order:

1. **Pre-implementation dependency check (2.1):** Stories with dependents require PR merged OR commit reachable from base via `git merge-base --is-ancestor ${commitSha} origin/${baseBranch}`. Leaf stories only need open PR with passing tests. Rationale: downstream stories need code on base branch to build correctly. Override flag `--no-require-merged` disables strict checking for all stories.
2. **Hook-protected implementation (2.2):** Run `/bmad-bmm-dev-story` skill. All tool calls intercepted by hooks. Run three quality gates: lint, build, test with 80% coverage. Coverage parsed from Jest "All files" summary line. Secrets scan checks for AWS credentials, API keys, private keys, resource IDs, connection strings before review (`.claude/skills/epic-orchestrator/SKILL.md:160-199`).
3. **Mark for review (2.3):** Update state file status to "review".
4. **Code review loop (2.4):** Multi-round review with up to 3 rounds (hard cap 5 with user override). Each round: spawn fresh-context reviewer → reviewer writes findings → count MUST-FIX (Critical + Important) → if MUST-FIX > 0 spawn fixer → fixer commits locally → increment round. Exit when MUST-FIX = 0 or max rounds reached. Fresh-context isolation ensures genuinely adversarial review. Each new review round spawns a fresh reviewer that sees current code state only, not previous rounds or fixer actions (see Subagent Orchestration section).
5. **Commit & PR creation (2.5):** Pre-stage validation for sensitive extensions (.env, .pem, .key). Stage all changes, commit with issue reference, record HEAD SHA, push branch (standard push, never force), create PR idempotently.
6. **Finalize story (2.6):** Merge main into feature branch, re-run tests, update PR description with review summary, mark story done. Human checkpoint: continue/stop/pause/skip.
7. **Integration checkpoint (2.7):** For stories with dependents, validate shared file overlaps and type changes, re-run full test suite. Results classified as Green (auto-continue), Yellow (warnings, ask user), or Red (failures, halt) (`.claude/skills/epic-orchestrator/integration-checkpoint.md:11-156`).

### Phase 3: Completion & Reporting

Four final steps:

1. **Generate completion report:** Story summary table and metrics (average story time, test pass rate, review convergence, common issue categories).
2. **Update epic file:** Add timestamps and PR links.
3. **Update state file:** Mark done/paused status.
4. **Notify user:** Provide all PR links for review.

## Subagent Orchestration

You spawn two subagent types during the review loop: epic-reviewer (fresh context, read-only) and epic-fixer (implementation context, full edit).

### Reviewer Spawning and Protocol

Context parameters passed to epic-reviewer: story ID, branch name, base branch, story file path, review round number, output path for findings document (`.claude/skills/epic-orchestrator/review-loop.md:16-34`).

The reviewer executes three steps:

1. Diff branch against base: `git diff origin/{base}...{branch}`
2. Read story file for acceptance criteria
3. Write structured findings document with Critical/Important/Minor categories to specified output path

Fresh context isolation ensures adversarial review. The reviewer has NO knowledge of implementation decisions or previous review rounds (`.claude/skills/epic-orchestrator/review-loop.md:32-36`).

### Fixer Spawning and Protocol

The orchestrator spawns epic-fixer via Task tool with context: findings document path, story file path, branch name, round number (`.claude/skills/epic-orchestrator/review-loop.md:125-145`).

The fixer executes five steps:

1. Read findings document
2. Address Critical findings first, then Important, then Minor if time permits
3. Run `npm test` after each fix group
4. Stage and commit with descriptive messages: `fix: address code review round {N} - {description}`
5. Validate no secrets introduced before each commit

The fixer commits locally during the review loop. No push until loop exits cleanly with 0 MUST-FIX findings (`.claude/skills/epic-orchestrator/review-loop.md:153-165`).

### File-Based Communication

Agents communicate via filesystem, not shared memory. The reviewer writes findings to disk. The fixer reads from disk. The orchestrator counts MUST-FIX findings by parsing the file. This keeps agents decoupled and allows independent spawning without context leakage.

## State Management and Resume

You persist state in a YAML frontmatter file that serves as the primary source of truth for orchestration decisions.

### State File Format

Location: `docs/progress/epic-{id}-auto-run.md`

Structure: YAML frontmatter (machine-readable source of truth) + regenerated markdown table (human-readable display). Seven story statuses: pending, in-progress, review, done, blocked, paused, skipped.

Status transitions use `updateStoryStatus()` which updates the state file then syncs to GitHub issue labels. Conflicts favor the state file.

### Write Protocol

Best-effort atomicity: write to `.tmp` file using Write tool, rename to final path using Bash `mv` command. If interrupted, `.tmp` serves as recovery source (`.claude/skills/epic-orchestrator/state-file.md:162-168`).

### Resume Reconciliation

Resume (`--resume` flag) reconciles state file with GitHub using a 7-case decision matrix:

| State File Status | GitHub State   | Action                      |
| ----------------- | -------------- | --------------------------- |
| done              | PR merged      | Skip (already complete)     |
| done              | PR closed      | Keep done (state file wins) |
| in-progress       | PR exists      | Resume from finalization    |
| in-progress       | Branch deleted | Mark blocked (no recovery)  |
| in-progress       | No PR/branch   | Reset to pending            |
| pending           | PR exists      | Treat as review (manual PR) |
| pending           | Branch exists  | Check out branch, resume    |

The matrix handles interrupted sessions, manual GitHub actions, and state corruption gracefully (`.claude/skills/epic-orchestrator/state-file.md:118-136`).

### Commit SHA Tracking

Record HEAD SHA after each story using `git rev-parse HEAD`. Store in `stateFile.stories[story.id].commit`. Use for dependency verification and review scope (`.claude/skills/epic-orchestrator/state-file.md:172-183`).

### Scope Tracking

The `scope` field records original `--stories` selection. Resume restores this scope to prevent scope drift where resume unexpectedly expands to unselected stories.

## Quick Reference

### Command Syntax

```bash
# All stories
/bmad-bmm-auto-epic Epic-1

# Specific stories with dependency validation
/bmad-bmm-auto-epic Epic-1 --stories=1.1,1.2,1.5

# Resume previous run
/bmad-bmm-auto-epic Epic-1 --resume

# Simulate without GitHub
/bmad-bmm-auto-epic Epic-1 --dry-run

# Custom epic file location
/bmad-bmm-auto-epic Epic-1 --epic-path=path/to/epic.md

# Relaxed dependency checking
/bmad-bmm-auto-epic Epic-1 --no-require-merged
```

### Key File Paths

| Component       | Path                                        |
| --------------- | ------------------------------------------- |
| Command         | `.claude/commands/bmad-bmm-auto-epic.md`    |
| Orchestrator    | `.claude/skills/epic-orchestrator/SKILL.md` |
| Reviewer agent  | `.claude/agents/epic-reviewer.md`           |
| Fixer agent     | `.claude/agents/epic-fixer.md`              |
| Hooks directory | `.claude/hooks/`                            |
| State files     | `docs/progress/epic-{id}-auto-run.md`       |

### Flags

| Flag                  | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `--stories`           | Subset selection with dependency validation   |
| `--resume`            | State file reconciliation with GitHub         |
| `--dry-run`           | Simulation mode (DryRunStoryRunner)           |
| `--epic-path`         | Custom epic file location override            |
| `--no-require-merged` | Relaxed dependency checking (state file wins) |

<!-- Word count: 2,044 words | Target: 2,400 words | Δ: -356 (-15%) -->
