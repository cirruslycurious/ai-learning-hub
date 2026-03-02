/**
 * Saves Create Endpoint — POST /saves
 *
 * Creates a new save (URL bookmark) with two-layer duplicate detection.
 * Auto-restores soft-deleted saves on re-save.
 *
 * Story 3.1b: Create Save API (Epic 3).
 * Story 3.2.7: Retrofitted with idempotency, rate limiting, event recording,
 *              version field, scope permissions, and context metadata.
 */
import {
  getDefaultClient,
  queryItems,
  updateItem,
  transactWriteItems,
  TransactionCancelledError,
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
import {
  AppError,
  ErrorCode,
  ContentType,
  INITIAL_VERSION,
} from "@ai-learning-hub/types";
import type { SaveItem, PublicSave } from "@ai-learning-hub/types";
import {
  normalizeUrl,
  detectContentType,
  createSaveSchema,
  validateJsonBody,
  NormalizeError,
} from "@ai-learning-hub/validation";
import {
  emitEvent,
  requireEventBus,
  SAVES_EVENT_SOURCE,
  type SavesEventDetailType,
  type SavesEventDetail,
} from "@ai-learning-hub/events";
import { ulid } from "ulidx";

const eventBus = requireEventBus();

/** Build a 409 duplicate response with the existing save. */
function createDuplicateResponse(existingSave: PublicSave, requestId: string) {
  return {
    statusCode: 409,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    },
    body: JSON.stringify({
      error: {
        code: "DUPLICATE_SAVE",
        message: "URL already saved",
        requestId,
      },
      existingSave,
    }),
  };
}

/**
 * POST /saves — Create a new URL save.
 */
async function savesCreateHandler(ctx: HandlerContext) {
  const { event, auth, logger, requestId } = ctx;
  const userId = auth!.userId;

  // Validate request body
  const body = validateJsonBody(createSaveSchema, event.body);

  const client = getDefaultClient();

  // Normalize URL and compute hash
  let normalizedUrl: string;
  let urlHash: string;
  try {
    const result = normalizeUrl(body.url);
    normalizedUrl = result.normalizedUrl;
    urlHash = result.urlHash;
  } catch (error) {
    if (error instanceof NormalizeError) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, error.message);
    }
    throw error;
  }

  // Detect content type (user-provided takes precedence)
  const contentType = detectContentType(
    body.url,
    body.contentType as ContentType | undefined
  );

  // --- Layer 1: Fast-path duplicate check via GSI ---
  const layer1Result = await queryItems<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    {
      keyConditionExpression: "urlHash = :urlHash",
      expressionAttributeValues: {
        ":urlHash": urlHash,
        ":pk": `USER#${userId}`,
      },
      filterExpression: "PK = :pk AND attribute_not_exists(deletedAt)",
      indexName: "urlHash-index",
    },
    logger
  );

  if (layer1Result.items.length > 0) {
    return createDuplicateResponse(
      toPublicSave(layer1Result.items[0]),
      requestId
    );
  }

  // --- Build save item ---
  const now = new Date().toISOString();
  const saveId = ulid();

  const saveItem: SaveItem = {
    PK: `USER#${userId}`,
    SK: `SAVE#${saveId}`,
    userId,
    saveId,
    url: body.url,
    normalizedUrl,
    urlHash,
    ...(body.title !== undefined && { title: body.title }),
    ...(body.userNotes !== undefined && { userNotes: body.userNotes }),
    contentType,
    tags: body.tags ?? [],
    isTutorial: false,
    linkedProjectCount: 0,
    version: INITIAL_VERSION,
    createdAt: now,
    updatedAt: now,
  };

  const markerItem = {
    PK: `USER#${userId}`,
    SK: `URL#${urlHash}`,
  };

  // --- Layer 2: Atomic write (save + uniqueness marker) ---
  try {
    await transactWriteItems(
      client,
      [
        {
          Put: {
            TableName: SAVES_TABLE_CONFIG.tableName,
            Item: saveItem,
          },
        },
        {
          Put: {
            TableName: SAVES_TABLE_CONFIG.tableName,
            Item: markerItem,
            ConditionExpression: "attribute_not_exists(SK)",
          },
        },
      ],
      logger
    );
  } catch (error) {
    if (error instanceof TransactionCancelledError) {
      // Marker already exists — either active duplicate or soft-deleted save
      return handleTransactionFailure(
        client,
        userId,
        urlHash,
        requestId,
        body.context,
        ctx,
        logger
      );
    }
    throw error;
  }

  // Fire-and-forget EventBridge event emission
  emitEvent<SavesEventDetailType, SavesEventDetail>(
    eventBus.ebClient,
    eventBus.busName,
    {
      source: SAVES_EVENT_SOURCE,
      detailType: "SaveCreated",
      detail: {
        userId,
        saveId,
        url: body.url,
        normalizedUrl,
        urlHash,
        contentType,
      },
    },
    logger
  );

  // Event history recording (Story 3.2.7) — awaited, but recordEvent() catches
  // I/O errors internally. Validation errors propagate to surface programming bugs.
  await recordEvent(
    client,
    {
      entityType: "save",
      entityId: saveId,
      userId,
      eventType: "SaveCreated",
      actorType: ctx.actorType,
      actorId: ctx.agentId ?? undefined,
      changes: {
        after: {
          url: body.url,
          title: body.title,
          contentType,
          tags: body.tags ?? [],
        },
      },
      context: body.context ?? undefined,
      requestId: ctx.requestId,
    },
    logger
  );

  return createSuccessResponse(toPublicSave(saveItem), requestId, {
    statusCode: 201,
  });
}

