/**
 * Rate limiting with DynamoDB counters (Story 2.7).
 *
 * Uses hourly-partitioned counter items with TTL for automatic cleanup.
 * Counter items: PK=RATELIMIT#<scope>#<identifier>, SK=<windowKey>
 *
 * Design: Fixed-window counters with 1-hour granularity. Each counter
 * item has a TTL set to 2 hours after the window start, ensuring
 * DynamoDB automatically deletes expired counters.
 */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";

/**
 * Rate limit configuration for a specific operation.
 */
export interface RateLimitConfig {
  /** Operation identifier (e.g., "apikey-create", "invite-validate") */
  operation: string;
  /** Unique identifier for the subject (userId, IP address, etc.) */
  identifier: string;
  /** Maximum allowed requests in the time window */
  limit: number;
  /** Window size in seconds (e.g., 3600 for 1 hour) */
  windowSeconds: number;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  retryAfterSeconds?: number;
}

/**
 * Get the window key for the current time period.
 * Uses fixed windows aligned to hour boundaries.
 */
export function getWindowKey(windowSeconds: number, now?: Date): string {
  const timestamp = now ?? new Date();
  const epochSeconds = Math.floor(timestamp.getTime() / 1000);
  const windowStart = epochSeconds - (epochSeconds % windowSeconds);
  return String(windowStart);
}

/**
 * Calculate TTL for a rate limit counter item.
 * Set to 2x the window size to ensure cleanup after expiry.
 */
export function getCounterTTL(windowSeconds: number, now?: Date): number {
  const timestamp = now ?? new Date();
  const epochSeconds = Math.floor(timestamp.getTime() / 1000);
  const windowStart = epochSeconds - (epochSeconds % windowSeconds);
  return windowStart + windowSeconds * 2;
}

/**
 * Increment and check a rate limit counter using DynamoDB atomic update.
 *
 * Uses UpdateItem with ADD to atomically increment the counter.
 * Returns the new count so the caller can check against the limit.
 *
 * The counter item has:
 * - PK: RATELIMIT#<operation>#<identifier>
 * - SK: <windowKey>
 * - count: atomic counter
 * - ttl: epoch seconds for DynamoDB TTL
 */
// NOTE: The counter is incremented unconditionally before checking the limit.
// This means the counter may exceed the configured limit (e.g., showing 15 when
// the limit is 10) because rejected requests still increment it. This is by
// design for simplicity — the limit check still works correctly, and the counter
// resets naturally when the window expires. The inflated count may appear in logs
// and error responses but does not affect correctness.
export async function incrementAndCheckRateLimit(
  client: DynamoDBDocumentClient,
  tableName: string,
  config: RateLimitConfig,
  logger?: Logger
): Promise<RateLimitResult> {
  const log = logger ?? createLogger();
  const now = new Date();
  const windowKey = getWindowKey(config.windowSeconds, now);
  const ttl = getCounterTTL(config.windowSeconds, now);

  const pk = `RATELIMIT#${config.operation}#${config.identifier}`;

  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: windowKey },
        UpdateExpression:
          "ADD #count :inc SET #ttl = if_not_exists(#ttl, :ttl)",
        ExpressionAttributeNames: {
          "#count": "count",
          "#ttl": "ttl",
        },
        ExpressionAttributeValues: {
          ":inc": 1,
          ":ttl": ttl,
        },
        ReturnValues: "ALL_NEW",
      })
    );

    const current = (result.Attributes?.count as number) ?? 1;
    const allowed = current <= config.limit;

    if (!allowed) {
      // Calculate seconds remaining in this window for Retry-After
      const epochSeconds = Math.floor(now.getTime() / 1000);
      const windowStart = epochSeconds - (epochSeconds % config.windowSeconds);
      const retryAfterSeconds =
        windowStart + config.windowSeconds - epochSeconds;

      log.warn("Rate limit exceeded", {
        operation: config.operation,
        identifier: config.identifier,
        current,
        limit: config.limit,
        retryAfterSeconds,
      });

      return {
        allowed: false,
        current,
        limit: config.limit,
        retryAfterSeconds,
      };
    }

    log.debug("Rate limit check passed", {
      operation: config.operation,
      current,
      limit: config.limit,
    });

    return { allowed: true, current, limit: config.limit };
  } catch (error) {
    // On DynamoDB errors, fail open — don't block requests due to rate limit infra issues
    log.error("Rate limit check failed, allowing request", error as Error, {
      operation: config.operation,
      identifier: config.identifier,
    });
    return { allowed: true, current: 0, limit: config.limit };
  }
}

/**
 * Check rate limit and throw RATE_LIMITED error if exceeded.
 * Convenience wrapper around incrementAndCheckRateLimit.
 */
export async function enforceRateLimit(
  client: DynamoDBDocumentClient,
  tableName: string,
  config: RateLimitConfig,
  logger?: Logger
): Promise<void> {
  const result = await incrementAndCheckRateLimit(
    client,
    tableName,
    config,
    logger
  );

  if (!result.allowed) {
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      `Rate limit exceeded: ${config.limit} ${config.operation} per ${config.windowSeconds / 3600} hour(s)`,
      {
        retryAfter: result.retryAfterSeconds,
        limit: result.limit,
        current: result.current,
      }
    );
  }
}
