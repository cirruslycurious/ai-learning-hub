# /bmad-bmm-auto-epic Workflow Diagram

## Overview

This diagram visualizes the autonomous epic implementation workflow with multi-agent code review loop.

## Main Workflow

```mermaid
flowchart TD
    Start([Start: /bmad-bmm-auto-epic]) --> LoadEpic[Load Epic File]
    LoadEpic --> LoadStories[Load Story Files with YAML]
    LoadStories --> BuildGraph[Build Dependency Graph]
    BuildGraph --> DetectCycles{Cycles<br/>Detected?}

    DetectCycles -->|Yes| Error1[❌ Error: Circular Dependencies]
    DetectCycles -->|No| TopoSort[Topological Sort]

    TopoSort --> MarkCheckpoints[Mark Integration Checkpoints]
    MarkCheckpoints --> ShowScope[Show Scope & Execution Order]
    ShowScope --> UserConfirm{User<br/>Confirms?}

    UserConfirm -->|No| End1([End: Cancelled])
    UserConfirm -->|Yes| InitState[Initialize State File]

    InitState --> StoryLoop{More<br/>Stories?}

    StoryLoop -->|No| GenerateReport[Generate Epic Report]
    GenerateReport --> End2([End: Complete])

    StoryLoop -->|Yes| CheckDeps[Check Dependencies]
    CheckDeps --> DepsOK{Dependencies<br/>Met?}

    DepsOK -->|No| BlockStory[❌ Block Story]
    BlockStory --> StoryLoop

    DepsOK -->|Yes| CreateIssue[Create GitHub Issue]
    CreateIssue --> CreateBranch[Create Feature Branch]
    CreateBranch --> Implement[Implement Story<br/>Protected by Hooks]

    Implement --> RunTests[Run Tests]
    RunTests --> TestsPass{Tests<br/>Pass?}

    TestsPass -->|No| AutoFix{Auto-fix<br/>Attempt?}
    AutoFix -->|Yes| Implement
    AutoFix -->|No| Escalate[Escalate to Human]
    Escalate --> StoryLoop

    TestsPass -->|Yes| Commit[Commit with Issue Ref]
    Commit --> Push[Push Branch]
    Push --> CreatePR[Create Pull Request]
    CreatePR --> MarkReview[Mark Story for Review]

    MarkReview --> ReviewLoop[Multi-Agent Review Loop]
    ReviewLoop --> FinalizeStory[Finalize Story]

    FinalizeStory --> HasDependents{Story Has<br/>Dependents?}

    HasDependents -->|Yes| IntegrationCP[Integration Checkpoint]
    IntegrationCP --> CPResult{Checkpoint<br/>Result?}

    CPResult -->|Issues| WarnUser[⚠️ Warn User]
    WarnUser --> PostStoryCP
    CPResult -->|Clean| PostStoryCP

    HasDependents -->|No| PostStoryCP[Post-Story Checkpoint]

    PostStoryCP --> UserChoice{User<br/>Choice?}
    UserChoice -->|Continue| StoryLoop
    UserChoice -->|Skip| HandleSkip[Handle Skip Logic]
    HandleSkip --> StoryLoop
    UserChoice -->|Pause| SaveState[Save State]
    SaveState --> End3([End: Paused])

    style Start fill:#e1f5e1
    style End1 fill:#ffe1e1
    style End2 fill:#e1f5e1
    style End3 fill:#fff4e1
    style Error1 fill:#ffe1e1
    style ReviewLoop fill:#e1e5ff
    style Implement fill:#fff4e1
    style IntegrationCP fill:#ffe8f0
```

## Multi-Agent Code Review Loop (Phase 2.5)

