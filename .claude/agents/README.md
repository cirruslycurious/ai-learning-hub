# Agent System

This project uses two kinds of specialists: **subagents** and **commands/workflows**. Both run as Claude Code sessions, but they serve different purposes and are spawned differently.

## Key Concepts

**Subagent** — A fresh conversational context spawned via the `Task` tool (with a `subagent_type`). The subagent shares the repo's files and git history but has no memory of the parent conversation. Use subagents when you need isolated, adversarial work (e.g., code review that must not be biased by implementation context).

**Command/Workflow** — A slash command (e.g., `/bmad-bmm-dev-story`) that runs inline in the current conversation. Commands have full access to prior chat context. Use commands for collaborative, multi-step workflows where context continuity matters.

**Hooks** — Deterministic enforcement scripts (`.claude/hooks/`) that run on every tool call. Subagents and commands both respect hooks. No agent can bypass them.

## When to Use What

```
Need isolated, adversarial review?     → Spawn a subagent
Need to implement a story/feature?     → Run a command (/bmad-bmm-dev-story)
Need architecture/PM/analyst input?    → Run a BMAD agent command (/bmad-agent-bmm-architect)
Need to review code interactively?     → Run /bmad-bmm-code-review
Need autonomous epic implementation?   → Run /bmad-bmm-auto-epic (spawns subagents internally)
```

## Current Subagents

These live in `.claude/agents/` and are spawned by the epic orchestrator or manually via the `Task` tool:

| Subagent        | File               | Purpose                                                                                   | Tools                                                                                  | Spawned By                    |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| `epic-reviewer` | `epic-reviewer.md` | Fresh-context adversarial code review. Reads branch diff, writes structured findings doc. | Read, Glob, Grep, Bash, Write (no Edit -- can write findings but cannot modify source) | Epic orchestrator review loop |
| `epic-fixer`    | `epic-fixer.md`    | Fixes issues from a findings document. Full edit access, commits fixes locally.           | Read, Glob, Grep, Bash, Write, Edit                                                    | Epic orchestrator review loop |

### How the Orchestrator Uses Subagents

The epic orchestrator (`/bmad-bmm-auto-epic`) runs a **review loop** after each story implementation:

1. Spawns `epic-reviewer` (fresh context) to review the branch diff
2. Reviewer writes a findings doc with Critical/Important/Minor categories
3. If MUST-FIX findings exist, spawns `epic-fixer` to address them
4. Repeats (up to 3 rounds) until clean or escalates to human

See `.claude/docs/orchestrator-safety.md` for the full review loop protocol.

## Role-to-Asset Mapping

The PRD (FR90) mentions specialist roles. Here is where each capability lives today:

| PRD Role                           | What We Have                  | Asset Type         | How to Use                                                                                  |
| ---------------------------------- | ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| **Code Reviewer** (security focus) | `epic-reviewer`               | Subagent           | Spawned by orchestrator; or manually: `Task(subagent_type: "epic-reviewer", prompt: "...")` |
| **Code Reviewer** (interactive)    | `/bmad-bmm-code-review`       | Command            | Run directly for interactive review                                                         |
| **Test Expert** (TDD)              | `/bmad-agent-tea-tea`         | BMAD agent command | Run for test architecture guidance                                                          |
| **Test Automation**                | `/bmad-tea-testarch-automate` | Workflow command   | Run to expand test coverage                                                                 |
| **Debugger**                       | Inline debugging              | No dedicated agent | Debug inline; use `/bmad-cis-problem-solving` for systematic approach                       |
| **Architect**                      | `/bmad-agent-bmm-architect`   | BMAD agent command | Run for architecture decisions                                                              |
| **Production Validator**           | Hooks + orchestrator gates    | Layer 1 + Layer 2  | Automatic via hooks (type-check, test-validator Stop hook)                                  |
| **Dev (implementation)**           | `/bmad-agent-bmm-dev`         | BMAD agent command | Run for implementation guidance                                                             |
| **PM**                             | `/bmad-agent-bmm-pm`          | BMAD agent command | Run for product decisions                                                                   |
| **Analyst**                        | `/bmad-agent-bmm-analyst`     | BMAD agent command | Run for requirements analysis                                                               |
| **SM (Scrum Master)**              | `/bmad-agent-bmm-sm`          | BMAD agent command | Run for sprint/story management                                                             |
| **Tech Writer**                    | `/bmad-agent-bmm-tech-writer` | BMAD agent command | Run for documentation                                                                       |

**When NOT to create a new subagent:** If a BMAD agent command already covers the role. BMAD commands run inline with full context, which is usually better for collaborative work. Only create a subagent when you need **fresh context isolation** (e.g., adversarial review, independent validation).

## Subagent Configuration Conventions

All subagent files in `.claude/agents/` use this structure:

### Required Frontmatter

```yaml
---
name: agent-name # kebab-case, matches filename without .md
description: "One-line description of what this agent does and when to use it"
tools: Read, Glob, Grep # Comma-separated list of allowed tools
disallowedTools: Edit, Task # Tools explicitly blocked (optional)
model: inherit # "inherit" (use parent model) or specific model
---
```

