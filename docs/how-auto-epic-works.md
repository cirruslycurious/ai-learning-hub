# How Auto Epic Works: System Architecture and Agent Flow

> A technical guide to the `/bmad-bmm-auto-epic` workflow — its architecture, command flow, hook interactions, subagent orchestration, and operational mechanics.

---

## 1. Overview

### What Auto Epic Does

`/bmad-bmm-auto-epic` is an autonomous epic implementation workflow that takes an epic definition (a set of user stories with dependencies) and implements every story in dependency order — creating branches, writing code, running tests, performing multi-agent code reviews, and opening pull requests — with strategic human checkpoints at each major decision point.

The workflow runs as a single long-lived Claude Code session. It reads your epic file, parses story metadata (dependencies, file-touch predictions, risk levels), builds a dependency graph, topologically sorts the stories, then iterates through them one by one. For each story, it:

1. Creates a GitHub issue and feature branch
2. Invokes the `/bmad-bmm-dev-story` skill to write tests and implementation code
3. Runs a quality gate (lint, build, test with coverage)
4. Spawns a fresh-context reviewer subagent to perform adversarial code review
5. Spawns a fixer subagent to address findings, then re-reviews (up to 3 rounds)
6. Pushes the branch, opens a PR, syncs with main, and asks the human to continue

The entire process is protected by a three-layer safety architecture: deterministic hook enforcement at the tool-call level (Layer 1), workflow-level safety invariants in the orchestrator (Layer 2), and four strategic human approval gates (Layer 3).

### Key Benefits

- **Autonomous but supervised.** The workflow drives implementation forward without manual intervention for routine steps, but pauses at meaningful decision points (scope, per-story completion, integration risk, final delivery).
- **Quality convergence through adversarial review.** Each code review round uses a fresh-context reviewer with no implementation bias. Findings converge toward zero through iterative fix-review cycles.
- **Dependency-aware execution.** Topological sort ensures stories execute in valid order. Integration checkpoints validate that upstream changes don't break downstream assumptions.
- **Resumable.** State persists to a YAML-frontmatter file. The `--resume` flag reconciles saved state with GitHub reality and picks up where the workflow left off.
- **Safe by design.** Nine workflow-level invariants (never auto-merge, never bypass hooks, never force push, etc.) are enforced by the orchestrator's control flow, not by configuration that could be overridden.

### When to Use Auto Epic (vs. Other Workflows)

| Scenario                                             | Workflow                             |
| ---------------------------------------------------- | ------------------------------------ |
| Implement an entire epic (5-15 stories) autonomously | `/bmad-bmm-auto-epic`                |
| Implement a single story manually with full control  | `/bmad-bmm-dev-story`                |
| Get a one-shot code review on existing changes       | `/bmad-bmm-code-review`              |
| Start a story with branch + issue tracking           | `/project-start-story`               |
| Plan stories from a PRD before implementation        | `/bmad-bmm-create-epics-and-stories` |

Auto Epic is designed for epics with well-defined stories that have YAML frontmatter (id, title, depends_on, touches, risk). If your stories lack this metadata, the dependency analysis falls back to prose detection but emits warnings.

---

## 2. Architecture Layers

Auto Epic is built from four distinct layers: a thin command entry point, a modular orchestrator skill, a hook enforcement system, and specialized subagents. Each layer has a clear boundary and communicates through well-defined interfaces.

![System Architecture](./diagrams/auto-epic/system-architecture.excalidraw)

### Layer 1: Command Entry Point

**File:** `.claude/commands/bmad-bmm-auto-epic.md`

The command file is intentionally thin — about 55 lines. It defines the CLI interface (arguments, flags, usage examples) and delegates all logic to the orchestrator skill. Its responsibilities:

1. Parse `$ARGUMENTS` to extract `epic_id`, `--stories`, `--resume`, `--dry-run`, `--epic-path`, and `--no-require-merged`
2. Read the complete orchestrator skill file (`.claude/skills/epic-orchestrator/SKILL.md`)
3. Follow the skill's instructions exactly

The command file also documents related commands and establishes the link between the user-facing `/bmad-bmm-auto-epic Epic-1` invocation and the internal orchestration machinery.

### Layer 2: Orchestrator Skill (Modular)

**Directory:** `.claude/skills/epic-orchestrator/`

The orchestrator is decomposed into six files, loaded on-demand as each phase is reached:

