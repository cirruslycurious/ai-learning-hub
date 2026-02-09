# Review Taxonomy

This document defines the severity classification system used by all reviewing agents (Editor, SME, QA Reader) and the handling rules that all producing agents (Tech Writer, Designer) must follow when responding to review feedback.

Every review item in the pipeline is classified into exactly one severity level. The classification determines whether a revision is required, optional, or at the author's discretion.

---

## Severity Levels

### MUST

A MUST item represents a defect that **cannot ship**. If any MUST items exist in a review, the gate fails and revision is required before the pipeline advances.

**Criteria — an item is MUST if it meets any of these:**

| Category                     | Description                                                                                                                                                                                                             | Examples                                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factual error                | The content states something that is objectively wrong                                                                                                                                                                  | Wrong command syntax, incorrect parameter name, inaccurate behavior description, wrong default value                                                                                                       |
| Missing critical information | The reader cannot complete a task or understand a concept without information that is absent                                                                                                                            | Undocumented prerequisite, missing step in a procedure, undefined term used without explanation                                                                                                            |
| Misleading framing           | Technically true but creates a wrong mental model that will cause the reader to make mistakes later                                                                                                                     | Describing an async operation as synchronous, implying a feature is stable when it is experimental                                                                                                         |
| Comprehension blocker        | Ambiguity that changes what action the reader takes or blocks completing the core workflow. Must be evaluated against the audience profile declared in the project request — not the reviewer's personal comprehension. | Ambiguous pronoun in a procedure where the reader could act on the wrong object, undefined term that gates a decision, circular definition that prevents the reader from proceeding                        |
| Structural violation         | The document's structure prevents the reader from completing a task or creates a dangerous misunderstanding. Style-guide conformance issues that do not block the reader belong under SHOULD (Structural improvement).  | Missing required section that contains safety-critical steps, heading hierarchy that nests a prerequisite inside a later step so readers skip it, procedures split across sections with no cross-reference |
| Security or safety issue     | Following the instructions as written could cause harm                                                                                                                                                                  | Instructions that expose credentials, commands that delete data without warning, procedures missing rollback steps                                                                                         |
| Diagram inaccuracy           | A diagram contradicts the text or depicts an incorrect relationship                                                                                                                                                     | Wrong arrow direction in a flow, missing node in an architecture diagram, incorrect cardinality                                                                                                            |
| Scope violation              | The content introduces, omits, or deviates from the defined scope, audience, or document type                                                                                                                           | Architecture depth in a beginner quickstart, marketing positioning in a reference doc, omitting a required scope element, optimizing for a different reader than specified                                 |

**Gate behavior:** Any review containing one or more MUST items triggers a mandatory revision round.

---

### SHOULD

A SHOULD item represents a significant improvement opportunity. The content is not wrong, but it is notably weaker than it needs to be. SHOULD items do not independently block the gate, but a high density of them relative to document length signals the draft needs substantial rework and the Manager may treat it as a gate failure (see CONDITIONAL-PASS in Review Summary Format).

**Criteria — an item is SHOULD if it meets any of these:**

| Category               | Description                                                                                                | Examples                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clarity improvement    | The meaning is recoverable but requires re-reading or inference                                            | Dense paragraph that should be a list, implicit assumption that should be stated, vague quantifier ("many", "sometimes") where specifics exist                                                                    |
| Structural improvement | The information exists but is in the wrong place or poorly organized                                       | Prerequisite buried in the middle of a procedure, reference material mixed into a tutorial section, related concepts split across distant sections                                                                |
| Consistency fix        | The content contradicts itself or uses inconsistent terminology                                            | Calling the same thing "config file" in one section and "settings file" in another, inconsistent capitalization of product names                                                                                  |
| Missing context        | The content would benefit from additional context that aids understanding but is not strictly required     | A "why" explanation for a non-obvious step, a cross-reference to related documentation, a note about common pitfalls                                                                                              |
| Tone or voice issue    | The writing violates the style guide's voice and tone rules in ways that affect professionalism or clarity | Marketing language in a technical guide, passive voice in instructions, inconsistent formality level                                                                                                              |
| Concision issue        | The content is redundant, bloated, or over-explains relative to the target audience                        | Same concept explained twice in different sections, excessive defensive qualifiers ("it is important to note that"), explaining obvious steps to an advanced audience, verbosity inflation across revision rounds |
| Diagram improvement    | A diagram is accurate but could communicate more effectively                                               | Missing labels on connections, suboptimal layout that obscures the main flow, diagram that would benefit from decomposition                                                                                       |

