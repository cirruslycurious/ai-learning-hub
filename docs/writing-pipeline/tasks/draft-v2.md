# Task: Draft v2 with Diagram Suggestions

## Task Overview

This is Step 6 (Phase 2: First Revision Cycle) of the writing pipeline. You are operating as the Tech Writer agent to create the second draft, incorporating SME technical review feedback and adding diagram suggestions for the Designer. This draft represents the first major revision after independent technical verification.

## Input Contract

Read these files before starting work:

| File                        | Purpose                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `{project}/00-request.md`   | Original documentation goal, audience profile, scope boundaries                        |
| `{project}/state.yaml`      | Current pipeline state (should confirm this is Step 6, Task B)                         |
| `{project}/04-draft-v1.md`  | Your first draft (the content you are now revising)                                    |
| `{project}/05-sme-notes.md` | SME technical review notes with accuracy corrections and technical context             |
| `{project}/03-outline.md`   | Approved outline (for structural reference)                                            |
| `guides/style-guide.md`     | Writing standards you must follow                                                      |
| `guides/review-taxonomy.md` | Severity classification system (MUST/SHOULD/MINOR) — how to prioritize SME feedback    |
| `guides/diagram-guide.md`   | Diagram types, components, and standards — reference when crafting diagram suggestions |

**IMPORTANT:** The SME notes contain technical corrections based on independent verification. These corrections override any claims from your research or Draft v1. When the SME says something is factually wrong, it is wrong — fix it.

## Output Contract

Produce exactly one file:

| File                       | Format                                                                        | Purpose                                           |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `{project}/08-draft-v2.md` | Complete revised draft with all SME corrections applied + diagram suggestions | Second draft ready for Editor and Designer review |

**Critical requirement:** Draft v2 MUST include a `## Diagram Suggestions` section at the end of the document (before any "Next Steps" or appendix sections). This section provides detailed specifications for each diagram the Designer will create.

## Instructions

### Phase 1: Process SME Feedback

**1. Read the SME notes completely**

The SME performed independent technical verification of your Draft v1 claims. Their notes contain:

- **Factual corrections** — claims you stated incorrectly or sources that were misinterpreted
- **Missing context** — technical details you omitted that affect reader understanding
- **Unverified claims** — items you marked `[UNVERIFIED]` that the SME has now verified or confirmed cannot be verified
- **Architectural concerns** — cases where your draft described patterns that violate project architecture (e.g., Lambda-to-Lambda calls when the system uses API Gateway)
- **Severity tags** — MUST/SHOULD/MINOR classifications per `review-taxonomy.md`

**2. Apply MUST items without exception**

Every item tagged **[MUST]** in the SME notes is a factual error or omission that would mislead the reader. Fix every one.

**How to apply MUST corrections:**

- Replace the incorrect claim with the SME's corrected version
- Update or add the source citation to reflect where the SME verified the information
- If the SME provided additional technical context, integrate it at the appropriate depth level:
  - If it affects task completion → add it to the procedure or overview
  - If it explains internal behavior → add it to a detail subsection or callout
  - If it covers edge cases → add it as a subsection under the relevant H2

**Alternative fixes:** If you apply a different fix than the SME's suggestion but it fully resolves the accuracy concern, add a `[NOTE]` comment:

```markdown
<!-- [NOTE] Alternative fix applied: used sequence diagram instead of flowchart
because the SME's concern was showing timing relationships, which sequence
diagrams express more clearly than flowcharts. -->
```

**3. Address SHOULD items**

SHOULD items are technical improvements that enhance accuracy or completeness but do not independently block progression. Address them unless you have a substantive reason not to.

**When you decline a SHOULD item**, add an entry to a `## Review Responses` section in your draft's front matter:

```markdown
## Review Responses

- [DECLINED: "Add retry configuration details" — SME suggestion] The audience
  profile states readers have working knowledge of AWS SDK defaults. Retry
  behavior follows SDK defaults without custom configuration, so adding retry
  details would introduce reference material the target audience does not need
  for task completion.
```

Justifications must reference the audience profile, scope boundaries from `00-request.md`, or architectural constraints from the project. "Preferred the original" is not substantive.

