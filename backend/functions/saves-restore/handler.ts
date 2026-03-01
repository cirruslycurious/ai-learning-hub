/**
 * Saves Restore Endpoint — POST /saves/:saveId/restore
 *
 * Restores a soft-deleted save by clearing deletedAt. Idempotent:
 * already-active returns 200 with current save, no event emitted.
 *
 * Story 3.3, Task 4 (Epic 3).
 * Story 3.2.7: Retrofitted with idempotency, rate limiting, event recording,
 *              version increment, and scope permissions.
 */
import {
  getDefaultClient,
  getItem,
  updateItem,
  SAVES_TABLE_CONFIG,
  toPublicSave,
  savesWriteRateLimit,
  recordEvent,
} from "@ai-learning-hub/db";
import { wrapHandler, type HandlerContext } from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";
import {
  validatePathParams,
  saveIdPathSchema,
} from "@ai-learning-hub/validation";
import {
  emitEvent,
  requireEventBus,
  SAVES_EVENT_SOURCE,
  type SavesEventDetailType,
  type SavesEventDetail,
} from "@ai-learning-hub/events";

const eventBus = requireEventBus();

/**
 * POST /saves/:saveId/restore — Restore a soft-deleted save.
 */
async function savesRestoreHandler(ctx: HandlerContext) {
  const { event, auth, logger } = ctx;
  const userId = auth!.userId;

  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);

  const client = getDefaultClient();

  // Attempt conditional restore — requires deletedAt to exist, increment version
  let restored: SaveItem | null;
  try {
    restored = await updateItem<SaveItem>(
      client,
      SAVES_TABLE_CONFIG,
      {
        key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        updateExpression:
          "REMOVE deletedAt SET updatedAt = :now, version = version + :one",
        expressionAttributeValues: {
          ":now": new Date().toISOString(),
          ":one": 1,
        },
        conditionExpression:
          "attribute_exists(PK) AND attribute_exists(deletedAt)",
        returnValues: "ALL_NEW",
      },
      logger
    );
  } catch (error) {
    if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
      // Disambiguation: already active vs truly missing
      const existing = await getItem<SaveItem>(
        client,
        SAVES_TABLE_CONFIG,
        { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        {},
        logger
      );

      if (existing && !existing.deletedAt) {
        // Already active — idempotent 200, no event
        return toPublicSave(existing);
      }

      // Truly missing or wrong user
      throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
    }
    throw error;
  }

  if (!restored) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      "Failed to retrieve restored save"
    );
  }

  // Fire-and-forget EventBridge SaveRestored event — only on deleted → active
  emitEvent<SavesEventDetailType, SavesEventDetail>(
    eventBus.ebClient,
    eventBus.busName,
    {
      source: SAVES_EVENT_SOURCE,
      detailType: "SaveRestored",
      detail: {
        userId,
        saveId,
        url: restored.url,
        normalizedUrl: restored.normalizedUrl,
        urlHash: restored.urlHash,
        contentType: restored.contentType,
      },
    },
    logger
  );

  // Event history recording (Story 3.2.7) — awaited, catches I/O errors internally.
  await recordEvent(
    client,
    {
      entityType: "save",
      entityId: saveId,
      userId,
      eventType: "SaveRestored",
      actorType: ctx.actorType,
      actorId: ctx.agentId ?? undefined,
      requestId: ctx.requestId,
    },
    logger
  );

  return toPublicSave(restored);
}

export const handler = wrapHandler(savesRestoreHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
  idempotent: true,
  rateLimit: savesWriteRateLimit,
});