**Gate behavior:** SHOULD items do not block the gate individually. The producing agent is expected to address them but may decline with justification (see Handling Rules below).

---

### MINOR

A MINOR item is a polish suggestion. The content is correct and clear; the suggestion would make it marginally better. MINOR items never block the gate and never require justification if skipped.

**Criteria — an item is MINOR if it meets all of these:**

1. The content is factually correct
2. The content is understandable on first read by the target audience
3. The suggestion is a matter of preference, style polish, or marginal improvement

**Examples:**

- Word choice preference ("use" vs "utilize" — both correct, one preferred)
- Sentence restructuring that reads slightly better but changes no meaning
- Adding an optional example that illustrates but is not needed for understanding
- Minor formatting adjustments (extra whitespace, bullet style)
- Reordering items in a non-sequential list

**Gate behavior:** MINOR items are informational. The producing agent may address them at their discretion with no obligation to respond or justify.

---

## Classification Decision Tree

When classifying a review finding, the reviewer works through this sequence:

```
1. Is it factually wrong, missing critical info, or a safety issue?
   YES → MUST
   NO  → continue

2. Could it mislead the reader or block the core workflow?
   (Evaluate against the declared audience profile, not personal comprehension)
   YES → MUST
   NO  → continue

3. Does it violate the defined scope, audience, or document type?
   YES → MUST
   NO  → continue

4. Does it violate a structural rule in the style guide?
   Does the violation prevent task completion or create misunderstanding? → MUST
   Is it a conformance issue that doesn't block the reader? → SHOULD
   NO  → continue

5. Would fixing it noticeably improve clarity, consistency, concision, or organization?
   YES → SHOULD
   NO  → continue

6. Is the content correct and clear, and the suggestion is just polish?
   YES → MINOR
```

**When in doubt between levels, apply asymmetric escalation:**

- **Between MUST and SHOULD:** Classify as MUST **only if reader harm is plausible** — the reader would fail at a task, form a wrong mental model, or face a security risk. If the issue merely weakens the document, it is SHOULD.
- **Between SHOULD and MINOR:** Default to SHOULD. The cost of addressing a SHOULD is low; the cost of shipping unclear content is high.

Blanket "always classify up" leads to review inflation, defensive over-reviewing, and artificially slow velocity. The goal is accurate classification, not conservative classification.

---

## Review Item Format

Every review item must follow this structure so that the Manager can parse gates and the producing agent can locate and address each item.

```markdown
### [SEVERITY] Section: "Section Title" — Short description

One to three sentences explaining the issue. Be specific about what is wrong
and why it matters to the reader.

**Location:** Section heading or line range where the issue occurs
**Suggested fix:** Concrete, actionable suggestion for how to resolve the issue.
```

**Rules for writing review items:**

1. **One issue per item.** Do not combine multiple problems into a single review item, even if they are in the same paragraph.
2. **Quote the problematic text** when the issue is about specific wording. Use inline code or blockquotes.
3. **Explain the impact on the reader**, not just the rule being violated. "This violates the style guide" is insufficient. "This forces the reader to scroll back to find the prerequisite" is actionable.
4. **Suggested fixes are required for MUST and SHOULD items.** MINOR items may omit the suggested fix.
5. **Be specific about location.** "Somewhere in the getting started section" is not acceptable. Reference the section heading and, where possible, the paragraph or line range.

