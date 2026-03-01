/**
 * Standard API response types per ADR-008
 */
import type { ActorType } from "./events.js";
import type { ErrorCode } from "./errors.js";

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
  cursorReset?: boolean;
  truncated?: boolean;
  rateLimit?: RateLimitMeta;
  /** Available actions for this resource (Story 3.2.10, AC8) */
  actions?: ResourceAction[];
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
 * Generic cursor payload wrapper (Story 3.2.5)
 */
export type CursorPayload = Record<string, unknown>;

/**
 * Pagination request parameters (Story 3.2.5)
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

/** @deprecated Use PaginationOptions instead */
export type PaginationParams = PaginationOptions;

/**
 * Paginated response with cursor-based pagination (Story 3.2.5)
 * cursor replaces nextCursor; hasMore removed (implied by cursor nullness per FR105)
 */
export interface PaginatedResponse<T> {
  items: T[];
  cursor?: string;
}

/**
 * Named API key permission tiers (Story 3.2.6, AC15).
 * Includes legacy values `*` and `saves:read` for backward compatibility.
 */
export type ApiKeyScope =
  | "full"
  | "capture"
  | "read"
  | "saves:write"
  | "projects:write"
  | "*"
  | "saves:read";

/**
 * Granular operation permissions required by handlers (Story 3.2.6, AC16).
 * Handlers declare their `requiredScope` using these values.
 * Tier-to-operation mapping is in `@ai-learning-hub/middleware` scope-resolver.
 */
export type OperationScope =
  | "saves:read"
  | "saves:write"
  | "saves:create"
  | "projects:read"
  | "projects:write"
  | "links:read"
  | "links:write"
  | "users:read"
  | "users:write"
  | "keys:read"
  | "keys:manage"
  | "invites:manage"
  | "*";

/**
 * Lambda handler context with authentication info
 */
export interface AuthContext {
  userId: string;
  roles: string[];
  isApiKey: boolean;
  apiKeyId?: string;
  scopes?: ApiKeyScope[];
}

/**
 * Rate limit middleware configuration for wrapHandler (Story 3.2.4, AC9).
 * Defined in types to avoid circular dependency between db ↔ middleware.
 */
export interface RateLimitMiddlewareConfig {
  /** Rate limit counter key (e.g., "saves-write") */
  operation: string;
  /** Window size in seconds */
  windowSeconds: number;
  /** Static limit or function receiving auth context for tier-based limits */
  limit: number | ((auth: AuthContext | null) => number);
  /** Identifier source: userId (default) or sourceIp */
  identifierSource?: "userId" | "sourceIp";
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
 * Agent identity extracted from X-Agent-ID header (Story 3.2.4)
 */
export interface AgentIdentity {
  agentId: string | null;
  actorType: ActorType;
}

// ── Action Discoverability Types (Story 3.2.10) ──────────────────────

/**
 * HTTP header required by an action (Story 3.2.10, AC2).
 * Provides name, expected format pattern, and description so agents
 * can construct valid requests without consulting documentation.
 */
export interface HeaderDefinition {
  name: string;
  format: string;
  description: string;
}

/**
 * Path or query parameter definition for an action (Story 3.2.10, AC2).
 */
export interface ParamDefinition {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

/**
 * HTTP method type for action definitions.
 */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

/**
 * Full action definition in the global action catalog (Story 3.2.10, AC2).
 * Registered declaratively via ActionRegistry — not hardcoded per handler.
 */
export interface ActionDefinition {
  actionId: string;
  description: string;
  method: HttpMethod;
  urlPattern: string;
  entityType: string;
  pathParams: ParamDefinition[];
  queryParams: ParamDefinition[];
  inputSchema: Record<string, unknown> | null;
  requiredHeaders: HeaderDefinition[];
  requiredScope: OperationScope;
  expectedErrors: ErrorCode[];
}

/**
 * Lightweight action reference for single-resource GET responses (Story 3.2.10, AC9).
 * Full details available in the global catalog via actionId.
 */
export interface ResourceAction {
  actionId: string;
  url: string;
  method: HttpMethod;
  requiredHeaders: string[];
}

/**
 * State machine transition definition (Story 3.2.10, AC15).
 */
export interface StateTransition {
  from: string;
  to: string;
  command: string;
  preconditions: string[];
}

/**
 * Full state machine graph for an entity type (Story 3.2.10, AC15).
 */
export interface StateGraph {
  entityType: string;
  states: string[];
  initialState: string;
  terminalStates: string[];
  transitions: StateTransition[];
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
