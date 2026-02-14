/**
 * JWT Authorizer Lambda for API Gateway (TOKEN type).
 *
 * Validates Clerk-issued JWTs, enforces invite validation,
 * performs create-on-first-auth, and checks suspension status.
 *
 * Per ADR-013: Clerk Authentication Provider.
 */
import type {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
  Context,
} from "aws-lambda";
import { verifyToken } from "@clerk/backend";
import {
  getDefaultClient,
  getProfile,
  ensureProfile,
  type PublicMetadata,
} from "@ai-learning-hub/db";
import { createLogger } from "@ai-learning-hub/logging";

/**
 * Authorizer cache TTL in seconds (AC8).
 * This value is consumed by the CDK ApiStack when configuring the
 * API Gateway TokenAuthorizer's resultsCacheTtl.
 * TODO: Wire into API Gateway TokenAuthorizer in the API story.
 */
export const AUTHORIZER_CACHE_TTL = 300;

interface PolicyDocument {
  Version: string;
  Statement: Array<{
    Action: string;
    Effect: "Allow" | "Deny";
    Resource: string;
  }>;
}

function generatePolicy(effect: "Allow" | "Deny"): PolicyDocument {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: "*",
      },
    ],
  };
}

function deny(
  principalId: string,
  errorCode: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: generatePolicy("Deny"),
    context: { errorCode },
  };
}

export async function handler(
  event: APIGatewayTokenAuthorizerEvent,
  _context: Context
): Promise<APIGatewayAuthorizerResult> {
  const logger = createLogger();

  // Strip "Bearer " prefix
  const token = event.authorizationToken.replace(/^Bearer\s+/i, "");

  try {
    // AC1: Validate token via @clerk/backend verifyToken
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const clerkId = verified.sub;
    const publicMetadata = (verified.publicMetadata ?? {}) as PublicMetadata;

    // AC3: Block unvalidated invites
    if (publicMetadata.inviteValidated !== true) {
      logger.warn("Invite not validated", { clerkId });
      return deny(clerkId, "INVITE_REQUIRED");
    }

    // AC5: Fast path — read profile first (1 DB read for existing users)
    const client = getDefaultClient();
    let profile = await getProfile(client, clerkId);

    // AC4: Create-on-first-auth if profile doesn't exist
    if (!profile) {
      await ensureProfile(client, clerkId, publicMetadata);
      profile = await getProfile(client, clerkId);
    }

    // Guard: profile must exist after ensureProfile
    if (!profile) {
      logger.error(
        "Profile not found after ensureProfile",
        new Error("Profile inconsistency")
      );
      throw new Error("Unauthorized");
    }

    // AC6: Check suspension status
    if (profile.suspendedAt) {
      logger.warn("Suspended account access attempt", { clerkId });
      return deny(clerkId, "SUSPENDED_ACCOUNT");
    }

    // AC2: Return Allow with context
    const role = profile.role || (publicMetadata.role as string) || "user";

    logger.info("JWT auth successful", { clerkId, role });

    return {
      principalId: clerkId,
      policyDocument: generatePolicy("Allow"),
      context: {
        userId: clerkId,
        role,
        authMethod: "jwt",
      },
    };
  } catch (error) {
    // AC7: Invalid/expired JWT → throw Unauthorized
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("JWT verification failed", err);
    throw new Error("Unauthorized");
  }
}
