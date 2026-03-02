/**
 * Actions Catalog handler tests — GET /actions
 *
 * Story 3.2.10, Task 4: Tests all acceptance criteria for the global action catalog.
 */
import { describe, it, expect, vi } from "vitest";
import {
  createMockEvent,
  createMockContext,
  mockCreateLoggerModule,
  assertADR008Error,
} from "../../test-utils/index.js";
import { ErrorCode } from "@ai-learning-hub/types";

// Mock @ai-learning-hub/logging
vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());

// Mock @ai-learning-hub/middleware with real ActionRegistry + registrations
vi.mock("@ai-learning-hub/middleware", async () => {
  const { ActionRegistry } =
    await import("../../shared/middleware/src/action-registry.js");
  const { registerInitialActions } =
    await import("../../shared/middleware/src/action-registrations.js");
  const { mockMiddlewareModule } =
    await import("../../test-utils/mock-wrapper.js");

  const reg = ActionRegistry.create();
  registerInitialActions(reg);

  return mockMiddlewareModule({
    extraExports: {
      getActionRegistry: () => reg,
      resetActionRegistry: vi.fn(),
      registerInitialActions: vi.fn(),
      buildResourceActions: vi.fn(),
    },
  });
});

import { handler } from "./handler.js";

const mockContext = createMockContext();

function createCatalogEvent(
  query?: Record<string, string>,
  userId = "user123"
) {
  return createMockEvent({
    method: "GET",
    path: "/actions",
    userId,
    queryStringParameters: query ?? null,
  });
}

describe("GET /actions", () => {
  it("returns 200 with all actions (AC1)", async () => {
    const result = await handler(createCatalogEvent(), mockContext);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(8);
  });

  it("returns standard envelope { data, links } (AC19)", async () => {
    const result = await handler(createCatalogEvent(), mockContext);
    const body = JSON.parse(result.body);
    expect(body.data).toBeDefined();
    expect(body.links).toBeDefined();
    expect(body.links.self).toBe("/actions");
  });

  it("each action has required fields (AC2)", async () => {
    const result = await handler(createCatalogEvent(), mockContext);
    const body = JSON.parse(result.body);

    for (const action of body.data) {
      expect(action.actionId).toBeTruthy();
      expect(action.description).toBeTruthy();
      expect(action.method).toBeTruthy();
      expect(action.urlPattern).toBeTruthy();
      expect(Array.isArray(action.pathParams)).toBe(true);
      expect(Array.isArray(action.queryParams)).toBe(true);
      expect(action.requiredScope).toBeTruthy();
      expect(Array.isArray(action.expectedErrors)).toBe(true);
      expect(Array.isArray(action.requiredHeaders)).toBe(true);
      expect(
        action.inputSchema === null || typeof action.inputSchema === "object"
      ).toBe(true);
    }
  });

  it("actionIds are stable, machine-parseable (AC6)", async () => {
    const result = await handler(createCatalogEvent(), mockContext);
    const body = JSON.parse(result.body);

    for (const action of body.data) {
      expect(action.actionId).toMatch(/^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/);
    }
  });

  it("filters by entity prefix (AC3)", async () => {
    const result = await handler(
      createCatalogEvent({ entity: "saves" }),
      mockContext
    );
    const body = JSON.parse(result.body);
    expect(body.data.length).toBeGreaterThan(0);
    for (const action of body.data) {
      expect(action.actionId.startsWith("saves:")).toBe(true);
    }
    expect(body.links.self).toBe("/actions?entity=saves");
  });

  it("filters by scope (AC4)", async () => {
    const result = await handler(
      createCatalogEvent({ scope: "read" }),
      mockContext
    );
    const body = JSON.parse(result.body);
    expect(body.data.length).toBeGreaterThan(0);
    // Valid read scopes from saves domain, auth domain (Story 3.2.8), and discovery
    const validReadScopes = [
      "saves:read",
      "users:read",
      "keys:read",
      "invites:read",
    ];
    for (const action of body.data) {
      // Actions with requiredScope "*" pass all scope filters (any-auth actions)
      expect(
        action.requiredScope === "*" ||
          validReadScopes.includes(action.requiredScope)
      ).toBe(true);
    }
    expect(body.links.self).toBe("/actions?scope=read");
  });

  it("combines entity and scope filters (AC5)", async () => {
    const result = await handler(
      createCatalogEvent({ entity: "saves", scope: "read" }),
      mockContext
    );
    const body = JSON.parse(result.body);
    for (const action of body.data) {
      expect(action.actionId.startsWith("saves:")).toBe(true);
    }
    expect(body.links.self).toBe("/actions?entity=saves&scope=read");
  });

  it("returns 401 for unauthenticated requests (AC7)", async () => {
    const event = createMockEvent({
      method: "GET",
      path: "/actions",
    });
    const result = await handler(event, mockContext);
    assertADR008Error(result, ErrorCode.UNAUTHORIZED);
  });

  it("returns empty array for unknown entity", async () => {
    const result = await handler(
      createCatalogEvent({ entity: "nonexistent" }),
      mockContext
    );
    const body = JSON.parse(result.body);
    expect(body.data).toEqual([]);
  });
});
