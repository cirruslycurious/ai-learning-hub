/**
 * Saves Update Endpoint — PATCH /saves/:saveId & POST /saves/:saveId/update-metadata
 *
 * Updates save metadata (title, userNotes, contentType, tags).
 * URL fields are immutable after creation.
 * Serves both PATCH (REST) and POST command (CQRS) routes via the same Lambda.
 *
 * Story 3.3, Task 2 (Epic 3).
 * Story 3.2.7: Retrofitted with idempotency, optimistic concurrency, event recording,
 *              rate limiting, scope permissions, context metadata, and CQRS command route.
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
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode, nextVersion } from "@ai-learning-hub/types";
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
 * POST /saves/:saveId/update-metadata — CQRS command (same logic).
 */
async function savesUpdateHandler(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);
  const body = validateJsonBody(updateSaveSchema, event.body);

  const client = getDefaultClient();

  // Pre-read: existence check + before snapshot + version hint
  const existingItem = await getItem<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    { PK: `USER#${userId}`, SK: `SAVE#${saveId}` },
    { consistentRead: true },
    logger
  );

  if (!existingItem || existingItem.deletedAt) {
    throw new AppError(ErrorCode.NOT_FOUND, "Save not found");
  }

  // Defensive guard: expectedVersion is guaranteed by requireVersion: true in wrapHandler,
  // but guard explicitly so a misconfiguration produces a clean error rather than a TypeError.
  const expectedVersion = ctx.expectedVersion;
  if (expectedVersion === undefined) {
    throw new AppError(
      ErrorCode.PRECONDITION_REQUIRED,
      "If-Match header is required"
    );
  }

  // Build dynamic update expression from provided fields
  const expressionParts: string[] = [
    "updatedAt = :updatedAt",
    "version = :nextVer",
  ];
  const expressionValues: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
    ":nextVer": nextVersion(expectedVersion),
    ":expectedVersion": expectedVersion,
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
          "attribute_exists(PK) AND attribute_not_exists(deletedAt) AND version = :expectedVersion",
        returnValues: "ALL_NEW",
      },
      logger
    );
  } catch (error) {
    if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
      // Pre-read confirmed existence, so ConditionalCheckFailed = version conflict
      throw AppError.build(
        ErrorCode.VERSION_CONFLICT,
        "Save was modified by another request"
      )
        .withDetails({ currentVersion: existingItem.version })
        .create();
    }
    throw error;
  }

  if (!updated) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      "Failed to retrieve updated save"
    );
  }

  // Fire-and-forget EventBridge event emission
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

  // Event history recording (Story 3.2.7) — awaited, catches I/O errors internally
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of updatedFields) {
    before[field] = existingItem[field as keyof SaveItem];
    after[field] = updated[field as keyof SaveItem];
  }

  // recordEvent() is internally fire-and-forget for I/O errors; let validation
  // errors propagate so programming bugs surface during development.
  await recordEvent(
    client,
    {
      entityType: "save",
      entityId: saveId,
      userId,
      eventType: "SaveMetadataUpdated",
      actorType: ctx.actorType,
      actorId: ctx.agentId ?? undefined,
      changes: { changedFields: updatedFields, before, after },
      context: body.context ?? undefined,
      requestId: ctx.requestId,
    },
    logger
  );

  return createSuccessResponse(toPublicSave(updated), requestId);
}

export const handler = wrapHandler(savesUpdateHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
  idempotent: true,
  requireVersion: true,
  rateLimit: savesWriteRateLimit,
});
