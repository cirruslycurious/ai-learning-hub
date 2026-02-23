/**
 * EventBridge source for all Saves domain events.
 * Import this constant — do not repeat the string literal at call sites.
 */
export const SAVES_EVENT_SOURCE = "ai-learning-hub.saves" as const;

/**
 * Detail types for Saves domain events emitted in Epic 3.
 *
 * Discriminated union by detailType so existing SaveCreated/SaveRestored
 * call sites keep compiling without payload changes (Story 3.3).
 */
export type SavesEventDetailType =
  | "SaveCreated"
  | "SaveRestored"
  | "SaveUpdated"
  | "SaveDeleted";

/**
 * Detail shape for SaveCreated and SaveRestored events.
 * Includes full resource context for downstream consumers (enrichment pipeline).
 */
export interface SaveCreatedRestoredDetail {
  userId: string;
  saveId: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  /** Typed as string, not the ContentType enum — see Story 3.1c Dev Notes: ContentType */
  contentType: string;
}

/**
 * Detail shape for SaveUpdated events.
 * Includes the list of fields that were actually changed.
 */
export interface SaveUpdatedDetail {
  userId: string;
  saveId: string;
  normalizedUrl: string;
  urlHash: string;
  updatedFields: string[];
}

/**
 * Detail shape for SaveDeleted events.
 * Minimal — downstream consumers use this to remove from search index, etc.
 */
export interface SaveDeletedDetail {
  userId: string;
  saveId: string;
  normalizedUrl: string;
  urlHash: string;
}

/**
 * Union of all saves event detail shapes.
 * Use with emitEvent<SavesEventDetailType, SavesEventDetail>().
 *
 * Backwards-compatible: SaveCreatedRestoredDetail is assignable to the
 * previous flat SavesEventDetail shape used by Story 3.1b call sites.
 */
export type SavesEventDetail =
  | SaveCreatedRestoredDetail
  | SaveUpdatedDetail
  | SaveDeletedDetail;

/**
 * Mapped type that enforces compile-time coupling between a detailType string
 * and its corresponding detail interface. Consumers can use this to verify
 * that a given detailType is always paired with the correct detail shape.
 *
 * Example usage for type-safe event construction:
 *   type Detail = SavesEventMap["SaveDeleted"]; // SaveDeletedDetail
 */
export type SavesEventMap = {
  SaveCreated: SaveCreatedRestoredDetail;
  SaveRestored: SaveCreatedRestoredDetail;
  SaveUpdated: SaveUpdatedDetail;
  SaveDeleted: SaveDeletedDetail;
};
