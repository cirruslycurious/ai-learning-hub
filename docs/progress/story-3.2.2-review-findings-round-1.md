# Story 3.2.2 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-26
**Branch:** story-3-2-2-consistent-error-contract-response-envelope

## Critical Issues (Must Fix)

1. **Mock-wrapper error handler does not promote `currentState`/`allowedActions`/`requiredConditions` to top-level error body fields**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`, lines 307-365
   - **Problem:** The production error handler (`error-handler.ts` -> `createErrorResponse` -> `appError.toApiError()`) promotes `currentState`, `allowedActions`, and `requiredConditions` from `details` to the top-level error body, stripping them from `details` to avoid duplication (AC5). The mock-wrapper's `catch` block does NOT perform this promotion -- it dumps all details (minus `responseHeaders`) into `error.details` as-is. This means handler tests using the mock-wrapper that throw errors with state context (e.g., via `AppError.build(...).withState(...)`) will produce a different response shape than production, with these fields nested inside `details` instead of at the top level.
   - **Impact:** Any future handler test that asserts on the promoted fields (`error.currentState`, `error.allowedActions`, `error.requiredConditions`) in the error response body will fail when using the mock-wrapper, because those fields will be in `error.details.currentState` etc. instead. This creates a test fidelity gap -- the mock does not mirror production behavior for the enhanced error contract.
   - **Fix:** Update the mock-wrapper's error handler (lines 350-364) to mirror the `toApiError()` promotion logic: extract `currentState`, `allowedActions`, `requiredConditions` from `bodyDetails`, set them as top-level fields on the error body, and remove them from `details`. Example:
     ```typescript
     const {
       currentState,
       allowedActions,
       requiredConditions,
       responseHeaders: _,
       ...cleanDetails
     } = err.details ?? {};
     const errorBody: Record<string, unknown> = {
       code,
       message,
       requestId: "test-req-id",
     };
     if (Object.keys(cleanDetails).length > 0) errorBody.details = cleanDetails;
     if (typeof currentState === "string")
       errorBody.currentState = currentState;
     if (Array.isArray(allowedActions))
       errorBody.allowedActions = allowedActions;
     if (Array.isArray(requiredConditions))
       errorBody.requiredConditions = requiredConditions;
     ```

## Important Issues (Should Fix)

1. **`FieldValidationError` not exported from `@ai-learning-hub/types` as required by AC14**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/types/src/index.ts`
   - **Problem:** AC14 explicitly states: "All new types exported from `@ai-learning-hub/types` index: `EnvelopeMeta`, `RateLimitMeta`, `ResponseLinks`, `ResponseEnvelope<T>`, `FieldValidationError`." While `EnvelopeMeta`, `RateLimitMeta`, `ResponseLinks`, and `ResponseEnvelope` are exported from `@ai-learning-hub/types`, `FieldValidationError` is only available as an alias of `ValidationErrorDetail` from `@ai-learning-hub/validation`. It is entirely absent from the types package.
   - **Impact:** Consumers who want to type-annotate field validation errors using `@ai-learning-hub/types` (the canonical types package) cannot import `FieldValidationError` from there. This is a direct AC14 compliance gap.
   - **Fix:** Either (a) define a `FieldValidationError` interface in `@ai-learning-hub/types/src/api.ts` (with `field`, `message`, `code`, `constraint?`, `allowed_values?` fields) and export it from the types index, or (b) add a note to the story explaining the deviation from AC14 with justification (keeping validation-specific types in the validation package). Option (a) is preferred for full AC compliance.

2. **`EnvelopeMeta` and `ResponseLinks` not re-exported from `@ai-learning-hub/middleware` (AC15)**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/index.ts`
   - **Problem:** AC15 states: "All new types and the builder are importable from `@ai-learning-hub/types` and `@ai-learning-hub/middleware` (re-exported where used)." The middleware package uses `EnvelopeMeta` and `ResponseLinks` in `error-handler.ts` (they are part of the `SuccessResponseOptions` type), but does not re-export them from its index. Consumers calling `createSuccessResponse` with the options pattern need these types to properly type their `meta` and `links` arguments, but must know to import them from `@ai-learning-hub/types` separately.
   - **Impact:** Ergonomic friction for consumers. They export `SuccessResponseOptions` from middleware, but the types referenced by that interface (`EnvelopeMeta`, `ResponseLinks`) are only available from a different package. This is not a runtime issue but degrades DX.
   - **Fix:** Add re-exports of `EnvelopeMeta`, `ResponseLinks`, and optionally `RateLimitMeta` and `ResponseEnvelope` from `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/src/index.ts`.

3. **`ApiSuccessResponse` does not include `links` field, diverging from `ResponseEnvelope`**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/types/src/api.ts`, lines 44-47
   - **Problem:** The new `ResponseEnvelope<T>` type includes `data`, `meta?`, and `links?`. However, the existing `ApiSuccessResponse<T>` was only updated to use `EnvelopeMeta` for `meta` -- it does NOT include `links?: ResponseLinks`. This means code that types its response as `ApiSuccessResponse<T>` cannot include links, while the envelope and `createSuccessResponse` both support links. The two types are inconsistent.
   - **Impact:** If any existing code types its response using `ApiSuccessResponse<T>` and later needs to add `links`, the type won't allow it. The `ResponseEnvelope<T>` is the correct full type, but `ApiSuccessResponse<T>` is the historically used type that was updated only partially.
   - **Fix:** Either (a) add `links?: ResponseLinks` to `ApiSuccessResponse<T>` to make it equivalent to `ResponseEnvelope<T>`, or (b) deprecate `ApiSuccessResponse<T>` in favor of `ResponseEnvelope<T>` with a deprecation comment (similar to the `ApiResponseMeta` deprecation). Option (b) is cleaner since `ResponseEnvelope<T>` is the canonical type going forward.

