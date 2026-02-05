import { describe, it, expect } from "vitest";
import {
  uuidSchema,
  urlSchema,
  emailSchema,
  nonEmptyStringSchema,
  paginationSchema,
  sortDirectionSchema,
  isoDateSchema,
  resourceTypeSchema,
  tutorialStatusSchema,
  projectStatusSchema,
  tagsSchema,
  userIdSchema,
  apiKeyScopeSchema,
  apiKeyScopesSchema,
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

  describe("resourceTypeSchema", () => {
    it("should accept valid resource types", () => {
      const types = [
        "ARTICLE",
        "VIDEO",
        "PODCAST",
        "TUTORIAL",
        "DOCUMENTATION",
        "REPOSITORY",
        "OTHER",
      ];
      for (const type of types) {
        const result = resourceTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid type", () => {
      const result = resourceTypeSchema.safeParse("INVALID");
      expect(result.success).toBe(false);
    });
  });

  describe("tutorialStatusSchema", () => {
    it("should accept valid statuses", () => {
      const statuses = ["SAVED", "STARTED", "IN_PROGRESS", "COMPLETED"];
      for (const status of statuses) {
        const result = tutorialStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
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

    it("should reject more than 10 tags", () => {
      const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      const result = tagsSchema.safeParse(tags);
      expect(result.success).toBe(false);
    });

    it("should reject tags over 50 chars", () => {
      const result = tagsSchema.safeParse(["a".repeat(51)]);
      expect(result.success).toBe(false);
    });

    it("should reject empty tags", () => {
      const result = tagsSchema.safeParse([""]);
      expect(result.success).toBe(false);
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
});
