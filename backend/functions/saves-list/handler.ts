/**
 * GET /saves — List saves handler.
 *
 * Story 3.2, Task 5: Paginated list of user's active saves.
 * Story 3.4: Filter, search, sort, and truncated flag.
 * Story 3.2.5: Cursor-based pagination with envelope response format.
 * Uses in-memory ULID cursor pagination over queryAllItems results.
 */
import {
  getDefaultClient,
  queryAllItems,
  SAVES_TABLE_CONFIG,
  toPublicSave,
  encodeCursor,
  decodeCursor,
  DEFAULT_PAGE_SIZE,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import {
  validateQueryParams,
  listSavesQuerySchema,
} from "@ai-learning-hub/validation";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem, EnvelopeMeta } from "@ai-learning-hub/types";

const CEILING = 1000;

/**
 * Apply in-memory filters: contentType, linkStatus, search.
 * Filters are AND-combined (AC8).
 */
function applyFilters(
  items: SaveItem[],
  params: {
    contentType?: string;
    linkStatus?: string;
    search?: string;
  }
): SaveItem[] {
  let filtered = items;

  if (params.contentType) {
    filtered = filtered.filter((s) => s.contentType === params.contentType);
  }

  if (params.linkStatus === "linked") {
    filtered = filtered.filter((s) => (s.linkedProjectCount ?? 0) > 0);
  } else if (params.linkStatus === "unlinked") {
    filtered = filtered.filter((s) => (s.linkedProjectCount ?? 0) === 0);
  }

  if (params.search) {
    const needle = params.search.toLowerCase();
    filtered = filtered.filter((s) => {
      const title = (s.title ?? "").toLowerCase();
      const url = s.url.toLowerCase();
      return title.includes(needle) || url.includes(needle);
    });
  }

  return filtered;
}

/**
 * Apply in-memory sort by sort key and order.
 * - lastAccessedAt null/undefined → bottom
 * - title null/empty → bottom
 */
function applySort(
  items: SaveItem[],
  sortKey: "createdAt" | "lastAccessedAt" | "title",
  order: "asc" | "desc"
): SaveItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    let cmp: number;

    if (sortKey === "lastAccessedAt") {
      const aVal = a.lastAccessedAt;
      const bVal = b.lastAccessedAt;
      // null/undefined sorts to bottom regardless of order
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;
      cmp = aVal.localeCompare(bVal);
    } else if (sortKey === "title") {
      const aVal = a.title ?? "";
      const bVal = b.title ?? "";
      // empty sorts to bottom regardless of order
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;
      cmp = aVal.localeCompare(bVal);
    } else {
      // createdAt — always populated
      cmp = a.createdAt.localeCompare(b.createdAt);
    }

    return order === "asc" ? cmp : -cmp;
  });

  return sorted;
}

async function savesListHandler(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;
  const client = getDefaultClient();

  const params = validateQueryParams(
    listSavesQuerySchema,
    event.queryStringParameters
  );
  const limit = params.limit ?? DEFAULT_PAGE_SIZE;
  const cursorParam = params.cursor;

  // Resolve default sort/order: desc for dates, asc for title
  const sortKey = params.sort ?? "createdAt";
  const order = params.order ?? (sortKey === "title" ? "asc" : "desc");

  // Fetch active saves up to ceiling. FilterExpression ensures the ceiling
  // applies to ACTIVE items only — soft-deleted items do not count toward it.
  const { items: activeSaves, truncated } = await queryAllItems<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    {
      keyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      expressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":prefix": "SAVE#",
      },
      filterExpression: "attribute_not_exists(deletedAt)",
      scanIndexForward: false,
      consistentRead: true,
      ceiling: CEILING,
    },
    logger
  );

  if (truncated) {
    logger.warn("Save list truncated at ceiling", { userId, ceiling: CEILING });
  }

  // Apply in-memory filters (AC1–AC4, AC8)
  const filtered = applyFilters(activeSaves, {
    contentType: params.contentType,
    linkStatus: params.linkStatus,
    search: params.search,
  });

  // Apply in-memory sort (AC5–AC7)
  const sorted = applySort(filtered, sortKey, order);

  // Apply ULID cursor pagination over the filtered+sorted result set.
  let startIndex = 0;
  let cursorReset = false;
  const responseHeaders: Record<string, string> = {};

  if (cursorParam) {
    // Decode cursor using shared utility — validates format
    let cursorSaveId: string | undefined;
    try {
      const decoded = decodeCursor(cursorParam);
      const rawId = decoded.saveId;
      if (typeof rawId === "string" && /^[0-9A-Z]{26}$/.test(rawId)) {
        cursorSaveId = rawId;
      }
    } catch {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid cursor token", {
        fields: [
          {
            field: "cursor",
            message: "Invalid cursor token",
            code: "invalid_string",
          },
        ],
      });
    }

    if (!cursorSaveId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid cursor token", {
        fields: [
          {
            field: "cursor",
            message: "Invalid cursor token",
            code: "invalid_string",
          },
        ],
      });
    }

    // Check if cursor exists in unfiltered set (to distinguish stale from filter-changed)
    const inUnfiltered = activeSaves.some((s) => s.saveId === cursorSaveId);
    if (!inUnfiltered) {
      // Stale cursor — save deleted. Reset to first page (AC9)
      startIndex = 0;
      cursorReset = true;
      responseHeaders["X-Cursor-Reset"] = "true";
    } else {
      // Check if cursor exists in filtered+sorted set
      const idx = sorted.findIndex((s) => s.saveId === cursorSaveId);
      if (idx === -1) {
        // Cursor save exists but filters changed → reset to first page (AC9)
        startIndex = 0;
        cursorReset = true;
        responseHeaders["X-Cursor-Reset"] = "true";
      } else {
        startIndex = idx + 1;
      }
    }
  }

  const page = sorted.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < sorted.length;
  const nextCursor = hasMore
    ? encodeCursor({ saveId: page[page.length - 1].saveId })
    : null;

  // Build envelope meta (AC8)
  const meta: EnvelopeMeta = {
    cursor: nextCursor,
    total: filtered.length,
  };
  if (truncated) {
    meta.truncated = true;
  }
  if (cursorReset) {
    meta.cursorReset = true;
  }

  // Build links from validated params (AC3 — CRITICAL: use Zod-parsed params, not raw query)
  const queryParams: Record<string, string> = {
    limit: String(limit),
  };
  if (params.contentType) queryParams.contentType = params.contentType;
  if (params.linkStatus) queryParams.linkStatus = params.linkStatus;
  if (params.search) queryParams.search = params.search;
  if (params.sort) queryParams.sort = params.sort;
  if (params.order) queryParams.order = params.order;

  const selfQuery = new URLSearchParams(queryParams).toString();
  const self = selfQuery ? `/saves?${selfQuery}` : "/saves";

  let next: string | null = null;
  if (nextCursor) {
    const nextParams = new URLSearchParams(queryParams);
    nextParams.set("cursor", nextCursor);
    next = `/saves?${nextParams.toString()}`;
  }

  const response = createSuccessResponse(page.map(toPublicSave), requestId, {
    meta,
    links: { self, next },
  });

  // Merge additional headers (X-Cursor-Reset)
  if (Object.keys(responseHeaders).length > 0) {
    response.headers = { ...response.headers, ...responseHeaders };
  }

  return response;
}

export const handler = wrapHandler(savesListHandler, {
  requireAuth: true,
  requiredScope: "saves:read",
});
