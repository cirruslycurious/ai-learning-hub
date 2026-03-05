/**
 * User Profile Endpoint — GET /users/me, PATCH /users/me, POST /users/me/update
 *
 * Returns and updates the authenticated user's profile.
 *
 * Per Story 2.5: User Profile (Epic 2).
 * Story 3.2.8: Retrofitted with response envelope, idempotency, version checking,
 *              rate limiting, scope enforcement, and event recording.
 */
import {
  getDefaultClient,
  getProfile,
  updateProfileWithEvents,
  recordEvent,
  profileUpdateRateLimit,
  type UserProfile,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
  buildResourceActions,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  validateJsonBody,
  updateProfileBodySchema,
} from "@ai-learning-hub/validation";

/**
 * Strip DynamoDB internal keys from profile before returning to client.
 * Story 3.2.8: Added version field for optimistic concurrency.
 */
function toPublicProfile(profile: UserProfile) {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    globalPreferences: profile.globalPreferences ?? {},
    version: profile.version,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * GET /users/me — Return the authenticated user's profile (AC1).
 * Story 3.2.8: Returns response envelope with links.self and meta.actions.
 */
async function handleGet(ctx: HandlerContext) {
  const { auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const client = getDefaultClient();
  const profile = await getProfile(client, userId, logger);

  if (!profile) {
    throw new AppError(ErrorCode.NOT_FOUND, "User profile not found");
  }

  logger.info("Profile retrieved", { userId });

  // Build available actions for this resource (Story 3.2.8, AC19)
  const actions = buildResourceActions("users", userId);

  return createSuccessResponse(toPublicProfile(profile), requestId, {
    links: { self: "/users/me" },
    meta: { actions },
  });
}

/**
 * PATCH /users/me and POST /users/me/update — Update the authenticated user's profile (AC2, AC7-AC9).
 * Story 3.2.8: Uses idempotency, version checking, and event recording.
 */
async function handleUpdate(ctx: HandlerContext) {
  const {
    event,
    auth,
    logger,
    requestId,
    expectedVersion,
    actorType,
    agentId,
  } = ctx;
  const userId = auth!.userId;

  // Validate request body (includes optional context field)
  const { context, ...fields } = validateJsonBody(
    updateProfileBodySchema,
    event.body
  );

  const client = getDefaultClient();

  // Update with version check and get before/after state for event recording
  const result = await updateProfileWithEvents(
    client,
    userId,
    fields,
    expectedVersion,
    logger
  );

  // Event recording (AC17) — fire-and-forget (recordEvent catches I/O errors internally)
  await recordEvent(
    client,
    {
      entityType: "userProfile",
      entityId: userId,
      userId,
      eventType: "ProfileUpdated",
      actorType,
      actorId: agentId ?? undefined,
      changes: {
        changedFields: result.changedFields,
        before: result.before,
        after: result.after,
      },
      context: context ?? undefined,
      requestId,
    },
    logger
  );

  logger.info("Profile updated", {
    userId,
    changedFields: result.changedFields,
  });

  return createSuccessResponse(toPublicProfile(result.profile), requestId, {
    links: { self: "/users/me" },
  });
}

/**
 * GET /users/me — read profile (read-only, no idempotency/version).
 * CDK wires this as readUsersMeFunction (handler: "readHandler").
 */
export const readHandler = wrapHandler(handleGet, {
  requireAuth: true,
  requiredScope: "users:read",
});

/**
 * PATCH /users/me and POST /users/me/update — update profile.
 * CDK wires this as writeUsersMeFunction (handler: "writeHandler").
 * Uses idempotency, version checking (If-Match), and rate limiting.
 */
export const writeHandler = wrapHandler(handleUpdate, {
  requireAuth: true,
  requiredScope: "users:write",
  idempotent: true,
  requireVersion: true,
  rateLimit: profileUpdateRateLimit,
});
