# Story 1.1: Project Scaffolding & SQLite Schema

Status: draft

## Story

As a developer,
I want a Python project structure with the SQLite database schema defined and test infrastructure in place,
so that all subsequent stories have a consistent foundation to build on.

## Acceptance Criteria

1. **AC1: Python project structure**
   - GIVEN the repository root
   - WHEN I inspect the project structure
   - THEN `scripts/` exists with `rebuild-doc-index.py`, `validate-doc.py`, `check-staleness.py` as placeholder files
   - AND `scripts/lib/` exists as a Python package with `__init__.py`
   - AND `docs/_docgen/` exists with subdirectory `archetypes/`

2. **AC2: pyproject.toml configuration**
   - GIVEN the project root
   - WHEN I inspect `pyproject.toml`
   - THEN it declares Python 3.10+ as the minimum version
   - AND it lists dependencies: `pyyaml`, `pytest` (dev)
   - AND it configures pytest to discover tests in `scripts/tests/`

3. **AC3: SQLite schema creation**
   - GIVEN the schema module in `scripts/lib/`
   - WHEN I call the schema creation function with a database path
   - THEN it creates a SQLite database with tables: `nodes`, `edges`, `glossary_canonical`, `glossary_variants`, `glossary_forbidden`
   - AND the `nodes` table has columns: `id` (TEXT PK), `tier` (INTEGER NOT NULL), `type` (TEXT NOT NULL), `name` (TEXT), `token_estimate` (INTEGER), `frontmatter` (TEXT), `last_modified` (TEXT)
   - AND the `edges` table has columns: `source_id` (TEXT NOT NULL), `target_id` (TEXT NOT NULL), `edge_type` (TEXT NOT NULL), with foreign keys referencing `nodes(id)`
   - AND the `glossary_canonical` table has columns: `term` (TEXT PK), `definition` (TEXT NOT NULL), `source_file` (TEXT NOT NULL), with foreign key referencing `nodes(id)`
   - AND the `glossary_variants` table has columns: `variant` (TEXT PK), `canonical_term` (TEXT NOT NULL), `usage_rule` (TEXT), with foreign key referencing `glossary_canonical(term)`
   - AND the `glossary_forbidden` table has columns: `forbidden_term` (TEXT PK), `canonical_term` (TEXT NOT NULL), with foreign key referencing `glossary_canonical(term)`

4. **AC4: Test infrastructure**
   - GIVEN the test directory `scripts/tests/`
   - WHEN I run `pytest` from the project root
   - THEN the test suite discovers and runs tests
   - AND schema creation tests pass (table existence, column verification, foreign key constraints)

5. **AC5: .gitignore for generated artifacts**
   - GIVEN the `docs/_docgen/` directory
   - WHEN I inspect `.gitignore` entries
   - THEN `docs/_docgen/repo-index.db` is ignored (rebuilt on command, not committed)
   - AND `docs/_docgen/rebuild.log` is ignored
   - AND `docs/_docgen/glossary.yaml` is NOT ignored (committed to repo)

## Tasks / Subtasks

- [ ] **Task 1: Create project directory structure** (AC: #1)
  - [ ] Create `scripts/lib/__init__.py`
  - [ ] Create placeholder files: `scripts/rebuild-doc-index.py`, `scripts/validate-doc.py`, `scripts/check-staleness.py`
  - [ ] Create `docs/_docgen/archetypes/` directory
  - [ ] Create `scripts/tests/__init__.py`

- [ ] **Task 2: Write pyproject.toml** (AC: #2)
  - [ ] Define project metadata (name: `docgen`, version, description)
  - [ ] Declare Python 3.10+ requirement
  - [ ] Add dependencies: `pyyaml`
  - [ ] Add dev dependencies: `pytest`
  - [ ] Configure `[tool.pytest.ini_options]` with `testpaths = ["scripts/tests"]`

- [ ] **Task 3: Implement SQLite schema module** (AC: #3)
  - [ ] Create `scripts/lib/schema.py` with `create_schema(db_path: str) -> sqlite3.Connection`
  - [ ] Define `nodes` table with all columns and types from design doc
  - [ ] Define `edges` table with foreign keys to `nodes(id)`
  - [ ] Define `glossary_canonical` table with foreign key to `nodes(id)`
  - [ ] Define `glossary_variants` table with foreign key to `glossary_canonical(term)`
  - [ ] Define `glossary_forbidden` table with foreign key to `glossary_canonical(term)`
  - [ ] Enable WAL mode and foreign key enforcement (`PRAGMA foreign_keys = ON`)

- [ ] **Task 4: Write schema tests** (AC: #4)
  - [ ] Create `scripts/tests/test_schema.py`
  - [ ] Test that all 5 tables are created
  - [ ] Test column names and types match the design doc
  - [ ] Test foreign key constraints are enforced (insert edge with nonexistent source_id fails)
  - [ ] Test idempotency (running create_schema twice does not error)

- [ ] **Task 5: Update .gitignore** (AC: #5)
  - [ ] Add `docs/_docgen/repo-index.db` to `.gitignore`
  - [ ] Add `docs/_docgen/rebuild.log` to `.gitignore`
  - [ ] Verify `docs/_docgen/glossary.yaml` is NOT in `.gitignore`

## Dev Notes

### Architecture Compliance

This story establishes the foundation specified in the design doc's File Layout section. The SQLite schema exactly mirrors the table definitions in "Repository Index (SQLite Database)" -- nodes, edges, and the three glossary tables. No additional tables or columns are introduced beyond what the design doc specifies.

### Technical Notes

- Use Python's built-in `sqlite3` module -- no ORM, no external database library. The design doc specifies "no server required" and "no infrastructure to operate."
- Enable `PRAGMA foreign_keys = ON` at connection time. SQLite does not enforce foreign keys by default.
- Use `IF NOT EXISTS` in CREATE TABLE statements for idempotency.
- The `frontmatter` column stores raw YAML as JSON (per design doc: "raw YAML frontmatter as JSON"). Use `json.dumps()` when inserting.
- WAL mode (`PRAGMA journal_mode=WAL`) enables concurrent reads during rebuilds.

### Testing Requirements

- Unit tests for schema creation (table existence, column verification)
- Constraint tests (foreign key enforcement, NOT NULL enforcement)
- Use in-memory SQLite databases (`:memory:`) for test speed
- Test idempotency of schema creation

### Project Structure Notes

Files created by this story:

```
scripts/
  rebuild-doc-index.py       # Placeholder (implemented in Story 1.6)
  validate-doc.py            # Placeholder (implemented in Story 1.10)
  check-staleness.py         # Placeholder (implemented in Story 1.11)
  lib/
    __init__.py
    schema.py                # SQLite schema creation
  tests/
    __init__.py
    test_schema.py

docs/_docgen/
  archetypes/                # Empty directory (populated in Story 1.7)

pyproject.toml
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Repository Index (SQLite Database)]
- [Source: docs/writing-pipeline/Documentation Generation System.md#File Layout]

### Dependencies

- **Blocks**: Story 1.2, 1.3, 1.4, 1.5 -- they all need the schema and project structure to build on
- **Blocked by**: None

### Out of Scope

- Tier classification logic (Story 1.2)
- Metadata parsing (Story 1.3)
- Edge detection logic (Story 1.4)
- Glossary generation logic (Story 1.5)
- Rebuild orchestration (Story 1.6)
- Any hand-authored YAML config files (Story 1.7)
- The placeholder scripts contain no implementation -- just docstrings and argument parsing stubs
