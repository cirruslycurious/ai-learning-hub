/**
 * Shared test factories for the saves domain.
 *
 * Story 3.1.2, Tasks 1 & 4: Extract duplicated createSaveItem
 * and VALID_SAVE_ID from 5+ handler test files.
 */
import { ContentType } from "@ai-learning-hub/types";
import type { SaveItem } from "@ai-learning-hub/types";

export const VALID_SAVE_ID = "01HXYZ1234567890ABCDEFGHIJ";

/**
 * Creates a SaveItem for tests with sensible defaults.
 * Supports parameterized saveId and partial overrides.
 */
export function createTestSaveItem(
  saveId: string = VALID_SAVE_ID,
  overrides: Partial<SaveItem> = {}
): SaveItem {
  return {
    PK: "USER#user123",
    SK: `SAVE#${saveId}`,
    userId: "user123",
    saveId,
    url: `https://example.com/${saveId}`,
    normalizedUrl: `https://example.com/${saveId}`,
    urlHash: `hash-${saveId}`,
    contentType: ContentType.ARTICLE,
    tags: [],
    isTutorial: false,
    linkedProjectCount: 0,
    createdAt: "2026-02-20T00:00:00Z",
    updatedAt: "2026-02-20T00:00:00Z",
    ...overrides,
  };
}
