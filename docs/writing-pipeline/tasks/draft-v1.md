# Task: Draft v1

## Task Overview

This is Step 3 (Phase 2: Drafting) of the writing pipeline. You are operating as the Tech Writer agent to transform an approved outline into prose. This task produces the first complete draft that subsequent reviewers (Editor, SME, QA Reader) will evaluate. Your draft establishes the document's structure, voice, technical accuracy, and reader flow.

## Input Contract

Read these files before starting work:

| File                             | Purpose                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `{project}/02-outline.md`        | Approved structural outline with section details, key points, word budgets, and progressive disclosure plan |
| `{project}/03-outline-review.md` | Editor feedback on the outline that you may need to integrate                                               |
| `{project}/01-research.md`       | Research notes with sourced findings to cite in prose                                                       |
| `{project}/00-request.md`        | Documentation goal, audience profile, scope boundaries, **target length**, and document type                |
| `{project}/state.yaml`           | Current pipeline state (should confirm this is Step 3, Task B)                                              |
| `guides/style-guide.md`          | Writing standards (voice, structure, formatting, naming, length, prohibited patterns) — your rules law      |
| `guides/review-taxonomy.md`      | Severity classification system used in reviews you'll receive (MUST/SHOULD/MINOR)                           |

**IMPORTANT:** Read all files. The outline is your blueprint — including its section word budgets, which are your length constraints. The style guide governs how you write every sentence. Research notes are your source material for citations. The target length from `00-request.md` is a hard constraint.

## Output Contract

Produce exactly one file:

| File                       | Format                                                                                          | Purpose                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `{project}/04-draft-v1.md` | Markdown document with prose sections, inline source citations, following style guide structure | First complete draft for editorial and technical review |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

**Length compliance:** The draft must not exceed the target length from `00-request.md` by more than 20%. Include a word count comment at the end of the file: `<!-- Word count: X words | Target: Y words | Δ: +/-Z (W%) -->`. If the draft exceeds the 20% ceiling, cut before submitting.

## Instructions

### Phase 1: Integration Planning

**1. Extract the length constraint**

Read `00-request.md` and note the target length. Calculate your ceiling (target + 20%). This is the hard limit for the draft. Keep it visible as you write — it governs every scope and depth decision.

Read the section word budgets from `02-outline.md`. These are your per-section ceilings. If the outline includes a Length Budget summary, use it as your allocation guide.

**2. Read the outline review**

Open `03-outline-review.md` and extract any structural changes the Editor requested:

- Section reordering
- Added or removed sections
- Changes to scope or coverage
- Progressive disclosure adjustments
- Word budget adjustments (if the Editor flagged over-scoping)

Apply these structural changes to your mental model of the document before you begin drafting. If the Editor's feedback conflicts with the original outline, the Editor's feedback wins — they represent the reader's perspective.

**3. Map outline to research**

For each section in the approved outline:

- Locate the supporting findings in `01-research.md`
- Identify which claims have Verified confidence (state as fact)
- Identify which claims have Inferred confidence (qualify in prose)
- Identify which claims have Unverified confidence (mark with `[UNVERIFIED]`)

Create a mental or written checklist: every section must pull from specific research findings. Do not invent content not backed by research.

**4. Load the style guide**

Re-read `guides/style-guide.md` before drafting. Pay special attention to:

- Voice rules (second person, present tense, active voice in procedures)
- Structure rules (task before reference, prerequisites before procedures)
- Prohibited patterns (marketing language, hedging, synthetic voice patterns)
- Length constraints (sentence, paragraph, section limits)

Your draft must comply with all [MUST] rules and the vast majority of [SHOULD] rules. The Editor will flag violations, and MUST violations will block the gate.

### Phase 2: Progressive Disclosure Structure

Before writing any section, design its layers:

**Layer 1: Heading + opening sentence**

