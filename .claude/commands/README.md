# Custom Slash Commands

This directory contains slash commands for **Cursor** (and compatible tools). Commands are invoked by name (e.g. `/project-fix-github-issue` or as documented in `CLAUDE.md`).

## Project commands (Story 1.4)

AI Learning Hub–specific workflows. Each follows the **7-layer prompt structure**. Use them in Cursor as-is.

| Command                    | Description                                                            | Model in Cursor                           |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| `project-fix-github-issue` | Fix GitHub issue #N: read issue, implement, test, reference in commits | **Auto** (or Sonnet/Opus for hard issues) |
| `project-create-lambda`    | Create new Lambda handler with shared libs, tests, CDK wiring          | **Auto**                                  |
| `project-create-component` | Create new React component with tests and structure                    | **Auto**                                  |
| `project-run-tests`        | Run full test suite; optionally fix failures                           | **Auto** (or a faster model)              |
| `project-deploy`           | Deploy to dev (or specified) environment via CDK                       | **Auto**                                  |

**Cursor:** Prefer **Auto** for all of these. Cursor will pick an appropriate model (cost vs quality). Override only when you want: a faster/cheaper run for simple tasks (e.g. run-tests), or a stronger model for complex fixes/architecture. See `.claude/docs/model-selection.md` — planned in Story 1.12 (not yet implemented).

## 7-layer prompt structure

Each project command is structured as:

1. **Role** — Who the agent is and what it does
2. **Background** — Repo layout, docs, patterns
3. **Rules** — NEVER/ALWAYS, constraints
4. **Context** — (Runtime: user input or conversation)
5. **Task** — The specific request
6. **Output format** — Expected structure of the response
7. **Prefill** — Optional starter for the agent’s response

This order (Role → Background → Rules → Context → Task → Format → Prefill) follows Anthropic guidance for consistent task completion.

## BMAD commands

Commands prefixed with `bmad-` are from the BMAD framework and are not part of the AI Learning Hub product scope. They remain in this directory for workflow and agent support.
