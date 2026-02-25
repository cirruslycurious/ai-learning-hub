/**
 * smoke-test/auto-auth.ts
 * Programmatic JWT generation for smoke tests.
 *
 * Uses the Clerk Backend SDK to create a fresh session and obtain
 * a JWT — eliminating the need to manually copy short-lived tokens.
 *
 * Flow:
 *   1. Fetch CLERK_SECRET_KEY from AWS SSM (cached in env after first fetch)
 *   2. Create a Clerk Backend client
 *   3. Find or create an active session for the configured test user
 *   4. Call getToken() to obtain a fresh JWT
 *   5. Set process.env.SMOKE_TEST_CLERK_JWT
 *
 * Required env vars:
 *   SMOKE_TEST_CLERK_USER_ID  — Clerk user ID (e.g. "user_2abc...")
 *
 * Optional env vars:
 *   CLERK_SECRET_KEY          — If set, skips SSM fetch (useful for CI)
 */

import { createClerkClient } from "@clerk/backend";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const SSM_PARAM_NAME = "/ai-learning-hub/clerk-secret-key";

/**
 * Fetch the Clerk secret key from AWS SSM Parameter Store.
 * Falls back to CLERK_SECRET_KEY env var if already set.
 */
async function getClerkSecretKey(): Promise<string> {
  // Allow direct env var override (useful for CI or local)
  if (process.env.CLERK_SECRET_KEY) {
    return process.env.CLERK_SECRET_KEY;
  }

  console.log(`  ⬇  Fetching Clerk secret key from SSM: ${SSM_PARAM_NAME}`);
  const ssm = new SSMClient({});
  const result = await ssm.send(
    new GetParameterCommand({ Name: SSM_PARAM_NAME, WithDecryption: true })
  );

  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(
      `SSM parameter ${SSM_PARAM_NAME} is empty or not found. ` +
        `Ensure the parameter exists and your AWS credentials have ssm:GetParameter permission.`
    );
  }

  // Cache for any subsequent use within this process
  process.env.CLERK_SECRET_KEY = value;
  return value;
}

/**
 * Programmatically obtain a fresh Clerk JWT for the smoke test user.
 *
 * Creates a new session (or reuses an active one) and generates a token.
 * Sets process.env.SMOKE_TEST_CLERK_JWT so downstream code can use it.
 *
 * @returns The JWT string
 */
export async function autoFetchJwt(): Promise<string> {
  const userId = process.env.SMOKE_TEST_CLERK_USER_ID;
  if (!userId) {
    throw new Error(
      "SMOKE_TEST_CLERK_USER_ID is required for --auto-auth. " +
        "Set it to the Clerk user ID of a dev test user (e.g. user_2abc...)."
    );
  }

  console.log("\n🔑 Auto-auth: Fetching fresh JWT...");

  // Step 1: Get the secret key
  const secretKey = await getClerkSecretKey();

  // Step 2: Create Clerk client
  const clerk = createClerkClient({ secretKey });

  // Step 3: Find an existing active session, or create one
  console.log(`  👤 User: ${userId}`);

  let sessionId: string;

  const existingSessions = await clerk.sessions.getSessionList({
    userId,
    status: "active",
  });

  if (existingSessions.data.length > 0) {
    sessionId = existingSessions.data[0].id;
    console.log(`  ♻  Reusing active session: ${sessionId}`);
  } else {
    console.log("  🆕 No active sessions found — creating a new one...");
    const newSession = await clerk.sessions.createSession({ userId });
    sessionId = newSession.id;
    console.log(`  ✅ Created session: ${sessionId}`);
  }

  // Step 4: Get a fresh JWT from the session
  const token = await clerk.sessions.getToken(sessionId);
  const jwt = token.jwt;

  if (!jwt) {
    throw new Error(
      "Clerk returned an empty JWT. Ensure the test user is active and " +
        "has publicMetadata.inviteValidated === true."
    );
  }

  // Step 5: Inject into process env for downstream use
  process.env.SMOKE_TEST_CLERK_JWT = jwt;

  console.log(`  ✅ JWT obtained (${jwt.length} chars, expires in ~60s)\n`);

  return jwt;
}
