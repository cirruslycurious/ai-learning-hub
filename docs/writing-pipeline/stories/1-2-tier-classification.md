# Story 1.2: Tier Classification & File Walker

Status: complete

## Story

As a documentation author,
I want the system to walk the repository and classify every file into Tier 1, 2, 3, or 4 based on configurable glob rules,
so that the index knows which files are definitional, structural, implementation, or excluded.

## Acceptance Criteria

1. **AC1: Tier 4 exclusion**
   - GIVEN Tier 4 exclusion patterns in `tier-rules.yaml` (node_modules, dist, .build, cdk.out, .git, lockfiles, binaries, .tmp, editor backups)
   - WHEN the file walker encounters these paths
   - THEN they are skipped entirely and not yielded for indexing

2. **AC2: Tier 1 classification**
   - GIVEN a file with YAML frontmatter containing `id`, `title`, or `role` fields
   - WHEN classified, THEN it receives tier 1
   - AND given a file matching `.claude/skills/**/*.md`, `.claude/hooks/*`, `.claude/commands/*`, `.claude/agents/*`, `docs/adr/*`, `docs/epics/*`, `docs/stories/*`, or named `README.md`, `SKILL.md`, `CLAUDE.md`
   - WHEN classified, THEN it receives tier 1

3. **AC3: Tier 2 classification**
   - GIVEN a file matching `package.json`, `tsconfig.json`, `jest.config.*`, `.eslintrc.*`, `.claude/settings.json`, `*.d.ts`, `index.ts`/`index.js` at directory level, `.github/workflows/*`, `.env.example`
   - WHEN classified, THEN it receives tier 2

4. **AC4: Tier 3 classification**
   - GIVEN a `.ts`, `.js`, `.tsx`, `.jsx` file not matching any Tier 1 or Tier 2 pattern
   - WHEN classified, THEN it receives tier 3
   - AND given test files (`*.test.ts`, `*.spec.ts`) and script files in `scripts/`
   - WHEN classified, THEN they receive tier 3

5. **AC5: Configurable glob rules**
   - GIVEN `tier-rules.yaml` with glob patterns organized by tier
   - WHEN a new directory convention is added (one line in the config)
   - THEN the classifier picks it up without code changes

6. **AC6: Node type assignment**
   - GIVEN a classified file
   - WHEN indexed, THEN it receives a `type` value from the enum: story, epic, hook, skill, agent, adr, config, type_def, module, implementation, directory
   - AND the type is derived from the file path and tier classification rules

## Tasks / Subtasks

