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
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  validateJsonBody,
  validateQueryParams,
  validatePathParams,
  paginationQuerySchema,
  z,
} from "@ai-learning-hub/validation";
import { createApiKeyBodySchema } from "./schemas.js";

/** Path parameter schema for DELETE /users/api-keys/:id and POST /users/api-keys/:id/revoke. */
const keyIdPathSchema = z.object({
  id: z.string().min(1, "API key ID is required").max(128),
});

/**
 * POST /users/api-keys — Create a new API key (AC4).
 * Story 3.2.8: Rate limiting via wrapHandler, idempotency, event recording.
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
 * GET /users/api-keys — List user's API keys (Story 3.2.5 AC10).
 * Returns envelope format: { data, meta: { cursor }, links: { self, next } }
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
  const selfQuery = new URLSearchParams(queryParams).toString();
  const self = `/users/api-keys?${selfQuery}`;

  let next: string | null = null;
  if (nextCursor) {
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("cursor", nextCursor);
    next = `/users/api-keys?${nextParams.toString()}`;
  }

  logger.info("API keys listed", { userId, count: result.items.length });
  return createSuccessResponse(result.items, requestId, {
    meta: { cursor: nextCursor },
    links: { self, next },
  });
}

/**
 * DELETE /users/api-keys/:id — Revoke an API key (legacy).
 * POST /users/api-keys/:id/revoke — Command endpoint for revocation (AC5).
 *
 * Story 3.2.8: Both endpoints use idempotency and event recording.
 * Returns 204 No Content on success. Re-revoking an already-revoked key
 * is idempotent and returns 204 (no error).
 */
async function handleRevoke(ctx: HandlerContext) {
  const { event, auth, logger, requestId, actorType, agentId } = ctx;
  const userId = auth!.userId;

  const { id: keyId } = validatePathParams(
    keyIdPathSchema,
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
 * Handler for POST /users/api-keys — create with idempotency and rate limiting.
 */
export const createHandler = wrapHandler(handleCreate, {
  requireAuth: true,
  requiredScope: "keys:manage",
  idempotent: true,
  rateLimit: apiKeyCreateRateLimit,
});

/**
 * Handler for GET /users/api-keys — list keys (read-only).
 */
export const listHandler = wrapHandler(handleList, {
  requireAuth: true,
  requiredScope: "keys:read",
});

/**
 * Handler for DELETE /users/api-keys/:id and POST /users/api-keys/:id/revoke.
 * Uses idempotency for safe retries.
 */
export const revokeHandler = wrapHandler(handleRevoke, {
  requireAuth: true,
  requiredScope: "keys:manage",
  idempotent: true,
});

/**
 * Route POST, GET, DELETE requests.
 * CDK wires each method separately for proper middleware options.
 */
async function apiKeysHandler(ctx: HandlerContext) {
  const method = ctx.event.httpMethod.toUpperCase();
  const path = ctx.event.path;

  // POST /users/api-keys/:id/revoke — command endpoint (AC5)
  if (method === "POST" && path.includes("/revoke")) {
    return handleRevoke(ctx);
  }

  switch (method) {
    case "POST":
      return handleCreate(ctx);
    case "GET":
      return handleList(ctx);
    case "DELETE":
      return handleRevoke(ctx);
    default:
      throw new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        `Method ${method} not allowed`,
        { responseHeaders: { Allow: "POST, GET, DELETE" } }
      );
  }
}

/**
 * Combined handler for backward compatibility.
 * In production, CDK wires specific handlers for proper middleware.
 */
export const handler = wrapHandler(apiKeysHandler, {
  requireAuth: true,
  requiredScope: "keys:manage",
});
