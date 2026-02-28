/**
 * Action registrations tests (Story 3.2.10, Task 7).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ActionRegistry } from "../src/action-registry.js";
import { registerInitialActions } from "../src/action-registrations.js";

describe("registerInitialActions", () => {
  let registry: ActionRegistry;

  beforeEach(() => {
    registry = ActionRegistry.create();
    registerInitialActions(registry);
  });

  it("registers saves domain actions", () => {
    const savesActions = registry.getActions({ entity: "saves" });
    expect(savesActions.length).toBeGreaterThanOrEqual(5);
    const ids = savesActions.map((a) => a.actionId);
    expect(ids).toContain("saves:create");
    expect(ids).toContain("saves:get");
    expect(ids).toContain("saves:list");
    expect(ids).toContain("saves:update");
    expect(ids).toContain("saves:delete");
    expect(ids).toContain("saves:restore");
  });

  it("registers discoverability actions", () => {
    const discoveryActions = registry.getActions({ entity: "discovery" });
    expect(discoveryActions.length).toBeGreaterThanOrEqual(2);
    const ids = discoveryActions.map((a) => a.actionId);
    expect(ids).toContain("discovery:actions");
    expect(ids).toContain("discovery:states");
  });

  it("all actionIds follow entity:verb convention (AC6)", () => {
    const all = registry.getActions();
    for (const action of all) {
      expect(action.actionId).toMatch(/^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/);
    }
  });

  it("all actions have entityType set", () => {
    const all = registry.getActions();
    for (const action of all) {
      expect(action.entityType).toBeTruthy();
    }
  });

  it("saves:create includes inputSchema as JSON Schema (AC23)", () => {
    const action = registry
      .getActions({ entity: "saves" })
      .find((a) => a.actionId === "saves:create");
    expect(action).toBeDefined();
    expect(action!.inputSchema).not.toBeNull();
    expect(action!.inputSchema!.type).toBe("object");
    expect(action!.inputSchema!.properties).toBeDefined();
    expect(action!.inputSchema!.required).toContain("url");
  });

  it("saves:get has null inputSchema (no body)", () => {
    const action = registry
      .getActions({ entity: "saves" })
      .find((a) => a.actionId === "saves:get");
    expect(action!.inputSchema).toBeNull();
  });

  it("saves:create has structured requiredHeaders", () => {
    const action = registry
      .getActions({ entity: "saves" })
      .find((a) => a.actionId === "saves:create");
    expect(action!.requiredHeaders).toHaveLength(1);
    expect(action!.requiredHeaders[0].name).toBe("Idempotency-Key");
    expect(action!.requiredHeaders[0].format).toBeTruthy();
    expect(action!.requiredHeaders[0].description).toBeTruthy();
  });

  it("saves:get has pathParams with id", () => {
    const action = registry
      .getActions({ entity: "saves" })
      .find((a) => a.actionId === "saves:get");
    expect(action!.pathParams).toHaveLength(1);
    expect(action!.pathParams[0].name).toBe("id");
  });

  it("saves:list has queryParams for filtering/pagination", () => {
    const action = registry
      .getActions({ entity: "saves" })
      .find((a) => a.actionId === "saves:list");
    expect(action!.queryParams.length).toBeGreaterThanOrEqual(2);
    const names = action!.queryParams.map((q) => q.name);
    expect(names).toContain("limit");
    expect(names).toContain("cursor");
  });
});
