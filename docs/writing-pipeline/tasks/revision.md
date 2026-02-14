# Task: Revision

## Task Overview

This task occurs at Steps 4b, 5b, 11b, and 11d (Phase 2 and Phase 4) of the writing pipeline. You are operating as the Tech Writer agent to revise a draft based on review feedback from the Editor, SME, or QA Reader. This task is reusable across all review types with different handling rules for each reviewer's feedback format.

You produce a revised draft that addresses all MUST items, handles SHOULD items with justifications if declined, applies the audience-plausibility filter to QA Reader confusion points, and respects the target length constraint throughout.

## Input Contract

Read these files before starting work:

| File                        | Purpose                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `{project}/state.yaml`      | Current pipeline state (confirms which step, which draft version, which review notes to process)                                            |
| `{project}/00-request.md`   | Original documentation goal, **audience profile** (critical for QA downgrade decisions), scope boundaries, **target length**                |
| `guides/style-guide.md`     | Writing standards you must continue to follow                                                                                               |
| `guides/review-taxonomy.md` | Severity classification system (MUST/SHOULD/MINOR) and handling obligations                                                                 |
| Current draft               | The draft being revised (e.g., `04-draft-v1.md`, `12-draft-v3.md`, `16-draft-v3r1.md`)                                                      |
| Review notes                | Editor notes, SME notes, or QA notes specified in `state.yaml` (e.g., `05-editorial-notes.md`, `13-sme-notes.md`, `17-qa-read-feedback.md`) |

**IMPORTANT:** Do not proceed until you have read all files. The audience profile in `00-request.md` is critical for mapping QA Reader confusion points to severity levels. The target length in `00-request.md` is the length anchor for this revision — not the previous draft's word count.

## Output Contract

Produce exactly one file:

| File                   | Format                                                                           | Purpose                                               |
| ---------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Revised draft markdown | Same structural requirements as original draft, plus revision-specific additions | Incorporates review feedback per severity-level rules |

**Naming convention:** Per `state.yaml`, typically `06-draft-v1r1.md` (revision 1 of draft v1), `16-draft-v3r1.md` (revision 1 of draft v3), or `18-draft-v3r2.md` (revision 2 of draft v3).

**Length compliance:** The revision must be the same length or shorter than the previous draft, unless feedback explicitly called for added content (e.g., a MUST item requesting a missing section). The revision must not exceed the target length from `00-request.md` by more than 20%. Include a word count comment at the end: `<!-- Word count: X words | Target: Y words | Δ: +/-Z (W%) -->`.

**Revision-specific additions:**

1. **`[NOTE]` comments** — Inline comments explaining alternative fixes when your fix differs significantly from the reviewer's suggestion
2. **`## Review Responses` section** — Front matter section documenting declined SHOULD items with substantive justifications
3. **`[DOWNGRADED]` comments** — Inline comments explaining QA Reader confusion points downgraded using the audience-plausibility filter

## Instructions

### Phase 1: Understand the Review

**1. Load the length constraint**

Extract the target length from `00-request.md`. Calculate the 20% ceiling. Note the current draft's word count. This is your length anchor — the revision must stay within the ceiling regardless of how much feedback you are addressing.

**2. Load the review notes**

Read the review file specified in `state.yaml`. Identify the reviewer type:

- **Editor notes:** `{NN}-editorial-notes.md` — structural, style, and clarity feedback using MUST/SHOULD/MINOR
- **SME notes:** `{NN}-sme-notes.md` — technical accuracy feedback using MUST/SHOULD/MINOR with evidence citations
- **QA notes:** `{NN}-qa-read-feedback.md` — confusion points with severity self-assessments (not MUST/SHOULD/MINOR)

**3. Check for a Reorganization Map**

If the Editor's review includes a Reorganization Map (CUT/MERGE/CONDENSE actions), this is your first priority. The map defines structural surgery that must happen before you address individual per-pass findings. Note the estimated word reduction — this is capacity you free up for any additions required by other findings.

