# Task: SME Review

## Task Overview

This task executes at two points in the writing pipeline: Step 5 (review of Draft v1) and Step 8 (review of Draft v2 + Diagrams). You are operating as the SME agent to independently verify technical accuracy of all factual claims in the draft and diagrams. Your job is to build your own understanding of what is true from primary sources, then audit the draft against that truth. You are not reviewing style, structure, or tone — you are verifying facts.

## Input Contract

### Step 5: Review Draft v1

Read these files before starting work:

| File                                                          | Purpose                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `{project}/04-draft-v1.md` (or `06-draft-v1r1.md` if revised) | The draft text to review for technical accuracy                                            |
| `{project}/01-research.md`                                    | Research notes for cross-reference (not a source of truth)                                 |
| `{project}/00-request.md`                                     | Documentation goal, audience profile, scope boundaries (defines what is in-scope)          |
| `{project}/state.yaml`                                        | Current pipeline state (should confirm this is Step 5, Task A)                             |
| `guides/review-taxonomy.md`                                   | Classification system (MUST/SHOULD/MINOR) and SME-specific classification guidance         |
| `guides/style-guide.md`                                       | Reference only — for consistent terminology in your reviews (you do not flag style issues) |
| Project planning artifacts (paths in task prompt)             | PRD, Architecture doc, Epics — understand product intent and design decisions              |

### Step 8: Review Draft v2 + Diagrams

Read these files before starting work:

| File                            | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `{project}/08-draft-v2.md`      | Revised draft text to review                                   |
| `{project}/10-diagrams-v1.md`   | Designer's diagrams to review for technical accuracy           |
| `{project}/07-sme-review-v1.md` | Your previous review — verify MUST items are resolved          |
| `{project}/01-research.md`      | Research notes for cross-reference                             |
| `{project}/00-request.md`       | Documentation goal and scope                                   |
| `{project}/state.yaml`          | Current pipeline state (should confirm this is Step 8, Task B) |
| `guides/review-taxonomy.md`     | Classification system                                          |
| `guides/style-guide.md`         | Reference only                                                 |
| Project planning artifacts      | PRD, Architecture doc, Epics                                   |

**IMPORTANT:** Always start from the source of truth (codebase, config files, official docs), not from the draft. The draft is the thing being tested.

## Output Contract

### Step 5 Output

Produce exactly one file:

| File                            | Format                                                                                                     | Purpose                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `{project}/07-sme-review-v1.md` | Review items (per review-taxonomy format with `**Evidence:**` for MUST items) + Review Summary (with gate) | Technical accuracy feedback for Tech Writer and gate for Manager |

### Step 8 Output

Produce exactly one file:

| File                            | Format                                                                           | Purpose                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `{project}/11-sme-review-v2.md` | Previous review resolution status + Draft items + Diagram items + Review Summary | Combined technical review for Tech Writer, Designer, and Manager |

**Naming convention:** Replace `{project}` with the actual project directory name specified in `state.yaml`.

## Instructions

### Step 5: Technical Review of Draft v1

#### Phase 1: Independent Research

**Before reading the draft**, build your own understanding of the topic from primary sources:

1. Read `00-request.md` to understand what the document is supposed to cover
2. Go to the source of truth:
   - Read source code (backend handlers, middleware, configurations)
   - Examine config files (CDK stacks, infra configs, package.json)
   - Run commands to verify behavior (build, test, deploy dry-runs)
   - Check API responses using available tooling
   - Read official external documentation for third-party services (Clerk, DynamoDB, CloudFront, etc.)
3. Build your mental model of how the system works
4. Document key facts: actual timeout values, exact retry counts, real partition key formats, specific error codes, etc.

**This ordering is critical.** If you read the draft first, you are anchored to its claims and will read code looking for confirmation. If you read code first, you are anchored to reality and will read the draft looking for deviations.

**Verification hierarchy** (when sources disagree):

1. Running code (what the system does at runtime)
2. Configuration files (what the system is configured to do)
3. Architecture docs / ADRs (what was decided)
4. Planning docs (what was intended)
5. Draft claims (what documentation says)

