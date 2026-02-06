# /bmad-bmm-auto-epic — Workflow Diagram (v2)

This diagram reflects the decomposed skill-based architecture: thin command → orchestrator SKILL.md → supporting modules + subagents.

## Architecture Overview

```mermaid
graph LR
    subgraph "Entry Point"
        CMD["/bmad-bmm-auto-epic<br/>.claude/commands/bmad-bmm-auto-epic.md"]
    end

    subgraph "Orchestrator Skill"
        SKILL[".claude/skills/epic-orchestrator/SKILL.md"]
        DEP["dependency-analysis.md"]
        STATE["state-file.md"]
        RUNNER["story-runner.md"]
        INTEG["integration-checkpoint.md"]
        REVIEW["review-loop.md"]
    end

    subgraph "Subagents"
        REV["epic-reviewer<br/>(Read-only, fresh context)"]
        FIX["epic-fixer<br/>(Edit tools, guided by findings)"]
    end

    subgraph "Inline Skill"
        DEV["/bmad-bmm-dev-story<br/>(Skill tool, same context)"]
    end

    CMD -->|"reads & executes"| SKILL
    SKILL -->|"Phase 1.3"| DEP
    SKILL -->|"Phase 1.5"| RUNNER
    SKILL -->|"Phase 1.6"| STATE
    SKILL -->|"Phase 2.4"| REVIEW
    SKILL -->|"Phase 2.7"| INTEG
    SKILL -->|"Phase 2.2 (Skill tool)"| DEV
    REVIEW -->|"Task tool spawn"| REV
    REVIEW -->|"Task tool spawn"| FIX

    style CMD fill:#e1f5e1
    style SKILL fill:#fff4e1
    style REV fill:#e8f0ff
    style FIX fill:#ffe8f0
    style DEV fill:#f0e8ff
```

## Main Workflow (All 3 Phases)

