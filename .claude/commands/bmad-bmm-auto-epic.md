# /bmad-bmm-auto-epic — Autonomous Epic Implementation

**Purpose:** Implement all stories in an epic autonomously with strategic human checkpoints. Leverages hooks to enforce architecture, TDD, and quality gates while maximizing throughput.

**When to use:**

- You have a completed epic with well-defined stories
- You want to implement multiple stories with minimal manual prompting
- You trust hooks to enforce quality standards

**When NOT to use:**

- Epic stories are poorly defined or ambiguous
- Stories have complex interdependencies requiring careful sequencing
- You're learning a new domain and want to guide each step manually

---

## Usage

```bash
# Implement all stories in Epic 1
/bmad-bmm-auto-epic Epic-1

# Implement specific stories only
/bmad-bmm-auto-epic Epic-1 --stories=1.1,1.2,1.5

# Resume from previous run (uses state file)
/bmad-bmm-auto-epic Epic-1 --resume
```

---

## Workflow

### Phase 1: Planning & Scope Confirmation

1. **Load Epic File**
   - Read from `_bmad-output/planning-artifacts/epics/epic-N.md`
   - Parse all story IDs, titles, and acceptance criteria
   - Validate epic exists and is ready for implementation

2. **Scope Confirmation (Human Checkpoint)**
   - Show user: "Found N stories in Epic X"
   - Display story list with IDs and titles
   - Ask: "Implement: (a) all stories, (b) select specific stories, or (c) cancel?"
   - If (b), prompt for comma-separated story IDs

3. **Create State Tracking File**
   - Location: `docs/progress/epic-N-auto-run.md`
   - Initialize with: epic ID, stories list, start timestamp
   - Track: story status, PRs, test results, blockers

### Phase 2: Story Implementation Loop

For each story in scope:

#### 2.1 Pre-Implementation

- **Status Update:** Mark story as "🔄 In Progress" in state file
- **Branch & Issue:** Run `/project-start-story` pattern
  - Creates feature branch (e.g., `story-1-1-description`)
  - Creates GitHub issue referencing epic
  - Links branch to issue

#### 2.2 Implementation (Protected by Hooks)

- **Run `/bmad-bmm-dev-story`** or equivalent workflow:
  - Read story acceptance criteria
  - **Write tests first** (tdd-guard enforces this)
  - Write implementation (hooks enforce architecture, shared libs)
  - Run tests until passing (Stop hook enforces 80% coverage)

**Hooks Active During This Phase:**

- ✅ `tdd-guard.cjs` — Blocks implementation before tests written
- ✅ `architecture-guard.sh` — Blocks ADR violations (no Lambda→Lambda)
- ✅ `import-guard.sh` — Enforces `@ai-learning-hub/*` shared libraries
- ✅ `auto-format.sh` — Auto-formats all code (Prettier + ESLint)
- ✅ `type-check.sh` — Validates TypeScript
- ✅ Stop hook (agent) — Blocks completion if tests fail

#### 2.3 Commit & PR

- **Commit with issue reference:** `git commit -m "feat: implement story 1.1 #73"`
- **Push branch:** `git push -u origin story-1-1-description`
- **Open PR:** Use `gh pr create` with template:

  ```markdown
  ## Summary

  Implements Story 1.1: [Story Title]

  Closes #73 (issue)
  Part of Epic 1: [Epic Title]

  ## Changes

  - [Auto-generated from commits]

  ## Testing

  - ✅ All tests pass
  - ✅ Coverage: XX%
  - ✅ Hooks enforced: TDD, architecture, shared libs

  ## Checklist

  - [x] Tests written and passing
  - [x] Code follows architecture patterns
  - [x] Shared libraries used
  - [x] Documentation updated (if needed)
  ```

#### 2.4 Post-Story Checkpoint (Human Approval)

- **Update state file:** Mark story "✅ Complete", add PR link
- **Show summary:**

  ```
  ✅ Story 1.1 Complete
  - PR: #74 (https://github.com/.../pull/74)
  - Tests: 15 passed, 0 failed
  - Coverage: 85%
  - Branch: story-1-1-description

  Progress: 1/8 stories complete

  Next: Story 1.2 - [Title]

  Continue to Story 1.2? (y/n/pause/skip)
  ```

