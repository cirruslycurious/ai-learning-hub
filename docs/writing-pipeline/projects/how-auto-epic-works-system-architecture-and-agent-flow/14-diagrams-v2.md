# Diagrams v2

## Diagram 1: System Architecture (4-Layer Structure)

**Placement:** After "Architecture Layers" section introduction (line 13), before "Layer 1: Command entry point" subsection (line 15)

_Four-layer architecture showing delegation, on-demand loading, and agent spawning patterns_

<!-- Alt: Block diagram with four horizontal layers showing Command Entry at top delegating to Orchestrator, which loads five supporting modules on-demand and spawns three agents using different patterns -->

```mermaid
flowchart TB
    subgraph Layer1["Layer 1: Command Entry"]
        CMD["bmad-bmm-auto-epic.md"]
    end

    subgraph Layer2["Layer 2: Orchestrator"]
        ORCH["epic-orchestrator/SKILL.md"]
    end

    subgraph Layer3["Layer 3: Supporting Modules"]
        DEP["dependency-analysis.md"]
        STATE["state-file.md"]
        RUNNER["story-runner.md"]
        REVIEW["review-loop.md"]
        INTEG["integration-checkpoint.md"]
    end

    subgraph Layer4["Layer 4: Subagents & Skills"]
        REV["epic-reviewer<br/>(subagent)"]
        FIX["epic-fixer<br/>(subagent)"]
        STORY["dev-story<br/>(skill)"]
    end

    CMD -->|delegates to| ORCH
    ORCH -.->|reads on-demand| DEP
    ORCH -.->|reads on-demand| STATE
    ORCH -.->|reads on-demand| RUNNER
    ORCH -.->|reads on-demand| REVIEW
    ORCH -.->|reads on-demand| INTEG
    ORCH -->|spawns via Task tool| REV
    ORCH -->|spawns via Task tool| FIX
    ORCH -.->|invokes via Skill tool| STORY
```

---

## Diagram 2: Command Flow Sequence (Phase 1/2/3)

**Placement:** After "Three-Phase Workflow" section introduction (line 50), before "Phase 1: Planning and scope" subsection (line 53)

_Three-phase workflow showing automated execution and human approval gates_

<!-- Alt: Sequence diagram with six participants showing Phase 1 scope approval, Phase 2 story loop with review and PR creation repeating for each story, and Phase 3 completion report -->

```mermaid
sequenceDiagram
    participant User
    participant Orchestrator
    participant StateFile as State File
    participant DevStory as dev-story
    participant Reviewer as epic-reviewer
    participant GitHub

    Note over Orchestrator,StateFile: Phase 1: Planning
    Orchestrator->>StateFile: Create state file
    Orchestrator->>User: Display scope & execution order
    User->>Orchestrator: Approve

    Note over Orchestrator,GitHub: Phase 2: Story Loop
    loop Each story in topological order
        Orchestrator->>StateFile: Update: in-progress
        Orchestrator->>DevStory: Implement story
        DevStory-->>Orchestrator: Complete
        Orchestrator->>StateFile: Update: review
        Orchestrator->>Reviewer: Review code (spawned)
        Reviewer-->>Orchestrator: Findings
        Orchestrator->>GitHub: Create PR
        Orchestrator->>User: Present checkpoint + PR
        User->>Orchestrator: Continue
    end

    Note over Orchestrator,StateFile: Phase 3: Completion
    Orchestrator->>StateFile: Mark completed
    Orchestrator->>User: Display summary & PR list
```

---

## Diagram 3: Agent Interaction (Review Loop)

**Placement:** After "Multi-Agent Code Review Loop" section introduction (line 266), before "Round execution" subsection (line 269)

_One review loop round with isolated subagent spawning and conditional fixer execution_

<!-- Alt: Sequence diagram showing Orchestrator spawning epic-reviewer in isolation, reading findings document, conditionally spawning epic-fixer if MUST-FIX issues exist, with loop back or exit logic -->

