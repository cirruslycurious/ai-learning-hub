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

// Handler wrapper
export {
  wrapHandler,
  type WrappedEvent,
  type HandlerContext,
  type WrappedHandler,
  type WrapperOptions,
} from "./wrapper.js";
