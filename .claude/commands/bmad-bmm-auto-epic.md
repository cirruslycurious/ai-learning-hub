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

## Command Spec

### Inputs

| Parameter     | Type   | Required | Default       | Description                                                                              |
| ------------- | ------ | -------- | ------------- | ---------------------------------------------------------------------------------------- |
| `epic_id`     | string | Yes      | -             | Epic identifier (e.g., "Epic-1", "epic-1")                                               |
| `--stories`   | string | No       | all           | Comma-separated story IDs to implement (e.g., "1.1,1.2,1.5")                             |
| `--resume`    | flag   | No       | false         | Resume from previous run using state file                                                |
| `--dry-run`   | flag   | No       | false         | Simulate workflow without creating branches/PRs/commits (sets `DRY_RUN=true` internally) |
| `--epic-path` | string | No       | auto-detected | Override path to epic file                                                               |

### Outputs

| Output            | Location                              | Description                                                  |
| ----------------- | ------------------------------------- | ------------------------------------------------------------ |
| State file        | `docs/progress/epic-{id}-auto-run.md` | Execution state, progress tracking, activity log             |
| GitHub Issues     | GitHub repo                           | One issue per story (idempotent: reuses if exists)           |
| GitHub PRs        | GitHub repo                           | One PR per story (idempotent: reuses if exists)              |
| Git branches      | Local + remote                        | One branch per story (`story-{id}-{slug}`)                   |
| Implementation    | Codebase                              | Code, tests, and documentation per story acceptance criteria |
| Completion report | Console + state file                  | Final summary with PR links, metrics, and next steps         |

### Invariants (Safety Guarantees)

The workflow enforces these invariants to prevent destructive actions:

1. **Never auto-merge PRs** — All PRs remain open for human review; workflow NEVER merges
2. **Never bypass hooks** — All commits go through pre-commit hooks (architecture-guard, import-guard, TDD-guard, etc.)
3. **Never force push** — All pushes use standard `git push` (no `--force` or `--force-with-lease`)
4. **Never push to base branch** — All story work happens on feature branches; base branch (main/master) remains protected
5. **Never skip tests** — All stories must pass tests before marking complete
6. **Never silently ignore failures** — Failures trigger auto-recovery (max 3 attempts with exponential backoff), then require human decision (fix/skip/pause)
7. **Idempotent operations** — All GitHub operations (issue/branch/PR creation) reuse existing resources if found
8. **State persistence** — Progress saved continuously with atomic writes (write temp file + rename) to prevent corruption on crash; `--resume` picks up exactly where workflow left off
9. **Human checkpoints** — Scope confirmation (Phase 1), integration checkpoints (Phase 2), and completion review (Phase 3) require human approval

---

## File Structure

Before diving into the workflow, understand where dependencies and story metadata live:

### Epic File (Catalog)

**Location:** `_bmad-output/planning-artifacts/epics/epic-N.md`

**Purpose:** High-level catalog of stories in the epic

**Contains:**

- Epic title and description
- Story list: IDs, titles, and paths to story files
- Epic-level acceptance criteria

**Example:**

```markdown
# Epic 1: User Authentication & Project Management

## Stories

### Story 1.1: User Registration

- **Path:** `_bmad-output/implementation-artifacts/stories/1.1.md`
- **Status:** ready-for-dev

### Story 1.2: Save Project

- **Path:** `_bmad-output/implementation-artifacts/stories/1.2.md`
- **Status:** backlog
```

### Story Files (Execution Units)

**Location:** `_bmad-output/implementation-artifacts/stories/{story-id}.md`

**Purpose:** Complete specification for implementing a single story

**Contains:**

- **YAML frontmatter** (dependencies, touches, risk)
- Acceptance criteria
- Technical notes
- Test requirements

**Example:** `_bmad-output/implementation-artifacts/stories/1.2.md`

```markdown
---
id: 1.2
title: Save Project to DynamoDB
depends_on: [1.1]
touches: [backend/api/projects, backend/db/projects.ts]
risk: low
---

## Story 1.2: Save Project to DynamoDB

**Acceptance Criteria:**

- Save project uses user ID from Story 1.1 authentication
- ...
```

**Key Distinction:**

- **Epic file** = catalog (what stories exist)
- **Story files** = specifications (YAML frontmatter + how to implement)

---

## Workflow

### Phase 1: Planning & Scope Confirmation

#### 1.1 Load Epic File

- Read from `_bmad-output/planning-artifacts/epics/epic-N.md`
- Parse story IDs, titles, and **paths to story files**
- Validate epic exists and is ready for implementation

#### 1.2 Load Story Files

- For each story ID from epic file, read the **story file** at the path specified
- Parse YAML frontmatter from each story file
- Extract: `id`, `title`, `depends_on`, `touches`, `risk`
- **Normalize:** Store `depends_on` as `story.dependencies` for consistent access throughout workflow

#### 1.3 Dependency Analysis (NEW)

**Parse Story Metadata (YAML Frontmatter):**

Each story file contains YAML frontmatter at the top with dependency metadata:

```yaml
---
id: 1.4
title: List user projects
depends_on: [1.2, 1.3]
touches: [backend/api/projects, shared/types]
risk: medium
---
```

**Required fields:**

- `id` - Story ID (e.g., "1.4")
- `title` - Story title
- `depends_on` - Array of story IDs this story depends on (empty array if none)

**Optional fields:**

- `touches` - Files/directories this story is expected to modify
- `risk` - Risk level (low/medium/high)

**Fallback to Regex (with Warning):**

If YAML frontmatter is missing, scan acceptance criteria and tech specs for dependency keywords:

- `requires Story X.Y`
- `depends on Story X.Y`
- `builds on Story X.Y`
- `after Story X.Y is complete`
- `prerequisites: Story X.Y`

If dependencies are detected via regex, **emit warning:**

```
⚠️ Story 1.4: Dependencies inferred from prose (found: 1.2, 1.3)
   Please add YAML frontmatter to make dependencies explicit:

   ---
   id: 1.4
   depends_on: [1.2, 1.3]
   ---
```

**Build Dependency Graph:**

```
Story 1.1 (no dependencies)
Story 1.2 → depends on 1.1
Story 1.3 → depends on 1.1
Story 1.4 → depends on 1.2, 1.3
Story 1.5 (no dependencies)
```

**Detect Cycles:**

If circular dependencies detected (e.g., 1.2 → 1.3 → 1.2):

```
❌ Dependency Cycle Detected

Story 1.2 depends on Story 1.3
Story 1.3 depends on Story 1.2

This epic cannot be implemented until dependencies are resolved.
Please fix the epic file and try again.
```

**Topological Sort:**

Order stories for execution using topological sort:

```
Execution Order (respecting dependencies):
1. Story 1.1
2. Story 1.5 (no deps, could be parallelized with 1.1 in future)
3. Story 1.2 (after 1.1)
4. Story 1.3 (after 1.1)
5. Story 1.4 (after 1.2 and 1.3)

Note: Dependency graph identifies parallelizable sets; current implementation
executes serially, future enhancement may parallelize independent stories.
```

**Integration Checkpoints:**

Mark stories that have dependents:

- Story 1.1 → Checkpoint after (1.2 and 1.3 depend on it)
- Story 1.2 → Checkpoint after (1.4 depends on it)
- Story 1.3 → Checkpoint after (1.4 depends on it)

At each checkpoint, re-validate dependent stories are still valid.

#### 1.3 Scope Confirmation (Human Checkpoint)

- Show user: "Found N stories in Epic X"
- Display story list with IDs, titles, **and dependencies**
- Show execution order (after topological sort)
- Ask: "Implement: (a) all stories in order, (b) select specific stories, or (c) cancel?"
- If (b), prompt for comma-separated story IDs (must respect dependencies)

**Example Output:**

```
📋 Epic 1: User Authentication & Project Management

Found 8 stories (ordered by dependencies):

1. Story 1.1 - User registration with Clerk [no dependencies]
2. Story 1.5 - Project search [no dependencies]
3. Story 1.2 - Save project to DynamoDB [depends on 1.1] ⚠️ Checkpoint
4. Story 1.3 - Project validation logic [depends on 1.1] ⚠️ Checkpoint
5. Story 1.4 - List user projects [depends on 1.2, 1.3] ⚠️ Checkpoint
6. Story 1.6 - Delete project [depends on 1.4]
7. Story 1.7 - Project sharing [depends on 1.4]
8. Story 1.8 - Project archiving [depends on 1.4]

Checkpoints: 3 integration checkpoints scheduled

Implement: (a) all stories in order, (b) select specific, (c) cancel?
```

#### 1.4 Initialize Story Runner (NEW)

**Create Story Runner Interface:**

The workflow no longer directly calls `gh issue create` or `gh pr create`. Instead, it uses a **StoryRunner** abstraction layer.

