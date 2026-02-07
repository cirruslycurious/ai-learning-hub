# AI Learning Hub - Infrastructure

AWS CDK infrastructure for AI Learning Hub.

## Setup

### 1. Configure AWS Profile

```bash
# Configure the 'abstract' profile (one-time setup)
aws configure --profile abstract
# AWS Access Key ID: [your-key]
# AWS Secret Access Key: [your-secret]
# Default region: us-east-2
# Default output format: json
```

### 2. Verify Configuration

```bash
# Check profile exists
aws configure list --profile abstract

# Verify you can authenticate
aws sts get-caller-identity --profile abstract
```

### 3. Bootstrap CDK (one-time per account/region)

```bash
cd infra
npm run build
npx cdk bootstrap --profile abstract --region us-east-2
```

## Deployment

**Always use the wrapper scripts** - they enforce `--profile abstract` and `us-east-2`:

```bash
cd infra

# Synthesize CloudFormation templates (check what will deploy)
npm run synth

# See what changes will be made
npm run diff

# Deploy all stacks
npm run deploy

# Deploy specific stack
npm run deploy -- AilhDevDatabaseStack

# Deploy to dev environment explicitly
npm run deploy:dev
```

## Safety Guarantees

### Region Isolation

- **us-east-2**: AI Learning Hub (NEW, isolated)
- **us-east-1**: Your existing resources (UNTOUCHED)

All stacks use:

- New VPC in us-east-2 (CIDR: 10.1.0.0/16)
- Resource prefix: `ailh-{stage}-*`
- Tags: `Project=ai-learning-hub`, `ManagedBy=CDK`

### Profile Enforcement

The `deploy.sh` wrapper script:

1. ✅ Verifies `--profile abstract` exists
2. ✅ Validates region is `us-east-2`
3. ✅ Passes profile/region to all CDK commands
4. ❌ Blocks deployment if profile/region mismatch

### Secrets Protection

**NEVER committed to repo:**

- AWS account ID
- VPC IDs, subnet IDs
- DynamoDB table names (real)
- S3 bucket names (real)
- API Gateway IDs
- Any credentials

**How we keep secrets out:**

- `.gitignore`: blocks `.env`, `cdk.context.json`
- CDK uses env vars: `CDK_DEFAULT_ACCOUNT`, `AWS_REGION`
- Resource names: use logical IDs, CDK generates physical names
- Local overrides: `.env` file (gitignored)

**Check before commit:**

```bash
/project-check-secrets-config
```

## Directory Structure

```
infra/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   └── stacks/             # Stack definitions (per ADR-006)
├── config/
│   └── environments.ts     # Environment configuration
├── test/                   # Infrastructure tests
├── deploy.sh               # Safe deployment wrapper
└── package.json            # Scripts and dependencies
```

## Common Commands

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode
npm run watch

# Synth (check templates)
npm run synth

# Diff (see changes)
npm run diff

# Deploy all
npm run deploy

# Destroy all (DANGEROUS)
npm run destroy
```

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

## References

- [Secrets & Config Rules](.claude/docs/secrets-and-config.md)
- [ADR-006: Infrastructure Organization](../.claude/docs/architecture.md#adr-006)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
