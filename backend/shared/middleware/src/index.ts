/**
 * @ai-learning-hub/middleware
 *
 * Lambda middleware for auth, error handling, and request context
 */

// Error handling
export {
  createErrorResponse,
  normalizeError,
  handleError,
  createSuccessResponse,
  createNoContentResponse,
} from "./error-handler.js";

// Authentication
export {
  extractAuthContext,
  requireAuth,
  requireRole,
  requireScope,
} from "./auth.js";

// Authorizer policy helpers (shared between JWT and API Key authorizers)
export {
  generatePolicy,
  deny,
  type PolicyDocument,
} from "./authorizer-policy.js";

// Handler wrapper
export {
  wrapHandler,
  type WrappedEvent,
  type HandlerContext,
  type WrappedHandler,
  type WrapperOptions,
} from "./wrapper.js";

// Idempotency middleware (Story 3.2.1)
export {
  extractIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
  type IdempotencyStatus,
} from "./idempotency.js";

// Optimistic concurrency middleware (Story 3.2.1)
export { extractIfMatch } from "./concurrency.js";

// SSM utilities
export { getClerkSecretKey, resetClerkSecretKeyCache } from "./ssm.js";
