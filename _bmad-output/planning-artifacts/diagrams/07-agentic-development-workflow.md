# Agentic Development Workflow

This document describes how Claude Code and its subagents are used to **build** AI Learning Hub — not the product's runtime architecture.

## Overview: Two Contexts

```mermaid
flowchart TB
    subgraph DevTime["🛠️ DEVELOPMENT TIME (What Epic 1 Enables)"]
        direction TB
        Human["👤 Human Developer"]
        CC["🤖 Claude Code"]

        subgraph Subagents["Specialist Subagents"]
            CR["code-reviewer"]
            TE["test-expert"]
            DB["debugger"]
            AR["architect"]
            PV["production-validator"]
        end

        subgraph DevArtifacts["Development Artifacts"]
            Code["Source Code"]
            Tests["Tests"]
            Docs["Documentation"]
        end

        Human <--> CC
        CC <--> Subagents
        CC --> DevArtifacts
    end

    subgraph RunTime["⚡ RUNTIME (What V1 Product Does)"]
        direction TB
        User["👤 End User"]
        API["API Gateway"]
        Lambda["Lambda Functions"]
        DDB["DynamoDB"]

        User --> API --> Lambda --> DDB
    end

    DevArtifacts -.->|"deploys to"| RunTime

    style DevTime fill:#e8f5e9,stroke:#2e7d32
    style RunTime fill:#e3f2fd,stroke:#1565c0
```

## Development Workflow: Story Implementation

How Claude Code and subagents work together to implement a story:

```mermaid
sequenceDiagram
    participant H as 👤 Human
    participant CC as 🤖 Claude Code
    participant TE as test-expert
    participant DEV as (Claude Code)
    participant CR as code-reviewer
    participant PV as production-validator
    participant GH as GitHub

    Note over H,GH: Story Implementation Flow

    H->>CC: "Implement Story 3.1: Save CRUD API"

    rect rgb(255, 245, 238)
        Note over CC,TE: Phase 1: TDD - Write Failing Tests
        CC->>TE: Delegate test writing
        TE->>TE: Generate comprehensive tests
        TE-->>CC: Return test files
        CC->>CC: Run tests (verify they fail)
    end

    rect rgb(238, 245, 255)
        Note over CC,DEV: Phase 2: Implementation
        CC->>DEV: Implement to pass tests
        DEV->>DEV: Write Lambda handler
        DEV->>DEV: Write DynamoDB operations
        DEV-->>CC: Implementation complete
        CC->>CC: Run tests (verify they pass)
    end

    rect rgb(255, 238, 238)
        Note over CC,CR: Phase 3: Code Review
        CC->>CR: Review implementation
        CR->>CR: Security analysis
        CR->>CR: Pattern compliance
        CR-->>CC: Review findings
        CC->>CC: Address feedback
    end

    rect rgb(245, 238, 255)
        Note over CC,PV: Phase 4: Pre-Deploy Validation
        CC->>PV: Validate for production
        PV->>PV: Check for TODOs, debug statements
        PV->>PV: Check for hardcoded secrets
        PV-->>CC: Validation report
    end

    rect rgb(238, 255, 238)
        Note over CC,GH: Phase 5: Commit & PR
        CC->>GH: Create branch, commit, push
        CC->>GH: Create PR with checklist
        H->>GH: Review and merge
    end
```

## Subagent Relationships & Responsibilities

```mermaid
flowchart TB
    subgraph ClaudeCode["🤖 Claude Code (Orchestrator)"]
        direction TB
        Planning["📋 Planning<br/>(Plan Mode)"]
        Execution["⚡ Execution<br/>(Code/Edit)"]
        Coordination["🔄 Coordination<br/>(Delegates to Subagents)"]
    end

    subgraph Specialists["Specialist Subagents"]
        direction TB

        subgraph ReadOnly["🔒 Read-Only Access"]
            CR["🔍 code-reviewer<br/>─────────────<br/>Model: Sonnet<br/>Tools: Read, Grep, Glob<br/>─────────────<br/>• Security analysis<br/>• Pattern compliance<br/>• Code quality"]

            PV["✅ production-validator<br/>─────────────<br/>Model: Sonnet<br/>Tools: Read, Grep, Glob<br/>─────────────<br/>• TODO detection<br/>• Debug statements<br/>• Hardcoded secrets"]
        end

        subgraph EditAccess["✏️ Edit Access"]
            TE["🧪 test-expert<br/>─────────────<br/>Model: Sonnet<br/>Tools: Read, Write, Edit, Bash<br/>─────────────<br/>• TDD workflow<br/>• Test generation<br/>• Coverage analysis"]

            DB["🐛 debugger<br/>─────────────<br/>Model: Opus<br/>Tools: Read, Edit, Bash, Grep<br/>─────────────<br/>• Root cause analysis<br/>• Systematic debugging<br/>• Fix implementation"]

            AR["🏗️ architect<br/>─────────────<br/>Model: Opus<br/>Tools: Read, Write, Edit<br/>─────────────<br/>• System design<br/>• ADR creation<br/>• Pattern decisions"]
        end
    end

    ClaudeCode --> CR
    ClaudeCode --> PV
    ClaudeCode --> TE
    ClaudeCode --> DB
    ClaudeCode --> AR

    subgraph Context["📚 Shared Context Layer"]
        CLAUDE["CLAUDE.md<br/>(Essential rules)"]
        DOCS[".claude/docs/<br/>(Progressive disclosure)"]
        PROGRESS["progress.md<br/>(Session continuity)"]
    end

    ClaudeCode --> Context
    Specialists --> Context

    style ReadOnly fill:#fff3e0,stroke:#ef6c00
    style EditAccess fill:#e3f2fd,stroke:#1565c0
```

