# AWS Setup Complete - Profile & Region Configuration

**Date:** 2026-02-07
**Status:** ✅ Complete
**Coverage:** 100% (57 tests passing)

## Summary

Implemented a comprehensive AWS deployment configuration strategy that:

1. ✅ Prevents AWS secrets from entering the public repo
2. ✅ Enforces use of `--profile abstract`
3. ✅ Isolates `us-east-2` deployment from existing `us-east-1` resources

---

## 1. Secrets Protection ✅

### Implementation

- **`.gitignore`**: Blocks `.env`, `*.env`, `cdk.context.json`
- **Documentation**: `.claude/docs/secrets-and-config.md`
- **Validation**: `/project-check-secrets-config` command
- **Tests**: 21 tests verify no hardcoded secrets in source code

### What's Protected

- AWS account ID (never in repo)
- VPC IDs, subnet IDs
- DynamoDB table names (real)
- S3 bucket names (real)
- API Gateway IDs
- All credentials and secrets

### How It Works

```typescript
// ❌ NEVER do this:
const accountId = "123456789012";

// ✅ ALWAYS do this:
const accountId = process.env.CDK_DEFAULT_ACCOUNT;
```

**Before every commit:**

```bash
/project-check-secrets-config
```

---

## 2. Profile Enforcement ✅

### Implementation

Created `infra/deploy.sh` wrapper script that:

1. ✅ Verifies `--profile abstract` exists
2. ✅ Validates region is `us-east-2`
3. ✅ Passes profile/region to all CDK commands
4. ❌ Blocks deployment if profile/region mismatch

### Usage

```bash
cd infra

# ❌ NEVER use cdk directly:
# npx cdk deploy

# ✅ ALWAYS use wrapper scripts:
npm run synth    # Generate CloudFormation
npm run diff     # Show what will change
npm run deploy   # Deploy all stacks
npm run destroy  # Destroy all (careful!)
```

### Verification

```bash
./deploy.sh --version
# Validates profile and region before running
```

---

## 3. Region Isolation ✅

### Strategy

- **us-east-2**: AI Learning Hub (NEW, isolated)
- **us-east-1**: Existing resources (UNTOUCHED)

### Implementation

```typescript
// infra/config/aws-env.ts
export function getAwsEnv(): AwsEnvironment {
  return {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:
      process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || "us-east-2",
  };
}
```

### Resource Naming

- **Prefix**: `ailh-{stage}-*` (ailh = ai-learning-hub)
- **VPC**: New VPC in us-east-2 (CIDR: 10.1.0.0/16)
- **Tags**:
  - `Project=ai-learning-hub`
  - `ManagedBy=CDK`

### Environment Configuration

```typescript
// infra/config/environments.ts
{
  stage: "dev" | "staging" | "prod",
  region: "us-east-2",
  vpcConfig: {
    createNew: true,           // Never reference existing VPCs
    cidr: "10.1.0.0/16",      // Non-overlapping CIDR
    maxAzs: 2,
  },
  resourcePrefix: "ailh-dev", // Unique naming
}
```

---

## Files Created

### Configuration

- ✅ `infra/config/aws-env.ts` - AWS environment configuration (18 tests)
- ✅ `infra/config/environments.ts` - Environment-specific config (17 tests)
- ✅ `infra/deploy.sh` - Safe deployment wrapper (executable)
- ✅ `infra/vitest.config.ts` - Coverage configuration

### Tests (57 total, 100% coverage)

- ✅ `test/config/aws-env.test.ts` (18 tests)
- ✅ `test/config/environments.test.ts` (17 tests)
- ✅ `test/bin/app-structure.test.ts` (21 tests)
- ✅ `test/app.test.ts` (1 test - existing)

### Documentation

- ✅ `infra/README.md` - Complete setup guide
- ✅ Updated `infra/bin/app.ts` - Uses environment configuration
- ✅ Updated `infra/package.json` - Deployment scripts
- ✅ Updated `infra/tsconfig.json` - Include config directory

---

## Next Steps

### 1. Configure AWS Profile (Do This Now)

```bash
# Set region to us-east-2 for the abstract profile
aws configure set region us-east-2 --profile abstract

# Verify
aws configure list --profile abstract
```

### 2. Bootstrap CDK (One-Time Setup)

```bash
cd infra
npm run build
npx cdk bootstrap --profile abstract --region us-east-2
```

### 3. Test Deployment (When Ready)

```bash
cd infra

# See what would deploy
npm run synth

# Show changes
npm run diff

# Deploy (when ready)
npm run deploy
```

---

## Testing

### Coverage Report

```
File             | % Stmts | % Branch | % Funcs | % Lines
-----------------|---------|----------|---------|--------
All files        |     100 |      100 |     100 |     100
 aws-env.ts      |     100 |      100 |     100 |     100
 environments.ts |     100 |      100 |     100 |     100
```

### Test Suites

- **AWS Environment**: 18 tests covering env var precedence, region isolation
- **Environment Config**: 17 tests covering stage configs, VPC setup, naming
- **App Structure**: 21 tests verifying no secrets, proper imports, CDK best practices

### Run Tests

```bash
cd infra

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test test/config/aws-env.test.ts
```

---

## Safety Guarantees

### 1. No Secrets in Repo

- ✅ `.gitignore` blocks sensitive files
- ✅ Tests verify no hardcoded account IDs
- ✅ Tests verify no hardcoded resource names
- ✅ Tests verify use of environment variables

### 2. Profile Enforcement

- ✅ Wrapper script validates profile exists
- ✅ Wrapper script validates region matches
- ✅ Deployment blocked if mismatch
- ✅ All commands use `--profile abstract --region us-east-2`

### 3. Region Isolation

- ✅ Default region: `us-east-2`
- ✅ New VPC created (never references existing)
- ✅ Unique resource prefixes (`ailh-{stage}-*`)
- ✅ Tags for easy identification

---

## Troubleshooting

### Wrong region error

```
ERROR: Profile 'abstract' has region 'us-east-1'
Expected: us-east-2
```

**Fix:**

```bash
aws configure set region us-east-2 --profile abstract
```

### Profile not found

```
ERROR: AWS profile 'abstract' not found
```

**Fix:**

```bash
aws configure --profile abstract
```

### CDK bootstrap required

```
ERROR: This stack uses assets, so the toolkit stack must be bootstrapped
```

**Fix:**

```bash
npx cdk bootstrap --profile abstract --region us-east-2
```

---

## References

- [infra/README.md](../../infra/README.md) - Complete deployment guide
- [.claude/docs/secrets-and-config.md](../../.claude/docs/secrets-and-config.md) - Secrets strategy
- [ADR-006: Infrastructure Organization](../../.claude/docs/architecture.md#adr-006)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)

---

**Status**: Ready for CDK bootstrap and first deployment
**Coverage**: 100% (57/57 tests passing)
**Security**: All secrets protection measures in place
