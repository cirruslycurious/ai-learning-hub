# How Auto Epic Works: System Architecture and Agent Flow

## Overview

Auto Epic autonomously implements all stories in an epic with dependency awareness, code quality enforcement, and strategic human checkpoints. The workflow analyzes story dependencies to determine execution order, runs each story through a multi-agent review loop, validates integration points when upstream changes affect downstream stories, and presents all work as pull requests for human approval before merge.

The system balances autonomy with control. AI agents handle implementation, run code review cycles, and enforce architectural constraints through hooks. Humans approve scope at workflow start, review each story's result, intervene at integration checkpoints when dependencies complete, and decide whether to merge the final PRs. No PR merges automatically — the workflow produces verified, ready-to-review pull requests, not uncontrolled commits to the main branch.

Auto Epic solves the coordination problem in multi-story feature development. When building a feature that spans five stories with dependencies (Story 1.2 depends on 1.1, Story 1.4 depends on both 1.2 and 1.3), manual tracking becomes error-prone. Auto Epic computes the dependency graph, validates it for cycles, executes stories in topological order, and runs integration checks after completing stories that have dependents. The result: feature work proceeds safely without manual dependency tracking.

## Architecture Layers

Auto Epic uses a four-layer architecture that separates command parsing, orchestration logic, execution modules, and agent spawning.

**Layer 1: Command entry point** — The `.claude/commands/bmad-bmm-auto-epic.md` file serves as a thin wrapper that parses command-line arguments (`--epic`, `--stories`, `--resume`, `--max-review-rounds`) and delegates to the orchestrator skill. This file contains no orchestration logic. It reads the skill definition and follows its instructions.

**Layer 2: Orchestrator skill** — The `.claude/skills/epic-orchestrator/SKILL.md` file coordinates the three-phase workflow (planning, implementation loop, completion). The orchestrator loads supporting modules on-demand as it enters each phase, spawns subagents with isolated contexts for review and fixing, and enforces nine safety invariants throughout execution. This layer makes all control flow decisions: which story runs next, when to trigger integration checkpoints, when to request human approval.

**Layer 3: Supporting modules** — Five modules provide specialized functionality loaded on-demand:

- `dependency-analysis.md` — builds dependency graph, detects cycles, performs topological sort
- `state-file.md` — persists progress to YAML frontmatter, handles resume reconciliation
- `story-runner.md` — abstracts GitHub operations (issues, branches, PRs) for idempotent resume behavior
- `review-loop.md` — spawns reviewer/fixer subagents, counts MUST-FIX issues, manages loop termination
- `integration-checkpoint.md` — analyzes file overlap, detects type changes, reruns tests for stories with dependents

**Layer 4: Subagents and skills** — Three agents/skills handle specialized tasks:

- `epic-reviewer` — spawns as an isolated subagent (fresh context via Task tool) with read-only tools to perform adversarial code review without implementation bias
- `epic-fixer` — spawns as an isolated subagent with edit tools to apply corrections based on reviewer findings
- `dev-story` — invokes as a skill (same context via Skill tool) to implement individual stories

The architectural boundary between Layer 2 and Layer 4 determines context isolation. The orchestrator spawns `epic-reviewer` and `epic-fixer` as isolated subagents because the reviewer must not have access to implementation history. The orchestrator invokes `dev-story` in the same context because story implementation benefits from carrying forward epic-level knowledge.

[DIAGRAM: system-architecture — Block diagram showing four horizontal layers with component boxes inside each layer. Arrows show delegation flow from Layer 1 to Layer 2, on-demand loading from Layer 2 to Layer 3 modules, and spawning patterns from Layer 2 to Layer 4 agents. Labels distinguish Task tool spawning (isolated context) vs Skill tool invocation (same context).]

## Three-Phase Workflow

The orchestrator executes in three distinct phases: planning and scope confirmation, story implementation loop, and completion reporting.

### Phase 1: Planning and scope

Phase 1 loads the epic file and story files, builds the dependency graph, performs topological sort, and requests human scope confirmation before any implementation begins.

1. Load epic metadata from `docs/epics/epic-{id}.md` and parse story list
2. Load each story's frontmatter from `docs/stories/{id}/story.md` to extract `depends_on` arrays
3. Build forward dependency graph (adjacency list) and inverse graph (dependents)
4. Run cycle detection — fatal error if cycles found
5. Perform topological sort using Kahn's algorithm to produce safe execution order
6. Initialize story runner and create state file at `docs/progress/epic-{id}-auto-run.md`
7. Display scope to user: epic title, story count, execution order, stories with integration checkpoints
8. Wait for human approval to proceed or cancel

