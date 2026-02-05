#!/bin/bash
# architecture-guard.sh - Enforce Architecture Decision Records (ADRs)
#
# Validates code changes against architectural constraints:
# - ADR-007: No Lambda-to-Lambda calls
# - ADR-006: DynamoDB key patterns
# - ADR-005: Shared library usage (see import-guard.sh)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Skip if no content to check
if [ -z "$CONTENT" ]; then
    exit 0
fi

# Skip non-TypeScript files
if [[ "$FILE_PATH" != *.ts ]] && [[ "$FILE_PATH" != *.tsx ]]; then
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════
# ADR-007: No Lambda-to-Lambda Calls
# ═══════════════════════════════════════════════════════════════════

if echo "$CONTENT" | grep -qiE "lambda\.invoke|invokeFunction|LambdaClient.*Invoke|InvokeCommand"; then
    jq -n '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "🏗️ Architecture Violation (ADR-007): Direct Lambda-to-Lambda calls are prohibited. Use API Gateway or EventBridge instead. See docs/ARCHITECTURE.md"
        }
    }'
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════
# ADR-006: DynamoDB Key Patterns (warning, not blocking)
# Portable: avoid PCRE (?!...) since BSD/macOS grep -E does not support it
# ═══════════════════════════════════════════════════════════════════

# Look for PK='...' or PK="..." and warn if value doesn't start with allowed prefix
if echo "$CONTENT" | grep -qE "PK\s*=\s*['\"]"; then
    # If line has PK= but does NOT contain any of the standard prefixes, add context
    if ! echo "$CONTENT" | grep -qE "PK\s*=\s*['\"][^'\"]*(USER#|CONTENT#|COLLECTION#|FOLDER#)"; then
        # Double-check: we have a PK assignment that looks non-standard (has PK= but no standard prefix on same line)
        if echo "$CONTENT" | grep -qE "PK\s*=\s*['\"][^'\"]+['\"]"; then
            jq -n '{
                hookSpecificOutput: {
                    additionalContext: "💡 DynamoDB key may not follow standard pattern (ADR-006). Keys should start with USER#, CONTENT#, COLLECTION#, or FOLDER#. Please verify."
                }
            }'
            exit 0
        fi
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# ADR-014: API-First Design (no direct DynamoDB in handlers)
# ═══════════════════════════════════════════════════════════════════

# If file is in handlers/ and directly imports DynamoDB, warn
if [[ "$FILE_PATH" == *"/handlers/"* ]] || [[ "$FILE_PATH" == *"/lambdas/"* ]]; then
    if echo "$CONTENT" | grep -qE "from '@aws-sdk/client-dynamodb'|from 'aws-sdk/clients/dynamodb'"; then
        # Check if it's also importing from shared db
        if ! echo "$CONTENT" | grep -q "@ai-learning-hub/db"; then
            jq -n '{
                hookSpecificOutput: {
                    additionalContext: "💡 Lambda handlers should use @ai-learning-hub/db instead of direct DynamoDB SDK imports (ADR-014). See shared/packages/db/"
                }
            }'
            exit 0
        fi
    fi
fi

exit 0