- **User Options:**
  - `y` or `yes` → Continue to next story
  - `n` or `no` → Stop execution, save progress
  - `pause` → Save state, can resume later with `--resume`
  - `skip` → Skip Story 1.2, move to Story 1.3

### Phase 3: Completion & Reporting

After all stories complete (or user stops):

1. **Generate Epic Report** (`docs/progress/epic-N-completion-report.md`):

   ```markdown
   # Epic 1 Completion Report

   **Status:** Complete (or Paused)
   **Duration:** 2h 15m
   **Stories Completed:** 7/8

   ## Summary

   - PRs opened: 7
   - Tests passed: 142
   - Coverage: 83% average
   - Blockers encountered: 1

   ## Story Status

   | Story | Status      | PR  | Duration | Notes                             |
   | ----- | ----------- | --- | -------- | --------------------------------- |
   | 1.1   | ✅ Complete | #74 | 15m      | Clean                             |
   | 1.2   | ✅ Complete | #75 | 18m      | Clean                             |
   | 1.3   | ❌ Blocked  | -   | -        | Tests failed, needs investigation |
   | 1.4   | ✅ Complete | #76 | 22m      | Clean                             |
   | ...   | ...         | ... | ...      | ...                               |

   ## Metrics

   - Average story time: 18 minutes
   - Test pass rate: 98%
   - Hook blocks: 3 (all self-corrected)
   - Human interventions: 1 (Story 1.3 test failure)

   ## Blockers

   1. **Story 1.3:** Test failure in validation logic
      - Error: Expected 'valid' but got 'invalid'
      - Action: Marked as blocked, needs manual investigation

   ## Next Steps

   - Review and merge PRs #74-#80
   - Investigate Story 1.3 test failure
   - Run epic-level integration tests
   - Update epic status in `epics.md`
   ```

2. **Update Epic File**
   - Mark completed stories as ✅ Done
   - Add completion timestamp
   - Link to PRs

3. **Notify User**
   - Show completion summary
   - List all PRs for review
   - Highlight any blockers

---

## Error Recovery

### Test Failures

When tests fail during implementation:

```
❌ Tests Failed for Story 1.3
- Failed: 2/15 tests
- Error: "Expected 'valid' but got 'invalid'"

Options:
a) Auto-fix: Let me analyze and attempt to fix (max 2 attempts)
b) Skip story: Mark as blocked, continue to next story
c) Pause: Stop execution, save progress for manual investigation
d) Debug: Show full test output and error details

Your choice:
```

**Auto-fix Behavior:**

- Analyze test failure
- Attempt fix (respects hooks: TDD, architecture, shared libs)
- Re-run tests
- Max 2 attempts, then escalate to user

### Hook Violations

When hooks block an action:

```
🛡️ Hook Blocked: architecture-guard.sh
- File: backend/functions/save/handler.ts
- Violation: Direct Lambda-to-Lambda call detected (ADR-007)
- Pattern: lambda.invoke()

✅ Self-Correcting:
- Using API Gateway pattern instead
- Retrying implementation...
```

**No user intervention needed** — hooks teach the agent the correct pattern.

### Merge Conflicts

When pushing branch encounters conflicts:

```
⚠️ Merge Conflict Detected
- Branch: story-1-4-save-validation
- Conflicts with: main (files: backend/functions/save/handler.ts)

Options:
a) Auto-resolve: Attempt automatic conflict resolution
b) Manual: Pause for you to resolve conflicts manually
c) Skip story: Mark as blocked, continue to next

Your choice:
```

---

## State Tracking

### State File Format

Location: `docs/progress/epic-N-auto-run.md`

````markdown
# Epic 1 Auto-Run Progress

**Status:** In Progress
**Started:** 2026-02-06 14:30:00
**Last Updated:** 2026-02-06 15:15:00
**Stories Scope:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8

## Current Story

**1.3** - Implement save validation (In Progress)

## Stories

