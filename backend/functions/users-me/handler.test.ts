/**
 * User Profile Endpoint handler tests
 *
 * Tests the GET/PATCH /users/me endpoints per Story 2.5.
 * Covers all acceptance criteria: AC1-AC3.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, ErrorCode } from "@ai-learning-hub/types";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
  assertADR008Error,
} from "../../test-utils/index.js";

// Mock @ai-learning-hub/db
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware
vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());

// Note: @ai-learning-hub/validation is NOT mocked — uses real implementation
// (validates request bodies with Zod schemas and throws AppError on failure)

import { handler } from "./handler.js";

function createEvent(
  method: "GET" | "PATCH",
  body?: Record<string, unknown>,
  userId?: string
) {
  return createMockEvent({
    method,
    path: "/users/me",
    body: body ?? null,
    userId,
  });
}

const mockContext = createMockContext();

const sampleProfile = {
  PK: "USER#user_123",
  SK: "PROFILE",
  userId: "user_123",
  email: "test@example.com",
  displayName: "Test User",
  role: "user",
  globalPreferences: { theme: "dark" },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("Users Me Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: GET /users/me — returns profile", () => {
    it("returns profile for authenticated user", async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.userId).toBe("user_123");
      expect(body.data.email).toBe("test@example.com");
      expect(body.data.displayName).toBe("Test User");
      expect(body.data.role).toBe("user");
      expect(body.data.globalPreferences).toEqual({ theme: "dark" });
      expect(body.data.createdAt).toBe("2026-01-01T00:00:00Z");
      expect(body.data.updatedAt).toBe("2026-01-01T00:00:00Z");
    });

    it("does not expose PK/SK in response", async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(body.data.PK).toBeUndefined();
      expect(body.data.SK).toBeUndefined();
    });

    it("returns empty globalPreferences if not set", async () => {
      mockGetProfile.mockResolvedValueOnce({
        ...sampleProfile,
        globalPreferences: undefined,
      });

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.globalPreferences).toEqual({});
    });

    it("returns 404 when profile does not exist", async () => {
      mockGetProfile.mockResolvedValueOnce(null);

      const event = createEvent("GET", undefined, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("calls getProfile with correct userId", async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);

      const event = createEvent("GET", undefined, "user_abc");
      await handler(event, mockContext);

      expect(mockGetProfile).toHaveBeenCalledWith(
        expect.anything(),
        "user_abc",
        expect.anything()
      );
    });
  });

  describe("AC2: PATCH /users/me — updates profile", () => {
    it("updates displayName", async () => {
      const updated = {
        ...sampleProfile,
        displayName: "New Name",
        updatedAt: "2026-02-15T00:00:00Z",
      };
      mockUpdateProfile.mockResolvedValueOnce(updated);

      const event = createEvent(
        "PATCH",
        { displayName: "New Name" },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.displayName).toBe("New Name");
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.anything(),
        "user_123",
        { displayName: "New Name" },
        expect.anything()
      );
    });

    it("updates globalPreferences", async () => {
      const updated = {
        ...sampleProfile,
        globalPreferences: { theme: "light", lang: "en" },
        updatedAt: "2026-02-15T00:00:00Z",
      };
      mockUpdateProfile.mockResolvedValueOnce(updated);

      const event = createEvent(
        "PATCH",
        { globalPreferences: { theme: "light", lang: "en" } },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.globalPreferences).toEqual({
        theme: "light",
        lang: "en",
      });
    });

    it("updates both displayName and globalPreferences", async () => {
      const updated = {
        ...sampleProfile,
        displayName: "Both Updated",
        globalPreferences: { newPref: true },
        updatedAt: "2026-02-15T00:00:00Z",
      };
      mockUpdateProfile.mockResolvedValueOnce(updated);

      const event = createEvent(
        "PATCH",
        { displayName: "Both Updated", globalPreferences: { newPref: true } },
        "user_123"
      );
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data.displayName).toBe("Both Updated");
      expect(body.data.globalPreferences).toEqual({ newPref: true });
    });

    it("returns 400 for missing request body", async () => {
      const event = createEvent("PATCH", undefined, "user_123");
      event.body = null;
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for empty object (no fields)", async () => {
      const event = createEvent("PATCH", {}, "user_123");
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for empty displayName", async () => {
      const event = createEvent("PATCH", { displayName: "" }, "user_123");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for displayName exceeding 255 characters", async () => {
      const event = createEvent(
        "PATCH",
        { displayName: "x".repeat(256) },
        "user_123"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it("returns 404 when profile does not exist (PATCH)", async () => {
      mockUpdateProfile.mockRejectedValueOnce(
        new AppError(ErrorCode.NOT_FOUND, "User profile not found")
      );
      const event = createEvent(
        "PATCH",
        { displayName: "Test" },
        "nonexistent_user"
      );
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("AC3: Auth enforcement via middleware", () => {
    it("returns 401 when no auth context (GET)", async () => {
      const event = createEvent("GET");
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });

    it("returns 401 when no auth context (PATCH)", async () => {
      const event = createEvent("PATCH", { displayName: "test" });
      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
    });
  });

  describe("Method routing", () => {
    it("returns 405 for unsupported HTTP method", async () => {
      const event = createEvent("GET", undefined, "user_123");
      event.httpMethod = "DELETE";
      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(405);
      expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
    });
  });

  describe("ADR-008 Error Response Compliance (D5-AC12)", () => {
    it("missing auth returns ADR-008 compliant 401", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/users/me",
      });

      const result = await handler(event, createMockContext());
      assertADR008Error(result, ErrorCode.UNAUTHORIZED);
    });
  });
});
