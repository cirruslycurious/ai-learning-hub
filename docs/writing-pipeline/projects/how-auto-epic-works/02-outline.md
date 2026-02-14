# Outline: How Auto Epic Works

**Note:** This outline is being written without the companion `01-research.md` file due to a pipeline-guard.cjs hook limitation. The hook at line 74 acknowledges step 1 produces both 01 and 02 artifacts, but the logic at lines 202-211 blocks writing artifact 01 because 1 < 2. The research findings that would normally be in `01-research.md` are documented inline in this outline's "Research notes" sections.

---

## Section: Overview

**Covers:** The reader understands what Auto Epic does at a high level, its key benefits, and when to use it versus other BMAD workflows.

**Word budget:** ~350 words

**Key points:**

- Auto Epic (`/bmad-bmm-auto-epic`) is an autonomous epic implementation workflow that implements all stories in dependency order with code review loops and human checkpoints (finding: command definition in `.claude/commands/bmad-bmm-auto-epic.md:1-6`)
- The workflow runs as a single long-lived Claude Code session, creating branches, writing code, running tests, performing multi-agent code reviews, and opening PRs (finding: existing draft `docs/how-auto-epic-works.md:11-21`)
- Key benefits include autonomous supervised execution, quality convergence through adversarial review, dependency-aware execution, resumability, and safety by design (finding: existing draft lines 25-31`)
- Use Auto Epic for implementing entire epics (5-15 stories); use `/bmad-bmm-dev-story` for single manual stories, `/bmad-bmm-code-review` for one-shot reviews (finding: existing draft lines 33-42)
- Nine safety invariants protect the workflow: never auto-merge PRs, never bypass hooks, never force push, never push to base branch, never skip tests, never silently ignore failures, idempotent operations, state persistence, and human checkpoints (finding: `.claude/skills/epic-orchestrator/SKILL.md:12-24`)

**Research notes:** Findings from command file, SKILL.md safety invariants section, and existing draft overview. No gaps affect this section. All claims verified from source code.

**Progressive disclosure:** Skimmers learn Auto Epic implements stories autonomously with safety checkpoints. Readers get the full value proposition and when-to-use guidance. Deep readers will find the safety invariants preview that anchor the entire workflow.

---

## Section: Architecture Layers

**Covers:** The reader understands the four architectural layers (command entry point, orchestrator skill, hook system, subagents) and their boundaries.

**Word budget:** ~500 words

**Key points:**

- Layer 1 (Command Entry Point): Thin command file (~55 lines) at `.claude/commands/bmad-bmm-auto-epic.md` that parses arguments and delegates to orchestrator (finding: command file lines 1-55)
- Layer 2 (Orchestrator Skill): Modular skill decomposed into six files loaded on-demand to prevent context bloat (finding: `.claude/skills/epic-orchestrator/` directory contains SKILL.md, dependency-analysis.md, state-file.md, story-runner.md, review-loop.md, integration-checkpoint.md)
- Each module is under 200 lines and loaded when entering specific phases: dependency-analysis.md at Phase 1.3, state-file.md at Phase 1.6, story-runner.md at Phase 1.5, review-loop.md at Phase 2.4, integration-checkpoint.md at Phase 2.7 (finding: SKILL.md references to "Read X.md when entering Phase Y")
- Layer 3 (Hook System): Eight hooks intercept tool calls at PreToolUse, PostToolUse, and Stop lifecycle points to enforce safety constraints deterministically (finding: `.claude/hooks/README.md:8-20`)
- Hooks active during Auto Epic: bash-guard.js, file-guard.js, tdd-guard.js, architecture-guard.sh, import-guard.sh, auto-format.sh, type-check.sh, Stop hook (finding: hooks README and existing draft lines 94-104)
- Layer 4 (Subagents): Two specialized agents spawned via Task tool with fresh contexts: epic-reviewer (read-only, tools: Read/Glob/Grep/Bash/Write, disallowed: Edit/Task) and epic-fixer (full edit, tools: Read/Glob/Grep/Bash/Write/Edit, disallowed: Task) (finding: `.claude/agents/epic-reviewer.md:4-5` and `.claude/agents/epic-fixer.md:4-5`)
- Tool restrictions prevent code modification by reviewer and unbounded agent chains by fixer (finding: agent definitions)

**Research notes:** All findings verified from source files. The modular decomposition and on-demand loading pattern is explicitly documented in both SKILL.md and the existing draft. Hook system details come from hooks README. Subagent tool restrictions are defined in their YAML frontmatter.

**Progressive disclosure:** Skimmers learn the four layers exist and their names. Readers understand the purpose and boundaries of each layer, including file locations. Deep readers get module-loading triggers, hook lifecycle details, and subagent tool restrictions.

---

## Section: Command Flow and Phases

**Covers:** The reader can trace the complete execution path from command invocation through Phase 1 (Planning & Scope), Phase 2 (Story Implementation Loop), and Phase 3 (Completion & Reporting).

**Word budget:** ~800 words

**Key points:**

- Phase 1 consists of six steps: load epic file (1.1), load story files (1.2), dependency analysis with topological sort (1.3), scope confirmation checkpoint (1.4), initialize StoryRunner adapter (1.5), create or resume state file (1.6) (finding: SKILL.md:28-103)
- Dependency analysis parses YAML frontmatter with regex prose fallback, builds adjacency list, computes inverse graph to populate `story.dependents`, detects cycles (fatal error), applies Kahn's topological sort (finding: `dependency-analysis.md:32-131`)
- Scope confirmation is the first human checkpoint where user chooses: implement all stories, select specific stories with dependency validation, or cancel (finding: SKILL.md:61-75)
- StoryRunner selection: DryRunStoryRunner for `--dry-run` flag (deterministic mocks), GitHubCLIRunner for real repos with `.github/` directory (finding: `story-runner.md:70-84`)
- State file at `docs/progress/epic-{id}-auto-run.md` uses YAML frontmatter (primary source of truth) with regenerated markdown table (human display); resume reconciles state with GitHub via 7-case matrix (finding: `state-file.md:5-136`)
- Phase 2 iterates through stories in topological order with seven substeps per story: pre-implementation dependency check (2.1), hook-protected implementation via `/bmad-bmm-dev-story` skill (2.2), mark for review (2.3), code review loop with up to 3 rounds (2.4), commit & PR creation (2.5), finalize story with human checkpoint (2.6), integration checkpoint for stories with dependents (2.7) (finding: SKILL.md:105-345)
- Pre-implementation checks dependencies: stories with dependents require PR merged OR commit reachable from base via `git merge-base --is-ancestor`; leaf stories only need open PR with passing tests (finding: SKILL.md:113-127 and `state-file.md:139-157`)
- Implementation phase runs three quality gates: lint, build, test with coverage; coverage parsed from Jest "All files" summary line; secrets scan gate checks for AWS credentials, API keys, private keys before review (finding: SKILL.md:160-199`)
- Review loop spawns fresh-context reviewer subagent that writes findings document (Critical/Important/Minor categories), then spawns fixer subagent that addresses MUST-FIX (Critical + Important) findings and commits locally; loop continues until clean (0 MUST-FIX) or max 3 rounds (hard cap 5 with user override) (finding: `review-loop.md:5-122`)
- Each review round gets a fresh reviewer with NO implementation memory; fixer commits are local-only until review loop exits cleanly (finding: `review-loop.md:156-165`)
- Commit & PR substep includes pre-stage validation for sensitive extensions (.env, .pem, .key), stages all changes, commits with issue reference, records HEAD SHA, pushes branch (standard push, never force), creates PR idempotently (finding: SKILL.md:223-262)
- Finalize story merges main into feature branch, re-runs tests, updates PR description with review summary, marks story done, presents second human checkpoint: continue/stop/pause/skip (finding: SKILL.md:264-322)
- Integration checkpoint runs after stories with dependents: checks shared file overlaps via `git diff --name-only` cross-referenced with dependent stories' `touches` fields, detects TypeScript interface/type changes in exports, re-runs full test suite; results classified as Green (auto-continue), Yellow (warnings, ask user), Red (failures, halt) (finding: `integration-checkpoint.md:11-156`)
- Phase 3 generates completion report with story summary table and metrics, updates epic file with timestamps and PR links, updates state file to done/paused, notifies user with all PR links for review (finding: SKILL.md:352-394)

