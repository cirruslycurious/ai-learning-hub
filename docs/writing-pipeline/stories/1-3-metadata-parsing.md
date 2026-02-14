# Story 1.3: Metadata Parsing & Token Estimation

Status: complete

## Story

As a documentation author,
I want the system to extract metadata from files and estimate their token cost,
so that the index contains rich node information for topic expansion and budget calculations.

## Acceptance Criteria

1. **AC1: YAML frontmatter extraction**
   - GIVEN a markdown file with YAML frontmatter delimited by `---`
   - WHEN the metadata parser processes it
   - THEN the frontmatter fields are extracted and returned as a Python dictionary
   - AND the dictionary is serializable to JSON for storage in the `frontmatter` column

2. **AC2: JSON config parsing**
   - GIVEN a JSON config file (e.g., `package.json`, `settings.json`, `tsconfig.json`)
   - WHEN the metadata parser processes it
   - THEN key metadata fields are extracted (name, version, description for package.json; hooks configuration for settings.json)

3. **AC3: Human-readable name extraction**
   - GIVEN a file with YAML frontmatter containing a `title`, `name`, or `id` field
   - WHEN the name extractor runs
   - THEN the `name` field is populated with the most human-readable value (preferring `title` > `name` > `id`)
   - AND given a file without frontmatter
   - WHEN the name extractor runs
   - THEN the `name` is derived from the filename (e.g., `edge-detector.py` -> `edge detector`)

4. **AC4: Token estimation via word count heuristic**
   - GIVEN any text file
   - WHEN the token estimator runs
   - THEN it produces a `token_estimate` equal to `word_count * 1.3` (rounded to nearest integer)
   - AND the word count is based on whitespace-separated tokens in the file content

5. **AC5: Last modified timestamp**
   - GIVEN any file on disk
   - WHEN the metadata parser processes it
   - THEN the `last_modified` field contains the filesystem modification time as an ISO 8601 timestamp

6. **AC6: Frontmatter-based tier upgrade**
   - GIVEN a file initially classified as Tier 2 or Tier 3 by path-based rules
   - WHEN the metadata parser finds YAML frontmatter with `id`, `title`, or `role` fields
   - THEN the file's tier is upgraded to Tier 1 (definitional)

## Tasks / Subtasks

