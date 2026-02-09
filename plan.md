# Tech Writing Pipeline — Implementation Plan

## Overview

A standalone multi-agent documentation pipeline that lives in the project but is self-contained and exportable. The Manager Agent orchestrates a sequence of subagents (Tech Writer, Editor, SME, Designer, QA Reader) that communicate exclusively through markdown files on disk — every draft, review, and set of notes is a versioned artifact in git.

## Directory Structure

```
docs/writing-pipeline/
├── README.md                          # How to use the pipeline
├── config.yaml                        # Pipeline configuration
├── guides/
│   ├── style-guide.md                 # Editor's bible — tone, formatting, structure rules
│   ├── diagram-guide.md               # Designer standards — mermaid conventions, decomposition rules
│   └── review-taxonomy.md             # MUST/SHOULD/MINOR definitions and handling rules
├── agents/
│   ├── manager.md                     # Orchestrator — state machine, routing, convergence limits
│   ├── tech-writer.md                 # Research, outline, draft production
│   ├── editor.md                      # Style enforcement, structure validation, inline edits
│   ├── sme.md                         # Technical accuracy, claims validation, systems thinking
│   ├── designer.md                    # Mermaid diagram creation, decomposition
│   └── qa-reader.md                   # Cold-read comprehension testing
├── tasks/
│   ├── research-and-outline.md        # Tech Writer task: research + produce outline
│   ├── outline-review.md              # Editor task: validate outline
│   ├── draft-writing.md               # Tech Writer task: produce draft from outline + notes
│   ├── editorial-review.md            # Editor task: review draft against style guide
│   ├── sme-review.md                  # SME task: technical accuracy review
│   ├── diagram-creation.md            # Designer task: create mermaid diagrams
│   ├── qa-read.md                     # QA task: cold-read comprehension test
│   └── final-review.md               # Editor task: final comprehensive review
└── templates/
    ├── state-file.md                  # Template for pipeline state tracking
    ├── outline.md                     # Template for outline artifact
    ├── review-notes.md                # Template for review feedback
    └── draft.md                       # Template for draft artifact
```

Artifacts produced during a run go into a project-specific workspace:

```
docs/writing-pipeline/projects/{project-slug}/
├── state.yaml                         # Pipeline state (current step, pass/fail gates)
├── 00-request.md                      # Original task/request
├── 01-research.md                     # Tech Writer research output
├── 02-outline.md                      # Tech Writer outline
├── 03-outline-review.md               # Editor notes on outline
├── 04-draft-v1.md                     # First Draft
├── 05-editorial-review-v1.md          # Editor notes on Draft v1
├── 06-draft-v1r1.md                   # Draft v1 revision 1 (if editor had MUST items)
├── 07-sme-review-v1.md                # SME technical review
├── 08-draft-v2.md                     # Second Draft (with diagram suggestions)
├── 09-editorial-review-v2.md          # Editor notes on Draft v2
├── 10-diagrams-v1.md                  # Designer mermaid diagrams
├── 11-sme-review-v2.md                # SME review of Draft v2 + diagrams
├── 12-draft-v3.md                     # Third Draft
├── 13-editorial-review-v3.md          # Editor notes on Draft v3
├── 14-diagrams-v2.md                  # Updated diagrams (from SME feedback)
├── 15-qa-read-v1.md                   # QA Reader notes
├── 16-draft-v3r1.md                   # Draft v3 revision 1
├── 17-qa-read-v2.md                   # QA Reader second pass
├── 18-draft-v3r2.md                   # Draft v3 revision 2 (if needed)
├── 19-final-review.md                 # Editor final review notes
├── 20-final.md                        # FINAL output
└── 21-final-with-diagrams.md          # Final output with mermaid diagrams inline
```

## Pipeline Flow (Compressed)

```
Phase 1: Foundation
  Step 1: Tech Writer → Research + Outline           → 02-outline.md
  Step 2: Editor → Outline Review                    → 03-outline-review.md

Phase 2: First Draft
  Step 3: Tech Writer → Draft v1 (from outline + editor notes)  → 04-draft-v1.md
  Step 4: Editor → Review Draft v1                              → 05-editorial-review-v1.md
          IF has MUST-CHANGE items:
            Step 4b: Tech Writer → Revise                       → 06-draft-v1r1.md
            (Editor makes own inline fixes on 4b output — no bounce-back)

Phase 3: Technical Depth
  Step 5: SME → Technical Review (fresh research)    → 07-sme-review-v1.md
  Step 6: Tech Writer → Draft v2 + Diagram Suggestions → 08-draft-v2.md

Phase 4: Visual Design + Technical Validation (PARALLEL)
  Step 7a: Editor → Review Draft v2                  → 09-editorial-review-v2.md
  Step 7b: Designer → Create Diagrams                → 10-diagrams-v1.md
  (7a and 7b run in parallel — no dependency between them)

  Step 8: SME → Review Draft v2 + Diagrams (fresh)   → 11-sme-review-v2.md

Phase 5: Polish
  Step 9:  Tech Writer → Draft v3 (from SME + Editor notes)  → 12-draft-v3.md
  Step 10: Editor → Review Draft v3                           → 13-editorial-review-v3.md
           Designer → Update Diagrams (from SME feedback)     → 14-diagrams-v2.md
           (parallel — editor reviews text, designer updates visuals)

Phase 6: QA Validation
  Step 11: QA Reader → Cold Read                     → 15-qa-read-v1.md
           IF has confusion points:
             Step 11b: Tech Writer → Revise           → 16-draft-v3r1.md
             Step 11c: QA Reader → Second Pass        → 17-qa-read-v2.md
             IF still has issues:
               Step 11d: Tech Writer → Final Revise   → 18-draft-v3r2.md

Phase 7: Final
  Step 12: Editor → Final comprehensive review + inline edits  → 19-final-review.md + 20-final.md
  Step 13: Assemble final with diagrams inline                 → 21-final-with-diagrams.md
  Step 14: Present to user
```

