/**
 * Standard API response types per ADR-008
 */

/**
 * Rate limit metadata for response envelope (AC11)
 */
export interface RateLimitMeta {
  limit: number;
  remaining: number;
  /** ISO 8601 datetime string per ADR-014 */
  reset: string;
}

/**
 * Response envelope metadata (AC11 — replaces deprecated ApiResponseMeta)
 */
export interface EnvelopeMeta {
  cursor?: string | null;
  total?: number;
  hasMore?: boolean;
  rateLimit?: RateLimitMeta;
}

/**
 * Response links for HATEOAS-lite (AC9)
 */
export interface ResponseLinks {
  self: string;
  next?: string | null;
}

/**
 * Standard response envelope (AC9)
 */
export interface ResponseEnvelope<T> {
  data: T;
  meta?: EnvelopeMeta;
  links?: ResponseLinks;
}

/**
 * Successful API response wrapper.
 * @deprecated Use ResponseEnvelope<T> instead, which includes `links` support.
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta?: EnvelopeMeta;
}

/**
 * Field-level validation error detail (AC14)
 * Canonical type for individual field validation errors in API responses.
 * Mirrors ValidationErrorDetail from @ai-learning-hub/validation.
 */
export interface FieldValidationError {
  field: string;
  message: string;
  code: string;
  constraint?: string;
  allowed_values?: string[];
}

/** @deprecated Use EnvelopeMeta instead */
export type ApiResponseMeta = EnvelopeMeta;

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

/**
 * Paginated response with cursor-based pagination
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Lambda handler context with authentication info
 */
export interface AuthContext {
  userId: string;
  roles: string[];
  isApiKey: boolean;
  apiKeyId?: string;
  scopes?: string[];
}

/**
 * Extended Lambda context with request correlation.
 * Intended for handler/future use (e.g. passing requestId, traceId, auth into business logic).
 * Middleware uses HandlerContext (event, context, logger, etc.); RequestContext is a slimmer type for downstream use.
 */
export interface RequestContext {
  requestId: string;
  traceId?: string;
  auth?: AuthContext;
  startTime: number;
}

/**
 * Idempotency record stored in DynamoDB (Story 3.2.1)
 */
export interface IdempotencyRecord {
  pk: string;
  userId: string;
  operationPath: string;
  statusCode: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  createdAt: string;
  expiresAt: number;
  oversized?: boolean;
}
