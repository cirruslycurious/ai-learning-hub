/**
 * smoke-test/auto-auth.ts
 * Programmatic JWT generation for smoke tests.
 *
 * Uses the Clerk Backend SDK to obtain a fresh JWT — eliminating the need
 * to manually copy short-lived tokens.
 *
 * Flow:
 *   1. Fetch CLERK_SECRET_KEY from AWS SSM (cached in env after first fetch)
 *   2. Create a Clerk Backend client
 *   3. Find an active session, or create one via sign-in token + FAPI
 *   4. Call getToken() to obtain a fresh JWT
 *   5. Set process.env.SMOKE_TEST_CLERK_JWT
 *
 * Required env vars:
 *   SMOKE_TEST_CLERK_USER_ID  — Clerk user ID (e.g. "user_2abc...")
 *
 * Optional env vars:
 *   CLERK_SECRET_KEY          — If set, skips SSM fetch (useful for CI)
 *   CLERK_PUBLISHABLE_KEY     — Required when no active sessions exist
 *                                (used to derive the Clerk FAPI URL)
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
 * Derive the Clerk Frontend API (FAPI) base URL from a publishable key.
 *
 * Publishable keys encode the FAPI hostname in base64:
 *   pk_test_<base64-encoded-hostname> → <slug>.accounts.dev
 *   FAPI URL: https://<slug>.accounts.dev
 */
function getFapiUrl(publishableKey: string): string {
  // Strip the pk_test_ or pk_live_ prefix
  const encoded = publishableKey.replace(/^pk_(test|live)_/, "");
  // Base64 decode — result ends with "$"
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  // Remove trailing "$"
  const hostname = decoded.replace(/\$$/, "");
  return `https://${hostname}`;
}

/**
 * Create a session via Clerk's sign-in token + FAPI flow.
 *
 * Since Clerk Core 3 (March 2026) removed the BAPI sessions.createSession
 * endpoint, we use sign-in tokens exchanged through the Frontend API:
 *   1. Create a sign-in token (BAPI)
 *   2. POST to FAPI /v1/client/sign_ins with strategy: "ticket"
 *   3. Extract created_session_id from the response
 */
async function createSessionViaSignInToken(
  clerk: ReturnType<typeof createClerkClient>,
  userId: string,
  fapiUrl: string
): Promise<string> {
  // Create a short-lived sign-in token
  const signInToken = await clerk.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 120,
  });

  console.log(`  🎫 Created sign-in token, exchanging via FAPI...`);

  // Exchange the token for a session via FAPI
  const response = await fetch(`${fapiUrl}/v1/client/sign_ins`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      strategy: "ticket",
      ticket: signInToken.token,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `FAPI sign-in failed (${response.status}): ${body}\n` +
        `FAPI URL: ${fapiUrl}/v1/client/sign_ins`
    );
  }

  const data = await response.json();
  const sessionId = data?.response?.created_session_id;

  if (!sessionId) {
    throw new Error(
      "FAPI sign-in succeeded but no created_session_id in response. " +
        `Response: ${JSON.stringify(data).slice(0, 500)}`
    );
  }

  return sessionId;
}

/**
 * Programmatically obtain a fresh Clerk JWT for the smoke test user.
 *
 * Reuses an active session if one exists, otherwise creates a new one
 * via sign-in token + FAPI exchange.
 *
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
    console.log(
      "  🆕 No active sessions found — creating via sign-in token..."
    );

    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error(
        "No active Clerk sessions and CLERK_PUBLISHABLE_KEY is not set.\n" +
          "Set CLERK_PUBLISHABLE_KEY so auto-auth can create a session via FAPI.\n" +
          "Find it in the Clerk Dashboard → API Keys, or in frontend/.env.local."
      );
    }

    const fapiUrl = getFapiUrl(publishableKey);
    console.log(`  🌐 FAPI: ${fapiUrl}`);

    sessionId = await createSessionViaSignInToken(clerk, userId, fapiUrl);
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