**Interface Definition:**

```typescript
interface StoryRunner {
  // Create operations (explicit args for determinism)
  createIssue(story: Story, epic: Epic): Promise<IssueResult>;
  createBranch(
    story: Story,
    branchName: string // Explicit branch name (computed by caller)
  ): Promise<BranchResult>;
  createPR(args: {
    story: Story;
    issue: IssueResult;
    base: string; // Base branch (e.g., "main")
    head: string; // Head branch (e.g., "story-1-2-save-project")
    title: string; // PR title
    body: string; // PR body (markdown)
  }): Promise<PRResult>;

  // Find operations (for idempotency)
  findIssueByStoryId(storyId: string): Promise<IssueResult | null>;
  findPRByBranch(branchName: string): Promise<PRResult | null>;
  branchExists(branchName: string): Promise<boolean>; // Pure check (no side effects)
  ensureBranchCheckedOut(branchName: string): Promise<void>; // Checkout if remote-only

  // Status management
  updateStatus(story: Story, status: StoryStatus): Promise<void>;

  // Repository info
  getDefaultBaseBranch(): Promise<string>; // Returns "main" or "master"
}

interface IssueResult {
  issueNumber: number;
  issueUrl: string;
}

interface BranchResult {
  branchName: string;
}

interface PRResult {
  prNumber: number;
  prUrl: string;
}

type StoryStatus = "pending" | "in-progress" | "review" | "done" | "blocked";
```

**Why Explicit Args?**

- **Deterministic:** No adapter guessing on branch name format or base/head
- **Testable:** Caller controls exact values used
- **Consistent:** All adapters use same naming convention

**Available Adapters:**

- **GitHubStoryRunner** — Real GitHub integration (default)
- **DryRunStoryRunner** — No-op runner for testing (logs only, no API calls)
- **JiraStoryRunner** — Jira integration (future)
- **LinearStoryRunner** — Linear integration (future)

**Detection Logic:**

```javascript
// Normalize dry-run flag: CLI flag takes precedence, then env var
const isDryRun = argv.dryRun === true || process.env.DRY_RUN === "true";

// Auto-detect runner based on environment
if (isDryRun) {
  runner = new DryRunStoryRunner();
} else if (fs.existsSync(".github")) {
  runner = new GitHubStoryRunner();
} else {
  throw new Error("No story tracking system detected");
}
```

**Error Handling:**

All runner operations are wrapped in retry logic:

```javascript
async function createIssueWithRetry(story, epic, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await runner.createIssue(story, epic);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

**Idempotency:**

Before creating issue/PR/branch, check if one already exists:

```javascript
async function getOrCreateIssue(story, epic) {
  // Check if issue already exists for this story
  const existingIssue = await runner.findIssueByStoryId(story.id);
  if (existingIssue) {
    console.log(`✅ Issue already exists: #${existingIssue.issueNumber}`);
    return existingIssue;
  }

  // Create new issue
  return await createIssueWithRetry(story, epic);
}

async function getOrCreateBranch(story) {
  // Compute branch name (deterministic, controlled by caller)
  const branchName = `story-${story.id.replace(".", "-")}-${slugify(story.title)}`;

  // Check if branch already exists (local OR remote)
  const exists = await runner.branchExists(branchName);
  if (exists) {
    console.log(`✅ Branch already exists: ${branchName}`);
    // Ensure branch is checked out locally (if remote-only)
    await runner.ensureBranchCheckedOut(branchName);
    return { branchName };
  }

  // Create new branch with explicit name
  return await runner.createBranch(story, branchName);
}

async function getOrCreatePR(story, epic, issue, coverage) {
  const branch = await getOrCreateBranch(story);
  const base = await runner.getDefaultBaseBranch(); // "main" or "master"

  // Check if PR already exists for this branch
  const existingPR = await runner.findPRByBranch(branch.branchName);
  if (existingPR) {
    console.log(`✅ PR already exists: #${existingPR.prNumber}`);
    return existingPR;
  }

  // Generate PR title and body
  const title = `Implement Story ${story.id}: ${story.title}`;
  const body = `
## Summary

Implements Story ${story.id}: ${story.title}

Closes #${issue.issueNumber}
Part of Epic ${epic.id}: ${epic.title}

## Changes

- [Auto-generated from commits]

## Testing

- ✅ All tests pass
- ✅ Coverage: ${coverage}%
- ✅ Hooks enforced: TDD, architecture, shared libs

## Checklist

- [x] Tests written and passing
- [x] Code follows architecture patterns
- [x] Shared libraries used
- [x] Documentation updated (if needed)
`.trim();

  // Create new PR with explicit args
  return await runner.createPR({
    story,
    issue,
    base, // Explicit base branch
    head: branch.branchName, // Explicit head branch
    title, // Explicit PR title
    body, // Explicit PR body
  });
}
```

#### 1.5 Status Source of Truth (NEW)

The workflow maintains status across multiple systems. Understanding which source is authoritative for orchestration decisions is critical:

**Primary Source (Orchestration):**

- **State file:** `docs/progress/epic-{id}-auto-run.md`
  - **Purpose:** Real-time workflow orchestration and progress tracking
  - **Contains:** Current story status, dependencies resolved/blocked, integration checkpoint results, activity log
  - **Used by:** This workflow to make decisions (e.g., "Can I start Story 1.4?" depends on state file showing "Story 1.2 = done AND Story 1.3 = done")
  - **Authority:** **PRIMARY** for all workflow control flow decisions
  - **Persistence:** Survives `--resume`, tracks exact execution state

**Secondary Sources (Synced Views):**

- **sprint-status.yaml:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - **Purpose:** High-level sprint dashboard for humans and other workflows
  - **Contains:** Aggregate counts (backlog/in-progress/review/done), epic status, current story status
  - **Updated by:** `runner.updateStatus(story, status)` after key milestones (story started, PR opened, story completed)
  - **Used by:** `/bmad-bmm-sprint-status` workflow to recommend next action
  - **Authority:** **SECONDARY** (read by other workflows, written by this workflow)

- **GitHub Issues/PRs:**
  - **Purpose:** External tracking, team visibility, code review
  - **Contains:** Issue titles, PR status (open/merged/closed), comments, review approvals
  - **Updated by:** Idempotent operations (getOrCreateIssue, getOrCreatePR)
  - **Used by:** Humans for review, CI/CD for status checks
  - **Authority:** **SECONDARY** (reflects decisions made via state file)

**Decision Flow:**

```
Workflow needs to decide: "Can I start Story 1.4?"

1. Read state file (PRIMARY)
   - Story 1.2 status = "done" ✅
   - Story 1.3 status = "done" ✅
   - Decision: Yes, start Story 1.4

2. Update state file
   - Set Story 1.4 status = "in-progress"

3. Sync secondary sources
   - runner.updateStatus(story1.4, "in-progress")
     → Updates sprint-status.yaml
   - getOrCreateIssue(story1.4)
     → Creates GitHub issue
   - getOrCreateBranch(story1.4)
     → Creates git branch
