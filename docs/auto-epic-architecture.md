# Auto-Epic Architecture: Core vs CLI Separation

> Extracted from `/bmad-bmm-auto-epic` workflow spec. This is a design document for future implementation.

## Overview

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

**GitHubOctokitRunner (v2 - Future)** (`src/adapters/GitHubOctokitRunner.ts`):

```typescript
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

  async branchExists(branchName: string): Promise<boolean> {
    const localExists = await execAsync(
      `git show-ref --verify --quiet refs/heads/${branchName}`
    ).then(
      () => true,
      () => false
    );

    if (localExists) return true;

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

```typescript
export class DryRunStoryRunner implements StoryRunner {
  private log: string[] = [];
  private issueCounter = 0;

  async createIssue(story: Story, epic: Epic): Promise<IssueResult> {
    this.issueCounter++;
    this.log.push(`[DRY RUN] Would create issue: Story ${story.id}`);
    return {
      issueNumber: this.issueCounter,
      issueUrl: `https://github.com/mock/issues/${this.issueCounter}`,
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
├── adapters/
│   ├── StoryRunner.interface.ts    # Interface definition
│   ├── GitHubStoryRunner.ts        # gh CLI + git integration
│   ├── DryRunStoryRunner.ts        # No-op testing adapter
│   └── __tests__/
├── state/
│   ├── StateManager.interface.ts   # State persistence abstraction
│   ├── FileSystemStateManager.ts   # Markdown state file
│   └── __tests__/
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

1. **Testability** - Unit test orchestrator with mock runner (no GitHub API calls)
2. **Portability** - Swap GitHub for Jira without changing orchestration
3. **Composability** - Reuse orchestrator in web UI, VSCode extension, REST API
4. **Maintainability** - Clear separation of concerns, single responsibility per layer

### Migration Strategy

| Story | Description                  | Key Deliverables                                          |
| ----- | ---------------------------- | --------------------------------------------------------- |
| 1.1   | Extract Interfaces and Types | `StoryRunner`, `Epic`, `Story`, `StateManager` interfaces |
| 1.2   | Implement Core Orchestrator  | `EpicOrchestrator`, `DependencyAnalyzer`, unit tests      |
| 1.3   | Implement GitHubStoryRunner  | `gh` CLI wrapper, git commands, integration tests         |
| 1.4   | Implement CLI Layer          | Entry point, arg parsing, human-readable output           |
| 1.5   | Implement DryRunStoryRunner  | No-op adapter, `--dry-run` flag                           |
| 1.6   | Add State File Management    | `FileSystemStateManager`, resume logic, atomic writes     |

**Acceptance Criteria:**

- All existing workflow functionality works
- 80%+ test coverage on orchestrator core
- Can run full epic in `--dry-run` mode
- State file format matches current spec
