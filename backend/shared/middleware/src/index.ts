/**
 * @ai-learning-hub/middleware
 *
 * Lambda middleware for auth, error handling, and request context
 */

// Error handling & response envelope (Story 3.2.2)
export {
  createErrorResponse,
  normalizeError,
  handleError,
  createSuccessResponse,
  createNoContentResponse,
  type SuccessResponseOptions,
} from "./error-handler.js";

// Re-export envelope types used by SuccessResponseOptions (AC15)
export type {
  EnvelopeMeta,
  RateLimitMeta,
  ResponseLinks,
  ResponseEnvelope,
} from "@ai-learning-hub/types";

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

// Event history handler generator (Story 3.2.3)
export {
  createEventHistoryHandler,
  type EventHistoryHandlerConfig,
} from "./event-history.js";

// Agent identity middleware (Story 3.2.4)
export { extractAgentIdentity } from "./agent-identity.js";

// Re-export AgentIdentity type from types package (Story 3.2.4)
export type { AgentIdentity } from "@ai-learning-hub/types";

// Rate limit transparency (Story 3.2.4)
export {
  addRateLimitHeaders,
  buildRateLimitHeaders,
  buildRateLimitMeta,
  calculateRateLimitReset,
  type RateLimitMiddlewareConfig,
} from "./rate-limit-headers.js";

// Scope resolution (Story 3.2.6)
export {
  SCOPE_GRANTS,
  VALID_SCOPES,
  resolveScopeGrants,
  checkScopeAccess,
} from "./scope-resolver.js";

// Re-export scope types from types package (Story 3.2.6)
export type { ApiKeyScope, OperationScope } from "@ai-learning-hub/types";

// Action discoverability (Story 3.2.10)
export {
  ActionRegistry,
  getActionRegistry,
  resetActionRegistry,
} from "./action-registry.js";

export { buildResourceActions } from "./resource-actions.js";

export { registerInitialActions } from "./action-registrations.js";

// Re-export discoverability types from types package (Story 3.2.10)
export type {
  ActionDefinition,
  ResourceAction,
  StateGraph,
  StateTransition,
  HeaderDefinition,
  ParamDefinition,
  HttpMethod,
} from "@ai-learning-hub/types";

// Pagination link builder (Story 3.5.2)
export { buildPaginationLinks } from "./pagination.js";

// Authorizer constants (shared between handlers and CDK)
export { AUTHORIZER_CACHE_TTL } from "./authorizerConstants.js";

// SSM utilities
export { getClerkSecretKey, resetClerkSecretKeyCache } from "./ssm.js";
