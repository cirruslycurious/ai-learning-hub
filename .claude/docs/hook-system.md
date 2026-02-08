# Hook System: Deterministic Tool-Call Enforcement

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Active in Epic 1 (stories 1.1–1.9 complete, 1.10–1.14 remaining)

## Overview

The hook system provides **deterministic blocking** at the tool-call level. Hooks intercept operations before they execute (PreToolUse), auto-correct after execution (PostToolUse), and validate before task completion (Stop). This is Layer 1 of our [three-layer safety architecture](./safety-architecture.md).

## Architecture

### Claude Code Hooks

**Configuration:** `.claude/settings.json`
**Scripts:** `.claude/hooks/` (6 executable scripts)

**Hook Registration Structure:**

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": ["bash-guard.js"] },
      {
        "matcher": "Edit|Write",
        "hooks": [
          "file-guard.js",
          "architecture-guard.sh",
          "import-guard.sh",
          "tdd-guard.js"
        ]
      }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": ["auto-format.sh", "type-check.sh"] }
    ],
    "Stop": [
      { "hooks": [{ "type": "agent", "prompt": "...quality gates..." }] }
    ]
  }
}
```

See [`.claude/settings.json`](../../.claude/settings.json) for full configuration with timeouts and command paths.

### Cursor Rules

**Location:** `.cursor/rules/*.mdc` (11 files)

Cursor rules mirror Claude Code hooks for IDE consistency. When working in Cursor, the same safety rules apply.

## Hook Catalog

### 1. bash-guard (PreToolUse)

**Purpose:** Blocks dangerous bash commands, escalates high-risk operations.

**Location:**

- `.claude/hooks/bash-guard.js` (Claude Code)
- `.cursor/rules/bash-guard.mdc` (Cursor IDE)

**Trigger:** Any `Bash` tool use

**Blocked Operations (Catastrophic):**

- `rm -rf /` — Deleting root directory
- `rm -rf ~` — Deleting home directory
- `:(){ :|:& };:` — Fork bombs
- `dd if=... of=/dev/sd*` — Direct disk writes
- `mkfs` — Filesystem format
- `chmod -R 777 /` — Recursive chmod 777 on root

**Blocked Operations (High Risk):**

- `git push --force main` / `git push --force master` — Force push to protected branches
- `git reset --hard` — Destructive git reset
- `git clean -fd` — Force delete untracked files
- `git checkout .` — Discard all changes
- `cat .env` / `echo $AWS_SECRET_ACCESS_KEY` — Credential exposure
- `curl/wget --post-file .env` — Exfiltration of secrets
- `DROP TABLE` / `DROP DATABASE` / `TRUNCATE` — Destructive database operations
- `sudo rm` / `chown -R` — Destructive system operations

**Escalate Operations (Ask User):**

- `git push` to main/master — Requires explicit approval
- `npm publish` — Publish to npm registry
- `cdk deploy` — Deploy to AWS
- `aws ... delete` — AWS resource deletion
- `rm -rf <directory>` — Recursive forced deletion
- `terraform destroy` — Destroy infrastructure

**Safe Alternatives Suggested:**

```bash
# Instead of: git reset --hard
# Suggests: git status, git diff, git restore <file>

# Instead of: cat .env
# Suggests: Use .env.example or documented env vars

# Instead of: git push main
# Suggests: Create feature branch, use PR workflow
```

**Example Block:**

```
❌ bash-guard.js BLOCKED
Command: git push --force origin main
Reason: Force push to main/master is prohibited
Safe alternative: Use 'git push' or create feature branch
```

**Self-Correction Pattern:**
Agent sees block → reads error message → adjusts approach → retries with safe alternative.

---

### 2. file-guard (PreToolUse)

**Purpose:** Protects critical files from automatic modification, escalates sensitive directory edits.

**Location:**

- `.claude/hooks/file-guard.js` (Claude Code)
- `.cursor/rules/file-guard.mdc` (Cursor IDE)

**Trigger:** Any `Edit` or `Write` tool use

**Never Auto-Modify (Human-Owned Files):**

- `CLAUDE.md` — Project instructions (human-maintained)
- `.claude/settings.json` — Hook configuration
- `.env`, `.env.local`, `.env.production`, `.env.development` — Secrets
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` — Lockfiles
- `.gitignore` — Prevents accidental exposure of secrets

**Allowed .env Variants (Can Edit):**

- `.env.example`, `.env.sample`, `.env.template`, `.env.schema`, `.env.defaults`, `.env.test`

**Escalate (Ask Before Modifying):**

- `infra/` — CDK stacks affect production
- `.github/` — CI/CD workflows
- `.claude/hooks/` — Hook scripts are critical
- `_bmad-output/planning-artifacts/` — Planning docs are human-owned

**Never Auto-Modify (Sensitive Patterns):**

- Files matching `*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`
- Paths containing `credentials`, `secrets`, `passwords` in the name

**Example Block:**

```
❌ file-guard.js BLOCKED
File: CLAUDE.md
Reason: CLAUDE.md is human-owned and cannot be modified by agents
Action: If user explicitly requests change, ask for confirmation
```

**Escalation Example:**

```
⚠️ file-guard.js ESCALATE
File: infra/lib/api-stack.ts
Reason: Modifications to infra/ affect production. Please confirm changes.
Options:
  a) Proceed with edit (user approved)
  b) Cancel edit
```

---

### 3. tdd-guard (PreToolUse)

**Purpose:** Enforces Test-Driven Development workflow by blocking implementation before tests.

**Location:**

- `.claude/hooks/tdd-guard.js` (Claude Code)
- `.cursor/rules/tdd-guard.mdc` (Cursor IDE)

**Trigger:** `Edit` or `Write` tool use in implementation files

**Rule:** Implementation files cannot be created/edited before corresponding test files exist.

**Detects Implementation Files:**

- `backend/functions/*/handler.ts`
- `backend/functions/*/index.ts`
- `shared/*/src/**/*.ts` (excluding test files)
- `frontend/src/**/*.tsx` (excluding test files)

**Requires Test Files:**

- `backend/functions/*/handler.test.ts` (for handlers)
- `shared/*/src/**/*.test.ts` (for shared libs)
- `frontend/src/**/*.test.tsx` (for components)

**Example Block:**

```
❌ tdd-guard.js BLOCKED
Implementation file: backend/functions/save-url/handler.ts
Missing test file: backend/functions/save-url/handler.test.ts

