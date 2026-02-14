# Outline

## Section: Overview — What Auto Epic does and why it exists

**Covers:** High-level explanation of the Auto Epic workflow's purpose and the problem it solves.

**Key points:**

- Auto Epic autonomously implements all stories in an epic with dependency awareness
- Designed for multi-story feature development where order matters
- Combines AI-driven implementation with strategic human checkpoints
- Uses multi-agent code review loops to ensure quality before human review
- Source: `.claude/commands/bmad-bmm-auto-epic.md`, `.claude/skills/epic-orchestrator/SKILL.md` lines 6-10

**Research notes:** The command description states "Autonomous epic implementation with dependency analysis, code review loops, and human checkpoints." The orchestrator enforces 9 safety invariants including never auto-merging PRs, never bypassing hooks, and requiring human approval at 4 checkpoint types.

**Progressive disclosure:**

- Heading + first sentence: Auto Epic is an autonomous workflow that implements multiple stories
- Full section: Understanding of the balance between autonomy (AI handles implementation + review cycles) and control (human approves scope, each story, integration points, and final completion)

---

## Section: Architecture layers — How components fit together

**Covers:** The four-layer architecture from command entry to subagent execution.

**Key points:**

- Layer 1: Command entry point (`.claude/commands/bmad-bmm-auto-epic.md`) — thin wrapper that parses args and delegates
- Layer 2: Orchestrator skill (`.claude/skills/epic-orchestrator/SKILL.md`) — three-phase coordinator
- Layer 3: Supporting modules — loaded on-demand for specific phases (dependency-analysis, state-file, story-runner, review-loop, integration-checkpoint)
- Layer 4: Subagents and same-context skills — epic-reviewer, epic-fixer spawn as isolated subagents (fresh contexts via Task tool); dev-story invokes as a skill (same context via Skill tool)
- GitHub operations (issues, branches, PRs) are isolated behind an interface for idempotent resume behavior
- Source: `.claude/commands/bmad-bmm-auto-epic.md` lines 34-47, research findings on module structure and agent architecture

**Research notes:** The architecture uses a delegation pattern. The command file doesn't contain orchestration logic — it reads SKILL.md and follows instructions. The orchestrator loads supporting modules lazily as it enters each phase. Subagents spawn via Task tool with isolated contexts; dev-story invokes via Skill tool in same context.

**Progressive disclosure:**

- High-level: Four architectural layers with clear separation between coordination and execution
- Detail: Understanding of why context isolation matters (reviewer must not have implementation bias), why modules are separate (on-demand loading), and the delegation pattern benefits

**Diagram planning:**

- **Type:** Block diagram (mermaid)
- **Shows:** Four layers as horizontal bands with component boxes inside each layer
- **Components:** Command entry, Orchestrator skill, 5 supporting modules, 3 agents/skills
- **Key relationships:** Arrows showing delegation flow (Layer 1 → Layer 2), on-demand loading (Layer 2 → Layer 3 modules), and spawning patterns (Layer 2 → Layer 4 agents)
- **Placement:** After the key points list, before research notes
- **Purpose:** Reader sees the architectural boundaries and understands which components coordinate vs execute

---

## Section: Three-phase workflow — Planning, implementation loop, and completion

**Covers:** The orchestrator's three distinct phases and what happens in each.

**Key points:**

- Phase 1 (Planning & Scope): Load epic/stories, build dependency graph, topological sort, human scope confirmation, initialize runner and state file
- Phase 2 (Story Implementation Loop): For each story in order — check deps, implement via dev-story, review loop with subagents, commit/PR, integration checkpoint (if story has dependents), human checkpoint with integration results (if any), continue or pause based on user input
- Phase 3 (Completion & Reporting): Generate epic report, update epic file, finalize state, notify user with PR list
- Source: `.claude/skills/epic-orchestrator/SKILL.md` lines 28-395

**Research notes:** Each phase has specific steps numbered (1.1-1.6, 2.1-2.7, 3.1-3.4). Phase 2 is a loop that repeats for each story in topological order. Phase 1 and 3 run once per epic. Integration checkpoint results fold into Phase 2.6 human checkpoint prompt.

**Progressive disclosure:**

- Heading + first sentence provide: Three phases — plan the work, execute stories in a loop, report results
- Full section provides: Detailed step breakdown showing where dependencies are checked, where humans intervene, where quality gates run, and how integration checkpoints connect to human approval gates

**Diagram planning:**

- **Type:** Sequence diagram (mermaid)
- **Shows:** Linear flow through Phase 1 → Phase 2 (loop boundary) → Phase 3 with key steps in each phase
- **Participants:** User, Orchestrator, State File, dev-story skill, epic-reviewer subagent
- **Key interactions:** User approval gates, subagent spawning, state persistence points
- **Placement:** After Phase 3 description, before progressive disclosure
- **Purpose:** Reader sees the temporal flow and understands when the loop runs vs single-execution phases

---

## Section: Dependency analysis — Graph building, cycle detection, topological sort

**Covers:** How the orchestrator determines story execution order.