```

**Why State File is Primary:**

- **Granular:** Tracks substeps (dependencies checked, tests passed, integration validated) beyond simple status
- **Fast:** Local file read/write, no network latency
- **Reliable:** No API rate limits, no network failures
- **Resumable:** `--resume` flag picks up from exact point of failure
- **Activity log:** Captures full execution history (commits, test results, errors)

**Conflict Resolution:**

If secondary sources diverge from state file:

- **State file wins** for orchestration decisions
- Workflow may warn: "⚠️ sprint-status.yaml shows Story 1.2 = 'in-progress', but state file shows 'done'. Using state file."
- Manual sync command (future): `/bmad-bmm-auto-epic --sync-status` to reconcile

#### 1.6 Create State Tracking File

- Location: `docs/progress/epic-N-auto-run.md`
- Initialize with: epic ID, stories list (with dependencies), start timestamp
- Track: story status, PRs, test results, blockers, **integration checkpoints**

**Resume Semantics (--resume flag):**

When resuming from state file, the workflow reconciles state file (primary) with GitHub reality (secondary):

1. **State = "done", PR merged** → Skip story (already complete)
2. **State = "done", PR closed/unmerged** → Keep "done" (state file wins; human closed PR intentionally)
3. **State = "in-progress", PR exists** → Resume from PR creation (skip to post-commit activities)
4. **State = "in-progress", branch deleted** → Mark "blocked", require human decision (branch deletion likely intentional)
5. **State = "in-progress", no PR/branch** → Resume from last successful checkpoint in activity log
6. **State = "pending", PR exists** → Treat as "review" (someone manually created PR)
7. **State = "pending", branch exists** → Check out branch, resume from implementation phase

Resume always favors state file status for control flow; secondary sources (GitHub) inform recovery strategy.

**Dependency Completion Policy:**

To prevent dependent stories from building on code that doesn't exist on base branch, the workflow enforces different completion requirements based on story type:

- **Stories WITH dependents** (default: `--require-merged`): Story only satisfies dependency if:
  - PR is merged to base branch, OR
  - Commit is reachable from base branch (verified via `git merge-base --is-ancestor`)
  - **Rationale**: Downstream stories need code on base branch to build correctly

- **Leaf stories (NO dependents)** (relaxed): Story considered "done" when:
  - PR is open AND tests passing
  - **Rationale**: No downstream impact, safe to mark complete before human review/merge

- **Override mode** (optional `--no-require-merged`): Disable strict checking (state file wins)
  - **Warning**: Use only when you understand the risk of broken dependencies
  - User responsible for merge verification before dependent stories start

### Phase 2: Story Implementation Loop

For each story in scope:

#### 2.1 Pre-Implementation

**Check Dependencies:**

Before starting story, verify all dependencies are complete:

```javascript
for (const depStoryId of story.dependencies) {
  const depStory = getStory(depStoryId);
  const depStatus = getStoryStatus(depStoryId);

  // Check basic completion
  if (depStatus !== "done") {
    throw new Error(
      `Cannot start Story ${story.id}: dependency ${depStoryId} is not complete (status: ${depStatus})`
    );
  }

  // For stories WITH dependents, verify code reached base branch (default behavior)
  if (!config.noRequireMerged && depStory.hasDependents) {
    const prMerged = await runner.isPRMerged(depStory);
    const commitOnBase = await isCommitOnBaseBranch(
      depStory.lastCommit,
      baseBranch
    );

    if (!prMerged && !commitOnBase) {
      throw new Error(
        `Cannot start Story ${story.id}: dependency ${depStoryId} is marked "done" but code not on base branch.\n` +
          `PR #${depStory.prNumber} is not merged and commit not reachable from ${baseBranch}.\n` +
          `Merge the PR or use --no-require-merged flag (not recommended).`
      );
    }
  }
}

// Helper: check if commit is reachable from base branch
async function isCommitOnBaseBranch(commit, baseBranch) {
  try {
    await execCommand(
      `git merge-base --is-ancestor ${commit} origin/${baseBranch}`
    );
    return true; // Exit code 0 = commit is ancestor
  } catch {
    return false; // Exit code 1 = commit not ancestor
  }
}
```

**Update Status:**

```javascript
await runner.updateStatus(story, "in-progress");
```

**Create Issue & Branch (via StoryRunner):**

```javascript
// Idempotent: checks if issue already exists
const issue = await getOrCreateIssue(story, epic);

// Idempotent: checks if branch already exists
const branch = await getOrCreateBranch(story);

