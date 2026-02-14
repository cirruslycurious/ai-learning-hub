# Task: Outline Review

## Task Overview

This is Step 2 (Phase 1: Foundation) of the writing pipeline. You are operating as the Editor agent to review the structural outline produced in Step 1. Your job is to validate that the outline provides a sound blueprint for drafting — one that will produce a document the reader can navigate and use, within the target length. Catching structural problems and length overcommitment now prevents expensive rework in later drafts.

## Input Contract

Read these files before starting work:

| File                        | Purpose                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `{project}/02-outline.md`   | The structural outline to review, including section word budgets and Length Budget summary            |
| `{project}/01-research.md`  | Research notes that should back every outline section                                                 |
| `{project}/00-request.md`   | Documentation goal, audience profile, scope boundaries, **target length** (your calibration baseline) |
| `{project}/state.yaml`      | Current pipeline state (should confirm this is Step 2, Task A)                                        |
| `guides/style-guide.md`     | Writing standards for structure, ordering, and formatting rules                                       |
| `guides/review-taxonomy.md` | Classification system (MUST/SHOULD/MINOR) and review item format                                      |

**IMPORTANT:** Read the audience profile and target length in `00-request.md` first. Every review decision is calibrated to the declared audience, not your own expertise. The target length constrains whether the outline's scope is achievable.

## Output Contract

Produce exactly one file:

| File                             | Format                                                                                           | Purpose                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `{project}/03-outline-review.md` | Review items (per review-taxonomy format) + Review Summary (with gate recommendation and counts) | Feedback for the Tech Writer and gate decision for Manager |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

## Instructions

### Phase 1: Silent Read

Read the full outline from start to finish without marking anything. Absorb the proposed structure. Understand:

- What order are sections presented?
- Does the flow match how the reader would approach this topic?
- Are there obvious gaps (sections mentioned but not detailed)?
- Does the outline tell a coherent story from the reader's perspective?
- How many H2 sections are planned? Does the scope feel achievable within the target length?

Do not mark issues on first read. You need to understand the whole structure before evaluating individual parts.

### Phase 2: Evaluate Against Research

Cross-reference the outline against `01-research.md`.

**For each section in the outline:**

1. Does it reference specific findings from the research notes?
2. Are the key points backed by research claims?
3. Are there findings in `01-research.md` that the outline ignores?

**What to flag:**

- **SHOULD:** Section with no research backing — "Section 'Configure authentication' has no corresponding findings in `01-research.md`. Verify this content is within scope or remove."
- **SHOULD:** Research finding with no outline section — "Research finding about retry logic (finding 8) has no corresponding outline section. Either add a section or explain why this is out of scope."
- **MUST:** Section that introduces content clearly outside the scope defined in `00-request.md` — "Section 'Advanced debugging techniques' is outside the defined scope, which is limited to basic setup and configuration."

### Phase 3: Evaluate Structure

Apply the style guide's section ordering rules. Check that the outline follows:

- **Task-based content before reference content** — How-to sections come before API reference sections
- **Prerequisites before procedures** — Setup requirements appear before the steps that need them
- **Overview before detail** — High-level explanation precedes deep technical details
- **Common cases before edge cases** — Default workflows before special scenarios
- **Defaults before customization** — Standard configuration before advanced options

**Section count and hierarchy:** Count the proposed H2 sections. If the outline plans more than 7 H2 sections, evaluate whether some should be subsections of others or consolidated. A flat outline produces a flat document — and flat documents develop redundancy because standalone sections tend to re-explain context that a parent section would have established once.

**What to flag:**

- **MUST:** Prerequisite appears after the procedure that needs it — "Outline has 'Install dependencies' as Section 5, after 'Run the application' (Section 3). Prerequisites must come first."
- **SHOULD:** Reference content before task content — "Outline leads with API reference (Section 2) before showing how to use the API (Section 4). Readers need task sections first."
- **SHOULD:** Detail-first structure when overview is needed — "Outline dives into internal implementation (Section 2) before explaining what the system does (Section 4). Reverse the order."
- **SHOULD:** Flat structure — "Outline has 10 H2 sections. Sections 4–7 all cover workflow phases and should be subsections under a single 'Workflow' H2. Consolidating to ~5 H2 sections will reduce redundancy and improve navigation."

