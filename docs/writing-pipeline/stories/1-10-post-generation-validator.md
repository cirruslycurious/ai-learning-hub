# Story 1.10: Post-Generation Validator

Status: draft

## Story

As a documentation author,
I want a deterministic validator that checks generated documents for glossary compliance, heading structure, abstraction violations, and word budget adherence,
so that I get a quality report before human review highlighting concrete, pattern-matchable issues.

## Acceptance Criteria

1. **AC1: Glossary compliance -- forbidden synonyms**
   - GIVEN a generated markdown document and the glossary
   - WHEN the validator scans for forbidden synonyms
   - THEN any forbidden term from `glossary_forbidden` found in the document is flagged with the line number, the forbidden term, and the canonical replacement
   - AND terms that appear to be new concepts not in the glossary are flagged as candidate additions

2. **AC2: Allowed variant discipline**
   - GIVEN a generated document using allowed variants from the glossary
   - WHEN the validator checks variant discipline
   - THEN it verifies that each allowed variant only appears after its canonical form has been introduced earlier in the same document
   - AND violations are flagged with the line number where the variant appears and the canonical form it should follow

3. **AC3: Heading structure check**
   - GIVEN a generated document and its archetype definition
   - WHEN the validator checks heading structure
   - THEN it verifies section names match the archetype's defined sections (in order)
   - AND missing sections are flagged
   - AND extra sections not defined in the archetype are flagged
   - AND heading hierarchy (h1, h2, h3) is validated against expected nesting

4. **AC4: Abstraction violation detection**
   - GIVEN a generated document and its archetype with per-section abstraction levels and include/exclude rules
   - WHEN the validator checks for abstraction violations
   - THEN it detects: file paths in L1 (Overview) sections, exact commands in L2 (Architecture) sections, architectural rationale in L4-only sections (how-to steps)
   - AND detection uses regex patterns (not LLM-based analysis)
   - AND each violation is flagged with the section name, line number, and the detected pattern

5. **AC5: Word budget compliance**
   - GIVEN a generated document and its archetype with per-section word budgets
   - WHEN the validator checks word counts
   - THEN it counts words per section
   - AND sections exceeding their budget by more than 15% are flagged with the section name, actual word count, budgeted word count, and overage percentage

6. **AC6: Validation report format**
   - GIVEN a completed validation run
   - WHEN the report is produced
   - THEN it follows the format from the design doc: check name, pass/warning/fail status, specific details per finding
   - AND the report is output both to stdout and optionally to a file alongside the generated document
   - AND the validator script can be invoked as `python scripts/validate-doc.py <document> --archetype <name>`

## Tasks / Subtasks

