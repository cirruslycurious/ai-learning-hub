# Story 1.9: Generation Prompt Assembly

Status: draft

## Story

As a documentation author,
I want the system to assemble a complete generation prompt from archetype, glossary, style guide, and raw source files,
so that I can pass it to an LLM for single-shot document generation with all constraints embedded.

## Acceptance Criteria

1. **AC1: Prompt assembly order**
   - GIVEN a topic expansion result with a file set, an archetype, the glossary, and the style guide
   - WHEN the prompt is assembled
   - THEN it contains components in this order: (1) style guide, (2) glossary as terminology constraint block, (3) archetype with section structure and rules, (4) raw source files labeled with file paths, (5) generation task instruction
   - AND the order matches the design doc's generation prompt structure

2. **AC2: Glossary formatting as constraint block**
   - GIVEN the glossary data (canonical terms, allowed variants, forbidden synonyms)
   - WHEN formatted for the prompt
   - THEN it produces a "Terminology Constraints" block with three sections: "Canonical Terms (use exactly as defined)", "Allowed Variants (acceptable after canonical form introduced)", "Forbidden Synonyms (never use these)"
   - AND it includes the instruction: "Use canonical terms exactly as defined. Allowed variants may be used only after the canonical form has appeared in the same document. Never use forbidden synonyms."

3. **AC3: Source file inclusion**
   - GIVEN the expanded file set for a topic
   - WHEN source files are included in the prompt
   - THEN every file's full content is included uncompressed and unsummarized
   - AND each file is clearly labeled with its relative file path
   - AND files are organized in a readable format (file path header, then content)

4. **AC4: Split interaction model**
   - GIVEN a split proposal with N subtopics
   - WHEN the user chooses option A (single doc covering a subset of subtopics)
   - THEN the assembler produces one prompt with the combined file set
   - AND when the user chooses option B (N separate docs)
   - THEN the assembler produces N separate prompts, each with its subtopic's file set

5. **AC5: Metadata frontmatter generation**
   - GIVEN a generation prompt being assembled
   - WHEN the metadata frontmatter is generated for the output document
   - THEN it contains: `generated_by: doc-gen-system`, `generated_at` (ISO timestamp), `index_rebuilt_at` (from rebuild.log or DB), `archetype` (archetype name), `archetype_hash` (hash of archetype YAML content), `topic` (topic string), `source_files` (list with `path` and `hash` per file), `glossary_hash` (hash of glossary.yaml content), `style_guide_hash` (hash of style-guide.md content)

6. **AC6: Archetype loading and validation**
   - GIVEN an archetype name (e.g., "system-architecture")
   - WHEN the archetype is loaded from `docs/_docgen/archetypes/`
   - THEN the YAML file is parsed and validated for required fields: `archetype`, `audience`, `total_words`, `source_budget_ratio`, `sections` (each with `name`, `level`, `words`, `include`, `exclude`)
   - AND missing required fields produce a clear error message

## Tasks / Subtasks