**4. Handle MINOR items**

Address at your discretion. No response or justification needed if you skip them.

**5. Verify unverified claims**

For each `[UNVERIFIED]` marker in Draft v1:

- Check if the SME resolved it in their notes
- If resolved → remove the marker and apply the SME's verified information
- If still unverified and the SME confirmed it cannot be verified → either remove the claim entirely or reframe it as a gap the reader should know about
- If the SME did not address it → keep the marker and escalate to the Manager via a comment in Draft v2

### Phase 2: Structural Revision

**1. Maintain progressive disclosure**

As you integrate SME feedback, preserve the layered structure from Draft v1:

- Heading + first sentence → skimming reader gets the gist
- Full section prose → reading reader gets working knowledge
- Subsections and callouts → deep reader gets expert detail

**Where to integrate SME additions:**

| SME Feedback Type                      | Where It Goes                                                     |
| -------------------------------------- | ----------------------------------------------------------------- |
| Prerequisite the reader must have      | Add to Prerequisites section or note before the procedure         |
| Corrected procedure step               | Replace or revise the specific step                               |
| Explanation of why a step is necessary | Add after the step as a brief explanatory sentence or Note        |
| Internal system behavior               | Add as a detail subsection or callout (not in the main procedure) |
| Edge case or failure mode              | Add as a subsection after the main procedure                      |
| Configuration option                   | Add to a reference table or configuration subsection              |

**2. Apply the audience-plausibility filter**

When the SME adds technical context, ask: Does the declared target audience (from `00-request.md`) need this to complete the task or understand the concept?