**4. Classify all review items**

For **Editor or SME reviews:**

- Items are already classified as MUST/SHOULD/MINOR
- Read the review taxonomy to understand your handling obligations for each severity level

For **QA Reader reviews:**

- Items are formatted as confusion points with severity self-assessments ("Could not proceed", "Recovered with effort", "Minor friction")
- You must map each confusion point to MUST/SHOULD/MINOR using the audience-plausibility filter (see Phase 2, Step 4)

**5. Inventory MUST items**

Create a working list of all MUST items. These are non-negotiable — every MUST item must be addressed in the revision with zero exceptions.

If there are no MUST items and the review gate is PASS, you should not be in a revision task. Check `state.yaml` for pipeline state errors.

### Phase 2: Map and Prioritize Feedback

**1. Handling Editor notes**

Editor notes govern structure, style, and clarity.

| Severity | Handling                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| MUST     | Fix every item. Apply the suggested fix or an alternative that resolves the underlying problem.                                                  |
| SHOULD   | Address unless you have a substantive reason not to. Justifications must reference style guide rules, audience needs, or structural constraints. |
| MINOR    | Address at your discretion. No justification needed if skipped.                                                                                  |

**Editor-specific rule:** When the Editor's structural recommendation conflicts with the style guide, the style guide wins. Note this in a `[NOTE]` comment.

**2. Handling SME notes**

SME notes govern technical accuracy.

| Severity | Handling                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| MUST     | Fix every item. When the SME corrects a factual claim, update the claim and its source citation. Accuracy is non-negotiable.               |
| SHOULD   | Address unless you have a substantive reason not to. Justifications must be based on verified evidence from primary sources — not opinion. |
| MINOR    | Address at your discretion.                                                                                                                |

**SME-specific rules:**

- When the SME adds context, integrate it at the appropriate depth level. Do not dump SME knowledge into the overview if it belongs in a detail section (follow progressive disclosure layering).
- When the SME provides evidence (file path, command output, doc URL), incorporate the updated citation into the draft.
- If an SME MUST item requests a fix that would violate the declared scope (adding out-of-scope material), note this as a scope conflict in a `[NOTE]` comment and flag it for the Manager. Do not expand scope to satisfy an SME note.

**3. Handling Editor vs. SME conflicts**

If Editor and SME notes conflict on the same passage (rare), apply this priority:

1. **Accuracy wins.** If the SME says a claim is wrong and the Editor wants it phrased differently, fix the accuracy first, then apply the Editor's style recommendation to the corrected claim.
2. **When both cannot be satisfied:** Accuracy is MUST-level; style is SHOULD-level. A structurally imperfect but accurate statement ships. A well-structured inaccuracy does not.

**4. Handling QA Reader notes (audience-plausibility filter)**

QA Reader notes are confusion points, not severity-classified items. You must map them to MUST/SHOULD/MINOR by asking: **would the declared target audience experience the same confusion?**

**Mapping process:**

For each confusion point:

1. Read the confusion point and the QA Reader's severity self-assessment ("Could not proceed", "Recovered with effort", "Minor friction")
2. Read the **audience profile** from `00-request.md` — what background knowledge, experience level, and context does the target audience have?
3. Ask: **does the target audience have the prerequisite knowledge to avoid this confusion?**

**Decision tree:**

```
Is the confusion point valid for the target audience?

YES, and the reader could not proceed (blocks core workflow)
  → Treat as MUST

YES, and the reader recovered but with effort (creates friction)
  → Treat as SHOULD

YES, but the friction is minimal (polish issue)
  → Treat as MINOR

NO — the confusion stems from knowledge the target audience has
  → Downgrade by one level (or skip if already minor) and add [DOWNGRADED] comment
```

**Downgrade documentation:**

When you downgrade a QA confusion point because the target audience has prerequisite knowledge, add an inline `[DOWNGRADED]` comment at the revision site:

