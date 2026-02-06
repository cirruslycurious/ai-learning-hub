# Auto-Epic Future Enhancements

> Extracted from `/bmad-bmm-auto-epic` workflow spec. These are planned enhancements beyond v1.

## Structured Event Log

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
{"ts":"2026-02-06T10:23:10Z","event":"issue.created","story_id":"1.1","issue_number":42}
{"ts":"2026-02-06T10:25:45Z","event":"tests.passed","story_id":"1.1","coverage":87,"duration_sec":15}
{"ts":"2026-02-06T10:25:55Z","event":"story.completed","story_id":"1.1","duration_sec":175}
{"ts":"2026-02-06T10:26:05Z","event":"checkpoint.passed","story_id":"1.1","result":"green","conflicts":0}
{"ts":"2026-02-06T10:28:45Z","event":"hook.failed","story_id":"1.2","hook":"tdd-guard","error":"No tests found"}
{"ts":"2026-02-06T10:30:00Z","event":"hook.passed","story_id":"1.2","hook":"tdd-guard","retry":1}
```

### Usage Examples

```bash
# Query failed stories
jq 'select(.event=="story.failed")' epic-1-events.jsonl

# Average story duration
jq -s 'map(select(.event=="story.completed")) | map(.duration_sec) | add / length' epic-1-events.jsonl

# Hook failures
jq 'select(.event=="hook.failed") | {story: .story_id, hook: .hook, error: .error}' epic-1-events.jsonl

# Coverage report
jq -s 'map(select(.event=="tests.passed")) | map({story: .story_id, coverage: .coverage})' epic-1-events.jsonl
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
```

### Benefits

1. **Post-Mortem Analysis** - Identify bottlenecks, understand failure patterns, replay execution
2. **Metrics and Dashboards** - Duration trends, hook failure rates, coverage trends
3. **Alerting and Monitoring** - Alert on failures, monitor long-running stories
4. **Tooling Integration** - Import into Grafana/Datadog/Splunk

### Implementation Priority

**Not required for v1** - Prose activity log in state file is sufficient for initial implementation.

**Recommended for v2** after core workflow is stable and in production use.

---

## Parallel Story Implementation (Phase 2)

- Use Task tool to spawn multiple agents
- Each agent works on different story simultaneously
- Smart merge conflict prevention
- Estimated time savings: 50-70% additional reduction

## Multi-Epic Orchestration (Phase 3)

- `/bmad-bmm-auto-project` — Runs multiple epics in sequence
- Dependency analysis between epics
- Daily progress reports
- Automated integration testing between epics

## Intelligent Scheduling (Phase 4)

- Analyze story dependencies from acceptance criteria
- Optimize execution order
- Parallelize independent stories
- Detect blocking stories early
