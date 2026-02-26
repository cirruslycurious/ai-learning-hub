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

  // Agent-native API errors (Story 3.2.1)
  VERSION_CONFLICT = "VERSION_CONFLICT",
  PRECONDITION_REQUIRED = "PRECONDITION_REQUIRED",
  IDEMPOTENCY_KEY_CONFLICT = "IDEMPOTENCY_KEY_CONFLICT",

  // Agent-native API errors (Story 3.2.2)
  INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION",

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
  [ErrorCode.VERSION_CONFLICT]: 409,
  [ErrorCode.PRECONDITION_REQUIRED]: 428,
  [ErrorCode.IDEMPOTENCY_KEY_CONFLICT]: 409,
  [ErrorCode.INVALID_STATE_TRANSITION]: 409,
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
   * Promotes currentState, allowedActions, requiredConditions from details to top-level (AC1, AC5)
   */
  toApiError(requestId: string): ApiErrorResponse {
    const promoted: Pick<
      ApiErrorBody,
      "currentState" | "allowedActions" | "requiredConditions"
    > = {};
    let remainingDetails: Record<string, unknown> | undefined;

    if (this.details) {
      const { currentState, allowedActions, requiredConditions, ...rest } =
        this.details;

      if (typeof currentState === "string")
        promoted.currentState = currentState;
      if (Array.isArray(allowedActions))
        promoted.allowedActions = allowedActions as string[];
      if (Array.isArray(requiredConditions))
        promoted.requiredConditions = requiredConditions as string[];

      remainingDetails = Object.keys(rest).length > 0 ? rest : undefined;
    }

    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
        ...(remainingDetails && { details: remainingDetails }),
        ...promoted,
      },
    };
  }

  /**
   * Fluent builder factory for enhanced errors (AC3)
   * Usage: AppError.build(ErrorCode.CONFLICT, "msg").withState("paused", ["resume"]).create()
   */
  static build(code: ErrorCode, message: string): AppErrorBuilder {
    return new AppErrorBuilder(code, message);
  }

  /**
   * Check if an error is an AppError
   */
  static isAppError(error: unknown): error is AppError {
    if (error instanceof AppError) return true;
    // Duck-type fallback for cross-module-boundary resilience (e.g. vitest
    // resolving separate copies of @ai-learning-hub/types for handler vs test)
    return (
      error instanceof Error &&
      error.name === "AppError" &&
      "code" in error &&
      "statusCode" in error
    );
  }
}

/**
 * Internal fluent builder for enhanced AppError instances (AC3).
 * Not exported — accessible only via AppError.build().
 */
class AppErrorBuilder {
  private readonly code: ErrorCode;
  private readonly message: string;
  private details: Record<string, unknown> = {};

  constructor(code: ErrorCode, message: string) {
    this.code = code;
    this.message = message;
  }

  withState(currentState: string, allowedActions: string[]): this {
    this.details.currentState = currentState;
    this.details.allowedActions = allowedActions;
    return this;
  }

  withConditions(conditions: string[]): this {
    this.details.requiredConditions = conditions;
    return this;
  }

  /**
   * Merge additional details into the error.
   * WARNING: This spreads over existing details. If called after withState() or
   * withConditions(), keys like `currentState`, `allowedActions`, or
   * `requiredConditions` in the provided details will overwrite the values set
   * by those methods. Call withDetails() before withState()/withConditions() to
   * avoid accidental overwrites.
   */
  withDetails(details: Record<string, unknown>): this {
    this.details = { ...this.details, ...details };
    return this;
  }

  create(): AppError {
    const hasDetails = Object.keys(this.details).length > 0;
    return new AppError(
      this.code,
      this.message,
      hasDetails ? this.details : undefined
    );
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
  currentState?: string;
  allowedActions?: string[];
  requiredConditions?: string[];
}

/**
 * API error response wrapper
 */
export interface ApiErrorResponse {
  error: ApiErrorBody;
}
