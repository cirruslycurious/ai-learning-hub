/**
 * React Query hooks for Auth / User profile API.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "./hooks";
import type { User } from "@ai-learning-hub/types";

export const authKeys = {
  profile: ["users", "me"] as const,
};

// ─── Get Profile ───

export function useProfile() {
  const client = useApiClient();
  return useQuery({
    queryKey: authKeys.profile,
    queryFn: () => client.get<User>("/users/me"),
  });
}

// ─── Update Profile ───

export function useUpdateProfile() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { displayName?: string }) => {
      return client.patch<User>("/users/me", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.profile });
    },
  });
}

// ─── Validate Invite ───

export function useValidateInvite() {
  const client = useApiClient();

  return useMutation({
    mutationFn: async (code: string) => {
      return client.post<{ valid: boolean }>("/auth/validate-invite", { code });
    },
  });
}
