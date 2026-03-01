# Story 3.2.6 Code Review Findings - Round 1

**Date:** 2026-02-27 | **Branch:** story-3-2-6-impl-scoped-api-key-permissions

## Critical Issues

### R1: Unsafe `as ApiKeyScope[]` type assertions bypass runtime validation
- auth.ts:47,51 - casts raw authorizer values without validation
- Fix: Filter parsed scopes against known valid values

### R2: SCOPE_GRANTS uses Record<string,...> instead of Record<ApiKeyScope,...>
- scope-resolver.ts:13 - loses compile-time exhaustiveness checking
- Fix: Type as Record<ApiKeyScope,...> with satisfies

## Important Issues

### R3: WrapperOptions.requiredScope remains string instead of OperationScope (AC16 incomplete)
- wrapper.ts:81 - should be OperationScope per AC16
- Fix: Change type to OperationScope

### R4: Duplicated SCOPE_GRANTS in mock-wrapper.ts (same as dedup finding #2)
- mock-wrapper.ts:230-250 - full copy of SCOPE_GRANTS
- Fix: Import from scope-resolver directly

### R5: requireScope accepts string instead of OperationScope
- auth.ts:118 - should accept OperationScope per AC16
- Fix: Change parameter type

### R6: allowedActions placement relies on implicit handleError promotion
- auth.ts:128-134, wrapper.ts:203-210 - implicit coupling
- Fix: Add comments documenting the promotion pattern

## Minor Issues

### R7: OperationScope includes users:write but no test verifies it
### R8: Missing test for empty requiredScope string
### R9: Story touches lists files not modified (docs only)
### R10: No Object.freeze() on SCOPE_GRANTS

## Summary: 2 critical, 4 important, 4 minor