Code is runtime truth. When code and planning docs disagree, document what the code does and flag the discrepancy.

#### Phase 2: Cross-Reference Research Notes

Read `01-research.md` to understand what the Tech Writer found. Cross-reference against your independent research:

- Where Tech Writer's research and your verification agree — note alignment
- Where they disagree — determine if the discrepancy affects the draft:
  - If draft is wrong (matches stale research over current code) → MUST finding against draft with evidence
  - If draft is correct but research note is stale → note the research inaccuracy in your review for audit trail (not a MUST against the draft)

The Tech Writer's research notes are a cross-reference, **not a source of truth**. Never validate the draft solely against `01-research.md`.

#### Phase 3: Audit Draft Claims

Now read the draft. Audit every factual claim against your independent research:

1. **Ignore `[DECLINED: ...]` entries** in the draft's `## Review Responses` section — those are Editor-Tech Writer style negotiations, not your jurisdiction
2. **For each factual assertion**, ask:
   - Can you verify it? Locate the source of truth
   - Is it correct? Does evidence match the claim?
   - Is it complete enough? Does it omit something that changes reader understanding?
   - Is it misleadingly framed? Technically true but creating wrong mental model?
3. **Check for sins of omission:**
   - Missing prerequisite the reader needs
   - Failure mode that changes the procedure
   - Security consideration that affects the workflow
   - Configuration default that differs from what reader would assume
   - Omissions affecting happy path → MUST; common scenarios → SHOULD; rare edge cases → MINOR

**What to flag:**

| Finding                                                         | Severity | Evidence Required |
| --------------------------------------------------------------- | -------- | ----------------- |
| Factual error                                                   | MUST     | Yes               |
| Misleading framing                                              | MUST     | Yes               |
| Security issue (credential exposure, data loss, missing auth)   | MUST     | Yes               |
| Instruction that would fail or produce wrong results            | MUST     | Yes               |
| Unsubstantiated claim ("dramatically improves", "always use X") | SHOULD   | Encouraged        |
| Oversimplification that could mislead advanced reader           | SHOULD   | Encouraged        |
| Missing edge case (common scenario)                             | SHOULD   | Encouraged        |
| Missing edge case (rare corner case)                            | MINOR    | Optional          |
| Terminology preference (both correct)                           | MINOR    | Optional          |

**Apply edge case severity tiering:**

- Happy path fails → MUST
- Common scenario most users hit → SHOULD
- Rare corner case (unusual config, edge environment) → MINOR

#### Phase 4: Resolve Unverified Markers

Every `[UNVERIFIED]` marker in the draft is assigned to you. For each:

1. Verify the claim and provide the correct value with evidence
2. OR confirm it is genuinely unverifiable and state what is needed (access, tooling, runtime test)

**Special handling for safety-adjacent claims:** If you cannot verify a claim about credential management, destructive operations, data loss scenarios, or permission boundaries, classify as MUST even when unverified — safety claims get the benefit of the doubt. A draft that says "this operation is non-destructive" must be provably non-destructive, or the claim must be removed.

Do not leave any `[UNVERIFIED]` markers unaddressed.

#### Phase 5: Review Diagram Suggestions

If the draft includes diagram suggestions (notes about what diagrams should be created):

1. Review for technical feasibility — can the suggested diagrams be created accurately?
2. Are the listed components real?
3. Are the described relationships correct?
4. Would the suggested diagram depict behavior that actually exists?

This is **not** reviewing diagrams themselves (that happens in Step 8) — you are checking whether the diagram suggestions are grounded in reality.

#### Phase 6: Check Hyperbole and Security

Flag unsubstantiated marketing claims:

- "dramatically improves" — quantify or qualify
- "the best approach" — says who? Under what conditions?
- "always use X" — are there exceptions?

Classify as SHOULD with note to provide evidence or qualify the claim.

**Security audit:**

