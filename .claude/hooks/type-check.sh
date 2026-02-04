#!/bin/bash
# type-check.sh - TypeScript validation after edits
#
# Validates TypeScript files and provides error context
# Part of AI Learning Hub's PostToolUse hooks

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Skip if no file path
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Only check TypeScript files
if [[ "$FILE_PATH" != *.ts ]] && [[ "$FILE_PATH" != *.tsx ]]; then
    exit 0
fi

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# Get project root
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Find tsconfig.json (walk up directory tree)
TSCONFIG=""
SEARCH_DIR=$(dirname "$FILE_PATH")
while [ "$SEARCH_DIR" != "/" ]; do
    if [ -f "$SEARCH_DIR/tsconfig.json" ]; then
        TSCONFIG="$SEARCH_DIR/tsconfig.json"
        break
    fi
    SEARCH_DIR=$(dirname "$SEARCH_DIR")
done

# If no tsconfig found, try project root
if [ -z "$TSCONFIG" ] && [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
    TSCONFIG="$PROJECT_ROOT/tsconfig.json"
fi

# Run TypeScript check
if [ -n "$TSCONFIG" ]; then
    # Use project's tsc if available
    if [ -f "$PROJECT_ROOT/node_modules/.bin/tsc" ]; then
        ERRORS=$("$PROJECT_ROOT/node_modules/.bin/tsc" --noEmit --project "$TSCONFIG" 2>&1 | grep -A 2 "$FILE_PATH" || true)
    elif command -v npx &> /dev/null; then
        ERRORS=$(npx tsc --noEmit --project "$TSCONFIG" 2>&1 | grep -A 2 "$FILE_PATH" || true)
    else
        # No TypeScript available
        exit 0
    fi

    # If there are errors in this file, provide context
    if [ -n "$ERRORS" ]; then
        # Escape for JSON
        ERRORS_JSON=$(echo "$ERRORS" | jq -Rs '.')

        jq -n --argjson errors "$ERRORS_JSON" '{
            hookSpecificOutput: {
                additionalContext: ("⚠️ TypeScript errors detected:\n" + $errors + "\n\nPlease fix these type errors.")
            }
        }'
    fi
fi

# Always exit 0 - type errors are informational, not blocking
# (Blocking would prevent iterative fixing)
exit 0
