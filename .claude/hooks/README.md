# Claude Code Hooks

Deterministic enforcement layer for AI Learning Hub. Hooks run at PreToolUse, PostToolUse, and Stop. Configuration is in `.claude/settings.json`.

**Architecture and enforcement matrix:** See `_bmad-output/planning-artifacts/diagrams/06-hooks-enforcement-strategy.md`.

## Scripts

| Script                            | Phase                               | Purpose                                                                                                                                                                                                                                                                                        |
| --------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **bash-guard.js**                 | PreToolUse (Bash)                   | Blocks catastrophic/high-risk commands (e.g. `rm -rf /`, force push, credential echo, exfiltration). Escalates `git push main`, `cdk deploy`, `rm -rf`. Tiered safety: `critical` / `high` (default) / `strict` via `CLAUDE_SAFETY_LEVEL`.                                                     |
| **file-guard.js**                 | PreToolUse (Read\|Edit\|Write)      | Blocks auto-modification of CLAUDE.md, .env, lock files, .git/, node_modules/, \_bmad-output/planning-artifacts/. Allows .env.example etc. Escalates infra/, .github/, .claude/hooks/.                                                                                                         |
| **architecture-guard.sh**         | PreToolUse (Edit\|Write)            | Enforces ADR-007 (no Lambda-to-Lambda), ADR-006 (DynamoDB key patterns), ADR-014 (handlers use @ai-learning-hub/db).                                                                                                                                                                           |
| **import-guard.sh**               | PreToolUse (Edit\|Write)            | Denies Lambda/backend TS files using DynamoDB/Logger/Zod/middleware without @ai-learning-hub/\*. Skips shared/ and non-TS.                                                                                                                                                                     |
| **pipeline-guard.cjs**            | PreToolUse (Edit\|Write)            | Protects writing pipeline integrity: (1) denies writes to guides/, agents/, templates/ (always); (2) denies overwrites of previous artifacts; (3) warns on non-standard filenames; (4) denies artifact writes if required guides were not Read. Reads `state.yaml` for current step and agent. |
| **pipeline-read-tracker.cjs**     | PostToolUse (Read)                  | Records breadcrumbs when pipeline guide files are Read. Used by pipeline-guard.cjs to verify guides were actually loaded (not just claimed). Breadcrumbs expire after 2 hours. Stored in `.claude/.pipeline-reads.json`.                                                                       |
| **tdd-guard.js**                  | PreToolUse (Write\|Edit\|MultiEdit) | Optional: blocks implementation file writes when no failing tests in .claude/tdd-guard/data/test.json; test file writes always allowed.                                                                                                                                                        |
| **story-guard.cjs**               | PreToolUse (Skill\|Task)            | Blocks dev-story execution unless the story file exists AND passes readiness validation: YAML frontmatter (id, title), ≥2 acceptance criteria, dev notes/task breakdown, ready-for-dev status. Deterministic backing for SKILL.md Phase 1.2 + 1.2a. Toggle: `STORY_GUARD_ENABLED=false`.       |
| **commit-gate.cjs**               | Orchestrator (Phase 2.2)            | Verifies changes are committed to branch before review. Checks `git diff --stat` and untracked `.ts`/`.tsx` files in story-relevant directories.                                                                                                                                               |
| **cdk-synth-gate.cjs**            | Orchestrator (Phase 2.2)            | Conditional CDK synth verification — auto-detects infra changes and runs `cdk synth --quiet`. Skips when no `infra/` files changed.                                                                                                                                                            |
| **ac-verify-validator.cjs**       | Orchestrator (Phase 2.2)            | Validates structured AC verification JSON — checks each AC has impl file, test file, and real (not mock-only) behavior.                                                                                                                                                                        |
| **temp-cleanup.cjs**              | Orchestrator (Phase 2.5)            | Removes stray quality gate artifacts from project root (`quality-gate-*.json`, `secrets-*.json`, `test-output*.txt`).                                                                                                                                                                          |
| **prompt-template-validator.cjs** | Standalone / CI                     | Validates reviewer and fixer prompt templates in `review-loop.md` contain required fields (`Base branch`, `Expected files`, `Coverage baseline`, `Output path`). Also validates agent definition docs match prompt templates.                                                                  |
| **auto-format.sh**                | PostToolUse (Edit\|Write)           | Runs Prettier and ESLint --fix for TS/JS/JSON/MD (and YAML).                                                                                                                                                                                                                                   |
| **type-check.sh**                 | PostToolUse (Edit\|Write)           | Runs `tsc --noEmit` for TS files; outputs hookSpecificOutput with errors (context only, does not block).                                                                                                                                                                                       |
| **Stop**                          | Stop                                | Agent prompt: verify npm test (and 80%+ coverage where enforced), npm run lint, npm run build; block stop if any fails.                                                                                                                                                                        |

