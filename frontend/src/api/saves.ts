/**
 * React Query hooks for the Saves API.
 *
 * Wraps the ApiClient with React Query for caching, optimistic updates,
 * and automatic refetching. Maps backend Save entities to UI Resource type.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useApiClient } from "./hooks";
import type { ApiClient } from "./client";
import type { Resource } from "@/lib/types";
import type { PublicSave, ContentType } from "@ai-learning-hub/types";

// ─── Query Keys ───

export const savesKeys = {
  all: ["saves"] as const,
  lists: () => [...savesKeys.all, "list"] as const,
  list: (filters: ListSavesParams) => [...savesKeys.lists(), filters] as const,
  detail: (id: string) => [...savesKeys.all, "detail", id] as const,
};

// ─── Params ───

export interface ListSavesParams {
  limit?: number;
  cursor?: string;
  contentType?: ContentType;
  linkStatus?: "linked" | "unlinked";
  search?: string;
  sort?: "createdAt" | "lastAccessedAt" | "title";
  order?: "asc" | "desc";
}

export interface CreateSaveParams {
  url: string;
  title?: string;
  userNotes?: string;
  contentType?: ContentType;
  tags?: string[];
}

export interface UpdateSaveParams {
  saveId: string;
  version: number;
  title?: string;
  userNotes?: string;
  contentType?: ContentType;
  tags?: string[];
}

// ─── Mapping ───

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

function toResource(save: PublicSave): Resource {
  return {
    id: save.saveId,
    url: save.url,
    title: save.title || save.url,
    domain: extractDomain(save.url),
    contentType: save.contentType,
    tags: save.tags,
    enrichedAt: save.enrichedAt,
    isTutorial: save.isTutorial,
    tutorialStatus: save.tutorialStatus,
    linkedProjectCount: save.linkedProjectCount,
    version: save.version,
    userNotes: save.userNotes,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
  };
}

// ─── Query Helpers ───

function buildQueryString(params: ListSavesParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  return (
    "?" +
    new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
  );
}

// ─── List Saves ───

interface ListSavesResponse {
  resources: Resource[];
  cursor: string | null;
  total?: number;
}

async function fetchSaves(
  client: ApiClient,
  params: ListSavesParams
): Promise<ListSavesResponse> {
  const qs = buildQueryString(params);
  // ApiClient.get already unwraps the { data } envelope,
  // so we get PublicSave[] directly. Meta comes back in the
  // full response though — we need to access it differently.
  // For now, we'll do a raw-ish approach:
  const result = await client.get<PublicSave[]>(`/saves${qs}`);
  return {
    resources: result.map(toResource),
    cursor: null, // TODO: wire cursor from response meta
  };
}

export function useSaves(
  params: ListSavesParams = {},
  options?: Partial<UseQueryOptions<ListSavesResponse>>
) {
  const client = useApiClient();
  return useQuery({
    queryKey: savesKeys.list(params),
    queryFn: () => fetchSaves(client, params),
    ...options,
  });
}

// ─── Get Single Save ───

export function useSave(saveId: string | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: savesKeys.detail(saveId!),
    queryFn: async () => {
      const save = await client.get<PublicSave>(`/saves/${saveId}`);
      return toResource(save);
    },
    enabled: !!saveId,
  });
}

// ─── Create Save ───

export function useCreateSave() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateSaveParams) => {
      const save = await client.post<PublicSave>("/saves", params, {
        "Idempotency-Key": crypto.randomUUID(),
      });
      return toResource(save);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savesKeys.lists() });
    },
  });
}

// ─── Update Save ───

export function useUpdateSave() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saveId, version, ...body }: UpdateSaveParams) => {
      const save = await client.patch<PublicSave>(`/saves/${saveId}`, body, {
        "Idempotency-Key": crypto.randomUUID(),
        "If-Match": String(version),
      });
      return toResource(save);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: savesKeys.detail(vars.saveId),
      });
      queryClient.invalidateQueries({ queryKey: savesKeys.lists() });
    },
  });
}

// ─── Delete Save ───

export function useDeleteSave() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saveId: string) => {
      await client.delete(`/saves/${saveId}`, {
        "Idempotency-Key": crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savesKeys.lists() });
    },
  });
}

// ─── Restore Save ───

export function useRestoreSave() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saveId: string) => {
      const save = await client.post<PublicSave>(
        `/saves/${saveId}/restore`,
        undefined,
        {
          "Idempotency-Key": crypto.randomUUID(),
        }
      );
      return toResource(save);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savesKeys.lists() });
    },
  });
}