- Does procedure expose credentials?
- Do code examples use real keys, account IDs, or internal endpoints?
- Does guide skip an auth step?
- Does configuration change open wider blast radius than reader expects?
- Do instructions cause data loss without warning?

These are MUST when confirmed, MUST even when unverifiable if risk is safety-related.

#### Phase 7: Write Review Items

For each issue found, write a review item using the SME format:

```markdown
### [SEVERITY] Section: "Section Title" — Short description

One to three sentences explaining the issue. Quote the problematic claim.
State what is actually true.

**Evidence:** File path and line number, command output, config value, or doc URL
**Location:** Section heading and paragraph number or line range
**Suggested fix:** Concrete suggestion with the correct value and source reference
```

**Evidence field rules:**

- **MUST items:** Evidence is required. File path + line number, command output, config file reference, or official doc URL
- **SHOULD items:** Evidence is strongly encouraged
- **MINOR items:** Evidence is optional

The `**Evidence:**` field creates an audit trail. "This is wrong" without showing what is actually correct is not actionable.

**Example:**

```markdown
### [MUST] Section: "Configure retry behavior" — Wrong default retry count

The draft states "the handler retries failed requests 5 times." The actual
implementation retries 3 times with exponential backoff.

**Evidence:** `backend/src/middleware/retry.ts:47` — `const MAX_RETRIES = 3`
**Location:** "Configure retry behavior", paragraph 2
**Suggested fix:** Change "5 times" to "3 times with exponential backoff
starting at 100ms" (backoff base: `retry.ts:49`, `INITIAL_DELAY_MS = 100`).
```

#### Phase 8: Write Review Summary

End your review with:

```markdown
## Review Summary

| Severity | Count |
| -------- | ----- |
| MUST     | X     |
| SHOULD   | Y     |
| MINOR    | Z     |

**Gate recommendation:** [PASS | MUST-REVISE | CONDITIONAL-PASS]

[Optional: One paragraph explaining overall assessment and key patterns]
```

**Gate values:**

- **PASS:** Zero MUST items
- **MUST-REVISE:** One or more MUST items
- **CONDITIONAL-PASS:** Zero MUST but high density of SHOULD items indicating a pattern (all relate to same systemic issue)

---

### Step 8: Technical Review of Draft v2 + Diagrams

This is a **combined review** of revised draft text and Designer's diagrams.

#### Phase 1: Verify Previous Review Resolution

Read your previous review (`07-sme-review-v1.md`). For each MUST item:

1. Locate the corresponding issue in the revised draft
2. Verify it is resolved correctly
3. Mark resolution status:
   - **Resolved** — issue fixed as suggested or with acceptable alternative
   - **Unresolved** — issue persists; re-flag as MUST with `[UNRESOLVED from previous review]` tag

Create a "Previous Review Resolution" section in `11-sme-review-v2.md`:

```markdown
## Previous Review Resolution

### [MUST] Section: "Configure retry behavior" — Wrong default retry count

**Status:** Resolved
**Verification:** Draft now correctly states "3 times with exponential backoff"

### [MUST] Section: "Authentication" — Missing prerequisite

**Status:** [UNRESOLVED from previous review]
**Issue:** Prerequisite section still absent. Readers still cannot complete auth setup.
```

#### Phase 2: Review New or Changed Draft Content

Apply the same verification methodology from Step 5 to new or changed content:

1. Conduct independent research if new topics introduced
2. Audit new claims against source of truth
3. Resolve any new `[UNVERIFIED]` markers
4. Check for new factual errors, security issues, misleading framing

**Do not re-review unchanged content** unless your independent research revealed something new.

#### Phase 3: Review Diagrams for Technical Accuracy

For each diagram in `10-diagrams-v1.md`, verify:

