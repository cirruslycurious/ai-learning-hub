/**
 * GET /saves — List saves handler.
 *
 * Story 3.2, Task 5: Paginated list of user's active saves.
 * Uses in-memory ULID cursor pagination over queryAllItems results.
 */
import {
  getDefaultClient,
  queryAllItems,
  SAVES_TABLE_CONFIG,
  toPublicSave,
} from "@ai-learning-hub/db";
import { wrapHandler, type HandlerContext } from "@ai-learning-hub/middleware";
import { validateQueryParams, z } from "@ai-learning-hub/validation";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const CEILING = 1000;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  nextToken: z.string().optional(),
});

function encodeNextToken(saveId: string): string {
  return Buffer.from(saveId).toString("base64url");
}

function decodeNextToken(token: string): string | undefined {
  const decoded = Buffer.from(token, "base64url").toString("utf-8");
  return /^[0-9A-Z]{26}$/.test(decoded) ? decoded : undefined;
}

async function savesListHandler(ctx: HandlerContext) {
  const { event, auth, logger } = ctx;
  const userId = auth!.userId;
  const client = getDefaultClient();

  const params = validateQueryParams(
    listQuerySchema,
    event.queryStringParameters
  );
  const limit = params.limit ?? DEFAULT_LIMIT;
  const nextTokenParam = params.nextToken;

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

  // TODO(story-3.4): expose truncated in response
  if (truncated) {
    logger.warn("Save list truncated at ceiling", { userId, ceiling: CEILING });
  }

  // Apply ULID cursor pagination over the in-memory active result set.
  let startIndex = 0;
  if (nextTokenParam) {
    const cursorSaveId = decodeNextToken(nextTokenParam);
    if (!cursorSaveId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "nextToken is invalid or has expired — restart pagination"
      );
    }
    const idx = activeSaves.findIndex((s) => s.saveId === cursorSaveId);
    if (idx === -1) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "nextToken is invalid or has expired — restart pagination"
      );
    }
    startIndex = idx + 1;
  }

  const page = activeSaves.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < activeSaves.length;
  const nextToken = hasMore
    ? encodeNextToken(page[page.length - 1].saveId)
    : undefined;

  return {
    items: page.map(toPublicSave),
    ...(nextToken && { nextToken }),
    hasMore,
  };
}

export const handler = wrapHandler(savesListHandler, { requireAuth: true });
