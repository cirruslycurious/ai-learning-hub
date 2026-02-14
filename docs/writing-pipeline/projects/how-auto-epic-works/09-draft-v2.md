# How Auto Epic Command Works: Agent Flow and System Architecture

## Overview

You run Auto Epic to autonomously implement entire epics with code review loops and human checkpoints.

Auto Epic (`/bmad-bmm-auto-epic`) runs as a long-lived Claude Code session that implements all stories in an epic in dependency order. For each story, it creates a git branch, writes code via the `/bmad-bmm-dev-story` skill, runs lint/build/test gates, performs multi-agent code review with fresh-context adversarial reviewers, commits locally, and opens a pull request. Human checkpoints appear at two explicit points: scope confirmation before implementation begins (Phase 1.4) and per-story completion decisions (Phase 2.6). For stories with dependents, integration validation results are shown alongside the per-story checkpoint (`.claude/skills/epic-orchestrator/SKILL.md:61, 264`).

Key benefits include autonomous supervised execution, quality convergence through adversarial review (exits when 0 MUST-FIX findings remain, or after 3 rounds), dependency-aware execution (topological sort ensures prerequisites complete first), resumability, and safety by design.

Use Auto Epic for implementing entire epics (5-15 stories) with defined dependencies. Use `/bmad-bmm-dev-story` for single stories. Use `/bmad-bmm-code-review` for one-shot reviews without epic orchestration.

## Architecture Layers

You understand Auto Epic through four architectural layers: command entry point, orchestrator skill, hook system, and subagents.

### Layer 1: Command entry point

The command file at `.claude/commands/bmad-bmm-auto-epic.md` (54 lines) parses arguments (`Epic-1`, `--stories=1.1,1.2`, `--resume`, `--dry-run`) and delegates to the orchestrator skill. This thin layer handles only argument validation and skill invocation, not business logic.

### Layer 2: Orchestrator skill

The orchestrator at `.claude/skills/epic-orchestrator` consists of six modules loaded on-demand to prevent context bloat. Modules range from 155 to 464 lines, with the core SKILL.md being the largest at 464 lines. Supporting modules average 215 lines. Each module is explicitly loaded by instruction in SKILL.md when entering the relevant phase (e.g., "Read `dependency-analysis.md` in this skill directory for the complete algorithm" at Phase 1.3):

- `SKILL.md`: Core workflow definition (Phases 1-3), always loaded (464 lines)
- `dependency-analysis.md`: Topological sort algorithm (193 lines), loaded at Phase 1.3
- `story-runner.md`: GitHub CLI vs. dry-run adapter selection (370 lines), loaded at Phase 1.5
- `state-file.md`: State persistence and resume logic (183 lines), loaded at Phase 1.6
- `review-loop.md`: Multi-round code review protocol (175 lines), loaded at Phase 2.4
- `integration-checkpoint.md`: Dependent validation (155 lines), loaded at Phase 2.7

This modular decomposition keeps each agent invocation under context limits while providing deep protocol documentation when needed.

### Layer 3: Hook system and safety enforcement

Nine hook scripts intercept tool calls at three lifecycle points: PreToolUse (blocks before action), PostToolUse (auto-corrects after action), and Stop (validates quality gates at completion). A tenth mechanism, the Stop hook, is agent prompt-based rather than script-based (`.claude/hooks/README.md:8-20`).

#### PreToolUse hooks (gate enforcement)

- `bash-guard.js`: Implements tiered safety (critical/high/strict via `CLAUDE_SAFETY_LEVEL` env var, lines 16-18). Critical level blocks catastrophic commands (lines 63-105). High level blocks destructive git operations and credential exposure (lines 110-215). Strict level blocks any force push (lines 220-244). Escalates 6 high-risk patterns for human approval (lines 249-285): git push main, npm publish, cdk deploy, aws delete, rm -rf, terraform destroy.
- `file-guard.js`: Validates file paths and permissions before Write/Edit operations.
- `tdd-guard.js`: Enforces test-first development by blocking implementation file writes unless failing tests exist in test.json. Test file writes always allowed.
- `architecture-guard.sh`: Enforces ADR-007 (no Lambda-to-Lambda calls), ADR-006 (DynamoDB key patterns), ADR-014 (handlers use @ai-learning-hub/db).
- `import-guard.sh`: Denies Lambda/backend files using DynamoDB/Logger/Zod/middleware without @ai-learning-hub/\* shared library imports.
- `pipeline-guard.cjs`: Protects writing pipeline integrity: denies writes to guides/, agents/, templates/; denies overwrites of previous artifacts; warns on non-standard filenames (`.claude/hooks/README.md:15`).

