# Dependency Analysis

Supporting reference for the epic orchestrator. Read this file when entering Phase 1.3 (Dependency Analysis) or when handling `--stories` flag validation.

## Story Metadata (YAML Frontmatter)

Each story file contains YAML frontmatter with dependency metadata:

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
- `depends_on` - Array of story IDs this story depends on (empty array `[]` if none)

**Optional fields:**

- `touches` - Files/directories this story is expected to modify (used by integration checkpoints)
- `risk` - Risk level (low/medium/high)

**Normalization:** Store parsed dependencies as `story.dependencies` for consistent access regardless of source (frontmatter or prose fallback).

## Prose Fallback Detection

If YAML frontmatter is missing or has no `depends_on` field, scan prose for dependency keywords using these regex patterns:

```javascript
const dependencyPatterns = [
  /requires?\s+Story\s+(\d+\.\d+)/gi,
  /depends?\s+on\s+Story\s+(\d+\.\d+)/gi,
  /builds?\s+on\s+Story\s+(\d+\.\d+)/gi,
  /after\s+Story\s+(\d+\.\d+)\s+is\s+complete/gi,
  /prerequisites?:\s*Story\s+(\d+\.\d+)/gi,
  /blocked\s+by\s+Story\s+(\d+\.\d+)/gi,
];
```

**If dependencies detected via regex, emit warning:**

```
⚠️ Story 1.4: Dependencies inferred from prose (found: 1.2, 1.3)
   Please add YAML frontmatter to make dependencies explicit:

   ---
   id: 1.4
   depends_on: [1.2, 1.3]
   ---
```

## Build Dependency Graph

Create an adjacency list from parsed dependencies:

```
Story 1.1 → depends on: [] (no dependencies)
Story 1.2 → depends on: [1.1]
Story 1.3 → depends on: [1.1]
Story 1.4 → depends on: [1.2, 1.3]
Story 1.5 → depends on: [] (no dependencies)
```

## Compute Dependents (Inverse Graph)

After building the dependency graph, compute the inverse to populate `story.dependents` — the list of stories that depend on each story. This is needed for integration checkpoints, skip validation, and dependency completion policy:

```javascript
function computeDependents(stories) {
  for (const story of stories) {
    story.dependents = [];
  }
  for (const story of stories) {
    for (const depId of story.dependencies) {
      const depStory = stories.find((s) => s.id === depId);
      if (depStory) {
        depStory.dependents.push(story.id);
      }
    }
  }
  for (const story of stories) {
    story.hasDependents = story.dependents.length > 0;
  }
}
```

**Result example:**

- Story 1.1 → dependents: [1.2, 1.3], hasDependents: true
- Story 1.2 → dependents: [1.4], hasDependents: true
- Story 1.3 → dependents: [1.4], hasDependents: true
- Story 1.4 → dependents: [], hasDependents: false
- Story 1.5 → dependents: [], hasDependents: false

## Cycle Detection

If circular dependencies detected (e.g., 1.2 depends on 1.3, 1.3 depends on 1.2):

```
❌ Dependency Cycle Detected

Story 1.2 depends on Story 1.3
Story 1.3 depends on Story 1.2

This epic cannot be implemented until dependencies are resolved.
Please fix the story files and try again.
```

**STOP execution immediately.** Cycles are a fatal error — do not attempt to proceed.

## Topological Sort

Order stories for serial execution using topological sort (Kahn's algorithm):

```
Execution Order (respecting dependencies):
1. Story 1.1  (no deps)
2. Story 1.5  (no deps — could parallelize with 1.1 in future)
3. Story 1.2  (after 1.1)
4. Story 1.3  (after 1.1)
5. Story 1.4  (after 1.2 and 1.3)
```

Note: The dependency graph identifies parallelizable sets; current implementation executes serially.

## Story Selection Validation (`--stories` flag)

When the user selects specific stories (via `--stories` flag or option (b) at scope confirmation), validate dependencies before starting:

```javascript
function validateStorySelection(selectedIds, allStories) {
  const warnings = [];

  for (const storyId of selectedIds) {
    const story = allStories.find((s) => s.id === storyId);
    if (!story) {
      warnings.push(`❌ Story ${storyId} not found in epic`);
      continue;
    }

    for (const depId of story.dependencies) {
      const depInScope = selectedIds.includes(depId);
      const depAlreadyDone = getStoryStatus(depId) === "done";

      if (!depInScope && !depAlreadyDone) {
        warnings.push(
          `⚠️ Story ${storyId} depends on ${depId}, which is not in scope and not yet done`
        );
      }
    }
  }

  if (warnings.length > 0) {
    // Show warnings and ask user
  }
}
```

**User options when dependencies are missing:**

```
⚠️ Dependency warnings for selected stories:
  Story 1.4 depends on 1.3, which is not in scope and not yet done

Options:
  a) Add missing dependencies to scope automatically
  b) Proceed anyway (may fail at dependency check)
  c) Cancel and re-select stories
Your choice:
```

- **(a)** Adds missing deps and re-runs validation (recursive until clean)
- **(b)** Proceeds; dependency check in Phase 2.1 will block if dep not met
- **(c)** Returns to story selection prompt

After validation, apply topological sort to the selected subset only.

## Best Practices

1. **Always use YAML frontmatter** — machine-readable format prevents silent failures
2. **Include empty `depends_on: []`** — even if no dependencies, be explicit
3. **Add `touches` field** — helps integration checkpoint detect conflicts
4. **Use story IDs only** — "1.2" not "Story 1.2" or "Save project story"
5. **Avoid circular dependencies** — workflow will error if detected
6. **Keep dependency chains short** — chains >3 levels deep are fragile
7. **Update frontmatter when refactoring** — if dependencies change, update YAML immediately
