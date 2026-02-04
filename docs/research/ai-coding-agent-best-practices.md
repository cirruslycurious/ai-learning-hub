# AI Coding Agent Best Practices Research

**Research Date:** February 2026
**Scope:** Claude Code, Cursor, Aider, Cline, and similar AI coding agents
**Purpose:** Comprehensive findings on enabling AI coding agents to build software effectively

---

## Table of Contents

1. [CLAUDE.md / Rules Files Structure](#1-claudemd--rules-files-structure)
2. [Guardrails and Constraints](#2-guardrails-and-constraints)
3. [Git/GitHub Workflow for Agents](#3-gitgithub-workflow-for-agents)
4. [Context and Memory](#4-context-and-memory)
5. [Testing and Validation](#5-testing-and-validation)
6. [Project Structure](#6-project-structure)
7. [Anti-patterns to Avoid](#7-anti-patterns-to-avoid)
8. [Tool-Specific Recommendations](#8-tool-specific-recommendations)
9. [Sources](#9-sources)

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

#### Pre-execution Guardrails
Control what data/instructions the agent processes before action:
- Input validation
- Context filtering
- Access controls (blocking sensitive paths)

#### In-process Guardrails
Monitor decisions and enforce constraints in real-time:
- Scope limitations (don't touch system files)
- Operation restrictions (no destructive commands)
- Logic constraints (stay within intended scope)

#### Output Guardrails
Check responses before returning:
- Safety validation
- Compliance checks
- Sensitive data filtering

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

## 3. Git/GitHub Workflow for Agents

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

## 4. Context and Memory

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

## 5. Testing and Validation

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

## 6. Project Structure

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

## 7. Anti-patterns to Avoid

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

## 8. Tool-Specific Recommendations

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

## 9. Sources

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

### Community Resources
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)
- [Claude Code Commands Collection](https://github.com/wshobson/commands)
- [Cursor Forum: AI Rules and Best Practices](https://forum.cursor.com/t/ai-rules-and-other-best-practices/132291)

---

## Summary: Key Takeaways

1. **Keep instructions lean** - <300 lines in CLAUDE.md, use progressive disclosure
2. **Plan before coding** - Use Plan Mode, create specs before implementation
3. **Work in small increments** - One task, one branch, one PR
4. **Maintain explicit context** - Memory files, progress tracking, clear state
5. **Test everything** - TDD works even better with agents
6. **Never blindly trust** - Review every line, verify manually
7. **Start fresh often** - New sessions prevent context degradation
8. **Use guardrails** - Hooks, constraints, and explicit boundaries
9. **Iterate on instructions** - Refine based on what works
10. **Combine tools** - Terminal + IDE + CI/CD for best results
