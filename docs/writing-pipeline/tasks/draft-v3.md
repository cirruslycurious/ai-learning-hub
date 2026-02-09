# Task: Draft v3

## Task Overview

This is Step 9 (Phase 3: Convergence) of the writing pipeline. You are operating as the Tech Writer agent to produce the third and final content draft. This draft synthesizes feedback from two separate reviewers — the SME's technical review (v2) and the Editor's editorial review (v2) — and represents the polished, publication-ready content before QA testing.

Draft v3 is qualitatively different from Draft v1 and Draft v2. You are no longer expanding or developing content — you are refining, reconciling, and finalizing. The structure is set, the technical accuracy has been verified twice, and the style has been reviewed twice. Your job is to address all remaining feedback and produce a draft ready for reader testing.

## Input Contract

Read these files before starting work:

| File                                  | Purpose                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `{project}/08-draft-v2.md`            | The current draft you are revising                                                  |
| `{project}/10-sme-review-v2.md`       | SME technical review feedback on Draft v2                                           |
| `{project}/11-editorial-review-v2.md` | Editor style and structure feedback on Draft v2                                     |
| `{project}/00-request.md`             | Documentation goal, audience profile, scope boundaries (your calibration baseline)  |
| `{project}/state.yaml`                | Current pipeline state (should confirm this is Step 9, Task B)                      |
| `guides/style-guide.md`               | Writing standards you must follow                                                   |
| `guides/review-taxonomy.md`           | Severity classification system (MUST/SHOULD/MINOR) for interpreting review feedback |

**IMPORTANT:** You are incorporating feedback from TWO separate reviews. Read both review files completely before starting. Handle conflicts between reviewers using the conflict resolution rules below.

## Output Contract

Produce exactly one file:

| File                       | Format                                                                                    | Purpose                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `{project}/12-draft-v3.md` | Complete markdown document following style guide, with Review Responses section if needed | Final content draft incorporating all SME and Editor feedback |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

## Instructions

### Phase 1: Read All Feedback

**1. Load both review files**

Read `10-sme-review-v2.md` and `11-editorial-review-v2.md` completely. Do not start revising until you understand the full scope of feedback from both reviewers.

**2. Categorize feedback by type and severity**

For each review item, note:

- **Reviewer:** SME or Editor
- **Severity:** MUST, SHOULD, or MINOR
- **Type:** Accuracy, structure, style, clarity, terminology, example quality, diagram, other
- **Section:** Which part of Draft v2 it affects
- **Conflict:** Does this item conflict with feedback from the other reviewer?

**3. Identify conflicts**

Conflicts occur when the SME and Editor request incompatible changes to the same content. Mark these explicitly — you will resolve them using the conflict resolution rules.

### Phase 2: Apply Conflict Resolution Rules

When SME and Editor feedback conflict, follow these rules in order:

**Rule 1: Accuracy wins over style**

If the SME corrects a factual claim and the Editor requests a style change that would compromise accuracy, keep the accurate version and find a style-compliant way to express it.

Example:

- SME: "The retry count is 5, not 3 [MUST]"
- Editor: "Simplify this sentence [SHOULD]"
- Resolution: Update to 5 retries and simplify the sentence structure without changing the factual claim

**Rule 2: Both can be satisfied**

Most apparent conflicts are reconcilable. The SME wants accurate detail; the Editor wants clear structure. You can often layer the content: simple accurate statement first, detailed accurate explanation in a subsection.

Example:

- SME: "Add explanation of exponential backoff timing [SHOULD]"
- Editor: "This section is too detailed for the target audience [SHOULD]"
- Resolution: Keep the simple explanation in the main section, move exponential backoff timing to a "How it works" subsection for deep readers

**Rule 3: When rule-based, follow the rule**

If the Editor cites a style guide rule (e.g., "Prerequisites must come before procedures [MUST]") and the SME's feedback doesn't directly contradict that rule, follow the style guide.

**Rule 4: Document unresolvable conflicts**

If you cannot satisfy both reviewers without violating one's MUST requirement, add a note in your Review Responses section and satisfy the SME's requirement (accuracy takes priority). The Manager will resolve the conflict.

```markdown
## Review Responses

- [CONFLICT: Section "Configure retries"] SME requires exponential backoff
  formula [MUST], Editor requires removing formulas for audience level [MUST].
  Applied SME requirement (accuracy priority). Moved formula to a Note callout
  to minimize disruption to main flow.
```

### Phase 3: Address MUST Items

**For every MUST item from both reviews:**

1. Fix the issue as specified by the reviewer
2. If your fix differs significantly from the suggestion, add a `[NOTE]` comment:

```markdown
<!-- [NOTE: MUST fix for SME review item 3] Used a sequence diagram instead
of flowchart because the timing relationships are central to understanding
the auth flow. -->
```

**MUST item rules:**

- Zero MUST items may be left unaddressed
- No exceptions
- If a MUST fix introduces a new problem, fix the new problem too — do not leave the draft in a broken state

### Phase 4: Address SHOULD Items

**For each SHOULD item from both reviews:**