Action Required:
1. Create handler.test.ts with test cases
2. Run tests and ensure they fail (Red phase)
3. Implement handler.ts to make tests pass (Green phase)
4. Refactor if needed (Refactor phase)

TDD Workflow: Red → Green → Refactor
```

**Bypasses:**

- Test files themselves (obviously)
- Config files (`tsconfig.json`, `jest.config.js`, etc.)
- Type definition files (`*.d.ts`)
- Documentation files (`*.md`)

---

### 4. architecture-guard (PreToolUse)

**Purpose:** Enforces Architecture Decision Records (ADRs), blocks violations.

**Location:**

- `.claude/hooks/architecture-guard.sh` (Claude Code)
- `.cursor/rules/architecture-guard.mdc` (Cursor IDE)

**Trigger:** `Edit` or `Write` tool use in implementation files

**Enforced ADRs:**

**ADR-007: No Lambda-to-Lambda Direct Calls**

```bash
# Blocks:
import { handler as otherLambda } from '../other-lambda/handler';
await otherLambda(event);

# Requires:
# Use API Gateway or EventBridge for inter-Lambda communication
```

**ADR-006: DynamoDB Single-Table Design**

```bash
# Validates:
- PK format: USER#{userId}, CONTENT#{urlHash}, PROJECT#{projectId}
- SK format: METADATA, SAVE#{saveId}, PROJECT#{projectId}
- Consistent key patterns across tables
```

**ADR-005: Shared Library Usage (Enforced by import-guard)**

**Example Block:**

```
❌ architecture-guard.sh BLOCKED
File: backend/functions/save-url/handler.ts
Violation: Direct Lambda-to-Lambda call detected
Line 15: await enrichContentLambda(event);

