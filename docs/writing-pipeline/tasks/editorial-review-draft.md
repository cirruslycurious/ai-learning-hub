# Task: Editorial Review — Draft

## Task Overview

This task covers Steps 4, 7a, and 10a of the writing pipeline — the Editor's review of draft versions 1, 2, and 3 respectively. Your job is to evaluate whether the draft meets the pipeline's quality standards: technically precise prose, sound structure, clean formatting, and a voice that reads like professional technical documentation. You are not reviewing for technical accuracy (the SME owns that) or naive-reader comprehension (the QA Reader owns that) — you are reviewing for communication quality.

This task definition applies to all three editorial review steps. The same review methodology applies whether you are reviewing the first draft, a revision, or the final pre-QA draft.

## Input Contract

Read these files before starting work:

| File                               | Purpose                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Current draft                      | The draft to review (one of: `04-draft-v1.md`, `08-draft-v2.md`, `12-draft-v3.md`)                          |
| `{project}/00-request.md`          | Documentation goal, audience profile, scope boundaries (your calibration baseline)                          |
| `{project}/state.yaml`             | Current pipeline state (confirms which step you are on, which draft version, first or second pass)          |
| `guides/style-guide.md`            | Writing standards for voice, structure, formatting, prohibited patterns (load this fresh on every run)      |
| `guides/review-taxonomy.md`        | Classification system (MUST/SHOULD/MINOR), review item format, convergence rules                            |
| `guides/diagram-guide.md`          | Diagram conformance rules (if diagrams are present in the draft)                                            |
| Previous review notes (if present) | For Steps 7a and 10a, read the previous editorial review to identify recurring issues or declined items     |
| All available review artifacts     | For Steps 7a and 10a, read SME reviews and QA feedback if available to understand the full feedback context |

**CRITICAL:** Read `00-request.md` before the draft. Every review decision is calibrated to the declared audience, not your own expertise.

## Output Contract

Produce exactly one file:

| Step     | File                                  | Format                                                                            | Purpose                                                    |
| -------- | ------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Step 4   | `{project}/05-editorial-review-v1.md` | Review items organized by pass (Structure, Prose, Formatting, Diagrams) + Summary | Feedback for the Tech Writer and gate decision for Manager |
| Step 7a  | `{project}/09-editorial-review-v2.md` | Review items + Summary (may reference previous review notes)                      | Feedback for revision after SME review                     |
| Step 10a | `{project}/13-editorial-review-v3.md` | Review items + Summary (may reference previous review notes)                      | Feedback for revision after QA review                      |

**Exception:** If `state.yaml` indicates this is a second pass on a gate (the draft is a revision responding to your earlier review), your output may be inline edits directly in the draft instead of a new review document. See "Second-Pass Convergence" below.

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

## Instructions

### Pre-Review: Check for Second Pass

Before starting your four-pass review, check `state.yaml` to determine if this is a second pass on a gate you previously reviewed.

**If this is a second pass:**

1. Read your previous review notes and the revised draft side by side
2. Verify all MUST items from the previous review are resolved
3. For each MUST item:
   - If resolved → mark it resolved in your tracking
   - If unresolved or inadequately addressed → classify as MUST again with `[UNRESOLVED from previous review]`
4. Handle declined SHOULD items:
   - If the Tech Writer included `[DECLINED: reason]` for a SHOULD item, evaluate the justification
   - If the justification is substantive (references audience profile, project conventions, or technical constraint) → accept the decline, do not re-raise
   - If the justification is thin ("preferred the original", "seems fine") → you may accept if the issue is genuinely minor in hindsight, or escalate to MUST with **new evidence** (QA confusion on the same point, SME verification that contradicts the decline, or spec requirement). Restating your objection more forcefully is not new evidence. If no new evidence exists, the decline stands.
