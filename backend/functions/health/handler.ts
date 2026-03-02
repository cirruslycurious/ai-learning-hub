/**
 * Health Check Endpoint — GET /health
 *
 * Returns service availability. No auth required. No downstream dependency checks.
 * Confirms the Lambda is reachable and API Gateway is routing correctly.
 *
 * Story 3.2.9, AC1-AC2.
 */
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import type { HealthStatus } from "@ai-learning-hub/types";

async function healthHandler(ctx: HandlerContext) {
  const { requestId } = ctx;

  const data: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };

  return createSuccessResponse(data, requestId, {
    links: { self: "/health" },
  });
}

export const handler = wrapHandler(healthHandler, {
  requireAuth: false,
});
