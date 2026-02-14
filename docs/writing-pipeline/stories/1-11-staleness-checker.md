# Story 1.11: Staleness Checker

Status: draft

## Story

As a documentation author,
I want to run a staleness check across all generated documents to see which ones need regeneration based on changed source files, archetypes, glossary, or style guide,
so that I can keep documentation current with minimal effort.

## Acceptance Criteria

1. **AC1: Source file hash comparison**
   - GIVEN a generated document with YAML frontmatter containing `source_files` with `path` and `hash` per file
   - WHEN `python scripts/check-staleness.py` runs
   - THEN it reads each source file's current content and computes its hash
   - AND compares against the hash recorded in the document's frontmatter
   - AND documents with any changed source file are flagged as stale with the specific changed files listed

2. **AC2: Archetype hash comparison**
   - GIVEN a generated document with `archetype_hash` in its frontmatter
   - WHEN the staleness checker runs
   - THEN it computes the current hash of the archetype YAML file
   - AND if the hash differs, the document is flagged as stale with reason "archetype changed"

3. **AC3: Glossary hash comparison**
   - GIVEN a generated document with `glossary_hash` in its frontmatter
   - WHEN the staleness checker runs
   - THEN it computes the current hash of `docs/_docgen/glossary.yaml`
   - AND if the hash differs, the document is flagged as stale with reason "glossary changed"

4. **AC4: Style guide hash comparison**
   - GIVEN a generated document with `style_guide_hash` in its frontmatter
   - WHEN the staleness checker runs
   - THEN it computes the current hash of `docs/_docgen/style-guide.md`
   - AND if the hash differs, the document is flagged as stale with reason "style guide changed"

5. **AC5: Summary report**
   - GIVEN multiple generated documents in a directory
   - WHEN the staleness checker runs across all of them
   - THEN it produces a summary report showing: total documents checked, documents that are current, documents that are stale (with reasons per document)
   - AND the report is output to stdout and optionally to a file

6. **AC6: Performance**
   - GIVEN the staleness checker running on the full set of generated documents
   - WHEN it completes
   - THEN it finishes in under 5 seconds (hash comparisons only, no content analysis beyond hashing)

## Tasks / Subtasks

