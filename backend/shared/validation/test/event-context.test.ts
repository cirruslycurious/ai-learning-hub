/**
 * Unit tests for event context Zod schema (Story 3.2.4, AC5-AC6, AC19)
 */
import { describe, it, expect } from "vitest";
import { eventContextSchema } from "../src/event-context.js";

describe("eventContextSchema", () => {
  it("accepts valid context with all fields", () => {
    const input = {
      trigger: "user-share-command",
      source: "claude-code-cli",
      confidence: 0.95,
      upstream_ref: "conversation-xyz-456",
    };
    const result = eventContextSchema.parse(input);
    expect(result).toEqual(input);
  });

  it("accepts valid context with partial fields", () => {
    const input = { trigger: "manual-save" };
    const result = eventContextSchema.parse(input);
    expect(result).toEqual({ trigger: "manual-save" });
  });

  it("accepts empty object", () => {
    const result = eventContextSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts undefined (optional root)", () => {
    const result = eventContextSchema.parse(undefined);
    expect(result).toBeUndefined();
  });

  it("rejects confidence outside 0-1 range (too high)", () => {
    expect(() => eventContextSchema.parse({ confidence: 1.5 })).toThrow();
  });

  it("rejects confidence outside 0-1 range (negative)", () => {
    expect(() => eventContextSchema.parse({ confidence: -0.1 })).toThrow();
  });

  it("accepts confidence at boundaries (0 and 1)", () => {
    expect(eventContextSchema.parse({ confidence: 0 })).toEqual({
      confidence: 0,
    });
    expect(eventContextSchema.parse({ confidence: 1 })).toEqual({
      confidence: 1,
    });
  });

  it("accepts confidence at midpoint (0.5)", () => {
    expect(eventContextSchema.parse({ confidence: 0.5 })).toEqual({
      confidence: 0.5,
    });
  });

  it("rejects extra fields (strict mode)", () => {
    expect(() =>
      eventContextSchema.parse({
        trigger: "test",
        unknown_field: "sneaky",
      })
    ).toThrow();
  });

  it("rejects trigger exceeding 100 chars", () => {
    expect(() =>
      eventContextSchema.parse({ trigger: "x".repeat(101) })
    ).toThrow();
  });

  it("accepts trigger at exactly 100 chars", () => {
    const result = eventContextSchema.parse({
      trigger: "x".repeat(100),
    });
    expect(result?.trigger).toHaveLength(100);
  });

  it("rejects source exceeding 200 chars", () => {
    expect(() =>
      eventContextSchema.parse({ source: "x".repeat(201) })
    ).toThrow();
  });

  it("rejects upstream_ref exceeding 500 chars", () => {
    expect(() =>
      eventContextSchema.parse({ upstream_ref: "x".repeat(501) })
    ).toThrow();
  });
});
