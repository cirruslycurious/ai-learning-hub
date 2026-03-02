/**
 * Rate limit transparency headers (Story 3.2.4, ADR-014)
 *
 * Utilities for adding X-RateLimit-* headers to API responses.
 * Headers follow industry standard (GitHub, Stripe, Twitter):
 * - X-RateLimit-Limit: ceiling for current window
 * - X-RateLimit-Remaining: requests remaining (min 0)
 * - X-RateLimit-Reset: Unix epoch seconds for window reset
 */
import type { APIGatewayProxyResult } from "aws-lambda";
import type { RateLimitResult } from "@ai-learning-hub/db";

// Re-export from types so existing consumers of middleware don't break
export type { RateLimitMiddlewareConfig } from "@ai-learning-hub/types";

/**
 * Calculate the Unix epoch seconds for the end of the current rate limit window.
 * Uses fixed-window strategy aligned to window boundaries.
 */
export function calculateRateLimitReset(windowSeconds: number): number {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  // When exactly on a boundary, advance to next window so reset is always in the future
  const windowEnd =
    now % windowMs === 0
      ? now + windowMs
      : Math.ceil(now / windowMs) * windowMs;
  return Math.floor(windowEnd / 1000);
}

/**
 * Build rate limit HTTP headers from a RateLimitResult.
 * Returns Record<string, string> for merging into response headers.
 */
export function buildRateLimitHeaders(
  result: RateLimitResult,
  windowSeconds: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.limit - result.current)),
    "X-RateLimit-Reset": String(calculateRateLimitReset(windowSeconds)),
  };
  if (result.retryAfterSeconds != null) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return headers;
}

/**
 * Add rate limit headers to an existing API Gateway response.
 * Merges with existing headers without clobbering.
 */
export function addRateLimitHeaders(
  response: APIGatewayProxyResult,
  result: RateLimitResult,
  windowSeconds: number
): APIGatewayProxyResult {
  const rlHeaders = buildRateLimitHeaders(result, windowSeconds);
  return {
    ...response,
    headers: {
      ...(response.headers ?? {}),
      ...rlHeaders,
    },
  };
}

/**
 * Build rate limit metadata for JSON response body (EnvelopeMeta.rateLimit).
 * Note: `reset` is ISO 8601 string per ADR-014 (different from Unix epoch header).
 */
export function buildRateLimitMeta(
  result: RateLimitResult,
  windowSeconds: number
): { limit: number; remaining: number; reset: string } {
  const resetEpoch = calculateRateLimitReset(windowSeconds);
  return {
    limit: result.limit,
    remaining: Math.max(0, result.limit - result.current),
    reset: new Date(resetEpoch * 1000).toISOString(),
  };
}