| Check                                                                      | Severity | What to verify                                                    |
| -------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| Arrow direction                                                            | MUST     | Does flow go the correct direction? (requests, responses, events) |
| Missing node in flow                                                       | MUST     | Is a component that exists in the system absent from the diagram? |
| Incorrect cardinality or relationship type                                 | MUST     | One-to-many shown as one-to-one? Optional shown as required?      |
| Node label contradicts prose or names wrong component                      | MUST     | Does label match actual component name in code and prose?         |
| Diagram depicts behavior that doesn't exist                                | MUST     | Does the depicted flow actually happen?                           |
| Time ordering or sequence misrepresented                                   | MUST     | Are events shown in wrong order?                                  |
| Concurrency depicted as sequential (or vice versa) when it changes meaning | MUST     | Does diagram imply synchronous when it's async, or vice versa?    |
| Implicit coupling depicted as explicit flow                                | MUST     | Does diagram show a direct integration that doesn't exist?        |
| Detail diagram adds no genuine insight beyond overview                     | SHOULD   | Is the detail version just the overview with more nodes?          |

**You do NOT review diagrams for:**

- Node counts (Editor handles diagram conformance)
- Caption quality (Editor)
- Styling or layout (Editor)
- Prose integration (Editor)
- Alt text (Editor)

Your domain: **technical accuracy only**. Does the diagram correctly represent system behavior?

**Write diagram review items:**

```markdown
### [MUST] Diagram: "Authentication Flow" — Wrong arrow direction

The diagram shows the arrow from "Frontend" to "Clerk" labeled "JWT response",
but JWTs are returned FROM Clerk TO Frontend, not the other way around.

**Evidence:** `backend/src/middleware/auth.ts:28-34` — Clerk webhook sends JWT
in response to auth success. Frontend receives and stores the token.
**Location:** Diagram 2, "Authentication Flow", arrow between nodes 1 and 2
**Suggested fix:** Reverse arrow direction. Label should be "JWT response" pointing
from Clerk node to Frontend node.
```

#### Phase 4: Write Combined Review Summary

Your `11-sme-review-v2.md` must include:

1. **Previous Review Resolution** section (status of each MUST from Step 5)
2. **Draft Review Items** (new findings in revised text)
3. **Diagram Review Items** (technical accuracy findings for diagrams)
4. **Review Summary** (counts and gate recommendation)

```markdown
## Review Summary

**Previous review status:** X of Y MUST items resolved, Z unresolved
**New draft findings:** A MUST, B SHOULD, C MINOR
**Diagram findings:** D MUST, E SHOULD, F MINOR

| Severity | Count (Total) |
| -------- | ------------- |
| MUST     | X             |
| SHOULD   | Y             |
| MINOR    | Z             |

**Gate recommendation:** [PASS | MUST-REVISE | CONDITIONAL-PASS]
```

---

## Success Criteria

Before submitting your review, verify:

### Step 5 Checklist

- [ ] Did you conduct independent research from primary sources BEFORE reading the draft?
- [ ] Does every MUST item have an `**Evidence:**` field with verifiable reference?
- [ ] Did you cross-reference the Tech Writer's research notes against your findings?
- [ ] Did you resolve every `[UNVERIFIED]` marker in the draft?
- [ ] Did you apply edge case severity tiering (happy path → MUST, common → SHOULD, rare → MINOR)?
- [ ] Did you check for security concerns (credentials, destructive ops, missing auth)?
- [ ] Did you review diagram suggestions for technical feasibility?
- [ ] Is every finding about technical accuracy, not style or structure?
- [ ] Does the review stay within scope defined in `00-request.md`?
- [ ] Review summary includes counts and gate recommendation?

### Step 8 Checklist

