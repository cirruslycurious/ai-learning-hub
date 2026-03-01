/**
 * Event history storage layer for DynamoDB (Story 3.2.3)
 *
 * Records and queries per-entity event history for audit, debugging,
 * and agent reconciliation. Fire-and-forget design — recordEvent()
 * catches DynamoDB write failures internally and logs at WARN level.
 *
 * PK pattern: EVENTS#{entityType}#{entityId}
 * SK pattern: EVENT#{timestamp}#{eventId}
 */
import { ulid } from "ulidx";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type {
  EntityEvent,
  RecordEventParams,
  EventEntityType,
  EventHistoryQueryOptions,
  EventHistoryResponse,
} from "@ai-learning-hub/types";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import { createLogger, type Logger } from "@ai-learning-hub/logging";
import {
  requireEnv,
  putItem,
  queryItems,
  type TableConfig,
} from "./helpers.js";

/** 90 days in seconds */
const TTL_SECONDS = 90 * 24 * 60 * 60;

/** Maximum allowed limit for event queries */
const MAX_QUERY_LIMIT = 200;

/** Default limit when not specified */
const DEFAULT_QUERY_LIMIT = 50;

/** Max changes diff size before truncation (bytes) */
const MAX_CHANGES_SIZE = 10 * 1024;

/**
 * Events table configuration
 */
export const EVENTS_TABLE_CONFIG: TableConfig = {
  tableName: requireEnv("EVENTS_TABLE_NAME", "dev-ai-learning-hub-events"),
  partitionKey: "PK",
  sortKey: "SK",
};

/**
 * Valid entity types
 */
const VALID_ENTITY_TYPES: EventEntityType[] = [
  "save",
  "project",
  "tutorial",
  "link",
  "user",
  "apiKey",
];

/**
 * Valid actor types
 */
const VALID_ACTOR_TYPES = ["human", "agent"] as const;

/**
 * Validate RecordEventParams — checks required fields, entity type, and actor type
 */
function validateRecordEventParams(params: RecordEventParams): string[] {
  const errors: string[] = [];

  if (!params.entityType) {
    errors.push("entityType: Required");
  } else if (!VALID_ENTITY_TYPES.includes(params.entityType)) {
    errors.push(
      `entityType: Invalid value. Expected ${VALID_ENTITY_TYPES.join(" | ")}`
    );
  }

  if (!params.entityId) errors.push("entityId: Required");
  if (!params.userId) errors.push("userId: Required");
  if (!params.eventType) errors.push("eventType: Required");

  if (!params.actorType) {
    errors.push("actorType: Required");
  } else if (
    !VALID_ACTOR_TYPES.includes(
      params.actorType as (typeof VALID_ACTOR_TYPES)[number]
    )
  ) {
    errors.push(
      `actorType: Invalid value. Expected ${VALID_ACTOR_TYPES.join(" | ")}`
    );
  }

  if (!params.requestId) errors.push("requestId: Required");

  return errors;
}

/**
 * Build PK for event history records
 */
export function buildEventPK(
  entityType: EventEntityType,
  entityId: string
): string {
  return `EVENTS#${entityType}#${entityId}`;
}

/**
 * Build SK for event history records
 */
export function buildEventSK(timestamp: string, eventId: string): string {
  return `EVENT#${timestamp}#${eventId}`;
}

/**
 * Truncate changes if the diff exceeds MAX_CHANGES_SIZE.
 * Falls back to changedFields only.
 */
function truncateChanges(
  changes: RecordEventParams["changes"],
  logger: Logger
): RecordEventParams["changes"] {
  if (!changes) return changes;

  const serialized = JSON.stringify(changes);
  if (serialized.length <= MAX_CHANGES_SIZE) return changes;

  const changedFields: string[] = [];
  if (changes.before) changedFields.push(...Object.keys(changes.before));
  if (changes.after) changedFields.push(...Object.keys(changes.after));
  const unique = Array.from(new Set(changedFields));

  logger.warn("Event changes exceeded 10KB, truncating to field names", {
    originalSize: serialized.length,
    changedFields: unique,
  });

  return { changedFields: unique };
}

