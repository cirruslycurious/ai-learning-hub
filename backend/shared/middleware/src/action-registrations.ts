/**
 * Declarative action registrations (Story 3.2.10, AC20).
 *
 * All current API actions are registered here. Future stories (3.2.7, 3.2.8)
 * add domain actions by calling registerAction() — they do NOT modify
 * discoverability handlers.
 */
import { ErrorCode } from "@ai-learning-hub/types";
import type { ActionDefinition, OperationScope } from "@ai-learning-hub/types";
import type { ActionRegistry } from "./action-registry.js";

/**
 * Register all current saves domain actions (Task 7.1).
 * Each registration includes full inputSchema, pathParams, queryParams,
 * and structured requiredHeaders with format strings (Task 7.4).
 */
function registerSavesActions(registry: ActionRegistry): void {
  const savesActions: ActionDefinition[] = [
    {
      actionId: "saves:create",
      description: "Create a new URL save",
      method: "POST",
      urlPattern: "/saves",
      entityType: "saves",
      pathParams: [],
      queryParams: [],
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", minLength: 1 },
          title: { type: "string" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          folderId: { type: "string" },
        },
        required: ["url"],
      },
      requiredHeaders: [
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
      ],
      // Must match handler's wrapHandler requiredScope ("saves:create")
      requiredScope: "saves:create" as OperationScope,
      expectedErrors: [
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.DUPLICATE_SAVE,
        ErrorCode.UNAUTHORIZED,
        ErrorCode.RATE_LIMITED,
      ],
    },
    {
      actionId: "saves:get",
      description: "Get a single save by ID",
      method: "GET",
      urlPattern: "/saves/:id",
      entityType: "saves",
      pathParams: [
        { name: "id", type: "string", description: "Save ID (ULID)" },
      ],
      queryParams: [],
      inputSchema: null,
      requiredHeaders: [],
      requiredScope: "saves:read" as OperationScope,
      expectedErrors: [ErrorCode.NOT_FOUND, ErrorCode.UNAUTHORIZED],
    },
    {
      actionId: "saves:list",
      description: "List saves with filtering and pagination",
      method: "GET",
      urlPattern: "/saves",
      entityType: "saves",
      pathParams: [],
      queryParams: [
        {
          name: "limit",
          type: "number",
          description: "Max items per page (1-100, default 20)",
          required: false,
        },
        {
          name: "cursor",
          type: "string",
          description: "Pagination cursor from previous response",
          required: false,
        },
        {
          name: "tag",
          type: "string",
          description: "Filter by tag",
          required: false,
        },
        {
          name: "contentType",
          type: "string",
          description: "Filter by content type",
          required: false,
        },
        {
          name: "sort",
          type: "string",
          description: "Sort field (createdAt, updatedAt, title)",
          required: false,
        },
        {
          name: "order",
          type: "string",
          description: "Sort order (asc, desc)",
          required: false,
        },
      ],
      inputSchema: null,
      requiredHeaders: [],
      requiredScope: "saves:read" as OperationScope,
      expectedErrors: [ErrorCode.VALIDATION_ERROR, ErrorCode.UNAUTHORIZED],
    },
    {
      actionId: "saves:update",
      description: "Update save metadata (title, tags, description, folder)",
      method: "PATCH",
      urlPattern: "/saves/:id",
      entityType: "saves",
      pathParams: [
        { name: "id", type: "string", description: "Save ID (ULID)" },
      ],
      queryParams: [],
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          folderId: { type: "string" },
        },
      },
      requiredHeaders: [
        {
          name: "If-Match",
          format: "\\d+",
          description: "Expected version for optimistic concurrency",
        },
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
      ],
      requiredScope: "saves:write" as OperationScope,
      expectedErrors: [
        ErrorCode.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.VERSION_CONFLICT,
        ErrorCode.UNAUTHORIZED,
      ],
    },
    {
      actionId: "saves:delete",
      description: "Soft-delete a save",
      method: "DELETE",
      urlPattern: "/saves/:id",
      entityType: "saves",
      pathParams: [
        { name: "id", type: "string", description: "Save ID (ULID)" },
      ],
      queryParams: [],
      inputSchema: null,
      requiredHeaders: [
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
      ],
      requiredScope: "saves:write" as OperationScope,
      expectedErrors: [ErrorCode.NOT_FOUND, ErrorCode.UNAUTHORIZED],
    },
    {
      actionId: "saves:restore",
      description: "Restore a soft-deleted save",
      method: "POST",
      urlPattern: "/saves/:id/restore",
      entityType: "saves",
      pathParams: [
        { name: "id", type: "string", description: "Save ID (ULID)" },
      ],
      queryParams: [],
      inputSchema: null,
      requiredHeaders: [
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
      ],
      requiredScope: "saves:write" as OperationScope,
      expectedErrors: [
        ErrorCode.NOT_FOUND,
        ErrorCode.CONFLICT,
        ErrorCode.UNAUTHORIZED,
      ],
    },
    {
      actionId: "saves:update-metadata",
      description:
        "Update save metadata via CQRS command (explicit command semantics)",
      method: "POST",
      urlPattern: "/saves/:id/update-metadata",
      entityType: "saves",
      pathParams: [
        { name: "id", type: "string", description: "Save ID (ULID)" },
      ],
      queryParams: [],
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          userNotes: { type: "string" },
          contentType: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          context: {
            type: "object",
            properties: {
              trigger: { type: "string" },
              source: { type: "string" },
              confidence: { type: "number" },
              upstream_ref: { type: "string" },
            },
          },
        },
      },
      requiredHeaders: [
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
        {
          name: "If-Match",
          format: "\\d+",
          description: "Expected version for optimistic concurrency",
        },
      ],
      requiredScope: "saves:write" as OperationScope,
      expectedErrors: [
        ErrorCode.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.VERSION_CONFLICT,
        ErrorCode.UNAUTHORIZED,
        ErrorCode.RATE_LIMITED,
      ],
    },
    {
      actionId: "saves:events",
      description: "Query event history for a save",
      method: "GET",
      urlPattern: "/saves/:id/events",
      entityType: "saves",
      pathParams: [
        { name: "id", type: "string", description: "Save ID (ULID)" },
      ],
      queryParams: [
        {
          name: "limit",
          type: "number",
          description: "Max events per page (1-200, default 50)",
          required: false,
        },
        {
          name: "cursor",
          type: "string",
          description: "Pagination cursor from previous response",
          required: false,
        },
        {
          name: "since",
          type: "string",
          description: "ISO 8601 timestamp to filter events after",
          required: false,
        },
      ],
      inputSchema: null,
      requiredHeaders: [],
      requiredScope: "saves:read" as OperationScope,
      expectedErrors: [ErrorCode.NOT_FOUND, ErrorCode.UNAUTHORIZED],
    },
  ];

  for (const action of savesActions) {
    registry.registerAction(action);
  }
}

