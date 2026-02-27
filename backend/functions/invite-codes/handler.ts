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
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  validateQueryParams,
  paginationQuerySchema,
} from "@ai-learning-hub/validation";

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
  return createSuccessResponse(result, requestId, { statusCode: 201 });
}

/**
 * GET /users/invite-codes — List user's generated invite codes (AC3, AC7, Story 3.2.5 AC11).
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
  const result = await listInviteCodesByUser(
    client,
    userId,
    limit,
    cursor,
    logger
  );

  const publicItems = result.items.map(toPublicInviteCode);
  const nextCursor = result.cursor ?? null;

  const queryParams: Record<string, string> = { limit: String(limit) };
  const selfQuery = new URLSearchParams(queryParams).toString();
  const self = `/users/invite-codes?${selfQuery}`;

  let next: string | null = null;
  if (nextCursor) {
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("cursor", nextCursor);
    next = `/users/invite-codes?${nextParams.toString()}`;
  }

  logger.info("Invite codes listed", { userId, count: publicItems.length });
  return createSuccessResponse(publicItems, requestId, {
    meta: { cursor: nextCursor },
    links: { self, next },
  });
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
      throw new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        `Method ${method} not allowed`,
        { responseHeaders: { Allow: "POST, GET" } }
      );
  }
}

export const handler = wrapHandler(inviteCodesHandler, {
  requireAuth: true,
  requiredScope: "invites:manage",
});