1. Apply the fix unless you have a substantive reason not to
2. To decline a SHOULD, add an entry in the Review Responses section:

```markdown
## Review Responses

- [DECLINED: "Use simpler language" — terminology section] Kept technical
  terms "partition key" and "sort key" because the audience profile specifies
  "developers familiar with NoSQL databases" and these are DynamoDB's
  canonical terms. Simplifying to "ID field" would create confusion when
  readers encounter AWS documentation.
```

**Substantive justifications:**

- Audience profile explicitly includes this knowledge (cite the profile)
- Project's canonical terms differ from the suggestion (cite CLAUDE.md or architecture docs)
- The suggestion would create inaccuracy or ambiguity
- The suggestion conflicts with a style guide rule

**Not substantive:**

- "I preferred the original phrasing"
- "This sounds better to me"
- "I don't think the change is necessary"

### Phase 5: Address MINOR Items

**Address MINOR items at your discretion.** No justification needed if you skip them.

If multiple MINOR items point to the same pattern problem (e.g., 5 MINOR items all flagging inconsistent terminology), treat the pattern as a SHOULD-level issue and fix it globally.

### Phase 6: Polish the Draft

This is the final content draft. Apply these polish passes:

**1. Consistency pass**

- Terminology: same term for the same concept throughout
- Code style: consistent formatting, indentation, placeholder patterns
- Voice: consistent second person, present tense, active voice in procedures
- Structure: parallel list items, frontloaded paragraphs, consistent heading patterns

**2. Completeness pass**

Verify every section includes:

- Opening sentence stating what the reader will do/learn
- All prerequisites before procedures
- All commands and code examples verified against actual codebase
- Source citations for verifiable claims
- Definitions for terms outside the audience profile

**3. Navigation pass**

- Can a skimming reader understand the document from headings + first sentences alone?
- Does every section connect logically to the previous one?
- Are cross-references present where the reader needs to jump to related content?
- Are warnings positioned at the point of action, not paragraphs before?

**4. Diagram integration pass**

Draft v3 should still include the `## Diagram Suggestions` section from Draft v2, updated to reflect any structural changes made during revision. If feedback changed section ordering or content flow, update the "Context" field in diagram suggestions to match the new structure.

**5. Length pass**

Revisions should make the draft tighter, not longer. Compare Draft v3 length to Draft v2:

- If Draft v3 is 20%+ longer and feedback didn't call for added content, you are inflating — cut back
- If Draft v3 is significantly shorter, verify you didn't accidentally remove necessary content

### Phase 7: Write Review Responses Section

If you declined any SHOULD items or documented any conflicts, create a `## Review Responses` section at the end of the draft (before `## Diagram Suggestions`).

Format:

```markdown
## Review Responses

### Declined SHOULD Items

- [DECLINED: item description] Justification with specific audience profile or
  project citation

### Conflicts Resolved

- [CONFLICT: item description] How the conflict was resolved and which rule
  was applied
```

If you have no declined items or conflicts, omit this section.

### Phase 8: Self-Review

Before writing the file, run this checklist:

- [ ] Every MUST item from both reviews is addressed
- [ ] Every declined SHOULD has a substantive justification in Review Responses
- [ ] All conflicts between SME and Editor are resolved using the conflict resolution rules
- [ ] All procedures are verified against actual codebase/tools
- [ ] All prerequisites appear before the steps that need them
- [ ] All commands are copy-pastable (no placeholders without explanation)
- [ ] Terminology is consistent throughout
- [ ] Source citations are present for verifiable claims
- [ ] Diagram suggestions updated to reflect any structural changes
- [ ] Draft length is same or shorter than Draft v2 unless feedback explicitly added content
- [ ] Every section opens with what the reader will do/learn
- [ ] Document follows style guide MUST rules with zero violations

## Success Criteria

Draft v3 is ready to submit when:

- [ ] All MUST items from SME review v2 are resolved
- [ ] All MUST items from Editorial review v2 are resolved
- [ ] All SHOULD items are resolved or explicitly declined with justification
- [ ] Any conflicts between reviewers are resolved and documented
- [ ] The draft passes a style guide self-check for MUST violations
- [ ] The draft is the same length or shorter than Draft v2, unless feedback called for expansion
- [ ] All code examples are verified, all commands work, all prerequisites are listed
- [ ] The document reads as a polished, publication-ready piece

## Key Rules

These constraints apply to this task:

1. **Address every MUST item.** No exceptions. From both reviews.
2. **Accuracy wins over style.** When SME and Editor conflict, prioritize technical accuracy and find a style-compliant way to express it.
3. **Substantive justifications only.** "I prefer X" is not a justification to decline a SHOULD item. Audience profile citations, project canonical terms, and style guide rules are substantive.
4. **Polish, don't inflate.** Draft v3 should be tighter than Draft v2 unless feedback explicitly called for added content. Revisions address specific issues; they do not pad sections.
5. **Verify procedures.** Every command must work. Every code example must be copy-pastable. If the draft says "run X," verify X exists and produces the output you describe.
6. **Follow the style guide.** This is the final content draft. Zero MUST violations are acceptable.
7. **Update diagram suggestions.** If structural changes affected where diagrams should appear, update the Context field in each diagram suggestion.