```mermaid
flowchart TD
    Start(["/bmad-bmm-auto-epic Epic-N"]) --> ParseArgs["Parse args:<br/>epic_id, --stories, --resume,<br/>--dry-run, --epic-path,<br/>--no-require-merged"]

    %% ── Phase 1: Planning & Scope ──
    ParseArgs --> P1["<b>PHASE 1: Planning & Scope</b>"]
    P1 --> LoadEpic["1.1 Load Epic File<br/>_bmad-output/.../epics/epic-N.md"]
    LoadEpic --> LoadStories["1.2 Load Story Files + YAML frontmatter<br/>(id, title, depends_on, touches, risk)"]
    LoadStories --> DepAnalysis["1.3 Dependency Analysis<br/>(load dependency-analysis.md)"]

    DepAnalysis --> BuildGraph["Build adjacency list<br/>+ compute dependents (inverse graph)"]
    BuildGraph --> DetectCycles{Cycles?}
    DetectCycles -->|Yes| FatalError["❌ FATAL: Circular dependencies<br/>Stop execution"]
    DetectCycles -->|No| TopoSort["Topological sort (Kahn's)"]
    TopoSort --> MarkCP["Mark integration checkpoint stories<br/>(those with dependents)"]

    MarkCP --> StoriesFlag{"--stories<br/>flag?"}
    StoriesFlag -->|Yes| ValidateSelection["validateStorySelection<br/>check deps in-scope or done"]
    StoriesFlag -->|No| ScopeConfirm

    ValidateSelection --> DepWarnings{Missing<br/>deps?}
    DepWarnings -->|Yes| DepOptions["a) Add missing deps to scope<br/>b) Proceed anyway<br/>c) Cancel & re-select"]
    DepWarnings -->|No| ScopeConfirm
    DepOptions --> ScopeConfirm

    ScopeConfirm["1.4 Scope Confirmation<br/>[HUMAN CHECKPOINT]<br/>Show execution order + checkpoints"]
    ScopeConfirm --> UserConfirm{"User choice?"}
    UserConfirm -->|"(a) All stories"| InitRunner
    UserConfirm -->|"(b) Select specific"| ValidateSelection
    UserConfirm -->|"(c) Cancel"| End1([End: Cancelled])

    InitRunner["1.5 Init StoryRunner<br/>(load story-runner.md)"]
    InitRunner --> SelectRunner{"--dry-run?"}
    SelectRunner -->|Yes| DryRunner["DryRunStoryRunner<br/>(mock data, no API calls)"]
    SelectRunner -->|No| CheckGH{".github<br/>exists?"}
    CheckGH -->|Yes| GHRunner["GitHubCLIRunner<br/>(real gh + git)"]
    CheckGH -->|No| NoRunner["❌ Error: No tracking system"]

    DryRunner --> StateInit
    GHRunner --> StateInit

    StateInit["1.6 Create/Resume State File<br/>(load state-file.md)"]
    StateInit --> ResumeFlag{"--resume?"}
    ResumeFlag -->|Yes| LoadState["Load state file<br/>Reconcile 7-case matrix<br/>(state-file vs GitHub reality)"]
    ResumeFlag -->|No| NewState["Create state file at<br/>docs/progress/epic-N-auto-run.md<br/>All stories = pending"]

    LoadState --> StoryLoop
    NewState --> StoryLoop

    %% ── Phase 2: Story Implementation Loop ──
    StoryLoop{"<b>PHASE 2</b><br/>More stories<br/>in scope?"}
    StoryLoop -->|No| Phase3
    StoryLoop -->|Yes| PreImpl

    PreImpl["2.1 Pre-Implementation"]
    PreImpl --> FetchRemote["git fetch origin baseBranch"]
    FetchRemote --> CheckDeps["Check each dependency status<br/>in state file = 'done'"]
    CheckDeps --> MergeCheck{"Dep has<br/>dependents?"}
    MergeCheck -->|Yes| VerifyMerge["git merge-base --is-ancestor<br/>(verify code reached base branch)"]
    MergeCheck -->|No| DepMet["State file 'done' is sufficient"]
    VerifyMerge --> DepsOK
    DepMet --> DepsOK

    DepsOK{Deps met?}
    DepsOK -->|No| DepFail["❌ Dependency not met<br/>a) Skip (mark blocked)<br/>b) Pause workflow<br/>c) Override (proceed anyway)"]
    DepFail --> StoryLoop

    DepsOK -->|Yes| SetInProgress["updateStoryStatus → in-progress"]
    SetInProgress --> CreateResources["getOrCreateIssue (idempotent)<br/>getOrCreateBranch (idempotent)<br/>(via StoryRunner interface)"]

    CreateResources --> DryRunGate{"--dry-run?"}
    DryRunGate -->|Yes| DryRunSkip["[DRY-RUN] Log: would invoke dev-story<br/>coverage = null"]
    DryRunGate -->|No| Implement

    Implement["2.2 Implementation<br/>(Protected by Hooks)"]
    Implement --> InvokeDevStory["Invoke /bmad-bmm-dev-story<br/>via Skill tool (inline, same context)"]
    InvokeDevStory --> HooksActive["Hooks active:<br/>• tdd-guard (PreToolUse)<br/>• architecture-guard (PreToolUse)<br/>• import-guard (PreToolUse)<br/>• auto-format (PostToolUse)<br/>• type-check (PostToolUse)<br/>• stop-hook (agent)"]
    HooksActive --> QualityGate["Final Quality Gate:<br/>npm run lint<br/>npm run build<br/>npm test -- --coverage"]
    QualityGate --> TestResult{Tests pass?}
    TestResult -->|No| AutoFix["Auto-fix (max 2 attempts)<br/>→ re-run quality gate"]
    AutoFix --> TestResult2{Fixed?}
    TestResult2 -->|No| Escalate["Escalate to human:<br/>a) Auto-fix again<br/>b) Skip story<br/>c) Pause<br/>d) Debug output"]
    TestResult2 -->|Yes| ParseCoverage
    Escalate --> StoryLoop
    TestResult -->|Yes| ParseCoverage["Parse coverage %<br/>from test output"]

    ParseCoverage --> MarkReview["2.3 updateStoryStatus → review"]

    DryRunSkip --> MarkReview

    %% ── Review Loop ──
    MarkReview --> ReviewLoop["2.4 Code Review Loop<br/>(load review-loop.md)"]
    ReviewLoop --> ReviewSub[["Review Loop Subprocess<br/>(see detail diagram below)"]]
    ReviewSub --> ReviewResult{Loop exit<br/>reason?}
    ReviewResult -->|"Clean (0 MUST-FIX)"| CommitPR
    ReviewResult -->|"Max rounds exceeded"| HumanEscalate["Escalate to human:<br/>a) Manual fix (mark blocked)<br/>b) Accept anyway (mark done)<br/>c) +1 round (hard cap: 5)"]
    HumanEscalate -->|"blocked"| StoryLoop
    HumanEscalate -->|"accepted"| CommitPR
    HumanEscalate -->|"+1 round"| ReviewSub

    %% ── Commit & PR ──
    CommitPR["2.5 Commit & PR"]
    CommitPR --> StageCommit["git add -A<br/>git commit -m 'feat: story N.M ... #issue'<br/>git rev-parse HEAD (record SHA)"]
    StageCommit --> Push["git push -u origin branchName<br/>(standard push, never force)"]
    Push --> CreatePR["getOrCreatePR (idempotent)<br/>via StoryRunner"]
    CreatePR --> PRFail{PR created?}
    PRFail -->|No| PRManual["Show manual fallback command<br/>Mark blocked, ask continue/pause"]
    PRFail -->|Yes| Finalize

    %% ── Finalize ──
    Finalize["2.6 Finalize Story<br/>[HUMAN CHECKPOINT]"]
    Finalize --> SyncMain["Step 1: Sync with main<br/>git fetch + git merge origin/baseBranch"]
    SyncMain --> MergeResult{Merge<br/>result?}
    MergeResult -->|"Clean merge"| RerunTests["Re-run npm test"]
    MergeResult -->|"Conflict"| MergeAbort["git merge --abort<br/>Auto-resolve simple / escalate complex"]

    RerunTests --> PostMergeTests{Tests pass?}
    PostMergeTests -->|Yes| PushUpdated["Push updated branch"]
    PostMergeTests -->|No| MergeTestFail["❌ Regression from merge<br/>a) Auto-fix (max 2)<br/>b) Revert merge (reset --merge ORIG_HEAD)<br/>c) Skip story<br/>d) Debug"]

    PushUpdated --> UpdatePR["Step 2: Update PR description<br/>(review summary, rounds, findings)"]
    UpdatePR --> MarkDone["Step 3: updateStoryStatus → done<br/>Record final commit SHA"]

    MarkDone --> HasDependents{Story has<br/>dependents?}
    HasDependents -->|Yes| IntegCP["2.7 Integration Checkpoint<br/>(load integration-checkpoint.md)"]
    HasDependents -->|No| UserPromptSimple

    IntegCP --> IntegSub[["Integration Checkpoint<br/>(see detail diagram below)"]]
    IntegSub --> IntegResult{Result?}
    IntegResult -->|"Green"| UserPromptFull
    IntegResult -->|"Yellow"| UserPromptFull
    IntegResult -->|"Red"| RedEscalate["Escalate: tests failing<br/>Do NOT continue automatically"]

    UserPromptFull["Merged prompt:<br/>Continue to Story X.Z?<br/>(y / n / pause / skip / review-X.Y)"]
    UserPromptFull --> UserChoice

    UserPromptSimple["Continue to Story X.Z?<br/>(y / n / pause / skip)"]
    UserPromptSimple --> UserChoice

    UserChoice{User<br/>choice?}
    UserChoice -->|y| StoryLoop
    UserChoice -->|n| SaveStop["Save progress, epic → paused"]
    UserChoice -->|pause| SavePause["Epic status → paused<br/>(current story stays done)"]
    UserChoice -->|skip| SkipLogic["Skip NEXT story<br/>Check dependents of skipped story"]
    SkipLogic --> SkipDeps{Skipped story<br/>has dependents?}
    SkipDeps -->|No| StoryLoop
    SkipDeps -->|Yes| SkipOptions["a) Skip entire sub-tree<br/>b) Go back (revert skip)<br/>c) Remove dependents from scope"]
    SkipOptions --> StoryLoop

    SaveStop --> End2([End: Stopped])
    SavePause --> End3([End: Paused])

    %% ── Phase 3: Completion & Reporting ──
    Phase3["<b>PHASE 3: Completion</b>"]
    Phase3 --> GenReport["Generate epic completion report<br/>docs/progress/epic-N-completion-report.md"]
    GenReport --> UpdateEpic["Update epic file<br/>(timestamps, PR links)"]
    UpdateEpic --> UpdateState["Update state file<br/>status → done (or paused)"]
    UpdateState --> Notify["Notify user: summary,<br/>list all PRs for review,<br/>highlight blockers"]
    Notify --> End4([End: Complete])

    style Start fill:#e1f5e1
    style End1 fill:#ffe1e1
    style End2 fill:#fff4e1
    style End3 fill:#fff4e1
    style End4 fill:#e1f5e1
    style FatalError fill:#ffe1e1
    style NoRunner fill:#ffe1e1
    style P1 fill:#e1e5ff,stroke:#333,stroke-width:2px
    style StoryLoop fill:#fff4e1,stroke:#333,stroke-width:2px
    style Phase3 fill:#e1e5ff,stroke:#333,stroke-width:2px
    style ReviewSub fill:#e8f0ff,stroke:#4466cc,stroke-width:2px
    style IntegSub fill:#ffe8f0,stroke:#cc4466,stroke-width:2px
    style Implement fill:#f0e8ff
    style InvokeDevStory fill:#f0e8ff
    style ScopeConfirm fill:#ffd,stroke:#aa0,stroke-width:2px
    style Finalize fill:#ffd,stroke:#aa0,stroke-width:2px
```

