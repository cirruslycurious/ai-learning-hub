#!/bin/bash
# auto-format.sh - Auto-format files after edit/write
#
# Runs Prettier and ESLint fix on modified files
# Part of AI Learning Hub's PostToolUse hooks

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Skip if no file path
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Get project root (where package.json is)
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════
# Format TypeScript/JavaScript files
# ═══════════════════════════════════════════════════════════════════

if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]] || [[ "$FILE_PATH" == *.js ]] || [[ "$FILE_PATH" == *.jsx ]]; then
    # Run Prettier (if available)
    if [ -f "$PROJECT_ROOT/node_modules/.bin/prettier" ]; then
        "$PROJECT_ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" 2>/dev/null
    elif command -v npx &> /dev/null; then
        npx prettier --write "$FILE_PATH" 2>/dev/null
    fi

    # Run ESLint fix (if available)
    if [ -f "$PROJECT_ROOT/node_modules/.bin/eslint" ]; then
        "$PROJECT_ROOT/node_modules/.bin/eslint" --fix "$FILE_PATH" 2>/dev/null
    elif command -v npx &> /dev/null; then
        npx eslint --fix "$FILE_PATH" 2>/dev/null
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Format JSON files
# ═══════════════════════════════════════════════════════════════════

if [[ "$FILE_PATH" == *.json ]]; then
    if [ -f "$PROJECT_ROOT/node_modules/.bin/prettier" ]; then
        "$PROJECT_ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" 2>/dev/null
    elif command -v npx &> /dev/null; then
        npx prettier --write "$FILE_PATH" 2>/dev/null
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Format Markdown files
# ═══════════════════════════════════════════════════════════════════

if [[ "$FILE_PATH" == *.md ]]; then
    if [ -f "$PROJECT_ROOT/node_modules/.bin/prettier" ]; then
        "$PROJECT_ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" 2>/dev/null
    elif command -v npx &> /dev/null; then
        npx prettier --write "$FILE_PATH" 2>/dev/null
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Format YAML files
# ═══════════════════════════════════════════════════════════════════

if [[ "$FILE_PATH" == *.yaml ]] || [[ "$FILE_PATH" == *.yml ]]; then
    if [ -f "$PROJECT_ROOT/node_modules/.bin/prettier" ]; then
        "$PROJECT_ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" 2>/dev/null
    elif command -v npx &> /dev/null; then
        npx prettier --write "$FILE_PATH" 2>/dev/null
    fi
fi

# Always exit 0 - formatting errors shouldn't block
exit 0