| File                        | Purpose                                                                 | Loaded When          |
| --------------------------- | ----------------------------------------------------------------------- | -------------------- |
| `SKILL.md`                  | Main orchestrator — phases, invariants, error recovery                  | Always (entry point) |
| `dependency-analysis.md`    | Dependency graph, toposort, cycle detection, story selection validation | Phase 1.3            |
| `state-file.md`             | State file format, resume semantics, 7-case reconciliation matrix       | Phase 1.6            |
| `story-runner.md`           | StoryRunner interface, GitHubCLI/DryRun adapters, idempotent operations | Phase 1.5            |
| `review-loop.md`            | Multi-agent review protocol, finding categories, escalation rules       | Phase 2.4            |
| `integration-checkpoint.md` | File overlap detection, type change analysis, result classification     | Phase 2.7            |

This decomposition keeps each module under 200 lines and prevents the orchestrator from consuming excessive context. The main `SKILL.md` contains the full phase structure and safety invariants; supporting files provide algorithmic detail for specific operations.

### Layer 3: Hook Enforcement

**Directory:** `.claude/hooks/`
**Configuration:** `.claude/settings.json`

Hooks intercept every tool call the orchestrator (and its subagents) make. They operate at three lifecycle points:

- **PreToolUse** — Runs before Edit/Write/Bash operations. Can block the operation entirely.
- **PostToolUse** — Runs after Edit/Write operations complete. Auto-corrects (formatting, type checking).
- **Stop** — Runs when an agent attempts to complete its task. Validates quality gates.

The hooks active during Auto Epic execution:

| Hook                    | Phase       | Trigger          | Action                                                                       |
| ----------------------- | ----------- | ---------------- | ---------------------------------------------------------------------------- |
| `bash-guard.js`         | PreToolUse  | `Bash`           | Blocks dangerous commands (force push, credential exposure, destructive ops) |
| `file-guard.js`         | PreToolUse  | `Edit\|Write`    | Protects CLAUDE.md, .env files, lockfiles; escalates infra/ changes          |
| `tdd-guard.js`          | PreToolUse  | `Edit\|Write`    | Blocks implementation files unless test files exist first                    |
| `architecture-guard.sh` | PreToolUse  | `Edit\|Write`    | Enforces ADR-007 (no Lambda-to-Lambda), ADR-006 (DynamoDB keys)              |
| `import-guard.sh`       | PreToolUse  | `Edit\|Write`    | Enforces `@ai-learning-hub/*` shared library usage                           |
| `auto-format.sh`        | PostToolUse | `Edit\|Write`    | Runs Prettier + ESLint auto-fix silently                                     |
| `type-check.sh`         | PostToolUse | `Edit\|Write`    | Runs `tsc --noEmit`, reports errors (non-blocking)                           |
| Stop hook (agent)       | Stop        | Agent completion | Runs lint, build, test with coverage; blocks if failing                      |

Hooks are self-correcting: when a hook blocks an operation, its error message explains the violation and suggests the correct approach. The agent reads the error, adjusts, and retries. If an agent triggers the same hook more than 3 times, the orchestrator escalates to the human.

### Layer 4: Subagents

**Directory:** `.claude/agents/`

Auto Epic spawns two types of subagents during the code review loop:

**`epic-reviewer`** — A read-only code reviewer with a fresh conversational context. It has no knowledge of how the code was implemented, ensuring genuinely adversarial review. Tools available: Read, Glob, Grep, Bash, Write (for findings doc only). Tools disallowed: Edit, Task.

**`epic-fixer`** — A code fixer that receives a findings document and addresses all Critical and Important issues. It has full edit capabilities. Tools available: Read, Glob, Grep, Bash, Write, Edit. Tools disallowed: Task (cannot spawn sub-subagents).

Both agents are spawned via the Task tool, which creates isolated execution contexts. The reviewer writes a findings document to disk; the fixer reads it and commits fixes locally. This file-based communication pattern keeps the agents decoupled.

A third participant, `/bmad-bmm-dev-story`, runs inline via the Skill tool — it shares the orchestrator's context and has access to the checked-out branch. It is not a subagent but an inline skill invocation.

---

## 3. System Flow

This section traces the complete execution path of `/bmad-bmm-auto-epic Epic-1`, from command invocation through epic completion.

![Command Flow](./diagrams/auto-epic/command-flow.excalidraw)