#### PostToolUse hooks (auto-correction)

- `auto-format.sh`: Runs Prettier + ESLint auto-fix asynchronously after file changes.
- `type-check.sh`: Runs tsc --noEmit and reports TypeScript errors without blocking.
- `pipeline-read-tracker.cjs`: Records breadcrumbs when pipeline guide files are Read for verification by pipeline-guard (`.claude/hooks/README.md:16`).

#### Stop hook (quality validation)

Validates quality gates when agent attempts completion: runs npm test, npm run lint, npm run build. If any gate fails, blocks agent completion and requires fixes.

Hooks block invalid operations by exiting with code 2 and writing error messages to stderr. Hooks escalate high-risk operations by exiting with code 0 and returning JSON with `permissionDecision: 'ask'`. The orchestrator reads these responses and adjusts behavior accordingly (`.claude/hooks/README.md:29-49`, bash-guard.js:31-45). Repeated violations (more than 3 times) escalate to human intervention.

### Layer 4: Subagents

Two specialized agents spawn via Task tool with fresh contexts:

- `epic-reviewer` (`.claude/agents/epic-reviewer.md`): Read-only analysis, tools: Read/Glob/Grep/Bash/Write. Disallowed: Edit (prevents code modification), Task (prevents agent chains).
- `epic-fixer` (`.claude/agents/epic-fixer.md`): Full edit capabilities, tools: Read/Glob/Grep/Bash/Write/Edit. Disallowed: Task (prevents unbounded sub-subagents).

Tool restrictions are defined in the agent frontmatter (`disallowedTools` field) and enforced by the Task tool when spawning subagents (epic-reviewer.md:5, epic-fixer.md:5). This separation ensures reviewers cannot modify code they critique and fixers cannot spawn additional agents that would create unbounded chains.

## Command Flow and Phases

You trace execution through three phases: Planning & Scope (Phase 1), Story Implementation Loop (Phase 2), and Completion & Reporting (Phase 3).

### Phase 1: Planning & Scope

Six steps prepare the workflow:

1. **Load epic file (1.1):** Read epic file from `_bmad-output/planning-artifacts/epics/epic-{id}.md` containing title, description, story references.
2. **Load story files (1.2):** Read story files from `_bmad-output/implementation-artifacts/stories/{story_id}.md` with YAML frontmatter (id, title, depends_on, touches, risk).
3. **Dependency analysis (1.3):** Parse YAML frontmatter, build adjacency list, apply topological sort to determine execution order. Cycle detection terminates with a fatal error. Error format: `❌ Dependency Cycle Detected\n\nStory 1.2 depends on Story 1.3\nStory 1.3 depends on Story 1.2\n\nThis epic cannot be implemented until dependencies are resolved.` (`.claude/skills/epic-orchestrator/dependency-analysis.md:32-131, 104-115`).
4. **Scope confirmation checkpoint (1.4):** Human chooses: implement all stories, select specific stories (with dependency validation), or cancel.
5. **Initialize StoryRunner (1.5):** Select DryRunStoryRunner for `--dry-run` flag (deterministic mocks) or GitHubCLIRunner for real repos with `.github/` directory (`.claude/skills/epic-orchestrator/story-runner.md:70-84`).
6. **Create or resume state file (1.6):** State file at `docs/progress/epic-{id}-auto-run.md` uses YAML frontmatter (primary source of truth) with regenerated markdown table (human display). Resume reconciles with GitHub (see State Management section).

**Warning:** Cycle detection terminates the workflow with a fatal error. Ensure story dependencies form a directed acyclic graph before running Auto Epic.

