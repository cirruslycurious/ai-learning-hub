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
  toPublicSave,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createSuccessResponse,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";
import {
  updateSaveSchema,
  validateJsonBody,
  validatePathParams,
  z,
} from "@ai-learning-hub/validation";
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
 * PATCH /saves/:saveId — Update save metadata.
 */
async function savesUpdateHandler(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  const { saveId } = validatePathParams(saveIdPathSchema, event.pathParameters);
  const body = validateJsonBody(updateSaveSchema, event.body);

  const client = getDefaultClient();

  // Rate limit: 200 writes per hour (shared bucket with create/delete/restore)
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
    if (
      error instanceof Error &&
      "code" in error &&
      (error as AppError).code === ErrorCode.NOT_FOUND
    ) {
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
  const busName = EVENT_BUS_NAME ?? "";
  emitEvent<SavesEventDetailType, SavesEventDetail>(
    ebClient,
    busName,
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

  return createSuccessResponse(toPublicSave(updated), requestId);
}

export const handler = wrapHandler(savesUpdateHandler, {
  requireAuth: true,
  requiredScope: "saves:write",
});