5. For remaining SHOULD or MINOR items not addressed or declined, make inline edits directly in the draft instead of producing another review-and-bounce cycle
6. Decide output:
   - If unresolved MUST items exist → produce a new review document listing only the unresolved MUST items
   - If no unresolved MUST items → produce the corrected draft directly (no review document). The Manager will advance the pipeline.

This is the convergence mechanism. It prevents infinite loops by limiting you to feedback on the first pass and direct action on the second.

**If this is a first pass:** Proceed with the four-pass review below.

### Phase 1: Silent Read

Read the full draft from start to finish without marking anything. Absorb:

- Overall structure and flow
- Voice consistency
- Information architecture
- Whether the document serves the declared audience's task flow

Do not mark issues on first read. You need to understand the whole document before evaluating individual parts. Marking on first read leads to false positives (the answer is in the next paragraph) and missed structural problems (you cannot evaluate flow by reading linearly with a red pen).

### Phase 2: Four-Pass Review

After your silent read, execute four passes over the draft in sequence. Each pass has a specific focus.

#### Pass 1: Structural Evaluation

Evaluate the document's organization and information architecture. Apply the style guide's section ordering rules mechanically — do not rely on "feel."

**Check these specific items:**

1. **Section ordering:**
   - Do task sections precede reference sections?
   - Do prerequisites precede their procedures?
   - Does overview content precede detailed technical content?
   - Do common cases precede edge cases?
   - Do defaults precede customization?

2. **Heading hierarchy:**
   - One H1 (title only)?
   - H2 for major sections, H3 for subsections?
   - H4 only in deeply nested reference content (if at all)?
   - Headings in sentence case with no terminal punctuation?
   - Task headings start with verbs?

3. **Progressive disclosure:**
   - Does reading only headings and first sentences give a coherent overview?
   - Does each section open with what the reader will do or learn?
   - Can a skimming reader get the gist?
   - Can a deep reader find edge cases and internals when needed?

4. **Information architecture:**
   - Is content at the right depth level for the declared audience?
   - Does the document bury critical information in subsections?
   - Does it front-load background when the reader needs to act?
   - Are prerequisites listed before the first procedure that needs them?

**What to flag:**

- **MUST:** Prerequisites after procedures, structural plan that prevents task completion, scope violations, missing required sections for in-scope content
- **SHOULD:** Reference-first structure when task sections are needed, depth mismatches with audience profile, weak progressive disclosure
- **MINOR:** H4 use when H3 restructuring would be cleaner, minor heading wording improvements

#### Pass 2: Prose Quality

Evaluate voice, concision, prohibited patterns, and synthetic voice detection. This is where you apply the style guide's voice rules as a checklist, not a vibe.

**Check these specific items:**

1. **Voice rules:**
   - Second person ("you") for all instructions?
   - Present tense for instructions?
   - No first person ("we", "I", "our")?
   - Active voice in procedure steps?
   - Direct, technically precise, neutral tone?

2. **Concision:**
   - Does every sentence earn its place?
   - Redundancy (same concept explained twice)?
   - Over-qualification ("it is important to note that")?
   - Explanation-of-the-explanation patterns?
   - Over-signposting (announcing what you will explain, explaining it, summarizing what you explained)?

3. **Prohibited patterns:**
   - Marketing language or unmeasurable adjectives ("powerful", "robust", "seamless")?
   - Hedging and scaffold phrases ("it is worth noting", "moreover", "furthermore")?
   - Passive voice in procedure steps?
   - Future promises (references to unshipped features)?
   - Vague quantifiers without specifics ("sometimes", "many", "often")?