```markdown
<!-- [DOWNGRADED: target audience has working knowledge of DynamoDB
per audience profile — "partition key" does not require definition] -->
```

The Editor validates downgrade judgments on their next review pass. Downgrade justifications must reference the audience profile, not your opinion of what readers "should" know.

**Common downgrade reasons:**

- Technical term that appears in the audience profile's "prerequisite knowledge" section
- Workflow step that assumes familiarity with a tool the audience profile explicitly lists
- Conceptual leap that the audience profile states readers can make (e.g., "developers familiar with async/await patterns")

**Invalid downgrade reasons:**

- "Most developers know this" (not evidence)
- "It's obvious" (subjective)
- "The QA Reader misread" (does not address whether the target audience would misread)

### Phase 3: Execute the Revision

**1. Apply the Reorganization Map first (if present)**

If the Editor's review includes a Reorganization Map with CUT, MERGE, or CONDENSE actions:

1. Apply the Reorganization Map before addressing individual per-pass findings
2. For CUT items: remove the specified content. If the Editor indicated salvageable content to relocate, move it to the specified target location.
3. For MERGE items: fold the unique content from the specified section into the target section. Delete the source section.
4. For CONDENSE items: reduce the specified content to approximately the word count the Editor suggested.
5. After applying the Reorganization Map, address remaining per-pass findings within the surviving structure.

**Do not add compensating content when cutting.** If the Editor says to cut a section, cut it. Do not replace a 500-word redundant section with a 300-word "summary" of the same content.

**2. Address MUST items**

Work through every MUST item. For each:

**Applying the suggested fix:**

- If the suggested fix is clear and resolves the problem, apply it directly
- Update surrounding text as needed to integrate the fix smoothly
- Maintain the style guide's voice, structure, and formatting rules

**Applying an alternative fix:**

If your fix differs significantly from the reviewer's suggestion, you may apply an alternative fix **as long as it resolves the underlying problem**. Add a `[NOTE]` comment at the revision site:

```markdown
<!-- [NOTE] Alternative fix applied: used a table instead of inline list
because the section has 6 parameters with 3 attributes each (style-guide
rule: tables for structured multi-attribute data). -->
```

**What counts as "differs significantly":**

- Using a different structure (list vs. table, subsection vs. callout)
- Rewriting the passage rather than editing it
- Addressing the issue in a different location than suggested
- Adding content the reviewer did not specifically suggest

**What does NOT require a `[NOTE]`:**

- Minor wording changes to the suggested fix
- Adjusting the fix to match the style guide
- Combining multiple MUST items into a single structural fix

**3. Address SHOULD items**

Work through SHOULD items with the expectation that you will address most of them.

**Addressing a SHOULD item:**

- Apply the suggested fix or an alternative fix
- No special documentation needed

**Declining a SHOULD item:**

You may decline a SHOULD item if you have a **substantive reason**. Add an entry to the draft's front matter in a `## Review Responses` section:

```markdown
## Review Responses

- [DECLINED: "Configuration" — term consistency] Kept "config file" instead
  of "configuration file" because the CLI uses `config` in all its flags and
  the project's CLAUDE.md uses "config" as the canonical short form.

- [DECLINED: "Add troubleshooting section" — scope boundary] Troubleshooting
  is out of scope per 00-request.md ("how-to guide, not comprehensive reference").
  Noted as a potential follow-on document in the Gaps section of 01-research.md.
```

**What is a substantive justification:**

- References a style guide rule that contradicts the suggestion
- References the audience profile (e.g., "target audience uses this term in their daily workflow")
- References a scope boundary from `00-request.md`
- References a structural constraint (e.g., "adding this would duplicate content in section X")
- References verified terminology from the codebase or official docs that conflicts with the suggestion

**What is NOT substantive:**

- "Preferred the original" (opinion)
- "Already clear enough" (subjective)
- "Too much work" (not a reason)
- "Disagree" (must explain why)

