# Story 1.6: Rebuild Script (Orchestrator)

Status: draft

## Story

As a documentation author,
I want a single command (`python scripts/rebuild-doc-index.py`) that regenerates the repository index and glossary from current repo state,
so that I can refresh the index before documentation generation sessions.

## Acceptance Criteria

1. **AC1: Full rebuild pipeline**
   - GIVEN the command `python scripts/rebuild-doc-index.py`
   - WHEN executed from the repository root
   - THEN the script performs all steps in order: (1) walk repository and classify tiers, (2) parse metadata and estimate tokens, (3) detect edges, (4) populate SQLite nodes and edges tables, (5) generate glossary and populate glossary tables
   - AND all steps use the modules from Stories 1.2-1.5

2. **AC2: Incremental rebuild**
   - GIVEN the command `python scripts/rebuild-doc-index.py --incremental`
   - WHEN executed
   - THEN only files modified since the last rebuild (compared via `last_modified` timestamp in the existing database) are re-processed
   - AND deleted files are removed from the index
   - AND renamed files are handled (old entry removed, new entry added)
   - AND edges involving modified files are recalculated

3. **AC3: Verbose output**
   - GIVEN the command `python scripts/rebuild-doc-index.py --verbose`
   - WHEN executed
   - THEN the output shows: number of files walked, files per tier, nodes created/updated, edges created, glossary entries created/updated, entries flagged for review, and total execution time

4. **AC4: Output artifacts**
   - GIVEN a successful rebuild
   - WHEN the script completes
   - THEN `docs/_docgen/repo-index.db` contains the populated SQLite database
   - AND `docs/_docgen/glossary.yaml` contains the exported glossary
   - AND `docs/_docgen/rebuild.log` contains a log of what changed since last run

5. **AC5: Deterministic output**
   - GIVEN the same repository state
   - WHEN the full rebuild script is run twice
   - THEN the resulting `repo-index.db` contains identical data both times
   - AND the resulting `glossary.yaml` is identical both times (excluding any timestamp in rebuild.log)

6. **AC6: Error handling and resilience**
   - GIVEN a file that causes a parsing error (malformed YAML, unreadable file)
   - WHEN the rebuild script encounters it
   - THEN the error is logged with the file path and error details
   - AND the script continues processing remaining files
   - AND the rebuild.log records all errors

## Tasks / Subtasks

