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
  contentTypeSchema,
  tutorialStatusSchema,
  projectStatusSchema,
  tagsSchema,
  userIdSchema,
  apiKeyScopeSchema,
  apiKeyScopesSchema,
  updateProfileBodySchema,
  validateInviteBodySchema,
  createSaveSchema,
  updateSaveSchema,
} from "./schemas.js";

// URL normalization
export {
  normalizeUrl,
  NormalizeError,
  type NormalizeResult,
} from "./url-normalizer.js";

// Content type detection
export { detectContentType } from "./content-type-detector.js";

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
