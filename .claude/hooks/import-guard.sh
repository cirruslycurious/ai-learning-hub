#!/bin/bash
# import-guard.sh - Enforce shared library usage
#
# Prevents utility duplication by requiring @ai-learning-hub/* imports
# Part of AI Learning Hub's deterministic enforcement layer

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Skip if no content
if [ -z "$CONTENT" ]; then
    exit 0
fi

# Skip non-TypeScript files
if [[ "$FILE_PATH" != *.ts ]] && [[ "$FILE_PATH" != *.tsx ]]; then
    exit 0
fi

# Skip shared library files themselves
if [[ "$FILE_PATH" == */shared/* ]]; then
    exit 0
fi

# Skip test files
if [[ "$FILE_PATH" == *.test.ts ]] || [[ "$FILE_PATH" == *.spec.ts ]]; then
    exit 0
fi

# Skip config files
if [[ "$FILE_PATH" == *config*.ts ]] || [[ "$FILE_PATH" == *Config*.ts ]]; then
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════
# Check: Logger creation (should use @ai-learning-hub/logging)
# ═══════════════════════════════════════════════════════════════════

if echo "$CONTENT" | grep -qE "new Logger|createLogger|winston\.create|pino\("; then
    if ! echo "$CONTENT" | grep -q "@ai-learning-hub/logging"; then
        jq -n '{
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "📦 Import Violation: Use @ai-learning-hub/logging instead of creating custom logger. See shared/packages/logging/"
            }
        }'
        exit 0
    fi
fi

# Check for console.log in Lambda handlers (should use structured logging)
if [[ "$FILE_PATH" == */backend/* ]] || [[ "$FILE_PATH" == */lambdas/* ]] || [[ "$FILE_PATH" == */handlers/* ]]; then
    if echo "$CONTENT" | grep -qE "console\.(log|error|warn|info)\("; then
        if ! echo "$CONTENT" | grep -q "@ai-learning-hub/logging"; then
            jq -n '{
                hookSpecificOutput: {
                    additionalContext: "💡 Lambda handlers should use @ai-learning-hub/logging instead of console.log for structured logging with correlation IDs."
                }
            }'
            exit 0
        fi
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Check: DynamoDB client (should use @ai-learning-hub/db)
# ═══════════════════════════════════════════════════════════════════

if echo "$CONTENT" | grep -qE "DynamoDBClient|DocumentClient|new DynamoDB|DynamoDBDocumentClient"; then
    if ! echo "$CONTENT" | grep -q "@ai-learning-hub/db"; then
        jq -n '{
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "📦 Import Violation: Use @ai-learning-hub/db instead of creating DynamoDB client directly. See shared/packages/db/"
            }
        }'
        exit 0
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Check: Zod schemas (remind about shared validation)
# ═══════════════════════════════════════════════════════════════════

if echo "$CONTENT" | grep -qE "z\.(object|string|number|array|enum)\("; then
    if ! echo "$CONTENT" | grep -q "@ai-learning-hub/validation"; then
        jq -n '{
            hookSpecificOutput: {
                additionalContext: "💡 Common Zod schemas should be defined in @ai-learning-hub/validation for reuse. Check if your schema already exists there."
            }
        }'
        exit 0
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Check: Middleware patterns (should use @ai-learning-hub/middleware)
# ═══════════════════════════════════════════════════════════════════

if echo "$CONTENT" | grep -qE "withAuth|withValidation|withErrorHandling|APIGatewayProxyHandler"; then
    if ! echo "$CONTENT" | grep -q "@ai-learning-hub/middleware"; then
        jq -n '{
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "📦 Import Violation: Use @ai-learning-hub/middleware for Lambda middleware patterns. See shared/packages/middleware/"
            }
        }'
        exit 0
    fi
fi

exit 0