### Phase 2: Story Implementation Loop

Seven substeps per story in topological order:

1. **Pre-implementation dependency check (2.1):** Stories with dependents require PR merged OR commit reachable from base via `git merge-base --is-ancestor ${commitSha} origin/${baseBranch}`. Leaf stories only need open PR with passing tests. Rationale: downstream stories need code on base branch to build correctly. Override flag `--no-require-merged` relaxes dependency checking to accept state file 'done' status for all stories, bypassing the merge-base verification for stories with dependents (`.claude/skills/epic-orchestrator/state-file.md:158, 143-158`).
2. **Hook-protected implementation (2.2):** Run `/bmad-bmm-dev-story` skill. All tool calls intercepted by hooks. Run three quality gates: lint, build, test with 80% coverage. Coverage parsed from Jest "All files" summary line. If coverage cannot be parsed (regex match fails), the orchestrator logs a warning and uses 'N/A' in the PR body. The story is not blocked (`.claude/skills/epic-orchestrator/SKILL.md:176-179`). Secrets scan checks for AWS credentials, API keys, private keys, resource IDs, connection strings before review (`.claude/skills/epic-orchestrator/SKILL.md:160-199`).
3. **Mark for review (2.3):** Update state file status to "review".
4. **Code review loop (2.4):** Multi-round review with up to 3 review rounds (meaning 2 fix attempts before escalation). Hard cap 5 rounds with user override. Each round: spawn fresh-context reviewer → reviewer writes findings → count MUST-FIX (Critical + Important) → if MUST-FIX > 0 spawn fixer → fixer commits locally → increment round. Exit when MUST-FIX = 0 or max rounds reached (`.claude/skills/epic-orchestrator/review-loop.md:9-13`). Fresh context is achieved by spawning the reviewer via Task tool, which creates a new agent invocation with no inherited context from the orchestrator or previous reviewers. The reviewer only sees the git diff output and story file (review-loop.md:16-36).
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

Resume (`--resume` flag) reconciles the primary statuses (done, in-progress, pending) with GitHub using a 7-case matrix. Additional handling exists for paused, blocked, and skipped statuses (`.claude/skills/epic-orchestrator/state-file.md:121-135`):

| State File Status | GitHub State   | Action                      |
| ----------------- | -------------- | --------------------------- |
| done              | PR merged      | Skip (already complete)     |
| done              | PR closed      | Keep done (state file wins) |
| in-progress       | PR exists      | Resume from finalization    |
| in-progress       | Branch deleted | Mark blocked (no recovery)  |
| in-progress       | No PR/branch   | Reset to pending            |
| pending           | PR exists      | Treat as review (manual PR) |
| pending           | Branch exists  | Check out branch, resume    |

The matrix handles interrupted sessions, manual GitHub actions, and state corruption gracefully. The complete reconciliation matrix includes 13 total cases: the 7 base cases above plus additional handling for paused (3 cases), blocked (2 cases), and skipped (1 case).

### Commit SHA Tracking

Record HEAD SHA after each story using `git rev-parse HEAD` (`.claude/skills/epic-orchestrator/state-file.md:172-183`). Store in `stateFile.stories[story.id].commit`. Use for dependency verification and review scope.

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
/bmad-bmm-auto-epic Epic-1 --epic-path=custom-epics/epic-1.md

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

---

## Diagram Suggestions

### Diagram 1: System Architecture (High-Level Components)

**Concept:** The four architectural layers and their relationships, showing how the command entry delegates to the orchestrator, which invokes hooks and spawns subagents.

**Type:** `flowchart TB` (top-to-bottom hierarchy shows containment and layers)

**Components:**

- Command Entry (`.claude/commands/bmad-bmm-auto-epic.md`)
- Orchestrator Core (SKILL.md + 5 supporting modules)
- Hook System (9 hook scripts + Stop mechanism)
- Subagents (epic-reviewer, epic-fixer)
- External Services (GitHub via StoryRunner)

**Relationships:**

- Command Entry → Orchestrator Core (delegates)
- Orchestrator Core → Hook System (tool calls intercepted)
- Orchestrator Core → Subagents (spawns via Task tool)
- Orchestrator Core → External Services (via StoryRunner adapter)