- [x] **Task 1: Implement YAML frontmatter parser** (AC: #1)
  - [x] Create `scripts/lib/metadata_parser.py`
  - [x] Implement `parse_frontmatter(file_path: str) -> Optional[dict]` that reads `---` delimited YAML
  - [x] Use `yaml.safe_load()` for parsing
  - [x] Return `None` for files without frontmatter
  - [x] Handle malformed frontmatter gracefully (log warning, return None)

- [x] **Task 2: Implement JSON config parser** (AC: #2)
  - [x] Implement `parse_json_config(file_path: str) -> Optional[dict]` that reads JSON files
  - [x] Extract relevant metadata fields based on file type
  - [x] Handle malformed JSON gracefully (log warning, return None)

- [x] **Task 3: Implement name extractor** (AC: #3)
  - [x] Implement `extract_name(file_path: str, frontmatter: Optional[dict]) -> str`
  - [x] Priority: frontmatter `title` > frontmatter `name` > frontmatter `id` > filename-derived
  - [x] Filename derivation: strip extension, replace hyphens/underscores with spaces

- [x] **Task 4: Implement token estimator** (AC: #4)
  - [x] Create `scripts/lib/token_estimator.py`
  - [x] Implement `estimate_tokens(file_path: str) -> int`
  - [x] Read file content, split on whitespace, count words
  - [x] Multiply by 1.3 and round to nearest integer
  - [x] Handle binary files gracefully (return 0 or skip)

- [x] **Task 5: Implement last_modified extraction** (AC: #5)
  - [x] Implement `get_last_modified(file_path: str) -> str` returning ISO 8601 timestamp
  - [x] Use `os.path.getmtime()` and convert to ISO format

- [x] **Task 6: Implement frontmatter tier upgrade logic** (AC: #6)
  - [x] Implement `should_upgrade_tier(frontmatter: Optional[dict]) -> bool`
  - [x] Returns True if frontmatter contains `id`, `title`, or `role` fields
  - [x] Integrate with tier classifier: metadata parser can signal tier upgrade

- [x] **Task 7: Write tests** (AC: #1-#6)
  - [x] Create `scripts/tests/test_metadata_parser.py`
  - [x] Test frontmatter extraction with valid YAML
  - [x] Test frontmatter extraction with no frontmatter
  - [x] Test frontmatter extraction with malformed YAML
  - [x] Test JSON config parsing for package.json and settings.json
  - [x] Test name extraction priority (title > name > id > filename)
  - [x] Create `scripts/tests/test_token_estimator.py`
  - [x] Test token estimation with known word count files
  - [x] Test that empty files return 0
  - [x] Test tier upgrade logic with qualifying and non-qualifying frontmatter

## Dev Notes

### Architecture Compliance

This story implements the metadata extraction described in the design doc's Rebuild Script section (Step 2: "Parse metadata -- extract YAML frontmatter, parse JSON configs, read file headers") and Step 3 ("Estimate tokens -- calculate estimated token count per file (word count x 1.3 as a heuristic)"). The node table columns `name`, `token_estimate`, `frontmatter`, and `last_modified` are all populated by this story's code.

### Technical Notes

- Use `pyyaml` (`yaml.safe_load()`) for YAML parsing -- it is already declared as a project dependency.
- The design doc mentions "or use tiktoken for precision" as an alternative to the word count heuristic. Start with the heuristic (simpler, no external dependency). Tiktoken can be added later if budget calculations prove inaccurate.
- Frontmatter detection: scan for lines matching `^---$` at the start of the file. The content between the first and second `---` is the frontmatter. This is the standard Jekyll/Hugo convention.
- JSON parsing uses Python's built-in `json` module.
- The `frontmatter` column in SQLite stores the parsed frontmatter as a JSON string (`json.dumps(parsed_yaml)`), per the design doc specification: "raw YAML frontmatter as JSON."
- Tier upgrade from frontmatter detection bridges Stories 1.2 and 1.3. The metadata parser signals to the orchestrator (Story 1.6) that a file should be Tier 1 if its frontmatter qualifies.

### Testing Requirements

- Unit tests with fixture files (small markdown files with known frontmatter)
- Test edge cases: files with `---` in content but not as frontmatter delimiters
- Test token estimation against hand-counted word files
- Test timestamp format compliance (ISO 8601)
- Use `tmp_path` pytest fixture for creating test files

### Project Structure Notes

Files created by this story:

```
scripts/lib/
  metadata_parser.py         # New: parse_frontmatter(), parse_json_config(), extract_name(), get_last_modified(), should_upgrade_tier()
  token_estimator.py         # New: estimate_tokens()

scripts/tests/
  test_metadata_parser.py    # New
  test_token_estimator.py    # New
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Rebuild Script - Step 2 (Parse metadata)]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Rebuild Script - Step 3 (Estimate tokens)]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Node Table]

### Dependencies

- **Blocks**: Story 1.6 -- the rebuild script needs metadata parsing and token estimation
- **Blocked by**: Story 1.1 -- needs the project structure

### Out of Scope

- Writing parsed metadata to SQLite (Story 1.6 orchestrates database writes)
- Edge detection from parsed content (Story 1.4)
- Glossary extraction from parsed frontmatter (Story 1.5)
- Full file walking/enumeration (Story 1.2)
- Tiktoken-based precise token counting (future enhancement if heuristic proves insufficient)

## Dev Agent Record

### Completion Notes

- All 7 tasks completed with 50 tests covering all 6 acceptance criteria
- metadata_parser.py: parse_frontmatter(), parse_json_config(), extract_name(), get_last_modified(), should_upgrade_tier()
- token_estimator.py: estimate_tokens() with word_count \* 1.3 heuristic
- JSON config parsing supports package.json, tsconfig.json, settings.json, and generic JSON
- Frontmatter tier upgrade signals to orchestrator (Story 1.6) for path-classified Tier 2/3 files

## File List

- `scripts/lib/metadata_parser.py` — NEW: parse_frontmatter(), parse_json_config(), extract_name(), get_last_modified(), should_upgrade_tier()
- `scripts/lib/token_estimator.py` — NEW: estimate_tokens()
- `scripts/tests/test_metadata_parser.py` — NEW: 39 tests covering AC1, AC2, AC3, AC5, AC6
- `scripts/tests/test_token_estimator.py` — NEW: 11 tests covering AC4

## Change Log

- 2026-02-14: Story 1.3 implemented — metadata parsing, token estimation, tier upgrade logic, 50 tests
