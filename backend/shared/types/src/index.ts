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
  type PaginationParams,
  type PaginatedResponse,
  type AuthContext,
  type RequestContext,
} from "./api.js";

// Entity types
export {
  type BaseEntity,
  type User,
  type Save,
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
} from "./entities.js";
