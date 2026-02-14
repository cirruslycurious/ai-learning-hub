# QA Read v1 - Cold Reader Findings

**Reader Profile:** Engineer familiar with CLI tools and basic agent concepts, no BMAD knowledge

**Document:** 12-draft-v3.md

**Date:** 2026-02-09

---

## Confusion Point 1: What "MUST-FIX" actually means

**What I was trying to understand:** The review loop mechanism and how issues get classified

**Where I got confused:** Line 30 in the "Layer 3: Supporting modules" section: "counts MUST-FIX issues (MUST-FIX = Critical + Important severity findings)"

**What I thought it meant:** Initially unclear if MUST-FIX is a label the reviewer applies directly, or if it's computed by counting Critical + Important findings. The parenthetical clarifies it, but on first read I wondered "do reviewers write MUST-FIX in their findings, or does the orchestrator compute this?"

**What would have helped:** Earlier introduction of the severity classification system before mentioning MUST-FIX. Perhaps: "The reviewer classifies findings by severity (Critical, Important, Minor). The orchestrator counts Critical and Important findings as MUST-FIX issues that block PR creation."

**Severity self-assessment:** Minor friction

---

## Confusion Point 2: The relationship between state file status and GitHub state

**What I was trying to understand:** How the system decides what to do when resuming a workflow

**Where I got confused:** Line 71 in Phase 2: "if the dependency has dependents (`hasDependents === true`), verify code reached base branch via `git merge-base --is-ancestor`; if the dependency is a leaf story (no dependents), state file status 'done' is sufficient"

**What I thought it meant:** I understood the two-tier policy but couldn't figure out WHY leaf stories don't need merge-base verification. The document never explains the reasoning — why is state file status sufficient for leaves but not for stories with dependents?

**What would have helped:** A brief rationale: "Leaf stories have no downstream integration risk, so the state file is sufficient. Stories with dependents require merge-base verification because downstream stories need to build on committed code, not just local state."

**Severity self-assessment:** Recovered with effort

---

## Confusion Point 3: When Phase 2.6 vs Phase 2.7 happens

**What I was trying to understand:** The sequence of integration checkpoint execution relative to the human approval gate

**Where I got confused:** Line 76-77: "If story has dependents (inverse graph non-empty), run integration checkpoint (after Phase 2.6 sync-with-main, before presenting the human checkpoint prompt in step 7)"

**What I thought it meant:** The document mentions "Phase 2.6 sync-with-main" but Phase 2 only has steps numbered 1-10, not sub-phases like "2.6". I couldn't map "Phase 2.6" to any of the numbered steps. Is sync-with-main step 6? Or is it a sub-step within step 6?

