# Project Context

## Deployment Status: Pre-Launch Greenfield

This project has **never been deployed to production**. There are zero users, zero live environments, and zero legacy consumers. Every piece of code in this repo is pre-launch work in progress.

### What This Means for Implementation

- **No backward compatibility required.** There is no deployed API, schema, or interface to preserve.
- **No legacy code to protect.** If a pattern, approach, or implementation is being replaced, **delete the old code entirely**. Do not leave deprecated functions, compatibility shims, re-exports, or "just in case" wrappers.
- **Retrofits are full replacements.** When a story involves retrofitting, refactoring, or changing an earlier approach, treat it as a clean rewrite of the affected areas. Eliminate all traces of the previous approach.
- **No cruft tolerance.** Dead code, unused exports, orphaned types, backward-compat aliases, and TODO-remove comments are bugs, not safety nets. Remove them.
- **Tests should reflect current design only.** When an approach changes, update or delete old tests — do not keep tests for removed behavior.

### Anti-Patterns to Avoid

- Keeping old implementations "in case we need to revert" — we don't, that's what git history is for
- Adding `@deprecated` annotations instead of deleting code
- Creating adapter layers between old and new approaches
- Preserving unused DB indexes, API endpoints, or event handlers from a previous design
- Warning about "breaking changes" when there are no consumers to break
