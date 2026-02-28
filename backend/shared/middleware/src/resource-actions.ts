/**
 * Resource-scoped action enrichment (Story 3.2.10, AC8-AC13).
 *
 * Provides a helper to build `meta.actions[]` for single-resource GET responses.
 * Handlers call `buildResourceActions()` and include the result in `meta.actions`.
 */
import type { ResourceAction } from "@ai-learning-hub/types";
import { getActionRegistry } from "./action-registry.js";

/**
 * Build resource-scoped actions for a single resource (AC8, AC10, AC11).
 *
 * Returns an array of ResourceAction objects describing operations valid
 * for this specific resource instance. For state-bearing entities,
 * only transitions legal from `currentState` are included.
 *
 * Always returns an array (empty if no actions), never null (AC12).
 */
export function buildResourceActions(
  entityType: string,
  resourceId: string,
  currentState?: string
): ResourceAction[] {
  const registry = getActionRegistry();
  return registry.getActionsForResource(entityType, resourceId, currentState);
}
