/**
 * API Keys Endpoint — POST/GET/DELETE /users/api-keys
 *
 * Creates, lists, and revokes API keys.
 *
 * Per Story 2.6: API Key CRUD (Epic 2).
 */
import {
  getDefaultClient,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  enforceRateLimit,
  USERS_TABLE_CONFIG,
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

/** Path parameter schema for DELETE /users/api-keys/:id. */
const deletePathSchema = z.object({
  id: z.string().min(1, "API key ID is required").max(128),
});

/**
 * POST /users/api-keys — Create a new API key (AC1, AC4, AC5).
 *
 * Rate limit: 10 key generations per user per hour (Story 2.7, AC4).
 */
async function handlePost(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const { name, scopes } = validateJsonBody(createApiKeyBodySchema, event.body);

  const client = getDefaultClient();

  // Enforce rate limit: 10 key creations per user per hour (AC4)
  await enforceRateLimit(
    client,
    USERS_TABLE_CONFIG.tableName,
    {
      operation: "apikey-create",
      identifier: userId,
      limit: 10,
      windowSeconds: 3600,
    },
    logger
  );

  const result = await createApiKey(client, userId, name, scopes, logger);

  logger.info("API key created", { userId, keyId: result.id });
  return createSuccessResponse(result, requestId, { statusCode: 201 });
}

/**
 * GET /users/api-keys — List user's API keys (AC2, Story 3.2.5 AC10).
 * Returns envelope format: { data, meta: { cursor }, links: { self, next } }
 */
async function handleGet(ctx: HandlerContext) {
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
 * DELETE /users/api-keys/:id — Revoke an API key (AC3).
 *
 * Returns 204 No Content on success. If the key does not exist or is
 * already revoked, the DB layer throws NOT_FOUND (DynamoDB condition
 * check fails). This is intentional idempotent-revocation semantics:
 * re-revoking a key is treated the same as revoking a nonexistent key.
 */
async function handleDelete(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const { id: keyId } = validatePathParams(
    deletePathSchema,
    event.pathParameters
  );

  const client = getDefaultClient();
  await revokeApiKey(client, userId, keyId, logger);

  logger.info("API key revoked", { userId, keyId });
  return createNoContentResponse(requestId);
}

/**
 * Route POST, GET, DELETE requests.
 */
async function apiKeysHandler(ctx: HandlerContext) {
  const method = ctx.event.httpMethod.toUpperCase();

  switch (method) {
    case "POST":
      return handlePost(ctx);
    case "GET":
      return handleGet(ctx);
    case "DELETE":
      return handleDelete(ctx);
    default:
      throw new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        `Method ${method} not allowed`,
        { responseHeaders: { Allow: "POST, GET, DELETE" } }
      );
  }
}

export const handler = wrapHandler(apiKeysHandler, {
  requireAuth: true,
  requiredScope: "keys:manage",
});
