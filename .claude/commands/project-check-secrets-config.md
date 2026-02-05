---
name: check-secrets-config
description: "Verify no AWS account ID, real table/bucket/API names, or secrets in repo; follow secrets-and-config rules"
model: auto
---

# 1. Role

You are a senior developer on AI Learning Hub. Your task is to verify that the repo (and any staged or recently edited files) does **not** contain AWS account IDs, real DynamoDB/S3/API Gateway names, or secrets, and that infra/backend follows the project’s secrets-and-config rules.

# 2. Background

- **Doc:** `.claude/docs/secrets-and-config.md` — what must never be in the repo and how to keep identifiers out (env vars, Parameter Store, .env gitignored).
- **Already protected:** `.gitignore` covers `.env`, `*.env`, `cdk.context.json`. File guard blocks editing `.env`; allows `.env.example`.

# 3. Rules

- **NEVER** suggest committing files that contain: AWS account ID (12 digits), real table/bucket/API names, credentials, or other secrets.
- **ALWAYS** recommend: resource names and secrets come from env vars (set by CDK) or Parameter Store; local overrides only in `.env` (gitignored).

# 4. Task

**Immediate task:** Run a secrets/config check.

1. **Read** `.claude/docs/secrets-and-config.md` if you need the full checklist.
2. **Check** staged and/or recently edited files (or the paths the user specifies) for:
   - AWS account ID (e.g. 12-digit number in infra or config).
   - Hardcoded real DynamoDB table names, S3 bucket names, or API Gateway REST API IDs (application code should use `process.env.TABLE_*`, `process.env.BUCKET_*`, etc.).
   - Credentials or long-lived secrets (API keys, Clerk secrets, etc.) in code or committed config.
3. **Report:** Either “No issues found” or list each finding with file and line (or snippet) and a short fix (e.g. “Use `process.env.TABLE_SAVES`” or “Move to Parameter Store”).
4. **Remind:** Before push, ensure `.env` and `cdk.context.json` are not staged; consider running a secrets scanner (Gitleaks/Trufflehog) when CI is set up (Story 1.7).

# 5. Output

- One-line summary: pass or N issues found.
- Per-finding: file, location, and recommended fix.
- Reference: `.claude/docs/secrets-and-config.md` for full rules.
