/**
 * Resource-scoped actions enrichment tests (Story 3.2.10, Task 6).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildResourceActions } from "../src/resource-actions.js";
import {
  getActionRegistry,
  resetActionRegistry,
} from "../src/action-registry.js";
import { registerInitialActions } from "../src/action-registrations.js";

describe("buildResourceActions", () => {
  beforeEach(() => {
    resetActionRegistry();
    registerInitialActions(getActionRegistry());
  });

  afterEach(() => {
    resetActionRegistry();
  });

  it("returns actions for saves entity with resolved URLs (AC11)", () => {
    const actions = buildResourceActions("saves", "abc123");
    expect(actions.length).toBeGreaterThan(0);
    const update = actions.find((a) => a.actionId === "saves:update");
    expect(update).toBeDefined();
    expect(update!.url).toBe("/saves/abc123");
    expect(update!.method).toBe("PATCH");
  });

  it("returns empty array for unknown entity (AC12)", () => {
    const actions = buildResourceActions("unknown", "abc123");
    expect(actions).toEqual([]);
  });

  it("each action has actionId, url, method, requiredHeaders (AC9)", () => {
    const actions = buildResourceActions("saves", "test-id");
    for (const action of actions) {
      expect(action.actionId).toBeTruthy();
      expect(action.url).toBeTruthy();
      expect(action.method).toBeTruthy();
      expect(Array.isArray(action.requiredHeaders)).toBe(true);
    }
  });

  it("excludes collection-level actions (no :id in pattern)", () => {
    const actions = buildResourceActions("saves", "abc123");
    expect(actions.find((a) => a.actionId === "saves:create")).toBeUndefined();
    expect(actions.find((a) => a.actionId === "saves:list")).toBeUndefined();
  });
});