## Multi-Agent Code Review Loop (Phase 2.4)

```mermaid
flowchart TD
    Enter([Enter Review Loop]) --> InitRound["round = 1, maxRounds = 3"]

    InitRound --> SpawnReviewer["<b>Step A: Spawn epic-reviewer</b><br/>Task tool, subagent_type: 'epic-reviewer'<br/>Fresh context, NO implementation history"]
    SpawnReviewer --> ReviewerWork["Reviewer diffs branch vs base<br/>(local branch ref, no push needed)<br/>Reads story file for AC compliance<br/>Writes findings doc"]
    ReviewerWork --> FindingsDoc["docs/progress/story-X.Y-review-<br/>findings-round-N.md"]

    FindingsDoc --> ReadFindings["<b>Step B: Orchestrator reads findings</b><br/>Count MUST-FIX = Critical + Important"]
    ReadFindings --> Decision{MUST-FIX<br/>count?}

    Decision -->|"0"| Clean["✅ Clean! Exit loop"]
    Clean --> ExitSuccess([Exit → Phase 2.5 Commit & PR])

    Decision -->|"> 0"| CheckRound{"round < maxRounds?"}

    CheckRound -->|Yes| SpawnFixer["<b>Step C: Spawn epic-fixer</b><br/>Task tool, subagent_type: 'epic-fixer'<br/>Has edit tools + findings context"]
    SpawnFixer --> FixerWork["Fix Critical → Important → Minor<br/>Run tests after each fix<br/>git add -A<br/>Commit locally (no push)"]
    FixerWork --> Increment["<b>Step D:</b> round++"]
    Increment --> SpawnReviewer

    CheckRound -->|No| MaxRounds["⚠️ Max rounds exceeded"]
    MaxRounds --> HumanChoice{"Human<br/>choice?"}
    HumanChoice -->|"a) Manual fix"| Blocked["Mark story blocked<br/>Pause workflow"]
    HumanChoice -->|"b) Accept anyway"| Accepted["Mark story done<br/>(user accepts risk)"]
    HumanChoice -->|"c) +1 round"| CheckHardCap{round < 5?}
    CheckHardCap -->|Yes| BumpMax["maxRounds++"]
    CheckHardCap -->|No| ForcedChoice["Option (c) unavailable<br/>Must choose (a) or (b)"]
    BumpMax --> SpawnReviewer

    Blocked --> ExitBlocked([Exit → blocked])
    Accepted --> ExitAccepted([Exit → Phase 2.5])

    style Enter fill:#e1e5ff
    style ExitSuccess fill:#e1f5e1
    style ExitBlocked fill:#ffe1e1
    style ExitAccepted fill:#fff4e1
    style Clean fill:#e1f5e1
    style MaxRounds fill:#ffe1e1
    style SpawnReviewer fill:#e8f0ff
    style SpawnFixer fill:#ffe8f0
    style FindingsDoc fill:#f5f5f5,stroke:#999
```

