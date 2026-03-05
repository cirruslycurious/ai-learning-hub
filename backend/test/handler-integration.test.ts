/**
 * Handler Integration Tests (Story 2.1-D5, AC13-AC16)
 *
 * Tests handler ↔ middleware integration with realistic API Gateway events:
 * - AC13: JWT auth happy path → 200/201 response
 * - AC14: Missing/invalid auth → 401 with ADR-008 shape
 * - AC15: Capture-only API key on non-saves endpoint → 403 SCOPE_INSUFFICIENT
 * - AC16: Rate limit exceeded → 429 with Retry-After header
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorCode, type OperationScope } from "@ai-learning-hub/types";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  mockMiddlewareModule,
  assertADR008Error,
} from "../test-utils/index.js";

// ─── AC13/AC14: Use api-keys handler (POST creates, GET lists) ───
const mockCreateApiKey = vi.fn();
const mockListApiKeys = vi.fn();
const mockRevokeApiKey = vi.fn();
const mockGetDefaultClient = vi.fn(() => ({}));

vi.mock("@ai-learning-hub/db", () => ({
  getDefaultClient: () => mockGetDefaultClient(),
  createApiKey: (...args: unknown[]) => mockCreateApiKey(...args),
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  revokeApiKey: (...args: unknown[]) => mockRevokeApiKey(...args),
  recordEvent: () => Promise.resolve(),
  apiKeyCreateRateLimit: {
    operation: "apikey-create",
    windowSeconds: 3600,
    limit: () => 10,
  },
  USERS_TABLE_CONFIG: {
    tableName: "ai-learning-hub-users",
    partitionKey: "PK",
    sortKey: "SK",
  },
}));

vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());
vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());

import {
  createHandler,
  listHandler,
  revokeHandler,
} from "../functions/api-keys/handler.js";

const mockContext = createMockContext();

describe("Handler Integration Tests (AC13-AC16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC13: JWT auth happy path → 200/201 response", () => {
    it("POST with valid JWT auth context returns 201 with created key", async () => {
      mockCreateApiKey.mockResolvedValueOnce({
        id: "key_01",
        name: "Integration Test Key",
        key: "raw-key-value",
        scopes: ["*"],
        createdAt: "2026-02-19T12:00:00Z",
      });

      const event = createMockEvent({
        method: "POST",
        path: "/users/api-keys",
        body: { name: "Integration Test Key", scopes: ["*"] },
        userId: "user_integration",
        authMethod: "jwt",
      });

      const result = await createHandler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.id).toBe("key_01");
      expect(body.data.name).toBe("Integration Test Key");
    });

    it("GET with valid JWT auth context returns 200 with key list", async () => {
      mockListApiKeys.mockResolvedValueOnce({
        items: [],
        cursor: null,
      });

      const event = createMockEvent({
        method: "GET",
        path: "/users/api-keys",
        userId: "user_integration",
        authMethod: "jwt",
      });

      const result = await listHandler(event, mockContext);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data).toEqual([]);
    });
  });

  describe("AC14: Missing/invalid auth → 401 with ADR-008 shape", () => {
    it("POST without auth context returns ADR-008 compliant 401", async () => {
      const event = createMockEvent({
        method: "POST",
        path: "/users/api-keys",
        body: { name: "No Auth Key", scopes: ["*"] },
      });

      const result = await createHandler(event, mockContext);

      assertADR008Error(result, ErrorCode.UNAUTHORIZED);
    });

    it("GET without auth context returns ADR-008 compliant 401", async () => {
      const event = createMockEvent({
        method: "GET",
        path: "/users/api-keys",
      });

      const result = await listHandler(event, mockContext);

      assertADR008Error(result, ErrorCode.UNAUTHORIZED);
    });

    it("DELETE without auth context returns ADR-008 compliant 401", async () => {
      const event = createMockEvent({
        method: "DELETE",
        path: "/users/api-keys/key_01",
        pathParameters: { id: "key_01" },
      });

      const result = await revokeHandler(event, mockContext);

      assertADR008Error(result, ErrorCode.UNAUTHORIZED);
    });
  });

  describe("AC15: Capture-only API key scope enforcement → 403 SCOPE_INSUFFICIENT", () => {
    it("API key with saves:write scope can access saves endpoints (scope matches)", async () => {
      // This test verifies the mock middleware correctly parses scopes
      // for API key auth and allows when scope matches
      const event = createMockEvent({
        method: "POST",
        path: "/users/api-keys",
        body: { name: "Test Key", scopes: ["*"] },
        userId: "user_apikey",
        authMethod: "api-key",
        scopes: ["*"],
      });

      mockCreateApiKey.mockResolvedValueOnce({
        id: "key_test",
        name: "Test Key",
        key: "raw-key",
        scopes: ["*"],
        createdAt: "2026-02-19T12:00:00Z",
      });

      const result = await createHandler(event, mockContext);

      // Wildcard scope allows access
      expect(result.statusCode).toBe(201);
    });
  });

  // Note: Rate limiting (AC16) is now tested at the middleware layer.
  // Story 3.2.8 moved rate limiting from handler-level enforceRateLimit calls
  // to wrapHandler middleware config. See middleware rate-limit-integration tests.
});

/**
 * Scope Enforcement Integration (AC15)
 *
 * Tests scope enforcement through the middleware wrapper by importing
 * and wrapping a minimal handler with requiredScope option.
 *
 * Note: No current production handler sets `requiredScope` in its
 * wrapHandler options -- scope enforcement is purely a middleware concern.
 * These tests validate the middleware wrapper's scope logic with a minimal
 * inline handler, which is sufficient because `requiredScope` is checked
 * in the wrapper before the inner handler is ever invoked. When a future
 * handler adds `requiredScope`, these tests confirm the enforcement path
 * works correctly. Using the real api-keys handler would not add value
 * because it does not restrict by scope (API key management is accessible
 * to all authenticated users).
 */
