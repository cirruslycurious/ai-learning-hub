/**
 * Saves Event History Endpoint — GET /saves/:saveId/events
 *
 * Returns the audit trail for a specific save. Supports cursor pagination
 * and optional `since` filter. Soft-deleted saves retain their event history.
 *
 * Story 3.2.7: New endpoint using createEventHistoryHandler factory.
 */
import {
  getDefaultClient,
  getItem,
  SAVES_TABLE_CONFIG,
} from "@ai-learning-hub/db";
import {
  wrapHandler,
  createEventHistoryHandler,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import type { SaveItem } from "@ai-learning-hub/types";

/**
 * Check if save exists for the user. Returns true for both active AND
 * soft-deleted saves — deleted saves retain their audit trail.
 */
async function entityExistsFn(
  userId: string,
  entityId: string
): Promise<boolean> {
  const client = getDefaultClient();
  const item = await getItem<SaveItem>(
    client,
    SAVES_TABLE_CONFIG,
    { PK: `USER#${userId}`, SK: `SAVE#${entityId}` },
    {}
  );
  return item !== null;
}

async function savesEventsHandler(ctx: HandlerContext) {
  const client = getDefaultClient();

  // Map saveId → id for the generic event history handler.
  // Create a shallow copy to avoid mutating the original event object.
  if (ctx.event.pathParameters?.saveId && !ctx.event.pathParameters?.id) {
    ctx.event.pathParameters = {
      ...ctx.event.pathParameters,
      id: ctx.event.pathParameters.saveId,
    };
  }

  const inner = createEventHistoryHandler({
    entityType: "save",
    entityExistsFn,
    client,
  });

  return inner(ctx);
}

export const handler = wrapHandler(savesEventsHandler, {
  requireAuth: true,
  requiredScope: "saves:read",
});
