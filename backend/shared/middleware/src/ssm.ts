/**
 * SSM Parameter Store utilities for fetching secrets.
 *
 * Provides a cached lookup for the Clerk secret key stored in SSM,
 * shared across all Lambdas that need it (JWT authorizer, validate-invite, etc.).
 */
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Module-level cache for Clerk secret key (persists across warm Lambda invocations)
let cachedClerkSecretKey: string | undefined;

/**
 * Fetch the Clerk secret key from SSM Parameter Store.
 * Caches the value in module scope so subsequent calls skip SSM.
 *
 * Requires the CLERK_SECRET_KEY_PARAM environment variable to be set
 * to the SSM parameter name (e.g., "/ai-learning-hub/clerk-secret-key").
 *
 * @returns The Clerk secret key string
 * @throws Error if CLERK_SECRET_KEY_PARAM env var is missing or SSM value is empty
 */
export async function getClerkSecretKey(): Promise<string> {
  if (cachedClerkSecretKey) return cachedClerkSecretKey;

  const ssmParamName = process.env.CLERK_SECRET_KEY_PARAM;
  if (!ssmParamName) {
    throw new Error("CLERK_SECRET_KEY_PARAM environment variable is not set");
  }

  const ssm = new SSMClient({});
  const result = await ssm.send(
    new GetParameterCommand({ Name: ssmParamName, WithDecryption: true })
  );

  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error("Clerk secret key not found in SSM");
  }

  cachedClerkSecretKey = value;
  return value;
}

/**
 * Reset the cached Clerk secret key. Primarily for testing.
 */
export function resetClerkSecretKeyCache(): void {
  cachedClerkSecretKey = undefined;
}
