---
id: "3.1.5"
title: "Phase Runner Infrastructure"
status: ready-for-dev
depends_on:
  - 3-1-4-dedup-scan-agent-pipeline
touches:
  - .claude/skills/epic-orchestrator/phase-registry.md (new)
  - .claude/skills/epic-orchestrator/SKILL.md
  - .claude/skills/epic-orchestrator/phase-runner.md (new)
risk: low
---

# Story 3.1.5: Phase Runner Infrastructure

Status: review

## Story

As the epic orchestrator,
I want explicit phase runner infrastructure so that Phase 2 steps (quality gates → dedup scan → review → commit) are defined in one place and can be executed consistently by the orchestrator or future automation,
so that the pipeline is auditable, resumable, and not only implied by prose in SKILL.md.

## Acceptance Criteria

| #   | Given                                    | When                                                                 | Then                                                                                                                                                  |
| --- | ---------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Phase registry document exists           | `.claude/skills/epic-orchestrator/phase-registry.md` exists          | Document lists Phase 2 steps in order (2.1–2.7) with: step id, name, one-line purpose, what runs (invoke/shell/subagent), skip conditions, gate criteria |
| AC2 | Phase runner protocol exists              | `.claude/skills/epic-orchestrator/phase-runner.md` exists            | Protocol describes how to execute the registry: read registry, run current phase, handle dry-run and resume, advance or escalate                      |
| AC3 | SKILL.md references phase infrastructure | Phase 2 section in SKILL.md                                          | Phase 2 intro points to phase-registry.md and phase-runner.md as the source of phase order and execution; prose steps remain but cite the registry      |
| AC4 | No duplicate step definitions             | After story is done                                                  | Phase order and step identities in SKILL.md match phase-registry.md; no conflicting numbering or steps                                                 |
| AC5 | Dry-run and resume covered                | phase-runner.md is read                                              | Dry-run behavior (skip subagents, log only) and resume behavior (state file, start from first non-done) are documented for each phase that supports it |

## Tasks / Subtasks

