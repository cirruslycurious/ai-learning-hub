# Branch & Commit Conventions

**Purpose:** Document branch naming and commit message conventions for humans and agents. Discoverable from CLAUDE.md via `.claude/docs/`.

## Commit Messages

- **Reference issue numbers** in commits when the change addresses an issue (e.g. `fix: resolve save error #42`, `feat: add story template #12`).
- Prefer **conventional commit** style when useful:
  - `feat:` new feature
  - `fix:` bug fix
  - `docs:` documentation only
  - `chore:` tooling, config, non-functional
  - `refactor:` code change with no behavior change
- Keep the first line short (~50 chars); add body/details after a blank line if needed.

## Branch Naming (optional)

If the project adopts branch naming conventions, use patterns such as:

- `feature/` — new features (e.g. `feature/save-url`)
- `fix/` — bug fixes (e.g. `fix/save-error-42`)
- `story/` — story-based work (e.g. `story/1-6-github-templates`)

Branch names should be short, lowercase, and hyphen-separated. Include issue or story ID when relevant (e.g. `story/1-6-github-templates`).

## References

- CLAUDE.md (ALWAYS): "Reference issue numbers in commits (e.g., \"fix: resolve save error #42\")"
- GitHub issue/PR templates: `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`
