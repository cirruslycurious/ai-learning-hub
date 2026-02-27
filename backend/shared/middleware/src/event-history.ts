/**
 * Event history handler generator (Story 3.2.3)
 *
 * Creates a wrapHandler-compatible handler for GET /:entity/:id/events
 * endpoints. Validates entity ownership, parses query parameters,
 * and returns events in envelope format.
 */
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  AppError,
  ErrorCode,
  type EventEntityType,
  type PublicEntityEvent,
} from "@ai-learning-hub/types";
import { queryEntityEvents } from "@ai-learning-hub/db";
import {
  validateQueryParams,
  paginationQuerySchema,
} from "@ai-learning-hub/validation";
import type { HandlerContext } from "./wrapper.js";
import { createSuccessResponse } from "./error-handler.js";

/**
 * Configuration for createEventHistoryHandler
 */
export interface EventHistoryHandlerConfig {
  entityType: EventEntityType;
  entityExistsFn: (userId: string, entityId: string) => Promise<boolean>;
  client: DynamoDBDocumentClient;
}

/**
 * Create a wrapHandler-compatible handler for entity event history.
 *
 * Consumers wire it like:
 * ```
 * export const handler = wrapHandler(
 *   createEventHistoryHandler({ entityType: "save", entityExistsFn, client }),
 *   { requireAuth: true }
 * );
 * ```
 */
export function createEventHistoryHandler(config: EventHistoryHandlerConfig) {
  return async function eventHistoryHandler(ctx: HandlerContext) {
    const { event, auth, requestId, logger } = ctx;

    const entityId = event.pathParameters?.id;
    if (!entityId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Missing entity ID in path"
      );
    }

    const userId = auth?.userId;
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required");
    }

    // Verify entity exists and belongs to user
    const exists = await config.entityExistsFn(userId, entityId);
    if (!exists) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `${config.entityType.charAt(0).toUpperCase() + config.entityType.slice(1)} not found`
      );
    }

    // Validate pagination params via shared schema (Story 3.2.5, AC13)
    const { limit, cursor } = validateQueryParams(
      paginationQuerySchema,
      event.queryStringParameters
    );
    const since = event.queryStringParameters?.since;

    const result = await queryEntityEvents(
      config.client,
      config.entityType,
      entityId,
      { since, limit, cursor },
      logger
    );

    // Strip DynamoDB internal fields (PK, SK, ttl) before returning
    const publicEvents: PublicEntityEvent[] = result.events.map(
      ({ PK: _PK, SK: _SK, ttl: _ttl, ...rest }) => rest
    );

    // Story 3.2.5 AC12: use meta.cursor (not meta.nextCursor), remove hasMore
    return createSuccessResponse(publicEvents, requestId, {
      meta: {
        cursor: result.nextCursor,
        total: publicEvents.length,
      },
    });
  };
}
