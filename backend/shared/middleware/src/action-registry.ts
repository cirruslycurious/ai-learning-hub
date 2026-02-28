/**
 * Action Registry — central declarative action catalog (Story 3.2.10, AC20).
 *
 * Actions are registered once at module load time. Handlers do NOT
 * modify this registry — they call it to resolve available actions.
 */
import type {
  ActionDefinition,
  StateGraph,
  ResourceAction,
} from "@ai-learning-hub/types";
import { SCOPE_GRANTS } from "./scope-resolver.js";
import type { ApiKeyScope } from "@ai-learning-hub/types";

/** Regex for valid actionId: lowercase entity:verb with optional hyphens (AC6) */
const ACTION_ID_PATTERN = /^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$/;

/**
 * Resolve a scope tier name to the set of operation permissions it grants.
 * Used by getActions({ scope }) to filter by what a tier can access.
 */
function resolveOperationsForTier(tier: string): Set<string> {
  const grants = SCOPE_GRANTS[tier as ApiKeyScope];
  if (!grants) return new Set();
  return new Set(grants);
}

export class ActionRegistry {
  private readonly actions = new Map<string, ActionDefinition>();
  private readonly stateGraphs = new Map<string, StateGraph>();

  /** Factory method — creates an independent registry instance. */
  static create(): ActionRegistry {
    return new ActionRegistry();
  }

  /**
   * Register an action definition. Validates actionId format and deduplicates.
   */
  registerAction(action: ActionDefinition): void {
    if (!ACTION_ID_PATTERN.test(action.actionId)) {
      throw new Error(
        `actionId must follow entity:verb format (lowercase, colon-separated): "${action.actionId}"`
      );
    }
    // Deduplicate — last registration wins silently
    this.actions.set(action.actionId, action);
  }

  /**
   * Register a state machine graph for an entity type.
   * Validates state/transition consistency.
   */
  registerStateGraph(graph: StateGraph): void {
    const stateSet = new Set(graph.states);

    if (!stateSet.has(graph.initialState)) {
      throw new Error(
        `initialState "${graph.initialState}" is not in states list`
      );
    }

    for (const terminal of graph.terminalStates) {
      if (!stateSet.has(terminal)) {
        throw new Error(
          `terminalStates contains "${terminal}" which is not in states list`
        );
      }
    }

    for (const t of graph.transitions) {
      if (!stateSet.has(t.from)) {
        throw new Error(`transition from="${t.from}" is not in states list`);
      }
      if (!stateSet.has(t.to)) {
        throw new Error(`transition to="${t.to}" is not in states list`);
      }
    }

    this.stateGraphs.set(graph.entityType, graph);
  }

  /**
   * Get all actions, optionally filtered by entity prefix and/or scope tier.
   * Filters combine with AND logic (AC5).
   */
  getActions(filters?: {
    entity?: string;
    scope?: string;
  }): ActionDefinition[] {
    let result = Array.from(this.actions.values());

    // Filter by entity prefix (AC3)
    if (filters?.entity) {
      const prefix = `${filters.entity}:`;
      result = result.filter((a) => a.actionId.startsWith(prefix));
    }

    // Filter by scope tier (AC4) — resolve tier to operations, then match.
    // Actions with requiredScope "*" are accessible to any authenticated user,
    // so they always pass the scope filter.
    if (filters?.scope) {
      const grantedOps = resolveOperationsForTier(filters.scope);
      if (grantedOps.size === 0) return [];
      if (!grantedOps.has("*")) {
        result = result.filter(
          (a) =>
            a.requiredScope === "*" || grantedOps.has(a.requiredScope as string)
        );
      }
    }

    return result;
  }

  /**
   * Get state graph for an entity type. Returns null if none registered (AC17).
   */
  getStateGraph(entityType: string): StateGraph | null {
    return this.stateGraphs.get(entityType) ?? null;
  }

  /**
   * Get available actions for a specific resource instance (AC8, AC10, AC11).
   *
   * For state-bearing entities with a currentState, only legal transitions
   * from that state are returned. For non-state entities, all instance-level
   * actions are returned.
   */
  getActionsForResource(
    entityType: string,
    resourceId: string,
    currentState?: string
  ): ResourceAction[] {
    // Get all actions for this entity type
    const entityActions = Array.from(this.actions.values()).filter(
      (a) => a.entityType === entityType
    );

    if (entityActions.length === 0) return [];

    const graph = this.stateGraphs.get(entityType);

    // State-bearing entity with currentState (AC10)
    if (graph && currentState) {
      const legalCommands = new Set(
        graph.transitions
          .filter((t) => t.from === currentState)
          .map((t) => t.command)
      );

      if (legalCommands.size === 0) return [];

      return entityActions
        .filter((a) => legalCommands.has(a.actionId))
        .map((a) => toResourceAction(a, resourceId));
    }

    // Non-state entity (AC11) — return instance-level actions only
    // Instance-level = actions whose urlPattern contains :id
    return entityActions
      .filter((a) => a.urlPattern.includes(":id"))
      .map((a) => toResourceAction(a, resourceId));
  }
}

/**
 * Convert an ActionDefinition to a ResourceAction with resolved URL.
 */
function toResourceAction(
  action: ActionDefinition,
  resourceId: string
): ResourceAction {
  return {
    actionId: action.actionId,
    url: action.urlPattern.replace(":id", resourceId),
    method: action.method,
    requiredHeaders: action.requiredHeaders.map((h) => h.name),
  };
}

/** Shared singleton instance for Lambda runtime use. */
let _instance: ActionRegistry | null = null;

/**
 * Get the shared singleton registry instance.
 * Use ActionRegistry.create() for isolated instances (e.g. tests).
 */
export function getActionRegistry(): ActionRegistry {
  if (!_instance) {
    _instance = ActionRegistry.create();
  }
  return _instance;
}

/**
 * Reset the shared singleton (for testing only).
 */
export function resetActionRegistry(): void {
  _instance = null;
}
