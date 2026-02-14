# Diagrams v1 - How Auto Epic Command Works

## Diagram 1: System Architecture (High-Level Components)

**Placement:** Immediately after the "Architecture Layers" section opener (before Layer 1 subsection)

_Four architectural layers showing command delegation, hook interception, and subagent spawning_

<!-- Alt: Block diagram showing top-to-bottom hierarchy with four layers: Command Entry at top delegates to Orchestrator Core, which connects to Hook System (intercepting tool calls) and spawns Subagents, with External Services at the bottom -->

```mermaid
flowchart TB
    CMD([Command Entry])
    ORCH[Orchestrator Core]
    HOOKS[Hook System]
    AGENTS[Subagents]
    EXT[External Services]

    CMD -->|delegates| ORCH
    ORCH -.->|tool calls intercepted| HOOKS
    ORCH -->|spawns via Task| AGENTS
    ORCH -->|via StoryRunner| EXT
```

---

## Diagram 2a: Command Flow Overview (Three Phases)

**Placement:** At the beginning of "Command Flow and Phases" section, before the three phase subsections

_High-level execution flow through Planning, Story Loop, and Completion phases_

<!-- Alt: Flowchart showing left-to-right progression from command invocation through three phases: Phase 1 Planning with scope checkpoint, Phase 2 Story Loop with per-story processing, and Phase 3 Completion with reporting -->

```mermaid
flowchart LR
    START([User Invokes Command])
    P1[Phase 1: Planning & Scope]
    CHECK1{Scope<br/>Checkpoint}
    P2[Phase 2: Story Loop]
    CHECK2{Per-Story<br/>Checkpoint}
    P3[Phase 3: Completion]
    END([User Reviews PRs])

    START --> P1
    P1 --> CHECK1
    CHECK1 -->|continue| P2
    CHECK1 -.->|cancel| END
    P2 --> CHECK2
    CHECK2 -->|next story| P2
    CHECK2 -->|all done| P3
    P3 --> END
```

---

## Diagram 2b: Phase 2 Story Loop Detail

**Placement:** In the "Command Flow and Phases > Phase 2" section after the seven-substep introduction

_Seven substeps per story from dependency check through integration validation_

<!-- Alt: Flowchart showing left-to-right story processing: dependency check, implementation with quality gates, review loop, commit and PR creation, finalization checkpoint, and integration validation for stories with dependents -->

```mermaid
flowchart LR
    START([Story Begins])
    DEP[Dependency Check]
    IMPL[Implementation<br/>+ Quality Gates]
    REVIEW[Review Loop]
    PR[Commit & PR]
    FIN{Finalize<br/>Checkpoint}
    INT[Integration<br/>Validation]
    NEXT([Next Story])
    STOP([Pause/Stop])

    START --> DEP
    DEP --> IMPL
    IMPL --> REVIEW
    REVIEW --> PR
    PR --> FIN
    FIN -->|continue| INT
    FIN -.->|pause/stop| STOP
    INT --> NEXT
```

---

## Diagram 3: Hook Lifecycle (Three Interception Points)

**Placement:** In "Architecture Layers > Layer 3" after the hook category descriptions

_Hook execution sequence showing PreToolUse gates, PostToolUse auto-correction, and Stop validation_

<!-- Alt: Flowchart showing left-to-right tool execution lifecycle: tool call attempt passes through PreToolUse gate (blocks if denied), executes tool, runs PostToolUse auto-correction, and validates at Stop with quality gates -->

```mermaid
flowchart LR
    CALL([Tool Call])
    PRE{PreToolUse<br/>Gate}
    DENIED([Denied])
    EXEC[Tool Executes]
    POST[PostToolUse<br/>Auto-Correct]
    STOP{Stop<br/>Validation}
    BLOCKED([Blocked])
    SUCCESS([Success])

    CALL --> PRE
    PRE -.->|any hook blocks| DENIED
    PRE -->|all allow| EXEC
    EXEC --> POST
    POST --> STOP
    STOP -.->|gates fail| BLOCKED
    STOP -->|gates pass| SUCCESS
```

---

## Diagram 4: Review Loop Protocol (Multi-Round Convergence)

**Placement:** In "Subagent Orchestration" section after the Reviewer and Fixer protocol descriptions

_Iterative review-fix cycle with convergence on zero MUST-FIX findings or max rounds_

<!-- Alt: Flowchart showing left-to-right review loop: spawn reviewer, count MUST-FIX findings, spawn fixer if needed, increment round, loop back to reviewer, exit when clean or escalate at max rounds -->

```mermaid
flowchart LR
    START([Start Review])
    REVIEWER[Spawn Reviewer]
    COUNT{MUST-FIX > 0?}
    FIXER[Spawn Fixer]
    ROUND{Round >= Max?}
    ESCALATE([Escalate to User])
    CLEAN([Exit Clean])

    START --> REVIEWER
    REVIEWER --> COUNT
    COUNT -->|yes| FIXER
    FIXER --> ROUND
    ROUND -->|yes| ESCALATE
    ROUND -->|no| REVIEWER
    COUNT -->|no| CLEAN
```

---

## Diagram 5: Integration Checkpoint Classification

