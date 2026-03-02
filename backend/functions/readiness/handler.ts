/**
 * Readiness Probe Endpoint — GET /ready
 *
 * Checks downstream dependency connectivity (DynamoDB data-plane).
 * Returns 200 when healthy, 503 when degraded. No auth required.
 * Results cached in-memory for 10 seconds to avoid hammering DynamoDB.
 *
 * Story 3.2.9, AC3-AC5.
 */
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { getDefaultClient, getItem } from "@ai-learning-hub/db";
import type { ReadinessStatus } from "@ai-learning-hub/types";

// Module-scoped cache for DynamoDB check result
let cachedCheck: {
  result: "ok" | "unhealthy";
  expiresAt: number;
} | null = null;
const CACHE_TTL_MS = 10_000; // 10 seconds

const USERS_TABLE_CONFIG = {
  tableName: process.env.USERS_TABLE_NAME ?? "users",
  partitionKey: "PK",
  sortKey: "SK",
};

/**
 * Check DynamoDB data-plane connectivity via GetItem on non-existent key.
 * Verifies connectivity, IAM permissions, and table availability.
 * A miss costs 0 read capacity units.
 */
async function checkDynamoDB(): Promise<"ok" | "unhealthy"> {
  if (cachedCheck && Date.now() < cachedCheck.expiresAt) {
    return cachedCheck.result;
  }

  const client = getDefaultClient();

  let timeoutId: NodeJS.Timeout;
  try {
    // Race getItem against a 3s timeout to prevent slow probes
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("DynamoDB probe timeout")),
        3000
      );
    });
    await Promise.race([
      getItem(client, USERS_TABLE_CONFIG, { PK: "HEALTHCHECK", SK: "PROBE" }),
      timeoutPromise,
    ]);
    clearTimeout(timeoutId!);
    cachedCheck = { result: "ok", expiresAt: Date.now() + CACHE_TTL_MS };
    return "ok";
  } catch {
    clearTimeout(timeoutId!);
    cachedCheck = {
      result: "unhealthy",
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return "unhealthy";
  }
}

async function readinessHandler(ctx: HandlerContext) {
  const { requestId } = ctx;

  const dynamoStatus = await checkDynamoDB();
  const ready = dynamoStatus === "ok";

  const data: ReadinessStatus = {
    ready,
    timestamp: new Date().toISOString(),
    dependencies: { dynamodb: dynamoStatus },
  };

  return createSuccessResponse(data, requestId, {
    statusCode: ready ? 200 : 503,
    links: { self: "/ready" },
  });
}

export const handler = wrapHandler(readinessHandler, {
  requireAuth: false,
});

/**
 * Reset cache for testing purposes only.
 */
export function _resetCacheForTesting(): void {
  cachedCheck = null;
}
