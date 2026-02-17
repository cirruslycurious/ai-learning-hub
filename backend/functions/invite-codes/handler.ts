/**
 * Invite Codes Endpoint — POST/GET /users/invite-codes
 *
 * Generates and lists invite codes for authenticated users.
 *
 * Per Story 2.9: Invite Code Generation (Epic 2).
 */
import {
  getDefaultClient,
  createInviteCode,
  listInviteCodesByUser,
  toPublicInviteCode,
  enforceRateLimit,
  USERS_TABLE_CONFIG,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { validateQueryParams } from "@ai-learning-hub/validation";
import { paginationQuerySchema } from "./schemas.js";

/**
 * POST /users/invite-codes — Generate a new invite code (AC1, AC2, AC4, AC5).
 *
 * Rate limit: 5 codes per user per day (AC5).
 */
async function handlePost(ctx: HandlerContext) {
  const { auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const client = getDefaultClient();

  // Enforce rate limit: 5 invite code generations per user per day (AC5)
  await enforceRateLimit(
    client,
    USERS_TABLE_CONFIG.tableName,
    {
      operation: "invite-generate",
      identifier: userId,
      limit: 5,
      windowSeconds: 86400,
    },
    logger
  );

  const result = await createInviteCode(client, userId, undefined, logger);

  logger.info("Invite code generated", { userId });
  return createSuccessResponse(result, requestId, 201);
}

/**
 * GET /users/invite-codes — List user's generated invite codes (AC3, AC7).
 */
async function handleGet(ctx: HandlerContext) {
  const { event, auth, logger } = ctx;
  const userId = auth!.userId;

  const { limit, cursor } = validateQueryParams(
    paginationQuerySchema,
    event.queryStringParameters
  );

  const client = getDefaultClient();
  const result = await listInviteCodesByUser(
    client,
    userId,
    limit,
    cursor,
    logger
  );

  const publicItems = result.items.map(toPublicInviteCode);

  logger.info("Invite codes listed", { userId, count: publicItems.length });
  return {
    items: publicItems,
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
  };
}

/**
 * Route POST and GET requests.
 */
async function inviteCodesHandler(ctx: HandlerContext) {
  const method = ctx.event.httpMethod.toUpperCase();

  switch (method) {
    case "POST":
      return handlePost(ctx);
    case "GET":
      return handleGet(ctx);
    default:
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
          Allow: "POST, GET",
        },
        body: JSON.stringify({
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: `Method ${method} not allowed`,
            requestId: ctx.requestId,
          },
        }),
      };
  }
}

export const handler = wrapHandler(inviteCodesHandler, {
  requireAuth: true,
});
