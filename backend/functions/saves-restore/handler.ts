/**
 * Saves Restore Endpoint — POST /saves/:saveId/restore
 *
 * Restores a soft-deleted save by clearing deletedAt. Idempotent:
 * already-active returns 200 with current save, no event emitted.
 *
 * Story 3.3, Task 4 (Epic 3).
 */
import {
  getDefaultClient,
  getItem,
  updateItem,
  enforceRateLimit,
  SAVES_TABLE_CONFIG,
  USERS_TABLE_CONFIG,
  toPublicSave,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
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
 * POST /saves/:saveId/restore — Restore a soft-deleted save.
 */
async function savesRestoreHandler(ctx: HandlerContext) {
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

  // Attempt conditional restore — requires deletedAt to exist
  let restored: SaveItem | null;
  try {
    restored = await updateItem<SaveItem>(
      client,
      SAVES_TABLE_CONFIG,
      {
        key: { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
        updateExpression: "REMOVE deletedAt SET updatedAt = :now",
        expressionAttributeValues: { ":now": new Date().toISOString() },
        conditionExpression:
          "attribute_exists(PK) AND attribute_exists(deletedAt)",
        returnValues: "ALL_NEW",
      },
      logger
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as AppError).code === ErrorCode.NOT_FOUND
    ) {
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
        return createSuccessResponse(toPublicSave(existing), requestId);
      }

      // Truly missing or wrong user
      throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
    }
    throw error;
  }

  // Fire-and-forget SaveRestored event (AC13) — only on deleted → active
  const busName = EVENT_BUS_NAME ?? "";
  emitEvent<SavesEventDetailType, SavesEventDetail>(
    ebClient,
    busName,
    {
      source: SAVES_EVENT_SOURCE,
      detailType: "SaveRestored",
      detail: {
        userId,
        saveId,
        url: restored!.url,
        normalizedUrl: restored!.normalizedUrl,
        urlHash: restored!.urlHash,
        contentType: restored!.contentType,
      },
    },
    logger
  );

  return createSuccessResponse(toPublicSave(restored!), requestId);
}

export const handler = wrapHandler(savesRestoreHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
});