**Total subagent invocations (happy path):** ~12
**With revision loops (worst case):** ~16
**Convergence limit:** Max 2 revision rounds per gate. If unresolved, escalate to user.

## Agent Definitions

Each agent is a markdown file defining: role, persona, loaded context (guides to read), input contract, output contract, and task instructions. They are designed to be spawned as `general-purpose` subagents via the Task tool.

### Manager Agent (`manager.md`)

- **Role:** Pipeline orchestrator and state machine
- **Responsibilities:** Read state.yaml, determine next step, spawn correct subagent with correct inputs, read output, decide pass/fail at gates, advance or loop
- **Key rules:** Max 2 revision loops per gate. Parallel steps where possible. All communication via files.
- **NOT a subagent** — this is the instruction set the main Claude agent follows

### Tech Writer (`tech-writer.md`)

- **Loaded context:** style-guide.md, review-taxonomy.md
- **Tasks:** Research, Outline, Draft, Revise
- **Key constraint:** Must read and address all MUST-CHANGE items. Must produce diagram suggestions in Draft v2+.

### Editor (`editor.md`)

- **Loaded context:** style-guide.md, review-taxonomy.md
- **Tasks:** Outline Review, Draft Review, Final Review
- **Key behavior:** Cross-references sources in outline. Categorizes feedback as MUST/SHOULD/MINOR. On second pass of same gate, makes inline edits directly instead of bouncing back.

### SME (`sme.md`)

- **Loaded context:** review-taxonomy.md (loads style-guide only for reference, not enforcement)
- **Tasks:** Technical review with independent research
- **Key behavior:** Does fresh research from original goal — never just reads the draft. Conservative about claims. Flags hyperbole, unsubstantiated claims, overstatements. Reviews diagrams for accuracy.

### Designer (`designer.md`)

- **Loaded context:** diagram-guide.md
- **Tasks:** Create mermaid diagrams from suggestions, update from SME feedback
- **Key rules:** Max 7-9 nodes per diagram. Auto-decompose large concepts into overview + detail diagrams. Elegant, not elaborate.

### QA Reader (`qa-reader.md`)

- **No loaded context** (intentionally blank — this is the "knows nothing" reader)
- **Tasks:** Cold read, document confusion points
- **Output:** List of confusion points with location, what's confusing, and suggested fix

## State File Format (`state.yaml`)

```yaml
project: "auto-epic-user-guide"
task: "Write a User Guide for the Auto Epic Command"
status: in-progress # pending | in-progress | completed | blocked
started: 2026-02-08T10:00:00Z
current_phase: 3
current_step: 5
current_agent: sme # tech-writer | editor | sme | designer | qa-reader

steps:
  1-research-outline:
    status: completed
    agent: tech-writer
    output: 02-outline.md
  2-outline-review:
    status: completed
    agent: editor
    output: 03-outline-review.md
    gate: passed # passed | must-revise | blocked
  3-draft-v1:
    status: completed
    agent: tech-writer
    output: 04-draft-v1.md
  4-editorial-review-v1:
    status: completed
    agent: editor
    output: 05-editorial-review-v1.md
    gate: must-revise
    revision_round: 1
  4b-draft-v1r1:
    status: completed
    agent: tech-writer
    output: 06-draft-v1r1.md
  5-sme-review:
    status: in-progress
    agent: sme
    output: null
  # ... etc
```

## Guides to Create

### 1. Style Guide (`style-guide.md`)

The linchpin. Covers:

- Voice and tone (second person, active voice, present tense for instructions)
- Structure rules (task-based sections lead, reference follows; every section starts with "what you'll do")
- Formatting conventions (heading levels, code blocks, callouts, list vs prose thresholds)
- Naming conventions (commands, UI elements, config values)
- Length constraints (max paragraph length, max section before splitting)
- Prohibited patterns (marketing language, hedging without purpose, passive voice for instructions)

