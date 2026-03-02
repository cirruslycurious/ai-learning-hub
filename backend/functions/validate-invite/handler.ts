/**
 * Validate Invite Endpoint — POST /auth/validate-invite
 *
 * Validates an invite code during signup. Marks the code as redeemed
 * in DynamoDB and updates Clerk publicMetadata to set inviteValidated = true.
 *
 * Per Story 2.4: Invite Validation Endpoint (Epic 2).
 * Story 3.2.8: Retrofitted with response envelope, idempotency via wrapHandler,
 *              rate limiting via wrapHandler, and event recording.
 */
import { createClerkClient } from "@clerk/backend";
import {
  getDefaultClient,
  getInviteCode,
  redeemInviteCode,
  recordEvent,
  inviteValidateRateLimit,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
  getClerkSecretKey,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  validateJsonBody,
  validateInviteBodySchema,
} from "@ai-learning-hub/validation";

/**
 * Validate an invite code is usable (not redeemed, expired, or revoked).
 * Returns a descriptive error message if invalid.
 */
function validateCodeUsability(
  code: NonNullable<Awaited<ReturnType<typeof getInviteCode>>>,
  userId: string
): string | null {
  // Idempotent — if this user already redeemed this code, return success
  if (code.redeemedBy === userId) {
    return null; // Idempotent success
  }

  // Already redeemed by someone else
  if (code.redeemedBy) {
    return "Invite code has already been used";
  }

  // Revoked
  if (code.isRevoked) {
    return "Invite code has been revoked";
  }

  // Expired
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return "Invite code has expired";
  }

  return null; // Valid
}

/**
 * POST /auth/validate-invite — Validate and redeem an invite code.
 * Story 3.2.8: Response envelope, idempotency, rate limiting, event recording.
 */
async function validateInviteHandler(ctx: HandlerContext) {
  const { event, auth, logger, requestId, actorType, agentId } = ctx;

  // Auth is guaranteed by wrapHandler with requireAuth: true
  const userId = auth!.userId;

  // Validate request body (includes optional context field)
  const { code, context } = validateJsonBody(
    validateInviteBodySchema,
    event.body
  );

  const client = getDefaultClient();

  // Look up invite code in invite-codes table
  const inviteCode = await getInviteCode(client, code, logger);

  if (!inviteCode) {
    throw new AppError(ErrorCode.INVALID_INVITE_CODE, "Invalid invite code");
  }

  // Validate code is usable
  const validationError = validateCodeUsability(inviteCode, userId);
  const isIdempotent =
    validationError === null && inviteCode.redeemedBy === userId;

  if (validationError !== null) {
    throw new AppError(ErrorCode.INVALID_INVITE_CODE, validationError);
  }

  // Redeem the code in DynamoDB (conditional update prevents double-redemption)
  // Skip DynamoDB write for idempotent case (already redeemed by this user)
  if (!isIdempotent) {
    try {
      await redeemInviteCode(client, code, userId, logger);

      // Event recording (AC18) — fire-and-forget
      await recordEvent(
        client,
        {
          entityType: "inviteCode",
          entityId: code,
          userId,
          eventType: "InviteCodeRedeemed",
          actorType,
          actorId: agentId ?? undefined,
          changes: {
            after: {
              redeemedBy: userId,
            },
          },
          context: context ?? undefined,
          requestId,
        },
        logger
      );
    } catch (error: unknown) {
      // Race condition: another request redeemed the code between lookup and update.
      // The ConditionalCheckFailedException surfaces as NOT_FOUND from the DB layer.
      // Map it to a clear validation error for the user.
      const isNotFound =
        error instanceof Error &&
        "code" in error &&
        (error as AppError).code === ErrorCode.NOT_FOUND;
      if (isNotFound) {
        throw new AppError(
          ErrorCode.INVALID_INVITE_CODE,
          "Invite code has already been used"
        );
      }
      throw error;
    }
  } else {
    logger.info(
      "Invite already redeemed by user, re-attempting Clerk update (idempotent)",
      { userId }
    );
  }

  // Update Clerk publicMetadata to set inviteValidated = true
  // Always attempt Clerk update, including idempotent retries (Issue #6 fix:
  // if a prior attempt succeeded in DynamoDB but failed in Clerk, this retry
  // will complete the Clerk metadata update and unblock the user).
  const secretKey = await getClerkSecretKey();
  const clerk = createClerkClient({ secretKey });

  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { inviteValidated: true },
  });

  logger.info("Invite code validated successfully", {
    userId,
    code: code.slice(0, 4) + "***",
  });

  // AC3: Return response envelope with success
  return createSuccessResponse({ success: true, validated: true }, requestId);
}

export const handler = wrapHandler(validateInviteHandler, {
  requireAuth: true,
  idempotent: true,
  rateLimit: inviteValidateRateLimit,
});