### Phase 4: Evaluate Audience Alignment

Read the audience profile in `00-request.md`. Ask for each section:

- Is this the right depth level for the declared audience?
- Does the structure match how this audience approaches the topic?
- Are sections missing that this audience would need?

**What to flag:**

- **SHOULD:** Depth mismatch — "Section 'Understanding Lambda execution contexts' assumes familiarity with AWS internals, but the audience profile declares 'developers new to AWS serverless.' Either add foundation material or move this to an advanced section."
- **SHOULD:** Wrong task flow — "Outline has 'Troubleshooting' as Section 2, but the audience profile indicates users setting up for the first time. Move troubleshooting to the end; start with 'Getting started.'"
- **MUST:** Missing critical content for audience — "Audience profile indicates 'junior developers unfamiliar with DynamoDB,' but outline has no section explaining partition keys. This is required context for the procedures that follow."

### Phase 5: Evaluate Progressive Disclosure

Each outline section should specify:

- **What skimmers get:** Heading + first sentence gives the gist
- **What readers get:** Full section provides working knowledge
- **What deep readers get:** Subsections cover edge cases and internals

**What to flag:**

- **SHOULD:** Missing disclosure plan — "Section 'Deploy to production' does not specify progressive disclosure layers. Add what skimmers vs. deep readers will get from this section."
- **SHOULD:** Flat structure with no layering — "Section plans to cover setup, configuration, advanced tuning, and troubleshooting all at the same level. Layer this: setup and basic config for all readers, advanced tuning as subsection for those who need it."

### Phase 6: Evaluate Completeness

Compare the outline against `00-request.md`:

- Are all in-scope requirements covered?
- Are there sections that fall outside the defined scope?

**What to flag:**

- **MUST:** In-scope content missing — "Request specifies documenting 'API authentication flow and error handling' but outline has no error handling section."
- **MUST:** Out-of-scope content present — "Outline includes 'Migrating from v1 to v2' but scope is limited to v2 setup only. Remove or clarify scope change."

### Phase 7: Evaluate Length Budget

Extract the target length from `00-request.md`. Compare it against the outline's section word budgets.

**Check for:**

1. **Word budgets present.** Every section must include a word budget. If word budgets are missing, flag as MUST.
2. **Length Budget summary table present.** The outline must end with a summary showing per-section budgets, total, target, and variance. If missing, flag as MUST.
3. **Total budget within range.** Section budgets must sum to within 20% of the target length. If over, flag as MUST.
4. **Individual budgets plausible.** Check each section's budget against its stated coverage. A section covering 3 complex concepts in ~200 words is under-budgeted and will either be too shallow or will blow its budget during drafting. A section covering a single simple point in ~800 words is over-budgeted and will invite padding.

**What to flag:**

- **MUST:** Word budgets missing — "Outline does not include word budgets per section. Each section must specify a word budget, and a Length Budget summary table must appear at the end."
- **MUST:** Total budget more than 20% over target — "Section budgets total ~3,400 words against a 2,400-word target (42% over). The outline is over-scoped for the target length. Consolidate sections or reduce depth to bring the total within 20% of the target."
- **SHOULD:** Individual budget mismatch — "Section 'Architecture overview' is budgeted at 200 words but covers 4 distinct architectural layers. This budget is implausible — either increase the budget (reducing others) or narrow the section's scope to the most important 1–2 layers."
- **SHOULD:** Budget spread suggests flat treatment — "All 8 sections are budgeted at ~300 words, suggesting uniform depth. The topic's complexity is uneven — 'System flow' needs more depth than 'Quick reference.' Redistribute budgets to match topic weight."

### Phase 8: Write Review Items

For each issue found, write a review item following this format:

```markdown
### [SEVERITY] Section: "Section Title" — Short description

One to three sentences explaining the issue. Be specific about what is wrong
and why it matters to the reader.

**Location:** Which outline section this affects
**Suggested fix:** Concrete, actionable suggestion for how to resolve the issue.
```

**Classification guidance:**