- The skimming reader sees only this
- Heading names the task or concept (no clever titles)
- First sentence states what the reader will do or learn
- Together, these give the gist of the entire section

**Layer 2: Full section prose**

- The reading reader gets working knowledge
- Covers the default case, common scenario, standard workflow
- Provides enough detail to complete the task or understand the concept
- Does not cover edge cases, advanced options, or internal mechanics yet

**Layer 3: Subsections, callouts, cross-references**

- The deep reader explores expert-level detail
- Edge cases, failure modes, configuration options, internals
- Optional shortcuts, alternative approaches, troubleshooting
- Links to related concepts or follow-on documents

**Structure test:** If you removed all H3 subsections under an H2, would the H2 section still make sense on its own? If not, you have not layered correctly — you have flattened required information into subsections.

### Phase 3: Section-by-Section Drafting

For each section in the outline:

**1. Write the section opener**

Follow the style guide rule:

- Task sections: "You [verb] [object] to [accomplish goal]."
- Conceptual sections: "This section explains [concept]."

Do not begin with background, history, or motivation. State the purpose.

**2. Provide a mental model (if needed)**

If this is a procedure or a complex concept, give the reader a mental model before diving into steps or details.

Use one of:

- **Structure:** "The middleware chain processes requests in order: auth, validation, routing."
- **Cause-and-effect:** "Because DynamoDB is schema-on-read, you define access patterns first."
- **Bounded analogy:** "Partition keys work like filing cabinet drawers. The analogy breaks for GSIs." (State where it breaks.)

One model, then content. Do not interleave model and steps.

**3. Write Layer 2 prose**

Follow the outline's "Key points" and the progressive disclosure plan:

- Cover the default case or common scenario
- Use prose paragraphs for conceptual content
- Use numbered lists for procedures (each step starts with a verb)
- Use unordered lists or tables for non-sequential items
- Cite sources inline for verifiable claims (see Citation Format below)
- Mark unverified claims with `[UNVERIFIED: what is needed to verify]`

Apply style guide rules:

- Max 25 words per sentence (except when code adds length)
- One idea per paragraph
- Frontload paragraphs (main point first)
- Max 4 sentences per paragraph in conceptual sections
- Max 2 sentences per paragraph in procedure sections
- No hedging, no marketing language, no synthetic voice patterns

**4. Check against the word budget**

After writing each section, do a rough word count. If the section exceeds its budget from the outline by more than 30%, stop and cut before moving to the next section. Ask:

- Am I explaining something the audience already knows? (Check the audience profile.)
- Am I covering an edge case that belongs in a subsection, not the main flow?
- Am I repeating information that another section already covers?
- Am I providing more context than the reader needs?

Cut now. Do not defer cutting to "final integration" — over-length sections compound into an over-length draft.

**5. Add Layer 3 content (if applicable)**

If the section has edge cases, advanced options, or deep detail:

- Use H3 subsections or callouts
- Keep subsections focused (max 25 lines as evaluation threshold)
- Use **Warning** callouts only for harm-avoidance (data loss, security risk, unrecoverable error)
- Use **Note** callouts for useful but non-critical context
- Use **Tip** callouts for shortcuts or alternative approaches
- Max 2 callouts per section

**Layer 3 content must fit within the section's word budget.** If adding subsections would blow the budget, either cut the subsection (it's optional detail) or condense the Layer 2 prose to make room.

**6. Add cross-references**

If this section relates to another document or section:

- Link instead of repeating information (unless safety-critical)
- Use relative paths for internal links, full URLs for external resources
- State the relationship in prose: "After configuring authentication (see [Auth Guide](./auth.md)), you set up authorization rules."

**7. Self-review the section**

Before moving to the next section, check:

