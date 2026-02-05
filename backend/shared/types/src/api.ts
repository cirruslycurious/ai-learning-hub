/**
 * Standard API response types per ADR-008
 */

/**
 * Successful API response wrapper
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta?: ApiResponseMeta;
}

/**
 * Response metadata for pagination and additional info
 */
export interface ApiResponseMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  nextCursor?: string;
  prevCursor?: string;
}

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
 * Extended Lambda context with request correlation
 */
export interface RequestContext {
  requestId: string;
  traceId?: string;
  auth?: AuthContext;
  startTime: number;
}
