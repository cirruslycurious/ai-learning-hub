/**
 * Action Registry unit tests (Story 3.2.10, Task 2).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ActionRegistry } from "../src/action-registry.js";
import type {
  ActionDefinition,
  StateGraph,
  ErrorCode,
  OperationScope,
} from "@ai-learning-hub/types";

function createTestAction(
  overrides: Partial<ActionDefinition> = {}
): ActionDefinition {
  return {
    actionId: "saves:create",
    description: "Create a new save",
    method: "POST",
    urlPattern: "/saves",
    entityType: "saves",
    pathParams: [],
    queryParams: [],
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
    requiredHeaders: [
      {
        name: "Idempotency-Key",
        format: "[a-zA-Z0-9_\\-.]{1,256}",
        description: "Client-generated dedup key",
      },
    ],
    requiredScope: "saves:create" as OperationScope,
    expectedErrors: [
      "VALIDATION_ERROR" as ErrorCode,
      "DUPLICATE_SAVE" as ErrorCode,
    ],
    ...overrides,
  };
}

function createTestStateGraph(overrides: Partial<StateGraph> = {}): StateGraph {
  return {
    entityType: "project",
    states: ["draft", "active", "archived"],
    initialState: "draft",
    terminalStates: ["archived"],
    transitions: [
      {
        from: "draft",
        to: "active",
        command: "projects:activate",
        preconditions: ["has_title"],
      },
      {
        from: "active",
        to: "archived",
        command: "projects:archive",
        preconditions: [],
      },
    ],
    ...overrides,
  };
}

describe("ActionRegistry", () => {
  let registry: ActionRegistry;

  beforeEach(() => {
    registry = ActionRegistry.create();
  });

  describe("registerAction", () => {
    it("registers a valid action", () => {
      const action = createTestAction();
      registry.registerAction(action);
      const actions = registry.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].actionId).toBe("saves:create");
    });

    it("deduplicates by actionId", () => {
      const action = createTestAction();
      registry.registerAction(action);
      registry.registerAction(action);
      expect(registry.getActions()).toHaveLength(1);
    });

    it("rejects invalid actionId format (no colon)", () => {
      expect(() =>
        registry.registerAction(createTestAction({ actionId: "invalid" }))
      ).toThrow("actionId must follow entity:verb format");
    });

    it("rejects invalid actionId format (uppercase)", () => {
      expect(() =>
        registry.registerAction(createTestAction({ actionId: "Saves:Create" }))
      ).toThrow("actionId must follow entity:verb format");
    });

    it("rejects invalid actionId format (spaces)", () => {
      expect(() =>
        registry.registerAction(createTestAction({ actionId: "saves: create" }))
      ).toThrow("actionId must follow entity:verb format");
    });

    it("accepts multi-segment actionId (e.g. saves:update-metadata)", () => {
      registry.registerAction(
        createTestAction({ actionId: "saves:update-metadata" })
      );
      expect(registry.getActions()).toHaveLength(1);
    });
  });

  describe("getActions", () => {
    beforeEach(() => {
      registry.registerAction(
        createTestAction({
          actionId: "saves:create",
          requiredScope: "saves:create" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "saves:get",
          method: "GET",
          requiredScope: "saves:read" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "saves:list",
          method: "GET",
          requiredScope: "saves:read" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "discovery:actions",
          entityType: "discovery",
          method: "GET",
          requiredScope: "*" as OperationScope,
        })
      );
    });

    it("returns all actions when no filters", () => {
      expect(registry.getActions()).toHaveLength(4);
    });

    it("filters by entity prefix (AC3)", () => {
      const result = registry.getActions({ entity: "saves" });
      expect(result).toHaveLength(3);
      expect(result.every((a) => a.actionId.startsWith("saves:"))).toBe(true);
    });

    it("filters by scope (AC4) — read tier grants saves:read + any-auth actions", () => {
      const result = registry.getActions({ scope: "read" });
      // "read" tier grants saves:read, projects:read, links:read, users:read, keys:read
      // saves:get and saves:list have requiredScope saves:read — match
      // saves:create requires saves:create — NOT granted by "read" tier
      // discovery:actions has requiredScope "*" — matches any tier (any-auth)
      expect(result).toHaveLength(3);
      expect(result.map((a) => a.actionId).sort()).toEqual([
        "discovery:actions",
        "saves:get",
        "saves:list",
      ]);
    });

    it("filters by scope — full tier grants everything", () => {
      const result = registry.getActions({ scope: "full" });
      expect(result).toHaveLength(4);
    });

    it("combines entity and scope filters (AC5)", () => {
      const result = registry.getActions({ entity: "saves", scope: "read" });
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.actionId.startsWith("saves:"))).toBe(true);
    });

    it("returns empty array for unknown entity", () => {
      expect(registry.getActions({ entity: "unknown" })).toHaveLength(0);
    });

    it("returns only any-auth actions for scope with no domain-specific matches", () => {
      // projects:write grants projects:read and projects:write,
      // but no registered actions require those scopes —
      // only discovery:actions (requiredScope: "*") passes through
      const result = registry.getActions({ scope: "projects:write" });
      expect(result).toHaveLength(1);
      expect(result[0].actionId).toBe("discovery:actions");
    });
  });

  describe("registerStateGraph", () => {
    it("registers a valid state graph", () => {
      const graph = createTestStateGraph();
      registry.registerStateGraph(graph);
      expect(registry.getStateGraph("project")).toEqual(graph);
    });

    it("validates that initialState is in states list", () => {
      expect(() =>
        registry.registerStateGraph(
          createTestStateGraph({ initialState: "nonexistent" })
        )
      ).toThrow("initialState");
    });

    it("validates that terminalStates are in states list", () => {
      expect(() =>
        registry.registerStateGraph(
          createTestStateGraph({ terminalStates: ["nonexistent"] })
        )
      ).toThrow("terminalStates");
    });

    it("validates transition from/to are in states list", () => {
      expect(() =>
        registry.registerStateGraph(
          createTestStateGraph({
            transitions: [
              {
                from: "draft",
                to: "invalid",
                command: "projects:publish",
                preconditions: [],
              },
            ],
          })
        )
      ).toThrow("transition");
    });
  });

  describe("getStateGraph", () => {
    it("returns null for unknown entity type", () => {
      expect(registry.getStateGraph("nonexistent")).toBeNull();
    });

    it("returns registered graph", () => {
      const graph = createTestStateGraph();
      registry.registerStateGraph(graph);
      expect(registry.getStateGraph("project")).toEqual(graph);
    });
  });

  describe("getActionsForResource", () => {
    beforeEach(() => {
      registry.registerAction(
        createTestAction({
          actionId: "saves:get",
          method: "GET",
          urlPattern: "/saves/:id",
          pathParams: [{ name: "id", type: "string", description: "Save ID" }],
          requiredHeaders: [],
          requiredScope: "saves:read" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "saves:update",
          method: "PATCH",
          urlPattern: "/saves/:id",
          pathParams: [{ name: "id", type: "string", description: "Save ID" }],
          requiredHeaders: [
            {
              name: "If-Match",
              format: "\\d+",
              description: "Expected version",
            },
          ],
          requiredScope: "saves:write" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "saves:delete",
          method: "DELETE",
          urlPattern: "/saves/:id",
          pathParams: [{ name: "id", type: "string", description: "Save ID" }],
          requiredHeaders: [],
          requiredScope: "saves:write" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "saves:create",
          method: "POST",
          urlPattern: "/saves",
          pathParams: [],
          requiredScope: "saves:create" as OperationScope,
        })
      );
    });

    it("returns actions for non-state entity with resolved URLs (AC11)", () => {
      const actions = registry.getActionsForResource("saves", "abc123");
      // Should include actions with :id in urlPattern, resolved to /saves/abc123
      const update = actions.find((a) => a.actionId === "saves:update");
      expect(update).toBeDefined();
      expect(update!.url).toBe("/saves/abc123");
      expect(update!.method).toBe("PATCH");
      expect(update!.requiredHeaders).toEqual(["If-Match"]);
    });

    it("excludes collection-level actions (no :id param)", () => {
      const actions = registry.getActionsForResource("saves", "abc123");
      expect(
        actions.find((a) => a.actionId === "saves:create")
      ).toBeUndefined();
    });

    it("returns empty array for unknown entity type (AC12)", () => {
      const actions = registry.getActionsForResource("unknown", "abc123");
      expect(actions).toEqual([]);
    });

    it("filters by state when state graph and currentState provided (AC10)", () => {
      // Register state graph
      registry.registerStateGraph({
        entityType: "project",
        states: ["draft", "active", "archived"],
        initialState: "draft",
        terminalStates: ["archived"],
        transitions: [
          {
            from: "draft",
            to: "active",
            command: "projects:activate",
            preconditions: [],
          },
          {
            from: "active",
            to: "archived",
            command: "projects:archive",
            preconditions: [],
          },
          {
            from: "active",
            to: "draft",
            command: "projects:deactivate",
            preconditions: [],
          },
        ],
      });

      // Register project actions
      registry.registerAction(
        createTestAction({
          actionId: "projects:activate",
          entityType: "project",
          method: "POST",
          urlPattern: "/projects/:id:activate",
          pathParams: [
            { name: "id", type: "string", description: "Project ID" },
          ],
          requiredHeaders: [],
          requiredScope: "projects:write" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "projects:archive",
          entityType: "project",
          method: "POST",
          urlPattern: "/projects/:id:archive",
          pathParams: [
            { name: "id", type: "string", description: "Project ID" },
          ],
          requiredHeaders: [],
          requiredScope: "projects:write" as OperationScope,
        })
      );
      registry.registerAction(
        createTestAction({
          actionId: "projects:deactivate",
          entityType: "project",
          method: "POST",
          urlPattern: "/projects/:id:deactivate",
          pathParams: [
            { name: "id", type: "string", description: "Project ID" },
          ],
          requiredHeaders: [],
          requiredScope: "projects:write" as OperationScope,
        })
      );

      // From "draft", only "activate" should be available
      const draftActions = registry.getActionsForResource(
        "project",
        "proj-1",
        "draft"
      );
      expect(draftActions).toHaveLength(1);
      expect(draftActions[0].actionId).toBe("projects:activate");

      // From "active", "archive" and "deactivate" should be available
      const activeActions = registry.getActionsForResource(
        "project",
        "proj-1",
        "active"
      );
      expect(activeActions).toHaveLength(2);
      const actionIds = activeActions.map((a) => a.actionId).sort();
      expect(actionIds).toEqual(["projects:archive", "projects:deactivate"]);
    });

    it("returns empty array for terminal state (AC10)", () => {
      registry.registerStateGraph({
        entityType: "project",
        states: ["draft", "active", "archived"],
        initialState: "draft",
        terminalStates: ["archived"],
        transitions: [
          {
            from: "draft",
            to: "active",
            command: "projects:activate",
            preconditions: [],
          },
        ],
      });

      const actions = registry.getActionsForResource(
        "project",
        "proj-1",
        "archived"
      );
      expect(actions).toEqual([]);
    });
  });

  describe("create (factory)", () => {
    it("creates independent registry instances", () => {
      const r1 = ActionRegistry.create();
      const r2 = ActionRegistry.create();
      r1.registerAction(createTestAction());
      expect(r1.getActions()).toHaveLength(1);
      expect(r2.getActions()).toHaveLength(0);
    });
  });
});