### Frontmatter Fields

| Field             | Required | Description                                                                                      |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `name`            | Yes      | Unique identifier, kebab-case (e.g., `epic-reviewer`)                                            |
| `description`     | Yes      | What the agent does and when to use it. The orchestrator and Claude Code use this for discovery. |
| `tools`           | Yes      | Allowed tools. Read-only agents omit Edit/Write.                                                 |
| `disallowedTools` | No       | Explicitly blocked tools. Use for safety (e.g., block `Task` to prevent subagent recursion).     |
| `model`           | No       | Model override. Default is `inherit` (same as parent).                                           |

### Body Structure

After frontmatter, the markdown body should include:

1. **Role statement** — One paragraph: who you are, what your stance is
2. **Context section** — What the orchestrator/caller passes to you
3. **Task section** — Step-by-step instructions for the agent
4. **Output format** — Exact format the caller expects (so orchestrators can parse it)
5. **Rules** — Constraints and invariants the agent must follow

### Tool Restriction Guidance

| Agent Role                                 | Recommended Tools                   | Block             |
| ------------------------------------------ | ----------------------------------- | ----------------- |
| Reviewer (no Edit -- writes findings only) | Read, Glob, Grep, Bash, Write       | Edit, Task        |
| Fixer (full edit)                          | Read, Glob, Grep, Bash, Write, Edit | Task              |
| Validator (fully read-only)                | Read, Glob, Grep, Bash              | Edit, Write, Task |

**Always block `Task`** on subagents to prevent unbounded subagent recursion.

## Examples

### Spawning a Fresh-Context Reviewer Manually

```
Task(
  subagent_type: "epic-reviewer",
  prompt: "Review Story 1.8 on branch story-1-8-dynamodb-s3-infrastructure against main.
    Story file: _bmad-output/implementation-artifacts/1-8-dynamodb-s3-infrastructure.md
    Round: 1
    Output: _bmad-output/implementation-artifacts/1-8-code-review-findings-round-1.md"
)
```

The reviewer gets a clean conversational context, reads the diff, and writes findings.

### Spawning a Fixer After Review

```
Task(
  subagent_type: "epic-fixer",
  prompt: "Fix findings for Story 1.8 on branch story-1-8-dynamodb-s3-infrastructure.
    Story file: _bmad-output/implementation-artifacts/1-8-dynamodb-s3-infrastructure.md
    Findings: _bmad-output/implementation-artifacts/1-8-code-review-findings-round-1.md
    Round: 1"
)
```

The fixer reads the findings doc, makes fixes, and commits locally.

### Using a BMAD Agent Command as a Specialist

For architecture decisions, run the architect command directly:

```
/bmad-agent-bmm-architect
```

This loads the architect persona inline (not as a subagent), giving it full access to your conversation context. Use this when you want collaborative, contextual input rather than isolated review.

### Claude Code `/agents` Command

Claude Code agents are defined as markdown files in the `.claude/agents/` directory. They are spawned programmatically via the `Task` tool with a `subagent_type` parameter matching the agent filename (without `.md`). For example, `Task(subagent_type: "epic-reviewer", prompt: "...")` spawns the agent defined in `.claude/agents/epic-reviewer.md`. This is the standard mechanism for creating and invoking custom agents in this project.

## Adding a New Subagent

Before creating a new subagent, check:

1. **Does a BMAD command already cover this?** Check `.claude/commands/bmad-agent-*` — there are 15+ agent commands already available.
2. **Do you need fresh-context isolation?** If not, a command is better.
3. **Will an orchestrator spawn this?** Subagents are designed for programmatic spawning via `Task` tool.

If you still need a new subagent:

1. Create `.claude/agents/{name}.md` with the frontmatter and body structure above
2. Follow the tool restriction guidance for the agent's role
3. Include a structured output format so callers can parse results
4. Block the `Task` tool to prevent recursion
5. Test by spawning manually before integrating with orchestrators

## Invariants All Agents Must Respect

These are enforced by hooks (Layer 1) and cannot be bypassed:

- Never force push (`bash-guard` blocks it)
- Never commit secrets (`bash-guard` + secrets scan gates)
- Never edit protected files without approval (`file-guard` blocks it)
- Never skip TDD when implementing code (`tdd-guard` blocks it)
- Never use raw AWS SDK instead of `@ai-learning-hub/*` (`import-guard` blocks it)
- Never call Lambda-to-Lambda (`architecture-guard` blocks it)

See `.claude/docs/safety-architecture.md` for the full three-layer defense model.

## Further Reading

- `.claude/docs/orchestrator-safety.md` — How the orchestrator uses subagents
- `.claude/docs/safety-architecture.md` — Three-layer defense model
- `.claude/docs/hook-system.md` — Hook System Details
- `.claude/skills/epic-orchestrator/SKILL.md` — Full orchestrator implementation
- `.claude/skills/epic-orchestrator/review-loop.md` — Review loop protocol