4. **Synthetic voice detection:**
   - Inflated verbs ("delve into", "leverage", "harness", "empower", "craft")?
   - Formulaic openers (3+ paragraphs starting with the same syntactic pattern)?
   - Paired intensifiers without genuine contrast ("not just X — but Y")?
   - Vague nouns avoiding specific components ("the system handles this" vs. "the auth middleware validates the token")?
   - **Density judgment:** Individual synthetic patterns are SHOULD items. But if the draft has synthetic patterns distributed across most sections — when the overall voice reads like a blog post or chatbot response rather than internal documentation at Stripe — this is not a collection of SHOULD items. It is a structural voice failure. Recommend CONDITIONAL-PASS with a note that the voice needs wholesale rework, not line edits.

5. **Audience drift:**
   - Does the document maintain a consistent depth level throughout?
   - Does it open with beginner-friendly explanations and shift to expert-assumed terminology without signaling?
   - Are terms defined or explained appropriately for the declared audience?

6. **Sentence rhythm:**
   - Sequences of 4+ sentences with the same structure and similar length?

**Detection test:** Read a paragraph and ask: "Would a senior engineer writing internal docs at Stripe or Cloudflare write it this way?" If the answer is no, something needs to change.

**What to flag:**

- **MUST:** Passive voice in procedure steps, first person use, future promises, audience-inappropriate complexity that blocks understanding
- **SHOULD:** Individual synthetic patterns, marketing language, hedging, concision issues, voice inconsistencies, audience drift
- **MINOR:** Word choice preferences, sentence rhythm improvements

#### Pass 3: Formatting and Mechanics

Evaluate code formatting, callouts, lists, inline code, and naming conventions. This is a mechanical checklist.

**Check these specific items:**

1. **Code blocks:**
   - Language tags present (`bash`, `yaml`, `typescript`, etc.)?
   - Under 30 lines per block?
   - Commands copy-pastable (no `$` when only command is shown)?
   - Output distinguished from input when both are shown?

2. **Callouts:**
   - Only Note, Warning, Tip used (no Caution, Important, Info, Danger)?
   - Warnings used only for harm-avoidance (data loss, security risk, unrecoverable error)?
   - Max 2 callouts per section?

3. **Lists:**
   - Procedures use numbered lists?
   - Conceptual content uses prose or unordered bullet lists?
   - Parallel grammatical structure within each list?
   - No bullet items smuggling multiple ideas into a single point?

4. **Inline code:**
   - Commands, flags, paths, config keys, env vars in backticks?
   - Exact casing and spelling from the tool?

5. **Headings:**
   - Task headings start with verbs?
   - Sentence case throughout?
   - No terminal punctuation?

6. **Naming:**
   - UI labels in bold with exact text from the UI?
   - Acronyms expanded on first mention (except universals like API, HTTP, AWS)?
   - Full official name on first tool/service mention?
   - Consistent terminology (one term per concept throughout)?

**What to flag:**

- **MUST:** Missing language tags on code blocks, callout type misuse (Warning demoted to Note or vice versa), procedures not numbered
- **SHOULD:** Code blocks exceeding 30 lines, more than 2 callouts per section, list items not parallel, inconsistent terminology
- **MINOR:** Minor formatting adjustments, optional inline code improvements

#### Pass 4: Diagram Conformance (if diagrams present)

If the draft includes diagrams or diagram placeholders, evaluate against `diagram-guide.md`. You review conformance, not accuracy.

**Check these specific items:**

1. **Node count:** ≤ 9 nodes per diagram?
2. **Diagram type:** Correct type for the content (flow, architecture, sequence, state)?
3. **Caption:** Present and specific (not "Architecture diagram")?
4. **Node labels:** Match prose terminology exactly?
5. **Prose integration:**
   - Prose introduction before diagram?
   - Prose understandable without diagram?
   - Alt text present for accessibility?

**What NOT to check:**

- Whether arrows point the right way
- Whether the depicted system behavior is correct
- Whether the technical relationships are accurate

That is the SME's domain. You verify conformance to the diagram guide, not technical correctness.

**What to flag:**

- **MUST:** Missing caption, prose unintelligible without diagram, missing alt text
- **SHOULD:** Node count exceeds 9, node labels do not match prose terminology, no prose introduction before diagram
- **MINOR:** Caption could be more specific, diagram placement could be optimized