/**
 * Handle Layer 2 transaction failure: re-query to determine if it's a
 * duplicate (409), a soft-deleted save (auto-restore → 200), or an
 * orphaned marker (data anomaly → 500).
 */
async function handleTransactionFailure(
  client: ReturnType<typeof getDefaultClient>,
  userId: string,
  urlHash: string,
  requestId: string,
  context: Record<string, unknown> | undefined,
  ctx: HandlerContext,
  logger: HandlerContext["logger"]
) {
  // Check for active save
  const activeResult = await queryItems<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    {
      keyConditionExpression: "urlHash = :urlHash",
      expressionAttributeValues: {
        ":urlHash": urlHash,
        ":pk": `USER#${userId}`,
      },
      filterExpression: "PK = :pk AND attribute_not_exists(deletedAt)",
      indexName: "urlHash-index",
    },
    logger
  );

  if (activeResult.items.length > 0) {
    return createDuplicateResponse(
      toPublicSave(activeResult.items[0]),
      requestId
    );
  }

  // Check for soft-deleted save
  const softDeletedResult = await queryItems<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    {
      keyConditionExpression: "urlHash = :urlHash",
      expressionAttributeValues: {
        ":urlHash": urlHash,
        ":pk": `USER#${userId}`,
      },
      filterExpression: "PK = :pk AND attribute_exists(deletedAt)",
      indexName: "urlHash-index",
    },
    logger
  );

  if (softDeletedResult.items.length > 0) {
    const softDeleted = softDeletedResult.items[0];
    const now = new Date().toISOString();

    try {
      const restored = await updateItem<SaveItem>(
        client,
        SAVES_TABLE_CONFIG,
        {
          key: { PK: `USER#${userId}`, SK: softDeleted.SK },
          updateExpression:
            "REMOVE deletedAt SET updatedAt = :now, version = :nextVer",
          expressionAttributeValues: {
            ":now": now,
            ":nextVer": softDeleted.version + 1,
          },
          conditionExpression: "attribute_exists(deletedAt)",
          returnValues: "ALL_NEW",
        },
        logger
      );

      // Fire-and-forget SaveRestored event
      emitEvent<SavesEventDetailType, SavesEventDetail>(
        eventBus.ebClient,
        eventBus.busName,
        {
          source: SAVES_EVENT_SOURCE,
          detailType: "SaveRestored",
          detail: {
            userId,
            saveId: softDeleted.saveId,
            url: softDeleted.url,
            normalizedUrl: softDeleted.normalizedUrl,
            urlHash: softDeleted.urlHash,
            contentType: softDeleted.contentType,
          },
        },
        logger
      );

      // Event history recording — awaited, catches I/O errors internally
      await recordEvent(
        client,
        {
          entityType: "save",
          entityId: softDeleted.saveId,
          userId,
          eventType: "SaveRestored",
          actorType: ctx.actorType,
          actorId: ctx.agentId ?? undefined,
          context: context ?? undefined,
          requestId: ctx.requestId,
        },
        logger
      );

      return createSuccessResponse(
        toPublicSave(restored ?? softDeleted),
        requestId
      );
    } catch (error) {
      if (AppError.isAppError(error) && error.code === ErrorCode.NOT_FOUND) {
        // ConditionalCheckFailed means another request already restored it — treat as success
        return createSuccessResponse(toPublicSave(softDeleted), requestId);
      }
      throw error;
    }
  }

  // No save found at all — orphaned marker (data anomaly)
  logger.error(
    "Save state inconsistency detected",
    new Error("Orphaned URL marker"),
    {
      userId,
      urlHash,
      requestId,
    }
  );
  throw new AppError(
    ErrorCode.INTERNAL_ERROR,
    "Save state inconsistency detected"
  );
}

export const handler = wrapHandler(savesCreateHandler, {
  requireAuth: true,
  requiredScope: "saves:create",
  idempotent: true,
  rateLimit: savesWriteRateLimit,
});