**Placement:** In "Command Flow and Phases > Phase 2" after Step 2.7 (Integration checkpoint) description

_Decision logic classifying integration results as Green, Yellow, or Red based on validation checks_

<!-- Alt: Flowchart showing top-to-bottom integration validation: test suite runs first, then checks type changes and shared file conflicts, resulting in Red (halt on test failure), Yellow (ask user on warnings), or Green (auto-continue) -->

```mermaid
flowchart TB
    START([Story with Dependents])
    TESTS{Test<br/>Failures?}
    TYPES{Type<br/>Changes?}
    FILES{Shared File<br/>Conflicts?}
    RED([Red: Halt])
    YELLOW([Yellow: Ask User])
    GREEN([Green: Auto-Continue])

    START --> TESTS
    TESTS -->|yes| RED
    TESTS -->|no| TYPES
    TYPES -->|yes| YELLOW
    TYPES -->|no| FILES
    FILES -->|yes| YELLOW
    FILES -->|no| GREEN
```

---

## Diagram 6a: State Resume - Done Status

**Placement:** In "State Management and Resume > Resume Reconciliation" subsection after the prose description of the 7-case matrix

_Resume reconciliation for stories marked 'done' in state file_

<!-- Alt: Flowchart showing decision tree for done status: if PR merged, skip story; if PR not merged but done marked, keep done status and continue -->

```mermaid
flowchart TB
    START([Resume: Status = Done])
    PR{PR<br/>Merged?}
    SKIP([Skip Story])
    KEEP([Keep Done Status])

    START --> PR
    PR -->|yes| SKIP
    PR -->|no| KEEP
```

---

## Diagram 6b: State Resume - In-Progress Status

**Placement:** In "State Management and Resume > Resume Reconciliation" subsection, immediately after Diagram 6a

_Resume reconciliation for stories marked 'in-progress' in state file_

<!-- Alt: Flowchart showing decision tree for in-progress status: if PR exists, resume finalization; if branch deleted, mark blocked; if branch exists but no PR, reset to pending -->

```mermaid
flowchart TB
    START([Resume: Status = In-Progress])
    PR{PR<br/>Exists?}
    BRANCH{Branch<br/>Deleted?}
    RESUME([Resume Finalization])
    BLOCKED([Mark Blocked])
    RESET([Reset to Pending])

    START --> PR
    PR -->|yes| RESUME
    PR -->|no| BRANCH
    BRANCH -->|yes| BLOCKED
    BRANCH -->|no| RESET
```

---

## Diagram 6c: State Resume - Pending Status

**Placement:** In "State Management and Resume > Resume Reconciliation" subsection, immediately after Diagram 6b

_Resume reconciliation for stories marked 'pending' in state file_

<!-- Alt: Flowchart showing decision tree for pending status: if PR exists, treat as review state; if branch exists but no PR, check out branch; otherwise start fresh -->

```mermaid
flowchart TB
    START([Resume: Status = Pending])
    PR{PR<br/>Exists?}
    BRANCH{Branch<br/>Exists?}
    REVIEW([Treat as Review])
    CHECKOUT([Check Out Branch])
    FRESH([Start Fresh])

    START --> PR
    PR -->|yes| REVIEW
    PR -->|no| BRANCH
    BRANCH -->|yes| CHECKOUT
    BRANCH -->|no| FRESH
```

---

## Design Notes

### Decomposition Decisions

**Diagram 2 (Command Flow):** Decomposed into overview + detail because the original suggestion included 12+ components (all Phase 1 steps, all Phase 2 substeps, Phase 3 steps). The overview shows the three-phase structure with checkpoints (5 nodes). The detail diagram focuses only on Phase 2's seven substeps (9 nodes), which is the most complex phase.

**Diagram 6 (State Resume):** Decomposed into three separate diagrams (6a, 6b, 6c) because the original suggestion described a 7-case decision matrix with nested conditionals. Each diagram shows one state file status (done, in-progress, pending) and its GitHub reconciliation sub-cases. This preserves the decision tree structure while keeping each diagram at 3-5 nodes.

### Type Overrides

None. All suggested types matched the spatial relationships in the content.

### Node Count Compliance

All diagrams meet the 9-node maximum:

- Diagram 1: 5 nodes
- Diagram 2a: 7 nodes
- Diagram 2b: 9 nodes
- Diagram 3: 8 nodes
- Diagram 4: 7 nodes
- Diagram 5: 8 nodes
- Diagram 6a: 4 nodes
- Diagram 6b: 5 nodes
- Diagram 6c: 5 nodes

### Shape Conventions

Applied consistently across all diagrams:

- **Rounded rectangles (parentheses):** Start/end points, external actors (User Invokes Command, User Reviews PRs)
- **Rectangles (square brackets):** Processes, services, components (Orchestrator Core, Implementation)
- **Diamonds (curly braces):** Decision points (Scope Checkpoint, MUST-FIX > 0?, Test Failures?)
- **Dotted arrows:** Optional/error paths (cancel flow, denied flow, blocked outcomes)
- **Solid arrows:** Primary/happy paths

### Grayscale Readability

All diagrams use shape and line style (solid vs. dotted) to convey meaning. Color is not required for comprehension.