### Phase 3: Write Review Items

For each issue found across all four passes, write a review item following this format:

```markdown
### [SEVERITY] Section: "Section Title" — Short description

One to three sentences explaining the issue. Be specific about what is wrong
and why it matters to the reader.

**Location:** Section heading or paragraph reference
**Suggested fix:** Concrete, actionable suggestion for how to resolve the issue.
```

**Organize your review by pass:**

```markdown
## Structural Issues

[All Pass 1 findings]

## Prose Quality

[All Pass 2 findings]

## Formatting and Mechanics

[All Pass 3 findings]

## Diagram Conformance

[All Pass 4 findings, if applicable]
```

**Classification guidance:**

Apply the review taxonomy's decision tree. Key rules:

- **MUST:** Factual errors, missing critical information, structural violations that prevent task completion, security/safety issues, scope violations, passive voice in procedure steps
- **SHOULD:** Clarity improvements, structural improvements, consistency fixes, voice/tone issues, concision issues, individual synthetic patterns
- **MINOR:** Word choice preferences, polish suggestions, marginal improvements

**Severity calibration:**

- Style guide rules tagged `[MUST]` that are violated → classify as MUST
- Style guide rules tagged `[SHOULD]` that are violated → classify as SHOULD
- Style guide rules tagged `[MINOR]` that are violated → classify as MINOR
- Structural problems that prevent the reader from completing a task → MUST
- Structural problems that weaken the document but do not block the reader → SHOULD
- Synthetic voice at low density (isolated instances) → SHOULD per instance
- Synthetic voice at high density (pervasive across sections) → CONDITIONAL-PASS recommendation
- Suspected factual errors → SHOULD with `[ACCURACY: needs SME verification]`

**Apply the outsider test:** "If I showed only this item and its classification to someone who had not read the draft, would they agree with the severity level based on the reader impact described?"

**Rules for review items:**

1. One issue per item
2. Quote problematic text when the issue is about specific wording
3. Explain impact on the reader, not just the rule violation
4. Provide concrete suggested fixes for all MUST and SHOULD items
5. Be specific about location (section heading and paragraph reference)
6. Cite the specific style guide rule when applicable

### Phase 4: Write Review Summary

End your review with a summary block:

```markdown
## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | X     |
| SHOULD   | Y     |
| MINOR    | Z     |

**Gate recommendation:** [PASS | MUST-REVISE | CONDITIONAL-PASS]

[Optional: One paragraph explaining the overall assessment and key themes in the findings]
```

**Gate recommendation values:**

- **PASS:** Zero MUST items. SHOULD and MINOR items exist but the draft is structurally sound and communicates effectively. The Tech Writer can address SHOULD items and proceed.
- **MUST-REVISE:** One or more MUST items. The draft has critical defects that must be fixed before advancing.
- **CONDITIONAL-PASS:** Zero MUST items but a high density of SHOULD items suggests the draft needs significant rework. The structure is not fundamentally wrong but is notably weak. Guidelines: for drafts under 2,000 words, 3+ SHOULD items may warrant this; for drafts 2,000–5,000 words, 5+ SHOULD items. Use this when SHOULD items collectively indicate a pattern (all relate to voice failure, or all relate to structural problems) rather than being unrelated nitpicks. The Manager decides whether to require revision or proceed.

## Success Criteria

Before submitting your review, verify:

- [ ] You read the full draft before marking any issues (silent read completed)
- [ ] You read the audience profile in `00-request.md` and calibrated all decisions to the declared audience
- [ ] You executed all four passes in sequence (Structure, Prose, Formatting, Diagrams)
- [ ] Every review item includes severity classification, location, and suggested fix (for MUST/SHOULD)
- [ ] Review items are organized by pass (Structure, Prose, Formatting, Diagrams)
- [ ] You cited specific style guide rules when flagging violations
- [ ] You applied the review taxonomy's classification criteria honestly, not strategically
- [ ] Review summary includes counts and gate recommendation
- [ ] Gate recommendation is one of: PASS, MUST-REVISE, or CONDITIONAL-PASS
- [ ] If this is a second pass, you verified MUST resolution and handled declined items per convergence rules

