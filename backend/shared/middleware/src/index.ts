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

// SSM utilities
export { getClerkSecretKey, resetClerkSecretKeyCache } from "./ssm.js";