Phase 1 enforces the never-silently-ignore-failures invariant by treating dependency cycles as fatal errors that stop execution immediately. The workflow will not proceed past scope confirmation until the user types "yes" — this checkpoint prevents unwanted autonomous work.

### Phase 2: Story implementation loop

Phase 2 processes each story in topological order. For each story, the orchestrator checks dependency completion, runs implementation via `dev-story`, executes the review loop, creates a PR, runs integration checkpoint if the story has dependents, and requests human approval before continuing.

1. Check if all dependencies are complete (status "done" with merged PR or dependency has its own dependents)
2. Update state to "in-progress" and persist
3. Invoke `dev-story` skill in same context to implement the story
4. Update state to "review" and run review loop (up to 3 rounds by default, hard cap 5 with override)
5. Commit and push story branch, create PR with conventional title format
6. If story has dependents (inverse graph non-empty), run integration checkpoint:
   - Sync local branch with main to get latest upstream code
   - Check for file overlap with dependent stories (git diff analysis)
   - Detect type/interface changes in exported symbols
   - Rerun tests (`npm test`) against updated base
   - Classify result as Green (all clear), Yellow (warnings but tests pass), or Red (test failures)
7. Present checkpoint results to user with story summary, PR link, and next action options
8. If user approves, update state to "done" and continue to next story
9. If user pauses, persist state and exit workflow cleanly for later `--resume`
10. If user skips story, update state to "skipped" and mark affected downstream stories as "blocked"

Phase 2 repeats for each story in the topologically sorted list. The loop maintains the never-auto-merge invariant by creating PRs but leaving them open. Integration checkpoints run only for stories with dependents (identified during Phase 1 dependency analysis). A story with zero dependents (leaf node) skips integration checkpoint and proceeds directly to human approval.

The human checkpoint at step 7 folds integration checkpoint results into the approval prompt. For Green results, the workflow shows "all checks passed" and recommends continuing. For Yellow results, the workflow shows warnings but allows user to decide. For Red results, the workflow escalates with failing test output and does not offer auto-continue — the user must pause to investigate.

[DIAGRAM: command-flow — Sequence diagram showing linear flow through Phase 1 (scope confirmation) → Phase 2 (story loop with iteration boundary) → Phase 3 (reporting). Participants: User, Orchestrator, State File, dev-story skill, epic-reviewer subagent. Key interactions: user approval gates at Phase 1 and Phase 2.7, subagent spawning via Task tool, state persistence after each story, loop exit condition when story list exhausted.]

### Phase 3: Completion and reporting

Phase 3 generates a summary report, updates the epic file with completion metadata, finalizes the state file, and notifies the user with the list of PRs ready for review.

1. Collect all PR URLs from completed stories
2. Generate epic summary: total stories, completed count, skipped count, blocked count, review round statistics
3. Update `docs/epics/epic-{id}.md` with completion status and link to auto-run state file
4. Mark state file as "completed" and persist final state
5. Display report to user with PR list and next steps

Phase 3 runs once per epic. After Phase 3, the workflow exits and control returns to the user for PR review and merge decisions.

## Dependency Analysis

Stories declare dependencies in YAML frontmatter using `depends_on: [story-id-1, story-id-2]` format. The orchestrator reads these declarations to build a directed acyclic graph (DAG) that determines execution order and integration checkpoint triggers.

The dependency analysis module builds two graphs: a forward graph (adjacency list mapping each story to its dependencies) and an inverse graph (mapping each story to its dependents). The forward graph drives execution order via topological sort. The inverse graph identifies which stories need integration checkpoints (any story with non-empty dependents list).

Cycle detection runs before execution begins. If the dependency graph contains a cycle (Story A depends on Story B, Story B depends on Story C, Story C depends on Story A), the workflow halts with a fatal error and does not proceed. This enforces the never-silently-ignore-failures invariant at the planning stage.

Topological sort uses Kahn's algorithm: initialize a queue with all zero-dependency stories, process stories from the queue, decrement dependency counts for their dependents, and add newly-zero-dependency stories to the queue. The result is a linear execution order that guarantees all dependencies complete before their dependents start. For the dependency graph `[1.1] ← [1.2, 1.3] ← [1.4]` (Story 1.2 and 1.3 depend on 1.1, Story 1.4 depends on both 1.2 and 1.3), the sort produces order `[1.1, 1.2, 1.3, 1.4]` or `[1.1, 1.3, 1.2, 1.4]` — both valid because 1.2 and 1.3 are independent.

