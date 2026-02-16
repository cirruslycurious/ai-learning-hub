/**
 * Zod validation schemas for invite code generation endpoints.
 *
 * POST has no request body (no schema needed).
 * GET uses paginationQuerySchema from @ai-learning-hub/validation.
 *
 * Per Story 2.9, Task 3: maintains the three-file pattern (handler, test, schemas).
 */
export { paginationQuerySchema } from "@ai-learning-hub/validation";