- [x] **Task 1: Implement file walker** (AC: #1)
  - [x] Create generator function `walk_repository(root: str, tier_rules: dict) -> Iterator[FileInfo]` in `scripts/lib/tier_classifier.py`
  - [x] Load Tier 4 exclusion patterns from config
  - [x] Use `os.walk()` with skip logic for excluded directories (prune `dirs` in-place)
  - [x] Skip excluded files (lockfiles, binaries by extension)
  - [x] Yield `FileInfo` namedtuple/dataclass with `path`, `relative_path`, `tier`, `type`

- [x] **Task 2: Implement tier classification** (AC: #2, #3, #4, #5)
  - [x] Create function `classify_tier(relative_path: str, tier_rules: dict) -> int`
  - [x] Load tier rules from YAML config: ordered list of glob patterns per tier
  - [x] Evaluate Tier 4 first (exclusion), then Tier 1, then Tier 2, then default to Tier 3
  - [x] Use `fnmatch` or `pathlib.PurePath.match()` for glob matching
  - [x] For Tier 1 frontmatter detection: provide a hook/callback for files that need content inspection (frontmatter check deferred to metadata parser, path-based rules applied here)

- [x] **Task 3: Implement node type derivation** (AC: #6)
  - [x] Create function `derive_node_type(relative_path: str, tier: int) -> str`
  - [x] Map path patterns to types: `docs/stories/*` -> story, `docs/epics/*` -> epic, `.claude/hooks/*` -> hook, `.claude/skills/**` -> skill, `.claude/agents/*` -> agent, `docs/adr/*` -> adr, `*.json`/`*.yaml` config -> config, `*.d.ts` -> type_def, `index.ts`/`index.js` -> module, else -> implementation

- [x] **Task 4: Create stub tier-rules.yaml** (AC: #5)
  - [x] Create `docs/_docgen/tier-rules.yaml` with basic patterns for all 4 tiers
  - [x] Include all Tier 4 exclusion patterns from the design doc
  - [x] Include representative Tier 1, 2, 3 patterns (full calibration in Story 1.7)

- [x] **Task 5: Write tests** (AC: #1-#6)
  - [x] Create `scripts/tests/test_tier_classifier.py`
  - [x] Test Tier 4 exclusion (node_modules, .git, dist, lockfiles, binaries)
  - [x] Test Tier 1 classification for each detection rule
  - [x] Test Tier 2 classification for each detection rule
  - [x] Test Tier 3 as default for unmatched .ts/.js files
  - [x] Test node type derivation for each type
  - [x] Test that adding a glob pattern to config changes classification (no code change needed)
  - [x] Use a temporary directory tree with known files for integration-style tests

## Dev Notes

### Architecture Compliance

This story implements the Tier Classification component described in the design doc's "2. Tier Classification" section. The four tiers and their detection rules are taken directly from the design doc. The configurable `tier-rules.yaml` matches the design doc's specification that "adding a new directory convention means adding one line to this config."

### Technical Notes

- The file walker should be a generator (yields files lazily) for memory efficiency on large repos.
- Tier classification is path-based for most rules. Frontmatter-based Tier 1 detection (files with YAML frontmatter containing `id`, `title`, `role`) requires reading file content -- this can be handled as a two-pass approach: first pass classifies by path, metadata parser (Story 1.3) upgrades tier if frontmatter qualifies.
- Use `fnmatch.fnmatch()` for simple glob patterns or `pathlib.PurePath.match()` for more complex patterns. The design doc uses glob-style patterns.
- Binary file detection: check file extension against a known list (`.png`, `.jpg`, `.gif`, `.ico`, `.woff`, `.ttf`, `.eot`, `.pdf`, etc.) rather than attempting content inspection.
- The stub `tier-rules.yaml` created here should be functional but minimal. Story 1.7 authors the full calibrated version for this specific repository.

### Testing Requirements

- Unit tests for `classify_tier()` with representative paths for each tier
- Unit tests for `derive_node_type()` with paths mapping to each type
- Integration test using a temporary directory tree (created with `tempfile.mkdtemp()`) containing representative files
- Test that Tier 4 directories are truly skipped (walker never yields them)
- Test config-driven behavior: changing a pattern in the YAML changes classification

### Project Structure Notes

Files created or modified by this story:

```
scripts/lib/
  tier_classifier.py         # New: walk_repository(), classify_tier(), derive_node_type()

docs/_docgen/
  tier-rules.yaml            # New: stub with basic patterns (full version in Story 1.7)

scripts/tests/
  test_tier_classifier.py    # New: tier classification and walker tests
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Tier Classification]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Tier 4: Excluded]

### Dependencies

- **Blocks**: Story 1.4 (edge detection references nodes created by tier-classified files), Story 1.5 (glossary operates on Tier 1 files), Story 1.6 (rebuild script orchestrates the walker)
- **Blocked by**: Story 1.1 -- needs the project structure and schema

### Out of Scope

- YAML frontmatter parsing for Tier 1 content-based detection (Story 1.3 handles metadata parsing; tier upgrade based on frontmatter is a collaboration between 1.2 and 1.3)
- Full calibration of tier-rules.yaml for the ai-learning-hub repository (Story 1.7)
- Writing nodes to SQLite (Story 1.6 orchestrates database writes)
- Edge detection between files (Story 1.4)
- Token estimation (Story 1.3)

## Dev Agent Record

### Implementation Plan

- Used `dataclass` for `FileInfo` (path, relative_path, tier, node_type)
- `classify_tier()` evaluates Tier 4 first (directories, extensions, specific files), then Tier 1 patterns, then Tier 2 patterns, defaulting to Tier 3
- `walk_repository()` is a generator using `os.walk()` with in-place directory pruning for Tier 4 exclusions
- `derive_node_type()` maps path patterns to the 10 node types specified in the design doc
- `_match_glob()` helper handles `**` recursive patterns, `**/filename` any-depth patterns, and simple fnmatch patterns
- `load_tier_rules()` reads the YAML config file
- Frontmatter-based Tier 1 detection deferred to Story 1.3 (metadata parser) as specified in Dev Notes

### Completion Notes

- All 5 tasks completed with 62 tests covering all 6 acceptance criteria
- tier-rules.yaml includes all Tier 4 exclusion patterns from the design doc plus representative Tier 1/2/3 patterns
- Config-driven behavior verified: adding/removing patterns changes classification without code changes
- Integration tests use tempfile.mkdtemp() with a representative file tree
- No regressions: full suite (85 tests) passes including Story 1.1 schema tests

## File List

- `scripts/lib/tier_classifier.py` — NEW: walk_repository(), classify_tier(), derive_node_type(), load_tier_rules(), FileInfo dataclass
- `docs/_docgen/tier-rules.yaml` — NEW: stub tier classification rules with all 4 tiers
- `scripts/tests/test_tier_classifier.py` — NEW: 62 tests covering all ACs

## Change Log

- 2026-02-12: Story 1.2 implemented — tier classification, file walker, node type derivation, tier-rules.yaml config, 62 tests