**Convergence rule:** If you decline a SHOULD item with justification, the Editor may accept the decline or escalate it to MUST — but escalation requires **new evidence** not present in the original review. See `review-taxonomy.md` for convergence rules.

**4. Address MINOR items (optional)**

Handle MINOR items at your discretion. No justification or response needed if you skip them.

**Good practice:** If a MINOR fix takes less than 10 seconds (word choice, extra whitespace), apply it. If it requires rethinking a paragraph, skip it unless you have time.

**5. Apply progressive disclosure principles**

As you revise, ensure the draft maintains progressive disclosure layering:

1. **Heading + first sentence** — skimming reader gets the gist
2. **Full section prose** — reading reader gets working knowledge
3. **Subsections and callouts** — deep reader gets expert detail

**Revision anti-pattern:** Adding content that flattens the layers. If an SME note calls for additional context, ask: where in the disclosure stack does this belong? Do not add expert-level detail to the overview paragraph.

**6. Enforce the length constraint**

After applying all changes, count the total words. Compare against:

- **The previous draft's word count:** The revision should be the same length or shorter, unless feedback explicitly called for added content.
- **The target length from `00-request.md`:** The revision must not exceed the target by more than 20%.

**If the revision is longer than the previous draft:**

- Every additional word must trace to a specific review finding. If it doesn't, it's inflation — cut it.
- If addressing feedback required adding content, identify where to cut an equivalent amount elsewhere.

**If the revision exceeds the 20% ceiling:**

- Review each section's word count against the outline's word budgets.
- Cut sections that have grown beyond their budgets.
- If you cannot bring the revision within the ceiling, add a `[LENGTH NOTE]` comment explaining the tension.

**Length inflation is the primary mechanism by which the pipeline produces bloated documents.** Each revision round adds a few paragraphs of "clarification" or "context" that locally seem justified but cumulatively push the document far past its target. Your job is to resist this. Address the finding, do not add padding.

### Phase 4: Document Your Work

**1. Create the `## Review Responses` section (if needed)**

If you declined any SHOULD items, add a `## Review Responses` section at the top of the draft (after the title but before the main content):

```markdown
# [Document Title]

## Review Responses

- [DECLINED: brief identifier] Justification with reference to style guide, audience profile, scope, or verified source.

[Continue with main content...]
```

**If you did not decline any SHOULD items:** Do not create this section. An empty "Review Responses" section is noise.

**2. Add `[NOTE]` comments for alternative fixes**

When you applied an alternative fix to a MUST item that differs significantly from the suggested fix, add an inline `[NOTE]` comment at or near the revision site:

```markdown
<!-- [NOTE] Alternative fix applied: [explanation of what you did differently and why it resolves the issue] -->
```

**3. Add `[DOWNGRADED]` comments for QA downgrades**

When you downgraded a QA Reader confusion point using the audience-plausibility filter, add an inline `[DOWNGRADED]` comment at or near the revision site:

```markdown
<!-- [DOWNGRADED: reasoning referencing the audience profile from 00-request.md] -->
```

**4. Remove obsolete markers**

If the previous draft had `[UNVERIFIED]` markers that review feedback resolved (e.g., the SME provided verification), remove the markers and update the claim with the new citation.

**5. Add word count metadata**

At the end of the revised draft, add or update the word count comment:

```markdown
<!-- Word count: X words | Target: Y words | Δ: +/-Z (W%) -->
```

**6. Self-review**

Before writing the revision to disk, run the self-review checklist (see below).

## Success Criteria

Before submitting your revision, verify:

