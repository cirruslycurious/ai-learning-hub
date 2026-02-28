/**
 * Actions Catalog Endpoint — GET /actions
 *
 * Returns all registered API actions with optional entity/scope filtering.
 * Part of proactive action discoverability (Story 3.2.10, AC1-AC7).
 */
import {
  wrapHandler,
  createSuccessResponse,
  getActionRegistry,
  registerInitialActions,
  type HandlerContext,
} from "@ai-learning-hub/middleware";

// Initialize registry on cold start (AC20: declarative registration)
const registry = getActionRegistry();
registerInitialActions(registry);

/**
 * GET /actions — Global action catalog.
 */
async function actionsCatalogHandler(ctx: HandlerContext) {
  const { event, requestId } = ctx;

  // Parse optional query parameters (AC3, AC4, AC5)
  const entity = event.queryStringParameters?.entity ?? undefined;
  const scope = event.queryStringParameters?.scope ?? undefined;

  const actions = registry.getActions({ entity, scope });

  return createSuccessResponse(actions, requestId, {
    links: {
      self: buildSelfLink(entity, scope),
    },
  });
}

function buildSelfLink(entity?: string, scope?: string): string {
  const params = new URLSearchParams();
  if (entity) params.set("entity", entity);
  if (scope) params.set("scope", scope);
  const qs = params.toString();
  return qs ? `/actions?${qs}` : "/actions";
}

export const handler = wrapHandler(actionsCatalogHandler, {
  requireAuth: true,
});
