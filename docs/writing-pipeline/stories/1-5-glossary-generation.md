# Story 1.5: Glossary Generation

Status: draft

## Story

As a documentation author,
I want the system to generate a canonical glossary from Tier 1 definitional files using rule-based templates per entity type,
so that every generated document uses consistent terminology enforced by three-tier glossary discipline.

## Acceptance Criteria

1. **AC1: Rule-based template generation per entity type**
   - GIVEN Tier 1 files classified as agent, hook, skill, story, or adr types
   - WHEN the glossary generator processes them
   - THEN canonical term definitions are generated using the correct template:
     - agent: "{name} is a {role} that {purpose}"
     - hook: "{name} is a {phase} hook that {action}"
     - skill: "{name} is a skill module that {purpose}"
     - story: "{title} ({id}): {description}"
     - adr: "ADR-{id}: {title} -- {status}"

2. **AC2: Frontmatter field extraction for templates**
   - GIVEN a Tier 1 file with YAML frontmatter
   - WHEN the glossary generator extracts fields for the template
   - THEN it reads from frontmatter fields (`title`, `role`, `description`, `purpose`)
   - AND it reads from the first paragraph or header comment of the file as a fallback
   - AND it reads from structured sections (e.g., hook README tables)

3. **AC3: Incomplete definition flagging**
   - GIVEN a Tier 1 file where the template produces an incomplete definition (e.g., missing `purpose` field)
   - WHEN the glossary generator processes it
   - THEN the entry is flagged for manual review
   - AND the entry is still created with a marker indicating incompleteness
   - AND the flag is included in the glossary output and rebuild log

4. **AC4: Three-tier glossary output**
   - GIVEN generated canonical terms
   - WHEN the glossary is exported
   - THEN `glossary.yaml` contains entries with: `term`, `definition`, `source` (file path), `allowed_variants` (list with `variant` and `rule`), `forbidden_synonyms` (list of strings)
   - AND the YAML structure matches the example in the design doc

5. **AC5: SQLite glossary table population**
   - GIVEN generated glossary data
   - WHEN written to the database
   - THEN `glossary_canonical` contains all canonical terms with definitions and source files
   - AND `glossary_variants` contains allowed shorthands with usage rules
   - AND `glossary_forbidden` contains banned synonyms mapping to canonical terms
   - AND foreign key relationships are maintained

6. **AC6: Defines edges created during generation**
   - GIVEN a Tier 1 file that is identified as the source for a glossary term
   - WHEN the glossary generator processes it
   - THEN a `defines` edge is created from the source file to the glossary term
   - AND the edge is included in the edge set for database insertion

## Tasks / Subtasks