- [ ] **Task 1: Implement main orchestrator** (AC: #1)
  - [ ] Implement `scripts/rebuild-doc-index.py` as the entry point
  - [ ] Parse CLI arguments: `--incremental`, `--verbose`, `--db-path` (default: `docs/_docgen/repo-index.db`)
  - [ ] Define the pipeline: walk -> parse -> estimate -> detect edges -> write nodes -> write edges -> generate glossary
  - [ ] Use schema module to create/open the database

- [ ] **Task 2: Implement node population** (AC: #1, #5)
  - [ ] Collect all `FileInfo` from the file walker (Story 1.2)
  - [ ] For each file: parse metadata (Story 1.3), estimate tokens (Story 1.3)
  - [ ] Check for frontmatter-based tier upgrade (Story 1.3)
  - [ ] Write all nodes to the `nodes` table in a single transaction
  - [ ] Use `INSERT OR REPLACE` for idempotent writes

- [ ] **Task 3: Implement edge population** (AC: #1, #5)
  - [ ] Build node index (set of all node IDs) from populated nodes
  - [ ] For each file: run edge detection (Story 1.4)
  - [ ] Special handling: run `detect_intercepts` on settings.json once
  - [ ] Write all edges to the `edges` table in a single transaction
  - [ ] Clear existing edges before full rebuild (edges are derived, not accumulated)

- [ ] **Task 4: Implement glossary orchestration** (AC: #1)
  - [ ] Filter nodes to Tier 1 files
  - [ ] Run glossary generator (Story 1.5)
  - [ ] Populate glossary tables
  - [ ] Export glossary.yaml
  - [ ] Create `defines` edges from glossary entries

- [ ] **Task 5: Implement incremental mode** (AC: #2)
  - [ ] On `--incremental`: load existing node `last_modified` timestamps from DB
  - [ ] Compare against current filesystem timestamps
  - [ ] Build sets: new files, modified files, deleted files
  - [ ] Process only new + modified files through the full pipeline
  - [ ] Remove deleted file nodes and their edges
  - [ ] Recalculate edges for modified files (delete old edges, insert new)
  - [ ] Regenerate glossary entries for modified Tier 1 files

- [ ] **Task 6: Implement verbose output** (AC: #3)
  - [ ] Track counts: files walked, per-tier breakdown, nodes created/updated/deleted, edges created, glossary entries, review flags
  - [ ] Print summary table on `--verbose`
  - [ ] Include timing information per pipeline step

- [ ] **Task 7: Implement rebuild.log** (AC: #4)
  - [ ] Write log to `docs/_docgen/rebuild.log`
  - [ ] Record: timestamp, mode (full/incremental), files added/modified/deleted, edges created, glossary changes, errors, total duration

- [ ] **Task 8: Implement error handling** (AC: #6)
  - [ ] Wrap per-file processing in try/except
  - [ ] Log errors with file path and traceback
  - [ ] Continue processing remaining files
  - [ ] Collect all errors for summary reporting and rebuild.log

- [ ] **Task 9: Write tests** (AC: #1-#6)
  - [ ] Create `scripts/tests/test_rebuild.py`
  - [ ] Test full rebuild on a mock repository (temp directory with representative files)
  - [ ] Test that all tables are populated after full rebuild
  - [ ] Test determinism: two full rebuilds on identical repo produce identical DB content
  - [ ] Test incremental: modify one file, run incremental, verify only that file was re-processed
  - [ ] Test incremental: delete a file, run incremental, verify node and edges removed
  - [ ] Test error resilience: include a malformed file, verify script completes and logs error
  - [ ] Test verbose output contains expected counts
  - [ ] Test that rebuild.log is written with correct content

## Dev Notes

### Architecture Compliance

This story implements the Rebuild Script described in the design doc's "Rebuild Script" section. The invocation patterns (`python scripts/rebuild-doc-index.py`, `--incremental`, `--verbose`) match the design doc exactly. The six-step pipeline (walk, parse, estimate, detect edges, populate SQLite, generate glossary) follows the design doc's "What It Does" specification. The three output artifacts (`repo-index.db`, `glossary.yaml`, `rebuild.log`) match the design doc's "Output" section.

### Technical Notes

- Use SQLite transactions for bulk writes. Wrap all node inserts in one transaction and all edge inserts in another for performance and atomicity.
- The full rebuild should drop and recreate tables (or TRUNCATE equivalent: `DELETE FROM table`) before populating. This ensures determinism.
- Incremental mode needs careful handling of edges: when a file changes, all edges where it is `source_id` must be recalculated. Edges where it is `target_id` remain valid (the target file still exists).
- The design doc specifies the rebuild is "deterministic -- derived entirely from the current state of the repository." This means no random ordering, no timestamp-dependent behavior in the output data.
- For the `--incremental` flag to detect changes, the script compares filesystem `mtime` against `last_modified` in the existing database. This is a heuristic -- clock skew or filesystem quirks can cause issues, but the design doc accepts this tradeoff.
- The `--db-path` argument allows testing with a different database location.

### Testing Requirements

- Integration tests using a temporary directory with a representative file tree
- Determinism test: run twice, compare DB contents row by row
- Incremental test: full rebuild, modify a file, incremental rebuild, verify partial update
- Error resilience test: include an unreadable or malformed file
- Test output artifacts exist and contain expected content
- Tests should clean up temporary directories and databases

### Project Structure Notes

Files modified by this story:

```
scripts/
  rebuild-doc-index.py       # Modified: full implementation (was placeholder from Story 1.1)

scripts/tests/
  test_rebuild.py            # New: integration tests for the rebuild pipeline
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Rebuild Script]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Rebuild Script - What It Does]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Rebuild Script - Invocation]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Rebuild Script - Output]

### Dependencies

- **Blocks**: Story 1.7 (needs working rebuild to test with real config), Story 1.8 (topic expansion queries the populated index)
- **Blocked by**: Story 1.2 (tier classification & file walker), Story 1.3 (metadata parsing & token estimation), Story 1.4 (edge detection), Story 1.5 (glossary generation)

### Out of Scope

- Hand-authoring tier-rules.yaml, style-guide.md, or archetype files (Story 1.7)
- Topic expansion and budget logic (Story 1.8)
- Generation prompt assembly (Story 1.9)
- Post-generation validation (Story 1.10)
- Staleness checking (Story 1.11)
- CI/CD integration (the rebuild script is run manually, per design doc: "Not automated, not on CI, not on every commit")