### 2. Diagram Guide (`diagram-guide.md`)

- Max 7-9 nodes per diagram
- Decomposition rules (overview → detail → specifics)
- Mermaid syntax standards (which diagram types for which concepts)
- Caption and labeling requirements
- Color/styling conventions
- When a diagram is required vs optional

### 3. Review Taxonomy (`review-taxonomy.md`)

- **MUST CHANGE:** Factually wrong, misleading, blocks comprehension, violates style guide
- **SHOULD CHANGE:** Improves clarity significantly, fixes structural issues, addresses ambiguity
- **MINOR:** Polish, word choice, optional improvements
- Handling rules: Tech Writer MUST address all MUST items. SHOULD address SHOULD items (with justification if skipping). MAY address MINOR items.

## How It Runs

1. User invokes the pipeline command: `/doc-pipeline "Write a User Guide for the Auto Epic Command"`
2. Manager reads `manager.md`, creates project directory, initializes `state.yaml`
3. Manager spawns Tech Writer subagent (Task tool, `subagent_type: "general-purpose"`) with prompt that includes: the task instructions file path, the style guide path, the research goal, and the output file path
4. Tech Writer reads its task file, reads style guide, does research (reads codebase, etc.), writes outline to disk
5. Manager reads outline, spawns Editor subagent with outline path + editor task file path
6. Editor reads outline, reads style guide, produces review notes to disk
7. Manager reads review notes, checks gate (any MUST items?), routes accordingly
8. ...continues through pipeline...
9. Final output presented to user

**Key: Each subagent gets a fresh context window.** They read files from disk, produce files to disk. No conversation state is passed between agents.

## Wiring

- **Slash command:** `.claude/commands/doc-pipeline.md` — entry point that reads `docs/writing-pipeline/agents/manager.md`
- **No custom subagent types needed** — all agents use `general-purpose` subagent_type with detailed prompts that point to the right files
- **Git-friendly:** All artifacts are markdown, all state is YAML, everything is committed as the pipeline runs
- **Hook enforcement:** Two hooks provide four deterministic guardrails:
  - `.claude/hooks/pipeline-guard.cjs` (PreToolUse on Edit|Write):
    1. **Infrastructure protection** — denies writes to `guides/`, `agents/`, `templates/`, `config.yaml`, `README.md` (always active, not just during runs)
    2. **Artifact immutability** — denies overwrites of previous pipeline artifacts by reading `state.yaml` to determine the current step (active during runs)
    3. **Naming validation** — warns when a write targets a project directory with a filename that doesn't match expected artifact patterns
    4. **Guide loading verification** — denies artifact writes if the agent has not actually Read its required guides in this session (uses breadcrumbs from the read tracker). The Manager sets `current_agent` in `state.yaml`; the guard checks which guides that agent requires.
  - `.claude/hooks/pipeline-read-tracker.cjs` (PostToolUse on Read):
    - Records timestamped breadcrumbs in `.claude/.pipeline-reads.json` when pipeline guide files are Read. Breadcrumbs expire after 2 hours.

## Implementation Order

1. **Create directory structure** — `docs/writing-pipeline/` with all subdirectories
2. **Write `review-taxonomy.md`** — simplest guide, needed by multiple agents
3. **Write `style-guide.md`** — the linchpin, needed before editor can function
4. **Write `diagram-guide.md`** — designer needs this
5. **Write agent definitions** — manager, tech-writer, editor, sme, designer, qa-reader
6. **Write task definitions** — the specific instructions for each step
7. **Write templates** — state file, outline, review notes, draft
8. **Write `config.yaml`** — pipeline configuration
9. **Write slash command** — `.claude/commands/doc-pipeline.md`
10. **Write `README.md`** — usage documentation
11. **Test with a real document** — use it to write something and iterate

## Design Decisions

**Why standalone (not BMAD workflows)?**

- Exportable to any project without BMAD dependency
- Simpler execution model (no XML workflow engine, no menu system)
- Manager is just instructions the main agent follows, not a conversational agent with menus

**Why `general-purpose` subagents?**

- No need for custom subagent types — the prompt + file references give each agent everything it needs
- Keeps the system portable (works in any Claude Code project)

**Why every version is a separate file?**

- Full observability — diff any two versions to see what changed
- Replay capability — identify exactly which agent introduced a problem
- No overwriting — earlier work is never lost
- Git history shows the pipeline progression

**Why convergence limits?**

- Max 2 revision rounds per gate prevents infinite loops
- If Editor and Tech Writer can't converge in 2 rounds, escalate to user with the specific disagreement
- QA Reader gets max 2 passes (same principle)

**Why parallel steps?**

- Editor reviewing text and Designer creating diagrams have no dependency
- Editor reviewing text and Designer updating diagrams (from SME notes) have no dependency
- Saves ~2 subagent invocations worth of wall-clock time