console.log(`✅ Issue: #${issue.issueNumber}`);
console.log(`✅ Branch: ${branch.branchName}`);
```

**No direct `gh` commands** — all operations go through StoryRunner interface.

#### 2.2 Implementation (Protected by Hooks)

- **Run `/bmad-bmm-dev-story`** or equivalent workflow:
  - Read story acceptance criteria
  - **Write tests first** (tdd-guard enforces this)
  - Write implementation (hooks enforce architecture, shared libs)
  - Run tests until passing (Stop hook enforces quality gates: see below)

**Hooks Active During This Phase:**

- ✅ `tdd-guard.cjs` (PreToolUse) — Blocks implementation before tests written
- ✅ `architecture-guard.sh` (PreToolUse) — Blocks ADR violations (no Lambda→Lambda)
- ✅ `import-guard.sh` (PreToolUse) — Enforces `@ai-learning-hub/*` shared libraries
- ✅ `auto-format.sh` (PostToolUse) — Auto-formats all code (Prettier + ESLint)
- ✅ `type-check.sh` (PostToolUse) — Validates TypeScript
- ✅ Stop hook (agent) — Blocks completion if tests fail

**CRITICAL: PostToolUse Hook Safety**

PostToolUse hooks (`auto-format`, `type-check`) modify files AFTER the agent writes code. This creates a risk:

1. Agent writes code
2. Tests pass on un-formatted code
3. PostToolUse hook formats code
4. Formatted code is committed WITHOUT re-testing

**Solution: Final Quality Gate**

After ALL file modifications complete (including PostToolUse hooks), run final gate before commit:

```bash
# Final quality gate (run after PostToolUse hooks complete)
npm run lint     # Verify format/style
npm run typecheck # Verify TypeScript
npm test         # Verify all tests still pass
```

This ensures:

- ✅ PostToolUse mutations don't break tests
- ✅ Formatted code is actually tested
- ✅ No "format → commit → tests fail" scenarios

#### 2.3 Commit & PR (via StoryRunner)

**Commit with issue reference:**

```bash
git commit -m "feat: implement story ${story.id} #${issue.issueNumber}"
```

**Push branch:**

```bash
git push -u origin ${branch.branchName}
```

**Create PR (via StoryRunner):**

```javascript
// Get test coverage from test output
// Coverage is extracted from repo-specific test runner output (Jest, Vitest, nyc, etc.)
// using a parser configured per repo; if not available, coverage is shown as "n/a"
const coverage = await extractCoverageFromTestResults(); // e.g., 85 or "n/a"

// Idempotent: checks if PR already exists for this branch
const pr = await getOrCreatePR(story, epic, issue, coverage);

console.log(`✅ PR: #${pr.prNumber} (${pr.prUrl})`);
```

**PR Template (generated by StoryRunner):**

```markdown
## Summary

Implements Story ${story.id}: ${story.title}

Closes #${issue.issueNumber}
Part of Epic ${epic.id}: ${epic.title}

## Changes

- [Auto-generated from commits]

## Testing

- ✅ All tests pass
- ✅ Coverage: ${coverage}%
- ✅ Hooks enforced: TDD, architecture, shared libs

## Checklist

- [x] Tests written and passing
- [x] Code follows architecture patterns
- [x] Shared libraries used
- [x] Documentation updated (if needed)
```

**Error Handling:**

If PR creation fails (API error, network issue, etc.):

```javascript
// Compute all PR args before try/catch (for reuse in fallback)
const branch = await getOrCreateBranch(story);
const base = await runner.getDefaultBaseBranch();
const title = `Implement Story ${story.id}: ${story.title}`;
const body = `
## Summary

Implements Story ${story.id}: ${story.title}

Closes #${issue.issueNumber}
Part of Epic ${epic.id}: ${epic.title}

## Testing

- ✅ All tests pass
- ✅ Coverage: ${coverage}%
`.trim();

try {
  const pr = await runner.createPR({
    story,
    issue,
    base,
    head: branch.branchName,
    title,
    body,
  });
} catch (error) {
  console.error(`❌ PR creation failed: ${error.message}`);
  console.log(`📝 Manual PR creation required:`);
  console.log(
    `   gh pr create --base ${base} --head ${branch.branchName} --title "${title}"`
  );

  // Mark story as blocked
  await runner.updateStatus(story, "blocked");

  // Continue to next story or pause
  const choice = await askUser(
    "Continue to next story or pause? (continue/pause)"
  );
  if (choice === "pause") {
    throw new Error("User paused execution after PR creation failure");
  }
}
```

#### 2.4 Mark Story for Review

- **Update sprint-status.yaml:** Change story status from `in-progress` → `review`
- **Update state file:** Mark story as "🔍 In Review"
- **Commit state change:** `git commit -m "chore: mark story X.Y for review"`

#### 2.5 Multi-Agent Code Review Loop (Max 3 Rounds)

Execute up to 3 review-fix cycles to achieve code quality convergence:

**For round = 1 to 3:**

##### Step A: Spawn Reviewer Agent (Fresh Context)

- **Use Task tool** with `subagent_type: general-purpose`
- **CRITICAL:** Reviewer agent has NO implementation context
- **Runs:** `/bmad-bmm-code-review` workflow
- **Output:** Creates `docs/progress/story-X-Y-review-findings-round-{round}.md`

**Findings Document Format:**

```markdown
# Story X.Y Code Review Findings - Round {round}

**Reviewer:** Agent (Fresh Context)
**Date:** YYYY-MM-DD HH:MM
**Branch:** story-X-Y-description
**Commit:** abc123def

## Critical Issues (Must Fix)

1. **[Category]:** Description
   - **File:** path/to/file.ts:line
   - **Problem:** Specific problem description
   - **Impact:** Why this matters
   - **Fix:** Suggested fix

## Important Issues (Should Fix)

2. **[Category]:** Description
   - **File:** path/to/file.ts:line
   - **Problem:** Specific problem description
   - **Impact:** Why this matters
   - **Fix:** Suggested fix

## Minor Issues (Nice to Have)

3. **[Category]:** Description
   - **File:** path/to/file.ts:line
   - **Problem:** Specific problem description
   - **Impact:** Why this matters
   - **Fix:** Suggested fix

## Summary

- **Total findings:** 3
- **Critical:** 1
- **Important:** 1
- **Minor:** 1
- **Recommendation:** Fix critical and important issues, then re-review
```

##### Step B: Decision Point

**Clean State Definition:**

A story is considered CLEAN when:

- **MUST-FIX findings:** 0 (Critical + Important combined)
- **NICE-TO-HAVE findings:** Acceptable (Minor, up to 3)

**Reviewer MUST categorize all findings:**

- **MUST-FIX (Critical):** Security vulnerabilities, crashes, data loss, ADR violations, hook violations, missing critical tests
- **MUST-FIX (Important):** Performance issues, incomplete implementation, architectural concerns, significant test gaps
- **NICE-TO-HAVE (Minor):** Code style, naming conventions, documentation, minor refactoring suggestions

**If MUST-FIX count == 0:**

- Review clean! ✅
- Exit loop
- Proceed to Step 2.6 (Finalize Story)

**If MUST-FIX count > 0 AND round < 3:**

- Continue to Step C (Spawn Fixer Agent)

**If MUST-FIX count > 0 AND round == 3:**

- **Max rounds exceeded!** ⚠️
- Mark story as `blocked-review` in sprint-status.yaml
- Update state file: "❌ Blocked - Max review rounds exceeded"
- **Escalate to human:**

  ```
  ⚠️ Story X.Y Review Blocked

  After 3 review rounds, issues remain:
  - Critical: 1
  - Important: 2
  - Minor: 1

  Findings document: docs/progress/story-X-Y-review-findings-round-3.md

  Options:
  a) Manual review and fix (pause autonomous workflow)
  b) Accept findings and mark story complete (not recommended)
  c) Continue with 1 more review round (override limit)

  Your choice:
  ```

- Wait for human decision
- Do NOT continue to next story

##### Step C: Spawn Fixer Agent (Implementation Context)

- **Use Task tool** with `subagent_type: general-purpose`
- **Provide context:** Implementation history + findings document
- **Task:** "Address all findings in `docs/progress/story-X-Y-review-findings-round-{round}.md`"

**Fixer Agent Instructions:**

```markdown
You are fixing code review findings for Story X.Y.

**Context:**

- Story: [Story Title]
- Findings: docs/progress/story-X-Y-review-findings-round-{round}.md
- Branch: story-X-Y-description

**Your task:**

1. Read the findings document completely
2. For each finding (Critical → Important → Minor):
   - Understand the problem
   - Implement the fix
   - Ensure hooks still pass (TDD, architecture, shared libs)
3. Run tests after each fix (must pass)
4. Commit fixes: `fix: address code review round {round} - [brief description]`

**Rules:**

- Fix ALL critical and important issues
- Fix minor issues if time permits
- Maintain test coverage (80%+)
- Follow hooks enforcement (they will block violations)
- Do NOT skip tests
- Commit after each logical group of fixes

**When complete:**

- Report: "Fixed X issues from round {round}"
- List: Which findings were addressed
- Note: Any findings that couldn't be fixed and why
```

**Fixer Agent Actions:**

1. Read findings document
2. For each finding:
   - Navigate to file
   - Implement fix
   - Run tests (hooks enforce they pass)
   - Commit: `fix: address review round {round} - [issue category]`
3. Report completion with summary

##### Step D: Loop Back to Step A (Next Review Round)

- Increment round counter
- If round <= 3, spawn new reviewer agent (fresh context)
- Repeat until findings.count == 0 or round == 3

#### 2.6 Finalize Story (After Clean Review)

**Step 1: Sync with Latest Main**

Before marking story complete, ensure branch is up-to-date with main:

```bash
# Fetch latest main
git fetch origin main

# Merge main into story branch (no force push needed)
git merge origin/main
```

**Why merge instead of rebase:**

- ✅ Preserves commit history (no rewrites)
- ✅ Follows Invariant #3: "Never force push"
- ✅ Safe for branches already pushed to remote
- ✅ GitHub PR shows clean merge preview

**If merge succeeds (no conflicts):**

- Re-run tests: `npm test` (hooks enforce they pass)
- Push: `git push origin story-X-Y-branch` (standard push, no `-f`)
- Continue to Step 2

**If merge has conflicts:**

- **Auto-resolve (if possible):**
  - Simple additions to imports/exports
  - Non-overlapping changes to different sections
  - Package.json dependency additions
- **Escalate to human (if complex):**
  - Logic changes in same function
  - Deletions or renames
  - Multiple conflicts in same file
  - Conflicts in critical files (shared libs, types, schemas)

**Human escalation message:**

```
⚠️ Merge Conflicts Detected

Story X.Y has conflicts with main branch:
- Conflicting files: 3
  - shared/types/index.ts (imports section)
  - backend/functions/save/handler.ts (logic change)
  - package.json (dependencies)

Options:
a) Auto-resolve simple conflicts (imports only)
b) Manual resolution required (pause workflow)
c) Skip story for now, continue to next

Your choice:
```

**Step 2: Update sprint-status.yaml**

- Change story status `review` → `done`

**Step 3: Update PR description**

Add review summary:

```markdown
## Code Review Summary

- Review rounds: 2
- Final status: ✅ Clean (no findings)
- Findings addressed: 5 (3 critical, 2 important)
- Review documents:
  - Round 1: docs/progress/story-X-Y-review-findings-round-1.md
  - Round 2: docs/progress/story-X-Y-review-findings-round-2.md
```

- **Update state file:** Mark story "✅ Complete - Reviewed & Clean"
- **Show summary:**

  ```
  ✅ Story X.Y Complete & Reviewed
  - PR: #N (https://github.com/.../pull/N)
  - Tests: 15 passed, 0 failed
  - Coverage: 87%
  - Review rounds: 2
  - Final status: Clean (no findings)
  - Findings fixed: 5 total

  Ready for human merge approval.
  ```

#### 2.7 Post-Story Checkpoint (Human Approval)

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
  - `skip` → Skip current story (with dependency validation, see below)

**Skip Validation (Prevents Dependency Integrity Violations):**

When user chooses `skip`, check if skipped story has dependents:

```javascript
async function handleSkip(currentStory, remainingStories) {
  // Find stories that depend on the current story
  const dependents = remainingStories.filter((s) =>
    s.dependencies.includes(currentStory.id)
  );

  if (dependents.length === 0) {
    // Safe to skip - no downstream impact
    console.log(`✅ Skipping Story ${currentStory.id} (no dependents)`);
    return { action: "skip", blockedStories: [] };
  }

  // Show downstream impact
  console.warn(`⚠️ Skipping Story ${currentStory.id} will block:`);
  for (const dep of dependents) {
    console.warn(`   - Story ${dep.id}: ${dep.title}`);
  }

  // Require explicit choice
  const choice = await askUser(
    "Options:\n" +
      "  a) Skip entire sub-tree (skip current story + all dependents)\n" +
      "  b) Go back (do not skip, continue with current story)\n" +
      "  c) Remove dependents from scope (skip current story, manually handle dependents later)\n" +
      "Your choice:"
  );

  if (choice === "a") {
    // Mark all dependents as blocked
    return {
      action: "skip_with_dependents",
      blockedStories: [currentStory.id, ...dependents.map((d) => d.id)],
    };
  } else if (choice === "b") {
    // Cancel skip, return to story
    return { action: "cancel_skip", blockedStories: [] };
  } else if (choice === "c") {
    // Skip only current story, remove dependents from scope
    console.warn(
      `⚠️ Dependents removed from scope: ${dependents.map((d) => d.id).join(", ")}`
    );
    return {
      action: "skip_and_remove_dependents",
      blockedStories: [currentStory.id],
      removedStories: dependents.map((d) => d.id),
    };
  }
}
```

**Example Output:**

```
✅ Story 1.2 Complete
Continue to Story 1.3? (y/n/pause/skip)
> skip

⚠️ Skipping Story 1.3 will block:
   - Story 1.4: List user projects

Options:
  a) Skip entire sub-tree (skip 1.3 + block 1.4)
  b) Go back (do not skip, continue with 1.3)
  c) Remove dependents from scope (skip 1.3, handle 1.4 manually later)
Your choice: a

✅ Skipped Story 1.3
✅ Blocked Story 1.4 (dependency 1.3 not met)

Next: Story 1.5 - Project search
```

#### 2.5 Integration Checkpoint (NEW - Runs After Stories with Dependents)

**When to Run:**

After completing a story that has dependent stories (detected in Phase 1.2).

**Purpose:**

Validate that dependent stories are still valid after upstream changes.

**Example:**

```
✅ Story 1.1 Complete

⚠️ Integration Checkpoint: Story 1.1 has 2 dependent stories (1.2, 1.3)

Validating dependent stories:
- Story 1.2: Save project to DynamoDB [depends on 1.1]
- Story 1.3: Project validation logic [depends on 1.1]

Running validation checks:
1. Check if Story 1.1 changes affected shared files used by 1.2 or 1.3
2. Check if Story 1.1 changes modified interfaces/types that 1.2 or 1.3 depend on
3. Check if Story 1.1 acceptance criteria are still met

Validation Results:
✅ Story 1.2: No conflicts detected
⚠️ Story 1.3: Shared type 'ProjectSchema' was modified

Recommendation:
- Story 1.2 can proceed as planned
- Story 1.3 may need acceptance criteria review before implementation

Continue to Story 1.2? (y/n/pause/review-1.3)
```

**Validation Checks:**

**Helper Function:**

```javascript
// Deterministic branch name computation (used throughout workflow)
function branchNameFor(story) {
  return `story-${story.id.replace(".", "-")}-${slugify(story.title)}`;
}
```

1. **Shared File Changes (uses git diff, not `touches` field):**

```javascript
// Get base branch dynamically (don't hardcode "main")
const baseBranch = await runner.getDefaultBaseBranch(); // "main" or "master"

// Compute branch name deterministically
const story11BranchName = branchNameFor(story11); // e.g., "story-1-1-user-registration"

// Get ACTUAL files modified in Story 1.1 (source of truth: git diff)
// Use triple-dot for PR-style diff (merge base to HEAD)
const actualChangedFiles = await execCommand(
  `git diff --name-only origin/${baseBranch}...${story11BranchName}`
);

// Check if any dependent stories expected to touch those files
for (const depStory of story11.dependents) {
  const expectedFiles = depStory.touches || []; // Advisory hint from frontmatter
  const overlap = actualChangedFiles.filter((f) =>
    expectedFiles.some((expected) => f.includes(expected))
  );

  if (overlap.length > 0) {
    console.warn(
      `⚠️ Story ${depStory.id}: Upstream changes to ${overlap.join(", ")}`
    );
  }

  // Detect surprises: actual changes differ from `touches` field
  const unexpectedChanges = actualChangedFiles.filter(
    (f) => !expectedFiles.some((expected) => f.includes(expected))
  );
  if (unexpectedChanges.length > 0) {
    console.warn(
      `⚠️ Story ${story11.id}: Unexpected file changes not in \`touches\`: ${unexpectedChanges.join(", ")}`
    );
  }
}
```

**Note:** `touches` field is **advisory only** (used for risk prediction before implementation). **Source of truth** for integration checkpoints is `git diff` (actual files changed).

2. **Interface/Type Changes:**

```javascript
// Parse TypeScript types exported by Story 1.1
const story11Types = await getExportedTypes(story11BranchName);

// Check if dependent stories import those types
for (const depStory of story11.dependents) {
  const depStoryImports = await getExpectedImports(depStory);
  const typeChanges = story11Types.filter((t) =>
    depStoryImports.some((i) => i.includes(t.name))
  );

  if (typeChanges.length > 0) {
    console.warn(
      `⚠️ Story ${depStory.id}: Type changes detected: ${typeChanges.map((t) => t.name).join(", ")}`
    );
  }
}
```

3. **Acceptance Criteria Validation:**

```javascript
// Re-run acceptance tests for Story 1.1 to ensure they still pass
const testResults = await runTests(story11.testFiles);

if (testResults.failed > 0) {
  console.error(
    `❌ Story ${story11.id}: Acceptance tests failing after implementation`
  );
  console.error(
    `   This may affect dependent stories: ${story11.dependents.map((d) => d.id).join(", ")}`
  );

  // Escalate to user
  const choice = await askUser(
    "Continue anyway or pause to investigate? (continue/pause)"
  );
  if (choice === "pause") {
    throw new Error(
      "User paused execution at integration checkpoint due to test failures"
    );
  }
}
```

**User Options at Checkpoint:**

- `y` or `yes` → Continue to next story
- `n` or `no` → Stop execution
- `pause` → Pause for manual investigation
- `review-X.Y` → Show detailed diff for Story X.Y

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
   - Review rounds: 14 total
   - Findings fixed: 23 total
   - Blockers encountered: 1

   ## Story Status

   | Story | Status      | PR  | Review Rounds | Findings Fixed | Duration | Notes                             |
   | ----- | ----------- | --- | ------------- | -------------- | -------- | --------------------------------- |
   | 1.1   | ✅ Complete | #74 | 2 (clean)     | 5              | 15m      | Clean after round 2               |
   | 1.2   | ✅ Complete | #75 | 1 (clean)     | 0              | 18m      | Clean on first review             |
   | 1.3   | ❌ Blocked  | -   | -             | -              | -        | Tests failed, needs investigation |
   | 1.4   | ✅ Complete | #76 | 3 (clean)     | 8              | 22m      | Clean after round 3               |
   | ...   | ...         | ... | ...           | ...            | ...      | ...                               |

   ## Metrics

   - Average story time: 18 minutes (includes review time)
   - Test pass rate: 98%
   - **Review convergence:** 85% clean by round 2, 100% by round 3
   - **Average review rounds:** 2 per story
   - **Findings per story:** 3.3 average (ranging 0-8)
   - **Most common issues:** Test coverage (40%), Architecture compliance (30%), Performance (20%), Security (10%)
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

| Story | Status         | PR  | Tests    | Coverage | Review Rounds | Duration | Notes         |
| ----- | -------------- | --- | -------- | -------- | ------------- | -------- | ------------- |
| 1.1   | ✅ Complete    | #74 | 15/15 ✅ | 87%      | 2 (clean)     | 15m      | -             |
| 1.2   | ✅ Complete    | #75 | 12/12 ✅ | 92%      | 1 (clean)     | 18m      | -             |
| 1.3   | 🔄 In Progress | -   | -        | -        | -             | -        | Started 15:00 |
| 1.4   | ⏳ Pending     | -   | -        | -        | -             | -        | -             |
| 1.5   | ⏳ Pending     | -   | -        | -        | -             | -        | -             |
| 1.6   | ⏳ Pending     | -   | -        | -        | -             | -        | -             |
| 1.7   | ⏳ Pending     | -   | -        | -        | -             | -        | -             |
| 1.8   | ⏳ Pending     | -   | -        | -        | -             | -        | -             |

## Metrics

- Stories completed: 2/8 (25%)
- PRs opened: 2
- Tests passed: 27/27
- Average coverage: 89.5%
- **Review rounds:** 3 total (avg 1.5 per story)
- **Findings fixed:** 8 total (5 critical, 3 important)
- **Review convergence rate:** 100% (all stories reached clean state)
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
- **Test coverage gates** — Configurable per repo (default: coverage must not decrease; optionally: min-80% or per-story override via `coverage_gate` frontmatter field)
- **Auto-formatted code** — Prettier + ESLint on every file
- **TypeScript validated** — No type errors allowed
- **Stop hook** — Enforces tests pass + coverage gates before allowing story completion

---

## Architecture: Core vs CLI Separation

### Overview

The workflow documentation describes orchestration logic, but implementation must separate concerns for testability, portability, and composability.

### Current State (Documentation Prototype)

- Workflow doc mixes orchestration logic with CLI commands (`gh`, `git`)
- Examples show implementation details inline
- Hard to test without real GitHub
- Hard to adapt for other tracking systems

### Target Architecture (Implementation)

#### Layer 1: Orchestration Core (`src/orchestrator/`)

**Purpose:** Pure orchestration logic - no side effects

**Responsibilities:**

- Load and validate epic/story definitions
- Build dependency graph and perform topological sort
- Coordinate story execution through StoryRunner interface
- Validate integration checkpoints
- Manage state transitions

**Key Classes:**

```typescript
// Core orchestrator - framework-agnostic
class EpicOrchestrator {
  constructor(
    private runner: StoryRunner,
    private stateManager: StateManager,
    private config: OrchestratorConfig
  ) {}

  async executeEpic(
    epic: Epic,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    // 1. Load story files and parse YAML frontmatter
    const stories = await this.loadStories(epic);

    // 2. Build dependency graph
    const graph = DependencyAnalyzer.buildGraph(stories);

    // 3. Detect cycles and perform topological sort
    const executionOrder = DependencyAnalyzer.topologicalSort(graph);

    // 4. Execute stories in order
    for (const story of executionOrder) {
      await this.executeStory(story);

      // 5. Run integration checkpoints if story has dependents
      if (story.dependents.length > 0) {
        await this.runIntegrationCheckpoint(story);
      }
    }

    return this.buildResult();
  }

  private async executeStory(story: Story): Promise<void> {
    // Check dependencies satisfied
    // Create issue + branch via runner
    // Implement story (via AI agent or human)
    // Create PR via runner
    // Update state
  }
}

// Pure dependency analysis - no I/O
class DependencyAnalyzer {
  static buildGraph(stories: Story[]): DependencyGraph {
    // Build graph from story.dependencies arrays
  }

  static topologicalSort(graph: DependencyGraph): Story[] {
    // Kahn's algorithm or DFS-based toposort
  }

  static detectCycles(graph: DependencyGraph): Cycle[] {
    // Tarjan's algorithm for cycle detection
  }
}

// Pure checkpoint validation - no GitHub API calls
class IntegrationCheckpoint {
  static async validate(
    story: Story,
    changedFiles: string[], // From git diff
    dependents: Story[]
  ): Promise<CheckpointResult> {
    // 1. Check file overlaps
    // 2. Detect type/interface changes (if TypeScript)
    // 3. Return Green/Yellow/Red with reasoning
  }
}
```

**No Side Effects:**

- No file I/O (state manager injected)
- No GitHub API calls (StoryRunner injected)
- No git commands (runner handles)
- Pure functions for analysis

**Testability:**

```typescript
// Unit tests with mock runner
describe("EpicOrchestrator", () => {
  it("executes stories in dependency order", async () => {
    const mockRunner = new MockStoryRunner();
    const orchestrator = new EpicOrchestrator(mockRunner, stateManager, config);

    const result = await orchestrator.executeEpic(testEpic, {});

    expect(mockRunner.executionOrder).toEqual(["1.1", "1.2", "1.3"]);
  });

  it("fails when circular dependency detected", async () => {
    const epicWithCycle = createCyclicEpic();
    await expect(orchestrator.executeEpic(epicWithCycle)).rejects.toThrow(
      "Cycle detected"
    );
  });
});
```

#### Layer 2: CLI Adapter (`src/cli/bmad-bmm-auto-epic.ts`)

**Purpose:** CLI entry point - handles user interaction and I/O

**Responsibilities:**

- Parse CLI arguments (`--stories`, `--resume`, `--dry-run`)
- Instantiate appropriate StoryRunner (GitHub, DryRun, etc.)
- Provide human-readable progress output
- Handle errors and display to user
- Manage state file I/O

**Implementation:**

```typescript
#!/usr/bin/env node
import { EpicOrchestrator } from "../orchestrator/EpicOrchestrator";
import { GitHubStoryRunner } from "../adapters/GitHubStoryRunner";
import { DryRunStoryRunner } from "../adapters/DryRunStoryRunner";
import { FileSystemStateManager } from "../state/FileSystemStateManager";

async function main(args: string[]) {
  const cliArgs = parseCLIArgs(args);

  // 1. Select runner based on environment
  const runner =
    cliArgs.dryRun || process.env.DRY_RUN === "true"
      ? new DryRunStoryRunner()
      : new GitHubStoryRunner();

  // 2. Load epic definition
  const epic = await loadEpic(cliArgs.epicId);

  // 3. Initialize state manager
  const stateManager = new FileSystemStateManager(
    `docs/progress/${epic.id}-auto-run.md`
  );

  // 4. Create orchestrator
  const orchestrator = new EpicOrchestrator(runner, stateManager, {
    requireMerged: cliArgs.requireMerged,
    coverageGate: cliArgs.coverageGate || "no-decrease",
  });

  // 5. Execute epic with human-friendly output
  console.log(`📋 Epic ${epic.id}: ${epic.title}`);
  console.log(`Found ${epic.stories.length} stories\n`);

  const result = await orchestrator.executeEpic(epic, {
    resume: cliArgs.resume,
    storyFilter: cliArgs.stories,
  });

  // 6. Display results
  console.log(
    `\n✅ Epic complete: ${result.successCount}/${result.totalCount} stories`
  );
  console.log(`⏱️  Total time: ${result.duration}`);
  console.log(`📊 PRs created: ${result.prs.map((pr) => pr.url).join("\n")}`);
}

main(process.argv.slice(2)).catch((err) => {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});
```

#### Layer 3: StoryRunner Adapters (`src/adapters/`)

**Purpose:** Platform-specific integrations

**Implementation Roadmap:**

- **v1 (Current)**: `GitHubCLIRunner` - Uses `gh` CLI + git commands (fastest to ship, least auth ceremony)
- **v2 (Future)**: `GitHubOctokitRunner` - Uses `@octokit/rest` Node library (better for CI/CD, finer control)

**GitHubCLIRunner (v1)** (`src/adapters/GitHubCLIRunner.ts`):

- **Default adapter for v1 implementation**
- Uses `gh` CLI for GitHub operations (issues, PRs, repo queries)
- Uses `git` commands for branch/commit operations
- Simplest auth story (leverages existing `gh auth login`)
- See "StoryRunner Adapters" section below for detailed operations

**GitHubOctokitRunner (v2 - Future)** (`src/adapters/GitHubOctokitRunner.ts`):

- Uses `@octokit/rest` Node library for API calls
- Handles authentication via GitHub App or PAT
- Better retry logic with exponential backoff
- Finer-grained error handling
- No CLI dependency (better for containerized environments)

```typescript
// Example v2 implementation (reference only - not yet built)
import { Octokit } from "@octokit/rest";

export class GitHubOctokitRunner implements StoryRunner {
  private octokit: Octokit;

  constructor(auth: string) {
    this.octokit = new Octokit({ auth });
  }

  async createIssue(story: Story, epic: Epic): Promise<IssueResult> {
    const response = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: `Story ${story.id}: ${story.title}`,
      body: this.buildIssueBody(story, epic),
      labels: ["story", `epic-${epic.id}`],
    });

    return {
      issueNumber: response.data.number,
      issueUrl: response.data.html_url,
    };
  }

  async createBranch(story: Story, branchName: string): Promise<BranchResult> {
    // Use git commands (via child_process) or Octokit git API
    await execAsync(`git checkout -b ${branchName}`);
    return { branchName };
  }

  async branchExists(branchName: string): Promise<boolean> {
    // Check local first (fast)
    const localExists = await execAsync(
      `git show-ref --verify --quiet refs/heads/${branchName}`
    ).then(
      () => true,
      () => false
    );

    if (localExists) return true;

    // Check remote with ls-remote (no fetch needed)
    const remoteExists = await execAsync(
      `git ls-remote --exit-code --heads origin "${branchName}"`
    ).then(
      () => true,
      () => false
    );

    return remoteExists;
  }

  // ... other methods
}
```

**DryRunStoryRunner** (`src/adapters/DryRunStoryRunner.ts`):

- Logs all operations (no side effects)
- Returns mock results
- Perfect for testing orchestration logic

```typescript
export class DryRunStoryRunner implements StoryRunner {
  private log: string[] = [];

  async createIssue(story: Story, epic: Epic): Promise<IssueResult> {
    this.log.push(`[DRY RUN] Would create issue: Story ${story.id}`);
    return {
      issueNumber: Math.floor(Math.random() * 1000),
      issueUrl: `https://github.com/mock/issues/123`,
    };
  }

  async createBranch(story: Story, branchName: string): Promise<BranchResult> {
    this.log.push(`[DRY RUN] Would create branch: ${branchName}`);
    return { branchName };
  }

  getLog(): string[] {
    return this.log;
  }
}
```

### File Structure

```
src/
├── orchestrator/
│   ├── EpicOrchestrator.ts         # Core orchestration logic
│   ├── DependencyAnalyzer.ts       # Graph building, toposort, cycle detection
│   ├── IntegrationCheckpoint.ts    # Validation logic (file overlaps, type changes)
│   ├── StateTransitions.ts         # Story state machine
│   └── __tests__/
│       ├── EpicOrchestrator.test.ts
│       ├── DependencyAnalyzer.test.ts
│       └── IntegrationCheckpoint.test.ts
├── adapters/
│   ├── StoryRunner.interface.ts    # Interface definition
│   ├── GitHubStoryRunner.ts        # Octokit + git integration
│   ├── DryRunStoryRunner.ts        # No-op testing adapter
│   ├── JiraStoryRunner.ts          # Jira API integration (future)
│   ├── LinearStoryRunner.ts        # Linear API integration (future)
│   └── __tests__/
│       ├── GitHubStoryRunner.test.ts
│       └── DryRunStoryRunner.test.ts
├── state/
│   ├── StateManager.interface.ts   # State persistence abstraction
│   ├── FileSystemStateManager.ts   # Markdown state file
│   ├── JSONStateManager.ts         # JSON state file (alternative)
│   └── __tests__/
│       └── StateManager.test.ts
├── cli/
│   ├── bmad-bmm-auto-epic.ts       # CLI entry point
│   ├── CLIArgs.ts                  # Argument parsing
│   └── Output.ts                   # Human-readable formatting
├── types/
│   ├── Epic.ts                     # Epic/Story type definitions
│   ├── ExecutionResult.ts          # Orchestration result types
│   ├── CheckpointResult.ts         # Integration checkpoint types
│   └── Config.ts                   # Configuration types
└── utils/
    ├── git.ts                      # Git command wrappers
    ├── yaml.ts                     # YAML frontmatter parsing
    └── slugify.ts                  # Branch name generation
```

### Benefits

1. **Testability**
   - Unit test orchestrator with mock runner (no GitHub API calls)
   - Integration test adapters against real/sandbox GitHub
   - Fast test suite (no network I/O for core logic)

2. **Portability**
   - Swap GitHub for Jira without changing orchestration
   - Support multiple tracking systems simultaneously
   - Run in any environment (local, CI/CD, cloud)

3. **Composability**
   - Reuse orchestrator in web UI
   - Embed in VSCode extension
   - Expose as REST API
   - Use in batch processing jobs

4. **Maintainability**
   - Clear separation of concerns
   - Each layer has single responsibility
   - Easy to add new features (new adapters, new checkpoints)

### Migration Strategy (Epic 1 Implementation)

**Story 1.1: Extract Interfaces and Types**

- Define `StoryRunner` interface (already done in doc)
- Define `Epic`, `Story`, `ExecutionResult` types
- Define `StateManager` interface
- Create skeleton file structure

**Story 1.2: Implement Core Orchestrator**

- Implement `EpicOrchestrator` class
- Implement `DependencyAnalyzer` (graph, toposort, cycle detection)
- Implement `IntegrationCheckpoint` validation logic
- Write comprehensive unit tests (mock runner)

**Story 1.3: Implement GitHubStoryRunner**

- Install `@octokit/rest` dependency
- Implement all StoryRunner methods using Octokit
- Implement git command wrappers
- Write integration tests (against sandbox repo or mocked Octokit)

**Story 1.4: Implement CLI Layer**

- Create `bmad-bmm-auto-epic.ts` entry point
- Parse CLI arguments
- Wire up orchestrator + runner + state manager
- Maintain existing UX (same output format)

**Story 1.5: Implement DryRunStoryRunner**

- Create no-op adapter for testing
- Update orchestrator tests to use DryRunStoryRunner
- Add `--dry-run` flag to CLI

**Story 1.6: Add State File Management**

- Implement `FileSystemStateManager`
- Handle resume logic (reconcile state file with GitHub)
- Atomic writes (temp file + rename)

**Acceptance Criteria:**

- All existing workflow functionality works
- 80%+ test coverage on orchestrator core
- Can run full epic in `--dry-run` mode
- State file format matches current spec

---

## Future Enhancement: Structured Event Log

### Problem

Current activity log in state file is prose, making it hard to:

- Parse and query programmatically
- Generate metrics and dashboards
- Debug failed runs
- Build tooling around the workflow

### Solution

Add machine-parseable JSON-lines event stream alongside state file.

### Implementation

**Location:** `docs/progress/epic-{id}-events.jsonl`

**Schema:**

Each line is a JSON object with this structure:

```typescript
interface WorkflowEvent {
  ts: string; // ISO 8601 timestamp
  event: EventType; // Event type (enum)
  story_id?: string; // Story ID (if applicable)
  [key: string]: any; // Event-specific fields
}

type EventType =
  | "epic.started"
  | "epic.completed"
  | "epic.failed"
  | "story.started"
  | "story.completed"
  | "story.failed"
  | "story.skipped"
  | "story.blocked"
  | "dependency.checked"
  | "dependency.failed"
  | "issue.created"
  | "issue.found"
  | "branch.created"
  | "branch.found"
  | "pr.created"
  | "pr.found"
  | "tests.started"
  | "tests.passed"
  | "tests.failed"
  | "hook.passed"
  | "hook.failed"
  | "checkpoint.started"
  | "checkpoint.passed"
  | "checkpoint.failed";
```

**Example Event Stream:**

```jsonl
{"ts":"2026-02-06T10:23:00Z","event":"epic.started","epic_id":"Epic-1","story_count":8}
{"ts":"2026-02-06T10:23:05Z","event":"story.started","story_id":"1.1","title":"User registration"}
{"ts":"2026-02-06T10:23:10Z","event":"issue.created","story_id":"1.1","issue_number":42,"issue_url":"https://github.com/repo/issues/42"}
{"ts":"2026-02-06T10:23:12Z","event":"branch.created","story_id":"1.1","branch":"story-1-1-user-registration"}
{"ts":"2026-02-06T10:25:30Z","event":"tests.started","story_id":"1.1"}
{"ts":"2026-02-06T10:25:45Z","event":"tests.passed","story_id":"1.1","coverage":87,"duration_sec":15}
{"ts":"2026-02-06T10:25:50Z","event":"pr.created","story_id":"1.1","pr_number":43,"pr_url":"https://github.com/repo/pull/43"}
{"ts":"2026-02-06T10:25:55Z","event":"story.completed","story_id":"1.1","duration_sec":175}
{"ts":"2026-02-06T10:26:00Z","event":"checkpoint.started","story_id":"1.1","dependents":["1.2","1.3"]}
{"ts":"2026-02-06T10:26:05Z","event":"checkpoint.passed","story_id":"1.1","result":"green","conflicts":0}
{"ts":"2026-02-06T10:26:10Z","event":"story.started","story_id":"1.2","title":"Save project"}
{"ts":"2026-02-06T10:26:15Z","event":"dependency.checked","story_id":"1.2","depends_on":["1.1"],"satisfied":true}
{"ts":"2026-02-06T10:28:45Z","event":"hook.failed","story_id":"1.2","hook":"tdd-guard","error":"No tests found for new code"}
{"ts":"2026-02-06T10:30:00Z","event":"hook.passed","story_id":"1.2","hook":"tdd-guard","retry":1}
{"ts":"2026-02-06T10:32:30Z","event":"story.completed","story_id":"1.2","duration_sec":380}
```

### Usage Examples

**Query Failed Stories:**

```bash
jq 'select(.event=="story.failed")' epic-1-events.jsonl
```

**Calculate Average Story Duration:**

```bash
jq -s 'map(select(.event=="story.completed")) | map(.duration_sec) | add / length' epic-1-events.jsonl
```

**Find Hook Failures:**

```bash
jq 'select(.event=="hook.failed") | {story: .story_id, hook: .hook, error: .error}' epic-1-events.jsonl
```

**Generate Coverage Report:**

```bash
jq -s 'map(select(.event=="tests.passed")) | map({story: .story_id, coverage: .coverage})' epic-1-events.jsonl
```

**Timeline Visualization:**

```bash
# Convert to CSV for spreadsheet import
jq -r '[.ts, .event, .story_id // "", .duration_sec // ""] | @csv' epic-1-events.jsonl > timeline.csv
```

### Integration with Orchestrator

```typescript
class EventLogger {
  constructor(private filepath: string) {}

  async log(event: WorkflowEvent): Promise<void> {
    const line = JSON.stringify(event) + "\n";
    await fs.appendFile(this.filepath, line);
  }
}

// In EpicOrchestrator
class EpicOrchestrator {
  private eventLogger: EventLogger;

  async executeStory(story: Story): Promise<void> {
    await this.eventLogger.log({
      ts: new Date().toISOString(),
      event: "story.started",
      story_id: story.id,
      title: story.title,
    });

    try {
      // ... execute story ...

      await this.eventLogger.log({
        ts: new Date().toISOString(),
        event: "story.completed",
        story_id: story.id,
        duration_sec: elapsed,
      });
    } catch (error) {
      await this.eventLogger.log({
        ts: new Date().toISOString(),
        event: "story.failed",
        story_id: story.id,
        error: error.message,
      });
      throw error;
    }
  }
}
```

### Benefits

1. **Post-Mortem Analysis**
   - Identify bottlenecks (slow stories, frequent hook failures)
   - Understand failure patterns
   - Replay execution for debugging

2. **Metrics and Dashboards**
   - Average story duration
   - Hook failure rates by type
   - Test coverage trends
   - Epic completion time prediction

3. **Alerting and Monitoring**
   - Trigger alerts on story failures
   - Monitor long-running stories
   - Track epic progress in real-time

4. **Tooling Integration**
   - Import into Grafana/Datadog/Splunk
   - Build custom dashboards
   - Generate executive reports

### Implementation Priority

**Not required for v1** - Prose activity log in state file is sufficient for initial implementation.

**Recommended for v2** after core workflow is stable and in production use.

---

## Dependencies

### Required

- Git repository with default branch (main/master/trunk - auto-detected via `getDefaultBaseBranch()`)
- **StoryRunner adapter** (GitHub, Jira, or DryRun)
  - For GitHub: `gh` CLI installed and authenticated
  - For Jira: Jira API credentials configured
  - For DryRun: No external dependencies (testing mode)
- Epic file exists at `_bmad-output/planning-artifacts/epics/epic-N.md`
- Hooks configured and active in `.claude/settings.json`
- Node.js (for `.cjs` hooks and StoryRunner logic)
- npm/package.json (for test, lint, build commands)

### Optional

- Existing `/project-start-story` command (for branch/issue creation pattern)
- Existing `/bmad-bmm-dev-story` command (for story implementation pattern)
- Custom epic file location (can be specified with `--epic-path`)

---

## StoryRunner Adapters

### GitHubCLIRunner (v1 - Default)

Uses GitHub CLI (`gh`) and Git to manage issues, branches, and PRs.

**This is the v1 implementation** referenced in "Architecture: Core vs CLI Separation" section.

**Setup:**

```bash
# Install GitHub CLI
brew install gh  # macOS
# OR
sudo apt install gh  # Linux

# Authenticate
gh auth login

# Verify
gh auth status
```

**Operations:**

- `createIssue(story, epic)` → `gh issue create --title "Story X.Y: Title" --body "..."`
- `createBranch(story, branchName)` → `git checkout -b ${branchName}`
- `createPR({ story, issue, base, head, title, body })` → `gh pr create --base ${base} --head ${head} --title "${title}" --body "${body}"`
- `findIssueByStoryId(storyId)` → Searches for unique tag to avoid collisions:

  ```bash
  # Hardened: search for unique tag (prevents "Story 1.2" matching "Story 11.2")
  gh issue list --search "bmad:story=${storyId} bmad:epic=${epicId}" --json number,url

  # Fallback: search title (less reliable, may collide across epics)
  # gh issue list --search "Story ${storyId}" --json number,url
  ```

  Issue body/title must include tag: `bmad:story=1.2 bmad:epic=Epic-1`

- `findPRByBranch(branchName)` → `gh pr list --head ${branchName} --json number,url`
- `branchExists(branchName)` → Pure check (no side effects). Checks local (`refs/heads/${branchName}`) OR remote:

  ```bash
  # Check local first (fast)
  if git show-ref --verify --quiet refs/heads/$branchName; then
    exit 0
  fi

  # Check remote (deterministic, no fetch needed)
  # Preferred: git ls-remote (no local state changes, handles auth cleanly)
  git ls-remote --exit-code --heads origin "$branchName" >/dev/null 2>&1

  # Alternative (if ls-remote unavailable): fetch + show-ref
  # git fetch origin $branchName --quiet 2>/dev/null || true
  # git show-ref --verify --quiet refs/remotes/origin/$branchName
  ```

- `ensureBranchCheckedOut(branchName)` → Checks out branch locally if it exists only on remote:
  ```bash
  # If remote exists but not local, check out tracking branch
  if ! git show-ref --verify --quiet refs/heads/$branchName; then
    git checkout -b $branchName --track origin/$branchName
  fi
  ```
- `getDefaultBaseBranch()` → `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`
- `updateStatus(story, status)` → Updates `sprint-status.yaml` file (YAML manipulation)

### DryRunStoryRunner (Testing)

No-op adapter that logs operations without making external API calls.

**Usage:**

```bash
# Enable dry-run mode
export DRY_RUN=true

# Run workflow
/bmad-bmm-auto-epic Epic-1

# Output:
# [DRY-RUN] Would create issue: Story 1.1 - User registration
# [DRY-RUN] Would create branch: story-1-1-user-registration
# [DRY-RUN] Would create PR: Implement Story 1.1
```

**Use Cases:**

- Testing workflow logic without creating real issues/PRs
- CI/CD pipeline validation
- Demo/training environments
- Debugging dependency detection

### JiraStoryRunner (Future)

Integration with Jira for teams using Jira instead of GitHub Issues.

**Planned Operations:**

- `createIssue()` → Jira REST API `/issue`
- `createBranch()` → Git (same as GitHub)
- `createPR()` → GitHub PR with Jira issue link
- `updateStatus()` → Jira workflow transition

### LinearStoryRunner (Future)

Integration with Linear for modern project management.

**Planned Operations:**

- `createIssue()` → Linear GraphQL API
- `createBranch()` → Git (same as GitHub)
- `createPR()` → GitHub PR with Linear issue link
- `updateStatus()` → Linear state transition

---

## Dependency Syntax

### How to Define Dependencies in Story Files

**Primary Method: YAML Frontmatter (Recommended)**

Stories should declare dependencies in machine-readable YAML frontmatter at the top of the file:

```yaml
---
id: 1.4
title: List user projects
depends_on: [1.2, 1.3]
touches: [backend/api/projects, shared/types]
risk: medium
---
```

**Required Fields:**

- `id` - Story ID (e.g., "1.4")
- `title` - Story title
- `depends_on` - Array of story IDs (empty array `[]` if no dependencies)

**Optional Fields:**

- `touches` - Files/directories expected to be modified
- `risk` - Risk level: `low`, `medium`, `high`

**Fallback Method: Prose Keywords (Legacy)**

If YAML frontmatter is missing, the workflow scans prose for these keywords:

- `requires Story X.Y`
- `depends on Story X.Y`
- `builds on Story X.Y`
- `after Story X.Y is complete`
- `prerequisites: Story X.Y`
- `blocked by Story X.Y`

⚠️ **Warning:** Regex-based detection is fragile and emits warnings. Always prefer YAML frontmatter.

**Examples:**

#### Example 1: Simple Dependency (YAML Frontmatter)

```markdown
---
id: 1.2
title: Save Project to DynamoDB
depends_on: [1.1]
touches: [backend/api/projects, backend/db/projects.ts]
risk: low
---

## Story 1.2: Save Project to DynamoDB

**Acceptance Criteria:**

- Save project uses user ID from Story 1.1 authentication
- ...
```

#### Example 2: Multiple Dependencies (YAML Frontmatter)

```markdown
---
id: 1.4
title: List User Projects
depends_on: [1.2, 1.3]
touches: [backend/api/projects, frontend/pages/ProjectList.tsx]
risk: medium
---

## Story 1.4: List User Projects

**Acceptance Criteria:**

- List projects endpoint returns validated projects only
- Uses validation logic from Story 1.3
- ...
```

#### Example 3: No Dependencies (YAML Frontmatter)

```markdown
---
id: 1.5
title: Project Search
depends_on: []
touches: [backend/api/search, shared/search-utils]
risk: low
---

## Story 1.5: Project Search

**Acceptance Criteria:**

- Search projects by name or description
- ...
```

#### Example 4: Legacy Prose Format (Fallback)

```markdown
## Story 2.5: Advanced Search

**Prerequisites:** Requires Story 2.3 (Indexing strategy), Story 2.4 (Basic search)

**Acceptance Criteria:**

- Search uses indexing strategy from Story 2.3
- After Story 2.4 (Basic search) is complete, add advanced filters
- ...
```

⚠️ **This will trigger a warning:**

```
⚠️ Story 2.5: Dependencies inferred from prose (found: 2.3, 2.4)
   Please add YAML frontmatter to make dependencies explicit:

   ---
   id: 2.5
   depends_on: [2.3, 2.4]
   ---
```

### Automatic Detection

The workflow scans these patterns using regex:

```javascript
const dependencyPatterns = [
  /requires?\s+Story\s+(\d+\.\d+)/gi,
  /depends?\s+on\s+Story\s+(\d+\.\d+)/gi,
  /builds?\s+on\s+Story\s+(\d+\.\d+)/gi,
  /after\s+Story\s+(\d+\.\d+)\s+is\s+complete/gi,
  /prerequisites?:\s*Story\s+(\d+\.\d+)/gi,
  /blocked\s+by\s+Story\s+(\d+\.\d+)/gi,
];

function extractDependencies(storyContent) {
  const deps = [];
  for (const pattern of dependencyPatterns) {
    const matches = storyContent.matchAll(pattern);
    for (const match of matches) {
      deps.push(match[1]); // e.g., "1.2"
    }
  }
  return [...new Set(deps)]; // Remove duplicates
}
```

### Best Practices

1. **Always use YAML frontmatter** — Machine-readable format prevents silent failures
2. **Include empty `depends_on: []`** — Even if no dependencies, be explicit
3. **Add `touches` field** — Helps integration checkpoint detect conflicts
4. **Use story IDs only** — "1.2" not "Story 1.2" or "Save project story"
5. **Avoid circular dependencies** — Workflow will error if detected (1.2 → 1.3 → 1.2)
6. **Keep dependency chains short** — Long chains (>3 levels) are fragile; while current implementation is serial, shorter chains enable future parallelization
7. **Update frontmatter when refactoring** — If dependencies change, update YAML immediately

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