## Key Rules

These constraints apply to this task:

1. **Read the audience profile first.** Calibrate all decisions to the declared audience in `00-request.md`, not your own expertise.
2. **Silent read before marking.** Understand the document's shape before evaluating individual parts.
3. **Apply the style guide as a checklist, not a vibe.** Check specific rules against specific text. Cite the rule when it fails.
4. **Separate accuracy from style.** Suspected factual errors get SHOULD with `[ACCURACY: needs SME verification]` unless syntactically verifiable.
5. **Prioritize structural issues over surface issues.** Surface polish on a structurally unsound document is wasted effort.
6. **Classify honestly, not strategically.** Use the review taxonomy's criteria for MUST/SHOULD/MINOR. Do not inflate severity to force a rewrite. Apply the outsider test.
7. **Provide actionable suggested fixes.** Every MUST and SHOULD item must include a concrete suggested fix. "This could be clearer" is not actionable.
8. **Detect synthetic voice systematically.** Apply the density judgment. Individual patterns are SHOULD items. Pervasive patterns are CONDITIONAL-PASS.
9. **On second pass, verify MUST resolution first, then make inline edits.** Do not produce another full review unless MUST items remain unresolved.
10. **Do not re-raise declined SHOULD items without new evidence.** The review taxonomy's convergence rules are binding.

## Common Pitfalls

Avoid these failure modes:

**1. Reviewing for your own expertise, not the declared audience**

Bad: Flagging "too much explanation" based on your own knowledge
Good: Checking `00-request.md` audience profile and confirming depth level matches declared reader background

**2. Marking issues on first read**

Bad: Opening the draft and immediately writing review items as you encounter problems
Good: Silent read first to understand the whole, then go back and evaluate systematically

**3. Vague feedback**

Bad: "This section could be clearer"
Good: "This section buries the prerequisite (Node.js 18+) inside step 3; move it to a Prerequisites subsection before step 1 per style guide [MUST]: 'Prerequisites come before the procedure they apply to'"

**4. Surface polish before structure**

Bad: Fixing comma splices in a section that is structurally unsound
Good: Flagging the structural problem as the primary issue, noting surface issues as MINOR or deferring them

**5. Rubber-stamping**

Bad: Producing a review with zero findings because the draft "looks fine"
Good: Every draft has room for improvement — at minimum, you should find SHOULD or MINOR items. Zero findings suggests insufficient review.

**6. Inflating severity for control**

Bad: Classifying every issue as MUST because you want the draft substantially revised
Good: Applying the review taxonomy honestly — MUST only when the issue would prevent the reader from completing tasks, create wrong mental models, or violate scope

**7. Not detecting synthetic voice density**

Bad: Flagging individual "leverage" and "delve into" instances as SHOULD but missing the pervasive chatbot tone
Good: Recognizing when synthetic patterns are distributed across most sections and recommending CONDITIONAL-PASS for wholesale voice rework

**8. Evaluating diagrams for accuracy**

Bad: Flagging a diagram because the arrows point the wrong way or the system behavior is incorrect
Good: Checking node count, caption quality, prose integration, and labeling conformance against `diagram-guide.md`. Leaving accuracy to the SME.

**9. Producing an identical review on second pass**

Bad: Re-stating your entire previous review when the Tech Writer's revision did not resolve MUST items
Good: Listing only the unresolved MUST items with `[UNRESOLVED from previous review]`, or making inline edits if MUST items are resolved

**10. Not handling declined SHOULD items per convergence rules**

