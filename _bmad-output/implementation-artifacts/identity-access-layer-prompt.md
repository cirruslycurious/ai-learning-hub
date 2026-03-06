# Prompt: Identity and Access Layer Document

## Role and context

You are an expert technical writer and cloud systems auditor. You are writing documentation for a greenfield AWS serverless project (zero users, never deployed to production) called AI Learning Hub. The codebase is a TypeScript monorepo using AWS CDK, Lambda, DynamoDB, API Gateway, and Clerk for authentication.

You are producing ONE documentation artifact that describes the **current state of the Identity and Access Layer** — the capabilities Epic 2 intended to establish that every subsequent domain handler builds on. This is NOT an Epic 2 story list or history lesson. It is a platform specification written in present tense.

The foundational baseline document for this project already exists at `docs/architecture/foundational-baseline.md`. You must read it before writing anything. Do not re-document anything that document already covers (DynamoDB encryption, wrapHandler internals, logging, CI/CD, developer tooling). Reference it by name and move on.

---

## Hard constraints

- **Output:** a single Markdown file at `docs/architecture/identity-access-layer.md`
- **Tense:** present tense throughout. "The JWT authorizer validates..." not "Epic 2 built..."
- **No production names:** Do not write actual deployed resource names, physical ARNs, account IDs, or region identifiers. Use CDK logical IDs, naming patterns (`{env}-ai-learning-hub-{suffix}`), and code symbol references instead.
- **No em dashes.** Use commas or parentheses.
- **No endpoint walkthroughs:** The document describes the identity and access model, not HTTP request/response flows for specific routes.
- **Uncertainty is explicit:** If something cannot be proven from repo source code or tests, label it "Unverified" or "Manual review" and state what evidence is missing.
- **Verification is strict:** "Verification" means a test that fails if the requirement breaks. Otherwise mark as "Manual review" or "No automated enforcement."

---

## The identity layer intent

Epic 1 established: "what exists before any handler runs."
Epic 2 establishes: "what is known about the caller before any domain logic runs."

The identity and access layer answers the question: _"What can every handler trust about the caller, and how is that trust enforced?"_

The document must describe:

- What identity primitives exist (authorizer Lambdas, `AuthContext`, API key model)
- How the trust model works (JWT vs API key, scope model, role model)
- What access control guarantees the platform enforces before handlers execute
- What per-user data isolation guarantees exist
- What every subsequent epic can assume about callers without re-implementing auth logic

This does NOT include:

- The HTTP endpoints for managing profiles, API keys, or invite codes (those are domain features)
- User profile business logic (what fields a profile has, what can be edited)
- Invite code UX or campaign logic
- Domain permissions (what a `saves:write` scope actually permits in the saves domain — that belongs to Epic 3)

---

## Classification rule for the identity layer

A capability belongs to the identity layer if and only if it meets **all five** criteria below. Apply this rule to decide what to include and exclude. Include the rule verbatim in Section 2 of the document.

| #   | Criterion                                    | Test                                                                                                                                                                                                                 |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Pre-handler enforcement**                  | It runs before or as part of handler invocation — in an authorizer Lambda or `wrapHandler` — not inside business logic. Handlers receive its output as context; they do not compute it themselves.                   |
| 2   | **Caller-structural, not domain-structural** | It describes WHO the caller is (userId, role, scope, actorType) or WHETHER they are allowed here. It does not describe WHAT they are permitted to do with domain data (saves, projects, notes).                      |
| 3   | **Domain-agnostic**                          | It works identically regardless of which domain endpoint is being called. Auth enforcement for `POST /saves` and `DELETE /projects/:id` behaves the same way.                                                        |
| 4   | **Access baseline**                          | Without it, the system cannot determine whether a caller has the right to perform any operation. The trust model collapses entirely, not just degrades.                                                              |
| 5   | **Enforced or explicitly labeled gap**       | There is either (a) automated enforcement (CDK synth assertion, unit test, lint rule) that fails if the requirement breaks, or (b) an explicit "Manual review" or "No automated enforcement" label in this document. |

**Corollary:** If a capability encodes what a specific identity is allowed to do in a specific domain (e.g., "a user with `saves:write` scope can create saves"), that is a domain permission rule belonging to that epic. The identity layer defines the trust model and enforces access gates. Domains define what passing those gates grants.

**Allowed exceptions:** A domain-owned resource may be documented here only to the extent it demonstrates an identity-layer-enforced property (for example: `UsersTable` is documented here because Epic 2 owns it and it is the identity store; its encryption and PITR properties are already covered by the foundational baseline and are not repeated). Label domain-owned resources explicitly.