- [ ] **Task 1: Create prompt assembly module** (AC: #1-#6)
  - [ ] Create a prompt assembly module (can be in `scripts/lib/` or as part of a generation workflow script)
  - [ ] Define `PromptComponents` dataclass: `style_guide`, `glossary_block`, `archetype_block`, `source_files_block`, `task_instruction`
  - [ ] Define `GenerationMetadata` dataclass for frontmatter fields

- [ ] **Task 2: Implement archetype loader** (AC: #6)
  - [ ] Implement `load_archetype(name: str, archetypes_dir: str) -> dict`
  - [ ] Load from `docs/_docgen/archetypes/{name}.yaml`
  - [ ] Validate required fields and structure
  - [ ] Raise clear errors for missing fields or malformed YAML

- [ ] **Task 3: Implement glossary constraint block formatter** (AC: #2)
  - [ ] Implement `format_glossary_constraint(glossary_path: str) -> str`
  - [ ] Load glossary.yaml
  - [ ] Format three sections: Canonical Terms, Allowed Variants, Forbidden Synonyms
  - [ ] Append the usage instruction from the design doc

- [ ] **Task 4: Implement source file block formatter** (AC: #3)
  - [ ] Implement `format_source_files(file_paths: list[str], repo_root: str) -> str`
  - [ ] For each file: read full content, prepend with file path header
  - [ ] Use clear delimiters between files (e.g., `--- File: path/to/file ---`)
  - [ ] No compression, no summarization -- raw content only

- [ ] **Task 5: Implement prompt assembler** (AC: #1)
  - [ ] Implement `assemble_prompt(topic: str, archetype: dict, glossary_block: str, style_guide: str, source_files_block: str) -> str`
  - [ ] Concatenate in order: style guide, glossary constraint, archetype definition, source files, task instruction
  - [ ] Task instruction: "Write a [archetype type] about [topic] following the archetype structure exactly. Use terminology from the glossary. Follow the style guide. Stay within word budgets per section. Respect abstraction level rules per section."

- [ ] **Task 6: Implement metadata frontmatter generator** (AC: #5)
  - [ ] Implement `generate_metadata(topic: str, archetype_name: str, archetype_content: bytes, source_files: list, glossary_content: bytes, style_guide_content: bytes, rebuild_timestamp: str) -> str`
  - [ ] Compute hashes using SHA-256 (truncated to 8 hex chars per design doc examples)
  - [ ] Compute per-file hashes for `source_files` list
  - [ ] Format as YAML frontmatter block

- [ ] **Task 7: Implement split interaction handling** (AC: #4)
  - [ ] Implement `handle_split_choice(split_proposal, user_choice: str) -> list[PromptComponents]`
  - [ ] Option A: merge specified subtopics into one file set, produce one prompt
  - [ ] Option B: produce N prompts, one per subtopic
  - [ ] Each prompt gets its own metadata frontmatter with the specific files it covers

- [ ] **Task 8: Write tests** (AC: #1-#6)
  - [ ] Create tests for the prompt assembly module
  - [ ] Test prompt assembly order (style guide first, then glossary, archetype, source files, task instruction)
  - [ ] Test glossary constraint block format matches design doc format
  - [ ] Test source file inclusion: verify full content, no truncation
  - [ ] Test metadata frontmatter contains all required fields
  - [ ] Test hash computation (known content produces known hash)
  - [ ] Test archetype loading and validation (valid YAML, missing fields)
  - [ ] Test split choice handling: option A produces 1 prompt, option B produces N
  - [ ] Test that task instruction includes topic name and archetype type

## Dev Notes

### Architecture Compliance

This story implements the "Step 5: Generation" workflow from the design doc. The prompt structure (style guide, glossary, archetype, source files, task instruction) matches the design doc's specification. The metadata frontmatter format matches the example in the design doc, including all specified fields. The single-shot generation principle is maintained: "One pass, full quality, constrained by archetype and glossary."

### Technical Notes

- The prompt is assembled as a string. The system does not make the LLM call itself -- it produces the prompt for the user to feed into their preferred model. This keeps the system LLM-agnostic.
- Hash computation uses `hashlib.sha256()` on file content bytes, truncated to 8 hex characters (first 8 chars of the hex digest). This matches the hash format in the design doc's frontmatter example (e.g., `b4c2a1f8`).
- Source files are included with their full content. For large files, this can make the prompt very long. The budget logic from Story 1.8 ensures the total stays within the archetype's source budget, so this is by design.
- The `index_rebuilt_at` timestamp can be read from `rebuild.log` or from the database's modification time.
- The style guide is loaded from `docs/_docgen/style-guide.md` as raw text and inserted verbatim.
- The archetype is formatted into the prompt as a structured specification (section names, levels, word budgets, include/exclude rules), not as raw YAML. The generation model needs to understand the constraints, not parse YAML.

### Testing Requirements

- Unit tests for each component formatter (glossary block, source files block, metadata)
- Test prompt assembly produces a string with all components in correct order
- Test metadata hash computation with known inputs
- Test archetype validation catches missing fields
- Test split choice handling produces correct number of prompts
- No end-to-end LLM generation tests (the system produces prompts, not generated documents)

### Project Structure Notes

Files created by this story:

```
scripts/lib/
  prompt_assembler.py        # New: assemble_prompt(), format_glossary_constraint(), format_source_files(), generate_metadata(), load_archetype()

scripts/tests/
  test_prompt_assembler.py   # New
```

Note: The design doc's file layout does not list a separate prompt assembly module in `scripts/lib/`. This is an implementation detail -- the prompt assembly logic needs to live somewhere, and a dedicated module in `scripts/lib/` is the natural location given the project structure.

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Step 5: Generation]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Generation prompt structure]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Metadata frontmatter example]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Usage in Generation (Glossary)]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Interaction Model]

### Dependencies

- **Blocks**: Story 1.11 -- staleness checker reads the metadata frontmatter generated by this story
- **Blocked by**: Story 1.7 (needs archetypes and style guide to load), Story 1.8 (needs topic expansion results to know which files to include)

### Out of Scope

- Making the LLM call (the system produces prompts, the user invokes the model)
- Post-generation validation (Story 1.10)
- Staleness checking (Story 1.11)
- Multi-pass generation, drafting, or smoothing (explicitly excluded by design doc)
- Cross-document framing consistency (explicitly out of scope per design doc's "Decided" section)
- Archetype authoring (Story 1.7)
- Topic expansion logic (Story 1.8)