- [ ] Does the heading + first sentence give the gist?
- [ ] Can the target audience (per `00-request.md`) execute this section without implied knowledge?
- [ ] Are all commands copy-pastable and verified against the codebase?
- [ ] Are prerequisites stated before steps that need them?
- [ ] Are all factual claims cited or marked `[UNVERIFIED]`?
- [ ] Does every code example have the language tag and no unexplained placeholders?
- [ ] **Is the section within its word budget (or within 30% over)?**

### Phase 4: Citation Format

Reference sources inline so the SME can trace claims during technical review.

**For code findings:**

```markdown
The function retries 3 times with exponential backoff starting at 100ms
(`backend/src/handlers/retry.ts:42-58`).
```

**For configuration findings:**

```markdown
The default timeout is 30 seconds (`infra/lib/api-stack.ts:156`).
```

**For external documentation:**

```markdown
Lambda functions have a 15-minute timeout limit (see [AWS Lambda
documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-console.html)).
```

**For command verification:**

```markdown
The output shows the table name and item count (verified via `aws dynamodb describe-table --table-name Users`).
```

**For unverified claims:**

```markdown
The system may cache responses for up to 5 minutes [UNVERIFIED: cache duration
not found in code or config — need to inspect CloudFront distribution settings].
```

### Phase 5: Final Integration

**1. Check total word count**

Count the total words in the draft (excluding code blocks and the word count comment). Compare against the target length from `00-request.md`:

- **Within target:** Proceed.
- **Within 20% over target:** Acceptable. Proceed.
- **More than 20% over target:** Cut before submitting. Review each section against its word budget. Identify which sections exceeded their budgets and cut there first. If the draft is more than 50% over target, the scope is likely too broad — add a `[LENGTH NOTE]` comment and cut what you can.

**2. Check section ordering**

Verify your draft follows style guide ordering rules:

- Task-based sections before reference sections
- Prerequisites before procedures that need them
- Overview before detail
- Common cases before edge cases
- Defaults before customization

If the Editor's outline review requested reordering, ensure you applied it.

**3. Check scope compliance**

Compare your draft against `00-request.md`:

- Every section maps to in-scope content
- No sections cover out-of-scope topics
- All required sections (per the request) are present

If you discovered adjacent topics during drafting, do NOT expand scope. Note them in a comment for the Manager:

```markdown
<!-- [SCOPE NOTE: This document does not cover deployment rollback strategies.
Consider a follow-on document for advanced deployment topics.] -->
```

**4. Run the self-review checklist**

Use the Tech Writer self-review checklist (see "Success Criteria" below) before writing the file to disk.

**5. Add word count metadata**

At the end of the draft, add:

```markdown
<!-- Word count: X words | Target: Y words | Δ: +/-Z (W%) -->
```

**6. Write the draft file**

Save the draft as `{project}/04-draft-v1.md`.

Do not add any front matter, metadata, or status markers beyond the word count comment. The draft is pure markdown content plus the word count metadata.

## Success Criteria

Before submitting your draft, verify:

- [ ] Draft file exists at `{project}/04-draft-v1.md`
- [ ] Every section from the approved outline is represented in the draft
- [ ] All structural changes from the outline review are applied
- [ ] Draft follows style guide [MUST] rules with zero violations
- [ ] **Draft word count is within 20% of target length from `00-request.md`**
- [ ] **Word count comment appears at the end of the file**
- [ ] All procedures use numbered lists starting with imperative verbs
- [ ] All conceptual content uses prose paragraphs or unordered lists
- [ ] All commands are copy-pastable and include language tags in code blocks
- [ ] All factual claims have inline source citations or `[UNVERIFIED]` markers
- [ ] Progressive disclosure is applied (heading + first sentence = gist, full section = working knowledge, subsections = deep detail)
- [ ] No placeholder content exists ("TODO: add details", "need to research this")
- [ ] Prerequisites appear before the procedures that need them
- [ ] All callouts use only Note, Warning, or Tip (no other types)
- [ ] Warnings are used only for harm-avoidance (data loss, security risk, unrecoverable error)
- [ ] No marketing language, hedging, or synthetic voice patterns exist
- [ ] Terminology is consistent throughout (one term per concept)
- [ ] All code examples are verified against the actual codebase or tool
- [ ] Cross-references use relative paths for internal links