---

## Required sections (use these headings verbatim)

### # Identity and Access Layer (Epic 2 Intent)

### ## 1. Purpose of the Identity Layer

Describe what this layer establishes and what question it answers for every downstream handler. State the dependency on the foundational baseline (reference `docs/architecture/foundational-baseline.md` by name). One short paragraph — not a feature list.

### ## 2. Identity Layer Boundaries

Three sub-sections:

- **Belongs to the identity layer** — table of categories and examples
- **Does not belong to the identity layer** — bullet list (domain features, HTTP endpoint behavior, profile business logic)
- **Classification rule** — the five-criterion table above, verbatim

### ## Identity Layer Architecture Overview

A Mermaid diagram showing the two auth paths (JWT and API key) flowing through their respective authorizer Lambdas, through `wrapHandler` auth enforcement, to a generic domain handler. Show `UsersTable` as the API key lookup store. Show `AuthContext` as the output passed to the handler. Do not name specific route stacks or domain handlers.

### ## 3. Trust Model

Describe the two authentication paths: JWT (Clerk-issued, web callers) and API key (hash-based, agent/programmatic callers). For each:

- How the credential is validated (which authorizer Lambda, what it checks)
- What identity claims are extracted (`userId`, `role`, scopes)
- What `AuthContext` fields are populated
- Limitations or trust boundaries (e.g., JWT bypasses scope checks; API keys carry explicit scopes)

Include the exact `AuthContext` type shape (read it from `@ai-learning-hub/types`).

### ## 4. Access Control Model

Describe the three access control dimensions enforced before handlers run:

**Roles:** What roles exist, how they are assigned, what `wrapHandler` does with `requiredRoles`.

**Scopes:** The full `OperationScope` enum, the `SCOPE_GRANTS` mapping (which scopes grant which operations), and how `requireScope` enforces it. State explicitly that JWT callers bypass scope checks.

**Invite gate:** How `InviteCodesTable` acts as an access control mechanism during account creation. Document it as an access primitive, not a feature. One table showing the gate contract (precondition, what redeemInviteCode verifies, what it grants).

### ## 5. Identity Storage Model

Document `UsersTable` and `InviteCodesTable` fully — Epic 2 owns these tables. For each:

- Key schema (PK, SK patterns)
- GSIs
- TTL if any
- What the table stores in the context of identity (not profile features — the identity-relevant fields only: userId, keyHash, role, scopes, status)
- CDK stack that defines it (cross-reference to `TablesStack` in foundational baseline)

State clearly: the CDK management properties (PITR, encryption, naming convention) are defined by the foundational baseline's `TablesStack` configuration; they are not repeated here.