## Integration Checkpoint (Phase 2.7)

```mermaid
flowchart TD
    Enter(["Story with dependents<br/>completed & synced"]) --> EnsureBranch["git checkout branchName<br/>(ensure correct context)"]

    EnsureBranch --> GetDiff["Compute actual changed files<br/>git diff --name-only origin/base...branch"]

    GetDiff --> Check1["<b>Check 1: Shared File Changes</b><br/>Cross-ref actual changes with<br/>dependent stories' touches fields"]
    Check1 --> Overlap{File<br/>overlaps?}
    Overlap -->|Yes| WarnOverlap["⚠️ Warn: upstream changes to<br/>files touched by dependent stories"]
    Overlap -->|No| Check2

    WarnOverlap --> Surprise["Also detect unexpected changes<br/>(not predicted by touches field)"]
    Surprise --> Check2

    Check2["<b>Check 2: Interface/Type Changes</b><br/>git diff on *.ts, *.d.ts<br/>Match export type|interface|enum|const"]
    Check2 --> TypeChanges{Exported types<br/>modified?}
    TypeChanges -->|Yes| WarnTypes["⚠️ Warn: type changes in<br/>files shared with dependents"]
    TypeChanges -->|No| Check3

    WarnTypes --> Check3

    Check3["<b>Check 3: Acceptance Criteria</b><br/>npm test (full suite)"]
    Check3 --> TestResult{Tests pass?}

    TestResult -->|No| Red["🔴 RED: Tests failing<br/>Escalate — do NOT auto-continue"]
    TestResult -->|Yes| Classify

    Classify{Any<br/>warnings?}
    Classify -->|No| Green["🟢 GREEN: All clear"]
    Classify -->|Yes| Yellow["🟡 YELLOW: Warnings present"]

    Green --> MergedPrompt
    Yellow --> MergedPrompt
    Red --> EscalateHuman["Escalate to user"]

    MergedPrompt["Fold results into Phase 2.6 prompt:<br/>Continue? (y / n / pause / review-X.Y)"]

    style Enter fill:#ffe8f0
    style Green fill:#e1f5e1
    style Yellow fill:#fff4e1
    style Red fill:#ffe1e1
    style MergedPrompt fill:#ffd,stroke:#aa0
```

