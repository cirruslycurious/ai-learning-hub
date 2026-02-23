# Adversarial Review: Story 3.1.4 — Deduplication Scan Agent & Pipeline Integration

**Date:** 2026-02-23  
**Artifact:** `_bmad-output/implementation-artifacts/3-1-4-dedup-scan-agent-pipeline.md`  
**Scope:** Story 3.1.4 acceptance criteria, tasks, protocol design, alignment with existing pipeline (review-loop, agents README, SKILL.md), and operational risks.

---

## Summary

The story is well-scoped and correctly positions the dedup scan as a preventive step before adversarial review. The review finds **one critical gap** (domain derivation when a story touches only shared packages or multiple domains), **several high-impact issues** (Critical severity claim vs static-only analysis, fixer push/commit safety, agent registry and prompt validator updates, findings path vs canonical review path), and **medium/low clarifications** (scanner Bash scope, escalation hard cap, round numbering) that could cause pipeline failures or inconsistent behavior if unaddressed.

---

## Critical

### C1: Domain derivation fails when story touches only shared packages or multiple handler domains

**Artifact (Dev Notes):** Domain is derived by (1) extracting handler directory paths from `touches` (e.g. `backend/functions/saves-update/handler.ts` → `backend/functions/saves-update`), (2) finding common prefix (e.g. `backend/functions/saves`), (3) building glob `backend/functions/saves*/handler.ts`, (4) also including `backend/shared/*/src/**/*.ts`.

**Gaps:**

1. **No handler paths in `touches`:** If a story only touches shared packages (e.g. 3.1.1 extract shared schemas: `backend/shared/validation/...`), step 1 yields no handler directories. Common prefix over an empty set is undefined. The artifact does not define behavior: skip dedup scan, or treat “domain” as only the shared packages touched.
2. **Multiple domains:** If a story touches both `backend/functions/saves-update/*` and `backend/functions/auth-login/*`, the “common prefix” of `saves-update` and `auth-login` is `backend/functions/`, giving glob `backend/functions/*/handler.ts` (all handlers). The scanner would then compare saves handlers with auth handlers, which may be out of scope and noisy.

**Impact:** Orchestrator could pass invalid or overly broad domain to the scanner, or skip 2.3b with no defined rule, causing inconsistent pipeline behavior.

**Recommendation:**

- In Task 3.3 and Dev Notes, add: **“If `touches` contains no paths under `backend/functions/`, skip the dedup scan loop for this story (proceed directly to 2.4).”**
- Define **“domain” as one logical group:** e.g. derive a single primary domain from `touches` (e.g. the most specific common prefix that matches at least one handler path). If multiple disjoint handler domains exist (e.g. both `saves*` and `auth*`), either (a) run the dedup loop once per domain with separate findings files, or (b) document “single primary domain only” and derive the primary domain by a stated rule (e.g. first handler path in `touches`, or domain with the most touched files). State the chosen rule in the protocol.

---

## High

### H1: “Critical” severity assumes semantic divergence is detectable without execution

**Artifact (Task 1.4):** **Critical** is defined as “Local copy of shared export with **semantic divergence** (e.g. `toPublicSave` that behaves differently from shared version).”

**Reality:** The scanner has only Read, Glob, Grep, Bash, Write. It cannot run tests or execute code. “Semantic divergence” (different runtime behavior) cannot be reliably detected by static analysis alone; it would require comparing ASTs or heuristics (same name, different implementation), which is best-effort.

**Impact:** Either the scanner will never emit Critical (if it only flags exact duplicates), or it will emit Critical based on heuristics (e.g. same export name, different body) with risk of false positives. The AC and gate (“0 Important+ before proceeding”) treat Critical as MUST-FIX; overclaiming Critical could block the pipeline incorrectly.

**Recommendation:** In Task 1.4 and AC6, either: (a) redefine **Critical** as “Local definition that **shadows** a shared export (same name, potentially different implementation) — fix by using shared export or documenting intentional divergence,” and clarify that “semantic divergence” is inferred only by name/shape, not by execution; or (b) drop Critical for “semantic divergence” and keep only “duplicate that should be shared” under Important, so the gate remains “0 Important+ findings” and Critical is reserved for future tooling that can run tests.

---

### H2: Fixer commit/push safety not stated; fixer could push or commit to wrong branch

**Artifact (Task 2.3):** Fixer must “Stage and commit fixes” and “Report which findings were addressed.”

**Existing pattern (review-loop.md):** The epic-fixer “commits locally but does NOT push”; push happens in Phase 2.5 (Commit & PR).

**Gap:** The artifact does not state that the dedup fixer must **not** push, or that commits must be on the **current story branch**. A fixer with Bash could run `git push` or `git checkout main; git commit`, causing safety violations.

**Recommendation:** In Task 2.3 and in `dedup-scan-loop.md` (Step C / fixer prompt), add explicit rules: “Commit only on the current branch. Do **not** run `git push`. Do not switch branches. Same branch locality as review-loop fixer.” Optionally add to epic-dedup-fixer.md frontmatter or body: “Never push; never change branch.”

---

