# StoryRunner Abstraction

Supporting reference for the epic orchestrator. Read this file when entering Phase 1.5 (Initialize StoryRunner) or when performing story operations during Phase 2.

## Interface Definition

The workflow uses a StoryRunner abstraction layer instead of direct `gh` or `git` calls. All GitHub operations go through this interface:

```typescript
interface StoryRunner {
  // Create operations (explicit args for determinism)
  createIssue(story: Story, epic: Epic): Promise<IssueResult>;
  createBranch(story: Story, branchName: string): Promise<BranchResult>;
  createPR(args: {
    story: Story;
    issue: IssueResult;
    base: string;
    head: string;
    title: string;
    body: string;
  }): Promise<PRResult>;

  // Find operations (for idempotency)
  findIssueByStoryId(storyId: string): Promise<IssueResult | null>;
  findPRByBranch(branchName: string): Promise<PRResult | null>;
  branchExists(branchName: string): Promise<boolean>;
  ensureBranchCheckedOut(branchName: string): Promise<void>;

  // Merge verification (for dependency completion policy)
  isPRMerged(story: Story): Promise<boolean>;

  // Status management
  updateStatus(story: Story, status: StoryStatus): Promise<void>;

  // Repository info
  getDefaultBaseBranch(): Promise<string>;
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

type StoryStatus =
  | "pending"
  | "in-progress"
  | "review"
  | "done"
  | "blocked"
  | "paused"
  | "skipped";
```

**Why explicit args?**

- **Deterministic:** No adapter guessing on branch name format
- **Testable:** Caller controls exact values
- **Consistent:** All adapters use same naming convention

## Detection Logic

Select runner based on flags and environment:

```javascript
const isDryRun = argv.dryRun === true || process.env.DRY_RUN === "true";

if (isDryRun) {
  runner = new DryRunStoryRunner();
} else if (fs.existsSync(".github")) {
  runner = new GitHubStoryRunner();
} else {
  throw new Error(
    "No story tracking system detected. Expected .github directory."
  );
}
```

## Branch Name Helper

Deterministic branch name computation (used by caller, not adapter):

```javascript
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

function branchNameFor(story) {
  return `story-${story.id.replace(".", "-")}-${slugify(story.title)}`;
}
// Example: story.id="1.2", story.title="Save Project" → "story-1-2-save-project"
```

## Idempotent Operations

Before creating any resource, check if it already exists. This makes the workflow safe to resume:

### getOrCreateIssue

```javascript
async function getOrCreateIssue(story, epic) {
  const existingIssue = await runner.findIssueByStoryId(story.id);
  if (existingIssue) {
    console.log(`✅ Issue already exists: #${existingIssue.issueNumber}`);
    return existingIssue;
  }
  return await createIssueWithRetry(story, epic);
}
```

### getOrCreateBranch

```javascript
async function getOrCreateBranch(story) {
  const branchName = branchNameFor(story);
  const exists = await runner.branchExists(branchName);
  if (exists) {
    console.log(`✅ Branch already exists: ${branchName}`);
    await runner.ensureBranchCheckedOut(branchName);
    return { branchName };
  }
  return await runner.createBranch(story, branchName);
}
```

### getOrCreatePR

```javascript
async function getOrCreatePR(story, epic, issue, coverage) {
  const branch = await getOrCreateBranch(story);
  const base = await runner.getDefaultBaseBranch();

  const existingPR = await runner.findPRByBranch(branch.branchName);
  if (existingPR) {
    console.log(`✅ PR already exists: #${existingPR.prNumber}`);
    return existingPR;
  }

  const title = `Implement Story ${story.id}: ${story.title}`;
  const body = generatePRBody(story, epic, issue, coverage);

  return await runner.createPR({
    story,
    issue,
    base,
    head: branch.branchName,
    title,
    body,
  });
}
```

### PR Body Template

```markdown
## Summary

Implements Story {story.id}: {story.title}
Closes #{issue.issueNumber}
Part of Epic {epic.id}: {epic.title}

## Testing

