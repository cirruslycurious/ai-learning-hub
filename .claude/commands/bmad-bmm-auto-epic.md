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

**Risk Warning (Rule #2):** A story marked "done" with an unmerged PR means code never reached base branch. Dependent stories will proceed anyway, potentially causing broken epic. Mitigation options:

- **Default mode** (current): State file wins; user responsible for merge verification
- **Strict mode** (optional `--require-merged`): Story only satisfies dependency if PR merged OR commit exists on base branch

### Phase 2: Story Implementation Loop

For each story in scope:

#### 2.1 Pre-Implementation

**Check Dependencies:**

Before starting story, verify all dependencies are complete:

```javascript
for (const depStoryId of story.dependencies) {
  const depStatus = getStoryStatus(depStoryId);
  if (depStatus !== "done") {
    throw new Error(
      `Cannot start Story ${story.id}: dependency ${depStoryId} is not complete (status: ${depStatus})`
    );
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

- ✅ `tdd-guard.cjs` — Blocks implementation before tests written
- ✅ `architecture-guard.sh` — Blocks ADR violations (no Lambda→Lambda)
- ✅ `import-guard.sh` — Enforces `@ai-learning-hub/*` shared libraries
- ✅ `auto-format.sh` — Auto-formats all code (Prettier + ESLint)
- ✅ `type-check.sh` — Validates TypeScript
- ✅ Stop hook (agent) — Blocks completion if tests fail

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
- **Test coverage gates** — Configurable per repo (default: coverage must not decrease; optionally: min-80% or per-story override via `coverage_gate` frontmatter field)
- **Auto-formatted code** — Prettier + ESLint on every file
- **TypeScript validated** — No type errors allowed
- **Stop hook** — Enforces tests pass + coverage gates before allowing story completion

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

### GitHubStoryRunner (Default)

Uses GitHub CLI (`gh`) and Git to manage issues, branches, and PRs.

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
