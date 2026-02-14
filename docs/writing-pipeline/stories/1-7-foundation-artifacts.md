# Story 1.7: Hand-Authored Foundation Artifacts

Status: draft

## Story

As a documentation author,
I want the tier rules, style guide, and archetype YAML files authored and committed to the repository,
so that the generation pipeline has the configuration artifacts it needs to produce well-structured documentation.

## Acceptance Criteria

1. **AC1: Tier rules YAML calibrated for ai-learning-hub**
   - GIVEN `docs/_docgen/tier-rules.yaml`
   - WHEN inspected
   - THEN it contains glob patterns for all 4 tiers matching the detection rules in the design doc
   - AND Tier 1 patterns cover: `.claude/skills/**/*.md`, `.claude/hooks/*`, `.claude/commands/*`, `.claude/agents/*`, `docs/adr/*`, `docs/epics/*`, `docs/stories/*`, `README.md`, `SKILL.md`, `CLAUDE.md`
   - AND Tier 2 patterns cover: `package.json`, `tsconfig.json`, `jest.config.*`, `.eslintrc.*`, `.claude/settings.json`, `*.d.ts`, `index.ts`/`index.js`, `.github/workflows/*`, `.env.example`
   - AND Tier 3 patterns cover: `*.ts`, `*.js`, `*.tsx`, `*.jsx`, `*.test.ts`, `*.spec.ts`, `scripts/*`
   - AND Tier 4 patterns cover: `node_modules/`, `dist/`, `.build/`, `cdk.out/`, `.git/`, `package-lock.json`, `yarn.lock`, binary extensions, `.tmp`, editor backups

2. **AC2: Style guide authored**
   - GIVEN `docs/_docgen/style-guide.md`
   - WHEN inspected
   - THEN it covers voice and tone guidance (direct, technical)
   - AND it covers formatting rules (heading levels, code blocks, list usage, emphasis)
   - AND it covers conventions (file path formatting, command formatting, source citation)
   - AND it covers anti-patterns (no marketing language, no "simply"/"just", no unexplained acronyms)

3. **AC3: System architecture archetype**
   - GIVEN `docs/_docgen/archetypes/system-architecture.yaml`
   - WHEN inspected
   - THEN it defines: `archetype`, `audience`, `total_words` (2400), `source_budget_ratio` (2.5)
   - AND it defines sections: Overview (L1, 300 words), Architecture (L2, 500 words), System Flow (L3, 900 words), Component Deep Dives (L4, 600 words), Quick Reference (L4, 100 words)
   - AND each section has `include` and `exclude` rules matching the design doc

4. **AC4: Blog post archetype**
   - GIVEN `docs/_docgen/archetypes/blog-post.yaml`
   - WHEN inspected
   - THEN it defines: `archetype`, `audience`, `total_words` (1500), `source_budget_ratio` (1.5)
   - AND it defines sections: Hook (L1, 200 words), Approach (L2, 400 words), How It Works (L3, 600 words), Key Insight / Takeaway (L1-L2, 300 words)
   - AND each section has `include` and `exclude` rules matching the design doc

5. **AC5: How-to guide archetype**
   - GIVEN `docs/_docgen/archetypes/how-to-guide.yaml`
   - WHEN inspected
   - THEN it defines: `archetype`, `audience`, `total_words` (1800), `source_budget_ratio` (3.0)
   - AND it defines sections: What You'll Do (L1, 100 words), Prerequisites (L4, 200 words, checklist format), Steps (L4, 1000 words), Verification (L4, 200 words), Troubleshooting (L4, 300 words, problem/solution format)

6. **AC6: Troubleshooting guide archetype**
   - GIVEN `docs/_docgen/archetypes/troubleshooting.yaml`
   - WHEN inspected
   - THEN it defines: `archetype`, `audience`, `total_words` (2000), `source_budget_ratio` (3.5)
   - AND it defines sections: Quick Diagnosis (L3, 300 words, decision tree/table format), Problem Entries (L4, 1500 words, repeatable with symptom/cause/fix/prevention), Getting Help (L1, 200 words)

## Tasks / Subtasks

