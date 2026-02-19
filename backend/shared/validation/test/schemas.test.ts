import { describe, it, expect } from "vitest";
import {
  uuidSchema,
  urlSchema,
  emailSchema,
  nonEmptyStringSchema,
  paginationSchema,
  paginationQuerySchema,
  sortDirectionSchema,
  isoDateSchema,
  contentTypeSchema,
  tutorialStatusSchema,
  projectStatusSchema,
  tagsSchema,
  userIdSchema,
  apiKeyScopeSchema,
  apiKeyScopesSchema,
  updateProfileBodySchema,
} from "../src/schemas.js";

describe("Validation Schemas", () => {
  describe("uuidSchema", () => {
    it("should accept valid UUID", () => {
      const result = uuidSchema.safeParse(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = uuidSchema.safeParse("not-a-uuid");
      expect(result.success).toBe(false);
    });
  });

  describe("urlSchema", () => {
    it("should accept valid https URL", () => {
      const result = urlSchema.safeParse("https://example.com/path");
      expect(result.success).toBe(true);
    });

    it("should accept valid http URL", () => {
      const result = urlSchema.safeParse("http://example.com");
      expect(result.success).toBe(true);
    });

    it("should reject ftp URL", () => {
      const result = urlSchema.safeParse("ftp://example.com");
      expect(result.success).toBe(false);
    });

    it("should reject invalid URL", () => {
      const result = urlSchema.safeParse("not-a-url");
      expect(result.success).toBe(false);
    });

    it("should reject URLs with embedded credentials (user:pass@)", () => {
      const result = urlSchema.safeParse("https://user:pass@example.com/path");
      expect(result.success).toBe(false);
    });

    it("should reject URLs with username only", () => {
      const result = urlSchema.safeParse("https://user@example.com/path");
      expect(result.success).toBe(false);
    });
  });

  describe("emailSchema", () => {
    it("should accept valid email", () => {
      const result = emailSchema.safeParse("test@example.com");
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = emailSchema.safeParse("not-an-email");
      expect(result.success).toBe(false);
    });
  });

  describe("nonEmptyStringSchema", () => {
    it("should accept non-empty string", () => {
      const result = nonEmptyStringSchema.safeParse("hello");
      expect(result.success).toBe(true);
    });

    it("should reject empty string", () => {
      const result = nonEmptyStringSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("paginationSchema", () => {
    it("should accept valid pagination params", () => {
      const result = paginationSchema.safeParse({
        limit: 20,
        cursor: "abc123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.cursor).toBe("abc123");
      }
    });

    it("should apply defaults", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it("should reject limit over 100", () => {
      const result = paginationSchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });

    it("should reject limit under 1", () => {
      const result = paginationSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe("paginationQuerySchema", () => {
    it("should coerce limit from string (query params)", () => {
      const result = paginationQuerySchema.safeParse({
        limit: "25",
        cursor: "next",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.cursor).toBe("next");
      }
    });

    it("should apply defaults when limit omitted", () => {
      const result = paginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it("should reject non-numeric limit string", () => {
      const result = paginationQuerySchema.safeParse({ limit: "abc" });
      expect(result.success).toBe(false);
    });
  });

  describe("sortDirectionSchema", () => {
    it("should accept asc", () => {
      const result = sortDirectionSchema.safeParse("asc");
      expect(result.success).toBe(true);
    });

    it("should accept desc", () => {
      const result = sortDirectionSchema.safeParse("desc");
      expect(result.success).toBe(true);
    });

    it("should reject invalid direction", () => {
      const result = sortDirectionSchema.safeParse("up");
      expect(result.success).toBe(false);
    });
  });

  describe("isoDateSchema", () => {
    it("should accept valid ISO date", () => {
      const result = isoDateSchema.safeParse("2026-02-04T12:00:00.000Z");
      expect(result.success).toBe(true);
    });

    it("should reject invalid date", () => {
      const result = isoDateSchema.safeParse("not-a-date");
      expect(result.success).toBe(false);
    });
  });

  describe("contentTypeSchema", () => {
    it("should accept all valid content types (lowercase)", () => {
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
        const result = contentTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it("should reject old uppercase types", () => {
      const result = contentTypeSchema.safeParse("ARTICLE");
      expect(result.success).toBe(false);
    });

    it("should reject invalid type", () => {
      const result = contentTypeSchema.safeParse("INVALID");
      expect(result.success).toBe(false);
    });
  });

  describe("tutorialStatusSchema", () => {
    it("should accept valid lowercase statuses", () => {
      const statuses = ["saved", "started", "in-progress", "completed"];
      for (const status of statuses) {
        const result = tutorialStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("should reject old uppercase statuses", () => {
      const result = tutorialStatusSchema.safeParse("SAVED");
      expect(result.success).toBe(false);
    });
  });

  describe("projectStatusSchema", () => {
    it("should accept valid statuses", () => {
      const statuses = ["EXPLORING", "BUILDING", "PAUSED", "COMPLETED"];
      for (const status of statuses) {
        const result = projectStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("tagsSchema", () => {
    it("should accept valid tags array", () => {
      const result = tagsSchema.safeParse(["tag1", "tag2"]);
      expect(result.success).toBe(true);
    });

    it("should apply empty array default", () => {
      const result = tagsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("should reject more than 20 tags", () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      const result = tagsSchema.safeParse(tags);
      expect(result.success).toBe(false);
    });

    it("should accept up to 20 tags", () => {
      const tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
      const result = tagsSchema.safeParse(tags);
      expect(result.success).toBe(true);
    });

    it("should reject tags over 50 chars", () => {
      const result = tagsSchema.safeParse(["a".repeat(51)]);
      expect(result.success).toBe(false);
    });

    it("should reject empty tags", () => {
      const result = tagsSchema.safeParse([""]);
      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only tags", () => {
      const result = tagsSchema.safeParse(["   "]);
      expect(result.success).toBe(false);
    });

    it("should trim tags", () => {
      const result = tagsSchema.safeParse(["  hello  ", " world "]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(["hello", "world"]);
      }
    });

    it("should deduplicate tags after trimming", () => {
      const result = tagsSchema.safeParse([" foo ", "foo"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(["foo"]);
      }
    });

    it("should preserve order of first occurrence during dedup", () => {
      const result = tagsSchema.safeParse(["b", "a", "b", "c", "a"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(["b", "a", "c"]);
      }
    });
  });

  describe("userIdSchema", () => {
    it("should accept valid user ID", () => {
      const result = userIdSchema.safeParse("user_123abc");
      expect(result.success).toBe(true);
    });

    it("should reject empty user ID", () => {
      const result = userIdSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("apiKeyScopeSchema", () => {
    it("should accept valid scopes", () => {
      const scopes = ["*", "saves:write", "saves:read"];
      for (const scope of scopes) {
        const result = apiKeyScopeSchema.safeParse(scope);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid scope", () => {
      const result = apiKeyScopeSchema.safeParse("invalid:scope");
      expect(result.success).toBe(false);
    });
  });

  describe("apiKeyScopesSchema", () => {
    it("should accept valid scopes array", () => {
      const result = apiKeyScopesSchema.safeParse(["*"]);
      expect(result.success).toBe(true);
    });

    it("should reject empty array", () => {
      const result = apiKeyScopesSchema.safeParse([]);
      expect(result.success).toBe(false);
    });
  });

  describe("updateProfileBodySchema", () => {
    it("should accept valid displayName update", () => {
      const result = updateProfileBodySchema.safeParse({
        displayName: "Test User",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid globalPreferences update", () => {
      const result = updateProfileBodySchema.safeParse({
        globalPreferences: { theme: "dark" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept both displayName and globalPreferences", () => {
      const result = updateProfileBodySchema.safeParse({
        displayName: "Test",
        globalPreferences: { lang: "en" },
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty object (no fields)", () => {
      const result = updateProfileBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject empty displayName", () => {
      const result = updateProfileBodySchema.safeParse({ displayName: "" });
      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only displayName", () => {
      const result = updateProfileBodySchema.safeParse({
        displayName: "   ",
      });
      expect(result.success).toBe(false);
    });

    it("should trim displayName whitespace", () => {
      const result = updateProfileBodySchema.safeParse({
        displayName: "  Test User  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBe("Test User");
      }
    });

    it("should reject displayName exceeding 255 characters", () => {
      const result = updateProfileBodySchema.safeParse({
        displayName: "x".repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it("should reject globalPreferences exceeding 10KB", () => {
      const result = updateProfileBodySchema.safeParse({
        globalPreferences: { data: "x".repeat(11000) },
      });
      expect(result.success).toBe(false);
    });

    it("should accept globalPreferences under 10KB", () => {
      const result = updateProfileBodySchema.safeParse({
        globalPreferences: { data: "x".repeat(5000) },
      });
      expect(result.success).toBe(true);
    });
  });
});