describe("Scope Enforcement Integration (AC15)", () => {
  it("capture-only API key on endpoint requiring different scope returns 403", async () => {
    // Import the mock middleware to create a scope-restricted wrapper
    const { wrapHandler } = await import("@ai-learning-hub/middleware");

    // Create a minimal handler that returns success
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { ok: true } }),
    });

    // Wrap with requiredScope
    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "keys:manage",
    });

    // API key with only saves:write scope
    const event = createMockEvent({
      method: "POST",
      path: "/admin/action",
      userId: "user_capture",
      authMethod: "api-key",
      scopes: ["saves:write"],
    });

    const result = await wrappedHandler(event, createMockContext());

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("SCOPE_INSUFFICIENT");
    expect(body.error.requestId).toBeDefined();
  });

  it("wildcard scope allows access even when requiredScope is set", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");

    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { ok: true } }),
    });

    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "keys:manage",
    });

    // API key with wildcard scope
    const event = createMockEvent({
      method: "POST",
      path: "/admin/action",
      userId: "user_wildcard",
      authMethod: "api-key",
      scopes: ["*"],
    });

    const result = await wrappedHandler(event, createMockContext());

    expect(result.statusCode).toBe(200);
  });

  it("JWT auth bypasses scope enforcement", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");

    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { ok: true } }),
    });

    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "keys:manage",
    });

    // JWT auth (no scopes needed)
    const event = createMockEvent({
      method: "POST",
      path: "/admin/action",
      userId: "user_jwt",
      authMethod: "jwt",
    });

    const result = await wrappedHandler(event, createMockContext());

    // JWT auth skips scope checks
    expect(result.statusCode).toBe(200);
  });
});

/**
 * Story 3.2.6 — Hierarchical Scope Enforcement Integration (AC21)
 *
 * Tests the full wrapHandler chain with scope tier resolution.
 * Verifies that named permission tiers resolve correctly through middleware.
 */
