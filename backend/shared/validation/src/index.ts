/**
 * @ai-learning-hub/validation
 *
 * Zod-based validation utilities for Lambda functions.
 * For API Gateway query params (e.g. pagination limit as string), use paginationQuerySchema (coerces limit from string).
 */

// Common schemas
export {
  uuidSchema,
  urlSchema,
  emailSchema,
  nonEmptyStringSchema,
  paginationSchema,
  paginationQuerySchema,
  sortDirectionSchema,
  isoDateSchema,
  resourceTypeSchema,
  tutorialStatusSchema,
  projectStatusSchema,
  tagsSchema,
  userIdSchema,
  apiKeyScopeSchema,
  apiKeyScopesSchema,
  updateProfileBodySchema,
  validateInviteBodySchema,
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