Include a Mermaid diagram showing the identity data model: how `UsersTable` stores both user identity (PROFILE item) and API key records (APIKEY# items) under the same user PK.

### ## 6. Per-User Data Isolation

Describe the guarantee: every DynamoDB query for user data is scoped to `PK = USER#{userId}`. No handler can read another user's data by construction.

For each isolation mechanism, state:

- How it is enforced (key schema design, IAM conditions if any, application-level enforcement in `@db` helpers)
- Verification (test that fails if it breaks, or "No automated enforcement")

### ## 7. API Key Model

Document the API key lifecycle as an identity primitive, not as a user-facing feature. Cover:

- Storage: one-way hash (SHA-256 or equivalent — verify from source), never the raw key
- Lookup: `apiKeyHash-index` GSI on `UsersTable`
- Scopes: how scope strings are stored on the key record and validated at runtime
- Revocation: what "revoked" means structurally (status field, authorizer behavior on revoked key)
- Rate limiting on key operations: note that per-operation rate limits for key creation use the platform rate limiting primitive (from foundational baseline); do not re-document the mechanism

### ## 8. FR and NFR Coverage (Epic 2 Identity Layer)

Two tables. Apply the same strictness rule: verification = a test that fails if the requirement breaks. Otherwise label "Manual review" or "No automated enforcement."

**FRs to cover** (read exact statements from `_bmad-output/planning-artifacts/epics.md`):
FR1 (social auth signup), FR2 (social auth signin), FR3 (sign out all devices), FR4 (view/edit profile), FR5 (generate API keys), FR6 (revoke API keys), FR7 (capture-only API keys), FR8 (redeem invite codes), FR9 (generate invite codes).

Classify each as: Implemented, Partially Implemented, Not Implemented, or Unverified. Include the implementation file and symbol. Be honest about gaps.

**NFRs to cover:** NFR-S3 (API key one-way hash, not recoverable), NFR-S4 (per-user data isolation), NFR-S8 (API key redaction in logs — note this is enforced by the foundational baseline Logger; cross-reference rather than re-document), NFR-S9 (rate limit abuse protection — IP-based secondary limits).

### ## 9. Identity Layer Invariants

State invariants as falsifiable assertions. For each, name the test that enforces it or label the gap honestly.

Required invariants to include (add more if the code warrants it):

- Every request reaching a handler with `requireAuth: true` has a validated `userId` in `authContext`. There is no code path where this is undefined after auth enforcement.
- API keys are stored as one-way hashes. The raw key value is never written to DynamoDB, logs, or response bodies after the creation response.
- A revoked API key is rejected by the authorizer before reaching any handler.
- Scope enforcement occurs in `wrapHandler` before handler execution. A handler with `requiredScope` set cannot be reached by a caller whose key does not carry that scope.
- Every DynamoDB query for user-owned data uses `PK = USER#{userId}` derived from the validated `authContext`, never from a request parameter alone.
- The `apiKeyHash-index` GSI is the only lookup path for API key validation. No full-table scan is used.

---

## Commands you must run and cite

Run these before writing. Cite the output (summarized, not pasted in full).

```bash
# Find and read the auth CDK stacks
find infra/lib/stacks -name "*.ts" | xargs grep -l "authorizer\|Authorizer\|auth" | head -20

# Read the auth handler implementations
find backend/functions -name "*.ts" | xargs grep -l "authorizer\|verifyToken\|apiKey" | head -10

# Read AuthContext type
cat backend/shared/types/src/api.ts   # or wherever AuthContext is defined

# Read scope definitions
cat backend/shared/middleware/src/scope-resolver.ts

# Read the authorizer handlers
find backend/functions -name "*.ts" | xargs grep -l "generatePolicy\|deny\|parsedAuth" | head -10

# Read UsersTable schema from db package
cat backend/shared/db/src/users.ts

# Read InviteCodesTable schema
cat backend/shared/db/src/invite-codes.ts

# Check what tests exist for auth
find . -name "*.test.ts" | xargs grep -l "authorizer\|auth-consistency\|requireAuth\|apiKey" | head -20

# Run the test suite and note results
npm test 2>&1 | tail -30

# Type check
npm run type-check 2>&1 | tail -10

# Check CDK auth stack definitions
find infra/lib/stacks -name "auth*.ts" -o -name "*auth*.ts" | head -10
```

---

## Process requirements

1. Read `docs/architecture/foundational-baseline.md` first. Note what is already documented there and do not repeat it.
2. Read `_bmad-output/planning-artifacts/epics.md` to extract exact FR1-FR9 and NFR-S3, S4, S8, S9 statements.
3. Read the CDK auth stack(s) to find the actual authorizer Lambda wiring, cache TTL, and any IAM grants.
4. Read the authorizer handler source files to understand what claims are extracted and how `parsedAuth` is populated.
5. Read `AuthContext` and `OperationScope` from `@ai-learning-hub/types` — use exact field names and types.
6. Read `SCOPE_GRANTS` from `@ai-learning-hub/middleware` — list the full mapping.
7. Read `UsersTable` and `InviteCodesTable` access patterns from `@ai-learning-hub/db`.
8. Run the commands above and note which tests pass and which fail. Be honest in the invariants section.
9. Produce the Mermaid diagrams based on actual wiring, not assumptions.

---

## What good looks like

A developer implementing Epic 4 (Projects) should be able to read this document and answer:

- What is in `authContext` when my handler runs? What are the exact field names and types?
- If I need to restrict a route to `admin` role, what do I pass to `wrapHandler`?
- If I create a new API key scope for project operations, where does it get defined and how is it enforced?
- Can a caller with a `saves:write`-scoped API key reach my projects endpoint? How is that prevented?
- If I query `ProjectsTable` with `PK = USER#{userId}`, where does that userId come from and is it safe to trust?

If those five questions are answerable from this document alone (without reading source code), it is complete enough.

---

## Quality rules

- No filler prose. Prefer tables, code type signatures, and invariant statements over paragraphs.
- Every "Implemented" claim in the FR/NFR table must have a file path and symbol.
- Every "Verified" claim must name a specific test file.
- Mermaid diagrams must reflect actual CDK wiring, not aspirational architecture.
- Do not claim something is "enforced" if the enforcement is only convention or documentation.
- If a test is currently failing (check `npm test` output), note it explicitly.