- [ ] Did you verify resolution of every MUST item from `07-sme-review-v1.md`?
- [ ] Did you conduct independent research for new or changed content?
- [ ] Did you review every diagram for technical accuracy using the SME evaluation criteria?
- [ ] Did you distinguish between technical accuracy (your domain) and diagram conformance (Editor's domain)?
- [ ] Does `11-sme-review-v2.md` include: previous review resolution status, draft items, diagram items, and review summary?
- [ ] Are unresolved MUST items from previous review flagged with `[UNRESOLVED from previous review]`?

---

## Key Rules

These constraints apply to both Step 5 and Step 8:

1. **Independent research is mandatory.** Do not validate draft against Tech Writer's research notes. `01-research.md` is a cross-reference, not truth.
2. **Evidence is required for MUST items.** File path + line number, command output, config value, or doc URL. No exceptions.
3. **Do not review for style.** Tone, voice, formatting, structure are the Editor's domain unless they cause technical misunderstanding.
4. **Handle unverifiable claims per taxonomy:** SHOULD with `[UNVERIFIED]` tag, except safety-related claims (data loss, credentials, destructive ops) which are MUST even when unverified.
5. **Apply edge case severity tiering:** Happy path fails → MUST; common scenario → SHOULD; rare corner case → MINOR.
6. **Flag hyperbole and unsubstantiated claims:** "dramatically improves," "always use X" require evidence or qualification. Classify as SHOULD.
7. **Review diagrams for technical accuracy only.** Node counts, captions, styling, prose integration are Editor's conformance domain.
8. **Verify previous MUST resolution before reviewing new content** (Step 8 only).
9. **When code and planning docs disagree:** Document what the code does. Flag the discrepancy for human owner.
10. **For external service claims:** Verify project's usage from codebase/config. Verify service's behavior from official docs. Cite official docs as evidence.

---

## Common Pitfalls

Avoid these failure modes:

**1. Reading the draft first**

- Bad: Read draft, then look for code to confirm claims
- Good: Build independent understanding from code, then audit draft against it

**2. Rubber-stamping**

- Bad: Review has zero findings; "everything looks good"
- Good: Every draft has at least one claim worth deeper verification. Zero MUST items is fine. Zero items total suggests weak review.

**3. Trusting research notes as truth**

- Bad: Draft matches `01-research.md`, so it passes
- Good: Verify draft claims against source code and config, not just research notes

**4. Evidence-free MUST findings**

- Bad: "This is wrong" with no proof of what is actually correct
- Good: MUST item with `**Evidence:**` showing file path, line number, and correct value

**5. Flagging every missing edge case as MUST**

- Bad: All edge cases are MUST regardless of frequency
- Good: Apply edge case severity tiering based on how many users encounter it

**6. Reviewing for style**

- Bad: Flagging tone, voice, or formatting issues
- Good: Only flag style when it causes technical misunderstanding; otherwise leave for Editor

**7. Scope-creeping the document**

- Bad: Flagging absence of topics not in `00-request.md` as MUST
- Good: Verify in-scope content is accurate. Note out-of-scope suggestions as recommendations, not review items.

**8. Confusing product intent with system reality**

- Bad: PRD says "event-driven" but code is synchronous? Force documentation to match PRD.
- Good: Document what code does. Flag discrepancy for human owner.

**9. Not tracking previous review resolution (Step 8)**

- Bad: Re-reviewing everything from scratch without checking if previous MUST items are resolved
- Good: Verify each previous MUST is resolved before auditing new content

**10. Reviewing diagram conformance instead of accuracy**

- Bad: Flagging missing captions, node count violations, or styling issues
- Good: Only flag technical inaccuracies (wrong arrows, missing components, incorrect relationships)

---

## Notes

- **This review prevents shipping inaccurate documentation.** Factual errors caught now save user frustration and support burden later.
- **Independent research is the SME's superpower.** Tracing through middleware, finding actual retry counts, discovering recent config changes — this is where SME value lives.
- **Evidence creates accountability.** The `**Evidence:**` field makes reviews auditable and prevents "trust me" feedback loops.
- **Depth instinct is correct behavior.** Flag where document is vague about things with specific answers (timeout values, retry counts, error codes). Classify as SHOULD unless vagueness creates factual gap.
- **The verification hierarchy matters.** Code is runtime truth. When documentation contradicts code, code wins.
- **Unverifiable claims need handling, not skipping.** Either verify them or state what is needed to verify. Do not silently skip.
- **Safety gets benefit of the doubt.** Claims about data loss, credentials, destructive operations are MUST even when you cannot fully verify.
- **Do not let perfect be enemy of good.** Verification standard is "sufficient to falsify incorrect claims," not "prove total system correctness."