### H3: New subagent types not registered; prompt-template validator not extended

**Current state:** `.claude/agents/README.md` documents `epic-reviewer` and `epic-fixer` and states that `subagent_type` matches the agent filename (without `.md`). The prompt-template validator (`.claude/hooks/prompt-template-validator.cjs`) references only `epic-reviewer` and `epic-fixer` and validates prompt blocks in `review-loop.md`.

**Gap:** The artifact adds `epic-dedup-scanner` and `epic-dedup-fixer` but does not require:

1. Updating `.claude/agents/README.md` to list the two new subagents (name, file, purpose, tools, spawned by).
2. Deciding whether `prompt-template-validator.cjs` should validate `dedup-scan-loop.md` (e.g. prompt blocks with `subagent_type: "epic-dedup-scanner"` and `"epic-dedup-fixer"`). If the project later adds such validation, the artifact gives no hook.

**Impact:** Implementers may add the agent files but forget the README, so the agent system doc is out of date. If the validator is later extended to dedup loop, prompt template changes might break without the artifact having specified the contract.

**Recommendation:**

- Add a **Task 5.3 (or 6):** “Update `.claude/agents/README.md`: add rows for `epic-dedup-scanner` and `epic-dedup-fixer` in the Current Subagents table (file, purpose, tools, spawned by).”
- In Dev Notes or Testing, add: “If the project adds prompt-template validation for `dedup-scan-loop.md`, ensure the prompt blocks under Step A and Step C include the required `subagent_type` and path placeholders; no change to the validator is required for this story unless the team chooses to extend it.”

---

### H4: Findings path convention vs canonical review path

**Artifact (Dev Notes):** “Dedup findings: `.claude/dedup-findings-{story.id}-round-{round}.md`; Review findings: `.claude/review-findings-{story.id}-round-{round}.md`.”

**Existing pipeline:** `review-loop.md` and `docs/how-auto-epic-works.md` use **`docs/progress/story-{id}-review-findings-round-{N}.md`** for reviewer output. Git and docs also reference `docs/progress/` for review findings.

**Impact:** If the orchestrator and reviewer are wired to `docs/progress/...`, then “Review findings” in the artifact is misleading for implementers and could cause confusion when comparing dedup vs review paths. Dedup path (`.claude/...`) is fine as a distinct location; the artifact should not imply that review findings live under `.claude/` unless the project has standardized on that.

**Recommendation:** In the “Findings output path convention” section, state: “Dedup findings: `.claude/dedup-findings-{story.id}-round-{round}.md`. Review findings: use the same path as in `review-loop.md` (currently `docs/progress/story-{story.id}-review-findings-round-{round}.md`). Do not assume review findings are under `.claude/` unless the orchestrator is updated to write them there.” This keeps dedup clearly separate and avoids contradicting the existing review path.

---

## Medium

### M1: Scanner “Bash” tool scope is unspecified

**Artifact (AC1, Task 1.2):** Scanner has tools Read, Glob, Grep, Bash, Write.

**Gap:** Bash could be used to run arbitrary commands (e.g. `npm run type-check`, custom scripts). The methodology says the scanner “reads” handler files and shared packages and “flags” duplicates; it does not say the scanner may run build/test. Unconstrained Bash could allow the scanner to modify state or run dangerous commands.

**Recommendation:** In Task 1.3 or the scanner agent body, add: “Bash is for read-only or analysis-only use (e.g. running grep, or npm run type-check to validate imports). Do not run commands that modify the repo, run tests that mutate state, or push.” Alternatively, restrict to a fixed set of allowed commands if the platform supports it.

---

### M2: Escalation “same as reviewer round 3” — hard cap for override not stated

**Artifact (AC7, Task 3.7):** When dedup scan has Important+ findings after 2 rounds, escalate to human with “same option set as reviewer round 3 escalation (fix manually / accept / override limit).”

**review-loop.md:** Reviewer escalation offers (a) manual fix, (b) accept and mark complete, (c) continue with 1 more round. It also states: **“Hard cap: 5 total review rounds.”**

**Gap:** The dedup loop has max 2 rounds. If the user chooses “override limit,” does the dedup loop get one more round (3 total) or is there a hard cap (e.g. 3 or 4 total)? The artifact says “same option set” but does not state a hard cap for dedup, so implementers might allow unbounded dedup rounds.

**Recommendation:** In Task 3.7 and dedup-scan-loop.md, add: “Same options (a)/(b)/(c) as review-loop. If (c) override: allow one additional dedup round (max 3 total). **Hard cap: 3 dedup rounds** — after that only (a) or (b).” This mirrors the reviewer’s 5-round cap in spirit.

---

### M3: Step numbering 2.3 vs 2.3b and Phase 2 overview

**Artifact (Task 4.4):** “Ensure step numbering is consistent (2.1 → 2.2 → 2.3 → 2.3b → 2.4 → 2.5 → 2.6 → 2.7).”

**Note:** SKILL.md currently lists 2.3 (Mark for Review), then 2.4 (Code Review Loop). Inserting 2.3b is clear. Any automation or docs that parse step numbers (e.g. “step 2.4”) should still resolve correctly. No change required unless the project has parsers that assume integer-only step IDs; then document that 2.3b is a string label, not 2.31.