- **MUST:** Sections outside scope, missing in-scope content, structural problems that would prevent the reader from completing tasks (prerequisites after procedures, critical content missing), missing word budgets, total budget more than 20% over target
- **SHOULD:** Sections with no research backing, ignored research findings, structural weaknesses that don't block but hinder navigation, depth mismatches with audience, missing progressive disclosure plans, implausible individual word budgets, flat budget distribution
- **MINOR:** Polish suggestions, minor ordering improvements that are preference-based

**Rules for review items:**

1. One issue per item
2. Reference the specific outline section by name
3. Explain the reader impact, not just the rule violation
4. Provide concrete suggested fixes for MUST and SHOULD items
5. Cite the specific style guide rule when applicable

### Phase 9: Write Review Summary

End your review with a summary block:

```markdown
## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | X     |
| SHOULD   | Y     |
| MINOR    | Z     |

**Length budget:** Total budget ~X words | Target Y words | Variance Z%

**Gate recommendation:** [PASS | MUST-REVISE | CONDITIONAL-PASS]

[Optional: One paragraph explaining the overall assessment and key themes in the findings]
```

**Gate recommendation values:**

- **PASS:** Zero MUST items. SHOULD and MINOR items exist but the outline provides a sound structural plan within the target length. The Tech Writer can proceed to drafting.
- **MUST-REVISE:** One or more MUST items. The outline has structural problems that must be fixed before drafting begins. This includes over-scoped outlines that exceed the length budget by more than 20%.
- **CONDITIONAL-PASS:** Zero MUST items but a high density of SHOULD items suggests the outline needs significant rework. The structure is not fundamentally wrong but is notably weak. Let the Manager decide whether to require revision or proceed.

**CONDITIONAL-PASS guidelines:** Use when you have 5+ SHOULD items and they collectively indicate a pattern (all relate to audience mismatch, or all relate to structural flow problems, or all relate to budget implausibility) rather than being isolated nitpicks.

## Success Criteria

Before submitting your review, verify:

- [ ] You read the full outline before marking any issues
- [ ] You cross-referenced every outline section against `01-research.md`
- [ ] Every review item cites the specific outline section and research finding (or absence)
- [ ] Every review item includes severity classification and suggested fix (for MUST/SHOULD)
- [ ] You checked section ordering against style guide rules
- [ ] You evaluated structure against the audience profile in `00-request.md`
- [ ] **You verified that word budgets are present for each section**
- [ ] **You verified the total budget is within 20% of the target length from `00-request.md`**
- [ ] **You assessed whether individual section budgets are plausible for their stated coverage**
- [ ] Review summary includes counts, length budget status, and gate recommendation
- [ ] Gate recommendation is one of: PASS, MUST-REVISE, or CONDITIONAL-PASS

## Key Rules

These constraints apply to this task:

1. **Read the audience profile and target length first.** Calibrate all decisions to the declared audience in `00-request.md`, not your own expertise. Use the target length to evaluate whether the outline's scope is achievable.
2. **Cross-reference research.** Every outline section must map to research findings. Every significant research finding should inform the outline.
3. **Apply style guide ordering rules mechanically.** Task before reference, prerequisites before procedures, overview before detail.
4. **Classify honestly, not strategically.** Use the review taxonomy's criteria for MUST/SHOULD/MINOR. Do not inflate severity to force a rewrite.
5. **Provide actionable suggested fixes.** "This section could be better" is not actionable. "Move 'Prerequisites' before 'Installation steps'" is actionable.
6. **Focus on structure, not prose.** This is an outline review. Do not flag wording issues unless they indicate a structural misunderstanding.
7. **Scope violations are MUST items.** Content outside the defined scope must be removed. Missing in-scope content must be added.
8. **Length budget violations are MUST items.** Missing word budgets must be added. Total budgets exceeding the target by more than 20% must be brought within range.
9. **Prefer fewer, deeper sections.** A flat outline with 10+ H2 sections will produce a flat, redundant document. Recommend consolidation when section count is high.

## Common Pitfalls

Avoid these failure modes:

**1. Reviewing prose instead of structure**

Bad: Flagging "Configure authentication" heading for not starting with a verb
Good: Flagging that the authentication section appears after deployment, when readers need to configure auth before deploying

**2. Not cross-referencing research**

Bad: Assuming every outline section is backed by research without checking
Good: Verifying each section against `01-research.md` and flagging ungrounded sections

