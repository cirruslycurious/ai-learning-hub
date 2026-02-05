import { describe, it, expect } from "vitest";
import {
  validate,
  safeValidate,
  validateJsonBody,
  validateQueryParams,
  validatePathParams,
  formatZodErrors,
  z,
} from "../src/validator.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

describe("Validation Utilities", () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  describe("validate", () => {
    it("should return data for valid input", () => {
      const result = validate(testSchema, { name: "John", age: 30 });
      expect(result.name).toBe("John");
      expect(result.age).toBe(30);
    });

    it("should throw AppError for invalid input", () => {
      expect(() => validate(testSchema, { name: "", age: -1 })).toThrow(
        AppError
      );
    });

    it("should throw VALIDATION_ERROR code", () => {
      try {
        validate(testSchema, { name: "", age: -1 });
      } catch (error) {
        expect(AppError.isAppError(error)).toBe(true);
        if (AppError.isAppError(error)) {
          expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
        }
      }
    });

    it("should include validation details", () => {
      try {
        validate(testSchema, { name: "", age: -1 });
      } catch (error) {
        if (AppError.isAppError(error)) {
          expect(error.details?.errors).toBeDefined();
          expect(Array.isArray(error.details?.errors)).toBe(true);
        }
      }
    });
  });

  describe("safeValidate", () => {
    it("should return success for valid input", () => {
      const result = safeValidate(testSchema, { name: "Jane", age: 25 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Jane");
      }
    });

    it("should return errors for invalid input", () => {
      const result = safeValidate(testSchema, {
        name: "",
        age: "not-a-number",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("validateJsonBody", () => {
    it("should parse and validate JSON body", () => {
      const body = JSON.stringify({ name: "Test", age: 42 });
      const result = validateJsonBody(testSchema, body);
      expect(result.name).toBe("Test");
    });

    it("should throw for null body", () => {
      expect(() => validateJsonBody(testSchema, null)).toThrow(AppError);
    });

    it("should throw for undefined body", () => {
      expect(() => validateJsonBody(testSchema, undefined)).toThrow(AppError);
    });

    it("should throw for invalid JSON", () => {
      expect(() => validateJsonBody(testSchema, "not-json")).toThrow(AppError);
    });

    it("should throw for valid JSON but invalid schema", () => {
      const body = JSON.stringify({ name: "", age: -1 });
      expect(() => validateJsonBody(testSchema, body)).toThrow(AppError);
    });
  });

  describe("validateQueryParams", () => {
    it("should validate query parameters", () => {
      const schema = z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
      });
      const result = validateQueryParams(schema, { page: "1", limit: "10" });
      expect(result.page).toBe("1");
    });

    it("should handle null params", () => {
      const schema = z.object({}).passthrough();
      const result = validateQueryParams(schema, null);
      expect(result).toEqual({});
    });
  });

  describe("validatePathParams", () => {
    it("should validate path parameters", () => {
      const schema = z.object({
        id: z.string().uuid(),
      });
      const result = validatePathParams(schema, {
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("should throw for null params", () => {
      const schema = z.object({ id: z.string() });
      expect(() => validatePathParams(schema, null)).toThrow(AppError);
    });
  });

  describe("formatZodErrors", () => {
    it("should format Zod errors into structured array", () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().positive(),
      });
      const result = schema.safeParse({ email: "invalid", age: -1 });

      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted[0]).toHaveProperty("field");
        expect(formatted[0]).toHaveProperty("message");
        expect(formatted[0]).toHaveProperty("code");
      }
    });

    it("should handle nested field paths", () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      });
      const result = schema.safeParse({ user: { email: "invalid" } });

      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted[0].field).toBe("user.email");
      }
    });
  });
});