```mermaid
flowchart TD
    Start([Enter Review Loop]) --> InitRound[Round = 1]
    InitRound --> SpawnReviewer

    SpawnReviewer[Spawn Reviewer Agent<br/>Fresh Context]
    SpawnReviewer --> RunCodeReview[Run /bmad-bmm-code-review]
    RunCodeReview --> CreateFindings[Create Findings Document<br/>docs/.../findings-round-N.md]

    CreateFindings --> CountFindings{MUST-FIX<br/>Count?}

    CountFindings -->|0| Clean[✅ Clean State!]
    Clean --> UpdatePR[Add Review Summary to PR]
    UpdatePR --> ExitLoop([Exit Loop: Success])

    CountFindings -->|> 0| CheckRound{Round < 3?}

    CheckRound -->|Yes| SpawnFixer[Spawn Fixer Agent<br/>With Context]
    SpawnFixer --> ReadFindings[Read Findings Document]
    ReadFindings --> FixIssues[Fix Each Issue<br/>Critical → Important → Minor]
    FixIssues --> RunTestsAfterFix[Run Tests After Each Fix]
    RunTestsAfterFix --> CommitFixes[Commit Fixes<br/>fix: address review round N]
    CommitFixes --> IncrementRound[Round++]
    IncrementRound --> SpawnReviewer

    CheckRound -->|No| MaxRounds[❌ Max Rounds Exceeded]
    MaxRounds --> UpdateStatus[Mark as blocked-review<br/>in sprint-status.yaml]
    UpdateStatus --> EscalateHuman[Escalate to Human]

    EscalateHuman --> HumanChoice{Human<br/>Choice?}
    HumanChoice -->|Manual Fix| ManualWork[Human Fixes Issues]
    ManualWork --> ExitLoop2([Exit Loop: Manual])
    HumanChoice -->|Accept Anyway| AcceptWithIssues[Mark Complete with Issues]
    AcceptWithIssues --> ExitLoop3([Exit Loop: Accepted])
    HumanChoice -->|One More Round| OverrideLimit[Override Limit]
    OverrideLimit --> SpawnReviewer

    style Start fill:#e1e5ff
    style ExitLoop fill:#e1f5e1
    style ExitLoop2 fill:#fff4e1
    style ExitLoop3 fill:#ffe8f0
    style Clean fill:#e1f5e1
    style MaxRounds fill:#ffe1e1
    style SpawnReviewer fill:#e8f0ff
    style SpawnFixer fill:#ffe8f0
```

## Review Findings Document Structure

```mermaid
classDiagram
    class FindingsDocument {
        +string round
        +string branch
        +string commit
        +CriticalIssue[] critical
        +ImportantIssue[] important
        +MinorIssue[] minor
        +Summary summary
    }

    class CriticalIssue {
        +string category
        +string description
        +string file
        +string problem
        +string impact
        +string suggestedFix
    }

    class ImportantIssue {
        +string category
        +string description
        +string file
        +string problem
        +string impact
        +string suggestedFix
    }

    class MinorIssue {
        +string category
        +string description
        +string file
        +string problem
        +string impact
        +string suggestedFix
    }

    class Summary {
        +int totalFindings
        +int criticalCount
        +int importantCount
        +int minorCount
        +string recommendation
    }

    FindingsDocument --> CriticalIssue
    FindingsDocument --> ImportantIssue
    FindingsDocument --> MinorIssue
    FindingsDocument --> Summary
```

## Agent Roles and Separation

```mermaid
graph LR
    subgraph "Agent 1: Orchestrator"
        A1[Epic Orchestrator<br/>Full Context]
    end

    subgraph "Agent 2: Story Implementer"
        A2[Story Implementation<br/>/bmad-bmm-dev-story<br/>Implementation Context]
    end

    subgraph "Agent 3: Reviewer Round 1"
        A3[Code Review<br/>Fresh Context<br/>NO Implementation History]
    end

    subgraph "Agent 4: Fixer Round 1"
        A4[Fix Issues<br/>Implementation + Findings Context]
    end

    subgraph "Agent 5: Reviewer Round 2"
        A5[Code Review<br/>Fresh Context<br/>NO Previous Review Context]
    end

    subgraph "Agent 6: Fixer Round 2"
        A6[Fix Issues<br/>Implementation + Findings Context]
    end

    subgraph "Agent 7: Reviewer Round 3"
        A7[Code Review<br/>Fresh Context<br/>NO Previous Review Context]
    end

    A1 -->|Spawns| A2
    A2 -->|Complete| A1
    A1 -->|Spawns for Review| A3
    A3 -->|Findings Doc| A1
    A1 -->|Spawns to Fix| A4
    A4 -->|Fixes Complete| A1
    A1 -->|Spawns for Review| A5
    A5 -->|Findings Doc| A1
    A1 -->|Spawns to Fix| A6
    A6 -->|Fixes Complete| A1
    A1 -->|Spawns for Review| A7

    style A1 fill:#e1f5e1
    style A2 fill:#fff4e1
    style A3 fill:#e8f0ff
    style A4 fill:#ffe8f0
    style A5 fill:#e8f0ff
    style A6 fill:#ffe8f0
    style A7 fill:#e8f0ff
```

## Dependency Graph Example

```mermaid
graph TD
    S11[Story 1.1<br/>User Registration<br/>No Dependencies]
    S12[Story 1.2<br/>Save Project<br/>depends on 1.1]
    S13[Story 1.3<br/>Validation Logic<br/>depends on 1.1]
    S14[Story 1.4<br/>List Projects<br/>depends on 1.2, 1.3]
    S15[Story 1.5<br/>Project Search<br/>No Dependencies]
    S16[Story 1.6<br/>Delete Project<br/>depends on 1.4]

    S11 -->|Checkpoint| S12
    S11 -->|Checkpoint| S13
    S12 -->|Checkpoint| S14
    S13 -->|Checkpoint| S14
    S14 -->|Checkpoint| S16

    style S11 fill:#e1f5e1
    style S12 fill:#fff4e1
    style S13 fill:#fff4e1
    style S14 fill:#ffe8f0
    style S15 fill:#e1f5e1
    style S16 fill:#e8f0ff
```