### Phase 1: Planning and Scope (Steps 1.1–1.6)

**1.1 Load Epic File.** The orchestrator locates `_bmad-output/planning-artifacts/epics/epic-1.md` (or uses `--epic-path` override). It parses the epic title, description, and story references.

**1.2 Load Story Files.** For each story referenced in the epic, the orchestrator reads the story file from `_bmad-output/implementation-artifacts/stories/{story_id}.md` and parses YAML frontmatter fields: `id`, `title`, `depends_on`, `touches`, `risk`. If frontmatter is missing, a regex-based prose fallback detects dependency keywords (e.g., "requires Story 1.1") and emits a warning.

**1.3 Dependency Analysis.** The orchestrator loads `dependency-analysis.md` and executes: (a) build adjacency list from `depends_on` arrays, (b) compute inverse graph to populate `story.dependents` and `story.hasDependents`, (c) detect cycles — any circular dependency is fatal, (d) topological sort via Kahn's algorithm to determine execution order, (e) mark stories with dependents as integration checkpoint stories.

If `--stories` is specified, `validateStorySelection` checks that all required dependencies are either in-scope or already done. Missing dependencies prompt the user: add them automatically, proceed anyway, or cancel.

**1.4 Scope Confirmation [HUMAN CHECKPOINT].** The orchestrator presents the epic, story list, execution order, and integration checkpoint markers. The user chooses: (a) implement all, (b) select specific stories, or (c) cancel.

**1.5 Initialize StoryRunner.** Based on flags: `--dry-run` selects `DryRunStoryRunner` (mock data, no API calls); otherwise, if `.github/` exists, `GitHubCLIRunner` is used (real `gh` + `git` commands).

**1.6 Create/Resume State File.** New runs create `docs/progress/epic-{id}-auto-run.md` with YAML frontmatter (all stories = pending). `--resume` loads the existing state file and reconciles each story against GitHub reality using a 7-case matrix (e.g., state says "in-progress" but PR exists → resume from post-commit; state says "in-progress" but branch deleted → mark blocked).

### Phase 2: Story Implementation Loop (Steps 2.1–2.7)

For each story in topological order:

![Agent Interaction](./diagrams/auto-epic/agent-interaction.excalidraw)

**2.1 Pre-Implementation.** Fetch latest remote state (`git fetch origin main`). Verify each dependency is "done" in the state file. For dependencies with their own dependents, additionally verify code reached the base branch via `git merge-base --is-ancestor`. If unmet, prompt: skip, pause, or override. Then create issue and branch via StoryRunner (idempotent: reuses existing if found).

**2.2 Implementation (Hook-Protected).** In dry-run mode, log and skip. Otherwise, invoke `/bmad-bmm-dev-story` via the Skill tool (inline, same context). During implementation, all six PreToolUse/PostToolUse hooks are active — tdd-guard forces test-first development, architecture-guard blocks ADR violations, import-guard enforces shared library usage, auto-format and type-check run after each edit. After implementation, the orchestrator runs a quality gate: `npm run lint`, `npm run build`, `npm test -- --coverage`. Coverage is parsed from Jest output. A secrets scan gate checks all changed files for high-confidence patterns (AKIA keys, private key material, connection strings).

**2.3 Mark for Review.** Update story status to "review" in the state file.

**2.4 Code Review Loop.** The orchestrator loads `review-loop.md` and enters a review-fix cycle (up to 3 rounds, hard cap 5):

![Hook Lifecycle](./diagrams/auto-epic/hook-lifecycle.excalidraw)

1. **Spawn `epic-reviewer`** via Task tool with `subagent_type: "epic-reviewer"`. The reviewer gets a fresh context — no implementation history. It diffs the branch against main, reads the story's acceptance criteria, and writes a structured findings document to `docs/progress/story-{id}-review-findings-round-{N}.md`.
2. **Count MUST-FIX findings** (Critical + Important categories). If zero, exit the loop.
3. **Spawn `epic-fixer`** via Task tool with `subagent_type: "epic-fixer"`. The fixer reads the findings document, fixes all Critical and Important issues (Minor if time permits), runs tests after each fix, and commits locally. No push occurs during the review loop.
4. **Increment round**, spawn a new reviewer. Each reviewer sees the current code state (including fixer commits) but has no memory of prior review rounds.

