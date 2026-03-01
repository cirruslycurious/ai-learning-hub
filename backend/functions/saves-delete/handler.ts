/**
 * Saves Delete Endpoint — DELETE /saves/:saveId
 *
 * Soft-deletes a save by setting deletedAt. Idempotent: already-deleted
 * returns 204 without emitting a second event.
 *
 * Story 3.3, Task 3 (Epic 3).
 * Story 3.2.7: Retrofitted with idempotency, rate limiting, event recording,
 *              version increment, and scope permissions.
 */
import {
  getDefaultClient,
  getItem,
  updateItem,
  SAVES_TABLE_CONFIG,
  savesWriteRateLimit,
  recordEvent,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createNoContentResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
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
 * DELETE /saves/:saveId — Soft-delete a save.
 */
async function savesDeleteHandler(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);

  const client = getDefaultClient();

  const now = new Date().toISOString();

  // Attempt conditional soft delete with version increment.
  // Uses ALL_OLD to obtain normalizedUrl/urlHash for event detail + previous version.
  let previousItem: SaveItem | null;
  try {
    previousItem = await updateItem<SaveItem>(
      client,
      SAVES_TABLE_CONFIG,
      {
        key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        updateExpression:
          "SET deletedAt = :deletedAt, updatedAt = :updatedAt, version = version + :one",
        expressionAttributeValues: {
          ":deletedAt": now,
          ":updatedAt": now,
          ":one": 1,
        },
        conditionExpression:
          "attribute_exists(PK) AND attribute_not_exists(deletedAt)",
        returnValues: "ALL_OLD",
      },
      logger
    );
  } catch (error) {
    if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
      // Disambiguation: missing vs already deleted
      const existing = await getItem<SaveItem>(
        client,
        SAVES_TABLE_CONFIG,
        { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        {},
        logger
      );

      if (existing && existing.deletedAt) {
        // Already deleted — idempotent 204, no event
        return createNoContentResponse(requestId);
      }

      // Truly missing or wrong user
      throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
    }
    throw error;
  }

  // Fire-and-forget EventBridge SaveDeleted event — only on active → deleted
  if (previousItem) {
    emitEvent<SavesEventDetailType, SavesEventDetail>(
      eventBus.ebClient,
      eventBus.busName,
      {
        source: SAVES_EVENT_SOURCE,
        detailType: "SaveDeleted",
        detail: {
          userId,
          saveId,
          normalizedUrl: previousItem.normalizedUrl,
          urlHash: previousItem.urlHash,
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
        eventType: "SaveDeleted",
        actorType: ctx.actorType,
        actorId: ctx.agentId ?? undefined,
        requestId: ctx.requestId,
      },
      logger
    );
  }

  return createNoContentResponse(requestId);
}

export const handler = wrapHandler(savesDeleteHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
  idempotent: true,
  rateLimit: savesWriteRateLimit,
});
