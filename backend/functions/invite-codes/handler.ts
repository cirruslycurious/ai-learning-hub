/**
 * Invite Codes Endpoint — POST/GET /users/invite-codes
 *
 * Generates and lists invite codes for authenticated users.
 *
 * Per Story 2.9: Invite Code Generation (Epic 2).
 * Story 3.2.8: Retrofitted with idempotency, rate limiting via wrapHandler,
 *              and event recording.
 */
import {
  getDefaultClient,
  createInviteCode,
  listInviteCodesByUser,
  toPublicInviteCode,
  recordEvent,
  inviteGenerateRateLimit,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { validateQueryParams, paginationQuerySchema } from "./schemas.js";

/**
 * POST /users/invite-codes — Generate a new invite code (AC10).
 * Story 3.2.8: Rate limiting via wrapHandler, idempotency, event recording.
 */
async function handleGenerate(ctx: HandlerContext) {
  const { auth, logger, requestId, actorType, agentId } = ctx;
  const userId = auth!.userId;

  const client = getDefaultClient();

  const result = await createInviteCode(client, userId, undefined, logger);

  // Event recording (AC18) — fire-and-forget
  await recordEvent(
    client,
    {
      entityType: "inviteCode",
      entityId: result.code,
      userId,
      eventType: "InviteCodeGenerated",
      actorType,
      actorId: agentId ?? undefined,
      requestId,
    },
    logger
  );

  logger.info("Invite code generated", { userId });
  return createSuccessResponse(result, requestId, { statusCode: 201 });
}

/**
 * GET /users/invite-codes — List user's generated invite codes (Story 3.2.5 AC11).
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
 * Handler for POST /users/invite-codes — generate with idempotency and rate limiting.
 */
export const generateHandler = wrapHandler(handleGenerate, {
  requireAuth: true,
  requiredScope: "invites:manage",
  idempotent: true,
  rateLimit: inviteGenerateRateLimit,
});

/**
 * Handler for GET /users/invite-codes — list codes (read-only).
 */
export const listHandler = wrapHandler(handleList, {
  requireAuth: true,
  requiredScope: "invites:read",
});

/**
 * Route POST and GET requests.
 * CDK wires each method separately for proper middleware options.
 */
async function inviteCodesHandler(ctx: HandlerContext) {
  const method = ctx.event.httpMethod.toUpperCase();

  switch (method) {
    case "POST":
      return handleGenerate(ctx);
    case "GET":
      return handleList(ctx);
    default:
      throw new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        `Method ${method} not allowed`,
        { responseHeaders: { Allow: "POST, GET" } }
      );
  }
}

/**
 * Combined handler for backward compatibility.
 * In production, CDK wires specific handlers for proper middleware.
 */
export const handler = wrapHandler(inviteCodesHandler, {
  requireAuth: true,
  requiredScope: "invites:manage",
});