The inverse graph computed during dependency analysis serves integration checkpoint identification. After completing Story 1.1, the orchestrator checks `story.dependents` — finds `[1.2, 1.3]` — and runs integration checkpoint. After completing Story 1.4, the orchestrator checks `story.dependents` — finds `[]` — and skips integration checkpoint.

Dependency completion policy varies based on whether the dependency has its own dependents. If Story 1.2 depends on Story 1.1 and Story 1.1 has other dependents (Story 1.3), Story 1.2 can start after Story 1.1's implementation completes and integration checkpoint passes — even if the PR is not yet merged. Rationale: if the integration checkpoint passes, the changes are stable enough for downstream work. If Story 1.1 has no other dependents (leaf dependency), Story 1.2 must wait for PR merge because there is no integration validation.

## Multi-Agent Code Review Loop

The review loop runs up to 3 rounds (configurable max 5 with `--max-review-rounds` flag) to achieve zero MUST-FIX issues before proceeding to PR creation. Each round spawns a fresh reviewer context, produces a findings document, counts MUST-FIX issues, spawns a fixer if needed, and commits corrections locally.

**Round execution:**

1. Orchestrator spawns `epic-reviewer` subagent via Task tool with isolated context
2. Reviewer diffs local story branch against base branch using `git diff main...story-branch`
3. Reviewer analyzes implementation against story acceptance criteria, architectural constraints (ADRs), and code quality standards
4. Reviewer writes findings to `docs/stories/{id}/review-findings-round-{n}.md` with severity classifications: MUST-FIX (blocks PR), SHOULD-FIX (quality improvement), MINOR (polish)
5. Orchestrator reads findings document and counts MUST-FIX issues
6. If MUST-FIX count > 0 and rounds < max: spawn `epic-fixer` subagent via Task tool
7. Fixer reads findings document, applies corrections, commits changes locally with message referencing round number
8. Orchestrator increments round counter and loops back to step 1

**Exit conditions:**

- MUST-FIX count reaches zero → exit cleanly, proceed to PR creation
- Round count exceeds max (3 by default) → escalate to user with last findings document, request intervention

Context isolation is critical to review quality. Each `epic-reviewer` spawn gets a fresh context with no knowledge of previous rounds, no implementation history, and no access to original story discussions. The reviewer sees only the current code diff and the story definition. This adversarial review pattern prevents reviewer bias — the reviewer cannot rationalize implementation choices because it does not know why those choices were made.

The fixer operates in the opposite pattern: full context, edit tools enabled, reads findings document to understand what to fix. Fixer commits stay local during the loop. No push happens until the loop exits cleanly with MUST-FIX count zero. This local-only git workflow allows the orchestrator to abandon work if max rounds exceeded without polluting the remote branch.

[DIAGRAM: agent-interaction — Sequence diagram showing one complete review loop round. Participants: Orchestrator, epic-reviewer (spawned), epic-fixer (spawned), Local Git, Findings Doc. Interactions: Task tool spawning for reviewer, git diff read, findings document write, MUST-FIX count check with conditional branching (count = 0 exits loop, count > 0 and rounds < max spawns fixer and loops back, count > 0 and rounds >= max escalates to user), fixer spawning, local git commits.]

## Integration Checkpoints

Integration checkpoints run after completing stories with dependents to validate that upstream changes do not break downstream work. The checkpoint performs three analyses: file overlap detection, type/interface change detection, and test re-run.

**File overlap detection** compares the completed story's changed files (via `git diff main...story-branch --name-only`) against the `touches` field in dependent story frontmatter. If the completed story modified `shared/db/src/client.ts` and a dependent story declares `touches: [shared/db]`, the checkpoint flags potential conflict. This is advisory — the `touches` field is developer-declared, not authoritative. Source of truth is the actual git diff.

**Type/interface change detection** scans TypeScript files in the diff for exported type definitions and interface changes. The module uses regex to match `export (type|interface) <name>` patterns in `.ts` and `.d.ts` files. If the completed story modifies exported types that dependent stories import, the checkpoint flags integration risk.

