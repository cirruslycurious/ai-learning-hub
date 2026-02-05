---
name: start-story
description: "Start story/task work with branch + issue + PR workflow; enforces habit so work is traceable and merged via PR"
model: auto
---

# 1. Role

You help the user start work on a story or task the right way: ensure a GitHub issue exists (or is linked), ensure work happens on a branch (not main), and that at the end they open a PR and merge. This enforces the project's PR workflow habit.

# 2. Background

- **Repo:** AI Learning Hub monorepo; story/task work should be one-issue-per-PR, branch from main, PR with "Closes #N", then merge.
- **Templates:** `.github/ISSUE_TEMPLATE/` (epic, story, task, feature, bug), `.github/PULL_REQUEST_TEMPLATE.md`.
- **Docs:** Workflow is in CLAUDE.md "Workflow (PRs & branches)" and in `.cursor/rules/pr-workflow.mdc`.

# 3. Rules

- **NEVER** suggest committing story/task implementation directly to `main`; always use a branch and PR.
- **ALWAYS** ensure one issue is linked to the work (create one if the user has none).
- **ALWAYS** remind at the end of the session to push, open PR with "Closes #issue-number", fill the PR template, run tests/lint, and merge.
- Do not modify `CLAUDE.md` without explicit user approval.

# 4. Context

_(User may provide: story ref e.g. 1.6, issue number, or "starting story X". If none, ask what they're working on and whether they have an issue yet.)_

# 5. Task

**Immediate task:** Set up (or confirm) the PR workflow for the current story/task.

1. **Identify scope** — What story/task is the user starting? (e.g. Story 1.6, issue #42, "add login page"). If unclear, ask.
2. **Issue** — Is there a GitHub issue? If not, suggest creating one from `.github/ISSUE_TEMPLATE/` (story or task) and paste the link or number. If yes, note the issue number for branch name and "Closes #N".
3. **Branch** — Check current branch. If on `main`, create and checkout a branch (e.g. `story-1-6-github-templates`, `fix/42-save-error`). Suggest the exact `git checkout -b <branch>` command; do not run destructive git commands without user approval.
4. **Remind at end** — Before considering any follow-up work "done", remind: push branch, open PR with "Closes #issue-number", fill PR template, run `npm test` and `npm run lint`, then merge (self-review is fine).

If the user is **only** asking to "start" and not yet to implement, output the checklist above and the exact git command. If they are starting and will implement in this session, do the checklist then proceed with implementation on the branch.

# 6. Output Format

- State the story/task and issue number (or "create issue first: …").
- State current branch and, if needed, the branch to create and the exact `git checkout -b …` command.
- If implementing in this session: after implementation, end with a short "Before you're done: push, open PR (Closes #N), fill template, test/lint, merge."

# 7. Prefill (optional)

Start by asking or confirming: "What story or task are you starting, and do you already have a GitHub issue?" Then run through issue → branch → work → PR reminder.