**Research notes:** All phase steps verified from SKILL.md. Dependency analysis algorithm from dependency-analysis.md. State management from state-file.md. Review loop protocol from review-loop.md. Integration checkpoint logic from integration-checkpoint.md. No conflicts detected between sources.

**Progressive disclosure:** Skimmers learn the three-phase structure and six Phase 1 steps. Readers understand the complete story implementation loop with all seven substeps. Deep readers get the algorithmic details (topological sort, 7-case resume matrix, coverage parsing, review convergence protocol, integration checkpoint classification).

---

## Section: Safety Architecture

**Covers:** The reader understands the three-layer safety architecture (hook enforcement, workflow invariants, human checkpoints) and how they interact to prevent destructive operations.

**Word budget:** ~450 words

**Key points:**

- Three layers of safety: Layer 1 (deterministic hook enforcement at tool-call level), Layer 2 (workflow-level safety invariants in orchestrator control flow), Layer 3 (four strategic human checkpoints) (finding: existing draft lines 22-23)
- Hook enforcement operates at three lifecycle points: PreToolUse (blocks before action), PostToolUse (auto-corrects after action), Stop (validates quality gates at completion) (finding: hooks README lines 8-20)
- bash-guard.js implements tiered safety (critical/high/strict via CLAUDE_SAFETY_LEVEL env var) blocking 50+ patterns: critical level always blocks catastrophic commands (rm -rf /, fork bombs, mkfs), high level blocks destructive git ops and credential exposure, strict level blocks any force push; escalates 6 high-risk patterns for human approval (git push main, npm publish, cdk deploy, aws delete, rm -rf, terraform destroy) (finding: `bash-guard.js:16-285`)
- tdd-guard.js enforces test-first development by blocking implementation file writes unless failing tests exist in test.json; test file writes always allowed (finding: `tdd-guard.js:8-15`)
- architecture-guard.sh enforces ADR-007 (no Lambda-to-Lambda calls), ADR-006 (DynamoDB key patterns), ADR-014 (handlers use @ai-learning-hub/db) (finding: hooks README line 13)
- import-guard.sh denies Lambda/backend files using DynamoDB/Logger/Zod/middleware without @ai-learning-hub/\* shared library imports (finding: hooks README line 14)
- auto-format.sh (PostToolUse) runs Prettier + ESLint auto-fix asynchronously; type-check.sh (PostToolUse) runs tsc --noEmit and reports errors without blocking (finding: hooks README lines 18-19)
- Hooks are self-correcting: error messages explain violations and suggest correct approach; agent reads error and adjusts; repeated violations (>3 times) escalate to human (finding: existing draft lines 105-106 and SKILL.md error recovery sections)
- Nine workflow invariants enforced by orchestrator control flow (not configuration): never auto-merge PRs, never bypass hooks, never force push, never push to base branch, never skip tests, never silently ignore failures, idempotent operations, state persistence with atomic writes, human checkpoints at 4 milestones (finding: SKILL.md:12-24)
- Four human checkpoints provide strategic oversight: scope confirmation (Phase 1.4 - choose stories), per-story completion (Phase 2.6 - continue/stop/pause/skip), integration checkpoint (Phase 2.7 - validate dependents), epic completion (Phase 3 - review PRs) (finding: SKILL.md checkpoint sections)
- Error recovery follows three-tier escalation: auto-fix (max 2 attempts), self-correct (agent adjusts based on error message), escalate (present user with options) (finding: existing draft lines 189-197)

