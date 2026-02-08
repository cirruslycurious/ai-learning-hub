# Story 1.10 Analysis: Tool Risk Classification & Human Approval Gates

**Date:** 2026-02-07
**Status:** Analysis Complete
**Recommendation:** REFACTOR STORY - Current version is unaware of existing comprehensive safety infrastructure

## Executive Summary

Story 1.10 proposes creating a tool risk classification document (`.claude/docs/tool-risk.md`), but **we already have a comprehensive, multi-layered safety system** that is far more sophisticated than what Story 1.10 describes. The story appears to be written without knowledge of:

1. **Epic orchestrator** with 9 safety invariants and 4-phase human checkpoints
2. **Multi-agent code review loops** (up to 3 rounds with fresh-context reviewers)
3. **Integration checkpoints** (file overlap, type change, test validation)
4. **6 active hooks** (bash-guard, file-guard, tdd-guard, architecture-guard, import-guard, auto-format)
5. **11 cursor rules** mirroring hook behavior for IDE consistency
6. **Secrets scan gates** built into the orchestrator
7. **Comprehensive error recovery** with human decision points

**Risk:** If implemented as-written, Story 1.10 would create a **regressive** documentation artifact that:

- Documents a simpler mental model than what actually exists
- Misses the sophisticated orchestration patterns we've built
- Could confuse future developers about the actual safety mechanisms
- Ignores the hook-based enforcement that agents already navigate

## What We Already Have

### 1. Epic Orchestrator Safety Invariants (9 Rules)

**Location:** `.claude/skills/epic-orchestrator/SKILL.md`

These are **enforced automatically** during `/bmad-bmm-auto-epic`:

1. ✅ **Never auto-merge PRs** — All PRs remain open for human review
2. ✅ **Never bypass hooks** — All commits go through pre-commit hooks
3. ✅ **Never force push** — All pushes use standard `git push`
4. ✅ **Never push to base branch** — All story work on feature branches
5. ✅ **Never skip tests** — All stories must pass tests before marking complete
6. ✅ **Never silently ignore failures** — Failures trigger auto-fix (max 2 attempts), then human decision
7. ✅ **Idempotent operations** — All GitHub operations reuse existing resources
8. ✅ **State persistence** — Progress saved continuously with atomic writes
9. ✅ **Human checkpoints** — Scope confirmation (Phase 1), per-story approval (Phase 2), integration checkpoints (Phase 2), completion review (Phase 3)

### 2. Multi-Layer Hook System (6 Active Hooks)

**Location:** `.claude/hooks/`

| Hook                    | Type        | Purpose                                           | Enforcement Level |
| ----------------------- | ----------- | ------------------------------------------------- | ----------------- |
| `bash-guard.js`         | PreToolUse  | Blocks catastrophic commands, escalates high-risk | **BLOCKING**      |
| `file-guard.js`         | PreToolUse  | Never auto-modify CLAUDE.md, .env, lockfiles      | **BLOCKING**      |
| `tdd-guard.js`          | PreToolUse  | Blocks implementation before tests                | **BLOCKING**      |
| `architecture-guard.sh` | PreToolUse  | Blocks ADR violations                             | **BLOCKING**      |
| `import-guard.sh`       | PreToolUse  | Enforces `@ai-learning-hub/*` shared libs         | **BLOCKING**      |
| `auto-format.sh`        | PostToolUse | Auto-formats code after edits                     | **AUTO-CORRECT**  |
| `type-check.sh`         | PostToolUse | Validates TypeScript after edits                  | **VALIDATION**    |
| Stop hook (agent)       | Stop        | Blocks completion if tests fail                   | **BLOCKING**      |

### 3. Cursor Rules (11 Rules - IDE Enforcement)

**Location:** `.cursor/rules/*.mdc`

Mirror hooks for Cursor IDE:

- `bash-guard.mdc` — Pre-suggest command validation
- `file-guard.mdc` — Protected path awareness
- `quality-gates.mdc` — Post-edit and pre-done quality checks
- `tdd-guard.mdc` — TDD workflow enforcement
- `architecture-guard.mdc` — ADR compliance
- `import-guard.mdc` — Shared library usage
- `pr-workflow.mdc` — Branch and PR workflow
- Plus domain-specific rules (react.mdc, lambda.mdc, testing.mdc, general.mdc)