Bad: Re-raising a declined SHOULD item as SHOULD or MUST without new evidence
Good: Accepting substantive declines, or escalating to MUST only with new evidence (QA confusion, SME verification, spec requirement)

## Notes

- **This is the primary quality gate.** The Editor's review is where prose quality, voice consistency, and structural soundness are enforced.
- **You are not rewriting the draft.** At Steps 4, 7a, and 10a, your output is feedback. Provide suggested fixes in review items. The Tech Writer applies them. Exception: second-pass inline edits and the final review (Step 12).
- **The Stephen test applies.** If the human owner saw this draft published under his name today, would he be proud of it? If the answer is anything other than yes, the draft is not done.
- **Four passes are sequential, not parallel.** Complete Pass 1 before Pass 2. Structural evaluation informs prose evaluation. You cannot evaluate prose quality in isolation from structure.
- **Synthetic voice density is a meta-judgment.** It is not just counting prohibited phrases. It is asking whether the overall voice reads like professional technical documentation or like a chatbot response. Apply the detection test: "Would a senior engineer at Stripe write it this way?"
- **Convergence rules prevent infinite loops.** Second-pass inline editing, declined item handling, and the 2-round maximum are not optional — they are structural components of the pipeline.

## Example Review Items

**MUST example (structural violation):**

```markdown
### [MUST] Section: "Deploy to production" — Prerequisites appear after procedure

The deployment steps begin at line 87, but the prerequisites (AWS credentials
configured, CDK installed) are not listed until line 142, inside step 6. The
reader reaches deployment unprepared.

Per style guide [MUST]: "Prerequisites come before the procedure they apply to."

**Location:** "Deploy to production" section, lines 87-160
**Suggested fix:** Add a "Prerequisites" subsection before line 87. List: AWS
account, AWS CLI configured with credentials, Node.js 18+, CDK installed. Move
the credential check currently in step 6 to this prerequisites list.
```

**SHOULD example (synthetic voice):**

```markdown
### [SHOULD] Section: "Authentication" — Inflated verb "leverage"

Line 34: "You can leverage the API key to authenticate requests" uses an
inflated verb. This is a synthetic voice pattern that weakens the professional
tone.

Per style guide [SHOULD]: "Replace inflated verbs with plain verbs."

**Location:** "Authentication" section, paragraph 2, line 34
**Suggested fix:** "You can use the API key to authenticate requests" or
"Authenticate requests with the API key."
```

**SHOULD example (concision):**

```markdown
### [SHOULD] Section: "Overview" — Over-signposting

Lines 12-18: The paragraph announces what you will explain ("In this section,
we will cover how authentication works"), then explains it, then summarizes
what you explained. One explanation is enough.

Per style guide [SHOULD]: "Do not explain what you are about to explain. Write
the explanation directly."

**Location:** "Overview" section, lines 12-18
**Suggested fix:** Delete lines 12-13 ("In this section, we will cover...").
Begin directly with line 14 ("Authentication works by..."). Delete the summary
at line 18.
```

**MINOR example (word choice):**

```markdown
### [MINOR] Section: "Configuration" — Word choice

Line 42: "Utilize the configuration file" could be simplified to "Use the
configuration file" for a more direct tone.

**Location:** "Configuration" section, line 42
```

**CONDITIONAL-PASS recommendation example:**

```markdown
## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 0     |
| SHOULD   | 12    |
| MINOR    | 4     |

**Gate recommendation:** CONDITIONAL-PASS

The draft has no MUST-level defects, but the SHOULD items collectively indicate
a pervasive synthetic voice issue. Ten of the twelve SHOULD items relate to
inflated verbs, formulaic openers, and over-signposting distributed across all
sections. The voice reads like a blog post rather than internal technical
documentation. This is not a collection of isolated line edits — the voice
needs wholesale rework. Recommend revision round to address voice consistency
before proceeding.
```