### Example Review Items

**MUST example:**

```markdown
### [MUST] Section: "Deploying to Production" — Missing rollback procedure

The deployment steps do not include any rollback instructions. If step 4 fails
(the database migration), the reader has no way to recover without data loss.

**Location:** "Deploying to Production", steps 4-7
**Suggested fix:** Add a "Rolling Back" subsection after the deployment steps
that covers: reverting the migration, redeploying the previous version, and
verifying data integrity.
```

**SHOULD example:**

```markdown
### [SHOULD] Section: "Configuration" — Implicit prerequisite

The configuration section references `~/.config/app/settings.yaml` but never
states that this file must be created manually. A reader following the guide
from scratch would not have this file.

**Location:** "Configuration", paragraph 2
**Suggested fix:** Add a step before the configuration instructions:
"Create the configuration file: `mkdir -p ~/.config/app && touch ~/.config/app/settings.yaml`"
```

**MINOR example:**

```markdown
### [MINOR] Section: "Overview" — Word choice

"Utilize" could be simplified to "use" for a more direct tone.

**Location:** "Overview", paragraph 1
```

---

## Review Summary Format

Every review must end with a summary block that the Manager uses for gate decisions:

```markdown
## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | 2     |
| SHOULD   | 5     |
| MINOR    | 3     |

**Gate recommendation:** MUST-REVISE
```

Gate recommendation values:

- **PASS** — Zero MUST items. SHOULD and MINOR items exist but do not warrant blocking.
- **MUST-REVISE** — One or more MUST items. Revision is required.
- **CONDITIONAL-PASS** — Zero MUST items but a high density of SHOULD items signals structural weakness rather than isolated issues. Guidelines: for documents under 2,000 words, 3+ SHOULD items may warrant this; for documents 2,000–5,000 words, 5+ SHOULD items; for longer documents, use proportional judgment. The reviewer should recommend CONDITIONAL-PASS when the SHOULD items collectively indicate a pattern (e.g., all relate to audience mismatch, or all relate to structural problems) rather than being unrelated nitpicks. The Manager decides whether to treat this as a revision round or proceed.

---

## Handling Rules by Agent Role

### Tech Writer (responding to Editor or SME review)

| Severity | Obligation                                                       | What to do                                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MUST     | **Required.** Every MUST item must be addressed in the revision. | Fix the issue as suggested, or apply an alternative fix that resolves the underlying problem. If the alternative fix differs significantly from the suggestion, add a `[NOTE]` comment in the draft explaining the approach taken. |
| SHOULD   | **Expected.** Address unless there is a clear reason not to.     | Fix the issue, or decline it by adding a `[DECLINED: one-line reason]` entry in the draft's front matter under a `## Review Responses` section.                                                                                    |
| MINOR    | **Optional.** Address at your discretion.                        | Fix if convenient. No response or justification needed if skipped.                                                                                                                                                                 |

### Tech Writer (responding to QA Reader review)

QA Reader feedback uses a different format (confusion points, not severity levels). The Tech Writer maps QA feedback to severity levels, but must apply an **audience-plausibility filter** — the question is not "did the QA reader get confused?" but "would the declared target audience get confused in the same way?"

- **Confusion point where the reader could not proceed** → Treat as MUST, but only if the confusion is plausible for the target audience. If the QA reader's confusion stems from lacking background knowledge that the target audience is expected to have (per the declared audience profile), downgrade to SHOULD.
- **Confusion point where the reader recovered but with effort** → Treat as SHOULD
- **Suggestion for additional context or examples** → Treat as MINOR

When the Tech Writer downgrades a QA "could not proceed" to SHOULD, they must note the reasoning (e.g., `[DOWNGRADED: target audience has prerequisite X per audience profile]`). The Editor validates this judgment on their next review pass.

### Designer (responding to SME review of diagrams)

