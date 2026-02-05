/**
 * @ai-learning-hub/validation
 *
 * Zod-based validation utilities for Lambda functions
 */

// Common schemas
export {
  uuidSchema,
  urlSchema,
  emailSchema,
  nonEmptyStringSchema,
  paginationSchema,
  sortDirectionSchema,
  isoDateSchema,
  resourceTypeSchema,
  tutorialStatusSchema,
  projectStatusSchema,
  tagsSchema,
  userIdSchema,
  apiKeyScopeSchema,
  apiKeyScopesSchema,
} from "./schemas.js";

// Validation utilities
export {
  validate,
  safeValidate,
  validateJsonBody,
  validateQueryParams,
  validatePathParams,
  formatZodErrors,
  type ValidationErrorDetail,
  // Re-export Zod
  z,
  ZodError,
  type ZodSchema,
} from "./validator.js";
