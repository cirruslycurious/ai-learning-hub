/**
 * Validate Invite Endpoint — POST /auth/validate-invite
 *
 * Validates an invite code during signup. Marks the code as redeemed
 * in DynamoDB and updates Clerk publicMetadata to set inviteValidated = true.
 *
 * Per Story 2.4: Invite Validation Endpoint (Epic 2).
 */
import { createClerkClient } from "@clerk/backend";
import {
  getDefaultClient,
  getInviteCode,
  redeemInviteCode,
  enforceRateLimit,
  USERS_TABLE_CONFIG,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
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
  // AC7: Idempotent — if this user already redeemed this code, return success
  if (code.redeemedBy === userId) {
    return null; // Idempotent success
  }

  // AC3: Already redeemed by someone else
  if (code.redeemedBy) {
    return "Invite code has already been used";
  }

  // AC3: Revoked
  if (code.isRevoked) {
    return "Invite code has been revoked";
  }

  // AC3: Expired
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return "Invite code has expired";
  }

  return null; // Valid
}

async function validateInviteHandler(ctx: HandlerContext) {
  const { event, auth, logger } = ctx;

  // Auth is guaranteed by wrapHandler with requireAuth: true
  const userId = auth!.userId;

  // Validate request body (AC1)
  const { code } = validateJsonBody(validateInviteBodySchema, event.body);

  const client = getDefaultClient();

  // Enforce rate limit: 5 invite validations per IP per hour (Story 2.7, AC4)
  // TODO: When behind CloudFront, event.requestContext.identity.sourceIp will be
  // the CDN edge IP, not the real client IP. Use the X-Forwarded-For header
  // (first IP in the chain) for accurate per-client rate limiting in production.
  const sourceIp = event.requestContext?.identity?.sourceIp ?? "unknown";
  await enforceRateLimit(
    client,
    USERS_TABLE_CONFIG.tableName,
    {
      operation: "invite-validate",
      identifier: sourceIp,
      limit: 5,
      windowSeconds: 3600,
    },
    logger
  );

  // Look up invite code in invite-codes table (AC1)
  const inviteCode = await getInviteCode(client, code);

  if (!inviteCode) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid invite code", {
      code: "INVALID_INVITE_CODE",
    });
  }

  // Validate code is usable
  const validationError = validateCodeUsability(inviteCode, userId);
  const isIdempotent =
    validationError === null && inviteCode.redeemedBy === userId;

  if (validationError !== null) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, validationError, {
      code: "INVALID_INVITE_CODE",
    });
  }

  // AC2: Redeem the code in DynamoDB (conditional update prevents double-redemption)
  // Skip DynamoDB write for idempotent case (already redeemed by this user)
  if (!isIdempotent) {
    try {
      await redeemInviteCode(client, code, userId);
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
          ErrorCode.VALIDATION_ERROR,
          "Invite code has already been used",
          { code: "INVALID_INVITE_CODE" }
        );
      }
      throw error;
    }
  } else {
    logger.info(
      "Invite already redeemed by user, re-attempting Clerk update (idempotent)",
      {
        userId,
      }
    );
  }

  // AC2: Update Clerk publicMetadata to set inviteValidated = true
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

  return { success: true };
}

export const handler = wrapHandler(validateInviteHandler, {
  requireAuth: true,
});
