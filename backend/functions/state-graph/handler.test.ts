/**
 * State Graph handler tests — GET /states/{entityType}
 *
 * Story 3.2.10, Task 5: Tests all acceptance criteria for the state graph endpoint.
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

  // Register a test state graph for testing
  reg.registerStateGraph({
    entityType: "testentity",
    states: ["draft", "active", "archived"],
    initialState: "draft",
    terminalStates: ["archived"],
    transitions: [
      {
        from: "draft",
        to: "active",
        command: "testentity:activate",
        preconditions: ["has_name"],
      },
      {
        from: "active",
        to: "archived",
        command: "testentity:archive",
        preconditions: [],
      },
    ],
  });

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

function createStateGraphEvent(entityType: string, userId = "user123") {
  return createMockEvent({
    method: "GET",
    path: `/states/${entityType}`,
    userId,
    pathParameters: { entityType },
  });
}

describe("GET /states/{entityType}", () => {
  it("returns 404 for entity type with no state machine (AC17)", async () => {
    // "saves" currently has no state machine registered
    const result = await handler(createStateGraphEvent("saves"), mockContext);
    assertADR008Error(result, ErrorCode.NOT_FOUND);
  });

  it("returns 404 for unknown entity type", async () => {
    const result = await handler(
      createStateGraphEvent("nonexistent"),
      mockContext
    );
    assertADR008Error(result, ErrorCode.NOT_FOUND);
  });

  it("returns 401 for unauthenticated requests (AC18)", async () => {
    const event = createMockEvent({
      method: "GET",
      path: "/states/project",
      pathParameters: { entityType: "project" },
    });

    const result = await handler(event, mockContext);
    assertADR008Error(result, ErrorCode.UNAUTHORIZED);
  });

  it("returns state graph when registered (AC14, AC15)", async () => {
    const result = await handler(
      createStateGraphEvent("testentity"),
      mockContext
    );
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.data).toBeDefined();
    expect(body.data.entityType).toBe("testentity");
    expect(body.data.states).toEqual(["draft", "active", "archived"]);
    expect(body.data.initialState).toBe("draft");
    expect(body.data.terminalStates).toEqual(["archived"]);
    expect(body.data.transitions).toHaveLength(2);
  });

  it("transition command matches action catalog actionId (AC16)", async () => {
    const result = await handler(
      createStateGraphEvent("testentity"),
      mockContext
    );
    const body = JSON.parse(result.body);

    for (const transition of body.data.transitions) {
      expect(transition.command).toMatch(/^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/);
    }
  });

  it("uses standard response envelope (AC19)", async () => {
    const result = await handler(
      createStateGraphEvent("testentity"),
      mockContext
    );
    const body = JSON.parse(result.body);
    expect(body.data).toBeDefined();
    expect(body.links).toBeDefined();
    expect(body.links.self).toBe("/states/testentity");
  });
});
