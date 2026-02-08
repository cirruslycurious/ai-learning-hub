# ---
# id: "1.10"
# title: "Tool Risk Classification & Human Approval Gates"
# depends_on: ["1.5"]
# touches: [".claude/docs"]
# risk: low
# ---
#
# Story 1.10: Tool Risk Classification & Human Approval Gates
#
Status: ready-for-dev
#
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
#
## Story
#
As a **developer (human or AI agent)**,
I want **a clear, project-specific tool/operation risk classification with explicit human-approval triggers**,
so that **agents move fast on safe actions, pause on high-impact actions, and we avoid irreversible mistakes (FR82–FR85)**.
#
## Acceptance Criteria
#
1. **AC1: Tool risk taxonomy documented**
   - A new doc exists at `.claude/docs/tool-risk.md` defining **low / medium / high** risk operations in this repo, with rationale based on reversibility + blast radius.
#
2. **AC2: Concrete, repo-specific examples**
   - The doc includes examples for this codebase (Git ops, installs, infra/deploy, secrets/config, destructive file ops) and aligns terminology with existing guardrails.
#
3. **AC3: Human intervention triggers are explicit**
   - The doc enumerates actions that must require explicit approval (e.g., deploys, destructive deletes, force pushes) and includes failure/escalation thresholds (e.g., repeated test failures → stop and escalate).
#
4. **AC4: Cross-references to guardrails**
   - The doc references where enforcement lives (Cursor rules / hooks / templates) and how contributors should extend the classification when new tooling is added.
#
## Tasks / Subtasks
#
- [ ] **Task 1: Audit existing guardrails and workflows** (AC: 2, 4)
  - Inventory current safety rules and “ask vs block” behaviors:
    - `.cursor/rules/bash-guard.mdc` (blocked patterns + escalate list)
    - `.cursor/rules/file-guard.mdc` (protected paths + escalate directories)
    - `.cursor/rules/quality-gates.mdc` (required checks after edits / before done)
    - `.cursor/rules/pr-workflow.mdc` (branch/PR expectations for story work)
    - `.claude/docs/secrets-and-config.md` (what must never be committed)
    - `.claude/commands/project-check-secrets-config.md` (how to verify)
  - Summarize the “current posture” in the new doc and explicitly call out any mismatches/ambiguities as follow-up work (don’t silently change enforcement here).
#
- [ ] **Task 2: Write `.claude/docs/tool-risk.md`** (AC: 1–4)
  - Create a scannable doc with these required sections:
    - **Purpose & scope** (this repo; applies to agents + humans)
    - **Risk rubric** (reversibility, blast radius, secrets exposure, cost/prod impact)
    - **Risk levels** (low / medium / high) and **required behavior**:
      - low → proceed automatically
      - medium → proceed but announce risk; prefer safe alternatives
      - high → **must ask for explicit approval** before running
    - **Examples table** mapping common operations to risk + required behavior, at minimum:
      - Git read-only (`git status`, `git diff`, `git log`) → low
      - Git destructive / history rewrite (`push --force`, `reset --hard`, `clean -fd`) → high (block)
      - Deploys (`cdk deploy`, `terraform destroy`, `aws ... delete`) → high (ask)
      - Package publish (`npm publish`) → high (ask)
      - Recursive deletion (`rm -rf`) → high (ask) and catastrophic patterns → block
      - Secrets exposure patterns (reading/echoing `.env`, keys) → high (block)
      - Protected path edits (`CLAUDE.md`, `.env*`, lockfiles, `.gitignore`) → high (block or require explicit approval per file-guard)
      - Editing `infra/`, `.github/`, `.claude/hooks/` → high (explicit approval required)
      - Running quality gates (`npm test`, `npm run lint`, `npm run build`) → medium (safe but can be time-consuming)
    - **Human intervention triggers**:
      - approval-required operations list (mirrors bash-guard/file-guard)
      - “failure thresholds” (e.g., repeated failures, unclear requirements, security uncertainty → stop and escalate)
    - **How to extend** (when adding new tools/commands; how to classify)
    - **Pointers to enforcement** (Cursor rules + hooks + templates) with file references
#
- [ ] **Task 3: Consistency check** (AC: 2, 4)
  - Ensure the doc’s examples match current project rules (e.g., what is blocked vs. escalated) and propose follow-up issues for any mismatch (do not change guard scripts in this story unless required).