- [ ] **Task 1: Create doc validator module** (AC: #1-#5)
  - [ ] Create `scripts/lib/doc_validator.py`
  - [ ] Define `ValidationResult` dataclass: `check_name`, `status` (pass/warning/fail), `findings` (list of `Finding`)
  - [ ] Define `Finding` dataclass: `line_number`, `message`, `detail`
  - [ ] Implement `validate_document(doc_path: str, archetype: dict, glossary: dict) -> list[ValidationResult]`

- [ ] **Task 2: Implement forbidden synonym scanner** (AC: #1)
  - [ ] Implement `check_glossary_compliance(doc_content: str, glossary_forbidden: list) -> ValidationResult`
  - [ ] Scan each line for forbidden terms (case-insensitive word boundary matching)
  - [ ] Track new terms that appear concept-like but are not in the glossary (heuristic: capitalized multi-word phrases, quoted terms)
  - [ ] Return findings with line numbers and suggested canonical replacements

- [ ] **Task 3: Implement allowed variant discipline checker** (AC: #2)
  - [ ] Implement `check_variant_discipline(doc_content: str, glossary_variants: list, glossary_canonical: list) -> ValidationResult`
  - [ ] Parse document line by line, tracking which canonical forms have been introduced
  - [ ] When an allowed variant is encountered, verify its canonical form appeared earlier
  - [ ] Flag violations with line number of variant and the missing canonical form

- [ ] **Task 4: Implement heading structure checker** (AC: #3)
  - [ ] Implement `check_heading_structure(doc_content: str, archetype_sections: list) -> ValidationResult`
  - [ ] Parse markdown headings (lines starting with `#`, `##`, `###`)
  - [ ] Compare heading names against archetype section names (fuzzy match for minor wording differences)
  - [ ] Flag missing sections, extra sections, and hierarchy violations

- [ ] **Task 5: Implement abstraction violation detector** (AC: #4)
  - [ ] Implement `check_abstraction_violations(doc_content: str, archetype_sections: list) -> ValidationResult`
  - [ ] Define regex patterns per violation type:
    - File paths: pattern for paths with slashes and file extensions (e.g., `[\w./]+\.\w{1,4}`)
    - Exact commands: pattern for shell commands (e.g., lines starting with `$` or common command prefixes)
    - Architectural rationale: pattern for design-justification language in how-to sections
  - [ ] Map section content to archetype levels
  - [ ] Apply appropriate checks per level (file paths flagged in L1, commands flagged in L2)

- [ ] **Task 6: Implement word budget checker** (AC: #5)
  - [ ] Implement `check_word_budgets(doc_content: str, archetype_sections: list) -> ValidationResult`
  - [ ] Split document into sections by heading boundaries
  - [ ] Count words per section (whitespace-separated tokens, excluding code blocks)
  - [ ] Compare against archetype word budgets
  - [ ] Flag sections exceeding budget by more than 15%

- [ ] **Task 7: Implement validate-doc.py CLI** (AC: #6)
  - [ ] Implement `scripts/validate-doc.py` as the entry point
  - [ ] Parse CLI arguments: `<document_path>`, `--archetype <name>`, `--glossary <path>` (default: `docs/_docgen/glossary.yaml`), `--output <report_path>` (optional)
  - [ ] Load archetype, glossary, and document
  - [ ] Run all checks and produce the report
  - [ ] Format output matching design doc example (checkmark/warning/x per check, details per finding)

- [ ] **Task 8: Write tests** (AC: #1-#6)
  - [ ] Create `scripts/tests/test_doc_validator.py`
  - [ ] Test forbidden synonym detection with known forbidden terms in test content
  - [ ] Test allowed variant discipline: variant before canonical (should flag), variant after canonical (should pass)
  - [ ] Test heading structure: matching archetype (pass), missing section (flag), extra section (flag)
  - [ ] Test abstraction violations: file path in L1 (flag), command in L2 (flag), file path in L4 (pass)
  - [ ] Test word budget: section at budget (pass), section 10% over (pass), section 20% over (flag)
  - [ ] Test report format output
  - [ ] Test CLI invocation with test document and test archetype

## Dev Notes

### Architecture Compliance

This story implements the "Step 6: Post-Generation Validation" described in the design doc. All five check types match the design doc's specification. The critical constraint is maintained: "The validator performs zero rewriting -- it produces a pass/fail report that accompanies the document for human review. All checks are script-based (regex, glossary matching, heading parsing), not LLM-based, ensuring consistent and reproducible results."

The design doc's "Validator scope" note is important: "The validator catches concrete, pattern-matchable violations... It does not catch conceptual-level violations such as L3 choreography content appearing in an L2 Architecture section." This story does NOT implement LLM-based validation.

### Technical Notes

- Forbidden synonym matching should use word boundary regex (`\b`) to avoid false positives (e.g., "check" inside "checkpoint").
- For heading structure matching, use a fuzzy comparison (case-insensitive, ignore minor punctuation differences) since the generated document's headings may not exactly match the archetype's section names.
- Abstraction violation detection is inherently heuristic. File path detection (`/` in paths, file extensions) will have false positives in code blocks. Consider excluding content within fenced code blocks (` ``` `) from L1/L2 checks.
- Word counting should exclude fenced code blocks, YAML frontmatter, and table markup to match what a human would consider "words" in the section.
- The report format uses Unicode symbols: checkmark for pass, warning for advisory, x for fail. Match the design doc's example output format.
- The validator is "a quality signal, not a gate" (per design doc). Documents with warnings can still be published.

### Testing Requirements

- Unit tests per check type with crafted test documents
- Test false positive avoidance: code blocks should not trigger L1/L2 abstraction checks
- Test word counting excludes code blocks and frontmatter
- Test CLI invocation end-to-end with a test document
- Test report format matches expected output structure
- Use fixture files with known content for predictable test results

### Project Structure Notes

Files created or modified by this story:

```
scripts/
  validate-doc.py            # Modified: full implementation (was placeholder from Story 1.1)
  lib/
    doc_validator.py         # New: check functions for all 5 validation types

scripts/tests/
  test_doc_validator.py      # New
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Step 6: Post-Generation Validation]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Validator scope]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Checks performed]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Validation report example]

### Dependencies

- **Blocks**: None directly (the staleness checker, Story 1.11, does not depend on the validator)
- **Blocked by**: Story 1.7 (needs archetypes for heading structure checks and abstraction level definitions)

### Out of Scope

- LLM-based validation for conceptual-level violations (explicitly excluded by design doc)
- Auto-fixing or rewriting generated content (validator is read-only)
- Staleness checking (Story 1.11 -- different concern)
- Generation prompt assembly (Story 1.9)
- Glossary generation (Story 1.5 -- the validator reads the glossary, does not generate it)
- Cross-document consistency checking (explicitly out of scope per design doc's "Decided" section)
- Validating generated metadata frontmatter (the validator checks document content, not metadata)
