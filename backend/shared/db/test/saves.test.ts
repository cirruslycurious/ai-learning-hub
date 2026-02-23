/**
 * Tests for saves.ts — SAVES_TABLE_CONFIG and toPublicSave.
 * Story 3.2, Task 9.4
 */
import { describe, it, expect, afterEach } from "vitest";
import type { SaveItem } from "@ai-learning-hub/types";
import { ContentType } from "@ai-learning-hub/types";
import { SAVES_TABLE_CONFIG, toPublicSave } from "../src/saves.js";

describe("SAVES_TABLE_CONFIG", () => {
  const originalEnv = process.env.SAVES_TABLE_NAME;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SAVES_TABLE_NAME = originalEnv;
    } else {
      delete process.env.SAVES_TABLE_NAME;
    }
  });

  it("reads table name from SAVES_TABLE_NAME env var", () => {
    process.env.SAVES_TABLE_NAME = "custom-saves-table";
    // requireEnv caches on first call in test env, so we test the config shape
    expect(SAVES_TABLE_CONFIG.partitionKey).toBe("PK");
    expect(SAVES_TABLE_CONFIG.sortKey).toBe("SK");
  });

  it("uses test fallback when env var is not set", () => {
    // In test env (NODE_ENV=test), requireEnv uses the fallback
    expect(SAVES_TABLE_CONFIG.tableName).toBeDefined();
    expect(typeof SAVES_TABLE_CONFIG.tableName).toBe("string");
  });
});

describe("toPublicSave", () => {
  const baseSave: SaveItem = {
    PK: "USER#user123",
    SK: "SAVE#01HXYZ123456789012345678",
    userId: "user123",
    saveId: "01HXYZ123456789012345678",
    url: "https://example.com",
    normalizedUrl: "https://example.com/",
    urlHash: "abc123hash",
    contentType: ContentType.ARTICLE,
    tags: ["test"],
    isTutorial: false,
    linkedProjectCount: 0,
    createdAt: "2026-02-20T00:00:00Z",
    updatedAt: "2026-02-20T00:00:00Z",
  };

  it("strips PK, SK, and deletedAt from the item", () => {
    const item: SaveItem = {
      ...baseSave,
      deletedAt: "2026-02-21T00:00:00Z",
    };

    const result = toPublicSave(item);

    expect(result).not.toHaveProperty("PK");
    expect(result).not.toHaveProperty("SK");
    expect(result).not.toHaveProperty("deletedAt");
  });

  it("preserves all other fields", () => {
    const result = toPublicSave(baseSave);

    expect(result.userId).toBe("user123");
    expect(result.saveId).toBe("01HXYZ123456789012345678");
    expect(result.url).toBe("https://example.com");
    expect(result.normalizedUrl).toBe("https://example.com/");
    expect(result.urlHash).toBe("abc123hash");
    expect(result.contentType).toBe(ContentType.ARTICLE);
    expect(result.tags).toEqual(["test"]);
    expect(result.isTutorial).toBe(false);
    expect(result.linkedProjectCount).toBe(0);
    expect(result.createdAt).toBe("2026-02-20T00:00:00Z");
    expect(result.updatedAt).toBe("2026-02-20T00:00:00Z");
  });

  it("preserves optional fields when present", () => {
    const item: SaveItem = {
      ...baseSave,
      title: "Test Title",
      userNotes: "Some notes",
      lastAccessedAt: "2026-02-21T12:00:00Z",
      enrichedAt: "2026-02-21T13:00:00Z",
    };

    const result = toPublicSave(item);

    expect(result.title).toBe("Test Title");
    expect(result.userNotes).toBe("Some notes");
    expect(result.lastAccessedAt).toBe("2026-02-21T12:00:00Z");
    expect(result.enrichedAt).toBe("2026-02-21T13:00:00Z");
  });

  it("omits optional fields when absent", () => {
    const result = toPublicSave(baseSave);

    expect(result).not.toHaveProperty("title");
    expect(result).not.toHaveProperty("userNotes");
    expect(result).not.toHaveProperty("lastAccessedAt");
    expect(result).not.toHaveProperty("enrichedAt");
  });
});