**Test re-run** syncs the local branch with main (`git pull origin main`), rebases the story branch if needed, and runs `npm test` against the updated codebase. This catches integration failures before dependent stories start implementation. If the tests fail after syncing with main, the checkpoint result is Red and the workflow escalates to the user — no auto-continue offered.

**Result classification:**

- **Green** — no file overlap, no type changes detected, all tests pass → display results, fold into Phase 2.7 human checkpoint prompt, recommend continuing
- **Yellow** — file overlap or type changes detected but tests pass → display warnings, fold into prompt, let user decide
- **Red** — tests fail after sync-with-main → display failing test output, escalate to user without auto-continue option

Checkpoint results merge into the Phase 2.7 human approval prompt. For Green, the prompt shows "Integration checks passed. Continue to next story?" For Yellow, the prompt shows "Warnings detected: potential overlap with Stories 1.2, 1.3. Tests pass. Continue?" For Red, the prompt shows "Integration tests failing. You must pause to investigate."

Integration checkpoints enforce the never-skip-tests invariant by running the full test suite after syncing with main. This catches failures caused by concurrent main branch changes that occurred during story implementation.

## Hook System Enforcement

Eight hooks enforce quality gates and architectural constraints during Auto Epic execution. Hooks operate at three phases: PreToolUse (block or escalate before tool execution), PostToolUse (auto-fix after tool execution), and Stop (verify before agent marks task complete).

**PreToolUse hooks** (block or escalate before action):

- `bash-guard` — blocks catastrophic commands (`rm -rf /`, `git push --force`, `npm publish`) before execution
- `file-guard` — blocks modifications to critical files (`.claude/SKILL.md`, `package.json` dependencies, `CLAUDE.md`) without explicit approval
- `architecture-guard` — enforces ADRs by checking patterns (lambda-to-lambda calls violate ADR-008, missing shared lib imports violate ADR-011) and blocking non-conforming code
- `import-guard` — requires all Lambda handlers import from `@ai-learning-hub/*` shared libraries before using utilities
- `tdd-guard` — blocks implementation file edits when no corresponding test file exists or when test file has not been updated recently

**PostToolUse hooks** (auto-fix after action):

- `auto-format` — runs Prettier and ESLint with `--fix` after file edits, commits formatting changes automatically
- `type-check` — runs `tsc --noEmit` after TypeScript file edits, surfaces type errors before commit

**Stop hook** (verify before completion):

- Agent receives prompt to verify tests pass (`npm test`), linting succeeds (`npm run lint`), and build completes (`npm run build`) before marking story complete

Hooks are self-correcting — they teach the correct pattern via error messages. When `architecture-guard` blocks a Lambda-to-Lambda call, the error message includes the correct pattern: "Use API Gateway or EventBridge for inter-Lambda communication (ADR-008)." The agent reads the error, adjusts implementation, retries. User intervention is needed only if the agent violates the same hook more than 3 times (indicates the agent is not learning from feedback).

Hooks enforce the never-bypass-hooks invariant. The orchestrator cannot disable hooks during Auto Epic execution — all quality gates remain active throughout the workflow. This prevents the orchestrator from taking shortcuts that compromise code quality.

[DIAGRAM: hook-lifecycle — Flowchart showing hook firing points during story implementation timeline. Timeline shows: Action Requested → PreToolUse hooks (with decision diamond: block/escalate vs allow) → Tool Execution → PostToolUse hooks (with auto-fix application) → Implementation Complete → Stop hook (verify tests/lint/build). Labels indicate which specific hooks fire at each phase.]

## State Management and Resume

The state file at `docs/progress/epic-{id}-auto-run.md` uses YAML frontmatter for machine-readable state and markdown body for human-readable display. The state file is the primary source of truth for workflow control flow decisions. GitHub state (PR status, branch existence) is secondary.

**Seven story statuses:**

- `pending` — story not started yet
- `in-progress` — currently implementing
- `review` — in review loop
- `done` — implementation complete, PR created and merged (or intentionally closed)
- `blocked` — cannot start because dependency was skipped
- `paused` — user paused workflow at this story
- `skipped` — user explicitly skipped this story

**Resume reconciliation** handles the 7-case matrix of state file status versus GitHub reality:

| State File  | GitHub PR Status    | Reconciliation Action                               |
| ----------- | ------------------- | --------------------------------------------------- |
| done        | merged              | Skip story, already complete                        |
| done        | open                | Skip story, assume human intentionally left PR open |
| done        | closed (not merged) | Skip story, assume human closed intentionally       |
| in-progress | no PR               | Resume implementation from last state               |
| in-progress | PR exists           | Assume work complete, update state to done          |
| review      | PR exists           | Skip review loop, update state to done              |
| pending     | PR exists           | Treat as done, developer completed manually         |