## Common Pitfalls

Avoid these failure modes:

**1. Skipping conflicts**

Bad: Applying the Editor's fix and ignoring the SME's conflicting requirement
Good: Recognizing the conflict, applying the conflict resolution rules, and documenting the resolution if needed

**2. Inflating the draft during revision**

Bad: Draft v2 is 300 lines, Draft v3 is 400 lines, but feedback only requested minor fixes
Good: Draft v2 is 300 lines, Draft v3 is 290 lines because addressing style feedback tightened prose

**3. Weak decline justifications**

Bad: "Declined because I think the original is clearer"
Good: "Declined because the audience profile specifies 'experienced backend developers' and this term is standard in that community (see 00-request.md, audience section)"

**4. Ignoring one review**

Bad: Addressing all SME feedback but skipping Editorial feedback because "it's just style"
Good: Addressing both reviews with equal rigor, recognizing that style affects reader comprehension

**5. Breaking verified content**

Bad: Simplifying a command example to address a style issue without verifying the simplified command still works
Good: Simplifying the explanation around the command while keeping the command itself verified and accurate

**6. Not updating diagram suggestions**

Bad: Leaving Draft v2's diagram suggestions unchanged even though you reordered sections
Good: Updating the "Context" field in each diagram suggestion to reflect the new section order

**7. Missing MUST items**

Bad: Addressing 9 out of 10 MUST items and submitting the draft
Good: Tracking every MUST item in a checklist and verifying each is resolved before submitting

**8. Adding unverified content**

Bad: The SME asks you to add an explanation of retry timing, so you write one from general knowledge
Good: The SME asks you to add retry timing, so you read the source code to verify the exact timing and cite it

## Conflict Resolution Examples

**Example 1: Reconcilable conflict (both can be satisfied)**

- **SME:** "Add explanation of how DynamoDB calculates consumed capacity units [SHOULD]"
- **Editor:** "This section is already too long for the audience level [SHOULD]"
- **Resolution:** Keep the main section focused on the reader's task (writing queries), add a "How capacity calculation works" subsection for readers who need the detail. Both reviewers are satisfied.

**Example 2: Accuracy wins**

- **SME:** "The timeout is 30 seconds, not 60 seconds [MUST]"
- **Editor:** "Shorten this paragraph [SHOULD]"
- **Resolution:** Change timeout to 30 seconds and shorten the paragraph by removing filler. Accuracy fix is non-negotiable; style fix is applied compatibly.

**Example 3: Rule-based decision**

- **SME:** "Add a note about installing dependencies [SHOULD]"
- **Editor:** "Prerequisites must come before procedures, not as notes within them [MUST]"
- **Resolution:** Add dependency installation to the Prerequisites section (before the procedure), not as a note in the middle of steps. The style rule is a MUST; the SME's request is satisfied in a style-compliant location.

**Example 4: Unresolvable conflict (document and escalate)**

- **SME:** "Include the full authentication flow diagram showing token validation internals [MUST]"
- **Editor:** "Remove all internal implementation details; audience profile is end users, not system administrators [MUST]"
- **Resolution:** Apply the SME requirement (accuracy priority). Add to Review Responses: "[CONFLICT] SME requires auth flow diagram with internals [MUST], Editor requires removing internals for audience [MUST]. Applied SME requirement because authentication implementation is necessary context for the documented error handling procedures. Simplified diagram labels to reduce jargon."

## Notes

- **Draft v3 is the final content revision.** After this, only QA feedback (confusions from cold readers) will trigger revisions. Make this draft publication-ready.
- **Two reviewers = stronger draft.** The SME caught technical gaps; the Editor caught structural and clarity issues. Synthesizing both sets of feedback produces documentation that is accurate AND usable.
- **Polish matters now.** Draft v1 was about getting content down. Draft v2 was about addressing the first round of feedback. Draft v3 is about producing a professional, finished document. Sweat the details.
- **Reconciliation is not compromise.** Conflict resolution does not mean "split the difference." It means finding a solution that satisfies both reviewers' goals — accuracy and usability. Most conflicts are false conflicts that layer content correctly resolves.
- **Unverified content is unacceptable.** By Draft v3, every claim must be verified. No `[UNVERIFIED]` markers should remain. If the SME asks you to add content you cannot verify, research it or mark it explicitly for Manager escalation.

## Example Review Response Entry

**Declined SHOULD:**

```markdown
- [DECLINED: "Simplify 'partition key' to 'primary ID'" — terminology
  consistency] Kept "partition key" because (1) the audience profile specifies
  "developers with NoSQL experience" who will recognize this term, and (2) the
  AWS documentation and the project's database schema both use "partition key"
  as the canonical term. Introducing a non-standard term would create confusion
  when readers reference those sources.
```

This entry:

- Cites the specific review item
- Provides substantive justification with two supporting reasons
- References the audience profile (00-request.md) and project standards
- Explains the reader impact of making the change (confusion with other sources)
