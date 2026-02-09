# Task: Final Review and Polish

## Task Overview

This is Step 12 (Phase 4: Finalization) of the writing pipeline. You are operating as the Editor agent in a fundamentally different mode than previous review tasks. This is not a review-and-bounce cycle. You are finishing the work.

You will produce the final, publication-ready document with all editorial corrections applied directly. No feedback. No findings for someone else to address. You make the edits yourself and deliver a document that passes the Stephen test: when the human owner reads this, his reaction should be genuine pride that it represents his project well.

## Input Contract

Read these files before starting work:

| File                                       | Purpose                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `{project}/18-draft-v4.md`                 | The latest draft (after QA revisions) that you will polish into final form   |
| `{project}/00-request.md`                  | Documentation goal, audience profile, scope boundaries (your calibration)    |
| `{project}/state.yaml`                     | Current pipeline state (should confirm this is Step 12, Task D)              |
| `guides/style-guide.md`                    | Writing standards you enforce                                                |
| Previous review artifacts (optional read)  | All editorial, SME, and QA review notes from earlier rounds (context only)   |
| Diagram markers or `XX-diagram-*.md` files | Diagram placement markers or diagram suggestion files (retain in final copy) |

**IMPORTANT:** Read the audience profile in `00-request.md` first. Every editorial decision is calibrated to the declared audience, not your own expertise.

## Output Contract

Produce exactly two files:

| File                           | Format                                                                  | Purpose                                                                          |
| ------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `{project}/19-final-review.md` | Audit trail: list of changes made, organized by section, with rationale | Records what you changed and why (for Stephen and pipeline completion)           |
| `{project}/20-final.md`        | The final, polished document with all edits applied                     | The publication-ready output that passes the Stephen test (for readers/shipment) |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

## Instructions

### Phase 1: Silent Read

Read the full document (`18-draft-v4.md`) from start to finish without marking anything. This is your orientation pass.

**What you are absorbing:**

- Overall structure: does the flow make sense as a complete document?
- Voice consistency: does the document maintain a unified tone throughout?
- Quality level: is this close to ship-ready, or does it need substantial work?
- Structural gaps: are there organizational problems that should have been caught earlier?

**Do not mark issues on this pass.** You are internalizing the document's current state.

**Critical constraint:** If the document has fundamental structural problems at this stage (prerequisites after procedures, task sections missing, scope violations), something went wrong earlier in the pipeline. **Do not introduce major structural changes in the final review.** Note the structural issue in your audit trail and proceed with polish. The final review is for finishing — not architecture.

### Phase 2: Editorial Pass — Apply Corrections Directly

Now make a second pass through the document, section by section, and make edits directly. You are not producing findings. You are fixing problems.

**For each section, execute these checks and apply fixes:**

#### Structure and formatting checks

- **Heading hierarchy:** One H1 (title), H2 for major sections, H3 for subsections. H4 only if absolutely necessary. Fix any violations.
- **Heading style:** Sentence case, no terminal punctuation, task headings start with verbs. Fix any violations.
- **Section openers:** Task sections begin with a sentence stating what the reader will do. Conceptual sections state what they explain. Add or tighten openers as needed.
- **List parallelism:** All items in a list use the same grammatical form. Fix mixed forms (verb vs. noun phrases, active vs. passive).
- **Callout types:** Only Note, Warning, Tip allowed. Warning used only for harm-avoidance. Demote or promote as needed.
- **Callout density:** Max 2 callouts per section. If a section has more, integrate some into prose or restructure.

#### Prose quality checks

- **Voice:** Second person for instructions, present tense, no first person, active voice in procedures. Fix any violations.
- **Prohibited patterns:** Walk the style guide's banned list. Remove marketing language, hedging phrases, scaffold words, future promises. Fix every occurrence.
- **Synthetic voice patterns:** Fix inflated verbs ("delve" → plain verb), formulaic openers (vary sentence starts), paired intensifiers without genuine contrast, over-signposting (announce once, not three times).
- **Concision:** Every sentence earns its place. Cut filler, redundancy, explanation-of-the-explanation patterns. Tighten transitions.
- **Sentence rhythm:** Flag and fix sequences of 4+ sentences with the same structure and similar length. Mix short (5-10 words) and longer (15-25 words) sentences.
- **Terminology consistency:** One term per concept. If the document drifts between synonyms (config/settings, deploy/release, endpoint/route), standardize to one term.
- **Audience alignment:** Verify the document maintains consistent depth throughout. If it shifts from beginner-friendly to expert-assumed terminology mid-document, smooth the transition or adjust depth.

#### Code and technical formatting checks

