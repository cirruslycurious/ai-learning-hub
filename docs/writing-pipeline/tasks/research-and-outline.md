# Task: Research and Outline

## Task Overview

This is Step 1 (Phase 1: Foundation) of the writing pipeline. You are operating as the Tech Writer agent to research a documentation topic from primary sources and produce a detailed structural outline. This task creates the foundation for all subsequent drafting and review work.

## Input Contract

Read these files before starting work:

| File                        | Purpose                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `{project}/00-request.md`   | Documentation goal, audience profile, scope boundaries, **target length**, and any special constraints |
| `{project}/state.yaml`      | Current pipeline state (should confirm this is Step 1, Task A)                                         |
| `guides/style-guide.md`     | Writing standards you must follow (voice, structure, formatting, naming, length, patterns)             |
| `guides/review-taxonomy.md` | Severity classification system (MUST/SHOULD/MINOR) used in reviews you'll receive later                |

**IMPORTANT:** Do not proceed until you have read all four files. The request file defines what you're writing — including the target length, which constrains the outline's scope and depth. The style guide defines how you write it.

## Output Contract

Produce exactly two files:

| File                       | Format                                                                                                                                                        | Purpose                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `{project}/01-research.md` | Research notes with Claim + Source + Confidence for each finding                                                                                              | Verified understanding from primary sources      |
| `{project}/02-outline.md`  | Structural outline with Heading, Covers, Word Budget, Key Points, Research Notes, Progressive Disclosure for each section, plus a Length Budget summary table | Blueprint for the draft with full section detail |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

**Length compliance:** The outline's section word budgets must sum to within 20% of the target length specified in `00-request.md`. The Length Budget summary table at the end of the outline must show the total budget and variance from target.

## Instructions

### Phase 1: Research

**1. Understand the assignment**

Read `00-request.md` completely to extract:

- **Documentation goal:** What are you documenting? (feature, workflow, concept, reference)
- **Audience profile:** Who is the reader? What do they know? What do they need to know?
- **Scope boundaries:** What is included? What is explicitly out of scope?
- **Document type:** Tutorial, how-to guide, explanation, reference?
- **Target length:** How many words? This constrains outline scope and section depth.
- **Special constraints:** Required sections, integration with existing docs?

**2. Conduct primary source research**

Research means building verified understanding from actual sources, not writing from assumptions or general knowledge.

**What counts as primary sources:**

- Source code (function signatures, config defaults, error handling, data flow)
- Running commands and observing their output
- Official documentation for tools, services, and APIs
- API responses, error messages, log output
- Existing project documentation, architecture decisions, database schemas
- Configuration files, package.json, CDK stacks, infrastructure code

**What does NOT count:**

- General knowledge about how a technology "usually works"
- Assumptions based on naming conventions
- Information from Stack Overflow or blog posts (unless they are official vendor blogs)
- Guesses about behavior you cannot observe

**How to research:**

- Use the Read tool to examine source code at specific file paths
- Use the Bash tool to run commands and capture output
- Use the Grep and Glob tools to find relevant code patterns
- Use the WebFetch tool for official documentation URLs
- Document every finding with its source citation

**3. Organize findings**

For each finding, record:

- **Claim:** What you learned (one sentence, specific and verifiable)
- **Source:** Exact location (file path with line numbers, command executed, doc URL, API endpoint)
- **Confidence:** Verified | Inferred | Unverified

**Confidence levels:**

- **Verified:** You read the source and confirmed the claim directly. State it as fact in the draft.
- **Inferred:** You derived the claim from related evidence but did not confirm it directly. Qualify it in the draft: "Based on the configuration in `config.yaml`, the default timeout appears to be 30 seconds."
- **Unverified:** You could not access the source or the source does not exist. Mark it `[UNVERIFIED: what would be needed to verify]` in the draft.

Group findings by logical subtopics that align with the documentation goal. Do not create a flat list — organize them into the natural structure of the topic.

**4. Handle conflicting sources**

When code and documentation disagree, code wins. Code is the runtime truth; documentation may be stale.

Document all conflicts in a "Conflicting Sources" section with:

- What each source says
- Your resolution (which source you trust and why)
- Whether the SME needs to confirm this during technical review

**5. Document gaps**

If you cannot verify something, document it in a "Gaps" section:

- What you could not verify
- What would be needed to resolve the gap (access to a private repo, running a service, API credentials)
- How the gap affects the draft (can you write around it, or is it blocking?)

**Do not invent features or behaviors to fill gaps.** Mark them explicitly so the SME can resolve them.

**6. Identify key terms**

List technical terms the audience may not know (based on the audience profile in `00-request.md`).

For each term, provide:

- The definition sourced from the codebase or official documentation
- Where the term appears in your findings (so you know where to define it in the draft)

**7. Write `01-research.md`**

Structure your research file with these exact sections:

