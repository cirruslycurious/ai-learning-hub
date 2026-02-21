/**
 * Standardized error codes per ADR-008
 */
export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  DUPLICATE_SAVE = "DUPLICATE_SAVE",
  RATE_LIMITED = "RATE_LIMITED",
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",

  // Auth-specific errors (ADR-013, Story 2.8)
  EXPIRED_TOKEN = "EXPIRED_TOKEN",
  INVALID_API_KEY = "INVALID_API_KEY",
  REVOKED_API_KEY = "REVOKED_API_KEY",
  SUSPENDED_ACCOUNT = "SUSPENDED_ACCOUNT",
  SCOPE_INSUFFICIENT = "SCOPE_INSUFFICIENT",
  INVITE_REQUIRED = "INVITE_REQUIRED",
  INVALID_INVITE_CODE = "INVALID_INVITE_CODE",

  // Server errors (5xx)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}

/**
 * HTTP status codes mapped to error codes
 */
export const ErrorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_SAVE]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.EXPIRED_TOKEN]: 401,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.REVOKED_API_KEY]: 401,
  [ErrorCode.SUSPENDED_ACCOUNT]: 403,
  [ErrorCode.SCOPE_INSUFFICIENT]: 403,
  [ErrorCode.INVITE_REQUIRED]: 403,
  [ErrorCode.INVALID_INVITE_CODE]: 400,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
};

/**
 * Application error class with structured error information
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = ErrorCodeToStatus[code];
    this.details = details;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert to API error response shape per ADR-008
   */
  toApiError(requestId: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
        ...(this.details && { details: this.details }),
      },
    };
  }

  /**
   * Check if an error is an AppError
   */
  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }
}

/**
 * API error response body per ADR-008
 */
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

/**
 * API error response wrapper
 */
export interface ApiErrorResponse {
  error: ApiErrorBody;
}
