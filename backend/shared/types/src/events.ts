/**
 * Event history types for queryable entity audit logs (Story 3.2.3)
 */

/**
 * Valid entity types for event history records
 */
export type EventEntityType =
  | "save"
  | "project"
  | "tutorial"
  | "link"
  | "user"
  | "apiKey";

/**
 * Actor who performed the action
 */
export type ActorType = "human" | "agent";

/**
 * Context metadata for an event
 */
export interface EventContext {
  trigger?: string;
  source?: string;
  confidence?: number;
  upstream_ref?: string;
}

/**
 * Minimal diff of changed fields
 */
export interface EventChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
}

/**
 * Full event record as stored in DynamoDB
 */
export interface EntityEvent {
  PK: string;
  SK: string;
  eventId: string;
  entityType: EventEntityType;
  entityId: string;
  userId: string;
  eventType: string;
  actorType: ActorType;
  actorId: string | null;
  timestamp: string;
  changes: EventChanges | null;
  context: EventContext | null;
  requestId: string;
  ttl: number;
}

/**
 * Public event shape (PK/SK stripped for API responses)
 */
export type PublicEntityEvent = Omit<EntityEvent, "PK" | "SK" | "ttl">;

/**
 * Input parameters for recordEvent() — auto-generated fields omitted
 */
export interface RecordEventParams {
  entityType: EventEntityType;
  entityId: string;
  userId: string;
  eventType: string;
  actorType: ActorType;
  actorId?: string | null;
  changes?: EventChanges | null;
  context?: EventContext | null;
  requestId: string;
}

/**
 * Options for queryEntityEvents()
 */
export interface EventHistoryQueryOptions {
  since?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Response from queryEntityEvents()
 */
export interface EventHistoryResponse {
  events: EntityEvent[];
  cursor: string | null;
}