```mermaid
sequenceDiagram
    participant Orch as Orchestrator
    participant Rev as epic-reviewer
    participant Findings as Findings Doc
    participant Fix as epic-fixer
    participant Git as Local Git

    Orch->>Rev: Spawn (Task tool, isolated)
    Rev->>Git: git diff main...story-branch
    Git-->>Rev: Code diff
    Rev->>Findings: Write findings
    Orch->>Findings: Count MUST-FIX issues

    alt MUST-FIX > 0
        Orch->>Fix: Spawn (Task tool)
        Fix->>Findings: Read findings
        Fix->>Git: Apply corrections & commit
        Orch->>Orch: Increment round, loop
    else MUST-FIX == 0
        Orch->>Orch: Exit loop, proceed to PR
    end
```

---

## Diagram 4: Hook Lifecycle (When Hooks Fire)

**Placement:** After "Hook System Enforcement" section introduction (line 318), before "PreToolUse hooks" subsection (line 321)

_Hook firing timeline from action request through execution to completion verification_

<!-- Alt: Flowchart showing linear timeline with PreToolUse decision gate, Tool Execution, PostToolUse auto-fix, and Stop verification gate with feedback loops for blocked actions and failed verification -->

```mermaid
flowchart TD
    Start([Action Requested])
    PreHook{PreToolUse<br/>hooks}
    Blocked[Escalate error<br/>to agent]
    Execute[Tool Execution]
    PostHook[PostToolUse hooks<br/>auto-fix]
    Complete[Implementation<br/>Complete]
    StopHook{Stop hook<br/>verification}
    Pass([Mark story<br/>complete])
    FixIssues[Agent fixes<br/>issues]

    Start --> PreHook
    PreHook -->|blocked| Blocked
    Blocked --> Start
    PreHook -->|allowed| Execute
    Execute --> PostHook
    PostHook --> Complete
    Complete --> StopHook
    StopHook -->|pass| Pass
    StopHook -->|fail| FixIssues
    FixIssues --> Execute
```

---

## Diagram 5: Dependency Graph (Stories 1.1-1.4)

**Placement:** After "Execution Example" section introduction (line 113), before the bullet list showing story structure (line 116)

_Dependency relationships showing execution order and integration checkpoint triggers_

<!-- Alt: Directed graph with four story nodes showing Story 1.1 has no dependencies, Stories 1.2 and 1.3 both depend on 1.1, Story 1.4 depends on both 1.2 and 1.3, with checkpoint annotations on non-leaf stories -->

```mermaid
flowchart LR
    S11["Story 1.1<br/>(checkpoint)"]
    S12["Story 1.2<br/>(checkpoint)"]
    S13["Story 1.3<br/>(checkpoint)"]
    S14["Story 1.4<br/>(leaf)"]

    S11 -->|dependency| S12
    S11 -->|dependency| S13
    S12 -->|dependency| S14
    S13 -->|dependency| S14
```

**Execution order note:** Valid orders are `[1.1, 1.2, 1.3, 1.4]` or `[1.1, 1.3, 1.2, 1.4]` because Stories 1.2 and 1.3 are independent.

---

## Change Log

### Diagram 2: Command Flow Sequence

**Change:** Added `loop Each story in topological order` wrapper around Phase 2 message sequence (lines 70-79 in original v1 diagram).

**Reason:** SME Review v2 finding (MUST item, line 188-208) identified that the diagram showed Phase 2 as a single story execution when it actually loops N times (once per story in topological order). The loop wrapper visually indicates that Phase 2 repeats for each story, which matches the prose description in Draft v2 line 70 ("For each story in topological order...") and the Execution Example showing sequential Story 1.1 → 1.2 → 1.3 → 1.4 execution.

**Implementation:** Inserted `loop Each story in topological order` after the Phase 2 note and before the first Phase 2 message (`Orchestrator->>StateFile: Update: in-progress`). Closed the loop after the final Phase 2 message (`User->>Orchestrator: Continue`). This wraps the entire story implementation cycle in a loop indicator that shows the sequence repeats N times.

### Diagrams 1, 3, 4, 5

**Change:** No changes from v1.

**Reason:** No SME review findings targeted these diagrams for revision. All four diagrams received confirmation of technical accuracy in SME Review v2 summary (lines 284-291). SME noted SHOULD items for Diagrams 3 and 4 (round counter visualization, PostToolUse hook coverage) but these were classified as presentation improvements, not accuracy corrections requiring MUST-level changes.
