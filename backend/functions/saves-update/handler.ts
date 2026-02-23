/**
 * Saves Update Endpoint — PATCH /saves/:saveId
 *
 * Updates save metadata (title, userNotes, contentType, tags).
 * URL fields are immutable after creation.
 *
 * Story 3.3, Task 2 (Epic 3).
 */
import {
  getDefaultClient,
  updateItem,
  enforceRateLimit,
  SAVES_TABLE_CONFIG,
  USERS_TABLE_CONFIG,
  SAVES_WRITE_RATE_LIMIT,
  toPublicSave,
} from "@ai-learning-hub/db";
import { wrapHandler, type HandlerContext } from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";
import {
  updateSaveSchema,
  validateJsonBody,
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
 * PATCH /saves/:saveId — Update save metadata.
 */
async function savesUpdateHandler(ctx: HandlerContext) {
  const { event, auth, logger } = ctx;
  const userId = auth!.userId;

  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);
  const body = validateJsonBody(updateSaveSchema, event.body);

  const client = getDefaultClient();

  // Rate limit: 200 writes per hour (shared bucket with create/delete/restore)
  await enforceRateLimit(
    client,
    USERS_TABLE_CONFIG.tableName,
    {
      ...SAVES_WRITE_RATE_LIMIT,
      identifier: userId,
    },
    logger
  );

  // Build dynamic update expression from provided fields
  const expressionParts: string[] = ["updatedAt = :updatedAt"];
  const expressionValues: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
  };
  const updatedFields: string[] = [];

  if (body.title !== undefined) {
    expressionParts.push("title = :title");
    expressionValues[":title"] = body.title;
    updatedFields.push("title");
  }
  if (body.userNotes !== undefined) {
    expressionParts.push("userNotes = :userNotes");
    expressionValues[":userNotes"] = body.userNotes;
    updatedFields.push("userNotes");
  }
  if (body.contentType !== undefined) {
    expressionParts.push("contentType = :contentType");
    expressionValues[":contentType"] = body.contentType;
    updatedFields.push("contentType");
  }
  if (body.tags !== undefined) {
    expressionParts.push("tags = :tags");
    expressionValues[":tags"] = body.tags;
    updatedFields.push("tags");
  }

  let updated: SaveItem | null;
  try {
    updated = await updateItem<SaveItem>(
      client,
      SAVES_TABLE_CONFIG,
      {
        key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        updateExpression: `SET ${expressionParts.join(", ")}`,
        expressionAttributeValues: expressionValues,
        conditionExpression:
          "attribute_exists(PK) AND attribute_not_exists(deletedAt)",
        returnValues: "ALL_NEW",
      },
      logger
    );
  } catch (error) {
    if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
      throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
    }
    throw error;
  }

  if (!updated) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      "Failed to retrieve updated save"
    );
  }

  // Fire-and-forget SaveUpdated event (AC2)
  emitEvent<SavesEventDetailType, SavesEventDetail>(
    eventBus.ebClient,
    eventBus.busName,
    {
      source: SAVES_EVENT_SOURCE,
      detailType: "SaveUpdated",
      detail: {
        userId,
        saveId,
        normalizedUrl: updated.normalizedUrl,
        urlHash: updated.urlHash,
        updatedFields,
      },
    },
    logger
  );

  return toPublicSave(updated);
}

export const handler = wrapHandler(savesUpdateHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
});
