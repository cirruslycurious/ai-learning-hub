---
id: "3.1.4"
title: "Deduplication Scan Agent & Pipeline Integration"
status: ready-for-dev
depends_on:
  - 3-1-3-handler-test-consolidation
touches:
  - .claude/agents/epic-dedup-scanner.md (new)
  - .claude/agents/epic-dedup-fixer.md (new)
  - .claude/skills/epic-orchestrator/dedup-scan-loop.md (new)
  - .claude/skills/epic-orchestrator/SKILL.md
risk: medium
---

# Story 3.1.4: Deduplication Scan Agent & Pipeline Integration

Status: ready-for-dev

## Story

As the epic orchestrator,
I want a deduplication scan step in the pipeline that catches cross-handler code duplication before code reaches the adversarial reviewer,
so that DRY violations are caught and fixed automatically, and the reviewer can focus on correctness and security.

## Acceptance Criteria

| #   | Given                                    | When                                                                                       | Then                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | New agent definition created             | `.claude/agents/epic-dedup-scanner.md` exists                                              | Agent has read-only tools (Read, Glob, Grep, Bash, Write), fresh context, scoped to cross-handler duplication detection                                                                                                                                                   |
| AC2 | New fixer agent created                  | `.claude/agents/epic-dedup-fixer.md` exists                                                | Agent has full edit tools (Read, Glob, Grep, Bash, Write, Edit), guided by dedup findings document                                                                                                                                                                        |
| AC3 | Orchestrator pipeline updated            | Step 2.3b "Dedup Scan Loop" added between quality gates (2.2) and adversarial review (2.4) | Dedup scan runs with max 2 rounds; gate requires 0 Important+ findings before proceeding to reviewer                                                                                                                                                                      |
| AC4 | Supporting protocol doc created          | `.claude/skills/epic-orchestrator/dedup-scan-loop.md` exists                               | Documents the 2-round loop, scanner prompt template, fixer prompt template, gate criteria, escalation path, and dry-run behavior                                                                                                                                          |
| AC5 | Scanner checks for specific patterns     | When scanner runs                                                                          | It reads ALL handler files in the same domain (e.g., all `backend/functions/saves-*/handler.ts`), not just the branch diff, and flags: duplicate schema definitions, duplicate constants, duplicate helper functions, code that exists in shared packages but is defined locally |
| AC6 | Scanner output follows structured format | When scanner writes findings                                                               | Output uses `Critical/Important/Minor` format identical to the reviewer's findings format so the orchestrator parses it the same way                                                                                                                                      |
| AC7 | Pipeline gate enforced                   | When dedup scan has Important+ findings after 2 rounds                                     | Orchestrator escalates to human with same option set as reviewer round 3 escalation (fix manually / accept / override limit)                                                                                                                                              |
| AC8 | Reviewer remains unchanged               | After pipeline integration                                                                 | `epic-reviewer.md` agent definition is NOT modified; reviewer continues to operate on branch diff with fresh context                                                                                                                                                      |

## Tasks / Subtasks