**Context:** Place immediately after the "Architecture Layers" section opener (before Layer 1 subsection). This gives readers a spatial map before diving into layer-by-layer detail.

**Why a diagram helps:** Four conceptual layers with crossing boundaries (hooks intercept orchestrator calls, subagents read orchestrator output) are difficult to visualize from prose alone. The diagram shows containment (layers) and crosscutting concerns (hooks) spatially.

---

### Diagram 2: Command Flow Sequence (Phase 1-2-3)

**Concept:** The complete execution path from command invocation through Phase 1 (Planning), Phase 2 (Story Loop), and Phase 3 (Completion).

**Type:** `flowchart LR` (left-to-right process flow)

**Components:**

- Start: User invokes command
- Phase 1: Load epic → Load stories → Dependency analysis → Scope checkpoint (diamond) → Initialize StoryRunner
- Phase 2: For each story: Dependency check → Implementation → Review loop (box representing the multi-round subflow) → Commit & PR → Finalize (diamond) → Integration checkpoint
- Phase 3: Generate report → Update files → Notify user
- End: User reviews PRs

**Relationships:**

- Linear progression through phases with two decision diamonds (Scope checkpoint: continue/cancel, Finalize checkpoint: continue/stop/pause)
- Phase 2 loop back arrow showing "next story in topological order"

**Context:** Place at the beginning of "Command Flow and Phases" section, before the three phase subsections. The diagram provides a complete execution roadmap that the subsequent prose elaborates step-by-step.

**Why a diagram helps:** The three-phase structure with a nested story loop and multiple checkpoints creates a complex control flow. The diagram shows the primary path, loop boundaries, and decision points without requiring readers to reconstruct the flow from prose.

---

### Diagram 3: Hook Lifecycle (PreToolUse, PostToolUse, Stop)

**Concept:** The three hook interception points during tool execution, showing which hooks run at each point and what actions they take.

**Type:** `flowchart LR` (left-to-right process showing temporal sequence)

**Components:**

- Tool Call Attempt
- PreToolUse Gate (with 6 hooks: bash-guard, file-guard, tdd-guard, architecture-guard, import-guard, pipeline-guard)
- Decision: Any hook blocks? (diamond)
- Denied (terminal)
- Tool Executes
- PostToolUse Auto-Correction (with 3 hooks: auto-format, type-check, pipeline-read-tracker)
- Agent Completes
- Stop Validation (quality gates: lint, build, test)
- Decision: All gates pass? (diamond)
- Blocked / Success (terminals)

**Relationships:**

- Tool Call → PreToolUse Gate → (if any hook blocks) → Denied
- Tool Call → PreToolUse Gate → (if all allow) → Tool Executes → PostToolUse Auto-Correction
- Agent Completes → Stop Validation → (if gates fail) → Blocked, (if gates pass) → Success

**Context:** Place in the "Architecture Layers > Layer 3" section after the hook category descriptions. The diagram shows the temporal relationship between the three categories (PreToolUse runs before, PostToolUse runs after, Stop runs at completion).

**Why a diagram helps:** Three lifecycle points with different semantics (block vs. auto-correct vs. validate) and different hook sets at each point creates a multidimensional concept. The diagram collapses this into a single temporal flow showing when each category intercepts execution.

---

### Diagram 4: Review Loop Protocol (Multi-Round Convergence)

**Concept:** The iterative review-fix cycle showing how the orchestrator spawns reviewers and fixers until MUST-FIX findings reach zero or max rounds are exceeded.

**Type:** `flowchart LR` (left-to-right process with loop-back)

**Components:**

- Start Review Loop
- Spawn Reviewer (fresh context via Task tool)
- Reviewer Writes Findings
- Count MUST-FIX (Critical + Important)
- Decision: MUST-FIX > 0? (diamond)
- Spawn Fixer
- Fixer Commits Locally
- Increment Round
- Decision: Round >= Max Rounds? (diamond)
- Escalate to User (terminal)
- Exit: Clean (terminal)

**Relationships:**

