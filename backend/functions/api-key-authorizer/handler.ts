/**
 * API Key Authorizer Lambda for API Gateway (REQUEST type).
 *
 * Validates API keys via SHA-256 hash lookup on apiKeyHash-index GSI,
 * fetches the user profile, and checks suspension status.
 *
 * Per ADR-013: API Key Authentication Path (Story 2.2).
 */
import type {
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult,
  Context,
} from "aws-lambda";
import { createHash } from "crypto";
import {
  getDefaultClient,
  getApiKeyByHash,
  getProfile,
  updateApiKeyLastUsed,
} from "@ai-learning-hub/db";
import { createLogger } from "@ai-learning-hub/logging";
import { generatePolicy, deny } from "@ai-learning-hub/middleware";

/**
 * Authorizer cache TTL in seconds.
 * This value will be consumed by the CDK ApiStack when configuring the
 * API Gateway RequestAuthorizer's resultsCacheTtl.
 * TODO: Wire into API Gateway RequestAuthorizer in the API story.
 */
export const AUTHORIZER_CACHE_TTL = 300;

function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function handler(
  event: APIGatewayRequestAuthorizerEvent,
  _context: Context
): Promise<APIGatewayAuthorizerResult> {
  const logger = createLogger();

  // Extract API key from x-api-key header (case-insensitive per RFC 7230).
  // API Gateway REQUEST authorizers preserve the original header casing from
  // the client, so we must handle all variations (x-api-key, X-Api-Key,
  // X-API-Key, X-API-KEY, etc.).
  const headerKey = Object.keys(event.headers || {}).find(
    (k) => k.toLowerCase() === "x-api-key"
  );
  const apiKey = headerKey ? event.headers?.[headerKey] : undefined;

  if (!apiKey) {
    logger.warn("Missing x-api-key header");
    throw new Error("Unauthorized");
  }

  try {
    // AC1: Hash the API key with SHA-256 and query the GSI
    const keyHash = hashApiKey(apiKey);
    const client = getDefaultClient();

    const apiKeyItem = await getApiKeyByHash(client, keyHash, logger);

    // AC5: Key not found → throw Unauthorized
    if (!apiKeyItem) {
      logger.warn("API key not found");
      throw new Error("Unauthorized");
    }

    // AC5: Key revoked → throw Unauthorized
    if (apiKeyItem.revokedAt) {
      logger.warn("Revoked API key used", { keyId: apiKeyItem.keyId });
      throw new Error("Unauthorized");
    }

    // AC2: Fetch PROFILE and check suspension
    const profile = await getProfile(client, apiKeyItem.userId, logger);

    if (!profile) {
      logger.error(
        "Profile not found for API key owner",
        new Error("Profile inconsistency")
      );
      throw new Error("Unauthorized");
    }

    // AC4: Suspended account → Deny
    if (profile.suspendedAt) {
      logger.warn("Suspended account API key access attempt", {
        userId: apiKeyItem.userId,
      });
      return deny(apiKeyItem.userId, "SUSPENDED_ACCOUNT");
    }

    // AC6: Fire-and-forget updateApiKeyLastUsed (non-blocking).
    // INTENTIONAL: Per AC6, lastUsedAt tracking is explicitly fire-and-forget
    // and non-blocking. In AWS Lambda, background promises may not complete if
    // the execution context freezes after the handler returns. This means
    // lastUsedAt is best-effort — it will update in most cases (warm invocations)
    // but may be dropped under cold-start or high-concurrency scenarios.
    // This trade-off is accepted to avoid adding latency to the authorizer
    // critical path. For guaranteed tracking, consider EventBridge in a future story.
    updateApiKeyLastUsed(
      client,
      apiKeyItem.userId,
      apiKeyItem.keyId,
      logger
    ).catch((err) => {
      logger.warn("Failed to update API key lastUsedAt", {
        keyId: apiKeyItem.keyId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // AC3: Return Allow with context
    // Defensive fallback: profile.role is required and ensureProfile defaults to "user",
    // but we guard against data inconsistency in case of manual DB edits.
    const role = profile.role || "user";

    logger.info("API key auth successful", {
      userId: apiKeyItem.userId,
      keyId: apiKeyItem.keyId,
      role,
    });

    return {
      principalId: apiKeyItem.userId,
      policyDocument: generatePolicy("Allow"),
      context: {
        userId: apiKeyItem.userId,
        role,
        authMethod: "api-key",
        isApiKey: "true",
        apiKeyId: apiKeyItem.keyId,
        scopes: JSON.stringify(apiKeyItem.scopes),
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message !== "Unauthorized") {
      logger.error("API key verification failed", err);
    }
    throw new Error("Unauthorized");
  }
}
