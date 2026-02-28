/**
 * State Graph Endpoint — GET /states/{entityType}
 *
 * Returns the full state machine definition for a given entity type.
 * Part of proactive action discoverability (Story 3.2.10, AC14-AC18).
 */
import {
  wrapHandler,
  createSuccessResponse,
  getActionRegistry,
  registerInitialActions,
  type HandlerContext,
} from "@ai-learning-hub/middleware";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

// Initialize registry on cold start (AC20: declarative registration)
const registry = getActionRegistry();
registerInitialActions(registry);

/**
 * GET /states/{entityType} — State machine graph.
 */
async function stateGraphHandler(ctx: HandlerContext) {
  const { event, requestId } = ctx;

  const entityType = event.pathParameters?.entityType;
  if (!entityType) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "entityType path parameter is required"
    );
  }

  const graph = registry.getStateGraph(entityType);

  // AC17: 404 for entity types with no registered state machine
  if (!graph) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `No state machine registered for entity type: ${entityType}`
    );
  }

  return createSuccessResponse(graph, requestId, {
    links: { self: `/states/${entityType}` },
  });
}

export const handler = wrapHandler(stateGraphHandler, {
  requireAuth: true,
});
