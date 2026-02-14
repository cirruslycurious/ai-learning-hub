# Story 1.4: Edge Detection

Status: draft

## Story

As a documentation author,
I want the system to detect 7 types of relationships between indexed files,
so that the graph of file connections enables accurate topic expansion via traversal.

## Acceptance Criteria

1. **AC1: depends_on edges from YAML frontmatter**
   - GIVEN a story file with YAML frontmatter containing a `depends_on` field listing other story IDs
   - WHEN the edge detector processes it
   - THEN `depends_on` edges are created from the story file to each dependency's file
   - AND edge source_id and target_id reference valid node IDs (file paths)

2. **AC2: touches edges from story predictions**
   - GIVEN a story file with YAML frontmatter containing a `touches` field listing directories or file paths
   - WHEN the edge detector processes it
   - THEN `touches` edges are created from the story file to each referenced path

3. **AC3: references edges from markdown backtick paths**
   - GIVEN a markdown file containing backtick-quoted file paths (e.g., `` `.claude/skills/epic-orchestrator/SKILL.md` ``)
   - WHEN the edge detector processes it
   - THEN `references` edges are created from the markdown file to each referenced file
   - AND only paths that correspond to actual indexed nodes produce edges

4. **AC4: imports edges from JS/TS import statements**
   - GIVEN a TypeScript or JavaScript file with `import` or `require()` statements
   - WHEN the edge detector processes it
   - THEN `imports` edges are created from the file to each resolved import target
   - AND relative imports are resolved against the file's directory
   - AND package imports (e.g., `@ai-learning-hub/*`) are resolved to their entry points if indexable

5. **AC5: intercepts edges from settings.json**
   - GIVEN `.claude/settings.json` with hook-to-tool-type mappings (e.g., a hook matched against "Bash" or "Edit|Write")
   - WHEN the edge detector processes it
   - THEN `intercepts` edges are created from each hook script file to the tool types it intercepts

6. **AC6: enforces edges from hook-to-ADR relationships**
   - GIVEN hook files that implement architectural constraints (e.g., `architecture-guard.sh` enforcing ADR-005, ADR-007)
   - WHEN the edge detector processes it
   - THEN `enforces` edges are created from the hook file to the ADR files it implements
   - AND detection uses hook file content analysis (comments, referenced ADR numbers)

7. **AC7: defines edges for glossary term sources**
   - GIVEN a Tier 1 file that defines a glossary term (identified during glossary generation)
   - WHEN the edge detector processes it
   - THEN `defines` edges are created from the file to the glossary term entry
   - AND this edge type is populated during or after glossary generation (Story 1.5)

## Tasks / Subtasks

