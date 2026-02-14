# Documentation Request

## Title

How Auto Epic Works: System Architecture and Agent Flow

## Topic

The bmad-bmm-auto-epic workflow - its complete system architecture, command flow, hook interactions, subagent orchestration, and operational mechanics

## Audience

**Primary:** Software engineers familiar with CLI tools and basic agent concepts who want to understand how Auto Epic orchestrates complex epic implementation

**Secondary:** Technical leads evaluating the system for adoption or customization

**Assumed knowledge:**

- Basic understanding of git workflows
- CLI commands and usage
- Concept of AI agents

**No assumed knowledge of:**

- BMAD architecture internals
- Hook systems
- Multi-agent orchestration patterns

## Document Type

Technical deep-dive guide with progressive depth

## Target Length

2,400+ words (roughly 10 pages with diagrams)

## Structure Requirements

- Start with high-level conceptual overview (what Auto Epic does, why it exists)
- Progress through architectural layers (commands → agents → hooks → subagents)
- End with detailed system flow and interaction patterns
- Use clear section boundaries so readers can stop at their desired depth level
- Each major section should be self-contained enough that a reader can skip ahead

## Diagram Requirements

- System architecture diagram (high-level components)
- Command flow sequence diagram (step-by-step execution)
- Agent interaction diagram (who spawns whom, when)
- Hook lifecycle diagram (when hooks fire in the flow)
- At least 4-6 diagrams total to support the narrative

## Constraints

- **Progressive disclosure:** Readers should be able to stop after Overview, Architecture Layers, or System Flow sections and feel satisfied at their chosen depth
- **Concrete examples:** Use actual file paths, agent names, and hook names from the codebase
- **No marketing language:** Technical and direct throughout
- **Every diagram must illuminate the prose, not just decorate it**

## Source Material

The following files contain the complete specification:

- `.claude/agents/` (all agent definitions)
- `.claude/commands/bmad-bmm-auto-epic.md` (command entry point)
- `.claude/docs/` (any Auto Epic documentation)
- `.claude/hooks/` (hook implementations and triggers)
- `.claude/skills/epic-orchestrator/` (orchestrator skill and supporting modules)
- `docs/auto-epic-diagram.md` (existing workflow diagrams)
- `docs/auto-epic-architecture.md` (architecture design document)