- Linear flow: Start → Spawn Reviewer → Write Findings → Count MUST-FIX
- If MUST-FIX > 0 → Spawn Fixer → Commit → Increment Round → loop back to Spawn Reviewer
- If MUST-FIX = 0 → Exit Clean
- If Round >= Max Rounds → Escalate to User

**Context:** Place in the "Subagent Orchestration" section after the Reviewer and Fixer protocol descriptions. The diagram shows how the two subagent types coordinate across multiple rounds.

**Why a diagram helps:** The review loop has conditional exits (clean state vs. max rounds), nested decisions (check MUST-FIX count, check round count), and a loop-back edge. Describing this control flow in prose requires readers to hold multiple conditionals in memory. The diagram makes the convergence logic and exit paths explicit.

---

### Diagram 5: State File Resume Reconciliation (Primary Status Matrix)

**Concept:** The 7-case decision matrix for reconciling state file status (done, in-progress, pending) with GitHub reality (PR merged, PR closed, branch exists, etc.) during resume.

**Type:** `flowchart TB` (top-to-bottom decision tree)

**Components:**

- Start: Resume --resume flag
- Read State File Status
- Decision: Status = done? (diamond)
  - Yes → Decision: PR merged? → Yes → Skip (terminal) / No → Keep done (terminal)
- Decision: Status = in-progress? (diamond)
  - Yes → Decision: PR exists? → Yes → Resume finalization (terminal) / No → Decision: Branch deleted? → Yes → Mark blocked (terminal) / No → Reset pending (terminal)
- Decision: Status = pending? (diamond)
  - Yes → Decision: PR exists? → Yes → Treat as review (terminal) / No → Decision: Branch exists? → Yes → Check out branch (terminal)

**Relationships:**

- Three primary branches (done, in-progress, pending) each leading to further GitHub state checks
- Edges labeled with GitHub state conditions (PR merged, PR closed, branch exists, etc.)
- Terminals labeled with reconciliation actions (Skip, Keep done, Resume finalization, Mark blocked, Reset pending, Treat as review, Check out branch)

**Context:** Place in the "State Management and Resume > Resume Reconciliation" subsection after the prose description of the 7-case matrix and the table showing State File Status → GitHub State → Action mappings.

**Why a diagram helps:** The prose table lists the 7 cases linearly, but the matrix is actually a nested decision tree (first check state file status, then check GitHub state). The diagram reveals the decision structure and shows that "done" has 2 sub-cases, "in-progress" has 3 sub-cases, and "pending" has 2 sub-cases. This structure is not obvious from the flat table.

---

### Diagram 6: Integration Checkpoint Classification (Green/Yellow/Red)

**Concept:** The decision logic for classifying integration checkpoint results based on shared file overlaps, type changes, and test outcomes.

**Type:** `flowchart TB` (top-to-bottom decision tree)

**Components:**

- Start: Story with dependents completes
- Check Shared File Overlaps
- Check Type Changes
- Re-run Full Test Suite
- Decision: Test failures? (diamond)
  - Yes → Red: Halt (terminal)
- Decision: Type changes detected? (diamond)
  - Yes → Yellow: Ask user (terminal)
- Decision: Shared file conflicts? (diamond)
  - Yes → Yellow: Ask user (terminal)
- No issues → Green: Auto-continue (terminal)

**Relationships:**

- Linear checks: Shared files → Type changes → Test suite
- Three exit paths based on severity: Red (test failures), Yellow (type changes or shared file conflicts), Green (all clear)

**Context:** Place in the "Command Flow and Phases > Phase 2" section after Step 2.7 (Integration checkpoint) description. The diagram shows how the three validation types (shared files, type changes, tests) combine to produce a classification.

**Why a diagram helps:** The classification logic has three independent checks (shared files, type changes, tests) but a hierarchical severity model (test failures override type changes). Prose describes the checks sequentially, but the diagram shows that the classification depends on which checks fail and in what combination. The spatial layout (Red at top, Yellow in middle, Green at bottom) reinforces the severity hierarchy.

---

<!-- Word count: 2,293 words | Target: 2,400 words | Δ: -107 (-4%) -->
