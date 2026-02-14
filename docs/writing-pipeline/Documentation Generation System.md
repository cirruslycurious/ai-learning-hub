# Documentation Generation System: Design & Architecture

## Problem Statement

A growing codebase (1,100+ files, 9 epics remaining) needs documentation across multiple formats — blog posts, how-to guides, troubleshooting guides, architecture references, operations docs — all derived from the same source material. Manual documentation doesn't scale. LLM-generated documentation suffers from abstraction-level violations, terminology drift, lossy compression, and quality variance when source material exceeds context limits.

The system must:

- Generate high-quality documents from raw source files without intermediate summarization
- Support any slice of the codebase with any document type that has a defined archetype (new document types require authoring a new archetype)
- Maintain consistent terminology and voice across all generated documents
- Automatically detect when a requested topic exceeds context capacity and respond by narrowing scope, never by reducing depth
- Require minimal ongoing maintenance as the codebase grows

## Core Principle: Depth Is Non-Negotiable

The system never produces shallow documentation. When source material for a topic exceeds the context budget, the response is always to narrow the breadth of the topic — splitting into focused subtopics — never to drop files or skim content. Every generated document covers its scope at full depth across all tiers of source material: definitional files, structural/configuration files, and implementation code.

This principle drives every design decision in the system.

---

## System Components

### 1. Repository Index (SQLite Database)

A single SQLite file (`docs/_docgen/repo-index.db`) containing the complete structural map of the repository. No server required. Rebuilt on command by a Python script before documentation generation sessions. Deterministic — derived entirely from the current state of the repository.

#### Node Table

Every file in the repository (except Tier 4 exclusions) is indexed as a node.

```sql
nodes (
  id TEXT PRIMARY KEY,          -- file path relative to repo root
  tier INTEGER NOT NULL,        -- 1, 2, or 3
  type TEXT NOT NULL,           -- story, epic, hook, skill, agent, adr, config, type_def, module, implementation, directory
  name TEXT,                    -- human-readable component name (parsed from frontmatter or filename)
  token_estimate INTEGER,       -- estimated token count for full file content
  frontmatter TEXT,             -- raw YAML frontmatter as JSON (nullable)
  last_modified TEXT            -- ISO timestamp from filesystem
)
```

#### Edge Table

Relationships between files, typed by how they connect.

```sql
edges (
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,      -- depends_on, touches, references, imports, intercepts, enforces, defines
  FOREIGN KEY (source_id) REFERENCES nodes(id),
  FOREIGN KEY (target_id) REFERENCES nodes(id)
)
```

Edge types:

- `depends_on` — story dependency declarations from YAML frontmatter
- `touches` — story file-touch predictions pointing to directories or files
- `references` — markdown backtick paths linking one doc to another (e.g., `.claude/skills/epic-orchestrator/SKILL.md`)
- `imports` — JavaScript/TypeScript import/require statements
- `intercepts` — hook-to-tool-type relationships from settings.json
- `enforces` — hook-to-ADR relationships (hook implements an architectural constraint)
- `defines` — file that defines a glossary term

**Edge detection fidelity note:** Edge accuracy varies by type. `depends_on` and `intercepts` edges are parsed from structured data (YAML frontmatter, JSON config) and are highly reliable. `references` edges (markdown backtick paths) are straightforward to parse. `touches` edges are developer-declared predictions, not guarantees — they may be stale or incomplete. `imports` edges in TypeScript can involve dynamic imports, re-exports, and aliases that simple regex parsing will miss. The system does not attempt to guarantee perfect edge detection. Instead, when a generated document is missing expected coverage, trace back to the traversal results to determine whether the issue was a missing edge (fix the edge detector) or a generation quality problem (fix the archetype or prompt). Fix edge detection bugs as they surface through usage rather than building speculative instrumentation.

#### Glossary Tables

Canonical terminology derived from Tier 1 definitional files, organized into three tiers to prevent terminology drift.

```sql
glossary_canonical (
  term TEXT PRIMARY KEY,        -- canonical name (e.g., "epic-reviewer", "MUST-FIX", "integration checkpoint")
  definition TEXT NOT NULL,     -- one-line canonical definition
  source_file TEXT NOT NULL,    -- Tier 1 file that defines this term
  FOREIGN KEY (source_file) REFERENCES nodes(id)
)

glossary_variants (
  variant TEXT PRIMARY KEY,     -- allowed shorthand (e.g., "checkpoint")
  canonical_term TEXT NOT NULL, -- maps to canonical form (e.g., "integration checkpoint")
  usage_rule TEXT,              -- when this variant is acceptable (e.g., "after canonical form introduced in same document")
  FOREIGN KEY (canonical_term) REFERENCES glossary_canonical(term)
)

glossary_forbidden (
  forbidden_term TEXT PRIMARY KEY,  -- banned synonym (e.g., "integration validation", "dependency check")
  canonical_term TEXT NOT NULL,     -- what should be used instead
  FOREIGN KEY (canonical_term) REFERENCES glossary_canonical(term)
)
```

