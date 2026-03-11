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

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000/dev";

function getBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Returns an ApiClient configured with the current Clerk session token.
 */
export function useApiClient(): ApiClient {
  const { getToken } = useAuth();
  const baseUrl = getBaseUrl();
  return useMemo(() => new ApiClient(baseUrl, getToken), [getToken, baseUrl]);
}
