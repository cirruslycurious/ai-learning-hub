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
  buildPaginationLinks,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
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
  const links = buildPaginationLinks(
    "/users/invite-codes",
    queryParams,
    nextCursor
  );

  logger.info("Invite codes listed", { userId, count: publicItems.length });
  return createSuccessResponse(publicItems, requestId, {
    meta: { cursor: nextCursor },
    links,
  });
}

/**
 * POST /users/invite-codes — generate with idempotency and rate limiting.
 * CDK wires this as generateInviteFunction (handler: "generateHandler").
 */
export const generateHandler = wrapHandler(handleGenerate, {
  requireAuth: true,
  requiredScope: "invites:manage",
  idempotent: true,
  rateLimit: inviteGenerateRateLimit,
});

/**
 * GET /users/invite-codes — list codes (read-only).
 * CDK wires this as listInviteCodesFunction (handler: "listHandler").
 */
export const listHandler = wrapHandler(handleList, {
  requireAuth: true,
  requiredScope: "invites:read",
});