- [ ] Every MUST item from the review has been addressed (zero exceptions)
- [ ] Every declined SHOULD item has a `[DECLINED]` entry in `## Review Responses` with substantive justification
- [ ] Every alternative fix for a MUST item has a `[NOTE]` comment explaining the approach
- [ ] Every downgraded QA confusion point has a `[DOWNGRADED]` comment referencing the audience profile
- [ ] **If a Reorganization Map was present, all CUT/MERGE/CONDENSE actions have been applied**
- [ ] **The revision is the same length or shorter than the previous draft, unless feedback explicitly called for added content**
- [ ] **The revision does not exceed the target length from `00-request.md` by more than 20%**
- [ ] **Word count comment appears at the end of the file**
- [ ] All new or updated claims have source citations
- [ ] Progressive disclosure layering is maintained (heading + first sentence gives gist, sections layer detail)
- [ ] Style guide compliance is maintained (voice, structure, formatting, naming)
- [ ] No review feedback was ignored silently (every item has a fix, a decline with justification, or is MINOR)

## Key Rules

These constraints apply to this task:

1. **Address every MUST item.** Zero exceptions. No justifications accepted for skipping MUST items.
2. **Respect the target length.** The revision must not exceed the target from `00-request.md` by more than 20%. The target is the anchor — not the previous draft's length.
3. **Apply the Reorganization Map first.** If the Editor provided CUT/MERGE/CONDENSE actions, apply them before addressing per-pass findings. Do not add compensating content when cutting.
4. **Substantive justifications only.** "Preferred the original" is not substantive. Reference the style guide, audience profile, scope boundaries, or verified sources.
5. **Accuracy wins.** When Editor and SME conflict, fix accuracy first, then apply style.
6. **Apply the audience-plausibility filter.** QA Reader confusion points must be evaluated against the declared target audience, not the QA Reader's actual background.
7. **Document all downgrades.** Every QA downgrade requires a `[DOWNGRADED]` comment referencing the audience profile.
8. **Do not inflate across rounds.** Revisions address specific feedback. Do not add padding, extra qualifiers, or redundant explanations to sections the reviewer did not flag.
9. **Follow the style guide.** Revision does not exempt you from style compliance. Maintain voice, structure, and formatting rules.
10. **Do not expand scope.** If review feedback requests out-of-scope content, note it as a scope conflict. Do not add out-of-scope material to satisfy a review item.
11. **Maintain progressive disclosure.** SME context belongs at the appropriate depth level. Do not dump expert knowledge into overview paragraphs.

## Review Type Differences

### Editor review (Steps 4b, 11b)

**Focus:** Structure, style, clarity, consistency, tone
**Format:** MUST/SHOULD/MINOR items, potentially with Reorganization Map (CUT/MERGE/CONDENSE actions)
**Special handling:**

- If a Reorganization Map is present, apply it first before addressing per-pass findings.
- Editor structural recommendations may conflict with style guide. Style guide wins. Note conflicts in `[NOTE]` comments.
- Editor second-pass (11b) makes inline edits for SHOULD/MINOR rather than producing a review. Treat second-pass inline edits as if they were MUST items from the first pass.

### SME review (Step 5b)

**Focus:** Technical accuracy, completeness, edge cases, security
**Format:** MUST/SHOULD/MINOR items with evidence citations
**Special handling:**

- SME MUST items for factual errors override all other concerns. Fix accuracy, then reapply style.
- SME evidence citations should be incorporated into the draft as source references (update your inline citations).
- SME context must be integrated at the correct depth level (do not add expert detail to overview sections).
- If SME requests out-of-scope material, note as a scope conflict. Do not expand scope.

### QA Reader review (Step 11d)

**Focus:** Cold read comprehension, clarity from beginner perspective
**Format:** Confusion points with severity self-assessments (not MUST/SHOULD/MINOR)
**Special handling:**

- Map confusion points to MUST/SHOULD/MINOR using the audience-plausibility filter.
- Downgrade confusion points when the QA Reader lacks prerequisite knowledge the target audience has.
- Document all downgrades with `[DOWNGRADED]` comments referencing the audience profile.
- The Editor validates downgrade judgments on the next pass.

## Common Pitfalls