**3. Ignoring the audience profile**

Bad: Flagging "too much explanation" based on your own expertise
Good: Checking `00-request.md` audience profile and confirming depth level matches declared reader background

**4. Vague feedback**

Bad: "Section ordering seems off"
Good: "Section 'Prerequisites' appears as Section 4, after 'Installation' (Section 2). Per style guide [MUST], prerequisites must precede procedures. Move 'Prerequisites' to Section 1."

**5. Accepting outlines with no detail**

Bad: Accepting an outline that's just headings without the required detail structure
Good: Flagging sections that lack "Covers," "Word budget," "Key points," "Research notes," or "Progressive disclosure" fields

**6. Missing scope violations**

Bad: Allowing sections outside the defined scope because they "might be useful"
Good: Comparing outline sections against `00-request.md` scope and flagging anything not explicitly included

**7. Rubber-stamping**

Bad: Producing a review with zero findings because the outline "looks fine"
Good: Every outline has room for improvement — at minimum, you should find SHOULD or MINOR items. Zero findings suggests insufficient review.

**8. Inflating severity for control**

Bad: Classifying every issue as MUST because you want the outline substantially revised
Good: Applying the review taxonomy honestly — MUST only when the issue would prevent the reader from completing tasks or violates scope

**9. Ignoring the length budget**

Bad: Accepting an outline with no word budgets or with a total budget 50% over the target length, assuming the Tech Writer or Editor will handle length later
Good: Flagging missing word budgets as MUST, flagging over-scoped outlines as MUST, and recommending specific consolidations to bring the budget within range

## Notes

- **This review prevents downstream rework.** Structural problems caught now are cheap to fix. Structural problems caught after three draft rounds are expensive.
- **Focus on the reader's journey.** Does the proposed structure serve how the reader approaches this topic? A technically correct structure that doesn't match reader task flow is a SHOULD item.
- **Research coverage matters.** Sections without research backing often indicate scope creep (adding content not actually researched) or wishful thinking (assuming implementation details that don't exist).
- **Progressive disclosure is a planning tool.** If the outline doesn't specify what different reader types get from each section, the draft will likely be flat — everything at the same depth, no navigation support.
- **The length budget prevents downstream bloat.** An over-scoped outline produces an over-length draft. Every revision round pushes it further past the target. The Editor can cut redundancy in later rounds, but the Editor cannot compress a fundamentally over-scoped document. Catching over-scoping at the outline stage is orders of magnitude cheaper than catching it at draft v3.
- **Don't be a perfectionist about structure.** There are multiple valid ways to structure most documents. Flag clear violations (prerequisites after procedures) and notable weaknesses (audience mismatch). Don't flag minor ordering preferences as MUST items.

## Example Review Item

Good review item:

```markdown
### [MUST] Section: "Deploy to production" — Missing prerequisite section

The outline shows "Deploy to production" as Section 2, immediately after
"Overview." The deployment steps reference AWS credentials and CDK installed,
but no prerequisite section exists to ensure readers have these before starting.

Per style guide [MUST]: "Prerequisites come before the procedure they apply to."

**Location:** Section 2 outline entry
**Suggested fix:** Add a new Section 2 titled "Prerequisites" that lists: AWS
account, AWS CLI configured with credentials, Node.js 18+, CDK installed. Move
current Section 2 to Section 3.
```

Good length budget review item:

```markdown
### [MUST] Length Budget — Total exceeds target by 42%

Section budgets sum to ~3,400 words against a target of 2,400 words (42% over).
The outline is over-scoped for the target length. If the draft follows these
budgets, it will be nearly 1,000 words over target from the start, and every
revision round will push it further.

**Location:** Length Budget summary table
**Suggested fix:** Consolidate "Hook enforcement" and "Dependency analysis"
into subsections of "Three-phase workflow" (saves ~400 words). Reduce
"Architecture overview" from ~600 to ~350 words by focusing on the single
most important architectural concept. This brings the total to ~2,600 (8% over).
```

These items:

- Classify severity correctly (structural violation that blocks readers; length overcommitment that guarantees bloat)
- Cite the specific rule
- Explain reader impact
- Provide concrete, actionable fixes
- Reference the specific location in the outline