## Key Rules

These constraints apply to this task:

1. **Follow style-guide.md on every sentence.** Voice, structure, formatting, naming, length, prohibited patterns — all rules apply.
2. **Respect the target length.** Extract it from `00-request.md`. Do not exceed it by more than 20%. If you cannot fit the scope, surface the tension with a `[LENGTH NOTE]` — do not silently produce a 2x over-length draft.
3. **Write to the section word budgets.** Each section has a budget from the outline. Use it as a ceiling. Cut sections that exceed their budgets before moving on.
4. **Cite all sources.** File paths with line numbers, exact commands, doc URLs. Enable SME verification.
5. **Mark unverified claims.** Use `[UNVERIFIED: what is needed]` format. Do not silently guess or invent behavior.
6. **Apply progressive disclosure.** Heading + first sentence for skimmers, full section for readers, subsections for deep readers.
7. **Verify all procedures.** If the draft says "run `npm run deploy`", verify that command exists in `package.json`. Procedures that do not work destroy reader trust permanently.
8. **Stay within scope.** Write only what `00-request.md` asks for. Note adjacent topics as potential follow-ons; do not expand scope.
9. **Use research findings, not general knowledge.** Every claim must map to a finding in `01-research.md` or be marked `[UNVERIFIED]`.
10. **No placeholder content.** "TODO: add details" is never acceptable. If you lack information, mark it `[UNVERIFIED]` with what would resolve the gap.

## Common Pitfalls

Avoid these failure modes:

**1. Writing from general knowledge instead of research**

Bad: "Lambda functions time out after 15 minutes" (general knowledge, no citation)
Good: "Lambda functions time out after 15 minutes (see [AWS Lambda limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html))"

**2. Flat structure with no layering**

Bad: Mixing prerequisites, basic setup, advanced tuning, and troubleshooting all at the same prose level
Good: Basic setup in H2, advanced tuning in H3 subsection, troubleshooting in H3 subsection at the end

**3. Weak or missing citations**

Bad: "The function retries failed requests" (no source)
Good: "The function retries failed requests up to 3 times with exponential backoff (`backend/src/handlers/api.ts:89-102`)"

**4. Passive voice in procedure steps**

Bad: "The configuration file should be edited to include the API key"
Good: "Edit the configuration file to add the API key"

**5. Unverified procedures**

Bad: "Run `npm run build` to compile the application" (command not verified)
Good: Verify `package.json` has a `build` script before writing the step

**6. Marketing language and hedging**

Bad: "This powerful feature makes it easy to seamlessly deploy your application"
Good: "This command deploys the application to the production environment"

**7. Missing mental models for complex procedures**

Bad: Jumping directly into 10-step deployment procedure with no explanation of what happens
Good: "Deployment uploads the build artifact to S3, updates the CloudFront distribution, and invalidates the cache. These steps ensure users see the new version immediately."

**8. Scope creep**

Bad: Adding a "Troubleshooting database performance" section when the request is "document basic CRUD operations"
Good: Limiting content to CRUD operations, noting "Database performance tuning is out of scope for this document"

**9. Undefined terms for the target audience**

Bad: Using "partition key" and "sort key" without definition when the audience profile says "developers new to DynamoDB"
Good: "A partition key is the primary identifier DynamoDB uses to distribute data across servers. A sort key allows you to store multiple items with the same partition key."

**10. Failing to apply outline review feedback**

Bad: Ignoring the Editor's request to reorder sections or add prerequisites
Good: Applying every structural change from `03-outline-review.md` before drafting

**11. Ignoring the word budget and producing an over-length draft**