## State Transitions

```mermaid
stateDiagram-v2
    [*] --> pending: Story Created
    pending --> in_progress: Implementation Started
    in_progress --> in_progress: Hooks Enforce Rules
    in_progress --> review: Tests Pass + PR Created
    review --> review: Review Round (Max 3)
    review --> blocked_review: Max Rounds Exceeded
    review --> done: Clean Review (0 MUST-FIX)
    blocked_review --> in_progress: Human Fixed
    blocked_review --> done: Human Accepted
    done --> [*]

    in_progress --> blocked: Dependencies Not Met
    in_progress --> blocked: Tests Failed
    blocked --> in_progress: Blocker Resolved
    blocked --> [*]: Skipped
```

## Integration Checkpoint Flow

```mermaid
flowchart TD
    Start([Story with Dependents Complete]) --> GetChanges[Get Actual Changed Files<br/>via git diff]
    GetChanges --> FindDependents[Find Dependent Stories]
    FindDependents --> CheckOverlaps[Check File Overlaps]

    CheckOverlaps --> HasOverlap{File<br/>Overlaps?}
    HasOverlap -->|Yes| WarnOverlap[⚠️ Warn: File Overlap]
    HasOverlap -->|No| CheckTypes

    WarnOverlap --> CheckTypes[Check Type/Interface Changes]
    CheckTypes --> HasTypeChange{Type<br/>Changes?}

    HasTypeChange -->|Yes| WarnTypes[⚠️ Warn: Type Changes]
    HasTypeChange -->|No| RunAcceptance

    WarnTypes --> RunAcceptance[Re-run Acceptance Tests]
    RunAcceptance --> TestsPass{Tests<br/>Pass?}

    TestsPass -->|No| Error[❌ Escalate: Tests Failing]
    TestsPass -->|Yes| Green[✅ Green: Continue]

    Error --> End([Human Decision])
    Green --> End

    style Start fill:#ffe8f0
    style Green fill:#e1f5e1
    style Error fill:#ffe1e1
    style WarnOverlap fill:#fff4e1
    style WarnTypes fill:#fff4e1
```

## Coverage Gate Logic

```mermaid
flowchart TD
    Start([Tests Complete]) --> GetCoverage[Extract Coverage from Test Results]
    GetCoverage --> CheckGate{Coverage<br/>Gate Type?}

    CheckGate -->|no-decrease| ComparePrevious[Compare with Previous Coverage]
    CheckGate -->|min-N%| CheckMin[Check if >= N%]
    CheckGate -->|story-override| UseStoryGate[Use coverage_gate from Story YAML]

    ComparePrevious --> Decreased{Coverage<br/>Decreased?}
    Decreased -->|Yes| Fail1[❌ Fail: Coverage Decreased]
    Decreased -->|No| Pass1[✅ Pass: Coverage OK]

    CheckMin --> BelowMin{Below<br/>Min?}
    BelowMin -->|Yes| Fail2[❌ Fail: Below Minimum]
    BelowMin -->|No| Pass2[✅ Pass: Above Minimum]

    UseStoryGate --> CheckGate

    Fail1 --> StopHook[Stop Hook Blocks Completion]
    Fail2 --> StopHook
    Pass1 --> AllowContinue[Allow Story to Continue]
    Pass2 --> AllowContinue

    style Pass1 fill:#e1f5e1
    style Pass2 fill:#e1f5e1
    style Fail1 fill:#ffe1e1
    style Fail2 fill:#ffe1e1
```

## Key Features Summary

### ✅ Safety Invariants
- Never auto-merge PRs (human review required)
- Never bypass hooks (TDD, architecture, shared libs enforced)
- Never force push (standard git push only)
- Never skip tests (coverage gates enforced)

### 🔄 Multi-Agent Architecture
- **Agent 1**: Epic orchestrator (main context)
- **Agents 2-7**: Review/fix cycles (fresh context per review)
- **Separation**: Reviewers have NO implementation context (prevents bias)
- **Handoff**: Findings documents as protocol between agents

### 📊 Quality Convergence
- Max 3 review rounds per story
- Clean state: 0 MUST-FIX findings (Minor issues acceptable)
- Escalation: Human intervention after round 3
- Metrics: Review rounds, findings fixed, convergence rate tracked

### 🎯 Integration Checkpoints
- Triggered after stories with dependents
- Validates file overlaps, type changes, acceptance criteria
- Auto-escalates complex conflicts to human

### 🔄 State Management
- Primary: State file (orchestration decisions)
- Secondary: sprint-status.yaml, GitHub issues/PRs
- Resumable: `--resume` picks up from exact point
- Conflict resolution: State file wins for control flow