If 3 rounds pass with MUST-FIX findings remaining, the orchestrator escalates: (a) manual fix (mark blocked), (b) accept anyway (user assumes risk), (c) +1 round (hard cap: 5).

**2.5 Commit and PR.** Pre-stage validation checks for sensitive file extensions (.env, .pem, .key). Stage changes (`git add -A`), commit with issue reference, record HEAD SHA, push branch (standard push, never force), create PR via StoryRunner (idempotent).

**2.6 Finalize Story [HUMAN CHECKPOINT].** Sync with main (`git fetch` + `git merge origin/main`). If merge conflicts: abort and escalate. If clean merge: re-run tests. If tests pass: push updated branch, update PR description with review summary, mark story done. Prompt user: continue (y), stop (n), pause, or skip next story.

**2.7 Integration Checkpoint.** Runs after stories with dependents. Three checks: (a) shared file overlap detection — cross-reference `git diff --name-only` against dependent stories' `touches` fields, (b) interface/type change detection — scan TypeScript diffs for modified exports, (c) full test suite re-run. Results classified as Green (no issues), Yellow (warnings), or Red (test failures). Red results halt automatic progression.

### Phase 3: Completion and Reporting

After all stories complete (or the user stops):

1. **Generate completion report** at `docs/progress/epic-{id}-completion-report.md` — story summary table, metrics (average story time, test pass rate, review convergence), blockers, and next steps.
2. **Update epic file** — timestamps, PR links, story statuses.
3. **Update state file** — set epic-level status to `done` or `paused`.
4. **Notify user** — summary with all PR links for human review and merge.

### State Management and Persistence

State is stored in `docs/progress/epic-{id}-auto-run.md` as YAML frontmatter (machine-readable) with a regenerated markdown table (human-readable). Updates use a write-then-rename protocol (write to `.tmp`, then `mv` to final path) for best-effort atomicity.

Story statuses follow a state machine: `pending` → `in-progress` → `review` → `done`, with `blocked`, `paused`, and `skipped` as terminal or recoverable states. All transitions go through `updateStoryStatus()`, which updates the state file (primary source of truth) and syncs to GitHub issue labels (secondary).

### Error Handling and Recovery

The orchestrator follows a consistent escalation pattern:

1. **Auto-fix** — For test failures and simple merge conflicts, attempt automated resolution (max 2 attempts).
2. **Self-correct** — For hook violations, the agent reads the error message and adjusts its approach.
3. **Escalate** — After auto-fix exhaustion or repeated violations (>3), present the human with options: fix manually, skip the story, pause the workflow, or show debug output.

No failure is silently ignored. Every error path terminates in either a fix, a user decision, or a state update that enables `--resume` to pick up later.

---

## 4. Component Deep-Dives

### epic-reviewer: Adversarial Code Review

**File:** `.claude/agents/epic-reviewer.md`

The reviewer receives context from the orchestrator via its Task tool prompt: story ID, branch name, base branch, story file path, review round number, and output path. It then:

1. Diffs the branch against the base (`git diff origin/{base}...{branch} --stat` and full diff)
2. Reads the story file for acceptance criteria
3. Scans for security issues: hardcoded secrets (AWS keys, resource IDs, private keys, connection strings), ADR violations, missing tests, performance issues
4. Writes structured findings with Critical/Important/Minor categories to the specified path

The reviewer's tool restrictions are deliberate: it can Write (to produce the findings document) but cannot Edit (preventing it from modifying source code). It cannot spawn Task subagents (preventing unbounded agent chains). Its fresh context means it reviews code as a new pair of eyes would — no memory of previous rounds or implementation decisions.

### epic-fixer: Guided Code Repair

**File:** `.claude/agents/epic-fixer.md`

The fixer receives: story ID, branch name, story file path, findings document path, and round number. It:

1. Reads the findings document completely
2. Addresses Critical findings first, then Important, then Minor if time permits
3. Runs `npm test` after each logical group of fixes
4. Stages and commits with descriptive messages (`fix: address code review round {N} - {description}`)
5. Validates no secrets were introduced before each commit

The fixer operates under the same hook enforcement as the main implementation phase. tdd-guard, architecture-guard, and import-guard all apply. The fixer cannot spawn subagents (Task tool disallowed), keeping the execution tree bounded.

### Hook Interaction Patterns

Hooks create a self-correcting development loop. During a typical story implementation:

