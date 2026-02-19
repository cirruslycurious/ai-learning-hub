import { describe, it, expect } from "vitest";
import { createSaveSchema, updateSaveSchema } from "../src/schemas.js";

describe("Save Schemas", () => {
  describe("createSaveSchema", () => {
    it("should accept valid input with all fields", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com/article",
        title: "Great Article",
        userNotes: "Very informative",
        contentType: "video",
        tags: ["learning", "typescript"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid input with only required url", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com/article",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual([]); // default empty array
      }
    });

    it("should reject missing url with field-level error", () => {
      const result = createSaveSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("url");
      }
    });

    it("should reject invalid url with field-level error", () => {
      const result = createSaveSchema.safeParse({ url: "not-a-url" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("url");
      }
    });

    it("should reject ftp url", () => {
      const result = createSaveSchema.safeParse({
        url: "ftp://example.com/file",
      });
      expect(result.success).toBe(false);
    });

    it("should reject URL with embedded credentials", () => {
      const result = createSaveSchema.safeParse({
        url: "https://user:pass@example.com/path",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty-string title", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        title: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only title", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        title: "   ",
      });
      expect(result.success).toBe(false);
    });

    it("should trim title whitespace", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        title: "  My Title  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("My Title");
      }
    });

    it("should reject title over 500 chars", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        title: "x".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should accept title at exactly 500 chars", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        title: "x".repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty-string userNotes", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        userNotes: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only userNotes", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        userNotes: "   ",
      });
      expect(result.success).toBe(false);
    });

    it("should reject userNotes over 2000 chars", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        userNotes: "x".repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it("should accept userNotes at exactly 2000 chars", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        userNotes: "x".repeat(2000),
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid contentType", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        contentType: "INVALID",
      });
      expect(result.success).toBe(false);
    });

    it("should accept all valid contentType values", () => {
      const types = [
        "article",
        "video",
        "podcast",
        "github_repo",
        "newsletter",
        "tool",
        "reddit",
        "linkedin",
        "other",
      ];
      for (const type of types) {
        const result = createSaveSchema.safeParse({
          url: "https://example.com",
          contentType: type,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject more than 20 tags", () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        tags,
      });
      expect(result.success).toBe(false);
    });

    it("should reject tags over 50 chars with field-level error", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        tags: ["a".repeat(51)],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("tags");
      }
    });

    it("should trim and deduplicate tags", () => {
      const result = createSaveSchema.safeParse({
        url: "https://example.com",
        tags: [" foo ", "foo", " bar "],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(["foo", "bar"]);
      }
    });
  });

  describe("updateSaveSchema", () => {
    it("should accept valid update with title", () => {
      const result = updateSaveSchema.safeParse({ title: "New Title" });
      expect(result.success).toBe(true);
    });

    it("should accept valid update with userNotes", () => {
      const result = updateSaveSchema.safeParse({
        userNotes: "Updated notes",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid update with contentType", () => {
      const result = updateSaveSchema.safeParse({ contentType: "podcast" });
      expect(result.success).toBe(true);
    });

    it("should accept valid update with tags", () => {
      const result = updateSaveSchema.safeParse({ tags: ["new-tag"] });
      expect(result.success).toBe(true);
    });

    it("should accept update with multiple fields", () => {
      const result = updateSaveSchema.safeParse({
        title: "New Title",
        contentType: "article",
        tags: ["updated"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty object (no fields provided)", () => {
      const result = updateSaveSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should NOT include url field (immutable after creation)", () => {
      const result = updateSaveSchema.safeParse({
        url: "https://new-url.com",
        title: "Title",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // url should be stripped (not in schema)
        expect("url" in result.data).toBe(false);
      }
    });

    it("should reject title over 500 chars", () => {
      const result = updateSaveSchema.safeParse({
        title: "x".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject userNotes over 2000 chars", () => {
      const result = updateSaveSchema.safeParse({
        userNotes: "x".repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid contentType", () => {
      const result = updateSaveSchema.safeParse({
        contentType: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });
});
