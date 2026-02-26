/**
 * @ai-learning-hub/types
 *
 * Shared TypeScript types for all Lambda functions
 */

// Error types (ADR-008)
export {
  ErrorCode,
  ErrorCodeToStatus,
  AppError,
  type ApiErrorBody,
  type ApiErrorResponse,
} from "./errors.js";

// API types
export {
  type ApiSuccessResponse,
  type ApiResponseMeta,
  type EnvelopeMeta,
  type RateLimitMeta,
  type ResponseLinks,
  type ResponseEnvelope,
  type FieldValidationError,
  type PaginationParams,
  type PaginatedResponse,
  type AuthContext,
  type RequestContext,
  type IdempotencyRecord,
} from "./api.js";

// Entity types
export {
  type BaseEntity,
  type User,
  type Save,
  type SaveItem,
  type PublicSave,
  ContentType,
  TutorialStatus,
  type Project,
  ProjectStatus,
  type Folder,
  type Link,
  type Content,
  EnrichmentStatus,
  type ApiKey,
  type InviteCode,
  type VersionedEntity,
  INITIAL_VERSION,
  nextVersion,
} from "./entities.js";

// Event history types (Story 3.2.3)
export {
  type EventEntityType,
  type ActorType,
  type EventContext,
  type EventChanges,
  type EntityEvent,
  type PublicEntityEvent,
  type RecordEventParams,
  type EventHistoryQueryOptions,
  type EventHistoryResponse,
} from "./events.js";