/**
 * ISO 8601 date validation regex (simplified — accepts common formats)
 */
/* eslint-disable security/detect-unsafe-regex -- fixed ISO 8601 pattern, no user input */
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})$/;
/* eslint-enable security/detect-unsafe-regex */

/**
 * Validate that a string is a valid ISO 8601 date
 */
function isValidISO8601(value: string): boolean {
  if (!ISO_8601_REGEX.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Record an event in the events table.
 *
 * Fire-and-forget design: DynamoDB write failures are caught internally,
 * logged at WARN level, and do NOT propagate to callers. The event object
 * is always returned (even if the write failed). Validation errors for
 * invalid params still throw AppError.
 */
export async function recordEvent(
  client: DynamoDBDocumentClient,
  params: RecordEventParams,
  logger?: Logger
): Promise<EntityEvent> {
  const log = logger ?? createLogger();

  // Validate required fields
  const validationErrors = validateRecordEventParams(params);
  if (validationErrors.length > 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid event params: ${validationErrors.join(", ")}`
    );
  }

  const eventId = ulid();
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  const changes = truncateChanges(params.changes ?? null, log) ?? null;

  const event: EntityEvent = {
    PK: buildEventPK(params.entityType as EventEntityType, params.entityId),
    SK: buildEventSK(timestamp, eventId),
    eventId,
    entityType: params.entityType as EventEntityType,
    entityId: params.entityId,
    userId: params.userId,
    eventType: params.eventType,
    actorType: params.actorType as "human" | "agent",
    actorId: params.actorId ?? null,
    timestamp,
    changes,
    context: params.context ?? null,
    requestId: params.requestId,
    ttl,
  };

  try {
    await putItem(
      client,
      EVENTS_TABLE_CONFIG,
      event as unknown as Record<string, unknown>,
      {},
      log
    );

    log.info("Event recorded", {
      eventId,
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      actorType: params.actorType,
    });
  } catch (err) {
    log.warn("Event recording failed (fire-and-forget)", {
      error: String(err),
      eventId,
      entityType: params.entityType,
      entityId: params.entityId,
    });
  }

  return event;
}

/**
 * Query events for a specific entity.
 *
 * Returns events newest-first with cursor-based pagination.
 */
export async function queryEntityEvents(
  client: DynamoDBDocumentClient,
  entityType: EventEntityType,
  entityId: string,
  options?: EventHistoryQueryOptions,
  logger?: Logger
): Promise<EventHistoryResponse> {
  const log = logger ?? createLogger();

  // Validate `since` if provided
  if (options?.since !== undefined) {
    if (!isValidISO8601(options.since)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid query parameter",
        {
          fields: [
            {
              field: "since",
              message: "Must be ISO 8601 format",
              code: "invalid_string",
            },
          ],
        }
      );
    }
  }

  // Cap limit at MAX_QUERY_LIMIT, floor at 1
  const limit = Math.max(
    1,
    Math.min(options?.limit ?? DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT)
  );

  const pk = buildEventPK(entityType, entityId);

  // Build key condition — optionally filter by since
  let keyConditionExpression = "PK = :pk";
  const expressionAttributeValues: Record<string, unknown> = { ":pk": pk };

  if (options?.since) {
    keyConditionExpression += " AND SK > :sinceKey";
    expressionAttributeValues[":sinceKey"] = `EVENT#${options.since}`;
  }

  const result = await queryItems<EntityEvent>(
    client,
    EVENTS_TABLE_CONFIG,
    {
      keyConditionExpression,
      expressionAttributeValues,
      scanIndexForward: false, // Newest first
      limit,
      cursor: options?.cursor,
    },
    log
  );

  return {
    events: result.items,
    cursor: result.cursor ?? null,
  };
}