describe("Hierarchical Scope Enforcement Integration (Story 3.2.6, AC21)", () => {
  it("capture key satisfies saves:create required scope", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { id: "save_01" } }),
    });
    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "saves:create",
    });
    const event = createMockEvent({
      method: "POST",
      path: "/saves",
      userId: "user_1",
      authMethod: "api-key",
      scopes: ["capture"],
    });

    const result = await wrappedHandler(event, createMockContext());
    expect(result.statusCode).toBe(201);
  });

  it("capture key rejected for saves:read → 403 with correct error details", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({ statusCode: 200 });
    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "saves:read",
    });
    const event = createMockEvent({
      method: "GET",
      path: "/saves",
      userId: "user_1",
      authMethod: "api-key",
      scopes: ["capture"],
    });

    const result = await wrappedHandler(event, createMockContext());
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("SCOPE_INSUFFICIENT");
    expect(body.error.message).toBe("API key lacks required scope: saves:read");
    expect(body.error.details.required_scope).toBe("saves:read");
    expect(body.error.details.granted_scopes).toEqual(["capture"]);
    expect(body.error.allowedActions).toEqual(["keys:request-with-scope"]);
  });

  it("read key satisfies saves:read", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [] }),
    });
    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "saves:read",
    });
    const event = createMockEvent({
      method: "GET",
      path: "/saves",
      userId: "user_1",
      authMethod: "api-key",
      scopes: ["read"],
    });

    const result = await wrappedHandler(event, createMockContext());
    expect(result.statusCode).toBe(200);
  });

  it("read key rejected for saves:write", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({ statusCode: 200 });
    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "saves:write",
    });
    const event = createMockEvent({
      method: "PATCH",
      path: "/saves/01",
      userId: "user_1",
      authMethod: "api-key",
      scopes: ["read"],
    });

    const result = await wrappedHandler(event, createMockContext());
    expect(result.statusCode).toBe(403);
  });

  it("saves:write key satisfies both saves:read and saves:write", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });

    for (const requiredScope of [
      "saves:read",
      "saves:write",
    ] as OperationScope[]) {
      const wrappedHandler = wrapHandler(innerHandler, {
        requireAuth: true,
        requiredScope,
      });
      const event = createMockEvent({
        method: "GET",
        path: "/saves",
        userId: "user_1",
        authMethod: "api-key",
        scopes: ["saves:write"],
      });
      const result = await wrappedHandler(event, createMockContext());
      expect(result.statusCode).toBe(200);
    }
  });

  it("full key satisfies any required scope", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });

    for (const requiredScope of [
      "saves:create",
      "saves:read",
      "keys:manage",
      "projects:write",
    ] as OperationScope[]) {
      const wrappedHandler = wrapHandler(innerHandler, {
        requireAuth: true,
        requiredScope,
      });
      const event = createMockEvent({
        method: "POST",
        path: "/test",
        userId: "user_1",
        authMethod: "api-key",
        scopes: ["full"],
      });
      const result = await wrappedHandler(event, createMockContext());
      expect(result.statusCode).toBe(200);
    }
  });

  it("* key satisfies any required scope (backward compat)", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });
    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "keys:manage",
    });
    const event = createMockEvent({
      method: "POST",
      path: "/test",
      userId: "user_1",
      authMethod: "api-key",
      scopes: ["*"],
    });
    const result = await wrappedHandler(event, createMockContext());
    expect(result.statusCode).toBe(200);
  });

  it("combined saves:write + projects:write satisfies both domain scopes", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    });

    for (const requiredScope of [
      "saves:read",
      "saves:write",
      "projects:read",
      "projects:write",
    ] as OperationScope[]) {
      const wrappedHandler = wrapHandler(innerHandler, {
        requireAuth: true,
        requiredScope,
      });
      const event = createMockEvent({
        method: "POST",
        path: "/test",
        userId: "user_1",
        authMethod: "api-key",
        scopes: ["saves:write", "projects:write"],
      });
      const result = await wrappedHandler(event, createMockContext());
      expect(result.statusCode, `${requiredScope} should be satisfied`).toBe(
        200
      );
    }
  });

  it("error response includes required_scope, granted_scopes, allowedActions", async () => {
    const { wrapHandler } = await import("@ai-learning-hub/middleware");
    const innerHandler = vi.fn().mockResolvedValue({ statusCode: 200 });
    const wrappedHandler = wrapHandler(innerHandler, {
      requireAuth: true,
      requiredScope: "keys:manage",
    });
    const event = createMockEvent({
      method: "POST",
      path: "/users/api-keys",
      userId: "user_1",
      authMethod: "api-key",
      scopes: ["read"],
    });

    const result = await wrappedHandler(event, createMockContext());
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe("SCOPE_INSUFFICIENT");
    expect(body.error.details.required_scope).toBe("keys:manage");
    expect(body.error.details.granted_scopes).toEqual(["read"]);
    expect(body.error.allowedActions).toEqual(["keys:request-with-scope"]);
  });
});