| Severity | Obligation                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| MUST     | Required. The diagram must be corrected.                                       |
| SHOULD   | Expected. Improve the diagram or explain why the current version is preferred. |
| MINOR    | Optional.                                                                      |

### Editor (second pass behavior)

When the Editor reviews a revision (second pass on the same gate), the Editor:

1. Verifies all MUST items from the previous review are resolved
2. If any MUST items remain unresolved, classifies them as MUST again with a note: `[UNRESOLVED from previous review]`
3. Makes **inline edits directly** for any remaining SHOULD or MINOR items rather than producing another review-and-bounce cycle
4. Only produces a new review document if there are unresolved MUST items

This prevents infinite revision loops. The Editor's second pass is the convergence mechanism.

---

## SME-Specific Classification Guidance

The SME reviews for **technical accuracy**, not style or structure. The SME uses the same MUST/SHOULD/MINOR labels but applies different criteria:

| Severity | SME-specific criteria                                                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MUST     | Factual error confirmed by independent research. Security issue. Instruction that would fail or produce wrong results. Diagram that depicts incorrect system behavior.                                                                                                                        |
| SHOULD   | Oversimplification that could mislead an advanced reader. Missing edge case that a significant portion of users would encounter (common scenarios, not rare corner cases). Outdated information that has a newer correct version. Unsubstantiated claim (presented as fact without evidence). |
| MINOR    | Terminology preference (both terms are correct). Additional context that only advanced users would need. Alternative approach worth mentioning but not required.                                                                                                                              |

**SME-specific rules:**

1. **Do independent research.** The SME must verify claims against the source of truth (codebase, official docs, API responses) — not just read the draft and check if it "sounds right."
2. **Cite verification evidence.** For MUST items, the SME must include a `**Evidence:**` field in the review item showing how the claim was verified (file path, command output, doc URL, or API response). For SHOULD items, evidence is strongly encouraged but not required. This creates an audit trail and prevents "trust me, it's wrong" reviews.
3. **Handle unverifiable claims.** If the source of truth is inaccessible (private repo the SME cannot read, offline service, no tooling available), classify as SHOULD with the label `[UNVERIFIED]` and state what would be needed to verify. Exception: claims with safety implications (data loss, credential exposure, destructive operations) are classified as MUST even when unverified — safety claims get the benefit of the doubt.
4. **Flag hyperbole and unsubstantiated claims.** Phrases like "dramatically improves," "the best approach," or "always use X" require evidence or qualification. If no evidence exists, classify as SHOULD with a note to qualify or remove.
5. **Do not review for style.** The SME should not flag tone, voice, formatting, or structural issues unless they cause a technical misunderstanding. Style is the Editor's domain.

**Edge case severity tiering for the SME:**

| Edge case frequency                                        | Severity | Rationale                                               |
| ---------------------------------------------------------- | -------- | ------------------------------------------------------- |
| Default/happy path fails                                   | MUST     | The primary use case does not work as described         |
| Common scenario (most users will hit this)                 | SHOULD   | Significant portion of readers will encounter this      |
| Rare corner case (unusual configuration, edge environment) | MINOR    | Worth mentioning but absence does not harm most readers |

---

## QA Reader Output Format

The QA Reader does not use MUST/SHOULD/MINOR classifications. Instead, they produce **confusion points** — moments during a cold read where understanding broke down.

```markdown
### Confusion Point: "Section Title" — Short description

**What I was trying to understand:** What the reader was attempting to learn or do.
**Where I got confused:** The specific passage or transition that caused confusion.
**What I thought it meant:** The (possibly wrong) interpretation the reader formed.
**What would have helped:** What the reader wishes had been there.
**Severity self-assessment:** Could not proceed | Recovered with effort | Minor friction
```

The Tech Writer maps these to MUST/SHOULD/MINOR as described in the handling rules above.

---

## Convergence Rules

These rules prevent infinite revision loops:

