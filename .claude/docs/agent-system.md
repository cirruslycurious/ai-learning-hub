# Agent System Overview

**Load when:** Understanding how the epic orchestrator uses subagents, or when deciding whether to spawn a subagent vs run a command.

## Two Categories of Specialists

| Category      | Location                | Context                    | Best For                                   |
| ------------- | ----------------------- | -------------------------- | ------------------------------------------ |
| **Subagents** | `.claude/agents/*.md`   | Fresh (no prior chat)      | Adversarial review, independent validation |
| **Commands**  | `.claude/commands/*.md` | Shared (full chat history) | Collaborative work, multi-step workflows   |

**Rule of thumb:** Use commands for most work. Use subagents only when fresh-context isolation matters.

For a complete mapping of all 12 PRD roles (code-reviewer, test-expert, debugger, architect, etc.) to existing assets, see `.claude/agents/README.md#role-to-asset-mapping`.

## How the Epic Orchestrator Uses Subagents

The orchestrator (`.claude/skills/epic-orchestrator/SKILL.md`) spawns subagents during its **review loop** (Phase 2.4):

```
Implementation Complete
  → Spawn epic-reviewer (fresh context, read-only)
  → Reviewer writes findings doc (Critical/Important/Minor)
  → If MUST-FIX > 0 and round < 3:
      → Spawn epic-fixer (full edit, reads findings)
      → Fixer commits fixes locally
      → Loop back to reviewer
  → If MUST-FIX > 0 and round == 3:
      → Escalate to human
  → If MUST-FIX == 0:
      → Exit loop, proceed to PR
```

Key design choices:

- **Fresh context per review round** — Reviewer has no memory of prior rounds, preventing bias
- **Structured findings format** — Orchestrator parses Critical/Important/Minor counts to decide next action
- **Max 3 rounds** (hard cap 5 with human override) — Prevents unbounded review loops
- **Fixer commits locally** — Push happens only after review loop exits clean

## Safety Invariants for Subagents

All subagents operate within the three-layer safety model:

**Layer 1 (Hooks):** Active on every tool call. Subagents cannot bypass hooks. Key hooks include (not exhaustive):

- `bash-guard` — Blocks dangerous commands
- `file-guard` — Protects critical files
- `architecture-guard` — Enforces ADR compliance
- `import-guard` — Enforces shared library usage

See `.claude/hooks/README.md` for the full hook inventory.

**Layer 2 (Orchestrator):** Controls subagent lifecycle.

- Never auto-merges PRs
- Never force pushes
- Escalates after repeated failures

**Layer 3 (Human):** Approves scope, story completion, integration.

See [Safety Architecture](./safety-architecture.md) for the full model.
See [Orchestrator Safety](./orchestrator-safety.md) for the 9 invariants and review loop details.

## Adding to the Agent System

Before adding anything, read `.claude/agents/README.md` for:

- Decision tree: subagent vs command
- Frontmatter conventions
- Tool restriction guidance
- Role-to-asset mapping (to avoid duplicating existing capabilities)