- [ ] **Task 1: Author tier-rules.yaml** (AC: #1)
  - [ ] Replace the stub tier-rules.yaml from Story 1.2 with the full calibrated version
  - [ ] Define Tier 4 exclusion patterns (directories and file extensions)
  - [ ] Define Tier 1 patterns for all definitional file types
  - [ ] Define Tier 2 patterns for all structural file types
  - [ ] Define Tier 3 patterns for implementation files
  - [ ] Test with the rebuild script to verify correct classification

- [ ] **Task 2: Author style-guide.md** (AC: #2)
  - [ ] Create `docs/_docgen/style-guide.md`
  - [ ] Write voice and tone section (direct, second-person for guides; third-person for architecture)
  - [ ] Write formatting rules section (heading hierarchy, code block language tags, list conventions)
  - [ ] Write conventions section (file paths in backticks, commands in code blocks, source citations)
  - [ ] Write anti-patterns section with examples of what to avoid

- [ ] **Task 3: Author system-architecture archetype** (AC: #3)
  - [ ] Create `docs/_docgen/archetypes/system-architecture.yaml`
  - [ ] Transcribe the archetype definition from the design doc
  - [ ] Verify all section include/exclude rules are captured

- [ ] **Task 4: Author blog-post archetype** (AC: #4)
  - [ ] Create `docs/_docgen/archetypes/blog-post.yaml`
  - [ ] Transcribe the archetype definition from the design doc
  - [ ] Verify all section include/exclude rules are captured

- [ ] **Task 5: Author how-to-guide archetype** (AC: #5)
  - [ ] Create `docs/_docgen/archetypes/how-to-guide.yaml`
  - [ ] Transcribe the archetype definition from the design doc
  - [ ] Include format specifications (checklist for prerequisites, problem/solution for troubleshooting)

- [ ] **Task 6: Author troubleshooting archetype** (AC: #6)
  - [ ] Create `docs/_docgen/archetypes/troubleshooting.yaml`
  - [ ] Transcribe the archetype definition from the design doc
  - [ ] Include repeat specification for Problem Entries and per-entry structure (symptom/cause/fix/prevention)

- [ ] **Task 7: Validate with rebuild script** (AC: #1)
  - [ ] Run `python scripts/rebuild-doc-index.py --verbose` with the new tier-rules.yaml
  - [ ] Verify tier distribution looks correct for the ai-learning-hub repository
  - [ ] Adjust any glob patterns that misclassify files
  - [ ] Document any patterns that needed adjustment

## Dev Notes

### Architecture Compliance

This story creates the hand-authored artifacts specified in the design doc's "4. Archetypes," "5. Style Guide," and "2. Tier Classification" sections. These are the only components of the system described as "purely human-authored." The archetype specifications are transcribed from the design doc's example archetypes. The tier-rules.yaml is calibrated for this specific repository based on the detection rules defined in the design doc.

### Technical Notes

- This is primarily an authoring task, not a coding task. The main deliverables are YAML and markdown files.
- The archetypes YAML files should be valid YAML that can be loaded by `yaml.safe_load()`. Test this manually or with a simple validation script.
- The style guide is a markdown document for human consumption, injected verbatim into generation prompts. Keep it concise -- it contributes to the token budget of every generation.
- The tier-rules.yaml must be tested against the actual repository. Run the rebuild script and inspect the tier distribution. Common issues: markdown files in unexpected locations, configuration files with unusual extensions, Python files in `scripts/` being classified incorrectly.
- The design doc notes that archetypes are "starting points" that need iteration based on generation output quality. These initial versions match the design doc examples; refinement happens through usage.

### Testing Requirements

- Manual validation: load each YAML file with `yaml.safe_load()` and verify structure
- Integration test: run the rebuild script with the new tier-rules.yaml on the actual repository and inspect the tier distribution
- Review style guide for completeness against the design doc's checklist (voice/tone, formatting, conventions, anti-patterns)
- No automated unit tests for this story -- the artifacts are human-authored content, not executable code

### Project Structure Notes

Files created or modified by this story:

```
docs/_docgen/
  tier-rules.yaml            # Modified: full calibration (replaces stub from Story 1.2)
  style-guide.md             # New: voice, tone, formatting conventions
  archetypes/
    system-architecture.yaml # New: architecture reference archetype
    blog-post.yaml           # New: blog post archetype
    how-to-guide.yaml        # New: how-to/operations guide archetype
    troubleshooting.yaml     # New: troubleshooting guide archetype
```

### References

- [Source: docs/writing-pipeline/Documentation Generation System.md#Tier Classification (detection rules)]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Archetypes]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Style Guide]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Example Archetype: System Architecture Reference]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Example Archetype: Blog Post]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Example Archetype: How-To / Operations Guide]
- [Source: docs/writing-pipeline/Documentation Generation System.md#Example Archetype: Troubleshooting Guide]

### Dependencies

- **Blocks**: Story 1.9 (generation prompt assembly needs archetypes and style guide), Story 1.10 (validator needs archetypes for heading structure checks)
- **Blocked by**: Story 1.6 (needs working rebuild script to test tier rules with real data)

### Out of Scope

- Writing additional archetype types beyond the 4 specified in the design doc (future work as needed)
- Iterating on archetypes based on generation output quality (ongoing maintenance described in design doc)
- Authoring allowed variants and forbidden synonyms for the glossary (maintained in glossary.yaml after initial generation)
- Abstraction level definitions (these are embedded in the archetype structure, not separate artifacts)
- Source budget ratio calibration (the design doc notes these are "initial estimates" needing "empirical validation")
