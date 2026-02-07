#!/bin/bash
# CDK deploy wrapper - enforces --profile abstract and us-east-2

set -e

PROFILE="abstract"
REGION="us-east-2"

# Verify AWS profile exists
if ! aws configure list --profile "$PROFILE" &>/dev/null; then
  echo "❌ ERROR: AWS profile '$PROFILE' not found"
  echo "Run: aws configure --profile $PROFILE"
  exit 1
fi

# Verify region matches
CONFIGURED_REGION=$(aws configure get region --profile "$PROFILE" || echo "")
if [ "$CONFIGURED_REGION" != "$REGION" ]; then
  echo "⚠️  WARNING: Profile '$PROFILE' has region '$CONFIGURED_REGION'"
  echo "Expected: $REGION"
  echo "Update with: aws configure set region $REGION --profile $PROFILE"
  exit 1
fi

echo "✅ Using profile: $PROFILE"
echo "✅ Using region: $REGION"
echo ""

# Forward all args to CDK
npx cdk "$@" --profile "$PROFILE" --region "$REGION"