**What would have helped:** Either use consistent numbering (don't mix "Phase 2.6" with "step 7") or clarify: "run integration checkpoint (which includes syncing with main as its first sub-step) before presenting the human checkpoint prompt in step 7"

**Severity self-assessment:** Recovered with effort

---

## Confusion Point 4: What "dependency completion" actually checks

**What I was trying to understand:** How the orchestrator decides if a story can start when its dependencies are marked "done"

**Where I got confused:** Line 198 in Story 1.2 execution: "Check dependencies: Story 1.1 status 'done' with dependents `[1.2, 1.3]` → verify code reached base branch via `git merge-base --is-ancestor` → proceed (integration checkpoint passed)"

**What I thought it meant:** The phrase "(integration checkpoint passed)" in parentheses made me think Story 1.2 waits for Story 1.1's integration checkpoint to pass before starting. But re-reading earlier sections, I realized the dependency check just verifies that Story 1.1's code reached the base branch — the integration checkpoint result (Green/Yellow/Red) doesn't gate Story 1.2's start.

**What would have helped:** Remove the misleading "(integration checkpoint passed)" parenthetical, or clarify: "verify code reached base branch via `git merge-base --is-ancestor` → proceed (Story 1.1's integration checkpoint results are informational and do not block Story 1.2)"

**Severity self-assessment:** Recovered with effort

---

## Confusion Point 5: The identity of "base branch" vs "main"

**What I was trying to understand:** Whether "base branch" and "main" are always the same thing

**Where I got confused:** Throughout the document, "main" and "base branch" are used interchangeably. Line 72 says "verify code reached base branch" but Line 274 says "git diff main...story-branch". I couldn't tell if these are the same or if "base branch" is configurable.

**What I thought it meant:** I assumed they're the same (main = base branch) but the inconsistent terminology made me second-guess. Is "base branch" a configurable setting that defaults to "main"? Or are they synonyms?

**What would have helped:** Early definition: "Throughout this document, 'base branch' refers to the main development branch (typically `main` or `master`). Auto Epic assumes the base branch is `main`."

**Severity self-assessment:** Minor friction

---

## Confusion Point 6: What "integration checkpoint" validates vs what blocks work

**What I was trying to understand:** Whether a Yellow or Red integration checkpoint result prevents the next story from starting

**Where I got confused:** Line 90 in Phase 2: "For Red results, the workflow escalates with failing test output and does not offer auto-continue — the user must pause to investigate."

Later in the example (line 198), Story 1.2 starts after Story 1.1 completes with Yellow result. I couldn't reconcile "user must pause" with "Story 1.2 starts immediately after user approves."

**What I thought it meant:** Initially thought Red checkpoints block downstream stories from starting. Re-reading clarified that checkpoints are informational — they don't block workflow progression, they just require human decision at step 7.

**What would have helped:** Explicit statement: "Integration checkpoint results (Green/Yellow/Red) are informational. They inform the user's decision at the human checkpoint but do not automatically block downstream stories. Even after a Red result, the user can choose to continue if they understand the risk."

**Severity self-assessment:** Recovered with effort

---

## Confusion Point 7: The Review Loop section uses "round" and "review round" inconsistently

**What I was trying to understand:** Whether a "round" includes both review and fix, or just the review step

**Where I got confused:** Line 269: "The review loop runs up to 3 review rounds by default (3 review rounds = Round 1 review → fix → Round 2 review → fix → Round 3 review → escalate if still unclean, giving 2 fix attempts before escalation)"

**What I thought it meant:** The parenthetical clarifies that "3 review rounds" means 3 reviews + 2 fixes (not 3 review+fix pairs), but this contradicts the intuitive reading of "round". I expected "1 round = 1 review + 1 fix cycle", so "3 rounds = 3 review+fix cycles = 6 total steps". The actual behavior is "3 reviews + up to 2 fixes = up to 5 total steps".

**What would have helped:** Define "round" early and consistently: "A review round consists of spawning the reviewer and generating findings. If MUST-FIX issues are found, the orchestrator spawns a fixer (this does not increment the round counter). The default limit of 3 review rounds allows up to 2 fix attempts before escalation."

**Severity self-assessment:** Recovered with effort

---

## Confusion Point 8: What "topological order" means for readers unfamiliar with graph algorithms

**What I was trying to understand:** How the system determines execution order from the dependency graph

**Where I got confused:** Line 61: "Perform topological sort (commonly Kahn's algorithm or DFS-based) to produce safe execution order"

**What I thought it meant:** As a reader with basic git/CLI knowledge but no graph algorithm background, "topological sort" is jargon. I inferred it means "dependency-respecting order" from context, but the phrase "commonly Kahn's algorithm or DFS-based" added complexity without clarification.

**What would have helped:** Either simplify to "compute execution order that respects dependencies" without mentioning algorithms, OR provide a one-sentence explainer: "Topological sort is a graph algorithm that orders nodes such that all dependencies appear before their dependents — ensuring Story 1.1 completes before Story 1.2 starts."

**Severity self-assessment:** Minor friction

---

## Confusion Point 9: The "never-skip-tests invariant" vs "test re-run" in integration checkpoints

**What I was trying to understand:** How many times tests run during the workflow

**Where I got confused:** Line 317-318: "Integration checkpoints enforce the never-skip-tests invariant by running the full test suite after syncing with main."

Earlier, Line 394: "Never skip tests — `npm test` runs during review loop and integration checkpoints"

**What I thought it meant:** Tests run in two places (review loop + integration checkpoints), but I couldn't find where in the review loop section tests are mentioned. The review loop section (lines 268-298) describes reviewer spawning, findings generation, and fixer application — no test execution. Did I miss it, or is the statement about tests in review loop incorrect?

**What would have helped:** Clarify where tests run: "Tests run at two points: (1) during the Stop hook verification before marking story complete (see Hook System Enforcement section), and (2) during integration checkpoints after syncing with main. The review loop focuses on code quality findings, not test execution."

**Severity self-assessment:** Recovered with effort

---

## Confusion Point 10: The "isolated context" concept for subagents

**What I was trying to understand:** What "isolated context" means practically — what can/can't the reviewer access?

**Where I got confused:** Line 287: "Each `epic-reviewer` spawn gets a fresh context with no knowledge of previous rounds, no implementation history, and no access to original story discussions."

**What I thought it meant:** I understood "fresh context" conceptually (no memory from previous rounds), but couldn't tell if the reviewer has access to:

- The story definition file (acceptance criteria)?
- ADR documents (architectural constraints)?
- Previous review findings from earlier rounds?

Line 275 says "analyzes implementation against story acceptance criteria, architectural constraints (ADRs)" which implies the reviewer CAN access story and ADR files, but Line 287 says "no access to original story discussions" which sounds contradictory.

**What would have helped:** Explicit list of what the reviewer has vs doesn't have: "The reviewer has read-only access to: story definition file, ADR documents, code diff. The reviewer does NOT have: previous review findings, implementation conversation history, or orchestrator context about why decisions were made."

**Severity self-assessment:** Recovered with effort

---

## Confusion Point 11: The state file "atomic writes" design vs implementation status

**What I was trying to understand:** Whether atomic writes are currently implemented or planned

**Where I got confused:** Line 380: "The design specifies atomic writes using a `.tmp` file pattern... (design spec from `docs/auto-epic-diagram.md` — implementation pending verification)."

**What I thought it meant:** The phrase "implementation pending verification" is ambiguous. Does it mean:

- (A) The atomic write code exists but hasn't been tested/verified yet?
- (B) The atomic write design exists in specs but code is not yet written?
- (C) The atomic write code exists and works but the author hasn't personally verified it?

**What would have helped:** Choose one of:

- "This atomic write pattern is specified in the design docs but not yet implemented in the codebase."
- "The atomic write implementation exists in the codebase but has not been verified through testing."
- Remove the uncertainty and verify implementation status before publishing.

**Severity self-assessment:** Minor friction

---

## Confusion Point 12: The "dev-story skill" is never defined

**What I was trying to understand:** What dev-story actually does and how it differs from the orchestrator

**Where I got confused:** Line 39: "`dev-story` — invokes as a skill (same context via Skill tool) to implement individual stories"

**What I thought it meant:** The document mentions dev-story 11 times but never explains what it does beyond "implement individual stories". As a reader, I couldn't tell:

- Does dev-story write code? Or just coordinate story implementation?
- Does dev-story have its own subagents?
- How much of the "implementation" work does dev-story own vs the orchestrator?

The document thoroughly explains epic-reviewer (adversarial code review, isolated context) and epic-fixer (applies corrections), but dev-story remains a black box.

**What would have helped:** A dedicated subsection in Layer 4 explaining: "The `dev-story` skill implements individual stories by reading story acceptance criteria, writing code to satisfy requirements, running tests, and committing changes. Unlike the reviewer/fixer subagents, dev-story shares the orchestrator's context and has full edit capabilities."

**Severity self-assessment:** Could not proceed

---

## Confusion Point 13: What happens if the user types "skip" at the checkpoint

**What I was trying to understand:** The downstream effect of skipping a story that has dependents

**Where I got confused:** Line 86: "If user skips story, update state to 'skipped' and mark affected downstream stories as 'blocked'"

Later, Line 382: "If a dependency has status 'skipped', all dependents are marked 'blocked' and do not run."

**What I thought it meant:** I understood that dependents get marked "blocked", but couldn't tell:

- Are blocked stories skipped silently, or does the user get prompted for each one?
- Can a blocked story be un-blocked if the user goes back and completes the skipped dependency?
- Does skipping Story 1.1 immediately block 1.2/1.3, or does the workflow continue and block them when it reaches them in execution order?

**What would have helped:** Add detail to the skip behavior: "When a story is skipped, the orchestrator immediately marks all dependents as 'blocked' in the state file. Blocked stories are skipped silently without human prompts — the workflow continues to the next non-blocked story in topological order. To un-block stories, the user must manually edit the state file or restart the workflow after completing the skipped dependency."

**Severity self-assessment:** Recovered with effort

---

## Summary Statistics

**Total confusion points:** 13

**Severity breakdown:**

- Could not proceed: 1 (dev-story undefined)
- Recovered with effort: 8
- Minor friction: 4

**Recommendation:** The "Could not proceed" finding (dev-story undefined) blocks advancement. The document cannot ship without explaining what dev-story does — it's mentioned 11 times as a critical component but never defined beyond "implements stories".

**Overall impression:** The document is well-structured and progressively builds understanding. The confusion points are mostly minor terminology inconsistencies and missing rationale for design decisions. With the dev-story definition added and terminology tightened, the document will be ready for publication.

---

## Positive Observations (What Worked Well)

1. **Progressive disclosure works:** I could understand the overview without diving into review loops or hooks. Each section built on previous knowledge.

2. **The four-story example is excellent:** Walking through concrete execution with Stories 1.1-1.4 made the abstract concepts (topological sort, integration checkpoints, dependency verification) concrete.

3. **Diagram placeholders set expectations:** Knowing "a diagram will go here" helped me understand when spatial/temporal relationships were too complex for prose alone.

4. **Safety invariants section is clear:** The nine invariants (never auto-merge, never bypass hooks, etc.) are easy to understand and remember.

5. **Phase numbering is helpful:** Breaking the workflow into Phase 1 (planning), Phase 2 (loop), Phase 3 (completion) gives clear mental anchors.