- [x] Task 1: Create phase registry (AC: #1, #4)
  - [x] 1.1 Create `.claude/skills/epic-orchestrator/phase-registry.md`
  - [x] 1.2 Define Phase 2 step list in order: 2.1 Pre-Implementation, 2.2 Implementation (quality gates, AC verification, secrets scan, commit gate, CDK synth), 2.3 Mark for Review, 2.3b Dedup Scan Loop, 2.4 Code Review Loop, 2.5 Commit & PR, 2.6 Finalize Story, 2.7 Integration Checkpoint
  - [x] 1.3 For each step: id, name, purpose (one line), what runs (e.g. "Invoke /bmad-bmm-dev-story", "Run npm run lint && npm run type-check && npm test", "Spawn epic-dedup-scanner per dedup-scan-loop.md", "Spawn epic-reviewer per review-loop.md"), skip conditions (e.g. dry-run skips 2.2 impl and subagent spawns), gate criteria (e.g. 0 MUST-FIX to exit dedup/review loops). **For 2.7 Integration Checkpoint:** skip condition = run only when `story.hasDependents === true`; skip when current story has no dependents.
  - [x] 1.4 Use same step ids and names as SKILL.md so they stay in sync

- [x] Task 2: Create phase runner protocol (AC: #2, #5)
  - [x] 2.1 Create `.claude/skills/epic-orchestrator/phase-runner.md`
  - [x] 2.2 Document: read phase-registry.md, resolve current story and state, determine current phase (from state file or start at 2.1)
  - [x] 2.3 Document execution loop: before running a phase, evaluate skip conditions from the registry (e.g. for 2.7, skip if `!story.hasDependents`); run current phase (invoke skill, run shell, spawn subagent per registry); evaluate gate criteria; advance to next phase or escalate. State that escalation semantics (when to pause and prompt user) are defined per phase in the protocol docs (e.g. review-loop.md, dedup-scan-loop.md); the phase runner advances only when the phase completes or the user resolves an escalation.
  - [x] 2.4 Document dry-run: skip 2.2, 2.3, 2.3b, and 2.4; proceed directly to 2.5 (handled by DryRunStoryRunner). Optionally log `[DRY-RUN] Would set story status to 'review' (2.3)` for audit.
  - [x] 2.5 Document resume: load state file; state file has no "current phase" field (story-level status only). For story status `review`, define a single convention (e.g. resume from 2.3 and re-run 2.3b and 2.4 so dedup and review are not skipped). Optionally note: a later story could add `current_phase` (or `last_completed_phase`) per story in the state file for precise phase resume. Cross-reference: state-file.md "resume from implementation phase" = phase 2.2 (Implementation). Idempotency of getOrCreateIssue/Branch/PR.

- [x] Task 3: Update SKILL.md to reference phase infrastructure (AC: #3)
  - [x] 3.1 In Phase 2 intro (before 2.1), add a short paragraph: phase order and execution semantics are defined in `phase-registry.md` and `phase-runner.md` in this directory; the sections below are the canonical prose for each step
  - [x] 3.2 Ensure step numbering in SKILL.md matches phase-registry.md (2.1 → 2.2 → 2.3 → 2.3b → 2.4 → 2.5 → 2.6 → 2.7)
  - [x] 3.3 No removal of existing step content — only add the reference and ensure consistency

- [x] Task 4: Update agent/skill docs if needed (AC: #4)
  - [x] 4.1 If `.claude/agents/README.md` or epic-orchestrator skill list references Phase 2 steps, add a note that phase order is defined in phase-registry.md

## Dev Notes

- **Intent:** The pipeline (Quality Gates → Dedup Scan → Review → Commit) is currently only described in SKILL.md. This story adds a single source of truth for *what* runs in what order (phase-registry.md) and *how* to run it (phase-runner.md), so the orchestrator (and any future script or MCP) can execute phases consistently. No change to safety invariants or to the behavior of existing steps.
- **Scope:** Documentation and one new protocol only. No new agents, no new hooks, no new scripts required — unless the team chooses to add an optional small runner script (e.g. `node .claude/skills/epic-orchestrator/run-phase.cjs 2.2`) in a follow-up; that is out of scope for this story.
- **Resume:** State file already exists (state-file.md) but stores only story-level status (no phase field). Phase runner protocol must document the resulting ambiguity for status `review` (cannot distinguish 2.3 vs 2.3b vs 2.4) and define a single convention (e.g. resume from 2.3 and re-run 2.3b and 2.4). See Task 2.5.
- **Relationship to 3.1.4:** Story 3.1.4 added the dedup scan loop (2.3b) and its protocol (dedup-scan-loop.md). **Prerequisite:** 3.1.4 must be done and SKILL.md must already include step 2.3b and reference dedup-scan-loop.md. If 2.3b is missing from SKILL.md at implementation time, add it (and the reference) as part of Task 3; otherwise only add the Phase 2 intro reference and verify numbering. This story does not change the dedup protocol; it only registers 2.3b in the phase registry and documents how the phase runner invokes it.
- **Registry granularity:** Registry describes phases at step level (2.1–2.7). Sub-steps within 2.2 (e.g. post-AC-verification, post-secrets-scan) are not enumerated; phase-level resume is story-level only unless extended later.
- **Drift prevention:** Consider a follow-up (out of scope): a small script or lint rule that parses phase-registry.md and SKILL.md Phase 2 headings and fails if step ids or order differ. This story relies on manual validation.

### Project Structure Notes

- All new/modified files live under `.claude/skills/epic-orchestrator/`. No backend/frontend/infra code.
- Align with existing skill docs: dependency-analysis.md, story-runner.md, state-file.md, review-loop.md, dedup-scan-loop.md use similar structure (purpose, steps, interfaces).

### References

- [Source: .claude/skills/epic-orchestrator/SKILL.md] Phase 2 steps 2.1–2.7
- [Source: .claude/skills/epic-orchestrator/dedup-scan-loop.md] Step 2.3b protocol
- [Source: .claude/skills/epic-orchestrator/review-loop.md] Step 2.4 protocol
- [Source: _bmad-output/implementation-artifacts/3-1-4-dedup-scan-agent-pipeline.md] Pipeline flow diagram and gate criteria

## Architecture Compliance

| ADR / NFR   | How This Story Must Comply                                                                 |
| ----------- | ------------------------------------------------------------------------------------------- |
| **Pipeline** | Phase registry and runner docs must match existing SKILL.md step order and semantics        |
| **Safety**   | No new agents or hooks; documentation only. No change to human checkpoints or merge rules   |
| **Resume**   | Phase runner protocol must align with state-file.md and existing --resume behavior          |

## Testing Requirements

- **No automated tests:** This story adds markdown documentation under `.claude/skills/epic-orchestrator/`. Validation is manual and structural:
  - `phase-registry.md` lists all Phase 2 steps in the same order as SKILL.md with consistent ids (2.1, 2.2, 2.3, 2.3b, 2.4, 2.5, 2.6, 2.7).
  - `phase-runner.md` describes execution loop, dry-run, and resume without contradicting story-runner.md or state-file.md.
  - Before marking the story complete, implementers must manually diff step ids and order between phase-registry.md and SKILL.md to ensure no conflicting numbering or steps (AC4).
- **Quality gates:** `npm run lint` and `npm run type-check` unchanged (no production code). Manual review of new/modified skill docs.

## File Structure Requirements

### New

- `.claude/skills/epic-orchestrator/phase-registry.md` — Phase 2 step list with id, name, purpose, what runs, skip conditions, gate criteria
- `.claude/skills/epic-orchestrator/phase-runner.md` — Protocol for executing phases (read registry, run phase, dry-run, resume)

### Modify

- `.claude/skills/epic-orchestrator/SKILL.md` — Add Phase 2 intro reference to phase-registry.md and phase-runner.md; verify step numbering

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — documentation-only story, no debugging needed.

### Completion Notes List

- Created `phase-registry.md` with Phase 2 step table (8 steps: 2.1–2.7) including step ID, name, purpose, what runs, skip conditions, and gate criteria. Step details section expands each step with cross-references to protocol docs.
- Created `phase-runner.md` with execution loop protocol, skip condition evaluation, gate criteria evaluation, escalation semantics, dry-run mode behavior, resume semantics (with convention for `review` status ambiguity), and idempotency guarantees.
- Updated `SKILL.md` Phase 2 intro to reference `phase-registry.md` and `phase-runner.md` with sync contract note.
- Updated `.claude/agents/README.md` Further Reading section with links to both new docs.
- Verified step numbering consistency: SKILL.md headings (2.1, 2.2, 2.3, 2.3b, 2.4, 2.5, 2.6, 2.7) match phase-registry.md table rows exactly.
- Quality gates: `npm run lint` (0 errors), `npm run type-check` (clean). No production code changed.

### File List

- `.claude/skills/epic-orchestrator/phase-registry.md` (new)
- `.claude/skills/epic-orchestrator/phase-runner.md` (new)
- `.claude/skills/epic-orchestrator/SKILL.md` (modified — added Phase 2 intro reference)
- `.claude/agents/README.md` (modified — added Further Reading entries)
