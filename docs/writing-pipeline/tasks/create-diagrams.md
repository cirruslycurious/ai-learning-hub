# Task: Create Diagrams

## Task Overview

This is the diagram creation task used in Step 7b (Phase 4: Design) and Step 10b (Phase 5: Technical Review Response) of the writing pipeline. You are operating as the Designer agent to transform diagram suggestions into mermaid diagrams that compress spatial relationships and flows without sacrificing technical accuracy. This task has two variants: creating initial diagrams from Tech Writer suggestions (Step 7b) and revising diagrams based on SME feedback (Step 10b).

## Input Contract

### Step 7b: Create diagrams from suggestions

Read these files before starting work:

| File                        | Purpose                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `{project}/00-request.md`   | Documentation goal, audience profile, document type — calibrates visual depth (quickstart vs. architecture) |
| `{project}/08-draft-v2.md`  | Tech Writer's diagram suggestions (in `## Diagram Suggestions` section)                                     |
| `{project}/state.yaml`      | Current pipeline state (should confirm this is Step 7b, Task A)                                             |
| `guides/diagram-guide.md`   | Your primary standard — defines format, type selection, complexity limits, mermaid syntax, all MUST rules   |
| `guides/review-taxonomy.md` | Severity classification system (MUST/SHOULD/MINOR) for feedback you'll receive at Step 10b                  |

### Step 10b: Update diagrams from SME feedback

Read these files before starting work:

| File                            | Purpose                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `{project}/00-request.md`       | Documentation goal and audience profile                                     |
| `{project}/10-diagrams-v1.md`   | Your previous diagram output from Step 7b                                   |
| `{project}/11-sme-review-v2.md` | SME feedback on diagrams (diagram review items with MUST/SHOULD/MINOR tags) |
| `{project}/state.yaml`          | Current pipeline state (should confirm this is Step 10b, Task B)            |
| `guides/diagram-guide.md`       | Your primary standard for verification after applying corrections           |

**IMPORTANT:** Do not proceed until you have read all required files for your step. The diagram guide defines the hard limits you must follow regardless of what the input suggests.

## Output Contract

### Step 7b Output

Produce exactly one file:

| File                          | Format                                                                                                                                     | Purpose                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `{project}/10-diagrams-v1.md` | One section per diagram with heading, placement note, caption (italic), alt text (HTML comment), mermaid code block, type override comment | Initial diagrams for SME and Editor review |

### Step 10b Output

Produce exactly one file:

| File                          | Format                                                                                       | Purpose                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `{project}/14-diagrams-v2.md` | Same per-diagram structure as v1 + `## Change Log` section documenting changes from v1 to v2 | Revised diagrams incorporating SME corrections |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

## Instructions

### Step 7b: Create diagrams from suggestions

**1. Analyze each suggestion**

Read every item in the `## Diagram Suggestions` section of `08-draft-v2.md`. For each suggestion:

- Extract the spatial relationship: hierarchy, flow, interaction, state, or structure?
- Extract the components mentioned
- Extract the Tech Writer's recommended diagram type (if provided)
- Identify which section of the draft this diagram will appear in

**2. Assess whether the concept warrants a diagram**

Before creating any diagram, answer: does this concept have a spatial, relational, or flow insight that a diagram would compress?

**When to create a diagram:**

- The concept involves 3+ components interacting
- The concept has branching logic or decision points
- The concept describes a flow that prose alone would require the reader to mentally reconstruct
- The concept involves layers, containment, or hierarchical relationships

**When to decline a suggestion:**

- The concept can be explained clearly in 2-3 sentences of prose
- The concept has no spatial or relational structure (just a list of items)
- A diagram would restate what the text already says without adding clarity

**If declining:** Write a `[DECLINED-SUGGESTION: reason]` entry in `10-diagrams-v1.md` explaining why a diagram does not serve the reader here. The diagram guide's own rule applies: a diagram that restates what text already says without adding spatial clarity is noise.

**3. Plan the diagram before writing any mermaid code**

For each diagram you will create:

