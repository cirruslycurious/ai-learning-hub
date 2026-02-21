/**
 * React hooks for API client.
 *
 * Provides useApiClient() that injects the current Clerk session token.
 *
 * Story 2.1-D7, AC18
 */
import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ApiClient } from "./client";

const API_BASE_URL = import.meta.env.VITE_API_URL as string;

if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_URL environment variable is required. See .env.example."
  );
}

/**
 * Returns an ApiClient configured with the current Clerk session token.
 */
export function useApiClient(): ApiClient {
  const { getToken } = useAuth();

  return useMemo(
    () => new ApiClient(API_BASE_URL, () => getToken()),
    [getToken]
  );
}