**Research notes:** Hook details from bash-guard.js source and hooks README. Safety invariants from SKILL.md. Checkpoint locations from SKILL.md phase structure. No gaps - all safety mechanisms are well-documented in source.

**Progressive disclosure:** Skimmers learn three safety layers exist. Readers understand hook types, workflow invariants, and checkpoint locations. Deep readers get specific patterns blocked by each hook, tiered safety levels, and escalation protocol details.

---

## Section: Subagent Orchestration

**Covers:** The reader understands how the orchestrator spawns and coordinates the epic-reviewer and epic-fixer subagents during the review loop, including fresh-context isolation and file-based communication.

**Word budget:** ~350 words

**Key points:**

- Review loop spawns two types of subagents via Task tool: epic-reviewer (fresh context, read-only analysis) and epic-fixer (implementation context, full edit capabilities) (finding: agent definitions)
- epic-reviewer receives context via Task tool prompt: story ID, branch name, base branch, story file path, review round number, output path for findings document (finding: `review-loop.md:16-34`)
- Reviewer executes three steps: diff branch against base using `git diff origin/{base}...{branch}`, read story file for acceptance criteria, write structured findings document with Critical/Important/Minor categories to specified output path (finding: `epic-reviewer.md:23-34`)
- Reviewer tool restrictions: has Write (for findings doc only), lacks Edit (prevents code modification), lacks Task (prevents agent chains) (finding: `epic-reviewer.md:4-5`)
- Fresh context isolation ensures genuinely adversarial review - reviewer has NO knowledge of implementation decisions or previous review rounds (finding: `review-loop.md:32-36` and `epic-reviewer.md:9`)
- Reviewer must check for hardcoded secrets: AWS account IDs (12-digit numbers), access keys (AKIA pattern), resource IDs (vpc-_, subnet-_, sg-_, etc.), API keys (sk*live*_, pk*live*\*, etc.), private key material, connection strings (mongodb://, postgres://, redis://) (finding: `epic-reviewer.md:71`)
- epic-fixer receives findings document path, story file path, branch name, round number via Task tool prompt (finding: `review-loop.md:125-145`)
- Fixer executes five steps: read findings document, address Critical findings first then Important then Minor if time permits, run `npm test` after each fix group, stage and commit with descriptive messages (`fix: address code review round {N} - {description}`), validate no secrets introduced before each commit (finding: `epic-fixer.md:23-50`)
- Fixer tool restrictions: has Edit (full code modification), lacks Task (prevents unbounded sub-subagents) (finding: `epic-fixer.md:4-5`)
- File-based communication pattern keeps agents decoupled: reviewer writes findings to disk, fixer reads from disk, orchestrator counts MUST-FIX findings by parsing file (finding: review-loop.md protocol)
- Fixer commits locally during review loop; no push until loop exits cleanly with 0 MUST-FIX findings (finding: `review-loop.md:153-165`)
- Each new review round spawns a fresh reviewer that sees current code state only, not previous rounds or fixer actions (finding: `review-loop.md:156-162`)

**Research notes:** All findings from agent definitions and review-loop.md. The fresh-context isolation is critical to the adversarial review design. Tool restrictions are explicitly defined in agent YAML frontmatter. Secrets checking requirements are identical for both agents.

**Progressive disclosure:** Skimmers learn two subagents exist (reviewer and fixer) with different capabilities. Readers understand spawning context, tool restrictions, and file-based communication. Deep readers get the complete multi-step protocol for each agent, secrets validation requirements, and fresh-context enforcement mechanism.

---

## Section: State Management and Resume

**Covers:** The reader understands how state is persisted, what the state file format is, how resume reconciles state with GitHub reality, and the dependency completion policy.

**Word budget:** ~400 words

**Key points:**

- State file location: `docs/progress/epic-{id}-auto-run.md` with YAML frontmatter (machine-readable, primary source of truth) and regenerated markdown table (human-readable, secondary display) (finding: `state-file.md:5-64`)
- Seven story statuses: pending, in-progress, review, done, blocked, paused, skipped; status transitions go through `updateStoryStatus()` which updates state file then syncs to GitHub issue labels (secondary) (finding: `state-file.md:11, 67-82`)
- State file is the primary source of truth for orchestration decisions; GitHub Issues/PRs and sprint-status.yaml are secondary synced views; conflicts favor state file with warning (finding: `state-file.md:67-82, 113-116`)
- Write protocol for best-effort atomicity: write to `.tmp` file using Write tool, rename to final path using Bash `mv` command; if interrupted, `.tmp` serves as recovery source (finding: `state-file.md:162-168`)
- Scope tracking: `scope` field records original `--stories` selection; resume restores this scope to prevent scope drift where resume unexpectedly expands to unselected stories (finding: `state-file.md:65-66`)
- Resume (`--resume` flag) reconciles state file with GitHub using 7-case matrix: (1) done + PR merged → skip, (2) done + PR closed → keep done, (3) in-progress + PR exists → resume from post-commit, (4) in-progress + branch deleted → mark blocked, (5) in-progress + no PR/branch → reset to pending, (6) pending + PR exists → treat as review, (7) pending + branch exists → resume from implementation (finding: `state-file.md:118-136`)
- Dependency completion policy varies by story type: stories WITH dependents require PR merged OR commit reachable from base branch verified via `git merge-base --is-ancestor ${commitSha} origin/${baseBranch}`; leaf stories (NO dependents) only require PR open with tests passing (finding: `state-file.md:139-157`)
- Rationale for policy: downstream stories need code on base branch to build correctly; leaf stories have no downstream impact so safe to mark complete before merge (finding: `state-file.md:149-150, 154-155`)
- Commit SHA tracking: record HEAD SHA after each story using `git rev-parse HEAD`, stored in `stateFile.stories[story.id].commit`, used for dependency verification and review scope (finding: `state-file.md:172-183`)
- Override flag `--no-require-merged` disables strict checking, allowing state file to win for all stories regardless of merge status (finding: `state-file.md:158` and SKILL.md:462-463)

**Research notes:** All findings from state-file.md. The 7-case resume matrix is exhaustively documented. Dependency completion policy differentiates between stories with/without dependents, which connects to the integration checkpoint logic. No gaps.

**Progressive disclosure:** Skimmers learn state is persisted in YAML frontmatter. Readers understand the seven statuses, resume reconciliation, and dependency policy. Deep readers get the complete 7-case matrix, write-then-rename atomicity protocol, commit SHA tracking mechanism, and policy rationale.

---

## Section: Integration with BMAD Method

**Covers:** The reader understands how Auto Epic fits into the broader BMAD workflow, what artifacts it consumes upstream, and what artifacts it produces downstream.

**Word budget:** ~250 words

**Key points:**

- Auto Epic sits within the BMAD (Build, Measure, Analyze, Deploy) method framework as the autonomous implementation engine (finding: existing draft line 262)
- Consumes upstream artifacts from `/bmad-bmm-create-epics-and-stories`: epic files at `_bmad-output/planning-artifacts/epics/epic-{id}.md` containing epic title, description, and story references (finding: SKILL.md:32-36)
- Consumes story files from `_bmad-output/implementation-artifacts/stories/{story_id}.md` with YAML frontmatter fields: id, title, depends_on, touches, risk (finding: SKILL.md:40-44 and `dependency-analysis.md:8-29`)
- Consumes PRD and Architecture docs from `/bmad-bmm-create-prd` and `/bmad-bmm-create-architecture` to inform ADRs that hooks enforce (finding: existing draft lines 265-266)
- Produces downstream artifacts for human review and subsequent BMAD phases: open PRs with full context (story summary, issue link, epic reference, test results, coverage, checklist), completion reports at `docs/progress/epic-{id}-completion-report.md` with metrics (average story time, test pass rate, review convergence, common issue categories), state files for progress tracking and sprint status updates (finding: SKILL.md:356-394 and existing draft lines 268-273)
- Completion report template includes story summary table (status, PR, coverage, review rounds, duration), metrics section, blockers list, and next steps checklist (finding: SKILL.md:356-388)
- Sprint status synced via `/bmad-bmm-sprint-status` as secondary status view (finding: existing draft line 267)
- Artifact flow enables end-to-end traceability: PRD → Epics → Stories → Implementation → PRs → Retrospective (finding: inferred from BMAD system integration)

**Research notes:** Findings from SKILL.md epic/story loading sections, existing draft, and completion report template. The BMAD integration points are well-documented. The artifact flow traceability is inferred from the explicit upstream/downstream relationships.

**Progressive disclosure:** Skimmers learn Auto Epic is part of BMAD and consumes epics/stories. Readers understand the complete input/output artifact set. Deep readers get the completion report template structure and traceability flow.

---

## Section: Quick Reference

**Covers:** The reader has immediate access to command syntax, file locations, safety invariants list, human checkpoint summary, and common flags.

**Word budget:** ~300 words

**Key points:**

- Command syntax examples: `/bmad-bmm-auto-epic Epic-1` (all stories), `/bmad-bmm-auto-epic Epic-1 --stories=1.1,1.2,1.5` (specific stories), `/bmad-bmm-auto-epic Epic-1 --resume` (resume previous run), `/bmad-bmm-auto-epic Epic-1 --dry-run` (simulate without GitHub) (finding: command file lines 10-17)
- File locations table: command at `.claude/commands/bmad-bmm-auto-epic.md`, orchestrator at `.claude/skills/epic-orchestrator/SKILL.md`, supporting modules at `.claude/skills/epic-orchestrator/*.md`, reviewer agent at `.claude/agents/epic-reviewer.md`, fixer agent at `.claude/agents/epic-fixer.md`, hooks at `.claude/hooks/*.{js,sh}`, state files at `docs/progress/epic-{id}-auto-run.md`, review findings at `docs/progress/story-{id}-review-findings-round-{N}.md`, completion reports at `docs/progress/epic-{id}-completion-report.md` (finding: existing draft lines 290-301)
- Nine safety invariants list: never auto-merge PRs, never bypass hooks, never force push, never push to base branch, never skip tests, never silently ignore failures, idempotent operations, state persistence with atomic writes, human checkpoints at 4 workflow milestones (finding: SKILL.md:12-24 and existing draft lines 304-313)
- Four human checkpoints table: scope confirmation (Phase 1.4, decision: all stories / select specific / cancel), per-story completion (Phase 2.6, decision: continue / stop / pause / skip), integration checkpoint (Phase 2.7, decision: continue / stop / pause / review dependent), epic completion (Phase 3, action: review PRs and investigate blockers) (finding: existing draft lines 316-322)
- Common flags: `--stories` for subset selection with dependency validation, `--resume` for state file reconciliation, `--dry-run` for simulation mode with DryRunStoryRunner, `--epic-path` for custom epic file location override, `--no-require-merged` for relaxed dependency checking (finding: command file and SKILL.md flags sections)

**Research notes:** All reference material pulled from existing draft and source files. This section is pure reference - no narrative prose. Designed for quick lookup during active use.

**Progressive disclosure:** This is a terminal section with no deeper layers - it's already at maximum density for quick reference. All readers get the same flat information regardless of reading depth.

---

## Length Budget

| Section                      | Budget     |
| ---------------------------- | ---------- |
| Overview                     | ~350       |
| Architecture Layers          | ~500       |
| Command Flow and Phases      | ~800       |
| Safety Architecture          | ~450       |
| Subagent Orchestration       | ~350       |
| State Management and Resume  | ~400       |
| Integration with BMAD Method | ~250       |
| Quick Reference              | ~300       |
| **Total**                    | **~3,400** |

**Target (from 00-request.md):** 2,400+ words
**Budget variance:** +42% over target

**Length tension note:** The scope defined in `00-request.md` requires coverage of four major areas (overview, architecture layers, system flow, component deep-dives) with progressive depth. The current outline allocates 3,400 words to eight sections. The "Command Flow and Phases" section alone requires 800 words to cover Phase 1 (6 steps), Phase 2 (7 substeps), and Phase 3 (4 outputs) with sufficient detail for readers to trace execution.

Options to address the variance:

1. **Consolidate sections:** Merge "Safety Architecture" into "Architecture Layers" (Layer 3 deep-dive), reducing overhead
2. **Reduce depth in Command Flow:** Cover Phase 1 and Phase 2 substeps at higher level, move algorithmic details (topological sort, 7-case matrix) to callouts rather than inline prose
3. **Split document:** Extract "Command Flow and Phases" plus "State Management and Resume" into a separate "How Auto Epic Executes" companion doc, keeping this doc focused on architecture
4. **Accept overage:** The existing draft at 3,044 words already exceeds target by 27%; this outline targets 3,400 words (+42%), which may be acceptable given complexity

**Recommendation:** Option 2 (reduce Command Flow depth) combined with selective pruning in other sections can bring total to ~2,600-2,800 words (8-17% over target), which is within the 20% tolerance specified in the style guide while maintaining comprehensive coverage.

---

## Diagram Suggestions

### Diagram 1: System Architecture (High-Level Components)

**Concept:** Illustrate the four architectural layers and their communication boundaries.

**Type:** Block diagram (Mermaid flowchart with subgraphs)

**Components:**

- Command Entry Point block (bmad-bmm-auto-epic.md)
- Orchestrator Skill block containing six module boxes (SKILL.md, dependency-analysis.md, state-file.md, story-runner.md, review-loop.md, integration-checkpoint.md)
- Hook System block containing eight hook boxes (bash-guard, file-guard, tdd-guard, architecture-guard, import-guard, auto-format, type-check, Stop)
- Subagents block containing two agent boxes (epic-reviewer, epic-fixer)

**Relationships:**

- Command → Orchestrator: "delegates to" (one-way arrow)
- Orchestrator → Modules: "loads on-demand" (dashed arrows to each module)
- Orchestrator → Hooks: "enforced by" (bidirectional, hooks intercept tool calls)
- Orchestrator → Subagents: "spawns via Task tool" (one-way arrows)
- Hooks → Subagents: "enforced by" (hooks also intercept subagent tool calls)

**Context:** Appears immediately after the "Architecture Layers" section opener, before the Layer 1 description.

**Why a diagram helps:** The spatial relationship between layers is difficult to convey in prose alone. A block diagram shows that hooks form a wrapper around both orchestrator and subagents, while modules are peer components within the orchestrator layer. This "enforced by" vs. "loads" vs. "spawns" distinction is clearer visually.

### Diagram 2: Command Flow Sequence (Phase 1 → Phase 2 → Phase 3)

**Concept:** Show the complete execution sequence from command invocation through epic completion, including decision points and human checkpoints.

**Type:** Sequence diagram (Mermaid sequenceDiagram)

**Components (participants):**

- User
- Command
- Orchestrator
- StoryRunner
- Subagents (epic-reviewer, epic-fixer)
- Hooks
- GitHub

**Relationships (sequence flow):**

- User → Command: invoke `/bmad-bmm-auto-epic Epic-1`
- Command → Orchestrator: delegate with args
- Orchestrator → Orchestrator: Phase 1.1-1.3 (load epic, load stories, dependency analysis)
- Orchestrator → User: [Checkpoint 1] scope confirmation
- User → Orchestrator: confirm
- Orchestrator → StoryRunner: initialize (detect GitHubCLI vs. DryRun)
- Orchestrator → Orchestrator: Phase 1.6 create state file
- Loop for each story:
  - Orchestrator → StoryRunner: getOrCreateIssue
  - StoryRunner → GitHub: `gh issue create` (if not exists)
  - Orchestrator → StoryRunner: getOrCreateBranch
  - StoryRunner → GitHub: `git checkout -b` from origin/main
  - Orchestrator → Hooks: implementation phase (tool calls intercepted)
  - Hooks → Orchestrator: enforce or block
  - Orchestrator → Subagents: spawn epic-reviewer
  - Subagents → Orchestrator: findings document written
  - Orchestrator → Subagents: spawn epic-fixer (if MUST-FIX > 0)
  - Orchestrator → StoryRunner: createPR
  - StoryRunner → GitHub: `gh pr create`
  - Orchestrator → User: [Checkpoint 2] per-story completion
  - User → Orchestrator: continue
  - alt story has dependents:
    - Orchestrator → Orchestrator: integration checkpoint
    - Orchestrator → User: [Checkpoint 3] integration results
  - User → Orchestrator: continue
- Orchestrator → Orchestrator: Phase 3 generate completion report
- Orchestrator → User: [Checkpoint 4] epic complete, review PRs

**Context:** Appears at the start of the "Command Flow and Phases" section to provide a visual anchor for the detailed phase descriptions that follow.

**Why a diagram helps:** The sequence diagram shows temporal ordering, branching (alt blocks for stories with dependents), loops (per-story iteration), and the interaction pattern between components. Prose descriptions of "then this happens, then if condition X then that happens" are hard to follow; sequence diagrams make the branching logic and participant interactions immediately clear.

### Diagram 3: Hook Lifecycle (PreToolUse → Tool Execution → PostToolUse → Stop)

**Concept:** Illustrate when each hook fires during a single tool call (e.g., Write operation) and during agent completion.

**Type:** Flowchart (Mermaid flowchart with decision diamonds)

**Components (nodes):**

- Start: "Agent attempts tool call (Edit/Write/Bash)"
- Decision: "PreToolUse hooks check"
- Action: "bash-guard.js checks command patterns"
- Action: "file-guard.js checks file path"
- Action: "tdd-guard.js checks test existence"
- Action: "architecture-guard.sh checks ADR violations"
- Action: "import-guard.sh checks shared lib usage"
- Decision: "Any hook blocks?"
- End (blocked): "Tool call denied, error message returned"
- Action: "Tool executes (Edit/Write/Bash)"
- Action: "PostToolUse hooks run"
- Action: "auto-format.sh runs Prettier + ESLint"
- Action: "type-check.sh runs tsc --noEmit"
- End (success): "Tool call complete"
- Separate branch: "Agent attempts completion"
- Action: "Stop hook validates quality gates"
- Action: "Run npm test, npm run lint, npm run build"
- Decision: "All gates pass?"
- End (blocked): "Completion denied, fix required"
- End (success): "Agent task complete"

**Relationships (edges):**

- Tool call → PreToolUse hooks (multiple parallel checks)
- Any block → denied
- All allow → tool executes
- Tool executes → PostToolUse hooks (sequential)
- PostToolUse complete → success
- Completion attempt → Stop hook
- Stop hook fail → denied
- Stop hook pass → complete

**Context:** Appears in the "Safety Architecture" section after describing the three hook lifecycle points, before the individual hook details.

**Why a diagram helps:** The parallel execution of PreToolUse hooks vs. sequential PostToolUse hooks vs. separate Stop hook is difficult to convey in prose. The flowchart shows that PreToolUse is a gate (any deny blocks), PostToolUse is a pipeline (both run), and Stop is a separate validation point at agent completion, not per tool call.

### Diagram 4: Review Loop Protocol (Reviewer → Fixer → Reviewer cycles)

**Concept:** Show the multi-round code review loop with fresh-context reviewer spawning, fixer addressing findings, and exit conditions.

**Type:** State diagram (Mermaid stateDiagram)

**Components (states):**

- Start: "Implementation complete (uncommitted local changes)"
- State: "Spawn epic-reviewer (fresh context, round N)"
- State: "Reviewer writes findings document"
- State: "Orchestrator counts MUST-FIX (Critical + Important)"
- Decision state: "MUST-FIX = 0?"
- End state: "Exit loop → commit & PR"
- Decision state: "Round < 3?"
- State: "Spawn epic-fixer"
- State: "Fixer addresses Critical and Important findings"
- State: "Fixer commits fixes locally"
- State: "Increment round N"
- Loop back to "Spawn epic-reviewer"
- Decision state: "Round = 3 and MUST-FIX > 0"
- End state: "Escalate to human (manual fix / accept / override)"

**Relationships (transitions):**

- Implementation complete → spawn reviewer round 1
- Reviewer → findings document → count MUST-FIX
- MUST-FIX = 0 → exit loop
- MUST-FIX > 0 AND round < 3 → spawn fixer
- Fixer fixes → increment round → spawn new reviewer (fresh context)
- Round = 3 AND MUST-FIX > 0 → escalate

**Context:** Appears in the "Subagent Orchestration" section when describing the review loop protocol, after explaining the reviewer and fixer roles.

**Why a diagram helps:** The state machine makes the loop termination conditions and fresh-context respawning explicit. Prose descriptions of "if clean exit, else if round < 3 continue, else escalate" are harder to parse than a visual state diagram with labeled transitions. The diagram also emphasizes that each reviewer is a NEW spawn (fresh context), not a resumed conversation.

### Diagram 5: State File Resume Reconciliation (7-Case Matrix)

**Concept:** Show how resume reconciles state file status with GitHub reality for each of the seven cases.

**Type:** Decision tree (Mermaid flowchart with decision diamonds)

**Components (nodes):**

- Start: "Load state file, read story status and GitHub state"
- Decision: "State file status = done?"
  - Yes → Decision: "PR merged?"
    - Yes → End: "Skip story (already complete)"
    - No → End: "Keep done (state file wins)"
- Decision: "State file status = in-progress?"
  - Yes → Decision: "PR exists?"
    - Yes → End: "Resume from post-commit (finalization)"
    - No → Decision: "Branch exists?"
      - Yes → End: "Resume from implementation"
      - No → End: "Reset to pending (no recoverable state)"
- Decision: "State file status = pending?"
  - Yes → Decision: "PR exists?"
    - Yes → End: "Treat as review (manual PR creation)"
    - No → Decision: "Branch exists?"
      - Yes → End: "Check out branch, resume from implementation"
      - No → End: "Start from beginning"

**Relationships (edges):**

- Load state → check status (multiple decision branches)
- Each case → specific action/outcome

**Context:** Appears in the "State Management and Resume" section after describing the state file format, before the dependency completion policy.

**Why a diagram helps:** The 7-case matrix is inherently a decision tree with nested conditionals. Prose descriptions of "if done and PR merged then skip, else if done and PR not merged then keep done, else if in-progress and..." quickly become unreadable. The decision tree shows the branching logic spatially, making it clear that there are three primary status branches, each with sub-branches based on GitHub reality.

### Diagram 6: Integration Checkpoint Validation Flow

**Concept:** Show the three validation checks performed at integration checkpoints and the result classification (Green/Yellow/Red).

**Type:** Flowchart (Mermaid flowchart)

**Components (nodes):**

- Start: "Story with dependents marked done"
- Action: "Check 1: Shared file overlap detection"
- Action: "git diff --name-only origin/{base}...{branch}"
- Action: "Cross-reference with dependent stories' touches fields"
- Decision: "Any overlaps?"
- Action: "Check 2: Interface/type change detection"
- Action: "git diff for .ts/.d.ts files, scan for export changes"
- Decision: "Type changes in shared files?"
- Action: "Check 3: Acceptance criteria validation"
- Action: "npm test (full suite)"
- Decision: "Tests pass?"
- Decision: "Classify results"
- End: "Green: no issues, auto-continue"
- End: "Yellow: warnings (overlaps or type changes), ask user"
- End: "Red: test failures, halt automatic progression"

**Relationships (edges):**

- Story done → Check 1 → Check 2 → Check 3 → Classify
- Green/Yellow/Red outcomes based on combination of check results

**Context:** Appears in the "Command Flow and Phases" section when describing Phase 2.7 integration checkpoint, or in a dedicated integration checkpoint subsection if created.

**Why a diagram helps:** The three-check sequence and the classification logic (Green if all clean, Yellow if warnings, Red if failures) is clearer as a flowchart than as nested prose conditionals. The diagram shows that checks run sequentially but results are classified together at the end, not after each individual check.

---

**Total diagrams:** 6

**Coverage:** System Architecture (overview of layers), Command Flow Sequence (complete execution path), Hook Lifecycle (safety enforcement), Review Loop Protocol (subagent orchestration), State File Resume (state management), Integration Checkpoint (dependency validation). This meets the 4-6 diagram requirement and supports the narrative across all major sections.
