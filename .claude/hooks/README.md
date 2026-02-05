# Claude Code Hooks

Deterministic enforcement layer for AI Learning Hub. Hooks run at PreToolUse, PostToolUse, and Stop. Configuration is in `.claude/settings.json`.

**Architecture and enforcement matrix:** See `_bmad-output/planning-artifacts/diagrams/06-hooks-enforcement-strategy.md`.

## Scripts

| Script                    | Phase                               | Purpose                                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **bash-guard.js**         | PreToolUse (Bash)                   | Blocks catastrophic/high-risk commands (e.g. `rm -rf /`, force push, credential echo, exfiltration). Escalates `git push main`, `cdk deploy`, `rm -rf`. Tiered safety: `critical` / `high` (default) / `strict` via `CLAUDE_SAFETY_LEVEL`. |
| **file-guard.js**         | PreToolUse (Read\|Edit\|Write)      | Blocks auto-modification of CLAUDE.md, .env, lock files, .git/, node_modules/, \_bmad-output/planning-artifacts/. Allows .env.example etc. Escalates infra/, .github/, .claude/hooks/.                                                     |
| **architecture-guard.sh** | PreToolUse (Edit\|Write)            | Enforces ADR-007 (no Lambda-to-Lambda), ADR-006 (DynamoDB key patterns), ADR-014 (handlers use @ai-learning-hub/db).                                                                                                                       |
| **import-guard.sh**       | PreToolUse (Edit\|Write)            | Denies Lambda/backend TS files using DynamoDB/Logger/Zod/middleware without @ai-learning-hub/\*. Skips shared/ and non-TS.                                                                                                                 |
| **tdd-guard.js**          | PreToolUse (Write\|Edit\|MultiEdit) | Optional: blocks implementation file writes when no failing tests in .claude/tdd-guard/data/test.json; test file writes always allowed.                                                                                                    |
| **auto-format.sh**        | PostToolUse (Edit\|Write)           | Runs Prettier and ESLint --fix for TS/JS/JSON/MD (and YAML).                                                                                                                                                                               |
| **type-check.sh**         | PostToolUse (Edit\|Write)           | Runs `tsc --noEmit` for TS files; outputs hookSpecificOutput with errors (context only, does not block).                                                                                                                                   |
| **Stop**                  | Stop                                | Agent prompt: verify npm test (and 80%+ coverage where enforced), npm run lint, npm run build; block stop if any fails.                                                                                                                    |

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

**tdd-guard (allow when tests failing):** Ensure `.claude/tdd-guard/data/test.json` has `"failed": 1` (or more), then write an impl file; should allow. With `"failed": 0`, impl writes can be blocked (test writes always allowed).

Shell scripts (`.sh`) must be executable: `chmod +x .claude/hooks/*.sh` if needed.
