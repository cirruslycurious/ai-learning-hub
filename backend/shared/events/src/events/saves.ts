/**
 * EventBridge source for all Saves domain events.
 * Import this constant — do not repeat the string literal at call sites.
 */
export const SAVES_EVENT_SOURCE = "ai-learning-hub.saves" as const;

/**
 * Detail types for Saves domain events emitted in Epic 3.
 * SaveUpdated and SaveDeleted will be added in Story 3.3 with their distinct detail shapes.
 */
export type SavesEventDetailType = "SaveCreated" | "SaveRestored";

export interface SavesEventDetail {
  userId: string;
  saveId: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  /** Typed as string, not the ContentType enum — see Story 3.1c Dev Notes: ContentType */
  contentType: string;
}