- If yes → integrate it at the appropriate depth
- If no (the context is deeper than the audience's needs) → either move it to a detail subsection or mark it for exclusion with a `[QUESTIONED]` comment for the Editor to review

**3. Do not inflate prose**

Revisions address specific feedback. They do not add padding, extra qualifiers, or redundant explanations to sections the SME did not flag.

**Test:** If Draft v2 is more than 10% longer than Draft v1 and the SME feedback did not explicitly call for added content, you are inflating rather than revising. Cut ruthlessly.

### Phase 3: Diagram Suggestions

Draft v2 must include a `## Diagram Suggestions` section that specifies diagrams for the Designer to create. The Designer loads `diagram-guide.md`, not your draft or research — your suggestions must be self-contained.

**1. Identify diagram opportunities**

Read through your revised draft and identify content where spatial or relational information would clarify understanding:

- **System architecture** — components and their relationships
- **Data flow** — how information moves through the system
- **Process sequences** — step-by-step flows with decision points
- **State transitions** — how entities change state over time
- **Entity relationships** — how database tables or data models connect
- **Integration patterns** — how services communicate
- **Authentication/authorization flows** — token exchange, permission checks
- **Deployment architecture** — how infrastructure components are arranged

**When NOT to suggest a diagram:**

- The concept is linear with no branches (prose handles this well)
- The diagram would duplicate a simple list or table
- The content is purely reference material (configuration keys, API parameters)
- The concept has only 2 components with one relationship

**2. Format each diagram suggestion**

For each diagram you suggest, provide this exact structure:

```markdown
### Diagram: [Short descriptive title]

**Concept:** One sentence stating what the diagram illustrates.

**Type:** [flowchart | sequence | state | ER | block | architecture]

**Components:** List each node, participant, or entity that should appear:

- Component name (with brief role description if not obvious)
- Component name (with brief role description if not obvious)

**Relationships:** List key edges, arrows, or connections:

- Source → Target: [what the arrow represents]
- Source → Target: [what the arrow represents]

**Context:** Where in the document this diagram should appear. Reference the
specific section heading or paragraph: "After the 'Configure authentication'
section, before the first procedure" or "Within the 'Data flow' section,
following the explanation of partition key selection."

**Why a diagram helps:** 1-2 sentences explaining what spatial, relational, or
sequential information the diagram conveys that prose alone does not. Be
specific about the value: "Shows the circular dependency between user session
validation and token refresh" not "makes it easier to understand."
```

**3. Choose the right diagram type**

Reference `diagram-guide.md` for full type definitions. Quick reference:

| Type         | Use When                                                                  |
| ------------ | ------------------------------------------------------------------------- |
| Flowchart    | Decision trees, conditional logic, branching processes                    |
| Sequence     | Time-ordered interactions between components (API calls, message passing) |
| State        | Entities that transition through defined states                           |
| ER           | Database schema, data model relationships                                 |
| Block        | High-level architecture, component groupings, deployment topology         |
| Architecture | Complex systems with multiple layers, zones, or subsystem boundaries      |

**4. Provide sufficient detail**

The Designer creates diagrams from your specifications without reading the full draft. Each suggestion must include:

- **Every component that should appear** — do not assume the Designer will infer missing nodes
- **Every key relationship** — label what the arrows mean (data flow, invokes, depends on, etc.)
- **Directional flow** — specify which way arrows point
- **Groupings or layers** — note if components should be visually grouped (e.g., "Frontend components in one box, backend in another")

**5. Place the section correctly**

The `## Diagram Suggestions` section goes at the end of the document, after all content sections but before:

- "Next Steps" section (if present)
- Glossary (if present)
- Appendices (if present)

### Phase 4: Self-Review

Before writing Draft v2 to disk, verify:

**SME feedback handling:**

- [ ] Every MUST item from `05-sme-notes.md` is addressed
- [ ] Every declined SHOULD has a `[DECLINED]` entry with substantive justification
- [ ] All `[UNVERIFIED]` markers from Draft v1 are resolved or escalated
- [ ] Source citations are updated to reflect SME corrections

**Structural integrity:**

- [ ] Progressive disclosure is preserved (skimmers → readers → deep readers)
- [ ] New content from SME feedback is placed at the appropriate depth level
- [ ] Draft v2 is the same length or shorter than Draft v1, unless SME feedback explicitly required additions
- [ ] Procedures still use numbered lists, conceptual content still uses prose or bullets
- [ ] No new placeholder content or TODO markers

**Diagram suggestions:**

- [ ] `## Diagram Suggestions` section exists at the correct location
- [ ] Each suggestion uses the exact format: Concept, Type, Components, Relationships, Context, Why a diagram helps
- [ ] Each suggestion is self-contained (Designer can create it without reading the draft)
- [ ] Suggested diagram types match the content (sequence for time-ordered flows, ER for data models, etc.)
- [ ] At least one diagram is suggested (unless the document genuinely has no diagrammable content)

**Style compliance:**

- [ ] All MUST rules from `style-guide.md` are followed
- [ ] Passive voice is not used in procedure steps
- [ ] No marketing language, hedging, or synthetic voice patterns
- [ ] Inline code formatting for commands, paths, flags, config keys
- [ ] Headings in sentence case with no terminal punctuation

## Success Criteria

Before submitting your output, verify:

- [ ] `08-draft-v2.md` exists in the project directory
- [ ] Every MUST item from SME notes is addressed
- [ ] `## Diagram Suggestions` section exists with at least one diagram specified
- [ ] Each diagram suggestion includes all six required fields
- [ ] Draft follows style guide MUST rules with zero violations
- [ ] Source citations reflect SME-verified information
- [ ] Draft is substantively revised (not just cosmetically edited)

## Key Rules

These constraints apply to this task:

1. **Fix every MUST item from SME notes.** Zero exceptions. Accuracy violations are blockers.
2. **Include diagram suggestions.** Draft v2 without diagram suggestions is incomplete — the Designer cannot proceed.
3. **Do not inflate prose.** Revisions fix problems; they do not pad sections that were not flagged.
4. **Diagram suggestions must be self-contained.** The Designer does not read your draft or research — every suggestion must include enough detail to create the diagram independently.
5. **When SME and Editor feedback conflict (rare), accuracy wins.** A structurally imperfect but accurate statement is better than a well-structured inaccuracy.
6. **Preserve progressive disclosure.** SME additions go at the depth level appropriate for the content, not all in the overview.
7. **Use exact diagram suggestion format.** The Designer expects the six-field format — deviations break their workflow.
8. **Update state.yaml after completion.** Set `current_step: 7` (Editor review of Draft v2) when done.

## Common Pitfalls

Avoid these failure modes:

**1. Ignoring MUST items**

Bad: Skipping a MUST correction because you disagree with the SME's interpretation
Good: Applying the MUST correction and adding a `[NOTE]` comment if you applied an alternative fix that fully resolves the concern

**2. Dumping SME context into the overview**

Bad: Adding detailed internal implementation notes to the introduction
Good: Placing internal details in a subsection titled "How it works internally" after the main procedure

**3. Vague diagram suggestions**

Bad:

```markdown
### Diagram: Authentication

**Concept:** Show how authentication works.
**Type:** flowchart
**Components:** Some auth components
**Relationships:** The usual auth flow
```

Good:

```markdown
### Diagram: JWT validation flow

**Concept:** Illustrates the sequence of validation checks performed on incoming JWT tokens.

**Type:** sequence

**Components:**

- API Gateway (entry point)
- Auth Middleware (validates token)
- Clerk API (public key provider)
- Protected Lambda (business logic)

**Relationships:**

- API Gateway → Auth Middleware: forwards request with JWT
- Auth Middleware → Clerk API: fetches public key (cached after first call)
- Auth Middleware → Protected Lambda: forwards validated request
- Auth Middleware → API Gateway: returns 401 if validation fails

**Context:** After the "Configure authentication" section, before the "Protected routes" subsection.

**Why a diagram helps:** Shows the circular validation dependency (middleware needs Clerk's key, but Clerk communication happens through the middleware) and clarifies where the 401 response originates.
```

**4. Over-qualifying SME corrections**

Bad: "The SME suggested this might possibly work differently, so perhaps it retries up to 3 times in some cases."
Good: "The function retries up to 3 times with exponential backoff (`backend/src/handlers/retry.ts:42-58`, verified by SME)."

When the SME verifies something, state it as fact. Do not hedge corrections.

**5. Creating diagrams instead of suggestions**

Bad: Writing mermaid syntax in Draft v2
Good: Writing a detailed specification using the six-field format so the Designer can create the diagram

You are the Tech Writer. You produce diagram suggestions. The Designer produces diagrams.

**6. Declining SHOULD items without justification**

Bad: Skipping a SHOULD item with no `[DECLINED]` entry
Good: Either applying the SHOULD item OR adding a justified `[DECLINED]` entry in the Review Responses section

**7. Inflating word count**

Bad: Draft v2 is 30% longer than Draft v1 when SME notes only corrected 3 factual errors
Good: Draft v2 is roughly the same length or slightly shorter, with targeted corrections

**8. Diagram suggestions without context**

Bad: "Concept: Data flow" with no indication where it should appear
Good: "Context: Within the 'Store user activity' section, after the paragraph explaining partition key selection."

**9. Suggesting diagrams for linear content**

Bad: Suggesting a flowchart for a 3-step procedure with no branching
Good: Recognizing that numbered steps already convey the sequence clearly; no diagram needed

**10. Missing the "Why a diagram helps" justification**

Bad: "Why a diagram helps: Makes it clearer."
Good: "Why a diagram helps: Reveals the timing constraint — if the session validation takes longer than 100ms, the token refresh will timeout. This temporal relationship is difficult to express in prose."

## Notes

- **SME corrections override your research.** The SME performed independent verification. When they say you were wrong, you were wrong. Apply the correction.
- **Diagram suggestions enable the Designer.** The Designer operates in Step 7 (parallel with the Editor). Without complete diagram suggestions, they cannot proceed and the pipeline stalls.
- **Draft v2 is a major revision checkpoint.** After this draft, you have incorporated technical accuracy corrections. Subsequent drafts (v3, v3r1, v3r2) focus on editorial polish and QA-identified confusion points.
- **Self-contained suggestions prevent Designer rework.** If the Designer has to read your draft or ask questions to create a diagram, your suggestion was incomplete. Provide all components, relationships, and context upfront.
- **Depth placement matters.** Not all SME additions belong in the main flow. Evaluate where each piece of new information serves the reader best: procedure, detail subsection, or callout.