**State the intent:** Write a one-line statement: "This diagram answers: \_\_\_." Examples:

- "This diagram answers: What services process a request between API Gateway and DynamoDB?"
- "This diagram answers: What states can an order transition through?"

If you cannot complete that sentence with a specific question the reader needs answered, the concept may not warrant a diagram.

**Define the negative space:** Before listing what appears, list 2-3 things that will NOT appear in this diagram — detail levels, subsystems, error paths, or implementation specifics that belong in prose or a separate detail diagram. Intentional exclusion prevents scope creep.

**Select the diagram type:** Use the type selection table in `diagram-guide.md`:

| Concept type                     | Diagram type     | Mermaid keyword                       |
| -------------------------------- | ---------------- | ------------------------------------- |
| Process, workflow, pipeline      | Flowchart        | `flowchart LR`                        |
| Hierarchy, architecture layers   | Flowchart        | `flowchart TB`                        |
| API calls, service interactions  | Sequence diagram | `sequenceDiagram`                     |
| Lifecycle, status transitions    | State diagram    | `stateDiagram-v2`                     |
| Data model, entity relationships | ER diagram       | `erDiagram`                           |
| Component boundaries             | Block/C4 diagram | `block-beta` or flowchart + subgraphs |

**Type overrides:** If the Tech Writer's suggestion recommends a type that does not match the spatial relationship, override with the correct type. You will document this later with a comment: `<!-- Type changed from [suggested] to [actual]: [one-line reason] -->`.

**Plan the node set:** List every component that must appear. Count them.

- If >9 nodes: plan decomposition BEFORE writing any mermaid code
  - Overview with 5-7 subsystem nodes
  - One detail diagram per subsystem at ≤9 nodes each
- If 7-9 nodes: evaluate whether decomposition would produce clearer results
- If ≤6 nodes: single diagram likely works

**4. Write the mermaid code**

Follow this sequence for every diagram:

**a. Write the diagram declaration**

- Flowchart: Use `LR` (left-to-right) for processes/flows; use `TB` (top-to-bottom) for hierarchies/layers
- Sequence: `sequenceDiagram` (no direction needed)
- State: `stateDiagram-v2` (no direction needed)
- ER: `erDiagram` (no direction needed)

**b. Define nodes following the primary path**

The happy path, main flow, or key hierarchy drives node ordering. The primary path runs straight along the declared direction without reversals.

Write primary path nodes first, then branches, then error paths, then async flows, then subgraph boundaries if grouping adds information.

**c. Apply shape conventions consistently**

Per the diagram guide's node shape table:

| Shape             | Mermaid syntax | Meaning                          |
| ----------------- | -------------- | -------------------------------- |
| Rectangle         | `[Label]`      | Process, service, component      |
| Rounded rectangle | `(Label)`      | Start/end point, external system |
| Diamond           | `{Label}`      | Decision point                   |
| Cylinder          | `[(Label)]`    | Database, persistent storage     |
| Stadium           | `([Label])`    | User action, manual trigger      |

**MUST rule:** Do not use multiple shapes to mean the same thing within a single diagram. If rectangles represent services, every service is a rectangle.

**d. Label edges selectively**

- Label where the relationship is not obvious from context
- Omit where obvious (e.g., Client → API Gateway in an HTTP flow)
- Edge labels are 1-5 words; if more is needed, the prose carries the detail
- Use solid arrows (`-->`) for primary/synchronous flows
- Use dotted arrows (`-.->`) for optional or asynchronous flows
- Use thick arrows (`==>`) only for critical path emphasis (max one per diagram)

**e. Match node labels to prose terminology**

**CRITICAL:** Node labels must match the terminology the prose uses. This is not a style preference — it is semantic correctness.

If the prose says "auth middleware," the node says "Auth Middleware." Not "Authentication Layer," not "Auth Module," not "Security Gateway."