## Minor Issues (Nice to Have)

1. **`allowed_values` uses snake_case inconsistent with codebase camelCase convention**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/validation/src/validator.ts`, line 15
   - **Problem:** The `allowed_values` field on `ValidationErrorDetail` uses snake_case, while every other multi-word field in the API contract uses camelCase (`requestId`, `currentState`, `allowedActions`, `requiredConditions`, `allowedActions`, `rateLimit`). The story spec (AC6) and FR101 both specify `allowed_values`, so this matches the spec, but the spec itself is inconsistent with the project's stated camelCase convention (AC1 key decision #1).
   - **Impact:** Mixed naming conventions in the JSON wire format. Agent consumers must handle snake_case for this one field and camelCase for everything else. This creates a parsing inconsistency.
   - **Fix:** This is a spec-level issue. If the team decides camelCase should be universal, rename to `allowedValues` in the interface and extraction code, and update tests. However, since the spec explicitly says `allowed_values`, this could also be accepted as-is with a comment noting the deliberate deviation. Deferring this to a future consistency sweep is also acceptable.

2. **Builder `withDetails` can silently overwrite state/conditions set by `withState`/`withConditions`**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/types/src/errors.ts`, lines 176-178
   - **Problem:** The `withDetails` method spreads incoming details over existing ones: `this.details = { ...this.details, ...details }`. If called after `withState`, a `details` object containing `currentState` or `allowedActions` would overwrite the values set by `withState`. This is not a bug per se (spread order is well-defined), but it is a potential footgun for developers.
   - **Impact:** Low immediate risk since the builder is new and usage patterns are not established yet. Could cause subtle bugs if a developer calls `.withState("paused", ["resume"]).withDetails({ currentState: "active" })` expecting both calls to be respected.
   - **Fix:** Consider having `withDetails` filter out the three promoted field names (`currentState`, `allowedActions`, `requiredConditions`) to prevent accidental overwrites, or add a JSDoc warning to `withDetails` documenting the override behavior.

3. **`safeValidate` return type still uses `errors` property name**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/validation/src/validator.ts`, line 73
   - **Problem:** While the story renames `errors` to `fields` in the API error response shape (the `validate()` function's AppError details), the `safeValidate()` function still returns `{ success: false; errors: ValidationErrorDetail[] }` using the `errors` property name. This creates a naming divergence within the same file.
   - **Impact:** Minor confusion. `safeValidate` is a programming-level return value (not the API wire format), so the scope notes say the rename is "isolated to `validate()`". However, the inconsistency within the same file is noticeable. Any consumer who uses both `validate` (which throws with `details.fields`) and `safeValidate` (which returns `.errors`) must mentally track two different property names for the same concept.
   - **Fix:** Consider renaming to `{ success: false; fields: ValidationErrorDetail[] }` for consistency, or add a comment explaining why `errors` is kept here. This is genuinely minor since `safeValidate` is not part of the API wire format.

4. **Integration test has a duplicated mock event factory instead of using shared test-utils**
   - **File:** `/Users/stephen/Documents/ai-learning-hub/backend/shared/middleware/test/error-contract-envelope.integration.test.ts`, lines 11-57
   - **Problem:** The integration test defines its own `createMockEvent` function that duplicates the mock event factory already available in `/Users/stephen/Documents/ai-learning-hub/backend/test-utils/mock-wrapper.ts`. The existing `createMockEvent` from test-utils is slightly more featured (supports userId, auth, etc.).
   - **Impact:** Code duplication. When the mock event shape needs updating, two locations must be maintained.
   - **Fix:** Import `createMockEvent` from `../../test-utils/mock-wrapper.js` (or wherever the path resolves) instead of redefining it. Note: the existing wrapper.test.ts in the same package also defines its own mock event, so there may be a deliberate pattern of self-contained test files. Still worth noting for future cleanup.

## Summary

- **Total findings:** 7
- **Critical:** 1
- **Important:** 3
- **Minor:** 3
- **Recommendation:** Request fixes for the critical mock-wrapper fidelity gap and the AC14/AC15 compliance items, then approve. The implementation is solid overall -- the core error contract, response envelope, builder pattern, validation enhancements, and handler migrations are all well-done. The one critical issue (mock-wrapper not promoting fields) will cause real test failures when future handlers use the enhanced error contract with the mock-wrapper, so it should be fixed before merge.
