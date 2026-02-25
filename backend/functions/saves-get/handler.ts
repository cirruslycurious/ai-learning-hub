/**
 * GET /saves/:saveId — Get single save handler.
 *
 * Story 3.2, Task 6: Fetch a single save with lastAccessedAt update.
 */
import {
  getDefaultClient,
  getItem,
  updateItem,
  SAVES_TABLE_CONFIG,
  toPublicSave,
} from "@ai-learning-hub/db";
import { wrapHandler, type HandlerContext } from "@ai-learning-hub/middleware";
import {
  validatePathParams,
  saveIdPathSchema,
} from "@ai-learning-hub/validation";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";

async function savesGetHandler(ctx: HandlerContext) {
  const { event, auth, logger } = ctx;
  const userId = auth!.userId;
  const client = getDefaultClient();

  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);

  // Fetch save. PK scoping enforces per-user isolation (AC7).
  const item = await getItem<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
    { consistentRead: true },
    logger
  );

  if (!item || item.deletedAt) {
    throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
  }

  // Update lastAccessedAt — awaited but non-throwing (AC4).
  const now = new Date().toISOString();
  try {
    await updateItem(
      client,
      SAVES_TABLE_CONFIG,
      {
        key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        updateExpression: "SET lastAccessedAt = :now",
        expressionAttributeValues: { ":now": now },
      },
      logger
    );
    // Reflect the update in the response so callers always see lastAccessedAt
    item.lastAccessedAt = now;
  } catch (err) {
    logger.error("Failed to update lastAccessedAt (non-fatal)", err as Error, {
      saveId,
    });
  }

  return toPublicSave(item);
}

export const handler = wrapHandler(savesGetHandler, {
  requireAuth: true,
  requiredScope: "*",
});