1. **Max 2 revision rounds per gate.** If the Editor or SME still has MUST items after 2 rounds of revision, the Manager escalates to the user with the specific unresolved items.
2. **Second-pass inline editing.** On the second pass, the Editor makes direct inline edits for SHOULD/MINOR items instead of producing a review-and-bounce cycle.
3. **Declined items require new evidence to escalate.** If the Tech Writer declines a SHOULD item with justification, the Editor may accept the decline or escalate to MUST — but escalation requires **new evidence** not present in the original review. Valid new evidence includes: QA Reader confusion on the same point, SME verification that the issue causes incorrect behavior, or an explicit spec requirement that contradicts the decline. Restating the same objection with stronger language is not new evidence and the decline stands. The Editor may not re-raise the item as SHOULD in a subsequent round.
4. **QA Reader gets max 2 passes.** If confusion points persist after 2 revision rounds, the Manager presents the remaining points to the user for a judgment call.
5. **Escalation format.** When escalating to the user, the Manager presents: the original review item, the Tech Writer's response or fix attempt, the reviewer's continued objection, and asks the user to decide.

---

## Classification Integrity

**Severity classification must reflect reader impact, not negotiation strategy.**

This is a meta-rule that governs all classification decisions. Violations include:

| Anti-pattern             | Description                                                                                                         | Why it is harmful                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Issue splitting          | Reviewer breaks one MUST-worthy issue into multiple SHOULD items to avoid triggering a gate failure                 | Allows defective content to pass gates. The combined impact of the split items is still MUST-level.                  |
| Implicit downgrading     | Tech Writer addresses only the surface of a MUST item, making it look resolved while the underlying problem remains | Creates the appearance of progress without actual improvement.                                                       |
| Inflation for control    | Reviewer classifies SHOULD-level items as MUST to force a rewrite when the real concern is stylistic preference     | Wastes revision rounds, erodes trust in the classification system, slows velocity.                                   |
| Decline flooding         | Tech Writer declines most SHOULD items with thin justifications to minimize revision work                           | Degrades document quality. Justifications must be substantive, not formulaic.                                        |
| Escalation by insistence | Editor escalates a declined SHOULD to MUST by restating the same objection more forcefully, without new evidence    | Bypasses the decline mechanism and creates conflict loops. Escalation requires new evidence (see Convergence Rules). |

**Manager monitoring:** The Manager should watch for patterns across reviews. If a reviewer consistently avoids MUST classifications where they appear warranted, or a Tech Writer consistently declines SHOULD items, the Manager flags this to the user as a pipeline health concern.

**The test:** For any classification decision, the reviewer should be able to answer: "If I showed only this item and its classification to someone who hadn't read the draft, would they agree with the severity level based on the reader impact described?" If not, the classification is likely strategic rather than honest.

---

## Quick Reference Card

For agents to consult during review:

| Question                                        | Answer                                                  |
| ----------------------------------------------- | ------------------------------------------------------- |
| Is it wrong?                                    | MUST                                                    |
| Is it missing something critical?               | MUST                                                    |
| Could it hurt the reader (security, data loss)? | MUST                                                    |
| Is it outside the defined scope or audience?    | MUST                                                    |
| Is it hard to understand but recoverable?       | SHOULD                                                  |
| Is it in the wrong place?                       | SHOULD                                                  |
| Is it inconsistent with itself?                 | SHOULD                                                  |
| Is it redundant or bloated?                     | SHOULD                                                  |
| Is it correct but could be slightly better?     | MINOR                                                   |
| Is it a preference?                             | MINOR                                                   |
| Not sure between MUST and SHOULD?               | MUST only if reader harm is plausible; otherwise SHOULD |
| Not sure between SHOULD and MINOR?              | Default to SHOULD                                       |
| Tech Writer disagrees with SHOULD?              | Decline with substantive justification                  |
| Editor disagrees with decline?                  | Escalate to MUST with justification                     |
| Is my classification honest or strategic?       | Apply the outsider test (see Classification Integrity)  |
| Still unresolved after 2 rounds?                | Escalate to user                                        |