**Key points:**

- Stories declare dependencies in YAML frontmatter `depends_on: [story-ids]`
- Orchestrator builds adjacency list (forward graph) and computes dependents (inverse graph)
- Cycle detection runs before execution (fatal error if cycles found)
- Topological sort (Kahn's algorithm) produces safe execution order
- Stories with dependents get marked for integration checkpoints
- Source: `.claude/skills/epic-orchestrator/dependency-analysis.md` lines 60-132

**Research notes:** The dependency graph serves three purposes: (1) execution ordering via toposort, (2) integration checkpoint identification via dependents list, (3) skip impact analysis when user skips a story. The inverse graph (dependents) is computed separately and stored in `story.dependents` array.

**Progressive disclosure:**

- Overview: Dependencies come from YAML, cycles are fatal, stories run in sorted order
- Deeper understanding: Algorithm details (Kahn's), inverse graph computation, validation for --stories flag

**Diagram planning (optional):**

- **Type:** Flowchart or graph diagram (mermaid)
- **Shows:** Sample story nodes with dependency edges, before and after topological sort
- **Components:** 4-5 story nodes, directed edges labeled "depends_on", topologically sorted linear sequence
- **Placement:** After algorithm description
- **Purpose:** Visual demonstration of how Kahn's algorithm transforms a DAG into execution order

---

## Section: Multi-agent code review loop — Fresh context review and guided fixes

**Covers:** How the epic-reviewer and epic-fixer subagents coordinate to achieve code quality.

**Key points:**

- Review loop runs up to 3 rounds (hard cap 5 with override)
- Each round: spawn reviewer (fresh context) → write findings doc → orchestrator counts MUST-FIX → spawn fixer if needed → local commits → loop
- Reviewer has read-only tools, NO implementation history (adversarial review)
- Fixer has edit tools, reads findings, applies fixes with local git commits
- Exit condition: MUST-FIX count reaches zero OR max rounds exceeded (escalate to human)
- Source: `.claude/skills/epic-orchestrator/review-loop.md` lines 6-176

**Research notes:** Context isolation is critical. Each reviewer round gets a fresh context with no knowledge of previous rounds or original implementation. The reviewer diffs local branch (which includes fixer commits) against base branch. No push happens during the loop — commits stay local until loop exits cleanly.

**Progressive disclosure:**

- First pass: Automated review-fix loop with max 3 attempts before human escalation
- Full understanding: Why fresh context matters, how MUST-FIX count drives decisions, local-only git workflow during loop, findings document structure

**Diagram planning:**

- **Type:** Sequence diagram (mermaid)
- **Shows:** One complete review loop iteration with conditional branching
- **Participants:** Orchestrator, epic-reviewer (spawned), epic-fixer (spawned), Local Git, Findings Doc
- **Key interactions:** Task tool spawning, file writes to findings doc, git commits, MUST-FIX count check, loop decision
- **Placement:** After the key points list
- **Purpose:** Reader sees the agent interaction pattern and understands the loop termination logic

---

## Section: Integration checkpoints — Validating dependent stories

**Covers:** How the orchestrator detects when upstream changes may affect downstream stories.

**Key points:**

- Runs only for stories with dependents (after story completion, before final human prompt)
- Three validation checks: (1) file overlap detection, (2) type/interface change analysis, (3) test re-run
- Results classified as Green (all clear), Yellow (warnings), Red (tests failing)
- Green/Yellow: show results, fold into Phase 2.6 human checkpoint prompt
- Red: escalate to user, do NOT auto-continue
- Source: `.claude/skills/epic-orchestrator/integration-checkpoint.md` lines 5-156

**Research notes:** Source of truth is `git diff` (actual files changed), NOT the `touches` field (advisory). Type change detection uses regex to match exported types/interfaces in .ts/.d.ts files. Checkpoint runs AFTER sync-with-main to ensure tests run against latest base branch code.

**Progressive disclosure:**

- Overview: Automated validation catches conflicts before dependent stories start
- Details: Three check types, git diff analysis, Green/Yellow/Red classification, how results merge into human checkpoint

---

## Section: Hook system enforcement — Eight quality gates during implementation

**Covers:** How hooks enforce architectural constraints and quality standards.

**Key points:**

- Eight hooks active during Auto Epic workflow
- PreToolUse hooks: bash-guard (block catastrophic commands), file-guard (protect critical files), architecture-guard (enforce ADRs), import-guard (require shared libs), tdd-guard (tests before impl)
- PostToolUse hooks: auto-format (Prettier/ESLint), type-check (tsc validation)
- Stop hook: agent prompt to verify tests/lint/build before marking complete
- Source: `.claude/hooks/README.md`, `.claude/skills/epic-orchestrator/SKILL.md` lines 148-159

**Research notes:** Hooks are self-correcting — they teach the correct pattern via error messages. No user intervention needed unless >3 violations of same type. Hooks operate at three phases: PreToolUse (block/escalate before action), PostToolUse (auto-fix after action), Stop (verify before completion).

**Progressive disclosure:**

- Summary: Eight hooks enforce quality and architectural constraints automatically
- Full detail: Hook types by phase, self-correcting pattern, specific ADRs enforced, when user intervention triggers

**Diagram planning:**

- **Type:** Flowchart or timeline diagram (mermaid)
- **Shows:** Hook firing points during story implementation lifecycle
- **Components:** Implementation timeline with PreToolUse → Action → PostToolUse → Stop markers
- **Key relationships:** Which hooks fire at which phase, decision points (block/escalate vs auto-fix)
- **Placement:** After the three-phase breakdown (PreToolUse/PostToolUse/Stop)
- **Purpose:** Reader understands when each hook type activates during the workflow

---

## Section: State management and resume — YAML frontmatter as source of truth

**Covers:** How the orchestrator tracks progress and recovers from interruption.

**Key points:**

- State file at `docs/progress/epic-{id}-auto-run.md` uses YAML frontmatter (machine-readable) + markdown body (human display)
- Seven story statuses: pending, in-progress, review, done, blocked, paused, skipped
- --resume flag triggers 7-case reconciliation matrix (state file vs GitHub reality)
- State file is primary source of truth; GitHub is secondary
- Atomic writes: write to .tmp file, then `mv` to final path
- Source: `.claude/skills/epic-orchestrator/state-file.md` lines 5-183

**Research notes:** Resume semantics favor state file for control flow decisions. If state says "done" but PR is closed (not merged), state wins — the workflow assumes human closed PR intentionally. Different dependency completion policies based on whether dependency has its own dependents.

**Progressive disclosure:**

- Essential: State file tracks progress, --resume picks up where workflow stopped
- Comprehensive: 7-case reconciliation matrix, why state file wins, atomic write protocol, dependency completion policy differences

---

## Section: Safety invariants and human checkpoints — Balance between autonomy and control

**Covers:** The nine non-negotiable safety rules and four human approval gates.

**Key points:**

- Nine safety invariants: never auto-merge, never bypass hooks, never force push, never push to base branch, never skip tests, never silently ignore failures, idempotent ops, state persistence, human checkpoints
- Four checkpoint types: scope confirmation (Phase 1.4), per-story approval (Phase 2.6), integration checkpoints (Phase 2.7 for stories with dependents), completion review (Phase 3)
- Human can pause workflow at any checkpoint
- All PRs remain open for human review before merge
- Source: `.claude/skills/epic-orchestrator/SKILL.md` lines 14-24

**Research notes:** Safety invariants are non-negotiable — the orchestrator enforces ALL of them at all times. Human checkpoints provide four intervention points where user can pause, skip stories, or cancel workflow. The workflow never takes destructive actions (force push, auto-merge) that could lose work.

**Progressive disclosure:**

- Core understanding: Safety rules prevent destructive actions, humans approve at four strategic points
- Complete picture: Detailed invariant list, when each checkpoint runs, what options user has at each gate

---

## Section: Execution example — Story 1.1 through Story 1.4 with dependencies

**Covers:** Concrete walkthrough of a four-story epic execution showing dependency ordering, checkpoints, and review loop.

**Key points:**

- Example epic: Story 1.1 (no deps) → Story 1.2 (depends on 1.1) → Story 1.3 (depends on 1.1) → Story 1.4 (depends on 1.2 and 1.3)
- Phase 1: Load stories, build graph, toposort produces order [1.1, 1.2, 1.3, 1.4], mark 1.1/1.2/1.3 as checkpoint stories (have dependents)
- Phase 2, Story 1.1: Implement → review loop finds 2 MUST-FIX issues → epic-fixer applies corrections → second review finds 0 MUST-FIX → loop exits → PR created → integration checkpoint (2 dependents) → human approval
- Phase 2, Stories 1.2-1.4: Implement 1.2 → checkpoint (1 dependent) → implement 1.3 → checkpoint (1 dependent) → implement 1.4 (no checkpoint, leaf story) → final approval
- Phase 3: Generate report with 4 PRs, show metrics
- Source: `docs/auto-epic-diagram.md` dependency graph example lines 386-416

**Research notes:** The diagram document shows a concrete example with this exact structure. Story 1.1 triggers integration checkpoint because stories 1.2 and 1.3 depend on it. Story 1.4 is a leaf (no dependents) so no checkpoint runs after its completion. Including one review loop iteration demonstrates the multi-agent quality gate in action.

**Progressive disclosure:**

- Quick scan: Four-story example showing dependency order and checkpoints
- Complete walkthrough: Step-by-step trace through all three phases, where checkpoints fire, review loop mechanics, what user sees at each prompt

**Diagram planning:**

- **Type:** Dependency graph (mermaid flowchart)
- **Shows:** Four story nodes with dependency edges and execution order annotations
- **Components:** Story 1.1/1.2/1.3/1.4 as nodes, directed edges labeled "depends_on", execution order numbers [1-4], checkpoint markers on stories with dependents
- **Placement:** Before the Phase 2 detailed walkthrough
- **Purpose:** Concrete visualization of the dependency structure discussed throughout the document