- [ ] Task 1: Create `epic-dedup-scanner` agent definition (AC: #1, #5, #6)
  - [ ] 1.1 Create `.claude/agents/epic-dedup-scanner.md`
  - [ ] 1.2 Agent frontmatter: name, description, tools (Read, Glob, Grep, Bash, Write), disallowedTools (Edit, Task)
  - [ ] 1.3 Define scanner methodology:
    - Receive domain pattern, branch name, base branch, story file, output path
    - Discover all handler files in the domain (e.g., glob `backend/functions/saves*/handler.ts`)
    - Read ALL handler files (not just diff) to compare cross-handler patterns
    - Read shared package exports (`@ai-learning-hub/validation`, `db`, `events`, `types`, `logging`, `middleware`) to check what's already centralized
    - Flag: local definitions that duplicate shared exports, identical code blocks across handlers, constants that should be shared
    - **Bash is read-only/analysis-only** (e.g., grep, diff, npm run type-check). Do not run commands that modify the repo, mutate state, or push.
  - [ ] 1.4 Define severity categories:
    - **Critical:** Local copy of shared export with semantic divergence (e.g., `toPublicSave` that behaves differently from shared version)
    - **Important:** Identical code block in 2+ handlers that should be in a shared package; local schema/constant that already exists in shared package
    - **Minor:** Similar (not identical) patterns across handlers; style inconsistencies
  - [ ] 1.5 Define output format: same markdown structure as `epic-reviewer.md` findings (Story ID, Round, Critical/Important/Minor sections, Summary with counts and recommendation)

- [ ] Task 2: Create `epic-dedup-fixer` agent definition (AC: #2)
  - [ ] 2.1 Create `.claude/agents/epic-dedup-fixer.md`
  - [ ] 2.2 Agent frontmatter: name, description, tools (Read, Glob, Grep, Bash, Write, Edit), disallowedTools (Task)
  - [ ] 2.3 Define fixer methodology:
    - Read findings document
    - For Important+: extract duplicated code to appropriate shared package, update all handler imports, run tests
    - For duplicate schemas: move to `@ai-learning-hub/validation`
    - For duplicate constants: move to `@ai-learning-hub/db` or `@ai-learning-hub/events`
    - For duplicate helpers: prefer existing shared packages by domain (DynamoDB helpers → `@ai-learning-hub/db`, event helpers → `@ai-learning-hub/events`, validation helpers → `@ai-learning-hub/validation`). If no clear home exists, document in the findings and leave for human decision rather than creating a new package.
    - Stage and commit fixes. **Commit only on current branch. Do NOT push. Do NOT switch branches.** Same branch locality rules as the review-loop fixer.
    - Report which findings were addressed

- [ ] Task 3: Create pipeline protocol document (AC: #4)
  - [ ] 3.1 Create `.claude/skills/epic-orchestrator/dedup-scan-loop.md`
  - [ ] 3.2 Document protocol overview:
    - Max rounds: 2 (scan → fix → scan → gate)
    - Clean state: 0 MUST-FIX findings (Critical + Important)
    - Exit conditions: clean state OR max rounds exceeded
  - [ ] 3.3 Document Step A: Spawn scanner subagent
    - Task tool with `subagent_type: "epic-dedup-scanner"`
    - Prompt template including: story ID, domain pattern, branch, base branch, story file path, round, output path
    - Domain pattern derivation from `story.touches` (e.g., touches `backend/functions/saves-update/*` → domain = `backend/functions/saves*/handler.ts`)
    - **Skip rule:** If `touches` contains no paths under `backend/functions/`, skip the dedup scan loop entirely (proceed directly to 2.4). Stories that only touch shared packages have no handler domain to scan.
    - **Single primary domain:** If `touches` includes handlers from multiple disjoint domains (e.g., both `saves*` and `auth*`), derive the primary domain from the domain with the most touched files. Do not scan across unrelated domains.
  - [ ] 3.4 Document Step B: Decision point
    - Same MUST-FIX counting as review-loop.md
    - Same decision matrix (0 findings → proceed, >0 and round <2 → fix, >0 and round ==2 → escalate)
  - [ ] 3.5 Document Step C: Spawn fixer subagent
    - Task tool with `subagent_type: "epic-dedup-fixer"`
    - Prompt template including: story ID, domain pattern, branch, findings path, round, story file
  - [ ] 3.6 Document Step D: Loop back (same as review-loop.md)
  - [ ] 3.7 Document escalation (same format as review-loop.md round 3). Options: (a) fix manually, (b) accept and mark complete, (c) override — allow one additional dedup round. **Hard cap: 3 dedup rounds total** — after round 3, only options (a) or (b) are available.
  - [ ] 3.8 Document dry-run behavior: skip subagent spawning, log dry-run messages

- [ ] Task 4: Update orchestrator SKILL.md (AC: #3, #7)
  - [ ] 4.1 Add new section `### 2.3b Dedup Scan Loop` between existing `### 2.3 Mark for Review` and `### 2.4 Code Review Loop`
  - [ ] 4.2 Content of the new section:
    ```markdown
    ### 2.3b Dedup Scan Loop

    **Read `dedup-scan-loop.md` in this skill directory for the full protocol.**

    The dedup scan loop detects cross-handler code duplication BEFORE the adversarial review.
    Unlike the reviewer (which diffs the branch), the scanner reads ALL handler files in the
    same domain to compare patterns.

    Summary of the loop:

    1. **Derive domain pattern** from `story.touches` (e.g., `backend/functions/saves*/handler.ts`)
    2. **Spawn `epic-dedup-scanner` subagent** (Task tool, `subagent_type: "epic-dedup-scanner"`) — fresh context, writes findings doc
    3. **Read findings doc**, count MUST-FIX items (Critical + Important)
    4. **If clean (0 MUST-FIX):** Exit loop, proceed to 2.4 (Code Review Loop)
    5. **If not clean AND round < 2:** Spawn `epic-dedup-fixer` subagent — reads findings, extracts to shared, commits locally
    6. **If not clean AND round == 2:** Escalate to human (same options as reviewer escalation)
    7. Loop back to step 2 with fresh scanner

    **In `--dry-run` mode:** Skip subagent spawning, log dry-run messages, proceed directly to 2.4.
    ```
  - [ ] 4.3 Update the Phase 2 section overview to mention the new step in the pipeline flow
  - [ ] 4.4 Ensure step numbering is consistent (2.1 → 2.2 → 2.3 → 2.3b → 2.4 → 2.5 → 2.6 → 2.7)

- [ ] Task 5: Verify reviewer is unchanged and update agent registry (AC: #8)
  - [ ] 5.1 Confirm `.claude/agents/epic-reviewer.md` has no modifications
  - [ ] 5.2 Confirm review-loop.md has no modifications
  - [ ] 5.3 Update `.claude/agents/README.md`: add rows for `epic-dedup-scanner` and `epic-dedup-fixer` in the Current Subagents table (file, purpose, tools, spawned by)

## Dev Notes

### Domain pattern derivation

The orchestrator derives the "domain" for the dedup scan from the story's `touches` field. Algorithm:

1. Extract handler directory paths from `touches` (e.g., `backend/functions/saves-update/handler.ts` → `backend/functions/saves-update`)
2. **If no paths under `backend/functions/` exist in `touches`, skip the dedup scan loop entirely** (proceed directly to 2.4). Stories that only touch shared packages have no handler domain to scan.
3. Find common prefix: `backend/functions/saves` (strip the handler-specific suffix like `-update`, `-delete`)
4. If `touches` includes handlers from multiple disjoint domains (e.g., both `saves*` and `auth*`), use the domain with the most touched files as the primary domain. Do not scan across unrelated handler domains.
5. Build glob pattern: `backend/functions/saves*/handler.ts`
6. Also include shared packages: `backend/shared/*/src/**/*.ts`

For non-saves domains in future epics, the same logic applies: `backend/functions/auth*/handler.ts`, `backend/functions/projects*/handler.ts`, etc.

### Findings output path convention

Dedup scan findings go to a different path than reviewer findings to avoid confusion:

- Dedup findings: `.claude/dedup-findings-{story.id}-round-{round}.md`
- Review findings: `.claude/review-findings-{story.id}-round-{round}.md`

### Relationship to existing pipeline

```
Quality Gates (2.2) → Mark for Review (2.3) → Dedup Scan (2.3b) → Code Review (2.4) → Commit & PR (2.5)
                                                ↕                       ↕
                                          epic-dedup-scanner       epic-reviewer
                                          epic-dedup-fixer         epic-fixer
                                            max 2 rounds             max 3 rounds
```

The dedup scan catches DRY/structural issues. The reviewer catches correctness/security/test issues. Neither overlaps with the other.

### What the scanner SHOULD flag vs SHOULD NOT

**Flag (Important):**
- A Zod schema defined in a handler that already exists in `@ai-learning-hub/validation`
- A constant defined locally that matches one in `@ai-learning-hub/db` or `@ai-learning-hub/events`
- Identical 5+ line code blocks appearing in 2+ handlers
- A function defined locally that has an equivalent in a shared package

**Flag (Minor):**
- Similar but not identical patterns (e.g., same structure, different variable names)
- Missing `AppError.isAppError()` usage (style issue)
- Response wrapping inconsistency

**Do NOT flag:**
- Handler-specific business logic that is unique to each handler
- Different DynamoDB condition expressions (these are intentionally different per handler)
- Test files (the scanner focuses on production code; test dedup is handled by Story 3.1.2/3.1.3)

### Testing this story

This story creates documentation and agent definitions — it does NOT create executable code. Testing is manual:
- Verify agent files parse correctly (valid YAML frontmatter)
- Verify SKILL.md edits are consistent with existing structure
- Verify dedup-scan-loop.md follows the same format as review-loop.md

## Architecture Compliance

| ADR / NFR         | How This Story Must Comply                                                      |
| ----------------- | ------------------------------------------------------------------------------- |
| **NFR-M1 (DRY)** | This story CREATES the automated enforcement mechanism for DRY                   |
| **Safety**        | New agents must not modify reviewer or existing agent definitions                |
| **Pipeline**      | New step must integrate cleanly without disrupting existing review/fix loop      |

## Testing Requirements

### No automated tests

This story creates agent definitions and documentation. There is no production code to test. Validation is structural:
- Agent `.md` files have valid YAML frontmatter
- SKILL.md edits maintain valid markdown structure
- Protocol doc follows established format (compare to review-loop.md)

### Quality gates

- `npm run lint` — unchanged (no source code modified)
- `npm run type-check` — unchanged
- Manual review of all 4 new/modified files

## Previous Story Intelligence

### From Stories 3.1.1–3.1.3

- After those stories complete, the saves domain will be DRY. The dedup scanner would report 0 findings on the current codebase.
- The scanner's value is PREVENTIVE — it catches NEW duplication introduced by future stories.

### From review-loop.md

- The dedup-scan-loop.md should follow the exact same structure: Protocol Overview, Step A (spawn scanner), Step B (decision point), Step C (spawn fixer), Step D (loop back), Dry Run Behavior.
- Same finding severity definitions: MUST-FIX (Critical + Important), NICE-TO-HAVE (Minor).

## File Structure Requirements

### New

- `.claude/agents/epic-dedup-scanner.md` — dedup scanner agent definition
- `.claude/agents/epic-dedup-fixer.md` — dedup fixer agent definition
- `.claude/skills/epic-orchestrator/dedup-scan-loop.md` — protocol document

### Modify

- `.claude/skills/epic-orchestrator/SKILL.md` — add Step 2.3b
- `.claude/agents/README.md` — add epic-dedup-scanner and epic-dedup-fixer to agent registry

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
