---
name: "bmad-bmm-auto-epic"
description: "Autonomous epic implementation with dependency analysis, code review loops, and human checkpoints"
---

# /bmad-bmm-auto-epic — Autonomous Epic Implementation

Implement all stories in an epic autonomously with strategic human checkpoints.

## Usage

```bash
/bmad-bmm-auto-epic Epic-1                           # All stories
/bmad-bmm-auto-epic Epic-1 --stories=1.1,1.2,1.5     # Specific stories
/bmad-bmm-auto-epic Epic-1 --resume                   # Resume previous run
/bmad-bmm-auto-epic Epic-1 --dry-run                  # Simulate without GitHub
```

## Arguments

Parse `$ARGUMENTS` to extract:

| Parameter             | Type   | Required | Default       | Description                                 |
| --------------------- | ------ | -------- | ------------- | ------------------------------------------- |
| `epic_id`             | string | Yes      | -             | Epic identifier (e.g., "Epic-1", "epic-1")  |
| `--stories`           | string | No       | all           | Comma-separated story IDs (e.g., "1.1,1.2") |
| `--resume`            | flag   | No       | false         | Resume from state file                      |
| `--dry-run`           | flag   | No       | false         | Simulate without branches/PRs/commits       |
| `--epic-path`         | string | No       | auto-detected | Override path to epic file                  |
| `--no-require-merged` | flag   | No       | false         | Relax dependency completion checking        |

## Execution

Read and execute the orchestrator skill:

1. Read the COMPLETE file `.claude/skills/epic-orchestrator/SKILL.md`
2. Follow its instructions exactly — it defines all phases, checkpoints, and subagent coordination
3. The orchestrator references supporting files in its directory (loaded on-demand as you reach each phase):
   - `dependency-analysis.md` — dependency graph, toposort, cycle detection
   - `state-file.md` — state file format, resume semantics
   - `story-runner.md` — StoryRunner interface, GitHub/DryRun adapters
   - `integration-checkpoint.md` — file overlap, type change validation
   - `review-loop.md` — multi-agent review protocol
4. The orchestrator spawns subagents defined in `.claude/agents/`:
   - `epic-reviewer` — fresh-context code reviewer
   - `epic-fixer` — code fixer guided by findings document

## Related Commands

- `/bmad-bmm-dev-story` — Manual story implementation (invoked by orchestrator)
- `/bmad-bmm-code-review` — Code review workflow (for interactive use; reviewer subagent uses its own inline methodology)
- `/bmad-bmm-sprint-status` — View sprint status
- `/project-start-story` — Manual story start (branch + issue)
- `/project-run-tests` — Run test suite manually
