/**
 * API Keys Endpoint — POST/GET/DELETE /users/api-keys
 *
 * Creates, lists, and revokes API keys.
 *
 * Per Story 2.6: API Key CRUD (Epic 2).
 * Story 3.2.8: Retrofitted with idempotency, rate limiting via wrapHandler,
 *              event recording, and command endpoint for revocation.
 */
import {
  getDefaultClient,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  recordEvent,
  apiKeyCreateRateLimit,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
  createNoContentResponse,
  buildPaginationLinks,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  validateJsonBody,
  validateQueryParams,
  validatePathParams,
  paginationQuerySchema,
  apiKeyIdPathSchema,
} from "@ai-learning-hub/validation";
import { createApiKeyBodySchema } from "./schemas.js";

/**
 * POST /users/api-keys — Create a new API key.
 * CDK wires this via createApiKeyFunction with idempotency and rate limiting.
 */
async function handleCreate(ctx: HandlerContext) {
  const { event, auth, logger, requestId, actorType, agentId } = ctx;
  const userId = auth!.userId;

  // Validate request body (includes optional context field)
  const { name, scopes, context } = validateJsonBody(
    createApiKeyBodySchema,
    event.body
  );

  const client = getDefaultClient();

  const result = await createApiKey(client, userId, name, scopes, logger);

  // Event recording (AC16) — fire-and-forget
  await recordEvent(
    client,
    {
      entityType: "apiKey",
      entityId: result.id,
      userId,
      eventType: "ApiKeyCreated",
      actorType,
      actorId: agentId ?? undefined,
      changes: {
        after: {
          name,
          scopes,
        },
      },
      context: context ?? undefined,
      requestId,
    },
    logger
  );

  logger.info("API key created", { userId, keyId: result.id });
  return createSuccessResponse(result, requestId, { statusCode: 201 });
}

/**
 * GET /users/api-keys — List user's API keys.
 * CDK wires this via listApiKeyFunction (read-only, no idempotency).
 */
async function handleList(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const { limit, cursor } = validateQueryParams(
    paginationQuerySchema,
    event.queryStringParameters
  );

  const client = getDefaultClient();
  const result = await listApiKeys(client, userId, limit, cursor, logger);

  const nextCursor = result.cursor ?? null;
  const queryParams: Record<string, string> = { limit: String(limit) };
  const links = buildPaginationLinks(
    "/users/api-keys",
    queryParams,
    nextCursor
  );

  logger.info("API keys listed", { userId, count: result.items.length });
  return createSuccessResponse(result.items, requestId, {
    meta: { cursor: nextCursor },
    links,
  });
}

/**
 * DELETE /users/api-keys/:id and POST /users/api-keys/:id/revoke.
 * CDK wires both routes to revokeApiKeyFunction with idempotency.
 * Returns 204 No Content on success. Re-revoking is idempotent (204).
 */
async function handleRevoke(ctx: HandlerContext) {
  const { event, auth, logger, requestId, actorType, agentId } = ctx;
  const userId = auth!.userId;

  const { id: keyId } = validatePathParams(
    apiKeyIdPathSchema,
    event.pathParameters
  );

  const client = getDefaultClient();

  try {
    await revokeApiKey(client, userId, keyId, logger);

    // Event recording (AC16) — fire-and-forget
    await recordEvent(
      client,
      {
        entityType: "apiKey",
        entityId: keyId,
        userId,
        eventType: "ApiKeyRevoked",
        actorType,
        actorId: agentId ?? undefined,
        requestId,
      },
      logger
    );

    logger.info("API key revoked", { userId, keyId });
  } catch (error) {
    // NOT_FOUND from revokeApiKey means either:
    // 1. Key doesn't exist — should return 404
    // 2. Key already revoked — idempotent success (204)
    // The DB layer condition check fails for both cases, so we treat it as idempotent.
    // Per AC6: re-revoking should be idempotent.
    if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
      logger.info("API key revoke idempotent (already revoked or not found)", {
        userId,
        keyId,
      });
      // Return 204 for idempotent revocation
    } else {
      throw error;
    }
  }

  return createNoContentResponse(requestId);
}

/**
 * POST /users/api-keys — create with idempotency and rate limiting.
 * CDK wires this as createApiKeyFunction (handler: "createHandler").
 */
export const createHandler = wrapHandler(handleCreate, {
  requireAuth: true,
  requiredScope: "keys:manage",
  idempotent: true,
  rateLimit: apiKeyCreateRateLimit,
  secondaryRateLimit: {
    operation: "api-key-create-ip",
    windowSeconds: 3600,
    limit: 10,
    identifierSource: "sourceIp",
  },
});

/**
 * GET /users/api-keys — list keys (read-only).
 * CDK wires this as listApiKeyFunction (handler: "listHandler").
 */
export const listHandler = wrapHandler(handleList, {
  requireAuth: true,
  requiredScope: "keys:read",
});

/**
 * Handler for DELETE /users/api-keys/:id and POST /users/api-keys/:id/revoke.
 * CDK wires this via revokeApiKeyFunction. Uses idempotency for safe retries.
 */
export const revokeHandler = wrapHandler(handleRevoke, {
  requireAuth: true,
  requiredScope: "keys:manage",
  idempotent: true,
});
