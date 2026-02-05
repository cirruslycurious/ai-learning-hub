/**
 * Structured logger with X-Ray integration per ADR-008
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log context with correlation IDs
 */
export interface LogContext {
  requestId?: string;
  traceId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Structured log entry format per ADR-008
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  traceId?: string;
  userId?: string;
  durationMs?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  data?: Record<string, unknown>;
}

/**
 * Patterns to redact from logs (API keys, secrets, etc.)
 */
const REDACTION_PATTERNS: RegExp[] = [
  // API keys (common formats)
  /\b(api[_-]?key|apikey|api_secret)[=:]\s*["']?[\w-]{20,}["']?/gi,
  // Bearer tokens
  /\b(bearer\s+)[\w-_.]+/gi,
  // AWS keys
  /\b(AKIA[A-Z0-9]{16})\b/g,
  // Generic secrets
  /\b(secret|password|token|credential)[=:]\s*["']?[^\s"']{8,}["']?/gi,
];

/**
 * Redact sensitive data from a string
 */
function redactSensitive(value: string): string {
  let result = value;
  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/**
 * Recursively redact sensitive data from an object
 */
function redactObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return redactSensitive(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Redact values for sensitive keys
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key") ||
        lowerKey.includes("authorization") ||
        lowerKey.includes("credential")
      ) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactObject(value);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Get X-Ray trace ID from environment
 */
function getTraceId(): string | undefined {
  const traceHeader = process.env._X_AMZN_TRACE_ID;
  if (!traceHeader) return undefined;

  // Extract Root trace ID from header: "Root=1-abc-def;Parent=xyz;Sampled=1"
  const match = /Root=([^;]+)/.exec(traceHeader);
  return match?.[1];
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger class with structured JSON output
 */
export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext = {}, minLevel: LogLevel = "info") {
    this.context = context;
    this.minLevel = minLevel;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext }, this.minLevel);
  }

  /**
   * Set the request context (typically called at start of request)
   */
  setRequestContext(context: {
    requestId?: string;
    userId?: string;
    traceId?: string;
  }): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Core logging method. entryOverrides (e.g. durationMs) are set at top level on the log entry.
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error,
    entryOverrides?: Pick<LogEntry, "durationMs">
  ): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      requestId: this.context.requestId as string | undefined,
      traceId: this.context.traceId ?? getTraceId(),
      userId: this.context.userId as string | undefined,
    };

    // Add optional action/entity fields from context
    if (this.context.action) entry.action = this.context.action as string;
    if (this.context.entityType)
      entry.entityType = this.context.entityType as string;
    if (this.context.entityId) entry.entityId = this.context.entityId as string;
    if (this.context.durationMs)
      entry.durationMs = this.context.durationMs as number;
    if (entryOverrides?.durationMs !== undefined)
      entry.durationMs = entryOverrides.durationMs;

    // Add additional data (redacted)
    if (data) {
      entry.data = redactObject(data) as Record<string, unknown>;
    }

    // Add error information
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Output as JSON to stdout/stderr
    const output = JSON.stringify(entry);
    if (level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log("error", message, data, error);
  }

  /**
   * Log with timing information (useful for performance tracking).
   * Sets durationMs at top level on the log entry and in data for compatibility.
   */
  timed(
    message: string,
    startTime: number,
    data?: Record<string, unknown>
  ): void {
    const durationMs = Date.now() - startTime;
    this.log("info", message, { ...data, durationMs }, undefined, {
      durationMs,
    });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(
  context: LogContext = {},
  minLevel: LogLevel = "info"
): Logger {
  return new Logger(context, minLevel);
}

/**
 * Default logger instance
 */
export const logger = createLogger();