State file wins control flow decisions. If the state file marks a story "done" but GitHub shows PR closed (not merged), the workflow assumes the human closed the PR for a reason and skips the story. This prevents the workflow from re-implementing work the user intentionally canceled.

Atomic writes use a `.tmp` file pattern: write new state to `epic-{id}-auto-run.tmp.md`, verify write succeeded, then `mv epic-{id}-auto-run.tmp.md epic-{id}-auto-run.md`. The `mv` operation is atomic on POSIX filesystems, preventing partial state writes if the process crashes mid-write.

Dependency completion policy during resume: if a dependency has status "done" with merged PR, the dependent can proceed. If a dependency has status "done" with open or closed PR but has other dependents, the dependent can proceed (integration checkpoint validated the changes). If a dependency has status "skipped", all dependents are marked "blocked" and do not run.

## Safety Invariants and Human Checkpoints

Nine safety invariants are non-negotiable rules enforced throughout the workflow. Four human checkpoints provide intervention points where the user can pause, skip stories, or cancel execution.

**Nine safety invariants:**

1. **Never auto-merge** — all PRs remain open for human review before merge
2. **Never bypass hooks** — all quality gates remain active, cannot be disabled
3. **Never force push** — story branches use normal push, no `--force` flag
4. **Never push to base branch** — orchestrator only pushes to story branches
5. **Never skip tests** — `npm test` runs during review loop and integration checkpoints
6. **Never silently ignore failures** — cycles, test failures, and hook violations escalate to user
7. **Idempotent operations** — GitHub operations check for existence before creating (branch, PR, issue comment)
8. **State persistence** — state file updates after every story status change
9. **Human checkpoints** — four approval gates where user controls workflow progression

**Four checkpoint types:**

1. **Scope confirmation** (Phase 1.4) — user approves epic scope, story list, execution order before implementation begins
2. **Per-story approval** (Phase 2.7) — user reviews story completion, PR link, integration checkpoint results (if applicable), and decides continue/pause/skip
3. **Integration checkpoints** (Phase 2.7 for stories with dependents) — automated validation results presented to user with Green/Yellow/Red classification
4. **Completion review** (Phase 3) — user receives final report with all PR links and merge recommendations

Human checkpoints provide four intervention points. At scope confirmation, the user can cancel if the execution order looks wrong or the story list is incorrect. At per-story approval, the user can pause to review the PR, skip a story that no longer makes sense, or continue to the next story. At integration checkpoints, the user sees validation results and can pause if Yellow or Red flags appear concerning. At completion review, the user has the full PR list and can merge selectively.

The workflow never takes destructive actions that could lose work. No force push (could lose commits), no auto-merge (could merge broken code), no automatic PR closes (user might want the branch preserved). These invariants ensure the workflow produces artifacts the user can review, modify, or discard without data loss risk.

## Execution Example

This section walks through a concrete four-story epic execution showing dependency ordering, integration checkpoints, and review loop mechanics. The example epic structure:

- Story 1.1 (no dependencies)
- Story 1.2 (depends on Story 1.1)
- Story 1.3 (depends on Story 1.1)
- Story 1.4 (depends on Story 1.2 and Story 1.3)

[DIAGRAM: dependency-graph — Dependency graph showing four story nodes (1.1, 1.2, 1.3, 1.4) with directed edges labeled "depends_on". Story 1.2 has arrow from 1.1, Story 1.3 has arrow from 1.1, Story 1.4 has arrows from both 1.2 and 1.3. Execution order annotations show [1] 1.1, [2] 1.2 or 1.3, [3] 1.3 or 1.2, [4] 1.4. Checkpoint markers (⚠) appear on Stories 1.1, 1.2, 1.3 indicating they have dependents.]

### Phase 1: Planning

The orchestrator loads epic metadata and story files, builds the dependency graph, computes the inverse graph (dependents), runs cycle detection, and performs topological sort.

**Dependency graph (forward):**

- Story 1.1: `[]` (no dependencies)
- Story 1.2: `[1.1]`
- Story 1.3: `[1.1]`
- Story 1.4: `[1.2, 1.3]`

**Dependents graph (inverse):**