#
## Dev Notes
#
- This is primarily **documentation**. The implementation deliverable is `.claude/docs/tool-risk.md`.
- The doc should be practical and scannable for agents: tables, crisp do/don’t, and explicit escalation points.
- Ensure the doc does **not** encourage unsafe behaviors (e.g., “just force push”) and matches current safety posture.
#
### Suggested `.claude/docs/tool-risk.md` outline (developer-friendly)
#
- **Overview**
  - What “tool risk” means here (reversibility + blast radius + secrets exposure)
- **Risk levels**
  - low / medium / high, with “what you do” for each
- **Operations matrix**
  - Table: operation → examples → risk → required behavior → safer alternative
- **Approval checklist (high-risk)**
  - What info must be provided when asking approval (exact command, target env, rollback plan)
- **Escalation rules**
  - When to stop and ask a human (including failure thresholds)
- **Where it’s enforced**
  - Link to `.cursor/rules/bash-guard.mdc` and `.cursor/rules/file-guard.mdc`
  - Mention `.claude/commands/project-check-secrets-config.md` for pre-push verification
#
### References
#
- [Source: _bmad-output/planning-artifacts/epics.md] Epic 1 Story 1.10; FR82–FR85
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] Story key `1-10-tool-risk-classification`
- [Source: .cursor/rules/bash-guard.mdc] Command safety constraints (blocked vs escalate)
- [Source: .cursor/rules/file-guard.mdc] Protected paths and escalation directories
- [Source: .cursor/rules/quality-gates.mdc] Required checks before declaring done
- [Source: .cursor/rules/pr-workflow.mdc] Branch/PR workflow expectations
- [Source: .claude/docs/secrets-and-config.md] Secrets and real identifiers policy
- [Source: .claude/commands/project-check-secrets-config.md] How to verify repo is clean
#
## Developer Context (Dev Agent Guardrails)
#
### Technical Requirements
#
- Keep the risk model **simple**: low / medium / high.
- Tie risk levels to **required behavior** (auto / ask / block) and concrete examples.
- Ensure the doc mirrors the current repo guardrails:
  - **Blocked** examples from `.cursor/rules/bash-guard.mdc`: catastrophic `rm -rf /`, fork bombs, `mkfs`, destructive git (`reset --hard`, `clean -fd`, `push --force` to main/master), credential exposure (`cat .env`, private keys), exfiltration commands with secrets.
  - **Escalate/ask** examples: `cdk deploy`, `git push` to main/master, `npm publish`, destructive `rm -rf`, `terraform destroy`.
  - **Protected paths / escalation dirs** from `.cursor/rules/file-guard.mdc`: never auto-modify `CLAUDE.md`, `.env*`, lockfiles, `.gitignore`; ask before editing `infra/`, `.github/`, `.claude/hooks/`.
  - **Quality gates**: after edits run `npm run format` and `npm run type-check`; before “done” run `npm test`, `npm run lint`, `npm run build`.
  - **PR habit**: story work should use a branch + PR (unless truly trivial).
#
### File Structure Requirements
#
- Create: `.claude/docs/tool-risk.md`
#
### Testing Requirements
#
- Documentation-only story: no tests required.
#
---
#
## Previous Story Intelligence (1-9 Observability Foundation)
#
- Story 1.9 added/updated docs under `.claude/docs/` (notably `observability.md`) and reinforced “guardrails live in rules/hooks, docs explain how to comply.”
- Keep `tool-risk.md` consistent with the existing safety posture already encoded in:
  - `.cursor/rules/bash-guard.mdc`
  - `.cursor/rules/file-guard.mdc`
  - `.claude/docs/secrets-and-config.md`
#
## Git Intelligence Summary (recent commits)
#
- Recent work was mainly story documentation + infra observability wiring (Story 1.9), and sprint-status updates.
- This story should remain **doc-only** unless you uncover a critical mismatch where documentation must be updated to match current enforcement (or vice versa, but that would need explicit approval for protected areas).
#
## Project Context Reference
#
- Safety rules (enforced): `.cursor/rules/bash-guard.mdc`, `.cursor/rules/file-guard.mdc`, `.cursor/rules/quality-gates.mdc`
- Docs (explainers): `.claude/docs/README.md`, `.claude/docs/secrets-and-config.md`, `.claude/docs/testing-guide.md`, `.claude/docs/branch-commit-conventions.md`
- Commands: `.claude/commands/project-check-secrets-config.md` for scanning staged/edited changes before push
#
---
#
## Dev Agent Record
#
### Agent Model Used
#
### Debug Log References
#
### Completion Notes List
#
### File List