```markdown
# Research Notes

## Topic

One sentence restating the documentation goal from 00-request.md.

## Findings

### [Subtopic Name]

- **Claim:** [What you learned]
- **Source:** [File path:line-range, command, or URL]
- **Confidence:** Verified | Inferred | Unverified

[Repeat for each finding within this subtopic]

### [Next Subtopic Name]

[Continue for all subtopics]

## Conflicting Sources

[Any cases where sources disagree, with your resolution and reasoning]

## Gaps

[What you could not verify, what would be needed to resolve it, and how it affects the draft]

## Key Terms

[Technical terms the audience may not know, with definitions sourced from the codebase or official docs]
```

### Phase 2: Outline

**1. Determine the length budget**

Extract the target length from `00-request.md`. This is the constraint that governs the outline's scope and depth:

- Count the planned H2 sections
- Divide the target length across sections, weighted by topic complexity
- Each section gets a word budget that represents a ceiling, not a fill target

The section budgets must sum to within 20% of the target length. If they exceed the target by more than 20%, the outline is over-scoped — either consolidate sections, reduce depth, or cut sections before submitting.

**The length budget forces hard choices.** If the target is 2,400 words and you plan 8 sections, each section averages ~300 words. That means you cannot give every section deep-dive subsections — you must choose where to go deep and where to stay at overview level. These choices happen now, in the outline, not later when the draft is already 5,000 words.

**2. Structure the document**

Using your research findings, design the document structure following style guide rules:

**Ordering rules (from style-guide.md):**

- Task-based content before reference content
- Prerequisites before procedures
- Overview before detail
- Common cases before edge cases
- Defaults before customization

**Section count guidance:** Aim for 5–7 H2 sections for a typical document. More than 7 H2 sections usually signals a flat structure that will develop redundancy — standalone sections tend to re-explain context that a parent section would have established once. If you have more than 7, evaluate whether some should be subsections of others.

**3. Design each section**

The outline is NOT just a list of headings. For each section, provide:

```markdown
## Section: [Heading Text]

**Covers:** One sentence stating what this section explains or what the reader accomplishes.

**Word budget:** ~X words

**Key points:**

- [Point with source reference from 01-research.md]
- [Point with source reference from 01-research.md]

**Research notes:** Which findings from `01-research.md` support this section. Flag any gaps or unverified claims that affect this section.

**Progressive disclosure:** Describe what a skimming reader gets (heading + first sentence) vs. what a thorough reader gets (full section content).
```

**4. Ensure complete coverage**

Every section in the outline must map to at least one finding in `01-research.md`. If a section does not map to research, either:

- Research it now and update `01-research.md`
- Remove the section from the outline (it's out of scope)

**5. Apply progressive disclosure**

Structure sections so readers choose their depth:

1. **Heading + first sentence** — skimming reader gets the gist
2. **Full section prose** — reading reader gets working knowledge to complete the task
3. **Subsections and callouts** — deep reader gets expert detail, edge cases, internals

Specify this layering explicitly in the "Progressive disclosure" field for each section.

**6. Write the Length Budget summary**

At the end of `02-outline.md`, include a Length Budget summary table:

```markdown
## Length Budget

| Section              | Budget     |
| -------------------- | ---------- |
| Overview             | ~300       |
| Architecture layers  | ~500       |
| System flow          | ~800       |
| Component deep-dives | ~600       |
| Quick reference      | ~200       |
| **Total**            | **~2,400** |

**Target (from 00-request.md):** 2,400 words
**Budget variance:** 0%
```

If the total budget exceeds the target by more than 20%, do not submit the outline. Either consolidate sections, reduce depth, or note the tension for the Editor:

```markdown
<!-- [LENGTH NOTE: Section budgets total ~3,200 words against a 2,400-word target (33% over).
Sections X, Y, and Z each require ~600 words for adequate coverage. Recommend either
increasing the target or splitting "Component deep-dives" into a separate document.] -->
```

**7. Write `02-outline.md`**

Create the outline file with one "Section" block per major section (H2 level) you plan to include in the draft.

Follow the structure shown above. Include enough detail that the Editor can review the outline without reading your research notes.

## Success Criteria

Before submitting your output, verify:

- [ ] Both `01-research.md` and `02-outline.md` exist in the project directory
- [ ] Every finding in `01-research.md` has Claim + Source + Confidence
- [ ] All sources include specific citations (file paths with line numbers, exact commands, URLs)
- [ ] All gaps are documented with what's needed to resolve them
- [ ] Outline sections follow style guide ordering rules (task before reference, prerequisites before procedures)
- [ ] Every outline section references specific findings from `01-research.md`
- [ ] **Every outline section includes a word budget**
- [ ] **Section budgets sum to within 20% of target length from `00-request.md`**
- [ ] **Length Budget summary table is present at the end of the outline**
- [ ] Outline uses progressive disclosure structure (what skimmers get vs. what deep readers get)
- [ ] No placeholder content exists ("TODO: research this", "need to verify")
- [ ] Key terms are defined with sources, not from general knowledge
- [ ] **Outline has no more than 7 H2 sections unless complexity genuinely requires it**

## Key Rules

These constraints apply to this task:

1. **Follow style-guide.md structure rules.** Task sections before reference, prerequisites before procedures, overview before detail.
2. **Cite all sources.** File paths must include line numbers. Commands must be the exact command you ran. URLs must be the actual page you read.
3. **Use confidence levels correctly.** Verified means you saw it directly. Inferred means you derived it. Unverified means you couldn't confirm it.
4. **When code and docs conflict, code wins.** Note the conflict for the SME to confirm.
5. **Mark unverifiable claims.** Use `[UNVERIFIED: what is needed]` format. Do not silently guess or invent behavior.
6. **Research from primary sources only.** Do not write from general knowledge about how a technology "typically works."
7. **Stay within scope.** If you discover adjacent topics during research, note them as potential follow-on documents. Do not expand this document's scope.
8. **Do not create placeholder content.** Every claim must have a source or an explicit unverified marker.
9. **Respect the target length.** The outline's section budgets must sum to within 20% of the target. If they don't, the outline is over-scoped — fix the outline, not the budget.
10. **Prefer fewer, deeper sections over many shallow sections.** A flat outline with 10+ H2 sections will produce a flat, redundant document. Consolidate related content under parent sections.

## Common Pitfalls

Avoid these failure modes:

**1. Writing from general knowledge instead of researching**

Bad: "Lambda functions have a 15-minute timeout limit" (general knowledge)
Good: "Lambda functions have a 15-minute timeout limit (verified via AWS Lambda documentation: https://docs.aws.amazon.com/lambda/latest/dg/configuration-console.html)"

**2. Weak source citations**

Bad: "Source: found in the codebase"
Good: "Source: `backend/src/handlers/retry.ts:42-58`"

**3. Outline that's just headings without detail**

Bad:

```markdown
## Authentication

## Configuration

## Deployment
```

Good:

```markdown
## Section: Configure authentication

**Covers:** You configure Clerk JWT validation and set up middleware to protect routes.

**Word budget:** ~400 words

**Key points:**

- Clerk public key from environment variable (finding: env-vars)
- Middleware chain order matters (finding: middleware-sequence)
- Protected vs. public routes (finding: route-protection)

**Research notes:** Findings 3, 7, 12 from authentication subtopic. Gap: unclear if refresh tokens are handled (see Gaps section).

**Progressive disclosure:** Skimmers learn that auth uses Clerk and middleware. Readers get step-by-step setup. Deep readers get middleware source code walkthrough.
```

**4. Scope creep**

Bad: Researching "how to deploy Lambdas" when the request is "document the API Gateway integration"
Good: Limiting research to API Gateway integration patterns, noting deployment as a separate future document

**5. Missing gaps section**

Bad: Claiming everything is verified when some claims couldn't be confirmed
Good: Explicit gaps section: "[UNVERIFIED: whether DynamoDB streams are enabled] — would need access to CloudFormation stack or `cdk.json` to confirm"

**6. Inventing features**

Bad: "The function retries 3 times" (when you didn't verify this)
Good: "The function appears to have retry logic based on the presence of `aws-sdk-retry-handler` in dependencies, but the retry count could not be verified from the source code [UNVERIFIED: exact retry count — need to inspect handler implementation]"

**7. Creating outline sections with no research backing**

Bad: Adding a "Troubleshooting" section to the outline when you did no troubleshooting research
Good: Only including sections that map to findings in `01-research.md`

**8. Over-scoping the outline for the target length**

Bad: Planning 12 H2 sections with deep-dive subsections for a 2,400-word document (that structure requires 5,000+ words)
Good: Planning 5 H2 sections with word budgets that sum to ~2,400, choosing where to go deep and where to stay concise

**9. Ignoring the Length Budget summary**

Bad: Submitting an outline without the Length Budget table, leaving the word budget implicit
Good: Including the Length Budget summary with per-section budgets, total, target, and variance percentage

## Notes

- **Research is not optional.** Do not write the outline from assumptions. Conduct actual research using the tools available (Read, Bash, Grep, Glob, WebFetch).
- **Source citations enable SME verification.** The SME will use your sources to independently verify claims during technical review. Weak citations make the SME's job harder and slow the pipeline.
- **Outline detail prevents downstream rework.** The Editor reviews your outline at Step 2. If the outline lacks detail, the Editor cannot provide meaningful feedback and the draft will require more revision rounds later.
- **Progressive disclosure is a planning tool.** Thinking about what skimmers vs. deep readers need helps you layer content correctly in the draft phase.
- **The length budget prevents downstream bloat.** If the outline over-scopes, the draft will be over-length, and every revision round will push it further past the target. The Editor can cut redundancy, but the Editor cannot compress a fundamentally over-scoped document. Get the scope right in the outline.
- **Word budgets are ceilings, not fill targets.** A section budgeted at 500 words that can be covered in 350 words is a good section. Do not pad to reach the budget.
