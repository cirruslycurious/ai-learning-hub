/**
 * User Profile Endpoint — GET /users/me and PATCH /users/me
 *
 * Returns and updates the authenticated user's profile.
 *
 * Per Story 2.5: User Profile (Epic 2).
 */
import {
  getDefaultClient,
  getProfile,
  updateProfile,
  type UserProfile,
} from "@ai-learning-hub/db";
import { wrapHandler, type HandlerContext } from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  validateJsonBody,
  updateProfileBodySchema,
} from "@ai-learning-hub/validation";

/**
 * Strip DynamoDB internal keys from profile before returning to client.
 */
function toPublicProfile(profile: UserProfile) {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    globalPreferences: profile.globalPreferences ?? {},
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * GET /users/me — Return the authenticated user's profile (AC1).
 */
async function handleGet(ctx: HandlerContext) {
  const { auth, logger } = ctx;
  const userId = auth!.userId;

  const client = getDefaultClient();
  const profile = await getProfile(client, userId, logger);

  if (!profile) {
    throw new AppError(ErrorCode.NOT_FOUND, "User profile not found");
  }

  logger.info("Profile retrieved", { userId });
  return toPublicProfile(profile);
}

/**
 * PATCH /users/me — Update the authenticated user's profile (AC2).
 */
async function handlePatch(ctx: HandlerContext) {
  const { event, auth, logger } = ctx;
  const userId = auth!.userId;

  const fields = validateJsonBody(updateProfileBodySchema, event.body);

  const client = getDefaultClient();
  const updated = await updateProfile(client, userId, fields, logger);

  logger.info("Profile updated", { userId });
  return toPublicProfile(updated);
}

/**
 * Route GET vs PATCH requests.
 */
async function usersMeHandler(ctx: HandlerContext) {
  const method = ctx.event.httpMethod.toUpperCase();

  switch (method) {
    case "GET":
      return handleGet(ctx);
    case "PATCH":
      return handlePatch(ctx);
    default:
      throw new AppError(
        ErrorCode.METHOD_NOT_ALLOWED,
        `Method ${method} not allowed`,
        { responseHeaders: { Allow: "GET, PATCH" } }
      );
  }
}

export const handler = wrapHandler(usersMeHandler, {
  requireAuth: true,
});