### 2. Tier Classification

Every indexed file receives a tier assignment. Tiers are relevance metadata, not inclusion/exclusion filters. All tiers (1-3) are indexed. All tiers are eligible for inclusion in any generated document. Tiers exist to help the glossary script identify definitional files and to provide prioritization hints when proposing topic splits.

#### Tier 1: Definitional Files

These files define components — their purpose, role, interface, and constraints. They are the primary source for glossary entries.

Detection rules:

- Has YAML frontmatter with `id`, `title`, or `role` fields → story, epic, agent definition
- Path matches `.claude/skills/**/*.md` → skill module
- Path matches `.claude/hooks/*` → hook script
- Path matches `.claude/commands/*` → command definition
- Path matches `.claude/agents/*` → agent definition
- Filename is `README.md`, `SKILL.md`, or `CLAUDE.md` → documentation root
- Path matches `docs/adr/*` → architectural decision record
- Path matches `docs/epics/*` or `docs/stories/*` → planning artifact

#### Tier 2: Structural Files

These files define project shape, configuration, build process, and module boundaries. Essential for operations docs, setup guides, and troubleshooting content.

Detection rules:

- `package.json`, `tsconfig.json`, `jest.config.*`, `.eslintrc.*` → build/test configuration
- `.claude/settings.json` → hook and tool configuration
- `*.d.ts` files → type definitions and interfaces
- `index.ts` or `index.js` at directory level → module entry points and public API surface
- CI/CD config files (`.github/workflows/*`, etc.) → pipeline definitions
- Environment config templates (`.env.example`, etc.) → deployment configuration

#### Tier 3: Implementation Files

Source code files. Relevant when the topic covers a specific feature's implementation, operational procedures, or debugging.

Detection rules:

- `*.ts`, `*.js`, `*.tsx`, `*.jsx` not matching Tier 2 patterns → application code
- Test files (`*.test.ts`, `*.spec.ts`) → test implementations
- Script files in `scripts/` → operational tooling

#### Tier 4: Excluded

Never indexed. Never included.

- `node_modules/`
- Build output (`dist/`, `.build/`, `cdk.out/`)
- `.git/`
- Lockfiles (`package-lock.json`, `yarn.lock`)
- Binary files, images, fonts
- Generated/compiled files
- `.tmp` files, editor backups

Tier assignment rules are maintained in a config file (`docs/_docgen/tier-rules.yaml`) as glob patterns. Adding a new directory convention means adding one line to this config.

### 3. Glossary

The canonical terminology reference for the project. Organized into three tiers — canonical terms, allowed variants, and forbidden synonyms — to prevent terminology drift across generated documents. Included as a hard constraint in every documentation generation prompt.

#### Three-Tier Structure

**Canonical terms** are the authoritative names for system components and concepts. Generated documents must use these exact terms.

**Allowed variants** are acceptable shorthands that may be used after the canonical form has been introduced in the same document. For example, "checkpoint" is an allowed variant of "integration checkpoint" — but only after the full term has appeared at least once.

**Forbidden synonyms** are terms that commonly drift into documentation but must never be used. These are explicitly banned to prevent the gradual erosion of terminology discipline. For example, "integration validation," "dependency check," and "integration gate" are forbidden synonyms of "integration checkpoint."

#### Generation

A Python script parses all Tier 1 files and extracts component names and their roles/purposes from:

- YAML frontmatter fields (`title`, `role`, `description`, `purpose`)
- First paragraph or header comment of the file
- Structured sections (e.g., hook README tables)

Definitions are generated using rule-based templates per entity type, not LLM normalization. This keeps the entire pre-generation pipeline deterministic and reproducible. Templates combine frontmatter fields into consistent one-liners:

| Entity Type | Template                                  | Example Output                                                                                             |
| ----------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| agent       | "{name} is a {role} that {purpose}"       | "epic-reviewer is a subagent that performs adversarial code review with no implementation context"         |
| hook        | "{name} is a {phase} hook that {action}"  | "bash-guard is a PreToolUse hook that blocks dangerous shell commands"                                     |
| skill       | "{name} is a skill module that {purpose}" | "review-loop is a skill module that coordinates multi-round code review with reviewer and fixer subagents" |
| story       | "{title} ({id}): {description}"           | "Implement auth middleware (1.2): Add JWT validation to API routes"                                        |
| adr         | "ADR-{id}: {title} — {status}"            | "ADR-007: No Lambda-to-Lambda calls — Accepted"                                                            |

When a template produces an awkward or incomplete definition (e.g., frontmatter is missing a `purpose` field), the script flags the entry for manual review rather than guessing. Allowed variants and forbidden synonyms are maintained in the glossary YAML file directly — they are human-authored based on observed drift patterns, not auto-generated.

The output is a YAML file (`docs/_docgen/glossary.yaml`) committed to the repo.

Example glossary entry:

```yaml
- term: "integration checkpoint"
  definition: "Validation step that runs after completing stories with dependents, checking file overlap, type changes, and test results"
  source: ".claude/skills/epic-orchestrator/integration-checkpoint.md"
  allowed_variants:
    - variant: "checkpoint"
      rule: "after canonical form introduced in same document"
  forbidden_synonyms:
    - "integration validation"
    - "dependency check"
    - "integration gate"
    - "integration test"
```

#### Maintenance

Rebuilt on command alongside the repository index. The glossary script operates on Tier 1 files filtered by `last_modified` to detect changes since the last build, or can perform a full rebuild. Changes appear as a diff that can be reviewed before committing.

#### Usage in Generation

The glossary is injected into every generation prompt as a terminology constraint block:

```
## Terminology Constraints

### Canonical Terms (use exactly as defined)
- epic-reviewer: Isolated subagent spawned via Task tool that performs adversarial code review with no implementation context
- epic-fixer: Subagent spawned via Task tool that reads findings documents and applies corrections with full edit capabilities
- MUST-FIX: Review finding classified as Critical or Important severity that blocks PR creation until resolved
- integration checkpoint: Validation step that runs after completing stories with dependents, checking file overlap, type changes, and test results
...

### Allowed Variants (acceptable after canonical form introduced)
- "checkpoint" → "integration checkpoint"
- "reviewer" → "epic-reviewer"
- "fixer" → "epic-fixer"
...

### Forbidden Synonyms (never use these)
- "integration validation" → use "integration checkpoint"
- "dependency check" → use "integration checkpoint"
- "code analysis" → use "code review"
- "executor" → use "orchestrator"
...
```

The generation model is instructed: "Use canonical terms exactly as defined. Allowed variants may be used only after the canonical form has appeared in the same document. Never use forbidden synonyms. If you encounter a concept that has no glossary entry, flag it as a proposed glossary addition in an appendix — do not introduce it as a new term in the document body."

### 4. Archetypes

Hand-crafted structural templates that define the shape, abstraction levels, and constraints for each document type. Archetypes are the primary artifact encoding human judgment about what good documentation looks like. They are the only component of the system that is purely human-authored.

Each archetype specifies:

- **Target audience** — who reads this and what do they already know
- **Section structure** — ordered sections with names and purposes
- **Abstraction level per section** — what belongs and what doesn't (inclusion/exclusion rules)
- **Word budget per section** — proportional allocation within total target length
- **Total word count target** — overall document length
- **Source budget ratio** — multiplier applied to total word target to compute source material token budget (varies by archetype because different document types need different evidence density)

#### Abstraction Level Definitions

Used across all archetypes to maintain consistent meaning:

**L1 (Overview):** System purpose, key benefits, when to use. No component names not defined in this section. No file paths. No commands. No internal mechanics. Answers: "What is this and why does it exist?"

**L2 (Architecture):** Named components, relationships, boundaries. File locations as identifiers only. No behavioral sequences. No operational detail. Answers: "What are the pieces and how do they connect?"

**L3 (Choreography):** Phases, steps, decision points, human checkpoints. References components established at L2. No internal mechanics of individual components. Answers: "What happens in what order?"

**L4 (Deep Dive):** Internal mechanics, edge cases, exact commands, error messages, configuration details. Assumes all L1-L3 context. Answers: "How does this specific thing work?"

#### Example Archetype: System Architecture Reference