- Story 1.1: `[1.2, 1.3]` (has dependents → integration checkpoint needed)
- Story 1.2: `[1.4]` (has dependent → integration checkpoint needed)
- Story 1.3: `[1.4]` (has dependent → integration checkpoint needed)
- Story 1.4: `[]` (leaf story → no integration checkpoint)

**Topological sort produces:** `[1.1, 1.2, 1.3, 1.4]` or `[1.1, 1.3, 1.2, 1.4]` (both valid, algorithm may choose either).

Orchestrator displays scope:

```
Epic: Authentication System Overhaul
Stories: 4 total
Execution order: 1.1 → 1.2 → 1.3 → 1.4
Integration checkpoints: Stories 1.1, 1.2, 1.3 (have dependents)

Proceed? (yes/no)
```

User types "yes". Orchestrator creates state file and initializes runner.

### Phase 2: Story implementation loop

**Story 1.1 execution:**

1. Check dependencies: `[]` (no dependencies) → proceed
2. Update state to "in-progress"
3. Invoke `dev-story` skill to implement Story 1.1
4. Update state to "review" and start review loop:
   - Round 1: spawn `epic-reviewer` → finds 2 MUST-FIX issues (missing error handling in `auth.ts:45`, unused import in `token.ts:12`) → spawn `epic-fixer` → applies corrections → commits locally
   - Round 2: spawn `epic-reviewer` → finds 0 MUST-FIX issues → loop exits
5. Push story branch `story-1-1-jwt-token-service`, create PR "feat: implement JWT token service (#123)"
6. Run integration checkpoint (Story 1.1 has dependents `[1.2, 1.3]`):
   - File overlap: Story 1.1 modified `backend/auth/token.ts`, Stories 1.2 and 1.3 both declare `touches: [backend/auth]` → flag overlap
   - Type changes: exported interface `TokenPayload` added to `token.ts` → flag type change
   - Sync with main and rerun tests: all tests pass
   - Result: **Yellow** (warnings but tests pass)
7. Present checkpoint to user:

   ```
   Story 1.1 complete.
   PR: #123 (open)
   Integration checkpoint: YELLOW
   - File overlap detected with Stories 1.2, 1.3
   - Exported type 'TokenPayload' added
   - All tests pass

   Continue to Story 1.2? (yes/pause/skip)
   ```

8. User types "yes"
9. Update state to "done"

**Story 1.2 execution:**

1. Check dependencies: Story 1.1 status "done" with dependents `[1.2, 1.3]` → proceed (integration checkpoint passed)
2. Invoke `dev-story`, run review loop (assume 0 MUST-FIX on first round), create PR #124
3. Run integration checkpoint (Story 1.2 has dependent `[1.4]`): assume result Green
4. Present checkpoint to user, user approves
5. Update state to "done"

**Story 1.3 execution:**

1. Check dependencies: Story 1.1 status "done" → proceed
2. Invoke `dev-story`, run review loop, create PR #125
3. Run integration checkpoint (Story 1.3 has dependent `[1.4]`): assume result Green
4. Present checkpoint, user approves
5. Update state to "done"

**Story 1.4 execution:**

1. Check dependencies: Stories 1.2 and 1.3 both status "done" → proceed
2. Invoke `dev-story`, run review loop, create PR #126
3. Skip integration checkpoint (Story 1.4 has no dependents)
4. Present completion to user:

   ```
   Story 1.4 complete.
   PR: #126 (open)
   No integration checkpoint needed (leaf story)

   Continue to epic completion? (yes/pause)
   ```

5. User types "yes"
6. Update state to "done"

### Phase 3: Completion

Orchestrator generates summary:

```
Epic: Authentication System Overhaul — COMPLETE
Stories completed: 4 / 4
PRs ready for review:
- #123 feat: implement JWT token service
- #124 feat: add token refresh endpoint
- #125 feat: implement session management
- #126 feat: integrate auth with user service

Review rounds: 5 total (avg 1.25 per story)
Integration checkpoints: 3 run (1 Yellow, 2 Green)

Next steps: Review and merge PRs in order [#123, #124, #125, #126]
```

User reviews PRs and merges them manually. The workflow does not merge — it produces verified, review-ready work.

This example demonstrates dependency ordering (1.1 completes before 1.2/1.3 start), integration checkpoints (run for 1.1/1.2/1.3 but not 1.4), review loop mechanics (2 rounds for Story 1.1), and human approval gates (after each story and at completion). For hook enforcement details, see Hook System Enforcement section. For resume behavior, see State Management and Resume section.
