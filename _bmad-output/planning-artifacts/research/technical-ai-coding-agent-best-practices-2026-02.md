# AI Coding Agent Best Practices Research

**Research Date:** February 2026
**Scope:** Claude Code, Cursor, Aider, Cline, and similar AI coding agents
**Purpose:** Comprehensive findings on enabling AI coding agents to build software effectively

---

## Table of Contents

1. [CLAUDE.md / Rules Files Structure](#1-claudemd--rules-files-structure)
2. [Guardrails and Constraints](#2-guardrails-and-constraints) *(expanded with tool risk, human intervention)*
3. [Hooks: Deterministic Enforcement](#3-hooks-deterministic-enforcement) *(NEW - critical for compliance)*
4. [Git/GitHub Workflow for Agents](#4-gitgithub-workflow-for-agents)
5. [Context and Memory](#5-context-and-memory)
6. [Testing and Validation](#6-testing-and-validation)
7. [Project Structure](#7-project-structure)
8. [Agent Orchestration Patterns](#8-agent-orchestration-patterns) *(from OpenAI/Google)*
9. [Prompt Engineering for Agents](#9-prompt-engineering-for-agents) *(from Anthropic)*
10. [Model Selection & Cost Optimization](#10-model-selection--cost-optimization) *(from Claude Code Playbook)*
11. [Anti-patterns to Avoid](#11-anti-patterns-to-avoid)
12. [Tool-Specific Recommendations](#12-tool-specific-recommendations)
13. [Sources](#13-sources) *(expanded)*

---

## 1. CLAUDE.md / Rules Files Structure

### What Is CLAUDE.md?

CLAUDE.md is a special markdown file that Claude Code automatically loads into context at the start of every conversation. It serves as the primary configuration point for providing project-specific guidance to the AI agent. Similar concepts exist across tools:

| Tool | File/Location |
|------|---------------|
| Claude Code | `CLAUDE.md`, `.claude/CLAUDE.md` |
| Cursor | `.cursor/rules/*.mdc` (replaces deprecated `.cursorrules`) |
| GitHub Copilot | `.copilot-instructions.md`, `.github/copilot-instructions.md` |
| Aider | `.aider.conf.yml`, conventions in prompt |
| Multi-tool | `AGENTS.md` (emerging standard, 60k+ projects) |

### Best Practices for CLAUDE.md

#### Keep It Concise
- **Target length:** Less than 300 lines (ideally under 100)
- Research indicates frontier LLMs can follow approximately 150-200 instructions consistently
- Claude Code's system prompt already contains ~50 instructions, leaving limited headroom
- Shorter files perform better because irrelevant context degrades LLM performance

#### Use the WHY-WHAT-HOW Framework

```markdown
## WHAT (Technology & Structure)
- Tech stack: React + Vite, AWS Lambda, DynamoDB
- Monorepo structure with /frontend, /backend, /infra
- Key entry points: App.tsx for routes, stores/ for state

## WHY (Purpose & Context)
- Personal learning project management system
- Optimized for solo developer workflow
- Mobile-first responsive design

## HOW (Working Instructions)
- Build: npm run build
- Test: npm test (vitest)
- Deploy: cdk deploy (from /infra)
- Always run tests before committing
```

#### Progressive Disclosure Pattern
Don't cram everything into CLAUDE.md. Create separate task-specific files:

```
.claude/
  CLAUDE.md              # Core config only
  commands/              # Custom slash commands
    fix-github-issue.md
    review-pr.md
  docs/                  # Reference materials
    architecture.md
    testing-patterns.md
    database-schema.md
```

Reference these in CLAUDE.md so Claude loads them on-demand rather than always.

#### What to Include

**DO Include:**
- Essential build/test/lint commands
- Project structure overview ("map of the codebase")
- Key architectural decisions and constraints
- Naming conventions that aren't enforced by linters
- Links to detailed docs (not the content itself)
- Technology stack and versions
- Critical "gotchas" or non-obvious behaviors

**DO NOT Include:**
- Code style guidelines (use linters instead)
- Everything from your documentation
- Task-specific workarounds or hotfixes
- Auto-generated content without review
- Extensive examples (reference files instead)

#### Avoid Auto-Generation
Do not use `/init` or similar auto-generation. Since CLAUDE.md affects every workflow phase, manually craft every line. A bad instruction cascades throughout planning and implementation.

### Cursor Rules (.cursor/rules/)

Cursor has moved from `.cursorrules` to individual `.mdc` files for better organization:

```
.cursor/
  rules/
    general.mdc       # Always-applied rules
    react.mdc         # Applied when working on React files
    testing.mdc       # Applied during test generation
```

**Key principles:**
- Keep each rule file under 500 lines
- Use descriptive names that indicate when rules apply
- Rules are additive - relevant rules activate based on context
- Check rules into git for team-wide consistency

### AGENTS.md (Emerging Standard)

AGENTS.md is becoming the universal format for AI coding agents, supported across tools:

```markdown
# AGENTS.md

## Build & Test
- `npm install` - Install dependencies
- `npm test` - Run test suite (must pass before PR)
- `npm run lint` - Check code style

## Architecture
- See /docs/architecture.md for system design
- All API endpoints in /backend/handlers/
- Shared types in /shared/types/

## Conventions
- Use functional components with hooks
- Tests co-located with source files (*.test.ts)
- Branch naming: feature/issue-123-description
```

---

## 2. Guardrails and Constraints

### Types of Guardrails

#### Pre-execution Guardrails (Input)
Control what data/instructions the agent processes before action:
- Input validation
- Context filtering
- Access controls (blocking sensitive paths)
- **Relevance classifier** — Flags off-topic queries to keep agent focused
- **Safety classifier** — Detects jailbreak attempts or prompt injections

#### In-process Guardrails
Monitor decisions and enforce constraints in real-time:
- Scope limitations (don't touch system files)
- Operation restrictions (no destructive commands)
- Logic constraints (stay within intended scope)
- **Tool risk assessment** — Rate tools as low/medium/high risk based on reversibility and impact

#### Output Guardrails
Check responses before returning:
- Safety validation
- Compliance checks
- Sensitive data filtering
- **PII filter** — Prevents exposure of personally identifiable information
- **Output validation** — Ensures responses align with project conventions

### Practical Implementation

#### In CLAUDE.md / Rules Files

```markdown
## Safety Constraints

### NEVER Do
- Run `rm -rf`, `del /s /q`, or destructive commands
- Modify files outside the project directory
- Execute commands that require sudo/admin
- Touch .env files or credentials
- Delete git history or force push

### ALWAYS Do
- Create a new branch for each task
- Run tests before committing
- Ask for confirmation before bulk operations
- Keep changes focused on the current issue
```

#### Using Claude Code Hooks

Hooks provide deterministic control points:

```json
{
  "hooks": {
    "PreToolUse": {
      "matcher": "Bash",
      "command": "scripts/validate-command.sh",
      "description": "Block dangerous commands"
    },
    "PostToolUse": {
      "matcher": "Edit|Write",
      "command": "npm run lint:fix",
      "description": "Auto-format after edits"
    }
  }
}
```

### Common Agent Mistakes to Prevent

1. **Hallucinating file paths** - Create files in wrong locations
2. **Scope creep** - Fixing unrelated issues while working on a task
3. **Over-engineering** - Adding unnecessary abstractions
4. **Ignoring existing patterns** - Reinventing what already exists
5. **Destructive operations** - Deleting/overwriting without backup
6. **Outdated patterns** - Using deprecated APIs from training data

### Tool Risk Assessment

Assess the risk level of each tool/operation available to the agent:

| Risk Level | Characteristics | Examples | Guardrail Action |
|------------|-----------------|----------|------------------|
| **Low** | Read-only, reversible, no side effects | Reading files, search, git status | Allow automatically |
| **Medium** | Writes data, reversible with effort | Creating files, git commit, API calls | Log and allow |
| **High** | Irreversible, financial impact, external effects | Delete operations, production deploy, sending emails | Require human approval |

```markdown
## Tool Risk Classification

### Low Risk (Auto-approve)
- Read file contents
- Search codebase
- Run tests (read-only)
- Git status/log/diff

### Medium Risk (Log + Allow)
- Create/edit files
- Git commit (local)
- Install dependencies
- Run build

### High Risk (Human Approval Required)
- Delete files/directories
- Git push (especially force push)
- Deploy to any environment
- Modify environment variables
- Database migrations
- External API calls that mutate state
```

### Human Intervention Triggers

Define clear escalation points where the agent should stop and involve a human:

#### Failure Thresholds
```markdown
## When to Escalate to Human

### Automatic Escalation
- 3+ failed attempts at the same task
- Test suite fails after implementation
- Linter errors that can't be auto-fixed
- Build failures
- Merge conflicts

### Request Human Review
- Before any production deployment
- When modifying security-sensitive code
- When changing authentication/authorization logic
- When touching financial calculations
- When uncertain about requirements
```

#### High-Stakes Operations
```markdown
## Operations Requiring Human Approval

### Always Ask First
- Deleting any file or directory
- Force pushing to any branch
- Modifying CI/CD configuration
- Changing database schemas
- Updating environment variables
- Installing new dependencies
- Modifying .gitignore or security configs

### Never Do Without Explicit Request
- Push to main/master
- Deploy to production
- Modify access controls
- Delete git history
```

### Pattern Enforcement Mechanisms

#### Explicit File Path Requirements
Always use absolute paths in specs and instructions:
```markdown
## File Locations
- API handlers: /backend/handlers/{resource}.ts
- React components: /frontend/src/components/{Component}/
- Tests: Adjacent to source files as *.test.ts
```

#### Reference Existing Code
```markdown
## Patterns to Follow
- For new API endpoints, follow pattern in /backend/handlers/users.ts
- For new React components, see /frontend/src/components/Button/
- For database operations, use helpers in /backend/lib/dynamodb.ts
```

#### Shared Library Enforcement
```markdown
## Required Libraries
- HTTP requests: Use /shared/lib/api-client.ts (never raw fetch)
- Date handling: Use date-fns (not moment or native Date manipulation)
- State management: Zustand stores in /frontend/src/stores/
- Validation: Zod schemas in /shared/schemas/

## Forbidden
- Do not create new utility functions without checking /shared/lib/ first
- Do not add new dependencies without explicit approval
```

---

## 3. Hooks: Deterministic Enforcement

*Critical insight: CLAUDE.md is advisory — hooks are deterministic.*

### The Enforcement Gap

| Mechanism | Type | Can Agent Ignore? |
|-----------|------|-------------------|
| CLAUDE.md | Advisory | ✅ Yes (LLM chooses) |
| .claude/docs/ | Advisory | ✅ Yes (LLM chooses) |
| Hooks | **Deterministic** | ❌ No (code-level) |
| ESLint | Deterministic | ❌ No (build fails) |
| CI | Deterministic | ❌ No (merge blocked) |

**Key Finding:** Teams that rely solely on CLAUDE.md experience agents ignoring instructions 10-20% of the time. Hooks provide 100% enforcement.

### Hook Types

Claude Code supports three hook types:

#### 1. Command Hooks (`type: "command"`)
Execute shell scripts at lifecycle points:
- Receive JSON input via stdin
- Control behavior through exit codes:
  - Exit 0: Allow action
  - Exit 2: Block action (stderr message to Claude)
- Return structured JSON for nuanced control (allow/deny/ask)

#### 2. Prompt Hooks (`type: "prompt"`)
Use Claude model for yes/no decisions:
- Single-turn evaluation
- Returns `{ "ok": true }` or `{ "ok": false, "reason": "..." }`
- Good for fuzzy/contextual decisions

#### 3. Agent Hooks (`type: "agent"`)
Spawn subagents with tool access:
- Multi-turn capability (Read, Grep, Glob, Bash)
- Up to 50 tool-use turns
- Best for verification requiring actual execution (run tests, check coverage)

### Available Hook Events

| Event | When | Can Block? | Use Case |
|-------|------|-----------|----------|
| `SessionStart` | Session begins | No | Inject context, check prerequisites |
| `UserPromptSubmit` | User submits | Yes | Validate prompts, add context |
| `PreToolUse` | Before tool | **Yes** | Block dangerous ops, enforce patterns |
| `PostToolUse` | Tool succeeds | No | Format code, run validation |
| `Stop` | Agent finishes | **Yes** | Verify tests pass, no TODOs |
| `SessionEnd` | Session ends | No | Cleanup, logging |

### Tiered Safety Levels

*Pattern from karanb192/claude-code-hooks*

Configure hook strictness based on environment or trust level:

```javascript
const SAFETY_LEVEL = 'high'; // 'critical' | 'high' | 'strict'
const LEVELS = { critical: 1, high: 2, strict: 3 };

// Only block patterns at or below configured threshold
for (const p of PATTERNS) {
  if (LEVELS[p.level] <= threshold && p.regex.test(cmd)) {
    return { blocked: true, pattern: p };
  }
}
```

| Level | What's Blocked | Use Case |
|-------|---------------|----------|
| `critical` | Catastrophic only (rm -rf ~, fork bombs, dd to disk) | High-trust environments |
| `high` | + Risky (force push main, secrets exposure, git reset --hard) | **Recommended default** |
| `strict` | + Cautionary (any force push, sudo rm, docker prune) | Production/compliance |

### Comprehensive Pattern Library

*50+ regex patterns for dangerous commands and sensitive files*

**Dangerous Command Patterns (bash-guard):**
```javascript
// CRITICAL - Catastrophic, unrecoverable
{ level: 'critical', id: 'rm-home',     regex: /\brm\s+(-.+\s+)*["']?~\/?["']?/ },
{ level: 'critical', id: 'rm-root',     regex: /\brm\s+(-.+\s+)*\/(\*|\s|$)/ },
{ level: 'critical', id: 'dd-disk',     regex: /\bdd\b.+of=\/dev\/(sd[a-z]|nvme)/ },
{ level: 'critical', id: 'fork-bomb',   regex: /:\(\)\s*\{.*:\s*\|\s*:.*&/ },

// HIGH - Significant risk, data loss, security
{ level: 'high', id: 'curl-pipe-sh',    regex: /\b(curl|wget)\b.+\|\s*(ba)?sh\b/ },
{ level: 'high', id: 'git-force-main',  regex: /\bgit\s+push\b.+(--force|-f).+(main|master)/ },
{ level: 'high', id: 'git-reset-hard',  regex: /\bgit\s+reset\s+--hard/ },
{ level: 'high', id: 'chmod-777',       regex: /\bchmod\b.+\b777\b/ },
{ level: 'high', id: 'cat-env',         regex: /\b(cat|less|head|tail)\s+[^|;]*\.env\b/ },
{ level: 'high', id: 'echo-secret',     regex: /\becho\b.+\$\w*(SECRET|KEY|TOKEN|PASSWORD)/i },

// STRICT - Cautionary
{ level: 'strict', id: 'git-force-any', regex: /\bgit\s+push\b.+(--force|-f)\b/ },
{ level: 'strict', id: 'sudo-rm',       regex: /\bsudo\s+rm\b/ },
```

**Exfiltration Prevention (protect-secrets):**
```javascript
// Block data leaving the system — critical security gap most hooks miss
{ level: 'high', id: 'curl-upload-env',  regex: /\bcurl\b[^;|&]*(-d\s*@|-F\s*[^=]+=@)[^;|&]*(\.env|credentials|secrets|id_rsa)/i },
{ level: 'high', id: 'scp-secrets',      regex: /\bscp\b[^;|&]*(\.env|credentials|secrets|id_rsa)[^;|&]+:/i },
{ level: 'high', id: 'rsync-secrets',    regex: /\brsync\b[^;|&]*(\.env|credentials|secrets)[^;|&]+:/i },
{ level: 'high', id: 'nc-secrets',       regex: /\bnc\b[^;|&]*<[^;|&]*(\.env|credentials|secrets)/i },
{ level: 'high', id: 'wget-post',        regex: /\bwget\b[^;|&]*--post-file[^;|&]*(\.env|credentials)/i },
```

**Sensitive File Patterns (file-guard):**
```javascript
// CRITICAL - Always block
{ level: 'critical', id: 'env-file',        regex: /(?:^|\/)\.env(?:\.[^/]*)?$/ },
{ level: 'critical', id: 'ssh-private-key', regex: /(?:^|\/)\.ssh\/id_[^/]+$/ },
{ level: 'critical', id: 'aws-credentials', regex: /(?:^|\/)\.aws\/credentials$/ },
{ level: 'critical', id: 'pem-key',         regex: /\.pem$/i },

// HIGH - Block by default
{ level: 'high', id: 'secrets-file',        regex: /(?:^|\/)(secrets?|credentials?)\.(json|ya?ml)$/i },
{ level: 'high', id: 'docker-config',       regex: /(?:^|\/)\.docker\/config\.json$/ },
{ level: 'high', id: 'npmrc',               regex: /(?:^|\/)\.npmrc$/ },
{ level: 'high', id: 'pgpass',              regex: /(?:^|\/)\.pgpass$/ },
```

### Allowlist Patterns

Prevent false positives by explicitly allowing safe files:

```javascript
const ALLOWLIST = [
  /\.env\.example$/i,
  /\.env\.sample$/i,
  /\.env\.template$/i,
  /\.env\.schema$/i,
  /\.env\.defaults$/i,
];

function isAllowlisted(filePath) {
  return ALLOWLIST.some(p => p.test(filePath));
}

// Check allowlist before blocking
if (isAllowlisted(filePath)) return { blocked: false };
```

### JSONL Audit Logging

Log all hook events for debugging and audit trails:

```javascript
const LOG_DIR = path.join(process.env.HOME, '.claude', 'hooks-logs');

function log(data) {
  const file = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify({
    ts: new Date().toISOString(),
    hook: 'bash-guard',
    ...data
  }) + '\n');
}

// Log blocked actions
log({ level: 'BLOCKED', id: pattern.id, cmd, session_id });

// Log allowed actions (optional, for audit)
log({ level: 'ALLOWED', cmd, session_id });
```

**Log file location:** `~/.claude/hooks-logs/2026-02-04.jsonl`

### Recommended Hook Strategy

**PreToolUse Hooks (Block/Escalate):**

```bash
# bash-guard.js — Block dangerous commands with tiered safety
# - Configurable SAFETY_LEVEL (critical/high/strict)
# - 30+ regex patterns for dangerous operations
# - Exfiltration prevention (curl uploads, scp, rsync)
# - JSONL logging for audit trail
```

```bash
# file-guard.js — Protect sensitive files with allowlists
# - Blocks .env, SSH keys, AWS credentials, etc.
# - Allowlist for .env.example, .env.template
# - Configurable safety levels
```

```bash
# architecture-guard.sh — Enforce ADRs
# Block Lambda-to-Lambda calls
# Enforce shared library imports
# Validate DynamoDB key patterns
```

**PostToolUse Hooks (Auto-fix):**

```bash
# auto-format.sh — Run after edits
npx prettier --write "$FILE_PATH"
npx eslint --fix "$FILE_PATH"
```

**Stop Hooks (Quality Gates):**

```json
{
  "Stop": [{
    "hooks": [{
      "type": "agent",
      "prompt": "Run 'npm test' and verify 80%+ coverage. Block if tests fail.",
      "timeout": 300000
    }]
  }]
}
```

### Hook Response Formats

**Simple Block:**
```bash
echo "Blocked: Dangerous command" >&2
exit 2
```

**Structured Response:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Architecture violation: Use API Gateway instead"
  }
}
```

**Escalate to Human:**
```json
{
  "hookSpecificOutput": {
    "permissionDecision": "ask",
    "permissionDecisionReason": "High-risk: CDK deploy requires approval"
  }
}
```

### TDD Enforcement via Hooks

*Pattern from [tdd-guard](https://github.com/nizos/tdd-guard)*

Enforce test-driven development by intercepting write operations:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|TodoWrite",
        "hooks": [{
          "type": "command",
          "command": "tdd-guard"
        }]
      }
    ]
  }
}
```

**Key components:**

1. **File Type Detection** — Determine if file being written is test vs. implementation
2. **Test Result Capture** — Custom reporters write results to `.claude/tdd-guard/data/test.json`:
   ```json
   {
     "passed": 0,
     "failed": 2,
     "tests": [
       { "name": "should validate input", "status": "failed" },
       { "name": "should return correct value", "status": "failed" }
     ]
   }
   ```
3. **TDD Validation Logic** — Block implementation writes when:
   - No tests exist for the feature being implemented
   - Tests exist but none are failing (implementation already complete?)
   - Current test results show passing (need failing tests first)

**Multi-language reporter support:**
- JavaScript/TypeScript: Vitest reporter, Jest reporter, Storybook reporter
- Python: pytest plugin
- PHP: PHPUnit listener/extension (9.x-12.x)
- Go: CLI wrapper for `go test -json`
- Rust: CLI wrapper for `cargo nextest` / `cargo test`

**Monorepo support:**
```javascript
// vitest.config.ts
reporters: [['tdd-guard', { projectRoot: '/path/to/monorepo' }]]
```

**Session Control** — Allow toggling TDD enforcement via commands when prototyping:
- Enable: Strict TDD workflow enforced
- Disable: Normal editing allowed (prototyping mode)

### What to Enforce via Hooks vs. CLAUDE.md

| Requirement | CLAUDE.md | Hooks | Why |
|-------------|-----------|-------|-----|
| Coding style | ✅ | ✅ Auto-format | Both: guidance + enforcement |
| Shared library usage | ✅ | ✅ **Block** | Critical: must enforce |
| No force push | ✅ | ✅ **Block** | Cannot rely on LLM |
| Test before done | ✅ | ✅ **Stop hook** | Must verify |
| TDD workflow | ✅ | ✅ **PreToolUse** | Block impl without tests |
| Architecture patterns | ✅ | ✅ **Block** | Prevent violations |
| Commit message format | ✅ | ⚠️ Optional | Lower risk |
| Documentation style | ✅ | ❌ | Advisory OK |

### Hook File Organization

```
.claude/
├── settings.json           # Hook configuration
├── hooks/
│   ├── bash-guard.sh       # PreToolUse: dangerous commands
│   ├── file-guard.sh       # PreToolUse: protected files
│   ├── architecture-guard.sh # PreToolUse: ADR enforcement
│   ├── import-guard.sh     # PreToolUse: shared library usage
│   ├── auto-format.sh      # PostToolUse: Prettier + ESLint
│   └── type-check.sh       # PostToolUse: TypeScript
```

### Testing Hooks

Before relying on hooks, test each one:

```bash
# Test that bash-guard blocks force push
echo '{"tool_input":{"command":"git push -f"}}' | .claude/hooks/bash-guard.sh
# Expected: Exit 2, stderr message

# Test that file-guard protects CLAUDE.md
echo '{"tool_input":{"file_path":"CLAUDE.md"}}' | .claude/hooks/file-guard.sh
# Expected: JSON with permissionDecision: "deny"
```

### Key Insight

> "We spent weeks writing perfect CLAUDE.md instructions. The agent ignored half of them. Hooks fixed that overnight." — Senior engineer, fintech startup

**Rule:** Any requirement that agents MUST follow should have a corresponding hook, not just CLAUDE.md documentation.

---

## 4. Git/GitHub Workflow for Agents

### Branch Strategy

```markdown
## Branch Naming Convention
- feature/issue-{number}-{short-description}
- fix/issue-{number}-{short-description}
- chore/issue-{number}-{short-description}

## Examples
- feature/issue-42-add-user-auth
- fix/issue-57-pagination-bug
- chore/issue-63-upgrade-deps
```

### Commit Conventions

```markdown
## Commit Message Format
type(scope): brief description

Longer explanation if needed.

Closes #issue-number

## Types
- feat: New feature
- fix: Bug fix
- refactor: Code change that neither fixes nor adds
- test: Adding/updating tests
- docs: Documentation only
- chore: Maintenance tasks

## Examples
feat(auth): add login form validation
fix(api): handle null response in user fetch
```

### Keeping Agents Focused on One Issue

**Critical practices:**

1. **One branch per issue** - Never mix multiple issues in one branch
2. **Start fresh sessions** - Begin new conversation for each issue
3. **Explicit scope in prompt** - "Fix ONLY issue #42, nothing else"
4. **Out-of-scope awareness** - "If you notice other issues, log them but don't fix"

```markdown
## Working on Issues

When assigned an issue:
1. Create branch: git checkout -b feature/issue-{number}-{description}
2. Read the issue thoroughly
3. Implement ONLY what the issue describes
4. If you discover related issues, note them in a comment but don't fix
5. Run tests before committing
6. Create PR referencing the issue
```

### PR Workflow

```markdown
## Pull Request Process

1. Ensure all tests pass locally
2. Push branch to origin
3. Create PR with:
   - Title: Brief description (matches commit convention)
   - Body: What changed and why
   - Reference: "Closes #issue-number"
4. Wait for CI checks
5. Address review feedback in new commits (don't force push)
```

### Custom Commands for GitHub Integration

Create `.claude/commands/fix-github-issue.md`:

```markdown
# Fix GitHub Issue

Read issue #$ARGUMENTS from this repository.

1. Understand the issue completely
2. Create a new branch: feature/issue-$ARGUMENTS-{description}
3. Implement the fix
4. Write/update tests
5. Run the full test suite
6. Commit with message referencing the issue
7. Push and create a PR

Stay focused on ONLY this issue. Do not fix other issues you encounter.
```

Usage: `/project:fix-github-issue 42`

### Claude Code GitHub Actions

```yaml
# .github/workflows/claude.yml
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          mode: code-review
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 5. Context and Memory

### Memory Types

#### Session Memory (Short-term)
- Current conversation context
- Limited by context window (~128K-1M tokens depending on model)
- Degrades as conversation grows longer

#### Project Memory (Persistent)
- CLAUDE.md files
- Memory files (memory.md, progress.md)
- Git history and commit messages

#### External Memory (Long-term)
- Documentation files
- Architecture decision records
- Database schemas

### Memory File Patterns

#### progress.md - Session Continuity

```markdown
# Project Progress

## Current Sprint
- [ ] Implement user authentication
  - [x] Login form component
  - [x] Auth service integration
  - [ ] Session management
  - [ ] Logout functionality

## Last Session (2026-02-03)
- Completed: Login form with validation
- Files modified: /frontend/src/components/LoginForm/
- Blocked on: Need API endpoint for session refresh
- Next steps: Implement session management

## Key Decisions
- Using JWT tokens (see ADR-003)
- Refresh tokens stored in httpOnly cookies
```

#### plan.md - Technical Specification

```markdown
# Feature: User Authentication

## Requirements
- Users can log in with email/password
- Sessions persist across browser refreshes
- Secure logout clears all tokens

## Implementation Plan

### Phase 1: Login UI
- [ ] Create LoginForm component
- [ ] Add form validation with Zod
- [ ] Style with existing design system

### Phase 2: Auth Service
- [ ] Create auth API client
- [ ] Implement token storage
- [ ] Add auth context provider

### Phase 3: Session Management
- [ ] Auto-refresh expiring tokens
- [ ] Handle session expiry gracefully
- [ ] Implement logout

## Technical Notes
- Auth endpoint: POST /api/auth/login
- Token format: JWT with 15min expiry
- Refresh token: 7-day expiry, httpOnly cookie
```

### Best Practices for Context Management

#### Start Fresh Sessions Often
Context window performance degrades as it fills:
- Start new session for each issue/task
- Summarize completed work in memory files
- Don't rely on conversation history across long sessions

#### Curate Context Deliberately
```markdown
## When Starting a New Session

1. Load essential files:
   - CLAUDE.md
   - progress.md (current state)
   - Relevant source files (not everything)

2. Exclude:
   - node_modules, build artifacts
   - Unrelated features
   - Test fixtures (unless working on tests)
```

#### Use Progressive Loading
Don't load everything upfront:
```markdown
## File Reference (load as needed)
- Architecture: /docs/ARCHITECTURE.md
- Database schema: /docs/database-schema.md
- API contracts: /docs/api-spec.yaml
- Testing patterns: /docs/testing-guide.md
```

### Maintaining Context Across Sessions

1. **Before ending session:**
   - Update progress.md with current state
   - Commit all work with clear messages
   - Note any blockers or next steps

2. **When starting new session:**
   - Read progress.md first
   - Load only relevant files
   - Explicitly state the task

3. **Use spec files as long-term memory:**
   - Technical details survive across sessions
   - Acts as single source of truth
   - Update after each implementation step

---

## 6. Testing and Validation

### Test-Driven Development with Agents

```markdown
## TDD Workflow

1. Write failing tests first:
   - Describe expected behavior
   - Include edge cases
   - Specify: "Write tests only, no implementation"

2. Verify tests fail:
   - Run test suite
   - Confirm failures are for expected reasons

3. Implement to pass tests:
   - "Implement code to make these tests pass"
   - Run tests after each change

4. Refactor with confidence:
   - Tests provide safety net
   - Keep tests green throughout
```

### Test Requirements in Instructions

```markdown
## Testing Standards

### Required Coverage
- All new functions must have tests
- Happy path + at least 2 edge cases
- Error handling paths tested

### Test Location
- Unit tests: Adjacent to source (*.test.ts)
- Integration tests: /tests/integration/
- E2E tests: /tests/e2e/

### Running Tests
- npm test - Run all unit tests
- npm run test:integration - Integration tests
- npm run test:e2e - End-to-end tests
- npm run test:coverage - With coverage report

### Before PR
- All tests must pass
- Coverage must not decrease
- New code must be covered
```

### CI/CD Quality Gates

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: npm run build

  coverage:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi
```

### Code Review Considerations for Agent PRs

1. **Extra scrutiny required** - AI code can look correct while being subtly wrong
2. **Verify edge cases** - Agents often miss unusual scenarios
3. **Check security** - AI-generated code shows 3x more vulnerabilities (SonarSource)
4. **Validate architecture** - Ensure it follows existing patterns
5. **Test manually** - Don't just trust passing tests

```markdown
## PR Review Checklist (AI-generated code)

- [ ] Logic matches requirements exactly
- [ ] No unnecessary abstractions added
- [ ] Follows existing codebase patterns
- [ ] No security vulnerabilities (input validation, etc.)
- [ ] Error handling is comprehensive
- [ ] Tests cover meaningful scenarios (not just happy path)
- [ ] No copied code that might be licensed
- [ ] Performance considerations addressed
- [ ] Documentation updated if needed
```

---

## 7. Project Structure

### File Organization for Agent Comprehension

```
project/
├── CLAUDE.md                 # Or AGENTS.md - primary config
├── .claude/
│   ├── commands/             # Custom slash commands
│   └── docs/                 # AI-reference documentation
├── docs/
│   ├── ARCHITECTURE.md       # System design (human + AI)
│   ├── PRD.md               # Product requirements
│   └── adr/                  # Architecture decision records
├── src/
│   ├── components/           # UI components
│   │   └── Button/
│   │       ├── Button.tsx
│   │       ├── Button.test.tsx
│   │       └── index.ts
│   ├── services/             # Business logic
│   ├── stores/               # State management
│   └── utils/                # Shared utilities
├── tests/
│   ├── integration/
│   └── e2e/
└── infra/                    # Infrastructure as code
```

### Key Principles

#### Consistent, Predictable Patterns
```markdown
## Component Structure (always follow)
/src/components/{ComponentName}/
  {ComponentName}.tsx     # Main component
  {ComponentName}.test.tsx # Tests
  {ComponentName}.styles.ts # Styles (if needed)
  index.ts                # Public exports
```

#### Co-location
Keep related files together:
- Tests next to source files
- Styles with components
- Types with implementations

#### Clear Entry Points
Document where things start:
```markdown
## Key Entry Points
- App routing: /src/App.tsx
- API handlers: /backend/handlers/
- State stores: /src/stores/
- Database models: /backend/models/
```

### Making Architecture Discoverable

#### Architecture Decision Records (ADRs)
```markdown
# ADR-001: Use DynamoDB for Storage

## Status
Accepted

## Context
Need a scalable, serverless database for the application.

## Decision
Use AWS DynamoDB with single-table design.

## Consequences
- Learning curve for single-table design
- Cost-effective at scale
- Tight coupling with AWS
```

#### Reference Architecture Documentation
```markdown
## Architecture Overview

### System Components
[Diagram or description]

### Data Flow
1. User action in React frontend
2. API call to Lambda handler
3. DynamoDB read/write
4. Response back to frontend

### Key Files
- Frontend entry: /frontend/src/main.tsx
- API routing: /backend/handlers/index.ts
- Database: /backend/lib/dynamodb.ts
```

---

## 8. Agent Orchestration Patterns

*Based on OpenAI's "A Practical Guide to Building Agents" (2026)*

While most coding tasks use a single agent, understanding orchestration patterns helps for complex projects.

### Single-Agent Systems (Default for Coding)

A single agent with tools handles most coding tasks effectively:

```
Input → Agent → Output
         ↓
    Instructions
    Tools
    Guardrails
```

**When single-agent works:**
- Focused tasks (fix issue, implement feature)
- Clear scope with defined acceptance criteria
- Tools don't overlap in purpose

**The Agent Loop:**
Every agent runs in a loop until an exit condition:
1. Model receives input
2. Model decides: respond or use tool
3. If tool use: execute tool, feed result back to model
4. Repeat until done

### When to Consider Multiple Agents

Split into multiple agents when:

| Signal | Symptom | Solution |
|--------|---------|----------|
| **Complex logic** | Many if-then-else branches in prompts | Separate agents per logical path |
| **Tool overload** | 10+ similar tools causing confusion | Group tools by domain into agents |
| **Role switching** | Agent needs to act as planner, then implementer | Dedicated agent per role |

### Multi-Agent Patterns

#### Pattern 1: Manager (Agents as Tools)

A central "manager" agent delegates to specialized agents:

```
User Request
     ↓
Manager Agent ──→ Planning Agent (as tool)
     │       ──→ Implementation Agent (as tool)
     │       ──→ Testing Agent (as tool)
     ↓
Synthesized Response
```

**Use when:**
- You want one agent to maintain control
- Specialized agents return results to a coordinator
- User should interact with single interface

**Example for coding:**
```markdown
## Manager Agent
You coordinate software development tasks.
- Use `plan_feature` tool for design decisions
- Use `implement_code` tool for writing code
- Use `run_tests` tool for validation
Synthesize results into a coherent response.
```

#### Pattern 2: Decentralized (Handoffs)

Agents hand off control to each other:

```
User Request
     ↓
Triage Agent ──handoff──→ Feature Agent
                          ──handoff──→ Test Agent
                                        ──handoff──→ Review Agent
```

**Use when:**
- Each agent fully takes over a phase
- Sequential workflow with clear boundaries
- Don't need central synthesis

**Example for coding:**
```markdown
## Triage Agent
Assess the request and hand off to the appropriate agent:
- Feature requests → Feature Agent
- Bug fixes → Debug Agent
- Refactoring → Refactor Agent

## Feature Agent
Implement features. When complete, hand off to Test Agent.

## Test Agent
Write and run tests. When passing, hand off to Review Agent.
```

### Practical Recommendation for Coding Projects

**Start with single agent.** Only add complexity when:
1. Single agent consistently fails at a task type
2. You need persistent "roles" (e.g., always plan before implement)
3. Tool count exceeds 15 and causes confusion

**For AI Learning Hub:** Single-agent with custom commands is sufficient. Each command (fix-issue, create-lambda) acts as a focused workflow without multi-agent overhead.

---

## 9. Prompt Engineering for Agents

*Based on Anthropic's "Building Trusted AI in the Enterprise" (2026)*

### The 7-Layer Prompt Structure

Structure agent prompts in this order for best results:

```
1. Task + Role Context      ← WHO the agent is, WHAT it does
2. Background Data          ← Documents, schemas, examples
3. Detailed Rules           ← Constraints, edge cases
4. Conversation History     ← Prior context (if multi-turn)
5. Immediate Task           ← The specific request
6. Output Format            ← Expected structure
7. Pre-filled Response      ← Start the response (optional)
```

**Example for a coding agent:**

```markdown
## 1. Task + Role
You are a senior TypeScript developer working on AI Learning Hub.
Your task is to implement features according to specifications.

## 2. Background
Tech stack: React + Vite, AWS Lambda, DynamoDB
Key patterns: See /docs/architecture.md
Shared libraries: @ai-learning-hub/* (MUST use)

## 3. Rules
- All new code must have tests
- Use existing patterns from codebase
- Never modify files outside task scope
- Ask for clarification if requirements unclear

## 4. Context
[Previous conversation or relevant history]

## 5. Task
Implement the login form component per story 2.3.

## 6. Output Format
- Create files in /frontend/src/components/LoginForm/
- Include: component, tests, types, index.ts
- Follow existing component structure

## 7. Pre-fill (optional)
I'll start by examining the existing component patterns...
```

### Chain of Thought (CoT) for Complex Tasks

For multi-step reasoning, explicitly request thinking:

```markdown
## Instructions
Before implementing, think through your approach:

<scratchpad>
1. What files need to be created/modified?
2. What existing patterns should I follow?
3. What edge cases must I handle?
4. What tests are needed?
</scratchpad>

Then proceed with implementation.
```

**Benefits:**
- More accurate reasoning for complex tasks
- Easier to debug when things go wrong
- Self-documenting decision process

**Tradeoff:** Increases token usage and latency. Use judiciously.

### Few-Shot Examples

Teach by example, especially for project-specific patterns:

```markdown
## Component Pattern

Here's how we structure components in this project:

### Example: Button Component
/frontend/src/components/Button/
├── Button.tsx        # Main component
├── Button.test.tsx   # Tests
├── Button.types.ts   # TypeScript types
└── index.ts          # Public exports

```tsx
// Button.tsx
import { ButtonProps } from './Button.types';

export const Button = ({ label, onClick, variant = 'primary' }: ButtonProps) => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
};
```

Follow this EXACT structure for new components.
```

### Evaluation and Iteration

Don't set-and-forget prompts. Continuously improve:

#### Build Evaluation Tests
```markdown
## Test Cases for Agent Prompts

### Happy Path
- Input: "Create a Button component"
- Expected: Creates all 4 files, follows pattern, tests pass

### Edge Cases
- Input: "Create component" (no name)
- Expected: Asks for clarification, doesn't create random files

### Guardrail Tests
- Input: "Delete all test files"
- Expected: Refuses, explains why
```

#### Track What Works
```markdown
## Prompt Changelog

### 2026-02-04
- Added explicit "MUST use shared libraries" rule
- Result: Reduced utility duplication by 80%

### 2026-02-01
- Added component structure example
- Result: First-attempt success rate improved from 60% to 90%
```

### LLM-as-Judge for Automated Evaluation

Use a separate LLM call to evaluate agent output:

```markdown
## Evaluation Prompt

Review this code change:
<code>{agent_output}</code>

Evaluate on these criteria (1-5 scale):
1. Correctness: Does it solve the stated problem?
2. Pattern compliance: Does it follow project conventions?
3. Test coverage: Are tests comprehensive?
4. Security: Any obvious vulnerabilities?

Return JSON: { correctness: N, patterns: N, tests: N, security: N, issues: [...] }
```

**Use for:**
- Automated PR reviews
- Regression testing prompts
- Comparing prompt versions

---

## 10. Model Selection & Cost Optimization

*Based on Claude Code Playbook (Supatest AI, August 2025)*

Effective model selection per task type can achieve 90%+ cost reduction while maintaining quality.

### Model Selection by Task Type

| Task Type | Recommended Model | Estimated Cost | Rationale |
|-----------|------------------|----------------|-----------|
| Quick code checks | Haiku | $0.01 | Speed, low complexity |
| Documentation | Haiku | $0.01 | Structured output, low reasoning |
| Standard code review | Sonnet | $0.08 | Balance of quality and cost |
| Test generation | Sonnet | $0.06 | Pattern-based, moderate complexity |
| Feature implementation | Sonnet | $0.10 | Standard development work |
| Architecture decisions | Opus | $1.20 | Deep reasoning required |
| Complex debugging | Opus | $0.90 | Multi-step analysis |
| Root cause analysis | Opus | $1.00 | System-wide reasoning |

### Specialist Subagent Library

Create dedicated subagent prompts for recurring task types:

#### Code Reviewer (Security Focus)
```markdown
--name: code-reviewer
model: sonnet
tools: Read, Grep, Glob, Bash
---

You are a senior security-focused code reviewer.

IMMEDIATE ACTIONS:
1. Run `git diff --staged` to analyze changes
2. Security-first analysis
3. Structured, actionable feedback

SECURITY CHECKLIST:
🔴 CRITICAL: SQL injection, XSS, auth bypass, data exposure
🟡 WARNING: Performance, memory leaks, error handling
🟢 SUGGESTION: Design patterns, refactoring opportunities

OUTPUT: Include specific line numbers and code examples.
```

#### Test Expert (TDD Specialist)
```markdown
--name: test-expert
model: sonnet
tools: Read, Write, Edit, Bash
---

You are a test automation expert specializing in TDD.

TDD WORKFLOW:
1. Red: Write failing tests first
2. Green: Implement minimal code to pass
3. Refactor: Improve while keeping tests green

TEST PYRAMID:
🔺 E2E (Few): Critical user journeys
🔸 Integration (Some): API, database
🔹 Unit (Many): Functions, edge cases
```

#### Debugger (Systematic Problem Solver)
```markdown
--name: debugger
model: opus
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger with systematic methodology.

DEBUGGING STEPS:
1. CAPTURE: Exact errors, stack traces, reproduction steps
2. ISOLATE: Minimal reproduction case
3. HYPOTHESIZE: Testable theories about root cause
4. TEST: Validate with targeted changes
5. FIX: Minimal, focused solution
6. VERIFY: Confirm fix, no regressions
7. PREVENT: Add tests to prevent recurrence
```

#### Production Validator (Pre-Deploy Quality Gate)
```markdown
--name: production-validator
model: sonnet
tools: Read, Grep, Glob
---

You are a production code quality enforcer. Read-only access.

IMMEDIATE BLOCKERS (Stop deployment if found):
- TODO/FIXME comments
- Placeholder text ("Replace with actual...", "Coming soon")
- Hardcoded API keys, passwords, tokens
- Debug statements (console.log, print(), debugger)
- Commented-out code blocks

CODE QUALITY ISSUES:
- Missing error handling in API calls
- Unused imports or variables
- Functions longer than 50 lines
- Missing TypeScript types

OUTPUT FORMAT:
🔴 BLOCKER: [issue] at [file:line] — Must fix before deploy
🟡 WARNING: [issue] at [file:line] — Should fix
🟢 PASSED: No blocking issues found
```

### Agent Creation via /agents Command

Agents are created and managed using the `/agents` command in Claude Code:

```bash
# Open subagent management interface
/agents

# Options:
# - Create New Agent (user-level or project-level)
# - View/Edit existing agents
# - Delete agents
```

**Scoping Strategy:**
- **User-level agents** — Available across all projects (e.g., production-validator, code-reviewer)
- **Project-level agents** — Specific to one project (e.g., frontend specialist with project-specific stack)

**Auto-delegation:** Claude automatically routes tasks to matching specialists based on the agent's description field. You don't need to explicitly invoke agents.

### Context Pollution Prevention

Context pollution is the #1 problem teams face with Claude Code.

#### /clear vs /compact Decision Matrix

| Situation | Use /clear | Use /compact | Why |
|-----------|------------|--------------|-----|
| New unrelated task | ✅ Always | ❌ Never | Fresh context needed |
| Context window full | ❌ No | ✅ Sometimes | Preserve important context |
| Performance degrading | ✅ Yes | ❌ No | Full reset more effective |
| Complex reasoning needed | ✅ Yes | ❌ No | Avoid context confusion |
| Mid-task continuation | ❌ No | ✅ Maybe | Only if necessary |

**Rule:** With large context windows, use `/clear` liberally. Use `/compact` sparingly.

#### Cascaded Context Hierarchy

Structure context files in hierarchy for scalability:

```
Enterprise Level: /etc/claude-code/CLAUDE.md  # Company standards
Global Level:     ~/.claude/CLAUDE.md         # Personal preferences
Project Level:    ./CLAUDE.md                 # Project-specific (PRIMARY)
Module Level:     ./backend/CLAUDE.md         # Subsystem-specific
Feature Level:    ./features/auth/CLAUDE.md   # Feature-specific
```

Start with Project Level only; add Module/Feature levels as codebase grows.

### The "Explore → Plan → Code → Review → Deploy" Pattern

Structured workflow that separates professionals from casual users:

```bash
# 1. EXPLORE (Leverage full context window)
> Analyze the entire authentication system including @auth/ @api/routes/auth.js @tests/auth/

# 2. PLAN (Use thinking triggers)
> Think hard about implementing OAuth2 integration. Consider security, UX, backward compatibility.

# 3. CODE (Now implement)
> Implement the OAuth2 integration plan we discussed

# 4. REVIEW (Multi-layer validation)
> Use the code-reviewer subagent to audit this implementation
> Use the security-auditor subagent to check for vulnerabilities

# 5. DEPLOY (Infrastructure + monitoring)
> Use the devops-engineer subagent to create deployment strategy
```

### Agent-Assisted TDD Workflow

TDD becomes powerful with subagent orchestration:

```bash
# 1. Generate failing tests first
> Use the test-expert subagent to write comprehensive tests for user registration

# 2. Verify tests fail
> Run the tests and confirm they fail as expected

# 3. Implement to pass tests
> Implement the user registration feature to make all tests pass. Don't modify tests.

# 4. Refactor while maintaining green tests
> Use the code-reviewer subagent to suggest improvements while keeping tests green
```

---

## 11. Anti-patterns to Avoid

### Instruction Anti-patterns

#### 1. Vague Instructions
**Bad:** "Make it better"
**Good:** "Refactor the login function to use async/await and add error handling for network failures"

#### 2. Assuming Current Knowledge
**Bad:** Expecting the agent to know the latest React 19 patterns
**Good:** "Using React 19 with the new use() hook. See docs: [link]"

#### 3. Overly Long Context Files
**Bad:** 1000+ line CLAUDE.md with entire documentation
**Good:** <100 lines with links to detailed docs

#### 4. Not Iterating on Instructions
**Bad:** Set and forget
**Good:** Refine based on what works/fails

### Workflow Anti-patterns

#### 1. Monolithic Requests
**Bad:** "Build the entire authentication system"
**Good:** "First, create the login form component only"

#### 2. Persisting with Failed Conversations
**Bad:** Trying to fix a derailed conversation for 30 minutes
**Good:** Start fresh, refine the prompt, try again

#### 3. Skipping Planning
**Bad:** "Just implement this feature"
**Good:** "First, create a plan for how to implement this, then wait for approval"

#### 4. Blindly Trusting Output
**Bad:** Merge AI code without review
**Good:** Review every line, test manually

### Context Anti-patterns

#### 1. Loading Everything
**Bad:** Including all project files in context
**Good:** Include only task-relevant files

#### 2. Bloated Memory Files
**Bad:** Accumulating preferences/rules forever
**Good:** Regular audits, remove outdated rules

#### 3. Too Many MCP Servers
**Bad:** All MCP servers enabled by default
**Good:** Enable only task-relevant tools

### Technical Anti-patterns

#### 1. Using AI as an Expensive Linter
**Bad:** Style guides in CLAUDE.md
**Good:** Use actual linters (ESLint, Prettier), hooks for auto-formatting

#### 2. No Verification Mechanism
**Bad:** No tests, no linting, no type checking
**Good:** Give agents clear signals (typed languages, tests, linters)

#### 3. Not Tracking AI Effectiveness
**Bad:** No metrics on AI-generated code quality
**Good:** Track which commits came from AI, correlate with bugs

---

## 12. Tool-Specific Recommendations

### Claude Code

**Strengths:**
- Deep codebase understanding
- Multi-file editing
- Git integration
- Custom commands and hooks
- GitHub Actions integration

**Best Practices:**
- Use Plan Mode (shift+enter) before implementation
- Create custom slash commands for repeated workflows
- Use hooks for deterministic behaviors (linting, formatting)
- Leverage subagents for research tasks
- Start new sessions often to avoid context degradation

**Configuration:**
```
~/.claude/
  CLAUDE.md        # Global settings
  commands/        # Personal commands

project/
  CLAUDE.md        # Project-specific
  .claude/
    commands/      # Project commands
    hooks.json     # Automation hooks
```

### Cursor

**Strengths:**
- IDE integration
- Tab completions
- Quick edits with Cmd+K
- Background agents
- Visual diff review

**Best Practices:**
- Use `.cursor/rules/*.mdc` for organized rules
- Enable Plan Mode (Shift+Tab) for complex tasks
- Use `.cursorignore` to exclude irrelevant files
- Run parallel models for comparison
- Use `@Past Chats` to reference previous context

**Configuration:**
```
.cursor/
  rules/
    general.mdc
    react.mdc
    testing.mdc
  commands/
    pr.md
    review.md
```

### Aider

**Strengths:**
- Terminal-based simplicity
- Automatic commits
- Multi-file coordination
- Cost-effective with caching

**Best Practices:**
- Create `.aider.conf.yml` for project settings
- Use `--cache-prompts` for faster, cheaper sessions
- Enable auto-linting and testing
- Work in small increments
- Use different chat modes (code, architect, ask)

**Configuration:**
```yaml
# .aider.conf.yml
model: claude-3-5-sonnet
auto-commits: true
show-diffs: true
dark-mode: true
lint-cmd: npm run lint
test-cmd: npm test
```

### Hybrid Workflow (Recommended)

Combine tools for optimal results:
- **Terminal agent (Claude Code, Aider):** Complex multi-file tasks, refactoring
- **IDE agent (Cursor):** Quick edits, real-time completions
- **GitHub Actions:** Automated review, CI/CD integration

---

## 13. Sources

### Official Documentation
- [Claude Code Documentation](https://code.claude.com/docs)
- [Cursor Blog: Best Practices for Coding with Agents](https://cursor.com/blog/agent-best-practices)
- [Aider Documentation](https://aider.chat/docs/)
- [AGENTS.md Specification](https://agents.md/)

### Best Practice Guides
- [HumanLayer: Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Addy Osmani: My LLM Coding Workflow Going Into 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- [Arguing with Algorithms: Technical Design Spec Pattern](https://www.arguingwithalgorithms.com/posts/technical-design-spec-pattern.html)
- [Builder.io: How I Use Claude Code](https://www.builder.io/blog/claude-code)

### Research and Analysis
- [Decoding the Configuration of AI Coding Agents](https://arxiv.org/html/2511.09268v1)
- [On the Impact of AGENTS.md Files on AI Coding Agents](https://arxiv.org/html/2601.20404)
- [Professional Software Developers Don't Vibe, They Control](https://arxiv.org/html/2512.14012)
- [EclipseSource: Mastering Project Context Files](https://eclipsesource.com/blogs/2025/11/20/mastering-project-context-files-for-ai-coding-agents/)

### Security and Guardrails
- [Guardrails for AI Agents (Agno)](https://www.agno.com/blog/guardrails-for-ai-agents)
- [OpenAI: Safety in Building Agents](https://platform.openai.com/docs/guides/agent-builder-safety)
- [SEC-Context: AI Code Security Anti-Patterns](https://github.com/Arcanum-Sec/sec-context)

### Context Engineering
- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Lenny's Newsletter: AI Prompt Engineering in 2025](https://www.lennysnewsletter.com/p/ai-prompt-engineering-in-2025-sander-schulhoff)
- [PromptHub: Prompt Engineering for AI Agents](https://www.prompthub.us/blog/prompt-engineering-for-ai-agents)

### Enterprise & Agent Architecture
- [Anthropic: Building Trusted AI in the Enterprise](https://www.anthropic.com/enterprise) — 7-layer prompt structure, LLMOps, evaluation practices
- [OpenAI: A Practical Guide to Building Agents](https://platform.openai.com/docs/guides/agents) — Orchestration patterns, guardrail types, human intervention
- [Google: Agents Whitepaper](https://cloud.google.com/vertex-ai/docs/generative-ai/agents) — Agent architecture (model + tools + orchestration), ReAct/CoT/ToT reasoning, Extensions vs Functions vs Data Stores *(February 2025)*

### Claude Code Optimization
- [Claude Code Playbook (Supatest AI)](https://supatest.ai/claude-code-playbook) — Cascaded CLAUDE.md system, subagent library patterns, model selection strategy, context pollution prevention, cost optimization *(August 2025)*
- [Joe Njenga: Claude Code Sub Agents](https://medium.com/@joe.njenga/how-im-using-claude-code-sub-agents) — Step-by-step subagent creation, production-validator pattern, /agents command usage, user-level vs project-level scoping, auto-delegation behavior *(July 2025)*

### Hooks & Enforcement
- [Hooks Reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) — Complete hook event schemas, JSON response formats, PreToolUse/PostToolUse/Stop hooks
- [Automate Workflows with Hooks - Claude Code Docs](https://code.claude.com/docs/en/hooks-guide) — Tutorial, command/prompt/agent hook types, common patterns
- [tdd-guard (GitHub)](https://github.com/nizos/tdd-guard) — PreToolUse Write/Edit/MultiEdit enforcement for TDD workflow; multi-language test reporters (Vitest, Jest, Storybook, pytest, PHPUnit, Go, Rust) that capture results to `.claude/tdd-guard/data/test.json`; session toggle for enforcement; file type detection; monorepo support via `projectRoot` config *(January 2026)*
- [agent-security (GitHub)](https://github.com/mintmcp/agent-security) — Secrets scanning hooks for Claude Code and Cursor
- [claude-code-hooks (GitHub)](https://github.com/karanb192/claude-code-hooks) — Tiered safety levels (critical/high/strict), comprehensive regex patterns (50+), exfiltration prevention, allowlists, JSONL audit logging, 262 passing tests *(January 2026)*

### Community Resources
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)
- [Claude Code Commands Collection](https://github.com/wshobson/commands)
- [Cursor Forum: AI Rules and Best Practices](https://forum.cursor.com/t/ai-rules-and-other-best-practices/132291)

---

## Summary: Key Takeaways

### Core Principles (Original)
1. **Keep instructions lean** — <300 lines in CLAUDE.md, use progressive disclosure
2. **Plan before coding** — Use Plan Mode, create specs before implementation
3. **Work in small increments** — One task, one branch, one PR
4. **Maintain explicit context** — Memory files, progress tracking, clear state
5. **Test everything** — TDD works even better with agents
6. **Never blindly trust** — Review every line, verify manually
7. **Start fresh often** — New sessions prevent context degradation
8. **Use guardrails** — Hooks, constraints, and explicit boundaries
9. **Iterate on instructions** — Refine based on what works
10. **Combine tools** — Terminal + IDE + CI/CD for best results

### Guardrails & Safety (From OpenAI/Anthropic)
11. **Classify tool risk** — Low/Medium/High based on reversibility and impact
12. **Define human intervention triggers** — Failure thresholds, high-stakes operations
13. **Use layered guardrails** — Input (relevance, safety), process (tool risk), output (PII, validation)
14. **Require approval for irreversible actions** — Deletes, force push, production deploy

### Prompt Engineering (From Anthropic)
15. **Structure prompts in layers** — Role → Background → Rules → Context → Task → Format → Prefill
16. **Use Chain of Thought for complex tasks** — Explicit scratchpad before implementation
17. **Provide few-shot examples** — Show exact patterns to follow
18. **Evaluate and iterate** — LLM-as-judge, prompt versioning, track what works

### Agent Architecture (From OpenAI/Google)
19. **Start with single agent** — Only add complexity when single agent consistently fails
20. **Know when to split** — Complex logic, tool overload, role switching
21. **Choose orchestration pattern** — Manager (central control) vs. Decentralized (handoffs)

### Hooks: Deterministic Enforcement (Critical)
22. **CLAUDE.md is advisory, hooks are deterministic** — Any requirement agents MUST follow needs a corresponding hook
23. **Use tiered safety levels** — Configure `critical`/`high`/`strict` per environment; `high` recommended as default
24. **Block exfiltration, not just reading** — Prevent `curl -d @.env`, `scp secrets`, `rsync` of sensitive files
25. **Use allowlists to prevent false positives** — Explicitly allow `.env.example`, `.env.template`, etc.
26. **Log all hook events (JSONL)** — Audit trail in `~/.claude/hooks-logs/` for debugging and compliance
27. **Use comprehensive regex patterns** — 50+ patterns cover dangerous commands, sensitive files, and exfiltration attempts
28. **Test hooks before relying on them** — Verify each hook blocks/allows correctly with sample JSON input

### Model & Context Optimization (From Claude Code Playbook)
29. **Select model per task type** — Haiku for quick checks/docs, Sonnet for standard dev, Opus for architecture/complex debugging
30. **Build specialist subagent library** — Code-reviewer, test-expert, debugger, architect with dedicated prompts, tool restrictions, and model assignments
31. **Prevent context pollution** — Use /clear liberally between unrelated tasks; context pollution is the #1 problem teams face
32. **Use cascaded context hierarchy** — Project → Module → Feature level CLAUDE.md files as codebase scales

### TDD Enforcement (From tdd-guard)
33. **Intercept write operations for TDD** — Use PreToolUse matcher `Write|Edit|MultiEdit` to block implementation without failing tests first
34. **Capture test results in standardized format** — Use custom test reporters (Vitest, Jest, pytest, etc.) that write JSON to a known location (`.claude/tdd-guard/data/test.json`)
35. **Support monorepos with projectRoot** — Configure test reporters with `projectRoot` so hooks work when config is in subdirectories
36. **Detect file types before enforcing** — Identify if a file is test vs. implementation to apply appropriate TDD rules (only block implementation writes when tests don't exist/pass)
