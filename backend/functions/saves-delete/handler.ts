/**
 * Saves Delete Endpoint — DELETE /saves/:saveId
 *
 * Soft-deletes a save by setting deletedAt. Idempotent: already-deleted
 * returns 204 without emitting a second event.
 *
 * Story 3.3, Task 3 (Epic 3).
 */
import {
  getDefaultClient,
  getItem,
  updateItem,
  enforceRateLimit,
  SAVES_TABLE_CONFIG,
  USERS_TABLE_CONFIG,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createNoContentResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";
import { validatePathParams, z } from "@ai-learning-hub/validation";
import {
  emitEvent,
  getDefaultClient as getDefaultEBClient,
  SAVES_EVENT_SOURCE,
  type SavesEventDetailType,
  type SavesEventDetail,
} from "@ai-learning-hub/events";

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;
if (!EVENT_BUS_NAME && process.env.NODE_ENV !== "test")
  throw new Error("EVENT_BUS_NAME env var is not set");

const ebClient = getDefaultEBClient();

const saveIdPathSchema = z.object({
  saveId: z
    .string()
    .regex(/^[0-9A-Z]{26}$/, "saveId must be a 26-character ULID"),
});

/**
 * DELETE /saves/:saveId — Soft-delete a save.
 */
async function savesDeleteHandler(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);

  const client = getDefaultClient();

  // Rate limit: 200 writes per hour (shared bucket)
  await enforceRateLimit(
    client,
    USERS_TABLE_CONFIG.tableName,
    {
      operation: "saves-write",
      identifier: userId,
      limit: 200,
      windowSeconds: 3600,
    },
    logger
  );

  const now = new Date().toISOString();

  // Attempt conditional soft delete.
  // NOTE: Story performance hint suggests returnValues: "NONE" since 204 needs
  // no body. However, we use ALL_OLD here to obtain normalizedUrl/urlHash for
  // the SaveDeleted event detail in a single DynamoDB round-trip. The alternative
  // (NONE + a separate getItem before the update) would add a second round-trip
  // on every happy-path delete. ALL_OLD is the pragmatic trade-off.
  let previousItem: SaveItem | null;
  try {
    previousItem = await updateItem<SaveItem>(
      client,
      SAVES_TABLE_CONFIG,
      {
        key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        updateExpression: "SET deletedAt = :deletedAt, updatedAt = :updatedAt",
        expressionAttributeValues: {
          ":deletedAt": now,
          ":updatedAt": now,
        },
        conditionExpression:
          "attribute_exists(PK) AND attribute_not_exists(deletedAt)",
        returnValues: "ALL_OLD",
      },
      logger
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as AppError).code === ErrorCode.NOT_FOUND
    ) {
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

  // Fire-and-forget SaveDeleted event (AC4) — only on active → deleted
  if (previousItem) {
    const busName = EVENT_BUS_NAME ?? "";
    emitEvent<SavesEventDetailType, SavesEventDetail>(
      ebClient,
      busName,
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
  }

  return createNoContentResponse(requestId);
}

export const handler = wrapHandler(savesDeleteHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
});