Read the Tech Writer's suggestion to identify canonical terms. If the suggestion's components use different terms than the draft prose (visible in the suggestion's context field), use the prose terms.

**5. Handle decomposition for complex diagrams**

If your node count exceeds 9, decompose into overview + detail diagrams:

**Overview diagram:**

- Shows 5-7 subsystem-level nodes
- Hides all internal implementation
- Uses subgraphs only if grouping adds information (e.g., "VPC", "AWS Account")
- Title format: use the suggestion's title or a descriptive name

**Detail diagram(s):**

- One per subsystem from the overview
- ≤9 nodes showing internal structure
- Title: reuse the subsystem name from the overview
- External references: label nodes from other subsystems as `[external]`
- Preserves the overview's layout direction (`LR` or `TB`) unless the detail's spatial relationship structurally demands otherwise

**Linking overview to detail:**

In the overview section, add a note after the mermaid block:

```markdown
See detail diagrams:

- [Auth Service internals](#auth-service-internals)
- [Data Service internals](#data-service-internals)
```

**6. Write the caption**

**MUST rule:** Every diagram has a caption placed as italic text on the line immediately before the mermaid code block.

Acceptable caption format:

- Concrete, specific, one sentence, under 15 words, no terminal period
- States what the diagram shows in concrete terms

Examples:

- _Request flow from API Gateway through auth middleware to DynamoDB_
- _User state transitions from registration through verification to active_
- _Entity relationships between users, content, and bookmarks_

Unacceptable captions:

- _Architecture Diagram_ (too generic)
- _System Overview_ (too generic)
- _Flow_ (too vague)

**7. Write the alt text**

**SHOULD rule:** Include an HTML comment above the mermaid block as alt text for accessibility.

Format:

```markdown
<!-- Alt: [One sentence describing structure and key relationships] -->
```

Example:

```markdown
<!-- Alt: Flowchart showing request flow from client through API Gateway, auth middleware, Lambda handler, to DynamoDB, with an error path returning 401 from auth middleware -->
```

**8. Verify against hard limits**

Before finalizing any diagram, verify it passes the diagram guide's MUST rules:

**Node limits:**

- Flowchart: ≤9 nodes, ≤3 decision diamonds
- Sequence diagram: ≤5 participants, ≤12 messages
- State diagram: ≤9 states, ≤2 nesting levels
- ER diagram: ≤7 entities
- Block/C4: ≤9 blocks, ≤3 nesting levels

**The squint test:** Is the main point recognizable from shapes and layout alone (text too small to read)?

Concrete indicator: if the primary flow path crosses other edges more than twice, the layout needs restructuring or the diagram needs decomposition.

**Grayscale readability:** Is the diagram understandable without color? Color supplements line styles and labels — it does not replace them.

**Shape consistency:** Does any shape carry two different meanings within the diagram or across diagrams in the document?

**Syntax hygiene:**

- No `click` events, `style` tags with hex colors, complex `classDef`, or `linkStyle` with pixel values
- Consistent indentation: 4 spaces per nesting level inside subgraphs
- One node or edge definition per line

**9. Structure the output file**

Create `10-diagrams-v1.md` with this structure:

````markdown
# Diagrams v1

[One section per diagram, ordered by appearance in the document]

## [Diagram Title]

**Placement:** [Target section heading from draft where this diagram will appear]

<!-- Type changed from [suggested] to [actual]: [reason] -->

[Only include this line if you overrode the Tech Writer's suggested type]

<!-- Alt: [One sentence describing structure and relationships] -->

_[Caption text under 15 words, no period]_

```mermaid
[mermaid code]
```
````

[For decomposed sets, link to detail diagrams here]

---

[Repeat for each diagram]

## Declined Suggestions

[DECLINED-SUGGESTION: diagram-name] [Reason why a diagram would not serve the reader]

````

### Step 10b: Update diagrams from SME feedback

**1. Read SME feedback targeting diagrams**

Review `11-sme-review-v2.md` for all review items tagged with diagram identifiers or referencing your diagrams from `10-diagrams-v1.md`.

Each review item has a severity: MUST, SHOULD, or MINOR.

**2. Handle MUST items**

**MUST items require correction, no exceptions.**

Examples of MUST items:

- Wrong arrow direction (diagram shows Lambda calling API Gateway when it's reversed)
- Missing node in a depicted flow (auth middleware exists but is absent from the diagram)
- Incorrect cardinality or relationship (ER diagram shows one-to-one where one-to-many exists)
- Node label contradicts prose terminology (prose says "DynamoDB", diagram says "database")
- Diagram depicts behavior that does not exist (shows a retry loop the system does not implement)

**How to correct:**

- Fix the technical error exactly as the SME specifies
- If adding a node would push the diagram over the 9-node limit, decompose rather than violate the limit
- If the correction conflicts with a conformance rule (e.g., adding a required node pushes past the limit), accuracy wins — but resolve the conformance violation by decomposing the diagram
- Never ship a diagram that is technically correct but violates the guide, or guide-compliant but technically wrong

**3. Handle SHOULD items**

**SHOULD items require improvement or a `[DECLINED: reason]` note.**

Examples of SHOULD items:

- Detail diagram adds no insight beyond overview
- Suggested additional component that would improve clarity
- Suggested layout change for better flow representation

**How to handle:**

- Improve the diagram if the suggestion enhances clarity and does not violate diagram guide rules
- Decline with a `[DECLINED: reason]` note if:
  - The suggestion would push the diagram over node limits
  - The suggestion would reduce visual clarity
  - The suggestion would violate a diagram guide rule

**Invalid decline reasons:** preference, effort, "looks fine as is."

**4. Handle MINOR items**

**MINOR items are optional polish.**

Apply them if they improve the diagram and do not add work. Otherwise, skip them.

**5. Re-verify all modified diagrams**

After applying corrections:

- Run every modified diagram through the hard limits checklist (node counts, per-type limits, syntax hygiene)
- Run the squint test again
- Verify node labels still match prose terminology
- Verify shape consistency across all diagrams (if you modified shapes in one diagram, check that shapes in other diagrams still follow the same semantics)

**6. Document changes**

Create a `## Change Log` section in `14-diagrams-v2.md` documenting what changed from v1 to v2.

Format:

```markdown
## Change Log

### [Diagram Title]

**SME Review Item:** [Reference to the review item ID or description]
**Change:** [What you changed and why]
**Type:** MUST | SHOULD | MINOR

[Repeat for each modified diagram]

### Declined SHOULD Items

[DECLINED: diagram-name / item-description] [Reason why the suggestion was not applied]
````

**7. Structure the output file**

Create `14-diagrams-v2.md` with the same per-diagram structure as v1, followed by the change log:

```markdown
# Diagrams v2

[Same section structure as v1 for each diagram]

---

## Change Log

[Document all changes as specified above]
```

## Success Criteria

### Step 7b Success Criteria

Before submitting `10-diagrams-v1.md`, verify:

- [ ] Did you read `diagram-guide.md` in this session? (The pipeline guard will reject the write if not.)
- [ ] Does every diagram pass the per-type limit checks? (Node count, participant count, message count, nesting depth.)
- [ ] Does every diagram have a caption (italic, before the code block, under 15 words, concrete)?
- [ ] Does every diagram have alt text (HTML comment, one sentence, describes structure and relationships)?
- [ ] Do all node labels match the terminology used in the prose or the Tech Writer's suggestion?
- [ ] Does every diagram use node shapes consistently — no shape carrying two meanings within a diagram or across diagrams in the document?
- [ ] For decomposed sets: do detail diagrams preserve the overview's layout direction?
- [ ] Is every diagram understandable in grayscale? Does color supplement, not replace, line styles and labels?
- [ ] Does the mermaid code avoid inline styles, hex colors, click events, and unsupported features?
- [ ] For decomposed sets: does the overview hide internal details? Do detail diagrams reuse the subsystem name from the overview?
- [ ] Are all declined suggestions documented with `[DECLINED-SUGGESTION: reason]`?

### Step 10b Success Criteria

Before submitting `14-diagrams-v2.md`, verify:

- [ ] Is every MUST item from the SME review corrected? (No exceptions.)
- [ ] Does the change log document each modification with SME review item reference?
- [ ] Do all modified diagrams still pass the diagram guide's hard limits?
- [ ] Are all declined SHOULD items documented with `[DECLINED: reason]`?
- [ ] Did you re-verify node labels against prose terminology after making changes?
- [ ] Did you re-run the squint test on all modified diagrams?

## Key Rules

These constraints apply to both Step 7b and Step 10b:

1. **Follow diagram-guide.md MUST rules exactly.** They define the hard limits — node counts, format, captions, labeling, prose independence, grayscale readability.
2. **Decompose rather than overload.** 9 nodes is the maximum. 5-7 is the target. "Make it fit" is not a strategy.
3. **Verify node labels against prose terminology.** If the prose says it one way, the node says it the same way.
4. **Do not introduce system components or behaviors absent from the prose or the Tech Writer's suggestion.** Diagrams illustrate what is described; they do not extend the description.
5. **Produce diagrams that are understandable in grayscale.** Color supplements line styles and labels — it does not replace them.
6. **Do not use decorative elements, emoji, icons, inline styles, hex colors, click events, or complex CSS in mermaid code.**
7. **Correct all MUST items from SME feedback.** No exceptions.
8. **Re-verify against the diagram guide's limits after every modification** — including modifications from review feedback.
9. **Produce a caption and alt text for every diagram.** No diagram ships without both.
10. **Maintain shape semantics across all diagrams in a document.** If rectangles mean "service" in diagram 1, they mean "service" in diagram 5.
11. **Preserve directional flow in decomposed sets.** Detail diagrams inherit the overview's layout direction (`LR` or `TB`) unless the detail's spatial relationship structurally demands otherwise.
12. **Read `diagram-guide.md` before writing any artifact.** The pipeline guard enforces this.

## Common Pitfalls

Avoid these failure modes:

**1. Overloading diagrams instead of decomposing**

Bad: Adjusting layout to fit 12 nodes into one diagram
Good: Decomposing into overview (6 nodes) + 2 detail diagrams (5 nodes each)

**2. Creating diagrams without spatial insight**

Bad: Creating a diagram for a simple list of three configuration options
Good: Declining the suggestion with `[DECLINED-SUGGESTION: Config options are a simple list with no spatial relationship — prose handles this in one paragraph]`

**3. Using node labels that don't match prose terminology**

Bad: Prose says "auth middleware", diagram says "Authentication Layer"
Good: Prose says "auth middleware", diagram says "Auth Middleware"

**4. Fighting mermaid's constraints**

Bad: Trying to use custom icons, inline styles, or unsupported features
Good: Using standard mermaid shapes and letting layout and grouping carry the hierarchy

**5. Preserving wrong diagrams out of attachment to v1**

Bad: Declining an SME MUST item because "the diagram looks clean as is"
Good: Correcting the technical error even if it requires redrawing the entire diagram

**6. Producing diagrams without captions and alt text**

Bad: Just the mermaid code block
Good: Caption (italic) + alt text (HTML comment) + mermaid code block

**7. Missing the squint test**

Bad: A diagram where the primary flow crosses multiple edges and the main point is buried
Good: Restructuring layout or decomposing so the main flow runs straight along the declared direction

**8. Creating decorative diagrams**

Bad: Adding background fills, colors, or subgraphs for aesthetics
Good: Every visual element encodes information or it is removed

## Notes

- **Decomposition is your default response to complexity.** When a suggestion describes 10+ components, do not look for layout tricks to fit them into one diagram. Split into overview + detail before writing any mermaid code.
- **The diagram guide is your contract.** The SME reviews for accuracy; the Editor reviews for conformance to the guide. You must satisfy both.
- **Type selection is correctness, not preference.** If the Tech Writer recommends a flowchart for an API interaction that is fundamentally request/response, override to sequence diagram and document why.
- **Grayscale readability is non-negotiable.** A diagram that requires color to be understood fails the accessibility test.
- **Spatial relationships determine diagram type.** Hierarchy → TB flowchart. Process → LR flowchart. Interaction → sequence diagram. Lifecycle → state diagram. Data model → ER diagram.