- [ ] **Task 1: Implement frontmatter reader** (AC: #1-#4)
  - [ ] Implement function to parse YAML frontmatter from generated markdown documents
  - [ ] Extract: `source_files` (list of path/hash pairs), `archetype` (name), `archetype_hash`, `glossary_hash`, `style_guide_hash`, `generated_at`
  - [ ] Handle documents without valid frontmatter (skip with warning)

- [ ] **Task 2: Implement hash computation** (AC: #1-#4)
  - [ ] Implement `compute_file_hash(file_path: str) -> str` using SHA-256, truncated to 8 hex characters
  - [ ] Handle missing files (source file deleted since generation -- flag as stale with "source file deleted" reason)

- [ ] **Task 3: Implement per-document staleness check** (AC: #1-#4)
  - [ ] Implement `check_document_staleness(doc_path: str, docgen_dir: str, repo_root: str) -> StalenessResult`
  - [ ] Parse frontmatter, compute current hashes, compare against recorded hashes
  - [ ] Collect all reasons for staleness (multiple reasons possible: source file changed AND glossary changed)
  - [ ] Return result with: document path, is_stale (bool), reasons (list), generated_at timestamp

- [ ] **Task 4: Implement directory scanner** (AC: #5)
  - [ ] Implement `scan_generated_docs(directory: str) -> list[str]`
  - [ ] Find all markdown files with `generated_by: doc-gen-system` in frontmatter
  - [ ] Skip non-generated documents (those without the frontmatter marker)

- [ ] **Task 5: Implement summary report** (AC: #5)
  - [ ] Implement `generate_staleness_report(results: list[StalenessResult]) -> str`
  - [ ] Format: total checked, current count, stale count
  - [ ] Per stale document: path, generated_at, list of reasons with specifics (which file changed, which artifact changed)

- [ ] **Task 6: Implement check-staleness.py CLI** (AC: #5, #6)
  - [ ] Implement `scripts/check-staleness.py` as the entry point
  - [ ] Parse CLI arguments: `<directory>` (default: scan common output locations), `--output <report_path>` (optional), `--docgen-dir` (default: `docs/_docgen/`)
  - [ ] Scan directory for generated documents
  - [ ] Run staleness check on each
  - [ ] Output summary report

- [ ] **Task 7: Write tests** (AC: #1-#6)
  - [ ] Create `scripts/tests/test_staleness_checker.py`
  - [ ] Test source file hash comparison: unchanged file (current), changed file (stale)
  - [ ] Test archetype hash comparison: unchanged (current), changed (stale)
  - [ ] Test glossary hash comparison: unchanged (current), changed (stale)
  - [ ] Test style guide hash comparison: unchanged (current), changed (stale)
  - [ ] Test multiple staleness reasons on a single document
  - [ ] Test deleted source file detection
  - [ ] Test document without valid frontmatter is skipped
  - [ ] Test summary report format and counts
  - [ ] Test performance: verify hash-only approach (mock 50+ documents, complete quickly)
  - [ ] Use temporary directories with generated test documents containing known frontmatter

## Dev Notes

### Architecture Compliance

This story implements the staleness checking described in the design doc's Step 5 (metadata frontmatter section) and the staleness check script reference. The design doc states: "A staleness check script (`scripts/check-staleness.py`) compares the source file hashes in each generated document's metadata against current file hashes in the repository. If any source file, the archetype, the glossary, or the style guide has changed since generation, the document is flagged as potentially stale." The script "runs in milliseconds across all generated documents and produces a report showing which documents need regeneration and why."

### Technical Notes

- Hash computation must use the same algorithm and truncation as Story 1.9's metadata generation (SHA-256, first 8 hex characters). This ensures hash comparison works correctly.
- The staleness checker is purely read-only. It computes hashes and compares -- it does not modify any files or trigger regeneration.
- For performance, avoid reading full file content into memory for large files. Use streaming hash computation (`hashlib` with chunked reads).
- The frontmatter parser for generated documents can reuse the metadata parser from Story 1.3, or use a focused parser that only extracts the generation metadata fields.
- The directory scanner needs to efficiently identify generated documents. The `generated_by: doc-gen-system` marker in frontmatter is the reliable indicator. A quick check of the first few lines of each .md file is sufficient.
- The archetype file path is derived from the `archetype` field in frontmatter (e.g., `archetype: system-architecture-reference` maps to `docs/_docgen/archetypes/system-architecture.yaml`). The mapping between archetype name and filename should be consistent with Story 1.9's archetype loader.

### Testing Requirements

- Unit tests with crafted markdown files containing known frontmatter hashes
- Test each hash comparison independently (source files, archetype, glossary, style guide)
- Test the "multiple reasons" case: a document stale for both source file changes and glossary changes
- Test edge case: source file deleted since generation
- Test edge case: document with no frontmatter or malformed frontmatter
- Test summary report format
- Performance test: create 50+ small test documents, verify completion time is well under 5 seconds

### Project Structure Notes

Files created or modified by this story:

```
scripts/
  check-staleness.py         # Modified: full implementation (was placeholder from Story 1.1)

scripts/tests/
  test_staleness_checker.py  # New
```

Note: The staleness checking logic may be implemented directly in `check-staleness.py` or split into a module in `scripts/lib/`. The design doc's file layout does not list a separate staleness module in `scripts/lib/`, so the implementation can be self-contained in the script with helper functions, or factored into a lib module if the code warrants it.

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Step 5: Generation (metadata frontmatter)]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Staleness check script description]
- [Source: docs/writing-pipeline/Documentation Generation System.md#File Layout (check-staleness.py)]

### Dependencies

- **Blocks**: None -- this is the final story in the dependency chain
- **Blocked by**: Story 1.9 -- needs generated documents with metadata frontmatter to check (the hash format and field names must match what the prompt assembler generates)

### Out of Scope

- Triggering automatic regeneration of stale documents (the checker reports staleness, the user decides when to regenerate)
- Post-generation validation (Story 1.10 -- different concern; validation checks content quality, staleness checks currency)
- Generation prompt assembly (Story 1.9)
- Modifying generated document frontmatter
- Tracking staleness history over time (the checker reports current state only)
- Integration with CI/CD or automated pipelines (the design doc specifies manual invocation)