ADR-007: Lambda functions must communicate via:
  - API Gateway (synchronous)
  - EventBridge (asynchronous)
  - Step Functions (orchestration)

Refactor Required:
1. Remove direct import of enrichContentLambda
2. Emit EventBridge event or call via API
3. See docs/architecture/adr/007-no-lambda-to-lambda.md
```

---

### 5. import-guard (PreToolUse)

**Purpose:** Enforces shared library usage in Lambda functions, prevents code duplication.

**Location:**

- `.claude/hooks/import-guard.sh` (Claude Code)
- `.cursor/rules/import-guard.mdc` (Cursor IDE)

**Trigger:** `Edit` or `Write` tool use in Lambda handler files

**Rule:** All Lambda functions MUST import from `@ai-learning-hub/*` shared packages.

**Required Imports:**

- `@ai-learning-hub/logging` — Structured logging + X-Ray (ALL Lambdas)
- `@ai-learning-hub/middleware` — Auth, error handling, validation (ALL API Lambdas)
- `@ai-learning-hub/db` — DynamoDB client + query helpers (ALL data access)
- `@ai-learning-hub/validation` — Zod schemas (ALL API Lambdas)
- `@ai-learning-hub/types` — Shared TypeScript types (ALL code)

**Example Block:**

```
❌ import-guard.sh BLOCKED
File: backend/functions/save-url/handler.ts
Missing imports: @ai-learning-hub/logging, @ai-learning-hub/middleware

Required imports for all Lambda handlers:
  import { logger } from '@ai-learning-hub/logging';
  import { withMiddleware, authMiddleware, errorHandler } from '@ai-learning-hub/middleware';
  import { dynamoClient } from '@ai-learning-hub/db';
  import { SaveUrlSchema } from '@ai-learning-hub/validation';

Why: Shared libraries ensure consistent logging, error handling, and patterns across all Lambdas.
See: ADR-005 (Shared Lambda Layer)
```

---

### 6. auto-format (PostToolUse)

**Purpose:** Automatically formats code after edits using Prettier + ESLint.

**Location:**

- `.claude/hooks/auto-format.sh` (Claude Code only, no Cursor equivalent needed)

**Trigger:** `Edit` or `Write` tool use completes successfully

**Actions:**

```bash
# Run Prettier on edited file
npx prettier --write <file>

# Run ESLint auto-fix on edited file
npx eslint --fix <file>
```

**Enforcement Level:** **Auto-Correct** (not blocking)

**Behavior:**

- Runs silently after every edit
- Automatically fixes formatting issues
- Does NOT block if formatting fails (logs warning)
- Agent sees formatted code on next read

**Example:**

```
✅ auto-format.sh SUCCESS
File: backend/functions/save-url/handler.ts
Actions:
  - Prettier: Fixed 3 formatting issues
  - ESLint: Fixed 2 auto-fixable issues (unused imports)
```

---

### 7. type-check (PostToolUse)

**Purpose:** Validates TypeScript compilation after edits.

**Location:**

- `.claude/hooks/type-check.sh` (Claude Code only)

**Trigger:** `Edit` or `Write` tool use completes successfully

**Actions:**

```bash
# Run TypeScript compiler in no-emit mode
npx tsc --noEmit --project <tsconfig-for-file>
```

**Enforcement Level:** **Validation** (logs errors, doesn't block edit)

**Behavior:**

- Runs after auto-format completes
- Reports type errors to agent
- Agent can see errors and fix them iteratively
- Does NOT rollback the edit (non-blocking)

**Example:**

```
⚠️ type-check.sh VALIDATION FAILED
File: backend/functions/save-url/handler.ts
Errors:
  Line 42: Property 'userId' does not exist on type 'Event'
  Line 56: Type 'string | undefined' is not assignable to type 'string'

Action Required: Fix type errors before proceeding
```

---

### 8. test-validator (Stop Hook, Agent-Based)

**Purpose:** Blocks task completion if tests fail or coverage < 80%.

**Location:**

- `.claude/settings.json` (Stop hook configuration)

**Trigger:** Agent attempts to complete task (stop the session)

**Type:** Agent-based (spawns subagent to run validation)

**Actions:**

```bash
# Run full test suite with coverage
npm test -- --coverage

# Run lint
npm run lint

# Run build
npm run build
```

**Enforcement Level:** **Blocking** (prevents task completion)

**Behavior:**

- Spawns agent to run quality gates
- If ANY check fails → blocks completion, agent must fix
- If all checks pass → allows task completion
- Coverage threshold: 80% (configurable)

**Example Block:**

```
❌ test-validator BLOCKED COMPLETION
Reason: Tests failing

Test Results:
  ✅ 45 tests passing
  ❌ 3 tests failing
    - save-url.test.ts: "should validate URL format" FAILED
    - save-url.test.ts: "should handle duplicate URLs" FAILED
    - save-url.test.ts: "should enrich metadata" FAILED

Coverage: 72% (below 80% threshold)

Action Required:
1. Fix failing tests
2. Add tests to reach 80% coverage
3. Re-run 'npm test'
4. Try completing task again
```

---

## Cursor Rules (IDE Mirroring)

Cursor rules mirror Claude Code hooks for IDE consistency:

| Cursor Rule              | Mirrors Hook                                          | Purpose                       |
| ------------------------ | ----------------------------------------------------- | ----------------------------- |
| `bash-guard.mdc`         | `bash-guard.js`                                       | Command safety                |
| `file-guard.mdc`         | `file-guard.js`                                       | Protected paths               |
| `tdd-guard.mdc`          | `tdd-guard.js`                                        | TDD workflow                  |
| `architecture-guard.mdc` | `architecture-guard.sh`                               | ADR compliance                |
| `import-guard.mdc`       | `import-guard.sh`                                     | Shared lib usage              |
| `quality-gates.mdc`      | `auto-format.sh` + `type-check.sh` + `test-validator` | Post-edit and pre-done checks |
| `pr-workflow.mdc`        | N/A (workflow guidance)                               | Branch/PR conventions         |
| `react.mdc`              | N/A (domain-specific)                                 | React patterns                |
| `lambda.mdc`             | N/A (domain-specific)                                 | Lambda patterns               |
| `testing.mdc`            | N/A (domain-specific)                                 | Test patterns                 |
| `general.mdc`            | N/A (domain-specific)                                 | General coding patterns       |

**Why Mirroring?**

- Developers work in Cursor IDE (human)
- Agents work in Claude Code (AI)
- Both see the same rules → consistent behavior
- Human learns patterns that agents follow
- No surprises when switching contexts

---

## How Agents Navigate Hooks

### Self-Correction Loop

1. **Agent attempts operation** (e.g., `git push --force main`)
2. **Hook blocks** with error message + safe alternative
3. **Agent reads error** and understands the violation
4. **Agent adjusts approach** (e.g., creates feature branch instead)
5. **Agent retries** with safe alternative
6. **Hook allows** new operation

**Example:**

```
Agent: git push --force origin main
Hook: ❌ BLOCKED - Force push to main prohibited. Use feature branch.
Agent: git checkout -b feature/story-1-2
Agent: git push -u origin feature/story-1-2
Hook: ✅ ALLOWED
```

### Escalation to Human

If agent violates hook >3 times in a row:

- Hook escalates to orchestrator
- Orchestrator marks story as `blocked`
- Orchestrator prompts human:

  ```
  ⚠️ Story X.Y Blocked by Hook Violations
  Hook: bash-guard.js
  Violations: 4 attempts to run 'git push --force'

  Options:
    a) Manual fix (human intervention)
    b) Override hook (not recommended)
    c) Skip story
  ```

### Progressive Learning

Agents learn patterns over time within a session:

- First violation → block + explain
- Second violation (same pattern) → block + remind
- Third violation (same pattern) → block + escalate

Across sessions, the project retains knowledge via:

- CLAUDE.md patterns (loaded from the repo)
- ADR documents (persistent architecture decisions)
- Hook error messages (self-documenting, embedded in scripts)

---

## Hook Maintenance

### Adding a New Hook

1. **Write hook script** in `.claude/hooks/new-hook.sh`
2. **Make executable:** `chmod +x .claude/hooks/new-hook.sh`
3. **Update `.claude/settings.json`** to register hook
4. **Create Cursor mirror** in `.cursor/rules/new-hook.mdc`
5. **Test:** Run hook manually with sample input
6. **Document:** Update this file with hook details

### Testing Hooks

```bash
# Test bash-guard
.claude/hooks/bash-guard.js "git push --force main"

# Test file-guard
.claude/hooks/file-guard.js "CLAUDE.md"

# Test architecture-guard
.claude/hooks/architecture-guard.sh "backend/functions/save-url/handler.ts"

# Test import-guard
.claude/hooks/import-guard.sh "backend/functions/save-url/handler.ts"

# Test auto-format
.claude/hooks/auto-format.sh "backend/functions/save-url/handler.ts"

# Test type-check
.claude/hooks/type-check.sh "backend/functions/save-url/handler.ts"
```

### Hook Performance

| Hook               | Typical Latency | Timeout | Impact            |
| ------------------ | --------------- | ------- | ----------------- |
| bash-guard         | <50ms           | 5s      | Negligible        |
| file-guard         | <50ms           | 5s      | Negligible        |
| tdd-guard          | <100ms          | 5s      | Negligible        |
| architecture-guard | <200ms          | 5s      | Negligible        |
| import-guard       | <200ms          | 5s      | Negligible        |
| auto-format        | 1-3s            | 30s     | Low (async)       |
| type-check         | 2-10s           | 60s     | Low (async)       |
| test-validator     | 10-60s          | 300s    | Medium (blocking) |

---

## Integration with Orchestrator

Hooks are **Layer 1** of the safety architecture. Orchestrator is **Layer 2**.

**Orchestrator relies on hooks for:**

- Blocking dangerous commands during story implementation
- Enforcing TDD during dev-story execution
- Auto-formatting code after edits
- Validating tests pass before marking story complete

**Hooks rely on orchestrator for:**

- Escalation when violations exceed threshold
- Context about which story is being implemented
- State management (tracking violations across operations)

**Example Flow:**

```
Orchestrator: Invoke /bmad-bmm-dev-story for Story 1.2
  ↓
Dev-story: Implement handler.ts
  ↓
Hook (tdd-guard): BLOCK - No test file exists
  ↓
Dev-story: Create handler.test.ts first
  ↓
Hook (tdd-guard): ALLOW
  ↓
Dev-story: Implement handler.ts
  ↓
Hook (auto-format): Auto-format code
  ↓
Hook (type-check): Validate TypeScript
  ↓
Dev-story: Mark implementation complete
  ↓
Hook (test-validator): Run tests, check coverage
  ↓
Hook (test-validator): ALLOW (tests pass, 85% coverage)
  ↓
Orchestrator: Story 1.2 ready for review
```

---

## Further Reading

- [Safety Architecture Overview](./safety-architecture.md) — Three-layer model
- [Orchestrator Safety Details](./orchestrator-safety.md) — Workflow-level safety
- [Tool Risk Classification](./tool-risk.md) — Operation risk matrix
- [ADR Documents](../../_bmad-output/planning-artifacts/architecture.md) — Architecture decisions

---

## Document Organization

This document combines:

- **Specification** — What operations are blocked and why
- **Mechanism** — How hooks execute and integrate with tools
- **Operational Guidance** — How agents navigate hooks and self-correct
- **Maintenance** — How to add, test, and monitor hooks

For conceptual overview, see [Safety Architecture](./safety-architecture.md).
For orchestrator integration, see [Orchestrator Safety](./orchestrator-safety.md).

---

**Last Updated:** 2026-02-07
**Maintainer:** Stephen (human-owned)
**Status:** Active in Epic 1 (stories 1.1–1.9 complete, 1.10–1.14 remaining)