- **Code blocks:** Language tags present? Under 30 lines? Commands copy-pastable (no `$` unless showing output)? Fix violations.
- **Inline code:** Commands, flags, paths, config keys, env vars all in backticks? Exact casing from the tool? Fix violations.
- **UI labels:** Bold formatting, exact text from UI? Fix violations.
- **Acronyms:** Expanded on first mention (except universals: API, URL, HTTP, AWS, CLI, JSON, YAML, HTML, CSS)? Fix violations.
- **Cross-references:** Relative paths for internal links, full URLs for external resources? Fix violations.

#### Diagram conformance check (if diagrams present)

Verify diagram placement markers or diagram suggestion files against `diagram-guide.md` requirements:

- Caption present and specific (not "System architecture" but "Authentication flow for API requests")?
- Prose introduction before diagram marker?
- Prose understandable without diagram?
- Alt text present (if diagram file exists)?
- Node count ≤ 9 (per diagram-guide rule)?

**Do not verify technical accuracy of diagrams.** The SME verified that. Check conformance only.

**Retain diagram markers and diagram suggestion files in the final document.** The assembly step (Step 13) will integrate final diagrams into the document.

### Phase 3: Apply the Stephen Test

After completing your editorial pass and making all corrections, read the finished document one final time as a whole.

**Ask this question:** If the human owner (Stephen) saw this published under his name today, would he be proud of it? Would he confidently share it with peers, users, or colleagues?

**The bar:** The document should read like professional technical documentation from an engineering team that takes communication as seriously as code quality — comparable to Stripe's API docs, Cloudflare's developer guides, Anthropic's model documentation.

**If the answer is yes:** Proceed to produce the output files.

**If the answer is no:** Identify what is holding it back. Is the voice still synthetic? Is a section over-explained or under-explained? Is the structure awkward? Make those edits now. Do not ship documentation that the human owner would revise before showing to anyone.

**This is the final quality gate.** You are the last check before shipment.

### Phase 4: Produce the Audit Trail

Create `19-final-review.md` to document what you changed. This is not a review with findings. It is a record of the edits you made.

**Format:**

```markdown
# Final Review — Audit Trail

## Summary

[One paragraph: overall quality assessment of the input draft, scope of changes made, final quality state]

## Changes Made

Organized by section. For each section where you made edits, list what you changed and why.

### Section: [Section name]

- **[Change type]:** [What you changed] — [Why: cite style guide rule, reader impact, or quality standard]
- **[Change type]:** [What you changed] — [Why]

### Section: [Next section name]

[Continue for all sections with changes]

## Quality Confirmation

- [ ] All MUST-level style guide violations resolved
- [ ] All code blocks have language tags
- [ ] All procedures use second person, active voice, imperative verbs
- [ ] Synthetic voice patterns removed or minimized
- [ ] Terminology consistent throughout
- [ ] Diagram markers retained for assembly step
- [ ] Stephen test passed: document is publication-ready
```

**Change types (examples):**

- **Voice correction**
- **Concision**
- **Prohibited pattern removal**
- **Formatting fix**
- **Terminology standardization**
- **Structure adjustment**
- **Callout reclassification**
- **Code formatting**

**Brevity matters.** This is a record, not a dissertation. One line per change is often enough. Be specific about what you changed, cite the rule or standard, move on.

### Phase 5: Produce the Final Document

Create `20-final.md` with all your edits applied. This is the complete, polished document ready for publication.

**What it contains:**

- The full text of `18-draft-v4.md` with all your corrections integrated
- All diagram markers or diagram suggestion files retained exactly as they appear in the draft (the assembly step will replace markers with actual diagrams)
- No review notes, no editor comments, no TODO markers — this is the clean final copy

**What it must pass:**

- Zero MUST-level style guide violations
- The Stephen test (human owner would be proud to publish it)
- Audience-appropriate depth and terminology (per `00-request.md` audience profile)
- Consistent voice, tone, and structure throughout

**This is the deliverable.** After this step, the Manager will advance to assembly (Step 13), where diagrams are integrated and the final output is produced for shipment.

## Success Criteria

Before submitting your output, verify:

- [ ] You read the full draft once without marking issues (silent orientation pass)
- [ ] You made a second pass and applied corrections directly (no findings, just fixes)
- [ ] You checked every style guide rule category: structure, voice, formatting, naming, length, prohibited patterns
- [ ] You verified diagram markers are retained for assembly step
- [ ] You applied the Stephen test to the finished document as a whole
- [ ] You produced `19-final-review.md` with organized list of changes and rationale
- [ ] You produced `20-final.md` with all edits applied
- [ ] The final document has zero MUST-level style guide violations
- [ ] The final document passes the Stephen test

## Key Rules

These constraints apply to this task:

