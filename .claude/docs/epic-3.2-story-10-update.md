# Epic 3.2 Update: Story 3.2.10 — Proactive Action Discoverability

## Instructions

Replace the following sections in `_bmad-output/planning-artifacts/epics.md` within the Epic 3.2 block.

---

## 1. Add this row to the Stories table (after 3.2.9)

```markdown
| 3.2.10 | **Proactive action discoverability** — Three components that let agents discover available operations _before_ attempting them, closing the gap between failure-time hints (FR100 `allowedActions`) and proactive guidance. **(1) Global action catalog:** `GET /actions` returns all actions the system supports — action ID, description, HTTP method, URL pattern, input schema (required/optional fields with types and constraints), required headers (`Idempotency-Key`, `If-Match`), required permission scope (from 3.2.6), and expected error codes. Filterable by `?entity=` and `?scope=`. **(2) Resource-scoped available actions:** All single-resource GET responses include `meta.actions[]` — an array of actions valid for _this resource in its current state and version_, each with action ID, URL, required inputs, and constraints. State-bearing entities surface only the transitions legal from `currentState`; non-state entities surface all applicable commands. This fulfills the "entity summary endpoints" clause of FR95. **(3) State graph endpoint:** `GET /states/{entityType}` returns the machine-readable state machine for an entity type — states, transitions (from → to), required preconditions, and the command that triggers each transition. Agents can plan multi-step workflows without trial-and-error. All discoverability payloads use stable, machine-parseable identifiers (no prose). | 3.2.2, 3.2.6 |
```

---

## 2. Replace the Story Dependency Diagram

```
Track A — Shared Infrastructure (parallelizable):
3.2.1  Idempotency & Concurrency ──┐
3.2.2  Error Contract & Envelope ───┤
3.2.3  Event History ───────────────┼──► 3.2.7 Saves Domain Retrofit
3.2.4  Agent Identity & Rate Limit ─┤           │
3.2.5  Cursor Pagination ───────────┘           │
3.2.10 Action Discoverability ──────┘           ▼
                                      3.2.8 Auth Domain Retrofit
3.2.6  Scoped API Keys ────────────────────┘

3.2.1 + 3.2.2 ─────────────────────► 3.2.9 Health, Readiness & Batch
```

---

## 3. Replace the FRs/NFRs covered lines

```markdown
**FRs covered:** FR92, FR93, FR94 (middleware only — per-entity states in Epics 4, 8), FR95 (including "entity summary endpoints" clause via 3.2.10), FR96, FR97, FR100, FR101, FR102, FR103, FR104, FR105, FR106, FR107
**NFRs covered:** NFR-AN1, NFR-AN2, NFR-AN4, NFR-AN5, NFR-AN6, NFR-AN7, NFR-I3
```

---

## 4. Replace the Note paragraph

```markdown
**Note:** FR94-FR95 (state machine enforcement) middleware is built here, but the actual per-entity state definitions and allowed transitions are implemented in their respective epics: projects (Epic 4, FR25), tutorials (Epic 8, FR40). FR98-FR99 (operation resources) remain in Epic 9 (async pipelines). FR108-FR112 remain in Epics 9 and 10. Story 3.2.10 (action discoverability) fulfills FR95's "entity summary endpoints" clause — proactive discoverability that was previously only implied. The global action catalog (`GET /actions`) and state graph (`GET /states/{entityType}`) extend beyond current FRs; a PRD update adding dedicated discoverability FRs (e.g. FR113-FR115) is recommended to close the traceability gap.
```

---

## 5. Update the mermaid diagram (Epic Dependency Diagram section)

In the `AgentNative` subgraph, add the 3.2.10 node:

```mermaid
    subgraph AgentNative["Epic 3.2: Agent-Native API Foundation"]
        AN1["3.2.1-6 Shared Middleware"]
        AN5["3.2.10 Action Discoverability"]
        AN2["3.2.7 Saves Retrofit"]
        AN3["3.2.8 Auth Retrofit"]
        AN4["3.2.9 Health/Batch"]

        AN1 --> AN5
        AN1 --> AN2
        AN5 --> AN2
        AN1 --> AN3
        AN1 --> AN4
    end
```

---

## 6. Update the FR Coverage Map table

Add this row:

```markdown
| FR95 (partial) | Epic 3.2 (3.2.10) | Proactive action discoverability ("entity summary endpoints" clause) |
```

And update the existing FR94-FR95 row to note the split:

```markdown
| FR94-FR95 | Epic 3.2 + 4/8 | State machine enforcement (middleware in 3.2; per-entity states in 4, 8; proactive discoverability in 3.2.10) |
```

---

## Rationale

### FR mapping

| FR    | How 3.2.10 covers it                                                                                                                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR95  | "Agents can explore legal actions by inspecting `allowed_actions` in error responses **or entity summary endpoints**" — the "entity summary endpoints" clause was never implemented. `meta.actions[]` on GET responses and `GET /actions` fulfill it. |
| FR100 | Error contract already provides `allowedActions` at failure time. 3.2.10 extends this pattern to success responses (proactive, not reactive).                                                                                                         |

### NFR mapping

| NFR     | How 3.2.10 relates                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-AN7 | "100% of error responses include `code`, `message`; state machine errors include `allowed_actions`" — 3.2.10 extends `allowed_actions` visibility to read responses, not just errors. |
| NFR-I3  | "API contract stability — OpenAPI spec from tests, additive changes only" — the action catalog becomes a machine-readable part of the contract surface, reinforcing stability.        |

### New FRs recommended (PRD update)

The global action catalog and state graph endpoint go beyond what FR95 covers. Recommended additions:

- **FR113:** System exposes a global action catalog via `GET /actions` listing all available operations with action ID, HTTP method, URL pattern, input schema, required headers, required permission scope, and expected error codes. Filterable by entity type and permission scope.
- **FR114:** All single-resource GET responses include `meta.actions[]` listing operations valid for the resource in its current state, with action ID, URL, required inputs, and constraints. State-bearing entities include only transitions legal from current state.
- **FR115:** System exposes state machine definitions via `GET /states/{entityType}` returning all states, transitions (from/to), preconditions, and triggering commands in a machine-readable format.