Bad: Writing 6,000 words against a 2,400-word target because "the topic requires it"
Good: Writing to the section budgets, cutting sections that run long, and surfacing a `[LENGTH NOTE]` if the scope genuinely cannot fit the target

## Notes

- **This draft establishes the baseline.** All subsequent revisions build on this. If the structure is wrong here, you will pay for it in multiple revision rounds. Get the structure right the first time by following the approved outline and the outline review feedback.
- **Source citations enable SME verification.** The SME will use your inline citations to independently verify technical claims. Weak citations make the SME's job harder and increase the chance of technical errors surviving to publication.
- **Progressive disclosure serves all reader types.** Skimmers, readers, and deep readers all use the same document. Layer content so each type gets what they need without forcing others to wade through detail they don't want.
- **Procedures must be runnable.** A reader following your steps should succeed without guessing, without prior knowledge not stated in prerequisites, and without debugging your instructions. Verify every command, every placeholder, every prerequisite.
- **Style guide compliance is not optional.** The Editor will flag violations. Every [MUST] violation you ship is a gate blocker. Every [SHOULD] violation is rework. Write it right the first time.
- **Unverified claims are acceptable; invented claims are not.** If you cannot verify something, mark it `[UNVERIFIED]` with what is needed to resolve it. The SME will handle it. Do not guess and present the guess as fact.
- **The first draft sets the length trajectory.** If this draft is 2x over the target, every subsequent revision will push further past it. The Editor can cut redundancy, but the Editor cannot compress a fundamentally over-scoped document. Respect the word budgets now. Cut now. Do not defer length discipline to later rounds.

## Example Section

Good Layer 2 prose with progressive disclosure:

````markdown
## Configure authentication

You configure Clerk JWT validation and set up middleware to protect routes.

Authentication in this application uses Clerk to issue JSON Web Tokens (JWTs).
The backend validates these tokens on each request to verify the user's
identity. Protected routes require a valid token; public routes do not.

The middleware chain processes requests in this order:

1. CORS handling
2. JWT validation (if the route is protected)
3. Request routing

If JWT validation fails, the request returns a 401 error and does not reach
the route handler.

**Prerequisites:**

- Clerk account with an application configured
- Clerk public key stored in Parameter Store (see [Secrets
  Setup](./secrets.md))

**Steps:**

1. Install the Clerk SDK:

   ```bash
   npm install @clerk/clerk-sdk-node
   ```
````

2. Add the JWT validation middleware to the Lambda handler:

   ```typescript
   import { verifyToken } from "@ai-learning-hub/middleware";

   export const handler = verifyToken(async (event, context) => {
     // Handler logic here
   });
   ```

   The `verifyToken` middleware reads the public key from Parameter Store and
   validates the token in the `Authorization` header
   (`shared/middleware/src/auth.ts:15-42`).

3. Deploy the updated Lambda:

   ```bash
   cd infra
   cdk deploy ApiStack
   ```

### Protected vs. public routes

Protected routes require authentication. Public routes do not.

To mark a route as public, use the `publicRoute` flag in the API Gateway
configuration:

```typescript
const route = api.addRoute("/public/health", {
  integration: healthCheckIntegration,
  publicRoute: true,
});
```

By default, all routes are protected (`infra/lib/api-stack.ts:78`).

**Warning:** Do not mark routes public unless they serve non-sensitive data.
Exposing user data on public routes creates a security vulnerability.

```

This example demonstrates:

- Heading + first sentence gives the gist (what you'll configure)
- Mental model before steps (middleware chain order)
- Prerequisites before procedure
- Numbered steps with imperative verbs
- Inline citations for verifiable claims
- H3 subsection for edge case (public routes)
- Warning callout for harm-avoidance
- Copy-pastable commands with language tags
- No marketing language, no hedging, no synthetic patterns
- Progressive disclosure: skimmers get "configure Clerk JWT and middleware," readers get the full procedure, deep readers get public route configuration
```
