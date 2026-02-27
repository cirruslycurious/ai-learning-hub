import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  validateCursor,
  buildPaginatedResponse,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../src/pagination.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

describe("Pagination Constants (AC5)", () => {
  it("exports DEFAULT_PAGE_SIZE = 25", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });

  it("exports MAX_PAGE_SIZE = 100", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});

describe("encodeCursor / decodeCursor (AC1)", () => {
  it("round-trips a single-key object", () => {
    const key = { saveId: "01HXYZ123456789ABCDEFGHIJK" };
    const cursor = encodeCursor(key);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(key);
  });

  it("round-trips a composite key (PK + SK)", () => {
    const key = { PK: "USER#abc", SK: "APIKEY#01ARK" };
    const cursor = encodeCursor(key);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(key);
  });

  it("round-trips keys with numeric values", () => {
    const key = { offset: 42, page: 3 };
    const cursor = encodeCursor(key);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(key);
  });

  it("round-trips keys with boolean values", () => {
    const key = { active: true, deleted: false };
    const cursor = encodeCursor(key);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(key);
  });

  it("round-trips keys with null values", () => {
    const key = { PK: "USER#123", optional: null };
    const cursor = encodeCursor(key);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual(key);
  });

  it("produces base64url encoding (no +, /, = characters)", () => {
    // Use a key that would produce + or / in standard base64
    const key = { data: "test?query=value&special=true" };
    const cursor = encodeCursor(key);
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it("rejects empty string cursor", () => {
    expect(() => decodeCursor("")).toThrow(AppError);
    try {
      decodeCursor("");
    } catch (e) {
      const err = e as AppError;
      expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(
        (err.details?.fields as Array<Record<string, string>>)?.[0]
      ).toEqual({
        field: "cursor",
        message: "Invalid cursor token",
        code: "invalid_string",
      });
    }
  });

  it("rejects non-base64 cursor", () => {
    expect(() => decodeCursor("not-valid-base64!!!")).toThrow(AppError);
  });

  it("rejects cursor that is valid base64 but not valid JSON", () => {
    const notJson = Buffer.from("not json at all").toString("base64url");
    expect(() => decodeCursor(notJson)).toThrow(AppError);
  });

  it("rejects cursor that decodes to a non-object (string)", () => {
    const stringCursor = Buffer.from(JSON.stringify("hello")).toString(
      "base64url"
    );
    expect(() => decodeCursor(stringCursor)).toThrow(AppError);
  });

  it("rejects cursor that decodes to a non-object (number)", () => {
    const numberCursor = Buffer.from(JSON.stringify(42)).toString("base64url");
    expect(() => decodeCursor(numberCursor)).toThrow(AppError);
  });

  it("rejects cursor that decodes to an array", () => {
    const arrayCursor = Buffer.from(JSON.stringify([1, 2, 3])).toString(
      "base64url"
    );
    expect(() => decodeCursor(arrayCursor)).toThrow(AppError);
  });

  it("rejects cursor that decodes to null", () => {
    const nullCursor = Buffer.from(JSON.stringify(null)).toString("base64url");
    expect(() => decodeCursor(nullCursor)).toThrow(AppError);
  });

  it("rejects cursor with nested object values", () => {
    const nested = Buffer.from(
      JSON.stringify({ PK: "USER#1", nested: { a: 1 } })
    ).toString("base64url");
    expect(() => decodeCursor(nested)).toThrow(AppError);
  });

  it("rejects cursor with array values", () => {
    const arrayVal = Buffer.from(
      JSON.stringify({ PK: "USER#1", items: [1, 2] })
    ).toString("base64url");
    expect(() => decodeCursor(arrayVal)).toThrow(AppError);
  });
});

describe("validateCursor (AC2)", () => {
  it("returns decoded key when no expectedFields specified", () => {
    const key = { saveId: "01HXYZ" };
    const cursor = encodeCursor(key);
    const result = validateCursor(cursor);
    expect(result).toEqual(key);
  });

  it("returns decoded key when all expectedFields are present", () => {
    const key = { PK: "USER#abc", SK: "APIKEY#01ARK" };
    const cursor = encodeCursor(key);
    const result = validateCursor(cursor, ["PK", "SK"]);
    expect(result).toEqual(key);
  });

  it("throws when expectedFields are missing (cross-endpoint replay)", () => {
    const savesCursor = encodeCursor({ saveId: "01HXYZ" });
    expect(() => validateCursor(savesCursor, ["PK", "SK"])).toThrow(AppError);
    try {
      validateCursor(savesCursor, ["PK", "SK"]);
    } catch (e) {
      const err = e as AppError;
      expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(
        (err.details?.fields as Array<Record<string, string>>)?.[0]
      ).toEqual({
        field: "cursor",
        message: "Cursor is not valid for this endpoint",
        code: "invalid_string",
      });
    }
  });

  it("rejects saves cursor on api-keys endpoint", () => {
    const savesCursor = encodeCursor({ saveId: "01HXYZ" });
    expect(() => validateCursor(savesCursor, ["PK", "SK"])).toThrow(AppError);
  });

  it("rejects api-keys cursor on saves endpoint", () => {
    const apiKeysCursor = encodeCursor({ PK: "USER#abc", SK: "APIKEY#01ARK" });
    expect(() => validateCursor(apiKeysCursor, ["saveId"])).toThrow(AppError);
  });

  it("passes validation when expectedFields is empty array", () => {
    const cursor = encodeCursor({ anything: "works" });
    const result = validateCursor(cursor, []);
    expect(result).toEqual({ anything: "works" });
  });

  it("propagates decodeCursor errors for malformed input", () => {
    expect(() => validateCursor("not-valid")).toThrow(AppError);
  });
});

describe("buildPaginatedResponse (AC3)", () => {
  const items = [
    { id: "1", name: "Item 1" },
    { id: "2", name: "Item 2" },
  ];

  it("builds response with cursor (has more pages)", () => {
    const result = buildPaginatedResponse(items, "nextCursorToken");
    expect(result.data).toEqual(items);
    expect(result.meta.cursor).toBe("nextCursorToken");
    expect(result.links).toBeUndefined();
  });

  it("builds response without cursor (last page)", () => {
    const result = buildPaginatedResponse(items, null);
    expect(result.data).toEqual(items);
    expect(result.meta.cursor).toBeNull();
  });

  it("includes total when provided", () => {
    const result = buildPaginatedResponse(items, null, { total: 42 });
    expect(result.meta.total).toBe(42);
  });

  it("omits total when not provided", () => {
    const result = buildPaginatedResponse(items, null);
    expect(result.meta.total).toBeUndefined();
  });

  it("builds links when requestPath is provided", () => {
    const result = buildPaginatedResponse(items, "cursorABC", {
      requestPath: "/saves",
      queryParams: { limit: "25", contentType: "article" },
    });
    expect(result.links).toBeDefined();
    expect(result.links!.self).toBe("/saves?limit=25&contentType=article");
    expect(result.links!.next).toContain("/saves?");
    expect(result.links!.next).toContain("cursor=cursorABC");
  });

  it("self link excludes cursor param", () => {
    const result = buildPaginatedResponse(items, "cursorABC", {
      requestPath: "/saves",
      queryParams: { limit: "25", cursor: "oldCursor" },
    });
    expect(result.links!.self).toBe("/saves?limit=25");
    expect(result.links!.self).not.toContain("cursor=");
  });

  it("omits links when requestPath is not provided", () => {
    const result = buildPaginatedResponse(items, "cursorABC");
    expect(result.links).toBeUndefined();
  });

  it("sets links.next to null when cursor is null", () => {
    const result = buildPaginatedResponse(items, null, {
      requestPath: "/saves",
    });
    expect(result.links!.self).toBe("/saves");
    expect(result.links!.next).toBeNull();
  });

  it("handles empty items array", () => {
    const result = buildPaginatedResponse([], null);
    expect(result.data).toEqual([]);
    expect(result.meta.cursor).toBeNull();
  });

  it("preserves all query params in next link", () => {
    const result = buildPaginatedResponse(items, "cursorXYZ", {
      requestPath: "/saves",
      queryParams: { limit: "25", contentType: "article", sort: "createdAt" },
    });
    expect(result.links!.next).toContain("limit=25");
    expect(result.links!.next).toContain("contentType=article");
    expect(result.links!.next).toContain("sort=createdAt");
    expect(result.links!.next).toContain("cursor=cursorXYZ");
  });

  it("self link is just path when no queryParams", () => {
    const result = buildPaginatedResponse(items, null, {
      requestPath: "/api-keys",
    });
    expect(result.links!.self).toBe("/api-keys");
  });
});