/**
 * Register discoverability actions themselves (Task 7.2).
 */
function registerDiscoveryActions(registry: ActionRegistry): void {
  registry.registerAction({
    actionId: "discovery:actions",
    description: "List all available API actions (global catalog)",
    method: "GET",
    urlPattern: "/actions",
    entityType: "discovery",
    pathParams: [],
    queryParams: [
      {
        name: "entity",
        type: "string",
        description: "Filter by entity type prefix",
        required: false,
      },
      {
        name: "scope",
        type: "string",
        description: "Filter by scope tier",
        required: false,
      },
    ],
    inputSchema: null,
    requiredHeaders: [],
    requiredScope: "*" as OperationScope,
    expectedErrors: [ErrorCode.UNAUTHORIZED],
  });

  registry.registerAction({
    actionId: "discovery:states",
    description: "Get state machine definition for an entity type",
    method: "GET",
    urlPattern: "/states/:entityType",
    entityType: "discovery",
    pathParams: [
      {
        name: "entityType",
        type: "string",
        description: "Entity type to get state graph for",
      },
    ],
    queryParams: [],
    inputSchema: null,
    requiredHeaders: [],
    requiredScope: "*" as OperationScope,
    expectedErrors: [ErrorCode.UNAUTHORIZED, ErrorCode.NOT_FOUND],
  });
}

/**
 * Register all initial actions in the provided registry.
 * Called once during Lambda cold start (via handler module load).
 * Idempotent — repeated calls on the same registry are no-ops.
 */
const _registeredInstances = new WeakSet<ActionRegistry>();
export function registerInitialActions(registry: ActionRegistry): void {
  if (_registeredInstances.has(registry)) return;
  registerSavesActions(registry);
  registerDiscoveryActions(registry);
  _registeredInstances.add(registry);
}