- [ ] **Task 1: Create edge detector module** (AC: #1-#7)
  - [ ] Create `scripts/lib/edge_detector.py`
  - [ ] Define `EdgeResult` dataclass: `source_id`, `target_id`, `edge_type`
  - [ ] Implement dispatcher `detect_edges(file_path: str, file_content: str, frontmatter: Optional[dict], node_index: set) -> list[EdgeResult]` that calls type-specific detectors

- [ ] **Task 2: Implement depends_on detector** (AC: #1)
  - [ ] Implement `detect_depends_on(file_path: str, frontmatter: dict, node_index: set) -> list[EdgeResult]`
  - [ ] Parse `depends_on` field from frontmatter (list of story IDs or file paths)
  - [ ] Resolve story IDs to file paths using node index lookup
  - [ ] Skip unresolvable dependencies with a warning

- [ ] **Task 3: Implement touches detector** (AC: #2)
  - [ ] Implement `detect_touches(file_path: str, frontmatter: dict, node_index: set) -> list[EdgeResult]`
  - [ ] Parse `touches` field from frontmatter (list of directories or file paths)
  - [ ] Validate targets exist in node index (or are directories containing indexed files)

- [ ] **Task 4: Implement references detector** (AC: #3)
  - [ ] Implement `detect_references(file_path: str, content: str, node_index: set) -> list[EdgeResult]`
  - [ ] Regex pattern to find backtick-quoted file paths in markdown: `` `[path]` ``
  - [ ] Filter to paths that exist as indexed nodes
  - [ ] Avoid false positives (code snippets, command examples)

- [ ] **Task 5: Implement imports detector** (AC: #4)
  - [ ] Implement `detect_imports(file_path: str, content: str, node_index: set) -> list[EdgeResult]`
  - [ ] Regex patterns for: `import ... from '...'`, `import '...'`, `require('...')`
  - [ ] Resolve relative paths (`./`, `../`) against file directory
  - [ ] Attempt resolution of `@ai-learning-hub/*` package imports
  - [ ] Add `.ts`, `.js`, `.tsx`, `.jsx`, `/index.ts`, `/index.js` extensions when resolving

- [ ] **Task 6: Implement intercepts detector** (AC: #5)
  - [ ] Implement `detect_intercepts(settings_path: str, node_index: set) -> list[EdgeResult]`
  - [ ] Parse `.claude/settings.json` hook configuration
  - [ ] Extract matcher patterns and hook command paths
  - [ ] Create edges from hook script files to tool type identifiers

- [ ] **Task 7: Implement enforces detector** (AC: #6)
  - [ ] Implement `detect_enforces(file_path: str, content: str, node_index: set) -> list[EdgeResult]`
  - [ ] Scan hook file content for ADR references (regex: `ADR-\d+`, `adr-\d+`)
  - [ ] Map ADR numbers to ADR file paths in the node index
  - [ ] Only applies to files classified as hooks

- [ ] **Task 8: Write tests** (AC: #1-#7)
  - [ ] Create `scripts/tests/test_edge_detector.py`
  - [ ] Test depends_on detection with mock frontmatter
  - [ ] Test touches detection with mock frontmatter
  - [ ] Test references detection with markdown containing backtick paths
  - [ ] Test imports detection with TypeScript import statements (relative and package)
  - [ ] Test intercepts detection with mock settings.json
  - [ ] Test enforces detection with hook file content containing ADR references
  - [ ] Test that edges with nonexistent targets are skipped (not created)
  - [ ] Test edge deduplication (same source-target-type triple not duplicated)

## Dev Notes

### Architecture Compliance

This story implements the Edge Table and all 7 edge types defined in the design doc's "Edge Table" section. The edge types and their detection strategies match the design doc exactly: `depends_on` from YAML frontmatter, `touches` from story predictions, `references` from markdown backtick paths, `imports` from JS/TS import statements, `intercepts` from settings.json, `enforces` from hook-to-ADR relationships, and `defines` from glossary source files.

The design doc's "Edge detection fidelity note" is important: edge accuracy varies by type. `imports` edges will miss dynamic imports, re-exports, and aliases. The system does not attempt perfect detection -- gaps are fixed as they surface through usage.

### Technical Notes

- The `node_index` parameter is a set of all indexed file paths (relative to repo root). Edges are only created when both source and target exist in this set. This prevents dangling edges.
- Import resolution for TypeScript is intentionally simplified. The design doc acknowledges that "simple regex parsing will miss" dynamic imports, re-exports, and aliases. Start with static `import/require` patterns and iterate.
- The `defines` edge type is special: it is populated during or after glossary generation (Story 1.5), not during the main edge detection pass. The edge detector should expose a function that the glossary generator can call.
- For the `intercepts` detector, the settings.json structure has hooks nested under `PreToolUse`, `PostToolUse`, `Stop` with `matcher` and `command` fields. Parse this structure to extract hook-script-to-tool-type mappings.
- The `enforces` detector uses content analysis of hook files. Look for ADR references in comments, variable names, or string literals. This is heuristic and may need refinement.

### Testing Requirements

- Unit tests per edge type with targeted fixture content
- Test that invalid/nonexistent targets produce warnings, not edges
- Test regex patterns against representative real-world content
- Test import resolution with relative paths and extensions
- Integration test with a small mock repository structure

### Project Structure Notes

Files created by this story:

```
scripts/lib/
  edge_detector.py           # New: detect_edges() and per-type detectors

scripts/tests/
  test_edge_detector.py      # New: tests for all 7 edge types
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Edge Table]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Edge detection fidelity note]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Rebuild Script - Step 4 (Detect edges)]

### Dependencies

- **Blocks**: Story 1.6 -- the rebuild script needs edge detection
- **Blocked by**: Story 1.1 (project structure and schema), Story 1.2 (tier classification provides the node index that edge detection validates targets against)

### Out of Scope

- Writing edges to SQLite (Story 1.6 orchestrates database writes)
- Graph traversal and topic expansion (Story 1.8)
- Depth-capped traversal logic (Story 1.8)
- Full glossary generation that populates `defines` edges (Story 1.5 -- but the edge detector exposes the function for it)
- Relevance scoring or filtering of edges (design doc's "v2 candidate")
- Dynamic import detection, re-export resolution, TypeScript path aliases (acknowledged limitation per design doc)