**Recommendation:** No change; optionally add one line in Dev Notes: “Step 2.3b is a label; downstream logic should treat it as a single step between 2.3 and 2.4.”

---

## Low / Clarifications

### L1: Fixer “appropriate shared package” for helpers

**Artifact (Task 2.3):** For duplicate helpers, “move to appropriate shared package.” Schemas → validation; constants → db or events.

**Clarification:** “Appropriate” for helpers is not defined (e.g. `@ai-learning-hub/db` for DB helpers, or a new shared util package). Minor risk of fixer choosing different locations across runs.

**Recommendation:** In Task 2.3 or epic-dedup-fixer.md, add: “For duplicate helper functions: prefer existing shared packages by domain (e.g. DynamoDB helpers → `@ai-learning-hub/db`, event helpers → `@ai-learning-hub/events`, validation helpers → `@ai-learning-hub/validation`). If no clear home exists, document in the findings and leave for human decision rather than creating a new package in this step.”

---

### L2: Dry-run skips entire dedup loop — no way to test loop logic in dry-run

**Artifact (Task 3.8, 4.2):** In `--dry-run` mode, skip subagent spawning, log dry-run messages, proceed directly to 2.4.

**Implication:** In dry-run, the orchestrator never runs the dedup loop (no scanner, no fixer, no gate). So dry-run cannot be used to verify that the orchestrator correctly derives domain, spawns scanner/fixer, or parses findings.

**Recommendation:** Accept as intentional: dry-run trades fidelity for speed. Optionally add to Dev Notes: “Dry-run does not execute 2.3b; to validate dedup loop integration, run without --dry-run on a branch that has no MUST-FIX findings (e.g. after 3.1.1–3.1.3).”

---

### L3: Shared packages list — logging, middleware

**Artifact (Task 1.3):** Scanner reads “shared package exports (`@ai-learning-hub/validation`, `db`, `events`, `types`).”

**Reality:** Project also has `@ai-learning-hub/logging` and `@ai-learning-hub/middleware`. Handlers might duplicate logger setup or middleware patterns.

**Recommendation:** In Task 1.3, add “`@ai-learning-hub/logging`, `@ai-learning-hub/middleware`” to the list of shared packages to check, so the scanner considers them when flagging “code that exists in shared packages but is defined locally.”

---

## Compliance Check (Artifact vs Pipeline)

| Item                                                   | Status                                      |
| ------------------------------------------------------ | ------------------------------------------- |
| NFR-M1 (DRY) — automated enforcement                   | ✅                                          |
| Reviewer and review-loop unchanged (AC8)               | ✅ (Task 5)                                 |
| New step between 2.2 and 2.4, gate 0 MUST-FIX          | ✅                                          |
| Findings format Critical/Important/Minor like reviewer | ✅                                          |
| Domain derivation from `touches`                       | ⚠️ No handler path / multi-domain rule (C1) |
| Fixer no-push / same-branch rule                       | ❌ Not stated (H2)                          |
| Agents README and validator                            | ⚠️ Not in scope (H3)                        |
| Review findings path vs docs/progress                  | ⚠️ Inconsistent (H4)                        |
| Critical = semantic divergence                         | ⚠️ Not detectable statically (H1)           |

---

## Recommended Story Edits (Concise)

1. **Domain derivation (C1):** Define behavior when `touches` has no handler paths (skip dedup scan). Define rule for multiple handler domains (single primary domain, or one run per domain with separate findings paths).
2. **Critical severity (H1):** Redefine Critical as “shadow of shared export (same name, possible divergence)” and clarify that detection is name/shape-based, not execution-based; or drop Critical for semantic divergence and keep gate on Important+ only.
3. **Fixer safety (H2):** In Task 2.3 and dedup-scan-loop.md, require: commit only on current branch; do not push; do not switch branches.
4. **Agent registry (H3):** Add task to update `.claude/agents/README.md` with epic-dedup-scanner and epic-dedup-fixer. Note optional future prompt-template validation for dedup-scan-loop.md.
5. **Findings path (H4):** In “Findings output path convention,” state that review findings path is as in review-loop.md (e.g. `docs/progress/story-{id}-review-findings-round-{N}.md`), not necessarily `.claude/`.
6. **Scanner Bash (M1):** Restrict Bash to read-only/analysis use; do not modify repo or push.
7. **Escalation cap (M2):** State hard cap for dedup override (e.g. 3 total rounds), same spirit as review-loop’s 5-round cap.
8. **Shared packages (L3):** Include `@ai-learning-hub/logging` and `@ai-learning-hub/middleware` in scanner’s shared-package list.

---

## Conclusion

Story 3.1.4 correctly adds a preventive dedup step before adversarial review and keeps the reviewer unchanged. The main risks are **domain derivation edge cases** (no handlers or multiple domains), **overclaiming Critical** without runtime semantics, **fixer commit/push safety** not stated, and **agent docs/path consistency**. Applying the recommended edits will make the pipeline robust and aligned with existing review-loop and agent conventions.
