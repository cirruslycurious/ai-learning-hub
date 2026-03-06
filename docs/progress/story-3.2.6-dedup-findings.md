# Story 3.2.6 Dedup Scan Findings

**Date:** 2026-02-27 | **Branch:** story-3-2-6-impl-scoped-api-key-permissions

## Critical Issues: None

## Important Issues (Should Fix)

### 1. wrapper.ts inlines scope-checking logic instead of calling requireScope()
- **Files:** wrapper.ts:199-213, auth.ts:118-136
- **Fix:** Replace inline logic with `requireScope(auth, options.requiredScope)` (one line)

### 2. mock-wrapper.ts reimplements SCOPE_GRANTS map and resolveScopeGrants
- **Files:** mock-wrapper.ts:230-261, scope-resolver.ts:13-62
- **Fix:** Import checkScopeAccess from scope-resolver sub-module directly

### 3. mock-wrapper.ts has two copies of rawScopes parsing
- **Files:** mock-wrapper.ts:217-228, mock-wrapper.ts:290-301
- **Fix:** Extract local parseScopes() helper

### 4. wrapper.ts inlines role-checking logic instead of calling requireRole()
- **Files:** wrapper.ts:190-197, auth.ts:101-112
- **Fix:** Replace with `requireRole(auth!, options.requiredRoles)`

## Minor Issues

### 5. ApiKeyScope values defined in three locations (types, validation, scope-resolver)
### 6. isApiKey boolean-or-string coercion repeated in 3 places

## Summary: 0 critical, 4 important, 2 minor. PROCEED.