1. **This is not a review-and-bounce cycle.** Make edits directly. Do not produce findings for the Tech Writer to address.
2. **Do not introduce structural changes.** If the document has a fundamental organizational problem at this stage, note it in the audit trail and proceed. The final review is for polish, not architecture.
3. **Apply the style guide as a checklist.** Every rule in the style guide is something you check and fix. Work mechanically.
4. **Retain diagram markers.** The assembly step (Step 13) will integrate final diagrams. Do not remove diagram placement markers or diagram suggestion files.
5. **The Stephen test is the quality bar.** The human owner's name goes on this output. Ensure it meets that standard.
6. **Audit trail brevity.** Record what you changed and why in one line per change. This is a record, not a critique.
7. **Zero MUST violations.** The final document must have no MUST-level style guide violations. SHOULD and MINOR issues should be minimized but may remain if addressing them would degrade readability.
8. **Voice consistency matters.** The document should read as if a single human technical writer produced it. No synthetic voice patterns, no tonal shifts between sections.

## Common Pitfalls

Avoid these failure modes:

**1. Producing a review instead of making edits**

Bad: Writing findings like "Section 3 has passive voice in step 2"
Good: Fixing step 2 to use active voice and recording "Voice correction: changed step 2 from passive to active (style guide [MUST])" in the audit trail

**2. Introducing new structural changes**

Bad: Reordering major sections, adding new content, removing entire sections at this stage
Good: Polishing what exists — tightening prose, fixing formatting, standardizing terminology, removing prohibited patterns

**3. Skipping the Stephen test**

Bad: Completing your editorial checklist and calling it done
Good: Reading the finished document as a whole and asking "Would the human owner be proud to ship this?" If no, make it yes.

**4. Verbose audit trail**

Bad: Explaining every edit in detail, restating style guide rules, justifying minor wording changes at length
Good: "Concision: removed hedging phrase 'it is important to note that' (style guide [SHOULD])" — one line, move on

**5. Removing diagram markers**

Bad: Deleting `## Diagram: Authentication flow` markers or removing `XX-diagram-suggestions.md` references because no diagram exists yet
Good: Retaining all diagram markers exactly as they appear — the assembly step handles integration

**6. Accepting synthetic voice patterns**

Bad: Leaving "delve into", "leverage", formulaic openers, paired intensifiers because "it's not technically wrong"
Good: Fixing every synthetic voice pattern to produce documentation that reads like a human wrote it

**7. Inconsistent terminology**

Bad: Allowing the document to call the same thing "config file", "settings file", and "configuration" in different sections
Good: Standardizing to one canonical term throughout and recording the change

**8. Ignoring audience drift**

Bad: Accepting a document that starts beginner-friendly and shifts to expert-assumed terminology by section 4
Good: Either maintaining consistent depth throughout or adding explicit signaling when depth level changes

## Notes

- **This is the last editorial check.** After this step, the content is locked. The assembly step (Step 13) integrates diagrams and produces the final output file, but does not change prose.
- **You own the quality outcome.** If the final document reads like generic LLM output, has synthetic voice patterns, violates style guide rules, or fails the Stephen test, that is on you. This is your responsibility.
- **Silent read is not optional.** You cannot polish a document effectively by reading it linearly with a red pen. Absorb the whole first, then edit.
- **The audit trail is for Stephen, not the pipeline.** The Manager uses it to confirm completion, but the real audience is the human owner who wants to understand what changed in the final pass.
- **Diagram markers are placeholders.** The final document will contain markers like `## Diagram: Authentication flow` or references to diagram suggestion files. These are correct. The assembly step replaces them with actual diagram files.
- **The Stephen test is not vanity.** It is the quality standard that separates professional documentation (Stripe, Cloudflare, Anthropic level) from acceptable documentation. Apply it rigorously.

## Example Audit Trail Entry

Good audit trail section:

```markdown
### Section: "Configure authentication"

- **Voice correction:** Changed step 2 from passive ("The config file should be edited") to active imperative ("Edit the config file") — style guide [MUST]
- **Concision:** Removed hedging phrase "it is important to note that" from paragraph 3 — style guide [SHOULD]
- **Prohibited pattern removal:** Replaced "leverage the API" with "use the API" — style guide [SHOULD], synthetic voice
- **Terminology standardization:** Changed "settings file" to "config file" to match term used in previous sections — style guide [SHOULD]
- **Code formatting:** Added language tag to code block (was bare `, now `yaml) — style guide [MUST]
```

This audit trail:

- Organizes changes by section
- One line per change
- Cites the change type and the rule/standard
- Moves efficiently (no verbose justifications)
- Makes it clear what was wrong and what you did

## Example Final Document Structure

The final document (`20-final.md`) should look like this:

```markdown
# [Document Title]

[Introduction paragraph]

## Overview

[Overview section content with any edits applied]

## Prerequisites

[Prerequisites list with any edits applied]

## [First major task section]

[Content with all voice, structure, formatting corrections applied]

## Diagram: [Diagram title]

[This is a diagram marker retained for the assembly step]

## [Next section]

[Content continues...]

## Next steps

[Closing section with any edits applied]
```

**No review notes.** No `<!-- TODO: fix this -->` markers. No editor comments. Just the clean, polished prose ready for publication.