### 4. Multi-Agent Code Review Loop

**Location:** `.claude/skills/epic-orchestrator/review-loop.md`

**Automatic adversarial review** built into `/bmad-bmm-auto-epic`:

- Up to **3 review rounds** (2 fix attempts + 1 final review)
- Fresh-context reviewers (no implementation bias)
- Structured findings: Critical / Important / Minor
- Auto-fix with `epic-fixer` subagent
- Human escalation at round 3 if unclean
- Hard cap: 5 total rounds to prevent unbounded loops

**Categories:**

- **MUST-FIX (Critical):** Security vulnerabilities, crashes, data loss, ADR violations, hook violations, missing critical tests
- **MUST-FIX (Important):** Performance issues, incomplete implementation, architectural concerns, significant test gaps
- **NICE-TO-HAVE (Minor):** Code style, naming conventions, documentation, minor refactoring

### 5. Integration Checkpoints

**Location:** `.claude/skills/epic-orchestrator/integration-checkpoint.md`

**Automatic dependency validation** after completing stories with dependents:

1. **Shared file changes** — Git diff actual changes vs dependent stories' `touches` field
2. **Interface/Type changes** — TypeScript export diff analysis for breaking changes
3. **Acceptance criteria** — Re-run full test suite to ensure no regressions

**Result classification:**

- **Green (all clear):** Continue automatically (still show results)
- **Yellow (warnings):** Show warnings, ask user to confirm
- **Red (failures):** Escalate to user, do NOT continue

### 6. Secrets and Config Gates

**Location:** `.claude/docs/secrets-and-config.md`, orchestrator Phase 2.2

**Built-in secrets scanning** before marking for review:

- AWS account IDs (12-digit patterns)
- AWS access keys (AKIA pattern)
- AWS resource IDs (vpc-_, subnet-_, sg-\*, etc.)
- Private key material (-----BEGIN \* PRIVATE KEY-----)
- Third-party API keys (sk*live*_, pk*live*_)
- Connection strings (mongodb://, postgres://, redis://)
- ARNs with embedded account IDs

**Plus pre-stage validation** before commit:

```bash
git status --porcelain | grep -E '\.(env|pem|key|crt|p12|pfx)$'
```

### 7. Quality Gates (Built-in)

**Location:** Orchestrator Phase 2.2, `.cursor/rules/quality-gates.mdc`

**Automatic quality checks** after implementation:

```bash
npm run lint      # Verify format/style
npm run build     # Verify TypeScript compiles
npm test -- --coverage   # Verify all tests pass + capture coverage
```

**Enforcement:** Story cannot proceed to review if any gate fails.

### 8. Human Approval Checkpoints (4 Phases)

**Built into `/bmad-bmm-auto-epic` orchestrator:**

1. **Phase 1.4 — Scope Confirmation**
   Display epic, stories, execution order, integration checkpoints
   Ask: (a) all stories, (b) select specific, (c) cancel

2. **Phase 2.6 — Per-Story Completion**
   Show: PR#, tests, coverage, review rounds, findings fixed, progress (N/M)
   Ask: Continue / n / pause / skip

3. **Phase 2.7 — Integration Checkpoint** (for stories with dependents)
   Show: Validation results (file overlaps, type changes, test status)
   Ask: y / n / pause / review-X.Y

4. **Phase 3 — Completion & Reporting**
   Generate epic completion report, update state, notify user

### 9. Error Recovery with Human Decision Points

**Built into orchestrator:**

- **Test failures:** Auto-fix (max 2 attempts) → escalate
- **Hook violations:** Self-correcting (agent reads hook error) → escalate after >3 violations
- **Merge conflicts:** Auto-resolve simple cases → escalate complex
- **PR creation failures:** Show manual fallback → mark blocked → ask continue/pause
- **Dependency not met:** Show actionable error → ask skip/pause/override

### 10. Dry-Run Mode

**Flag:** `--dry-run`

- Uses `DryRunStoryRunner` (no API calls, deterministic mock data)
- Skips subagent spawning (no actual review/fix)
- State file IS created (for testing state management)
- Logs all operations without executing

## What Story 1.10 Proposes

According to `_bmad-output/implementation-artifacts/1-10-tool-risk-classification.md`:

### Proposed Deliverable

Create `.claude/docs/tool-risk.md` with:

- **Risk rubric:** Reversibility, blast radius, secrets exposure, cost/prod impact
- **Risk levels:** low / medium / high
- **Operations matrix:** operation → examples → risk → required behavior → safer alternative
- **Approval checklist:** What info must be provided when asking approval
- **Escalation rules:** When to stop and ask a human
- **Where it's enforced:** Link to cursor rules and hooks

### Examples Table (from Story 1.10)

| Operation                             | Risk | Required Behavior          |
| ------------------------------------- | ---- | -------------------------- |
| Git read-only (status, diff, log)     | low  | proceed automatically      |
| Git destructive (push --force, reset) | high | block                      |
| Deploys (cdk deploy, terraform)       | high | ask                        |
| Package publish (npm publish)         | high | ask                        |
| Recursive deletion (rm -rf)           | high | ask (catastrophic → block) |
| Secrets exposure (reading .env)       | high | block                      |
| Protected path edits (CLAUDE.md)      | high | block or require approval  |
| Editing infra/, .github/, hooks/      | high | explicit approval required |
| Quality gates (test, lint, build)     | med  | safe but time-consuming    |

## Gap Analysis

### What Story 1.10 Gets Right

1. ✅ **Correct risk classification** — low/medium/high with reversibility + blast radius
2. ✅ **Correct examples** — Git ops, deploys, secrets, protected paths
3. ✅ **Cross-references existing guardrails** — bash-guard, file-guard, quality-gates
4. ✅ **Acknowledges hooks as enforcement** — Points to `.cursor/rules/` and `.claude/hooks/`

### What Story 1.10 Misses

1. ❌ **Epic orchestrator safety invariants** — 9 rules that are enforced automatically during auto-epic
2. ❌ **Multi-agent code review loops** — Up to 3 rounds with fresh-context reviewers + structured findings
3. ❌ **Integration checkpoints** — File overlap, type change, test validation for dependent stories
4. ❌ **Secrets scan gates** — Built into orchestrator Phase 2.2 (before marking for review)
5. ❌ **Human approval checkpoints** — 4 phases with user prompts (scope, per-story, integration, completion)
6. ❌ **Error recovery patterns** — Auto-fix with escalation thresholds (max 2 attempts, then human)
7. ❌ **State persistence & resume** — Idempotent operations, atomic writes, --resume reconciliation
8. ❌ **Dry-run mode** — DryRunStoryRunner for testing workflows without side effects

### What Story 1.10 Could Break

1. **Mental model mismatch**
   Doc describes a simpler ask/block model, but reality is multi-layered orchestration with auto-fix + review loops + checkpoints

2. **Hook navigation confusion**
   Agents already navigate hooks successfully (self-correcting). Doc doesn't explain how hooks teach correct patterns.

3. **Orchestrator ignorance**
   Future developers might think "just ask user" when hooks + orchestrator already handle most cases automatically.

4. **Review loop omission**
   Doc doesn't explain that code quality is enforced via adversarial review, not just "run tests and hope."

5. **Integration checkpoint omission**
   Doc doesn't explain how dependent stories are validated before starting.

## Recommendations

### Option 1: REFACTOR Story 1.10 (RECOMMENDED)

**New Title:** "Comprehensive Safety Documentation: Orchestrator, Hooks, and Risk Patterns"

**New Acceptance Criteria:**

1. **AC1: Safety architecture overview** (NEW)
   Document the **3-layer safety model**:
   - Layer 1: **Hooks** (PreToolUse/PostToolUse/Stop) — Blocking enforcement at tool-call level
   - Layer 2: **Orchestrator safety invariants** (9 rules) — Workflow-level guarantees
   - Layer 3: **Human checkpoints** (4 phases) — Strategic approval gates

2. **AC2: Hook system documentation** (ENHANCED from original AC2)
   Document all 6 active hooks + 11 cursor rules:
   - Hook purpose, enforcement level (blocking/auto-correct/validation)
   - How agents navigate hooks (self-correcting via error messages)
   - When hooks escalate to human (>3 violations)
   - Cross-reference cursor rules for IDE consistency

3. **AC3: Orchestrator safety invariants** (NEW)
   Document the 9 safety invariants from `/bmad-bmm-auto-epic`:
   - Never auto-merge PRs
   - Never bypass hooks
   - Never force push
   - Never push to base branch
   - Never skip tests
   - Never silently ignore failures
   - Idempotent operations
   - State persistence
   - Human checkpoints (4 phases)

4. **AC4: Multi-agent review loop** (NEW)
   Document the adversarial review process:
   - Up to 3 review rounds (2 fix attempts + 1 final review)
   - Fresh-context reviewers (no implementation bias)
   - Structured findings (Critical/Important/Minor)
   - Auto-fix with `epic-fixer` subagent
   - Human escalation at round 3
   - Hard cap: 5 total rounds

5. **AC5: Integration checkpoints** (NEW)
   Document dependency validation:
   - When checkpoints run (stories with dependents)
   - What's validated (file overlaps, type changes, test regressions)
   - Result classification (Green/Yellow/Red)
   - User options (continue/pause/review-X.Y)

6. **AC6: Secrets and config gates** (NEW)
   Document built-in secrets scanning:
   - Secrets scan gate (before marking for review)
   - Pre-stage validation (before commit)
   - What patterns are detected
   - Where enforcement lives (orchestrator Phase 2.2)

7. **AC7: Error recovery patterns** (ENHANCED from original AC3)
   Document auto-fix and escalation:
   - Test failures (auto-fix max 2 attempts → escalate)
   - Hook violations (self-correcting → escalate after >3)
   - Merge conflicts (auto-resolve simple → escalate complex)
   - PR creation failures (show manual fallback → mark blocked)
   - Dependency not met (show options → ask user)

8. **AC8: Tool risk matrix** (ORIGINAL AC1, AC2)
   Keep the original operations matrix, but **contextualize** it:
   - Show how hooks enforce each risk level
   - Show how orchestrator adds workflow-level safety
   - Show which operations trigger human checkpoints

9. **AC9: Cross-references and pointers** (ENHANCED from original AC4)
   Update all cross-references:
   - Hooks: `.claude/hooks/README.md`
   - Cursor rules: `.cursor/rules/`
   - Orchestrator: `.claude/skills/epic-orchestrator/SKILL.md`
   - Review loop: `.claude/skills/epic-orchestrator/review-loop.md`
   - Integration checkpoint: `.claude/skills/epic-orchestrator/integration-checkpoint.md`
   - Secrets: `.claude/docs/secrets-and-config.md`

**New File Deliverables:**

1. `.claude/docs/safety-architecture.md` — High-level overview of 3-layer model
2. `.claude/docs/tool-risk.md` — Original operations matrix (contextualized)
3. `.claude/docs/orchestrator-safety.md` — Detailed orchestrator invariants + checkpoints
4. `.claude/docs/hook-system.md` — Detailed hook descriptions + navigation patterns

**Why this is better:**

- Documents what we **actually have** (not a simplified version)
- Explains **how safety layers interact** (hooks → orchestrator → human)
- Preserves **institutional knowledge** about review loops, checkpoints, error recovery
- Provides **correct mental model** for future developers and agents
- **Additive, not regressive** — Builds on existing sophistication

### Option 2: MARK Story 1.10 as DONE (NOT RECOMMENDED)

**Rationale:** We already have comprehensive safety infrastructure that exceeds Story 1.10's goals. The tool risk classification it proposes is **already enforced** via:

- `bash-guard.js` / `bash-guard.mdc` (operation-level risk)
- `file-guard.js` / `file-guard.mdc` (path-level risk)
- Epic orchestrator safety invariants (workflow-level risk)
- Human checkpoints (strategic approval gates)

**Why this is risky:**

- Story 1.10 was in the original PRD (FR82–FR85: "Tool/operation risk classification")
- Marking it done without deliverable might look like we skipped requirements
- Future auditors might ask "where is the risk classification doc?"

### Option 3: DOWNGRADE Story 1.10 to "Safety Crosswalk" (ALTERNATIVE)

**New Title:** "Safety Infrastructure Crosswalk Document"

**Simplified Acceptance Criteria:**

1. Create `.claude/docs/safety-crosswalk.md` — Single-page reference that:
   - Lists all 6 hooks with one-line descriptions + file links
   - Lists all 11 cursor rules with one-line descriptions + file links
   - Lists 9 orchestrator safety invariants + link to SKILL.md
   - Lists 4 human checkpoint phases + link to orchestrator
   - Includes "Where to find X" table:
     - "How do I understand bash command risk?" → `bash-guard.js` + `bash-guard.mdc`
     - "How do I understand file modification risk?" → `file-guard.js` + `file-guard.mdc`
     - "How do I understand workflow safety?" → `epic-orchestrator/SKILL.md`
     - "How do I understand review process?" → `epic-orchestrator/review-loop.md`
     - "How do I understand dependency validation?" → `epic-orchestrator/integration-checkpoint.md`

**Why this is pragmatic:**

- Delivers a "tool risk classification" document (satisfies FR82–FR85)
- But acknowledges that **implementation is distributed** (hooks, orchestrator, rules)
- Single-page, scannable reference for "where is safety enforced?"
- Doesn't duplicate existing docs (just pointers)
- Fast to implement (1 file, mostly links)

## Recommendation

**CHOOSE OPTION 1** (Refactor Story 1.10)

**Reasoning:**

1. **Preserves institutional knowledge** — Documents the sophisticated system we've built
2. **Additive, not regressive** — Doesn't simplify or misrepresent our safety infrastructure
3. **Comprehensive** — Covers hooks, orchestrator, review loops, checkpoints, error recovery
4. **Accurate** — Reflects what agents actually navigate (not a simplified mental model)
5. **Future-proof** — New developers and agents get the correct picture
6. **Satisfies PRD** — Delivers FR82–FR85 (tool risk classification) but at the right level of detail

**Implementation Notes:**

- Story 1.10 should be **paused** (not started as-is)
- Create a new story file: `1-10-safety-architecture-documentation.md` (or update existing)
- Update sprint status to reflect new scope
- Implement with `/bmad-bmm-dev-story` when ready

## PRD Alignment Check

**Original PRD Requirements (FR82–FR85):**

- FR82: Tool risk classification (low/medium/high)
- FR83: Human approval triggers for high-risk operations
- FR84: Explicit escalation points
- FR85: Documentation of where enforcement lives

**Does Option 1 satisfy these?**

- ✅ FR82: Tool risk classification → `.claude/docs/tool-risk.md` (operations matrix)
- ✅ FR83: Human approval triggers → `.claude/docs/orchestrator-safety.md` (9 invariants + 4 checkpoints)
- ✅ FR84: Explicit escalation points → `.claude/docs/orchestrator-safety.md` (error recovery patterns)
- ✅ FR85: Documentation of enforcement → `.claude/docs/safety-architecture.md` (3-layer model) + cross-references

**Conclusion:** Option 1 satisfies all PRD requirements **and** accurately documents what we've built.

## Next Steps

1. **Decision:** Choose Option 1, 2, or 3
2. **If Option 1:**
   - Update Story 1.10 file with new acceptance criteria
   - Create new task breakdown
   - Update sprint status
   - Run `/bmad-bmm-dev-story` when ready
3. **If Option 2:**
   - Mark Story 1.10 as done in sprint status
   - Add comment: "Safety infrastructure already exists (hooks + orchestrator)"
   - Create follow-up story for crosswalk doc (optional)
4. **If Option 3:**
   - Update Story 1.10 to "Safety Crosswalk" scope
   - Create `.claude/docs/safety-crosswalk.md` (single-page reference)
   - Mark done

---

**Analysis Date:** 2026-02-07
**Analyzed By:** Claude Sonnet 4.5
**Recommendation:** OPTION 1 — Refactor Story 1.10 to document comprehensive safety architecture
