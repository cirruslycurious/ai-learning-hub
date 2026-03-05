/**
 * Pagination link builder for list endpoints.
 * Produces { self, next } link objects for response envelopes.
 */

/**
 * Build self and next pagination links from a base path and query params.
 *
 * @param basePath - The endpoint base path (e.g., "/saves", "/users/api-keys")
 * @param queryParams - Current query parameters (excluding cursor)
 * @param nextCursor - Opaque cursor for the next page, or null if no more pages
 * @returns Object with `self` (always present) and `next` (null when no more pages)
 */
export function buildPaginationLinks(
  basePath: string,
  queryParams: Record<string, string>,
  nextCursor: string | null
): { self: string; next: string | null } {
  const selfQuery = new URLSearchParams(queryParams).toString();
  const self = selfQuery ? `${basePath}?${selfQuery}` : basePath;

  let next: string | null = null;
  if (nextCursor) {
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("cursor", nextCursor);
    next = `${basePath}?${nextParams.toString()}`;
  }

  return { self, next };
}