```yaml
archetype: system-architecture-reference
audience: Developer familiar with the project domain but new to this system
total_words: 2400
source_budget_ratio: 2.5 # source tokens ≈ 2.5× target words — moderate evidence density

sections:
  - name: Overview
    level: L1
    words: 300
    include:
      - system purpose and scope
      - key benefits (3-5)
      - when to use vs alternatives
    exclude:
      - component names not defined here
      - file paths
      - commands
      - implementation detail

  - name: Architecture
    level: L2
    words: 500
    include:
      - named components with roles
      - relationships and boundaries
      - file locations as identifiers
      - interaction patterns (spawning, delegation, invocation)
    exclude:
      - behavioral sequences
      - exit codes, response formats
      - internal algorithms

  - name: System Flow
    level: L3
    words: 900
    include:
      - phases and steps in execution order
      - decision points and branching logic
      - human checkpoints and user options
      - state transitions
    exclude:
      - internal component mechanics
      - specific commands or code
      - edge cases

  - name: Component Deep Dives
    level: L4
    words: 600
    include:
      - internal mechanics of key components
      - exact commands and configurations
      - edge cases and error handling
      - interaction patterns with examples
    exclude:
      - re-explaining L2 architecture
      - re-describing L3 flow

  - name: Quick Reference
    level: L4
    words: 100
    format: tables
    include:
      - command syntax
      - key file paths
      - summary lists (invariants, checkpoints)
```

#### Example Archetype: Blog Post

```yaml
archetype: blog-post
audience: Technical reader who may not use this system
total_words: 1500
source_budget_ratio: 1.5 # source tokens ≈ 1.5× target words — light evidence, mostly synthesis

sections:
  - name: Hook
    level: L1
    words: 200
    include:
      - the problem this solves
      - why it matters
    exclude:
      - component names
      - technical implementation

  - name: Approach
    level: L2
    words: 400
    include:
      - key architectural insight
      - design philosophy
      - what makes this different
    exclude:
      - file paths
      - configuration details

  - name: How It Works
    level: L3
    words: 600
    include:
      - walkthrough of the flow
      - concrete example
      - decision points that matter
    exclude:
      - exhaustive step listing
      - edge cases

  - name: Key Insight / Takeaway
    level: L1-L2
    words: 300
    include:
      - what the reader should remember
      - applicability beyond this system
      - what surprised us or what we learned
```

#### Example Archetype: How-To / Operations Guide

```yaml
archetype: how-to-guide
audience: Developer who needs to perform a task right now
total_words: 1800
source_budget_ratio: 3.0 # source tokens ≈ 3× target words — needs exact commands, configs, expected outputs

sections:
  - name: What You'll Do
    level: L1
    words: 100
    include:
      - one-paragraph summary of the task
      - expected outcome
      - time estimate

  - name: Prerequisites
    level: L4
    words: 200
    include:
      - required tools and versions
      - required configuration
      - required access/permissions
    format: checklist

  - name: Steps
    level: L4
    words: 1000
    include:
      - numbered sequential steps
      - exact commands to run
      - expected output at each step
      - decision points with options
    exclude:
      - architectural rationale
      - history of design decisions

  - name: Verification
    level: L4
    words: 200
    include:
      - how to confirm success
      - expected end state

  - name: Troubleshooting
    level: L4
    words: 300
    include:
      - common failure modes
      - error messages and their meaning
      - recovery steps
    format: problem/solution pairs
```

#### Example Archetype: Troubleshooting Guide

```yaml
archetype: troubleshooting-guide
audience: Developer encountering an error or unexpected behavior
total_words: 2000
source_budget_ratio: 3.5 # source tokens ≈ 3.5× target words — needs error messages, configs, exact behavior

sections:
  - name: Quick Diagnosis
    level: L3
    words: 300
    format: decision tree or table
    include:
      - symptom to cause mapping
      - "if you see X, go to section Y"

  - name: Problem Entries
    level: L4
    words: 1500
    repeat: true # one entry per known problem
    per_entry:
      - symptom: what the user observes
      - cause: why this happens (include relevant constraint/invariant)
      - fix: exact steps to resolve
      - prevention: how to avoid this in the future

  - name: Getting Help
    level: L1
    words: 200
    include:
      - escalation paths
      - what information to collect before asking for help
      - relevant log locations and diagnostic commands
```

### 5. Style Guide

A hand-authored reference for voice, tone, and formatting conventions. Separate from archetypes — archetypes define structure, the style guide defines language. Included in every generation prompt alongside the glossary.

The style guide covers:

- **Voice and tone** — e.g., direct, second-person for how-to guides; third-person technical for architecture docs
- **Formatting rules** — heading levels, code block conventions, list usage, emphasis patterns
- **Conventions** — how to reference file paths, how to format commands, how to cite source locations
- **Anti-patterns** — what to avoid (e.g., no marketing language, no "simply" or "just," no unexplained acronyms)