- [ ] **Task 1: Implement glossary generator module** (AC: #1, #2)
  - [ ] Create `scripts/lib/glossary_generator.py`
  - [ ] Define `GlossaryEntry` dataclass: `term`, `definition`, `source_file`, `allowed_variants`, `forbidden_synonyms`, `needs_review` (bool)
  - [ ] Implement `generate_glossary(tier1_files: list[NodeInfo], content_reader: Callable) -> list[GlossaryEntry]`

- [ ] **Task 2: Implement per-entity-type templates** (AC: #1)
  - [ ] Implement `apply_template(entity_type: str, fields: dict) -> str`
  - [ ] Template for agent: `"{name} is a {role} that {purpose}"`
  - [ ] Template for hook: `"{name} is a {phase} hook that {action}"`
  - [ ] Template for skill: `"{name} is a skill module that {purpose}"`
  - [ ] Template for story: `"{title} ({id}): {description}"`
  - [ ] Template for adr: `"ADR-{id}: {title} -- {status}"`

- [ ] **Task 3: Implement field extraction** (AC: #2)
  - [ ] Implement `extract_template_fields(file_path: str, frontmatter: dict, content: str, entity_type: str) -> dict`
  - [ ] Extract from YAML frontmatter first
  - [ ] Fall back to first paragraph or header comment
  - [ ] Parse structured sections (tables) for hook README files

- [ ] **Task 4: Implement incomplete definition flagging** (AC: #3)
  - [ ] When any required template field is missing, set `needs_review = True`
  - [ ] Generate a partial definition with `[MISSING: field_name]` placeholder
  - [ ] Collect all flagged entries for reporting

- [ ] **Task 5: Implement YAML export** (AC: #4)
  - [ ] Implement `export_glossary_yaml(entries: list[GlossaryEntry], output_path: str)`
  - [ ] Write YAML matching the design doc's example format
  - [ ] Include `allowed_variants` and `forbidden_synonyms` fields (initially empty for auto-generated entries -- these are human-authored)

- [ ] **Task 6: Implement SQLite population** (AC: #5)
  - [ ] Implement `populate_glossary_tables(conn: sqlite3.Connection, entries: list[GlossaryEntry])`
  - [ ] Insert into `glossary_canonical`, `glossary_variants`, `glossary_forbidden`
  - [ ] Handle existing entries on incremental rebuild (upsert logic)

- [ ] **Task 7: Implement defines edge creation** (AC: #6)
  - [ ] Implement `create_defines_edges(entries: list[GlossaryEntry]) -> list[EdgeResult]`
  - [ ] Create `defines` edge from `source_file` to glossary term

- [ ] **Task 8: Write tests** (AC: #1-#6)
  - [ ] Create `scripts/tests/test_glossary_generator.py`
  - [ ] Test each entity type template with complete fields
  - [ ] Test template with missing fields (should flag for review)
  - [ ] Test YAML export format matches design doc example
  - [ ] Test SQLite table population and foreign key integrity
  - [ ] Test defines edge creation
  - [ ] Test that allowed_variants and forbidden_synonyms are preserved from existing YAML on incremental runs

## Dev Notes

### Architecture Compliance

This story implements the Glossary component described in the design doc's "3. Glossary" section. The three-tier structure (canonical, variants, forbidden), the rule-based templates per entity type, and the YAML export format all match the design doc. The key design principle is maintained: "Definitions are generated using rule-based templates per entity type, not LLM normalization. This keeps the entire pre-generation pipeline deterministic and reproducible."

### Technical Notes

- Canonical terms are auto-generated from Tier 1 files. Allowed variants and forbidden synonyms are human-authored and maintained in `glossary.yaml` directly. The generator should preserve existing variants/synonyms when regenerating canonical entries (merge, don't overwrite).
- The design doc specifies that the glossary script "operates on Tier 1 files filtered by `last_modified` to detect changes since the last build, or can perform a full rebuild." Incremental support means the generator needs access to the previous glossary state.
- For hook files, the "phase" field (PreToolUse, PostToolUse, Stop) comes from the hook's configuration in `settings.json`, not from the hook file itself. The generator may need to cross-reference the settings.json parsing from Story 1.4.
- The YAML export should produce human-readable output with proper indentation. Use `yaml.dump()` with `default_flow_style=False`.
- `defines` edges bridge this story and Story 1.4. The glossary generator calls the edge creation function exposed by the edge detector module.

### Testing Requirements

- Unit tests for each template with complete and incomplete field sets
- Test YAML output format compliance against the design doc example
- Test SQLite population with foreign key constraints
- Test incremental behavior: existing variants/synonyms preserved when canonical terms regenerated
- Test flagging: entries with missing fields are marked `needs_review`

### Project Structure Notes

Files created by this story:

```
scripts/lib/
  glossary_generator.py      # New: generate_glossary(), apply_template(), export_glossary_yaml(), populate_glossary_tables()

scripts/tests/
  test_glossary_generator.py # New
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Glossary]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Three-Tier Structure]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Generation (Glossary)]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Maintenance (Glossary)]

### Dependencies

- **Blocks**: Story 1.6 -- the rebuild script orchestrates glossary generation as its final step
- **Blocked by**: Story 1.1 (schema with glossary tables), Story 1.2 (tier classification identifies which files are Tier 1)

### Out of Scope

- Authoring the initial set of allowed variants and forbidden synonyms (human-authored content, maintained in glossary.yaml after first generation)
- Glossary injection into generation prompts (Story 1.9)
- Glossary compliance validation in generated documents (Story 1.10)
- Full tier-rules.yaml calibration (Story 1.7)
- Graph traversal using glossary terms for seed identification (Story 1.8)