## Requirements

- **Node.js** — for `bash-guard.js`, `file-guard.js`, `pipeline-guard.cjs`, `pipeline-read-tracker.cjs`, `tdd-guard.js`, `story-guard.cjs`
- **jq** — for shell hooks (`architecture-guard.sh`, `import-guard.sh`, `auto-format.sh`, `type-check.sh`). Install: `brew install jq` (macOS), or your system package manager

## How to test hooks

Feed sample JSON on stdin. Exit 0 = allow; exit 2 = deny. For escalation/deny, expect JSON with `hookSpecificOutput.permissionDecision` and `permissionDecisionReason`.

**bash-guard (block):**

```bash
echo '{"tool_input":{"command":"git push -f origin main"}}' | node .claude/hooks/bash-guard.js
# Expected: exit 2, stderr message
```

**bash-guard (escalate):**

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | node .claude/hooks/bash-guard.js
# Expected: exit 0, JSON with permissionDecision: "ask"
```

**file-guard (deny):**

```bash
echo '{"tool_input":{"file_path":"CLAUDE.md"},"tool_name":"Write"}' | node .claude/hooks/file-guard.js
# Expected: exit 0, JSON with permissionDecision: "deny"
```

**file-guard (allow .env.example):**

```bash
echo '{"tool_input":{"file_path":".env.example"},"tool_name":"Write"}' | node .claude/hooks/file-guard.js
# Expected: exit 0, no deny
```

**architecture-guard (deny Lambda-to-Lambda):**

```bash
echo '{"tool_input":{"file_path":"x.ts","content":"lambda.invoke()"}}' | .claude/hooks/architecture-guard.sh
# Expected: exit 0, JSON with permissionDecision: "deny"
```

**import-guard (deny direct DynamoDB):**

```bash
echo '{"tool_input":{"file_path":"backend/functions/foo/handler.ts","content":"new DynamoDBClient()"}}' | .claude/hooks/import-guard.sh
# Expected: exit 0, JSON with permissionDecision: "deny"
```

**pipeline-guard (deny infrastructure write):**

```bash
echo '{"tool_input":{"file_path":"docs/writing-pipeline/guides/style-guide.md"},"tool_name":"Write"}' | node .claude/hooks/pipeline-guard.cjs
# Expected: exit 0, JSON with permissionDecision: "deny"
```

**pipeline-guard (deny previous artifact overwrite):**

```bash
# Requires an active project with state.yaml showing current_step: 6
echo '{"tool_input":{"file_path":"docs/writing-pipeline/projects/my-guide/04-draft-v1.md"},"tool_name":"Edit"}' | node .claude/hooks/pipeline-guard.cjs
# Expected: exit 0, JSON with permissionDecision: "deny" (artifact 04 is before step 6's output 08)
```

**pipeline-guard (allow current artifact):**

```bash
echo '{"tool_input":{"file_path":"docs/writing-pipeline/projects/my-guide/08-draft-v2.md"},"tool_name":"Write"}' | node .claude/hooks/pipeline-guard.cjs
# Expected: exit 0, no deny (08 matches step 6's expected output)
```

**tdd-guard (allow when tests failing):** Ensure `.claude/tdd-guard/data/test.json` has `"failed": 1` (or more), then write an impl file; should allow. With `"failed": 0`, impl writes can be blocked (test writes always allowed).

**story-guard (deny missing story file):**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"bmad-bmm-dev-story","args":"_bmad-output/implementation-artifacts/stories/nonexistent.md"}}' | node .claude/hooks/story-guard.cjs
# Expected: exit 0, JSON with permissionDecision: "deny" (file not found)
```

**story-guard (deny incomplete story — no ACs):**

```bash
# Create a stub story file first, then:
echo '{"tool_name":"Skill","tool_input":{"skill":"bmad-bmm-dev-story","args":"path/to/stub-story.md"}}' | node .claude/hooks/story-guard.cjs
# Expected: exit 0, JSON with permissionDecision: "deny" (missing acceptance criteria)
```

**story-guard (allow non-dev-story skill):**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"bmad-bmm-create-story","args":""}}' | node .claude/hooks/story-guard.cjs
# Expected: exit 0, no deny (not a dev-story invocation)
```

Shell scripts (`.sh`) must be executable: `chmod +x .claude/hooks/*.sh` if needed.