**1. Ignoring MUST items silently**

Bad: Skipping a MUST item because you disagree with it
Good: Addressing every MUST item, even if you apply an alternative fix with a `[NOTE]` comment

**2. Declining SHOULD items with weak justifications**

Bad: `[DECLINED: "Use simpler phrasing"] Preferred the original`
Good: `[DECLINED: "Use simpler phrasing"] Kept technical term "eventual consistency" because the audience profile specifies "developers familiar with distributed systems" and the term appears 12 times in the codebase without qualification (backend/src/db/client.ts).`

**3. Downgrading QA confusion without audience-profile reasoning**

Bad: `[DOWNGRADED: this is obvious]`
Good: `[DOWNGRADED: target audience profile specifies "working knowledge of REST APIs" — HTTP status codes do not require definition per 00-request.md audience section]`

**4. Inflating prose across revision rounds**

Bad: Draft v1 is 800 lines, Draft v1r1 is 1,100 lines, but only 50 lines address reviewer feedback (300 lines added are padding)
Good: Draft v1 is 800 lines, Draft v1r1 is 820 lines (20 lines address reviewer feedback, no inflation)

**5. Dumping SME knowledge into the wrong layer**

Bad: SME provides edge-case detail, you add it to the overview paragraph
Good: SME provides edge-case detail, you add it as a subsection or callout under the relevant procedure so deep readers find it

**6. Applying Editor style recommendations that violate the style guide**

Bad: Editor suggests passive voice, you apply it (style guide prohibits passive voice in procedures)
Good: You note the conflict: `[NOTE] Kept active voice per style-guide.md rule: "Use active voice in all procedures." Editor suggestion applied to non-procedure prose.`

**7. Treating MINOR as MUST**

Bad: Spending 30 minutes rewriting a paragraph for a MINOR word-choice suggestion
Good: Skipping MINOR items when time-constrained, addressing them when convenient

**8. Forgetting to remove obsolete `[UNVERIFIED]` markers**

Bad: SME provides verification, but you leave the `[UNVERIFIED]` marker in the draft
Good: SME provides verification, you remove the marker and update the claim with the SME's source citation

**9. Adding compensating content after cutting**

Bad: Editor says "CUT section 'Dependency Analysis' — redundant." You cut it but add a 300-word summary paragraph covering the same ground.
Good: Editor says "CUT section 'Dependency Analysis'." You cut it. The content that remains in other sections already covers the topic.

**10. Ignoring the length constraint during revision**

Bad: Adding 500 words of SME-requested context without cutting 500 words elsewhere, pushing the draft from 2,600 to 3,100 against a 2,400-word target
Good: Adding 500 words of SME-requested context, cutting 500 words of redundancy or over-explanation elsewhere, keeping the draft at 2,600

## Notes

- **Max 2 revision rounds per gate.** If MUST items persist after 2 rounds, the Manager escalates to the user. Do not assume you have infinite revision attempts.
- **Second-pass behavior.** On the Editor's second pass (Step 11b), the Editor makes inline edits for SHOULD/MINOR items instead of producing a review document. Treat second-pass inline edits as if they were MUST items.
- **Declined items and convergence.** If you decline a SHOULD item with justification, the Editor may accept the decline or escalate to MUST with **new evidence**. The Editor may not re-raise the same item as SHOULD with stronger language. See `review-taxonomy.md` for convergence rules.
- **Audience-plausibility filter is critical for QA feedback.** The QA Reader may not match the target audience. Your job is to translate their confusion into severity levels appropriate for the actual target audience. The Editor validates your downgrades.
- **Revision is not rewriting.** You are addressing specific feedback, not producing a new draft. Stay focused on the review items. Do not rewrite sections the reviewer did not flag.
- **The target length is your anchor.** Not the previous draft's length. If the previous draft was already over the target, the revision should bring it closer — not push it further. Every revision is an opportunity to tighten, not just correct.
