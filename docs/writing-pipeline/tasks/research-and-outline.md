# Task: Research and Outline

## Task Overview

This is Step 1 (Phase 1: Foundation) of the writing pipeline. You are operating as the Tech Writer agent to research a documentation topic from primary sources and produce a detailed structural outline. This task creates the foundation for all subsequent drafting and review work.

## Input Contract

Read these files before starting work:

| File                        | Purpose                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `{project}/00-request.md`   | Documentation goal, audience profile, scope boundaries, and any special constraints        |
| `{project}/state.yaml`      | Current pipeline state (should confirm this is Step 1, Task A)                             |
| `guides/style-guide.md`     | Writing standards you must follow (voice, structure, formatting, naming, length, patterns) |
| `guides/review-taxonomy.md` | Severity classification system (MUST/SHOULD/MINOR) used in reviews you'll receive later    |

**IMPORTANT:** Do not proceed until you have read all four files. The request file defines what you're writing; the style guide defines how you write it.

## Output Contract

Produce exactly two files:

| File                       | Format                                                                                                       | Purpose                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `{project}/01-research.md` | Research notes with Claim + Source + Confidence for each finding                                             | Verified understanding from primary sources      |
| `{project}/02-outline.md`  | Structural outline with Heading, Covers, Key Points, Research Notes, Progressive Disclosure for each section | Blueprint for the draft with full section detail |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

## Instructions

### Phase 1: Research

**1. Understand the assignment**

Read `00-request.md` completely to extract:

- **Documentation goal:** What are you documenting? (feature, workflow, concept, reference)
- **Audience profile:** Who is the reader? What do they know? What do they need to know?
- **Scope boundaries:** What is included? What is explicitly out of scope?
- **Document type:** Tutorial, how-to guide, explanation, reference?
- **Special constraints:** Length limits, required sections, integration with existing docs?

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

**1. Structure the document**

Using your research findings, design the document structure following style guide rules:

**Ordering rules (from style-guide.md):**

- Task-based content before reference content
- Prerequisites before procedures
- Overview before detail
- Common cases before edge cases
- Defaults before customization

**2. Design each section**

The outline is NOT just a list of headings. For each section, provide:

```markdown
## Section: [Heading Text]

**Covers:** One sentence stating what this section explains or what the reader accomplishes.

**Key points:**

- [Point with source reference from 01-research.md]
- [Point with source reference from 01-research.md]

**Research notes:** Which findings from `01-research.md` support this section. Flag any gaps or unverified claims that affect this section.

**Progressive disclosure:** Describe what a skimming reader gets (heading + first sentence) vs. what a thorough reader gets (full section content).
```

**3. Ensure complete coverage**

Every section in the outline must map to at least one finding in `01-research.md`. If a section does not map to research, either:

- Research it now and update `01-research.md`
- Remove the section from the outline (it's out of scope)

**4. Apply progressive disclosure**

Structure sections so readers choose their depth:

1. **Heading + first sentence** — skimming reader gets the gist
2. **Full section prose** — reading reader gets working knowledge to complete the task
3. **Subsections and callouts** — deep reader gets expert detail, edge cases, internals

Specify this layering explicitly in the "Progressive disclosure" field for each section.

**5. Write `02-outline.md`**

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
- [ ] Outline uses progressive disclosure structure (what skimmers get vs. what deep readers get)
- [ ] No placeholder content exists ("TODO: research this", "need to verify")
- [ ] Key terms are defined with sources, not from general knowledge

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

## Notes

- **Research is not optional.** Do not write the outline from assumptions. Conduct actual research using the tools available (Read, Bash, Grep, Glob, WebFetch).
- **Source citations enable SME verification.** The SME will use your sources to independently verify claims during technical review. Weak citations make the SME's job harder and slow the pipeline.
- **Outline detail prevents downstream rework.** The Editor reviews your outline at Step 2. If the outline lacks detail, the Editor cannot provide meaningful feedback and the draft will require more revision rounds later.
- **Progressive disclosure is a planning tool.** Thinking about what skimmers vs. deep readers need helps you layer content correctly in the draft phase.