```
Agent writes handler.ts (no test file exists)
  → tdd-guard BLOCKS: "Missing test file: handler.test.ts"
Agent creates handler.test.ts with test cases
  → tdd-guard ALLOWS
Agent writes handler.ts implementation
  → architecture-guard checks for Lambda-to-Lambda calls → ALLOWS
  → import-guard checks for @ai-learning-hub/* imports → ALLOWS
  → auto-format runs Prettier + ESLint (1-3s, async)
  → type-check runs tsc --noEmit (2-10s, reports errors if any)
Agent completes task
  → Stop hook runs npm test + lint + build → BLOCKS if failing
  → Agent fixes test failures, retries completion
  → Stop hook → ALLOWS
```

Hooks have graduated latency: PreToolUse guards run in under 200ms (negligible impact). PostToolUse hooks (auto-format, type-check) take 1-10 seconds but run asynchronously. The Stop hook (test-validator) takes 10-60 seconds but only runs once at task completion.

### StoryRunner: Platform Abstraction

The StoryRunner interface decouples orchestration logic from platform-specific operations. All GitHub interactions — creating issues, branches, PRs; checking merge status; updating labels — go through this interface.

Two adapters exist:

- **GitHubCLIRunner** — Uses `gh` CLI and `git` commands. Implements find-or-create patterns for idempotency (check for existing issue before creating, check for existing branch before creating). Includes retry logic with exponential backoff. All branch creation starts from `origin/main` (not HEAD) to ensure branch isolation.
- **DryRunStoryRunner** — Returns deterministic mock data with incrementing counters. Logs all operations. Maintains Maps for idempotency simulation. No API calls, no git operations.

### Integration with the Broader BMAD System

Auto Epic sits within the BMAD (Build, Measure, Analyze, Deploy) method framework. It consumes artifacts produced by upstream BMAD workflows:

- **Epic files** from `/bmad-bmm-create-epics-and-stories` — provide the story list and dependency metadata
- **PRD and Architecture docs** from `/bmad-bmm-create-prd` and `/bmad-bmm-create-architecture` — inform the ADRs that hooks enforce
- **Sprint status** synced via `/bmad-bmm-sprint-status` — secondary status tracking

Auto Epic produces artifacts consumed by downstream workflows:

- **Open PRs** for human review and merge
- **Completion reports** for `/bmad-bmm-retrospective`
- **State files** for progress tracking and sprint status updates

---

## Appendix: Quick Reference

### Command Usage

```bash
/bmad-bmm-auto-epic Epic-1                           # All stories
/bmad-bmm-auto-epic Epic-1 --stories=1.1,1.2,1.5     # Specific stories
/bmad-bmm-auto-epic Epic-1 --resume                   # Resume previous run
/bmad-bmm-auto-epic Epic-1 --dry-run                  # Simulate without GitHub
```

### File Locations

| Component          | Path                                                    |
| ------------------ | ------------------------------------------------------- |
| Command definition | `.claude/commands/bmad-bmm-auto-epic.md`                |
| Orchestrator skill | `.claude/skills/epic-orchestrator/SKILL.md`             |
| Supporting modules | `.claude/skills/epic-orchestrator/*.md`                 |
| Reviewer agent     | `.claude/agents/epic-reviewer.md`                       |
| Fixer agent        | `.claude/agents/epic-fixer.md`                          |
| Hook scripts       | `.claude/hooks/*.{js,sh}`                               |
| Hook configuration | `.claude/settings.json`                                 |
| State files        | `docs/progress/epic-{id}-auto-run.md`                   |
| Review findings    | `docs/progress/story-{id}-review-findings-round-{N}.md` |
| Completion reports | `docs/progress/epic-{id}-completion-report.md`          |

### Safety Invariants

1. Never auto-merge PRs
2. Never bypass hooks
3. Never force push
4. Never push to base branch
5. Never skip tests
6. Never silently ignore failures
7. Idempotent operations
8. State persistence with atomic writes
9. Human checkpoints at 4 workflow milestones

### Human Checkpoints

| Checkpoint             | Phase | Decision                                   |
| ---------------------- | ----- | ------------------------------------------ |
| Scope confirmation     | 1.4   | All stories / select specific / cancel     |
| Per-story completion   | 2.6   | Continue / stop / pause / skip             |
| Integration checkpoint | 2.7   | Continue / stop / pause / review dependent |
| Epic completion        | 3     | Review PRs, investigate blockers           |