| Story | Status         | PR  | Tests    | Coverage | Duration | Notes         |
| ----- | -------------- | --- | -------- | -------- | -------- | ------------- |
| 1.1   | ✅ Complete    | #74 | 15/15 ✅ | 87%      | 15m      | -             |
| 1.2   | ✅ Complete    | #75 | 12/12 ✅ | 92%      | 18m      | -             |
| 1.3   | 🔄 In Progress | -   | -        | -        | -        | Started 15:00 |
| 1.4   | ⏳ Pending     | -   | -        | -        | -        | -             |
| 1.5   | ⏳ Pending     | -   | -        | -        | -        | -             |
| 1.6   | ⏳ Pending     | -   | -        | -        | -        | -             |
| 1.7   | ⏳ Pending     | -   | -        | -        | -        | -             |
| 1.8   | ⏳ Pending     | -   | -        | -        | -        | -             |

## Metrics

- Stories completed: 2/8 (25%)
- PRs opened: 2
- Tests passed: 27/27
- Average coverage: 89.5%
- Total duration: 33m
- Estimated remaining: 1h 48m

## Blockers

None

## Resume Command

```bash
/bmad-bmm-auto-epic Epic-1 --resume
```
````

## Activity Log

- 14:30: Started Epic 1 auto-run
- 14:30: Story 1.1 started
- 14:45: Story 1.1 complete (PR #74)
- 14:45: Story 1.2 started
- 15:03: Story 1.2 complete (PR #75)
- 15:03: Story 1.3 started
- 15:15: Checkpoint - waiting for user approval to continue

````

---

## Safety Features

### Hooks as Safety Net

All implementation is protected by hooks configured in `.claude/settings.json`:

| Hook | Phase | Protection |
|------|-------|-----------|
| `tdd-guard.cjs` | PreToolUse (Write/Edit) | Blocks implementation before tests |
| `architecture-guard.sh` | PreToolUse (Write/Edit) | Blocks ADR violations |
| `import-guard.sh` | PreToolUse (Write/Edit) | Enforces shared library usage |
| `file-guard.cjs` | PreToolUse (Write/Edit) | Protects CLAUDE.md, .env, etc. |
| `bash-guard.cjs` | PreToolUse (Bash) | Prevents destructive commands |
| `auto-format.sh` | PostToolUse (Write/Edit) | Auto-formats code |
| `type-check.sh` | PostToolUse (Write/Edit) | Validates TypeScript |
| Stop hook (agent) | Stop | Ensures tests pass before completion |

### Human Checkpoints

Strategic approval gates ensure control:

1. **Epic scope confirmation** — Before any work begins
2. **Story completion approval** — After each story (moderate risk tolerance)
3. **Error escalation** — When auto-recovery fails
4. **Final review** — All PRs require human review before merge

### Rollback Strategy

If epic implementation goes wrong:

```bash
# Each story is on its own branch
git checkout main

# PRs are not auto-merged (require human review)
# Each PR can be closed without merging

# State file preserved for debugging
cat docs/progress/epic-N-auto-run.md
````

---

## Performance Expectations

### Time Savings

**Manual (Current):**

- Time per story: 30-60 min of human prompting
- Epic 1 (8 stories): 4-8 hours of human time

**Autonomous (This Workflow):**

- Time per story: 5-15 min of agent work
- Epic 1 (8 stories): 40-120 min total
- **Human time:** 5-10 min (initial prompt + 8 approvals @ 30s each)

**Time savings:** 3-7 hours per epic

### Cost Estimates

- Per story: $0.50-$2.00 in API calls
- Epic 1 (8 stories): $4-$16 total
- All 11 epics: ~$44-$176 (modest budget)

### Quality Assurance

- **100% hook enforcement** — Cannot bypass TDD, architecture, shared libs
- **80%+ test coverage** — Enforced by Stop hook
- **Auto-formatted code** — Prettier + ESLint on every file
- **TypeScript validated** — No type errors allowed

---

## Dependencies

### Required

- Git repository with `main` branch
- GitHub CLI (`gh`) installed and authenticated
- Epic file exists at `_bmad-output/planning-artifacts/epics/epic-N.md`
- Hooks configured and active in `.claude/settings.json`
- Node.js (for `.cjs` hooks)
- npm/package.json (for test, lint, build commands)

### Optional

- Existing `/project-start-story` command (for branch/issue creation pattern)
- Existing `/bmad-bmm-dev-story` command (for story implementation pattern)
- Custom epic file location (can be specified with `--epic-path`)

---

## Future Enhancements

### Phase 2: Parallel Story Implementation

- Use Task tool to spawn multiple agents
- Each agent works on different story simultaneously
- Smart merge conflict prevention
- Estimated time savings: 50-70% additional reduction

### Phase 3: Multi-Epic Orchestration

- `/bmad-bmm-auto-project` — Runs multiple epics in sequence
- Dependency analysis between epics
- Daily progress reports
- Automated integration testing between epics

### Phase 4: Intelligent Scheduling

- Analyze story dependencies from acceptance criteria
- Optimize execution order
- Parallelize independent stories
- Detect blocking stories early

---

## Troubleshooting

### "Epic file not found"

- Verify epic exists: `ls _bmad-output/planning-artifacts/epics/`
- Check epic ID matches file: `epic-1.md` → `/bmad-bmm-auto-epic Epic-1`

### "Hooks not blocking violations"

- Test hooks manually: `echo '{"tool_input":{"command":"git push -f origin main"}}' | node .claude/hooks/bash-guard.cjs`
- Check `.claude/settings.json` has correct hook paths
- Verify `.cjs` extension (not `.js`) for JavaScript hooks

### "Tests failing repeatedly"

- Review test output in state file activity log
- Use `pause` option to investigate manually
- Check if story acceptance criteria are clear enough

### "State file corrupted"

- State file is markdown, can be manually edited
- Delete state file to start fresh (loses progress tracking)
- Each story branch/PR is independent, so no implementation is lost

---

## Examples

### Example 1: Full Epic Implementation

```bash
$ /bmad-bmm-auto-epic Epic-1

📋 Loading Epic 1: User Authentication & Project Management

Found 8 stories:
1.1 - User registration with Clerk
1.2 - Save project to DynamoDB
1.3 - Project validation logic
1.4 - List user projects
1.5 - Update project
1.6 - Delete project
1.7 - Project sharing
1.8 - Project search

Implement: (a) all stories, (b) select specific, or (c) cancel?
> a

✅ Confirmed: Implementing all 8 stories

📝 Created state file: docs/progress/epic-1-auto-run.md

🔄 Story 1.1: User registration with Clerk
- Creating branch: story-1-1-user-registration
- Creating issue: #74
- Writing tests... ✅
- Implementing... ✅ (hooks enforced: TDD, architecture, shared libs)
- Running tests... ✅ 12/12 passed, 89% coverage
- Committing... ✅
- Opening PR... ✅ PR #75

✅ Story 1.1 Complete (15m)

Continue to Story 1.2? (y/n/pause/skip)
> y

[... continues for all 8 stories ...]
```

### Example 2: Resume After Pause

```bash
$ /bmad-bmm-auto-epic Epic-1 --resume

📋 Resuming Epic 1 from state file

Progress so far:
- Completed: 3/8 stories
- PRs opened: #75, #76, #77
- Last story: 1.3 (Complete)
- Next: 1.4 - List user projects

Resume from Story 1.4? (y/n)
> y

[... continues from Story 1.4 ...]
```

### Example 3: Select Specific Stories

```bash
$ /bmad-bmm-auto-epic Epic-1 --stories=1.2,1.4,1.6

📋 Loading Epic 1: User Authentication & Project Management

Selected stories:
1.2 - Save project to DynamoDB
1.4 - List user projects
1.6 - Delete project

Implement these 3 stories? (y/n)
> y

[... implements only selected stories ...]
```

---

## Related Commands

- `/project-start-story` — Manual story start (branch + issue)
- `/bmad-bmm-dev-story` — Manual story implementation
- `/bmad-bmm-create-story` — Create new story from epic
- `/bmad-bmm-sprint-status` — View current sprint status
- `/project-run-tests` — Run test suite manually

---

**Built with ❤️ for autonomous, safe, and fast epic implementation.**

_Powered by hooks. Guided by humans. Enforced by code._
