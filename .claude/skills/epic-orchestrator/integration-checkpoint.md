# Integration Checkpoint

Supporting reference for the epic orchestrator. Read this file when entering Step 2.7 (Integration Checkpoint) for a story that has dependents.

## When to Run

After completing a story that has dependent stories (detected in Phase 1.3 via `story.dependents.length > 0`).

**Purpose:** Validate that dependent stories are still valid after upstream changes. Catch file conflicts, type changes, and test regressions before starting dependent stories.

## Validation Checks

### 1. Shared File Changes

Source of truth is `git diff` (actual files changed), NOT the `touches` field (which is advisory only).

```javascript
// Get base branch dynamically (don't hardcode "main")
const baseBranch = await runner.getDefaultBaseBranch();

// Compute branch name deterministically
const completedBranchName = branchNameFor(completedStory);

// Get ACTUAL files modified (triple-dot for PR-style diff)
const actualChangedFiles = await execCommand(
  `git diff --name-only origin/${baseBranch}...${completedBranchName}`
);

// Check if any dependent stories expected to touch those files
for (const depStoryId of completedStory.dependents) {
  const depStory = getStory(depStoryId);
  const expectedFiles = depStory.touches || [];
  const overlap = actualChangedFiles.filter((f) =>
    expectedFiles.some((expected) => f.includes(expected))
  );

  if (overlap.length > 0) {
    console.warn(
      `⚠️ Story ${depStory.id}: Upstream changes to ${overlap.join(", ")}`
    );
  }

  // Detect surprises: actual changes not predicted by `touches` field
  const unexpectedChanges = actualChangedFiles.filter(
    (f) => !expectedFiles.some((expected) => f.includes(expected))
  );
  if (unexpectedChanges.length > 0) {
    console.warn(
      `⚠️ Story ${completedStory.id}: Unexpected changes not in touches: ${unexpectedChanges.join(", ")}`
    );
  }
}
```

### 2. Interface/Type Changes

Check if the completed story modified any TypeScript type definitions or exports that dependent stories may rely on. Use `git diff` to detect changes to type-related files:

```javascript
// Find type/interface changes in the diff (look for modified .ts/.d.ts files with export changes)
const diffOutput = await execCommand(
  `git diff origin/${baseBranch}...${completedBranchName} -- "*.ts" "*.d.ts"`
);

// Check for exported type/interface modifications
const typeChangePattern =
  /^[+-]\s*export\s+(type|interface|enum|const)\s+(\w+)/gm;
const changedTypes = [...diffOutput.matchAll(typeChangePattern)].map(
  (m) => m[2]
);

if (changedTypes.length > 0) {
  // Cross-reference with dependent stories' `touches` fields
  for (const depStoryId of completedStory.dependents) {
    const depStory = getStory(depStoryId);
    const depTouches = depStory.touches || [];
    // If dependent story touches any of the same directories, warn about type changes
    const relevantChanges = actualChangedFiles.filter(
      (f) =>
        depTouches.some((t) => f.includes(t)) &&
        (f.endsWith(".ts") || f.endsWith(".d.ts"))
    );
    if (relevantChanges.length > 0) {
      console.warn(
        `⚠️ Story ${depStory.id}: Type changes detected in shared files: ${changedTypes.join(", ")}`
      );
    }
  }
}
```

### 3. Acceptance Criteria Validation

Re-run the full test suite to ensure all tests still pass after the completed story's changes:

```bash
npm test
```

```javascript
const testOutput = await execCommand("npm test");
const testFailed = testOutput.includes("FAIL") || testOutput.includes("failed");

if (testFailed) {
  console.error(
    `❌ Story ${completedStory.id}: Tests failing after implementation`
  );
  console.error(
    `   This may affect dependent stories: ${completedStory.dependents.join(", ")}`
  );
  // Escalate to user
}
```

## Example Output

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

## User Options at Checkpoint

- `y` or `yes` — Continue to next story
- `n` or `no` — Stop execution, save state
- `pause` — Pause for manual investigation
- `review-X.Y` — Show detailed diff for Story X.Y (git diff of completed branch changes relevant to that dependent)

## Result Classification

- **Green (all clear):** No file overlaps, no type changes, tests pass → continue automatically (still show user the checkpoint results)
- **Yellow (warnings):** File overlaps or type changes detected → show warnings, ask user to confirm
- **Red (failures):** Tests failing → escalate to user, do NOT continue automatically
