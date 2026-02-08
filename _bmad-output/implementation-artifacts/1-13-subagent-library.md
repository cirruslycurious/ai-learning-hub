---
id: "1.13"
title: "Specialist Subagent Library (Agent System Documentation)"
depends_on: ["1.4", "1.5", "1.7"]
touches: [".claude/agents", ".claude/docs", ".claude/commands"]
risk: low
---

# Story 1.13: Specialist Subagent Library (Agent System Documentation)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer (human or AI agent)**,  
I want **a clear, discoverable “agent system” with documented subagents and usage patterns**,  
so that **we consistently use the right specialist at the right time (review, fix, testing, architecture) without reinventing prompts or misusing tools (FR90)**.

## Acceptance Criteria

1. **AC1: `.claude/agents/README.md` exists and is the primary entrypoint**
   - GIVEN the repo has multiple “agent-like” entrypoints (BMAD agents in `.claude/commands/`, orchestrator subagents in `.claude/agents/`)
     WHEN a developer wants to “use a specialist”
     THEN `.claude/agents/README.md` clearly explains:
     - What a **subagent** is (fresh conversational context; shared repo state)
     - The difference between **subagents** vs **commands/workflows** (e.g., `.claude/commands/*`)
     - How to **choose**: spawn a subagent vs run a workflow/command vs work inline
     - How to **add** a new subagent (naming, frontmatter fields, tool restrictions, output format)
     - Where enforcement lives (hooks/rules) that subagents must respect

2. **AC2: Inventory of the current system is explicit (no guessing)**
   - GIVEN the repository already includes orchestrator subagents
     WHEN a reader opens `.claude/agents/README.md`
     THEN it lists, at minimum:
     - `epic-reviewer` — fresh-context adversarial code review (read-only + findings output)
     - `epic-fixer` — guided fixes based on findings (full edit tools)
     AND it links to relevant orchestration docs explaining how/when these are spawned.

3. **AC3: Clear mapping from “roles” to existing assets**
   - GIVEN the PRD and epics mention roles like “code-reviewer”, “test-expert”, “debugger”, “architect”, “production-validator”
     WHEN a developer searches for those roles
     THEN the docs provide an explicit mapping table:
     - what we already have (subagent, BMAD agent command, workflow)
     - what to use instead of creating duplicates
     - when to create a *new* subagent prompt (and when not to)

4. **AC4: Subagent configuration conventions are documented and consistent**
   - GIVEN `.claude/agents/*.md` use YAML frontmatter to configure behavior
     WHEN a new subagent is added
     THEN the README documents the required frontmatter fields and conventions:
     - `name`, `description`
     - `tools` + `disallowedTools` (and which roles should be read-only vs full-edit)
     - `model` selection guidance (if/when specified)
     - required output structure (so orchestrators can parse it)
     AND existing subagents remain consistent with the documented conventions.

5. **AC5: Practical examples are included**
   - GIVEN people learn by copying patterns
     WHEN reading `.claude/agents/README.md`
     THEN it includes copy/paste examples for:
     - Spawning a **fresh-context reviewer** to review a branch and write a findings doc
     - Spawning a **fixer** to address a findings doc
     - Using BMAD agent commands as “specialists” (without needing new subagent prompts)
     - (If applicable) Using Claude Code’s `/agents` command for creating/using custom agents

## Tasks / Subtasks

- [ ] **Task 1: Write `.claude/agents/README.md` (the entrypoint)** (AC: 1–5)
  - Include: definitions, decision tree (“spawn subagent vs run workflow”), inventory, role-to-asset mapping table, examples, and contribution guidelines.

- [ ] **Task 2: Add an “agent system overview” doc under `.claude/docs/`** (AC: 2–4)
  - Create `.claude/docs/agent-system.md` that:
    - Explains how the epic orchestrator uses subagents (review loop, fresh context)
    - Links out to `orchestrator-safety.md`, `safety-architecture.md`, and the relevant skill docs
    - Documents the invariants that matter for subagents (never bypass hooks, never force push, etc.)
  - Keep it scannable and aligned with the progressive disclosure strategy (no mega-doc).

- [ ] **Task 3: Ensure discoverability (optional but recommended)** (AC: 1–3)
  - Add a small section to `.claude/docs/README.md` pointing to:
    - `.claude/agents/README.md`
    - `.claude/docs/agent-system.md`
  - Do not duplicate content; only add the pointer.

## Dev Notes

- **Evolving scope is intentional**: Story 1.13 is tracked as “subagent library” but the repo already has a sophisticated agent ecosystem (BMAD commands + epic orchestrator + existing subagents). The highest value is **documenting what exists** and how to extend it safely, not creating redundant new prompts.
- **Avoid duplication**: Prefer referencing existing BMAD agent entrypoints in `.claude/commands/` rather than creating new `.claude/agents/*` prompts that do the same job.
- **Fresh-context semantics**: “Fresh context” means fresh conversational history, not a separate checkout/runtime. Subagents should assume they share repo state and git history but not prior chat.

### Project Structure Notes

- `.claude/agents/` is for **subagent prompts** used by the orchestrator or manual spawning for isolated review/fix tasks.
- `.claude/commands/` is for **workflow entrypoints** and BMAD “agent” commands (loaded via command docs).
- `.claude/docs/` is for **progressive disclosure** reference docs. Prefer linking over copying.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] Epic 1 Story 1.13 description
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] Story key `1-13-subagent-library`
- [Source: _bmad-output/planning-artifacts/prd.md] FR90 (specialist subagent prompt library requirement)
- [Source: docs/research/epic-1-remaining-stories-analysis.md] Recommended evolution of Story 1.13 into agent-system documentation
- [Source: .claude/docs/orchestrator-safety.md] Orchestrator invariants + subagent usage
- [Source: .claude/docs/safety-architecture.md] Three-layer defense model referencing subagents
- [Source: .claude/agents/epic-reviewer.md] Existing reviewer prompt conventions
- [Source: .claude/agents/epic-fixer.md] Existing fixer prompt conventions

## Developer Context (Dev Agent Guardrails)

### Technical Requirements

- Keep docs **short, scannable, and actionable** (progressive disclosure).
- All examples must align with current enforcement posture (hooks + Cursor rules):
  - no force push, no bypassing hooks, no committing secrets, protected paths require approval.
- Do not introduce symlinks for “agent aliases” unless you’ve validated they behave well across environments and tooling.

### Testing Requirements

- Documentation-only story: **no tests required**.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