Maintained as a markdown file (`docs/_docgen/style-guide.md`). Versioned with the codebase. Updated by hand when documentation standards evolve.

---

## Rebuild Script

A single entry point (`scripts/rebuild-doc-index.py`) that regenerates the repository index and glossary from current repo state.

### What It Does

1. **Walk the repository** — enumerate all files, apply Tier 4 exclusion rules, assign Tier 1/2/3 based on `tier-rules.yaml`
2. **Parse metadata** — extract YAML frontmatter, parse JSON configs, read file headers
3. **Estimate tokens** — calculate estimated token count per file (word count × 1.3 as a heuristic, or use tiktoken for precision)
4. **Detect edges** — parse `depends_on`, `touches`, markdown references, import statements, hook configurations
5. **Populate SQLite** — write nodes, edges tables
6. **Generate glossary** — parse Tier 1 files for component definitions, apply rule-based templates per entity type, write glossary tables and export `glossary.yaml`

### Invocation

```bash
# Full rebuild
python scripts/rebuild-doc-index.py

# Incremental (only files modified since last run)
python scripts/rebuild-doc-index.py --incremental

# Full rebuild with verbose output showing what was indexed
python scripts/rebuild-doc-index.py --verbose
```

### Output

- `docs/_docgen/repo-index.db` — SQLite database
- `docs/_docgen/glossary.yaml` — canonical glossary
- `docs/_docgen/rebuild.log` — what changed since last run

---

## Document Generation Workflow

### Step 1: Rebuild Index (On Command)

```bash
python scripts/rebuild-doc-index.py
```

Run when you're ready to generate documentation. Not automated, not on CI, not on every commit. Your decision when to run it.

### Step 2: Request a Document

Specify a topic and an archetype:

```
Topic: "the review loop and subagent orchestration"
Archetype: system-architecture-reference
```

### Step 3: Topic Expansion and Budget Check

The system queries the repository index to find all files relevant to the requested topic:

1. **Identify seed files** — glossary lookup and keyword matching against node names and types to find directly relevant files
2. **Expand via depth-capped graph traversal** — follow edges from seed files to find related components, with traversal depth limits per edge type to prevent topic explosion:
   - `depends_on`: depth 1 (direct dependencies only — the dependency's dependencies are a different topic)
   - `touches`: depth 1 (advisory metadata, not structural — one hop is sufficient)
   - `references`: depth 2 (the doc and what it points to, capturing referenced definitions)
   - `imports`: depth 1-2 (the module and its direct dependencies)
   - `intercepts`: depth 1 (the hook and the tool type it intercepts)
   - `enforces`: depth 1 (the hook and the constraint it enforces)
   - `defines`: depth 1 (the file and the term it defines)
3. **Sum token estimates** — total the `token_estimate` for all relevant files across all tiers
4. **Compare to budget** — the archetype's `source_budget_ratio` multiplied by `total_words` gives the token budget for source material

Depth caps prevent common traversal explosions: orchestrator nodes that connect to everything, shared utility modules that fan out across the codebase, index.ts barrel files that import every module in a directory, and hooks/settings that touch all tool types. Without depth caps, nearly every topic would exceed the budget — not because the topic is genuinely broad, but because the traversal is undisciplined.

If traversal results still seem too broad after depth caps (e.g., a seed file is the orchestrator itself), the system can be tuned by adjusting depth limits per edge type in configuration rather than requiring code changes.

#### Traversal Observability

Every topic expansion produces a traversal log recording the full path from seed identification to final file set. This log is essential for human reviewers who notice gaps in generated documents — it answers the question "was the file never reached, or was it reached but the model didn't use it well?"

The traversal log records:

- **Seed files** — which files were identified by glossary lookup / keyword matching, and why (which terms or keywords matched)
- **Expansion path** — for each file added via graph traversal, which seed file it was reached from, via which edge type, at what depth
- **Final file set** — the complete list of files included in the topic, with tier classification and token estimate per file
- **Budget comparison** — total tokens vs. budget, and whether a split was triggered

The log is written alongside the generated document metadata. It is not included in the generation prompt — it exists purely for post-generation diagnostics. When a reviewer identifies missing coverage in a generated document, the traversal log distinguishes between an edge detection issue (file never reached — fix the edge detector or add a missing edge) and a generation quality issue (file was in the source set but the model didn't incorporate it — adjust the archetype or prompt).

### Step 4: Budget Response

#### If source material fits within budget:

Proceed to generation. All relevant files across all tiers are included.

#### If source material exceeds budget:

**The system narrows breadth, never depth.** It uses four deterministic split strategies, applied in priority order, to propose subtopics that match how humans naturally decompose systems:

1. **Component boundary split** — Tier 1 definitional files anchor natural clusters. The reviewer agent definition, the fixer agent definition, and the review-loop skill form one cluster. Hook scripts and their configurations form another. Each Tier 1 node and its immediate graph neighborhood is a candidate subtopic.
2. **Edge-type family split** — Different edge types represent different concerns. "Review loop protocol" is primarily `references` and `defines` edges between review-related files. "Hook enforcement" is primarily `intercepts` and `enforces` edges between hooks and constraints. Grouping by dominant edge type produces coherent subtopics.
3. **Directory boundary split** — Files in the same directory are likely the same concern. `.claude/hooks/` is a natural cluster. `.claude/skills/epic-orchestrator/` is a natural cluster. Directory co-location correlates strongly with topical coherence.
4. **Lifecycle phase split** — Workflow phases (planning, implementation, review, completion) are natural topic boundaries. Files primarily referenced during Phase 1 form one cluster; files primarily referenced during Phase 2.4 (review loop) form another.

The system applies the highest-priority strategy that produces subtopics fitting within the token budget. If component boundaries produce clusters that are still too large, it falls back to edge-type or directory splits within those clusters.

Example split proposal:

```
Topic "review loop and subagent orchestration" requires ~18,000 tokens
of source material. Budget for a 2,400-word architecture reference is
~6,000 tokens (2,400 × 2.5 source_budget_ratio).

The system has identified 3 subtopics that fit within budget:

1. "Review Loop Protocol" (est. 5,500 tokens)
   - review-loop.md, SKILL.md Phase 2.4 section
   - Covers: round mechanics, exit conditions, escalation

2. "Reviewer and Fixer Agents" (est. 4,800 tokens)
   - epic-reviewer.md, epic-fixer.md, findings format
   - Covers: spawning, context isolation, tool restrictions, file-based communication

3. "Hook Enforcement During Implementation" (est. 5,200 tokens)
   - All hook scripts, settings.json, hook README
   - Covers: PreToolUse/PostToolUse/Stop lifecycle, self-correcting patterns

Options:
  A) Generate 1 document covering subtopics 1-2 (fits budget as a single doc)
  B) Generate 3 separate documents, one per subtopic
```

#### Interaction Model

The system computes the maximum breadth that fits the token budget and presents the user with a choice: produce fewer documents each covering more subtopics, or produce more documents each covering fewer subtopics. The total breadth is fixed by the budget — depth is never reduced.

If the user wants the original broader scope at lower depth, that is a different request. The system does not offer a "reduce depth" path. The user must reprompt with either a different archetype (one with a higher source budget ratio) or explicit instructions to override depth constraints. The system's default behavior is always: narrow breadth, preserve depth.

Key behaviors of the split proposal:

- **Every subtopic includes all tiers** — definitional files, structural files, and implementation files relevant to that subtopic
- **Splits follow graph cluster boundaries** — files with dense mutual connections stay together, splits happen at sparse connection points
- **No file is dropped** — every relevant file appears in at least one subtopic
- **Overlap is acceptable** — a file relevant to two subtopics appears in both (e.g., SKILL.md might be referenced in multiple splits for different sections)
- **Breadth is fixed, depth is non-negotiable** — the user chooses how to distribute the computed breadth across documents, not whether to reduce it

### Step 5: Generation

For each document, a single LLM generation pass receives:

1. **The archetype** — structural template with section definitions, abstraction levels, word budgets
2. **The glossary** — terminology constraints
3. **The style guide** — voice, tone, formatting rules
4. **The raw source files** — full content of all relevant files for this topic, uncompressed, unsummarized

The generation prompt structure:

```
[Style Guide]
[Glossary as terminology constraint]
[Archetype with section structure and rules]

Source material:
[Full content of each relevant file, clearly labeled with file path]

Task: Write a [archetype type] about [topic] following the archetype
structure exactly. Use terminology from the glossary. Follow the style
guide. Stay within word budgets per section. Respect abstraction level
rules per section.
```

The document is generated in a single shot. No multi-pass drafting. No merge steps. No smoothing. One pass, full quality, constrained by archetype and glossary.

Every generated document includes a metadata block in YAML frontmatter that records the exact inputs that produced it. This enables staleness detection and full auditability.

```yaml
---
generated_by: doc-gen-system
generated_at: 2026-02-10T14:30:00Z
index_rebuilt_at: 2026-02-10T14:25:00Z
archetype: system-architecture-reference
archetype_hash: b4c2a1f8
topic: "review loop protocol"
source_files:
  - path: .claude/skills/epic-orchestrator/review-loop.md
    hash: a3f2b8c1
  - path: .claude/agents/epic-reviewer.md
    hash: 9d1e4f7a
  - path: .claude/agents/epic-fixer.md
    hash: 5c8b2d3e
glossary_hash: f7a1b3c2
style_guide_hash: e2d4c6a8
---
```

A staleness check script (`scripts/check-staleness.py`) compares the source file hashes in each generated document's metadata against current file hashes in the repository. If any source file, the archetype, the glossary, or the style guide has changed since generation, the document is flagged as potentially stale. This runs in milliseconds across all generated documents and produces a report showing which documents need regeneration and why.

### Step 6: Post-Generation Validation

A deterministic validator runs automated checks on the generated document. The validator performs zero rewriting — it produces a pass/fail report that accompanies the document for human review. All checks are script-based (regex, glossary matching, heading parsing), not LLM-based, ensuring consistent and reproducible results.

Checks performed:

- **Glossary compliance** — scan for any forbidden synonyms from `glossary_forbidden` table. Flag any terms that appear to be new concepts not present in the glossary (candidate additions).
- **Allowed variant discipline** — verify that allowed variants only appear after their canonical form has been introduced in the same document.
- **Heading structure** — verify section names and hierarchy match the archetype definition. Flag missing sections or extra sections.
- **Abstraction violations** — detect content at the wrong level. Regex checks for file paths in L1 sections, exact commands in L2 sections, architectural rationale in L4-only how-to steps. Each archetype's include/exclude rules translate to detection patterns.
- **Word budget compliance** — count words per section and flag sections that exceed their budget by more than 15%.

**Validator scope:** The validator catches concrete, pattern-matchable violations — file paths where they don't belong, forbidden glossary terms, missing sections, word count overruns. It does not catch conceptual-level violations such as L3 choreography content appearing in an L2 Architecture section, or L2 component descriptions leaking into L3 flow sections. These softer violations require human judgment during review. The archetype's include/exclude rules serve as the reviewer's checklist for what to look for. Introducing LLM-based validation to catch conceptual violations would break the deterministic validation principle and is not planned — the practical impact of minor abstraction-level leakage does not justify the complexity.

The validator outputs a report alongside the generated document:

```
VALIDATION REPORT: review-loop-architecture.md

✅ Glossary compliance: No forbidden synonyms found
⚠️ Glossary gap: "findings convergence" used but not in glossary (line 47)
   → Candidate for glossary addition
✅ Heading structure: Matches archetype
⚠️ Abstraction violation: File path ".claude/agents/epic-reviewer.md"
   found in L1 Overview section (line 12)
✅ Word budgets: All sections within tolerance
```

The validator is a quality signal, not a gate. Documents with warnings can still be reviewed and published — the report highlights areas to check during human review.

### Step 7: Human Review

The generated document is output as a markdown file. You review it, edit if needed, and commit to the repo. The system does not auto-commit generated documentation.

---

## What This System Does NOT Do

- **No intermediate summarization.** Source files are read raw. No extraction passes produce compressed representations. The model reads the actual source material.
- **No knowledge substrate or graph database.** The SQLite index is a structural map with token estimates, not a content store. It tells the system _which_ files to read, not _what_ they say.
- **No multi-pass generation.** Each document is a single generation pass. No drafting, no smoothing, no stitching, no merge logic.
- **No depth reduction.** The system never drops files from a topic to fit a budget. It splits the topic into narrower subtopics, each covered at full depth.
- **No continuous rebuilds.** The index and glossary are rebuilt on command, when you decide you need fresh data.
- **No infrastructure to operate.** SQLite file, Python scripts, markdown configs. No servers, no databases to run, no services to maintain.
- **No LLM in the pre-generation pipeline.** The repository index, glossary, and all validation are fully deterministic. The only LLM call is the document generation itself. This makes the entire pipeline reproducible and debuggable.

---

## File Layout

```
docs/_docgen/
  repo-index.db              # SQLite database (rebuilt on command)
  glossary.yaml              # Canonical glossary (rebuilt on command)
  tier-rules.yaml            # Glob patterns for tier classification
  style-guide.md             # Voice, tone, formatting conventions (hand-authored)
  rebuild.log                # Last rebuild output
  archetypes/
    system-architecture.yaml # Archetype: reference documentation
    blog-post.yaml           # Archetype: blog post
    how-to-guide.yaml        # Archetype: operations/how-to
    troubleshooting.yaml     # Archetype: troubleshooting guide
    ...                      # Additional archetypes as needed

scripts/
  rebuild-doc-index.py       # Main rebuild script
  validate-doc.py            # Post-generation deterministic validator
  check-staleness.py         # Compare generated doc metadata against current file hashes
  lib/
    tier_classifier.py       # Applies tier-rules.yaml to file paths
    metadata_parser.py       # Extracts frontmatter, parses configs
    edge_detector.py         # Identifies relationships between files
    token_estimator.py       # Estimates token count per file
    glossary_generator.py    # Rule-based template glossary generation
    graph_queries.py         # Topic expansion, clustering, budget checks
    doc_validator.py         # Glossary compliance, heading structure, abstraction violation checks
```

---

## Maintenance Burden

| Component                 | Created                | Updated                              | Effort                                                 |
| ------------------------- | ---------------------- | ------------------------------------ | ------------------------------------------------------ |
| Repository index          | Script on command      | Script on command                    | Zero — fully automated                                 |
| Glossary                  | Script on command      | Script on command                    | Review diff after rebuild (~5 min)                     |
| Post-generation validator | Once at setup          | When archetypes change               | Update detection patterns to match new archetype rules |
| Tier rules                | Once at setup          | When new directory conventions added | One line per new convention                            |
| Style guide               | Once at setup          | When standards evolve                | Occasional hand edits                                  |
| Archetypes                | Once per document type | When you learn what works better     | Hand edits based on output quality                     |

The only ongoing human effort is reviewing glossary diffs after rebuilds and iterating on archetypes based on output quality. Everything else is automated and deterministic.

---

## Decided: Cross-Document Framing Consistency

**Decision: Out of scope for this system. Not a problem to solve here.**

The glossary ensures terminology consistency across documents. Factual consistency — whether two documents covering overlapping topics describe behavioral mechanics with identical framing — is a different concern. Two documents generated independently (whether from a split or from separate prompts days apart) will both be factually correct and glossary-compliant, but may describe the same mechanism with different emphasis or sentence structure.

This is acceptable. Both documents being correct matters more than both documents using identical framing. The generation system's contract is: each document is correct, well-structured, and terminologically consistent with the glossary. Whether N documents _together_ read as if written by the same author with identical framing is an editorial concern, not a generation concern.

Attempting to solve this inside the generation system would require the generator to be aware of previously generated documents, which breaks the clean property that each generation pass is stateless — its inputs are the archetype, glossary, style guide, and source files. Introducing cross-document awareness would add state, complexity, and coupling for a problem that may never materialize at meaningful severity.

If framing inconsistency across documents becomes a real problem at scale, the appropriate response is a separate editorial review pipeline that operates on finished documents as input — not modifications to this generation system. That editorial pipeline would be its own design with its own concerns, independent of document generation.

---

## Open Questions

1. **Source budget ratio calibration.** The per-archetype `source_budget_ratio` values (1.5× for blog, 2.5× for architecture, 3.0× for how-to, 3.5× for troubleshooting) are initial estimates. They need empirical validation by generating documents and observing where source material is insufficient or excessive. Expect to adjust these after the first 5-10 documents per archetype.

2. **Traversal depth cap tuning.** The depth caps per edge type (imports at 1-2, references at 2, etc.) are starting values. Real traversal on the full 1,100-file repo may reveal that some edge types need tighter caps or that specific high-connectivity nodes (e.g., the orchestrator SKILL.md) need special handling. Monitor topic expansion results and adjust.

3. **Archetype iteration.** The example archetypes above are starting points. They need to be tested against real generation output and refined based on what produces the best results. The archetype is the primary quality lever — investing in getting them right has the highest ROI of any component.

4. **Incremental glossary updates.** The `--incremental` flag on the rebuild script needs to handle deleted files and renamed components gracefully, not just new and modified files. Edge cases around component renames (old term still in glossary, new term needs to be added, old term needs to be removed) need careful handling.

5. **Relevance scoring (v2 candidate).** The current design uses depth caps alone to control traversal expansion. If depth caps prove insufficient for high-connectivity repos — producing too many files even at depth 1 — a relevance scoring layer (term overlap, node type priors, directory proximity) could filter nodes before budget comparison. Deferred until evidence from real traversal behavior shows depth caps are not enough.