## Epic 1 Story Flow

How the 14 Epic 1 stories build the agentic development foundation:

```mermaid
flowchart LR
    subgraph Foundation["Infrastructure Foundation"]
        S1["1.1 Monorepo<br/>Scaffold"]
        S2["1.2 Shared<br/>Lambda Layer"]
        S8["1.8 DynamoDB<br/>& S3"]
        S9["1.9 Observability"]
        S7["1.7 CI/CD<br/>Pipeline"]
    end

    subgraph AgentConfig["Agent Configuration"]
        S3["1.3 CLAUDE.md<br/>& .claude/docs/"]
        S4["1.4 Custom<br/>Commands"]
        S5["1.5 Hooks"]
        S6["1.6 GitHub<br/>Templates"]
    end

    subgraph AgentAdvanced["Advanced Agent Support"]
        S10["1.10 Tool Risk<br/>Classification"]
        S11["1.11 Prompt<br/>Eval Tests"]
        S12["1.12 Model<br/>Selection Guide"]
        S13["1.13 Subagent<br/>Library"]
        S14["1.14 Context<br/>Management"]
    end

    S1 --> S2
    S2 --> S8
    S8 --> S9
    S9 --> S7

    S1 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6

    S3 --> S10
    S10 --> S11
    S11 --> S12
    S12 --> S13
    S13 --> S14

    S7 --> Epics2to11["Epics 2-11<br/>(Product Features)"]
    S14 --> Epics2to11

    style Foundation fill:#e8f5e9,stroke:#2e7d32
    style AgentConfig fill:#e3f2fd,stroke:#1565c0
    style AgentAdvanced fill:#fff3e0,stroke:#ef6c00
```

## Context Preservation Strategy

How context flows across sessions and stories:

```mermaid
flowchart TB
    subgraph SessionN["Session N"]
        Work1["Work on Story 3.1"]
        Update1["Update progress.md"]
        Commit1["Commit to Git"]
    end

    subgraph SessionN1["Session N+1"]
        Load2["Load CLAUDE.md"]
        Read2["Read progress.md"]
        Continue2["Continue Story 3.1"]
    end

    subgraph Persistence["Persistence Layer"]
        Git["📁 Git Repository<br/>─────────────<br/>• Source code<br/>• .claude/ configs<br/>• progress.md files"]

        GitHub["🐙 GitHub<br/>─────────────<br/>• Issues (stories)<br/>• PRs (reviews)<br/>• Actions (CI/CD)"]
    end

    Work1 --> Update1 --> Commit1
    Commit1 --> Git
    Git --> Load2
    Load2 --> Read2 --> Continue2

    Git <--> GitHub

    Note1["No RAG, S3, or SQL needed<br/>for development context.<br/>Git IS the context store."]

    style Persistence fill:#f3e5f5,stroke:#7b1fa2
```

## What We're NOT Building (Clarification)

```mermaid
flowchart TB
    subgraph NotBuilding["❌ NOT in Scope (Common Misconceptions)"]
        direction TB

        LangChain["LangChain/LangGraph<br/>orchestration"]
        AgentRuntime["Production agent<br/>runtime infrastructure"]
        RAG["RAG system for<br/>development context"]
        MultiAgent["Multi-agent<br/>coordination service"]
        VectorDB["Vector database<br/>for agent memory"]
    end

    subgraph ActuallyBuilding["✅ What We ARE Building"]
        direction TB

        Templates["Prompt templates<br/>(.claude/agents/)"]
        Commands["Custom commands<br/>(.claude/commands/)"]
        Hooks["Hooks configuration<br/>(.claude/settings.json)"]
        Docs["Context docs<br/>(.claude/docs/)"]
        Progress["Progress tracking<br/>(progress.md)"]
    end

    Note["Epic 1 creates CONFIGURATION FILES<br/>that enable Claude Code to work effectively.<br/>No custom infrastructure needed."]

    style NotBuilding fill:#ffebee,stroke:#c62828
    style ActuallyBuilding fill:#e8f5e9,stroke:#2e7d32
```