## Agent Spawning & Context Isolation

```mermaid
graph TD
    subgraph "Orchestrator (main context)"
        ORC["Epic Orchestrator<br/>SKILL.md — full epic context<br/>Coordinates all phases"]
    end

    subgraph "Inline Skill (same context)"
        DEV["/bmad-bmm-dev-story<br/>Invoked via Skill tool<br/>Shares orchestrator context<br/>Has all hooks active"]
    end

    subgraph "Review Round N (fresh context each)"
        REVN["epic-reviewer subagent<br/>Tools: Read, Glob, Grep, Bash, Write<br/>Disallowed: Edit, Task<br/>NO implementation history"]
    end

    subgraph "Fix Round N (implementation context)"
        FIXN["epic-fixer subagent<br/>Tools: Read, Glob, Grep, Bash, Write, Edit<br/>Disallowed: Task<br/>Guided by findings doc"]
    end

    ORC -->|"Skill tool (inline)"| DEV
    DEV -->|"returns control"| ORC
    ORC -->|"Task tool spawn<br/>(fresh context)"| REVN
    REVN -->|"writes findings doc"| ORC
    ORC -->|"Task tool spawn"| FIXN
    FIXN -->|"commits locally"| ORC

    style ORC fill:#e1f5e1,stroke:#333,stroke-width:2px
    style DEV fill:#f0e8ff
    style REVN fill:#e8f0ff
    style FIXN fill:#ffe8f0
```

## State Transitions

```mermaid
stateDiagram-v2
    [*] --> pending: Story initialized

    pending --> in_progress: Phase 2.1 (resources created)
    in_progress --> review: Phase 2.3 (quality gate passed)
    review --> review: Review rounds (max 3, hard cap 5)
    review --> done: Clean review (0 MUST-FIX)
    review --> blocked: Max rounds exceeded + human chose (a)
    in_progress --> blocked: Deps not met / tests failed
    in_progress --> skipped: User skipped

    blocked --> pending: Resume retry
    blocked --> done: Human accepted with issues
    blocked --> skipped: User skipped on resume

    pending --> skipped: User skipped / sub-tree skip

    done --> [*]
    skipped --> [*]

    state "Epic-level" as epic {
        [*] --> ep_in_progress: Run started
        ep_in_progress --> ep_paused: User paused
        ep_paused --> ep_in_progress: --resume
        ep_in_progress --> ep_done: All stories complete
    }
```

## Dependency Graph & Execution Order Example

