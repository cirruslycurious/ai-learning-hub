# Secrets and Deployment Config — Never in Repo

**Goal:** AWS account ID, real DynamoDB table names, real S3 bucket names, real API Gateway IDs, and any credentials must **never** appear in the public repo.

## 1. What never goes in the repo

- **AWS account ID** (12-digit number)
- **Real resource names/ARNs:** DynamoDB table names, S3 bucket names, API Gateway REST API IDs, Lambda ARNs
- **Credentials:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, API keys, Clerk secrets, etc.
- **Files:** `.env`, `.env.local`, `.env.*.local`, and any file containing the above

These are already ignored: `.env`, `*.env`, `cdk.context.json` (see `.gitignore`). Do not add account ID or real names to `cdk.json` context or any committed file.

## 2. How to keep identifiers out of code

### CDK (infra)

- **Account/region:** Do not hardcode. Use CDK’s default: leave `env` unspecified so CDK uses the deployer’s credentials (`aws sts get-caller-identity`, default region). For CI, use OIDC or GitHub Actions env; account/region come from the runner’s config, not from the repo.
- **Resource names:** Do not hardcode. Define resources with logical IDs (e.g. `SavesTable`); CDK generates physical names. Pass names/IDs to Lambda only via **environment variables** (e.g. `table.tableName`, `bucket.bucketName`) so the actual values exist only in the deployed stack in AWS, not in source.

### Backend (Lambda, shared libs)

- **Table names, bucket names, API base URL:** Read from **environment variables** (e.g. `process.env.TABLE_SAVES`, `process.env.BUCKET_NOTES`, `process.env.API_BASE_URL`) that CDK sets when defining the function. Never hardcode real names or IDs in application code.
- **Secrets (API keys, Clerk keys, etc.):** Use **AWS Systems Manager Parameter Store** (or Secrets Manager). Lambda gets them via IAM + SSM GetParameter at runtime, or from env vars that CDK injects from Parameter Store. Never commit secret values.

### Local development

- Use **`.env`** (or `.env.local`) for local-only values. Copy from **`.env.example`** and fill in; **never commit `.env`**. `.env.example` may contain placeholder names (e.g. `TABLE_SAVES=dev-saves-placeholder`); real values stay in `.env`, which is gitignored.

## 3. Checklist before commit / PR

- No AWS account ID in any file.
- No real DynamoDB table names, S3 bucket names, or API Gateway IDs in application or infra code (only logical IDs and env var references).
- No credentials or long-lived secrets in code or in committed config.
- `.env` and `cdk.context.json` are not staged (they are in `.gitignore`).

## 4. CI (Story 1.7+)

- Run **secrets detection** (e.g. Gitleaks, Trufflehog, or GitHub secret scanning) in the pipeline so accidental commits of secrets or account IDs are blocked or flagged.

## 5. Summary

| Item                   | Where it lives                  | Never put in repo                |
| ---------------------- | ------------------------------- | -------------------------------- |
| AWS account ID         | Deployer / CI env               | Yes — never in repo              |
| Table/bucket/API names | Lambda env (set by CDK)         | Yes — only env var names in code |
| Secrets                | Parameter Store / env at deploy | Yes — never values in repo       |
| Local overrides        | `.env` (gitignored)             | Yes — never commit `.env`        |
