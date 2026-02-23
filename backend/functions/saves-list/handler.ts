/**
 * GET /saves — List saves handler.
 *
 * Story 3.2, Task 5: Paginated list of user's active saves.
 * Story 3.4: Filter, search, sort, and truncated flag.
 * Uses in-memory ULID cursor pagination over queryAllItems results.
 */
import {
  getDefaultClient,
  queryAllItems,
  SAVES_TABLE_CONFIG,
  toPublicSave,
} from "@ai-learning-hub/db";
import { wrapHandler, type HandlerContext } from "@ai-learning-hub/middleware";
import {
  validateQueryParams,
  listSavesQuerySchema,
} from "@ai-learning-hub/validation";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";

const DEFAULT_LIMIT = 25;
const CEILING = 1000;

function encodeNextToken(saveId: string): string {
  return Buffer.from(saveId).toString("base64url");
}

function decodeNextToken(token: string): string | undefined {
  const decoded = Buffer.from(token, "base64url").toString("utf-8");
  return /^[0-9A-Z]{26}$/.test(decoded) ? decoded : undefined;
}

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
  const { event, auth, logger } = ctx;
  const userId = auth!.userId;
  const client = getDefaultClient();

  const params = validateQueryParams(
    listSavesQuerySchema,
    event.queryStringParameters
  );
  const limit = params.limit ?? DEFAULT_LIMIT;
  const nextTokenParam = params.nextToken;

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
  if (nextTokenParam) {
    const cursorSaveId = decodeNextToken(nextTokenParam);
    if (!cursorSaveId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "nextToken is invalid or has expired — restart pagination"
      );
    }

    // Check if cursor exists in unfiltered set (to distinguish stale from filter-changed)
    const inUnfiltered = activeSaves.some((s) => s.saveId === cursorSaveId);
    if (!inUnfiltered) {
      // Stale cursor — save no longer exists
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "nextToken is invalid or has expired — restart pagination"
      );
    }

    // Check if cursor exists in filtered+sorted set
    const idx = sorted.findIndex((s) => s.saveId === cursorSaveId);
    if (idx === -1) {
      // Cursor save exists but is not in current filtered/sorted list
      // (filters changed between requests) → return first page
      startIndex = 0;
    } else {
      startIndex = idx + 1;
    }
  }

  const page = sorted.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < sorted.length;
  const nextToken = hasMore
    ? encodeNextToken(page[page.length - 1].saveId)
    : undefined;

  return {
    items: page.map(toPublicSave),
    ...(nextToken && { nextToken }),
    hasMore,
    ...(truncated && { truncated: true }),
  };
}

export const handler = wrapHandler(savesListHandler, { requireAuth: true });