```mermaid
graph TD
    S11["Story 1.1<br/>User Registration<br/>depends_on: []<br/>🔲 Integration Checkpoint"]
    S12["Story 1.2<br/>Save Project<br/>depends_on: [1.1]<br/>🔲 Integration Checkpoint"]
    S13["Story 1.3<br/>Validation Logic<br/>depends_on: [1.1]<br/>🔲 Integration Checkpoint"]
    S14["Story 1.4<br/>List Projects<br/>depends_on: [1.2, 1.3]<br/>(leaf — no checkpoint)"]
    S15["Story 1.5<br/>Project Search<br/>depends_on: []<br/>(leaf — no checkpoint)"]
    S16["Story 1.6<br/>Delete Project<br/>depends_on: [1.4]<br/>(leaf — no checkpoint)"]

    S11 --> S12
    S11 --> S13
    S12 --> S14
    S13 --> S14
    S14 --> S16

    subgraph "Execution Order (toposort)"
        direction LR
        O1["1. Story 1.1"] --> O2["2. Story 1.5"]
        O2 --> O3["3. Story 1.2"]
        O3 --> O4["4. Story 1.3"]
        O4 --> O5["5. Story 1.4"]
        O5 --> O6["6. Story 1.6"]
    end

    style S11 fill:#e1f5e1
    style S15 fill:#e1f5e1
    style S12 fill:#fff4e1
    style S13 fill:#fff4e1
    style S14 fill:#ffe8f0
    style S16 fill:#e8f0ff
```

## StoryRunner Abstraction

```mermaid
classDiagram
    class StoryRunner {
        <<interface>>
        +createIssue(story, epic) IssueResult
        +createBranch(story, branchName) BranchResult
        +createPR(args) PRResult
        +findIssueByStoryId(storyId) IssueResult?
        +findPRByBranch(branchName) PRResult?
        +branchExists(branchName) bool
        +ensureBranchCheckedOut(branchName) void
        +isPRMerged(story) bool
        +updateStatus(story, status) void
        +getDefaultBaseBranch() string
    }

    class GitHubCLIRunner {
        +Uses: gh CLI + git
        +Real API calls
        +Idempotent ops (find-or-create)
        +Retry with exponential backoff
    }

    class DryRunStoryRunner {
        +issueCounter: int
        +prCounter: int
        +log: string[]
        +No API calls
        +Deterministic mock IDs
    }

    StoryRunner <|.. GitHubCLIRunner
    StoryRunner <|.. DryRunStoryRunner
```

## Safety Invariants

| Invariant                      | Enforcement                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| Never auto-merge PRs           | Workflow NEVER calls `gh pr merge`; all PRs remain open                |
| Never bypass hooks             | All commits go through pre-commit hooks                                |
| Never force push               | Standard `git push` only (no `--force`)                                |
| Never push to base branch      | All work on feature branches                                           |
| Never skip tests               | Quality gate runs lint + build + test before review                    |
| Never silently ignore failures | Auto-fix (max 2) → escalate to human                                   |
| Idempotent operations          | find-or-create pattern for issues/branches/PRs                         |
| State persistence              | Atomic writes (tmp + mv); `--resume` picks up exactly                  |
| Human checkpoints              | Scope confirmation, per-story approval, integration checks, completion |

## Key Differences from v1 Diagram

1. **Decomposed architecture** — Thin command delegates to SKILL.md, which loads supporting modules on-demand (not a monolithic command file)
2. **Skill tool for dev-story** — Implementation invoked via `Skill("bmad-bmm-dev-story")` inline (same context), not as a subagent
3. **Task tool for review/fix** — Reviewer and fixer are proper subagents with `subagent_type` (not `/bmad-bmm-code-review`)
4. **Review loop operates on local changes** — No push until review loop exits cleanly; reviewer diffs local branch ref
5. **Dependency completion policy** — Stories WITH dependents require `git merge-base --is-ancestor` verification; leaf stories just need state-file "done"
6. **Merged human prompts** — Integration checkpoint results fold into the Phase 2.6 "Continue?" prompt instead of separate prompts
7. **State file atomic writes** — Write to `.tmp` then `mv` for crash safety
8. **Hard cap on review rounds** — Max 3 by default, override up to 5, then forced human decision
9. **StoryRunner abstraction** — All GitHub ops through interface; DryRunStoryRunner for `--dry-run` mode
10. **Explicit quality gate** — lint + build + test with coverage capture BEFORE review loop starts
