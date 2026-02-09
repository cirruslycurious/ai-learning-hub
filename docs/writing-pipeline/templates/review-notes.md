---
reviewer: [editor|sme|qa-reader]
artifact_reviewed: [filename of artifact being reviewed, e.g., "04-draft-v1.md"]
date: [ISO timestamp, e.g., "2026-02-08T14:30:00Z"]
artifact_type: review
pipeline_step:
  [step number and name, e.g., "Step 4: Editorial Review of Draft v1"]
---

# Review Notes: [Artifact Name]

## Summary

[2-4 sentences providing an overall assessment of the artifact. Include:]

- Overall quality impression (strong, needs work, mixed, etc.)
- Main strengths
- Primary areas of concern
- Gate decision preview (to be detailed in Review Summary below)

---

## MUST CHANGE

<!-- Blocking issues that prevent the artifact from shipping. If any MUST items exist, revision is REQUIRED.

Classification criteria — an item is MUST if it meets ANY of these:
- Factually wrong information
- Missing critical information needed to complete a task
- Misleading framing that creates wrong mental models
- Comprehension blocker for the target audience (NOT the reviewer's personal comprehension)
- Structural violation that prevents task completion
- Security or safety issue
- Diagram inaccuracy that contradicts text or depicts incorrect relationships
- Scope violation (wrong audience, wrong document type, omitted scope elements)

Each MUST item MUST include a concrete suggested fix. -->

### [MUST] Section: "[Section Title]" — [Short description of the issue]

[1-3 sentences explaining what is wrong and why it matters to the reader. Be specific about the reader impact, not just the rule being violated.]

**Location:** [Section heading or line range where the issue occurs]
**Suggested fix:** [Concrete, actionable suggestion for how to resolve the issue. Required for MUST items.]
**Evidence:** [For SME reviews: file path, command output, doc URL, or API response verifying the claim. Required for factual errors.]

<!-- Example MUST item:

### [MUST] Section: "Deploying to Production" — Missing rollback procedure

The deployment steps do not include any rollback instructions. If step 4 fails (the database migration), the reader has no way to recover without data loss.

**Location:** "Deploying to Production", steps 4-7
**Suggested fix:** Add a "Rolling Back" subsection after the deployment steps that covers: reverting the migration, redeploying the previous version, and verifying data integrity.
**Evidence:** Verified by running the deployment steps — no rollback mechanism exists in the codebase at `infra/deploy/migration.ts`.

-->

---

## SHOULD CHANGE

<!-- Important improvements that make the content significantly better. SHOULD items do not block the gate individually, but a high density may trigger CONDITIONAL-PASS.

Classification criteria — an item is SHOULD if it meets ANY of these:
- Clarity improvement (meaning is recoverable but requires re-reading)
- Structural improvement (info exists but is poorly organized)
- Consistency fix (contradicts itself or uses inconsistent terminology)
- Missing context that aids understanding but is not strictly required
- Tone or voice issue that affects professionalism or clarity
- Concision issue (redundant, bloated, over-explained)
- Diagram improvement (accurate but could communicate more effectively)

Tech Writer is expected to address SHOULD items but may decline with justification. -->

### [SHOULD] Section: "[Section Title]" — [Short description of the issue]

[1-3 sentences explaining the issue and why fixing it would noticeably improve the content.]

**Location:** [Section heading or line range]
**Suggested fix:** [Concrete, actionable suggestion. Required for SHOULD items.]

<!-- Example SHOULD item:

### [SHOULD] Section: "Configuration" — Implicit prerequisite

The configuration section references `~/.config/app/settings.yaml` but never states that this file must be created manually. A reader following the guide from scratch would not have this file.

**Location:** "Configuration", paragraph 2
**Suggested fix:** Add a step before the configuration instructions: "Create the configuration file: `mkdir -p ~/.config/app && touch ~/.config/app/settings.yaml`"

-->

---

## MINOR

<!-- Polish suggestions. Content is correct and clear; these suggestions make it marginally better. MINOR items never block the gate and require no justification if skipped.

Classification criteria — an item is MINOR if it meets ALL of these:
- Content is factually correct
- Content is understandable on first read by target audience
- Suggestion is preference, style polish, or marginal improvement

Examples: word choice preference, sentence restructuring with no meaning change, optional examples, minor formatting, reordering non-sequential lists.

Suggested fixes are optional for MINOR items. -->

### [MINOR] Section: "[Section Title]" — [Short description]

[Brief explanation of the suggestion.]

**Location:** [Section heading or line range]
**Suggested fix:** [Optional for MINOR items]

<!-- Example MINOR item:

### [MINOR] Section: "Overview" — Word choice

"Utilize" could be simplified to "use" for a more direct tone.

**Location:** "Overview", paragraph 1

-->

---

## Positive Highlights

<!-- Optional but encouraged. Call out what works well in the artifact. This helps the Tech Writer understand what to preserve and builds a constructive review culture. -->

- [Specific strength, e.g., "The Getting Started section flows logically and builds complexity gradually"]
- [Specific strength, e.g., "Code examples are complete and runnable without modification"]
- [Specific strength, e.g., "The architecture diagram clearly shows the data flow between components"]

---

## Review Summary

<!-- The Manager uses this section for gate decisions. Counts must be accurate. -->

| Severity | Count |
| -------- | ----- |
| MUST     | [N]   |
| SHOULD   | [N]   |
| MINOR    | [N]   |

**Gate recommendation:** [PASS | MUST-REVISE | CONDITIONAL-PASS]

<!-- Gate recommendation values:
- PASS: Zero MUST items. SHOULD and MINOR items exist but do not warrant blocking.
- MUST-REVISE: One or more MUST items. Revision is required.
- CONDITIONAL-PASS: Zero MUST items but high density of SHOULD items signals structural weakness.
  Guidelines for CONDITIONAL-PASS:
  - Documents under 2,000 words: 3+ SHOULD items may warrant this
  - Documents 2,000-5,000 words: 5+ SHOULD items may warrant this
  - Longer documents: use proportional judgment

  Recommend CONDITIONAL-PASS when SHOULD items collectively indicate a pattern (e.g., all relate to audience mismatch or structural problems) rather than being unrelated nitpicks.

  The Manager decides whether to treat CONDITIONAL-PASS as a revision round or proceed.
-->

**Rationale:** [If MUST-REVISE: briefly state the blocking issues. If CONDITIONAL-PASS: explain the pattern in SHOULD items that warrants Manager attention. If PASS: optional brief note on overall quality.]

---

## Classification Notes for Reviewers

<!-- Internal guidance — remove this section before finalizing the review -->

**Decision tree for classification:**

1. Is it factually wrong, missing critical info, or a safety issue? → MUST
2. Could it mislead the reader or block the core workflow? (Evaluate against declared audience profile) → MUST
3. Does it violate the defined scope, audience, or document type? → MUST
4. Does it violate a structural rule in the style guide?
   - Violation prevents task completion or creates misunderstanding? → MUST
   - Conformance issue that doesn't block the reader? → SHOULD
5. Would fixing it noticeably improve clarity, consistency, concision, or organization? → SHOULD
6. Is the content correct and clear, and the suggestion is just polish? → MINOR

**When in doubt:**

- Between MUST and SHOULD: Classify as MUST ONLY if reader harm is plausible. If it merely weakens the document → SHOULD
- Between SHOULD and MINOR: Default to SHOULD (cost of addressing is low, cost of shipping unclear content is high)

**Agent-specific notes:**

- **Editor:** Review for style, structure, clarity, consistency. Do NOT flag technical accuracy issues (that's SME domain).
- **SME:** Review for technical accuracy. Do independent research. Cite verification evidence for MUST items. Do NOT review for style (that's Editor domain).
- **QA Reader:** Do NOT use MUST/SHOULD/MINOR. Use the Confusion Point format instead (see review-taxonomy.md lines 271-286).

**Review item requirements:**

- One issue per item (do not combine multiple problems)
- Quote problematic text when issue is about specific wording
- Explain impact on reader, not just rule being violated
- Suggested fixes are REQUIRED for MUST and SHOULD items
- Be specific about location (section heading and paragraph/line range)

**SME-specific evidence requirements:**

- For MUST items: Include **Evidence:** field showing file path, command output, doc URL, or API response
- For SHOULD items: Evidence strongly encouraged but not required
- For unverifiable claims: Classify as SHOULD with [UNVERIFIED] label and state what's needed to verify
- Exception: Safety claims (data loss, credential exposure, destructive operations) are MUST even when unverified