- All tests pass
- Coverage: {coverage !== null ? coverage + "%" : "N/A (could not parse from test output)"}
- Hooks enforced: TDD, architecture, shared libs

## Checklist

- [x] Tests written and passing
- [x] Code follows architecture patterns
- [x] Shared libraries used
- [x] Documentation updated (if needed)
```

## Retry Logic

All runner operations wrapped in retry with exponential backoff:

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i));
    }
  }
}
```

## GitHubCLIRunner Implementation

Uses `gh` CLI and `git` commands:

### findIssueByStoryId

Hardened search using unique tags to avoid false matches:

```bash
gh issue list --search "bmad:story=${storyId} bmad:epic=${epicId}" --json number,url --limit 1
```

If no results, fall back to title search:

```bash
gh issue list --search "Story ${storyId}: ${storyTitle}" --state open --json number,url --limit 1
```

### branchExists

Check local refs first, then remote:

```bash
# Local check
git show-ref --verify --quiet refs/heads/${branchName}

# Remote check (if local not found)
git ls-remote --exit-code --heads origin "${branchName}"
```

### ensureBranchCheckedOut

```bash
# If branch exists only on remote
git fetch origin ${branchName}
git checkout -b ${branchName} origin/${branchName}
```

### createBranch

```bash
git fetch origin ${baseBranch}
git checkout -b ${branchName} origin/${baseBranch}
```

**Important:** Always branch from `origin/${baseBranch}` (not HEAD) to ensure branch isolation. After completing Story 1.1, HEAD is on the story-1-1 branch. Without specifying the start point, `git checkout -b` would include Story 1.1's changes in Story 1.2's branch.

### createIssue

```bash
gh issue create \
  --title "Story ${story.id}: ${story.title}" \
  --body "${issueBody}" \
  --label "story,epic-${epic.id},bmad:story=${story.id},bmad:epic=${epic.id}"
```

### createPR

```bash
gh pr create \
  --title "${title}" \
  --body "${body}" \
  --base "${base}" \
  --head "${head}"
```

### isPRMerged

```bash
gh pr view ${branchName} --json state --jq '.state'
# Returns "MERGED" if merged
```

### updateStatus

Sync story status to GitHub issue labels (secondary source):

```bash
# Add status label to issue
gh issue edit ${issueNumber} --add-label "status:${status}" --remove-label "status:pending,status:in-progress,status:review,status:done,status:blocked,status:paused,status:skipped"
```

If the issue doesn't exist yet (story still `pending`), this is a no-op.

### getDefaultBaseBranch

```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

## DryRunStoryRunner Implementation

No-op runner for testing — logs operations, returns deterministic mock data:

```javascript
class DryRunStoryRunner {
  issueCounter = 0;
  prCounter = 0;
  log = [];

  async createIssue(story, epic) {
    this.issueCounter++;
    this.log.push(
      `[DRY-RUN] Would create issue: Story ${story.id}: ${story.title}`
    );
    return {
      issueNumber: this.issueCounter,
      issueUrl: `https://github.com/mock/issues/${this.issueCounter}`,
    };
  }

  async createBranch(story, branchName) {
    this.log.push(`[DRY-RUN] Would create branch: ${branchName}`);
    return { branchName };
  }

  async createPR(args) {
    this.prCounter++;
    this.log.push(`[DRY-RUN] Would create PR: ${args.title}`);
    return {
      prNumber: this.prCounter,
      prUrl: `https://github.com/mock/pull/${this.prCounter}`,
    };
  }

  async findIssueByStoryId() {
    return null;
  }
  async findPRByBranch() {
    return null;
  }
  async branchExists() {
    return false;
  }
  async ensureBranchCheckedOut() {}
  async isPRMerged() {
    return false;
  }
  async updateStatus(story, status) {
    this.log.push(
      `[DRY-RUN] Would update status: Story ${story.id} → ${status}`
    );
  }
  async getDefaultBaseBranch() {
    return "main";
  }
}
```

## Future Adapters

Not implemented in v1:

- **JiraStoryRunner** — Jira Cloud integration
- **LinearStoryRunner** — Linear integration
