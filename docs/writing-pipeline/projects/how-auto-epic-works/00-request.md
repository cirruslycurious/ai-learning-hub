# Documentation Request

## Task

Write a comprehensive technical guide titled "How Auto Epic Command Works: Agent Flow and System Architecture"

## Topic

The bmad-bmm-auto-epic workflow - its complete system architecture, command flow, hook interactions, subagent orchestration, and operational mechanics.

## Audience

### Primary Audience

Software engineers familiar with CLI tools and basic agent concepts who want to understand how Auto Epic orchestrates complex epic implementation.

### Secondary Audience

Technical leads evaluating the system for adoption or customization.

### Assumed Knowledge

- Basic understanding of git workflows
- CLI commands and terminal operations
- The concept of AI agents
- Software development workflows

### Not Assumed

- BMAD architecture internals
- Hook systems and their implementation
- Multi-agent orchestration patterns

## Document Type

Technical deep-dive guide with progressive depth levels.

## Structure Requirements

- Start with high-level conceptual overview (what Auto Epic does, why it exists)
- Progress through architectural layers (commands → agents → hooks → subagents)
- End with detailed system flow and interaction patterns
- Use clear section boundaries so readers can stop at their desired depth level
- Each major section should be self-contained enough that a reader can skip ahead

## Target Length

2,400+ words (roughly 10 pages with diagrams)

## Scope - Must Cover

### 1. Overview (accessible to all readers)

- What Auto Epic does at a high level
- Key benefits and use cases
- When to use it vs other workflows

### 2. Architecture Layers (progressively technical)

- Command entry point (.claude/commands/bmad-bmm-auto-epic.md)
- Agent orchestration (.claude/agents/)
- Hook system integration (.claude/hooks/)
- Subagent spawning and coordination

### 3. System Flow (detailed technical)

- Complete command execution flow
- Which hooks fire when and why
- Which subagents are spawned for what purposes
- State management and persistence
- Error handling and recovery

### 4. Component Deep-Dives (reference detail)

- Each subagent's specific responsibilities
- Hook interaction patterns
- Integration points with broader BMAD system

## Diagram Requirements

- System architecture diagram (high-level components)
- Command flow sequence diagram (step-by-step execution)
- Agent interaction diagram (who spawns whom, when)
- Hook lifecycle diagram (when hooks fire in the flow)
- At least 4-6 diagrams total to support the narrative

## Source Material

- .claude/agents/ (all agent definitions)
- .claude/commands/bmad-bmm-auto-epic.md
- .claude/docs/ (any Auto Epic documentation)
- .claude/hooks/ (hook implementations and triggers)
- .claude/skills/bmad-bmm-auto-epic.md and epic-orchestrator/
- /docs/auto-epic-diagram.md (if exists)
- /docs/auto-epic-architecture.md (if exists)

## Constraints

- **Progressive disclosure:** Readers should be able to stop after Overview, Architecture Layers, or System Flow sections and feel satisfied at their chosen depth
- **Concrete examples:** Use actual file paths, agent names, and hook names from the codebase
- **No marketing language:** Technical and direct throughout
- **Every diagram must illuminate the prose, not just decorate it**

## Success Criteria

A technical reader with CLI experience should be able to:

1. Understand what Auto Epic does and when to use it (after Overview)
2. Explain the four architectural layers and their boundaries (after Architecture Layers)
3. Trace a complete story implementation through the system (after System Flow)
4. Reference specific components and their responsibilities (after Component Deep-Dives)
