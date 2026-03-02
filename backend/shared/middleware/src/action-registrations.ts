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
 * Register auth domain actions (Story 3.2.8, AC19).
 * Includes users/me, api-keys, and invite-codes endpoints.
 */
function registerAuthActions(registry: ActionRegistry): void {
  const authActions: ActionDefinition[] = [
    // --- Users profile actions ---
    {
      actionId: "users:get-profile",
      description: "Get the authenticated user's profile",
      method: "GET",
      urlPattern: "/users/me",
      entityType: "users",
      pathParams: [],
      queryParams: [],
      inputSchema: null,
      requiredHeaders: [],
      requiredScope: "users:read" as OperationScope,
      expectedErrors: [ErrorCode.NOT_FOUND, ErrorCode.UNAUTHORIZED],
    },
    {
      actionId: "users:update-profile",
      description: "Update the authenticated user's profile (PATCH)",
      method: "PATCH",
      urlPattern: "/users/me",
      entityType: "users",
      pathParams: [],
      queryParams: [],
      inputSchema: {
        type: "object",
        properties: {
          displayName: { type: "string", maxLength: 255 },
          globalPreferences: { type: "object" },
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
      requiredScope: "users:write" as OperationScope,
      expectedErrors: [
        ErrorCode.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.VERSION_CONFLICT,
        ErrorCode.UNAUTHORIZED,
        ErrorCode.RATE_LIMITED,
      ],
    },
    {
      actionId: "users:update-profile-command",
      description:
        "Update the authenticated user's profile via command endpoint",
      method: "POST",
      urlPattern: "/users/me/update",
      entityType: "users",
      pathParams: [],
      queryParams: [],
      inputSchema: {
        type: "object",
        properties: {
          displayName: { type: "string", maxLength: 255 },
          globalPreferences: { type: "object" },
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
      requiredScope: "users:write" as OperationScope,
      expectedErrors: [
        ErrorCode.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.VERSION_CONFLICT,
        ErrorCode.UNAUTHORIZED,
        ErrorCode.RATE_LIMITED,
      ],
    },

    // --- API Keys actions ---
    {
      actionId: "keys:create",
      description: "Create a new API key",
      method: "POST",
      urlPattern: "/users/api-keys",
      entityType: "keys",
      pathParams: [],
      queryParams: [],
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 255 },
          scopes: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
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
        required: ["name", "scopes"],
      },
      requiredHeaders: [
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
      ],
      requiredScope: "keys:manage" as OperationScope,
      expectedErrors: [
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.UNAUTHORIZED,
        ErrorCode.RATE_LIMITED,
      ],
    },
    {
      actionId: "keys:list",
      description: "List the authenticated user's API keys",
      method: "GET",
      urlPattern: "/users/api-keys",
      entityType: "keys",
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
      ],
      inputSchema: null,
      requiredHeaders: [],
      requiredScope: "keys:read" as OperationScope,
      expectedErrors: [ErrorCode.UNAUTHORIZED],
    },
    {
      actionId: "keys:revoke",
      description: "Revoke an API key (DELETE method)",
      method: "DELETE",
      urlPattern: "/users/api-keys/:id",
      entityType: "keys",
      pathParams: [
        { name: "id", type: "string", description: "API key ID (ULID)" },
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
      requiredScope: "keys:manage" as OperationScope,
      expectedErrors: [ErrorCode.NOT_FOUND, ErrorCode.UNAUTHORIZED],
    },
    {
      actionId: "keys:revoke-command",
      description: "Revoke an API key via command endpoint",
      method: "POST",
      urlPattern: "/users/api-keys/:id/revoke",
      entityType: "keys",
      pathParams: [
        { name: "id", type: "string", description: "API key ID (ULID)" },
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
      requiredScope: "keys:manage" as OperationScope,
      expectedErrors: [ErrorCode.NOT_FOUND, ErrorCode.UNAUTHORIZED],
    },

    // --- Invite codes actions ---
    {
      actionId: "invites:generate",
      description: "Generate a new invite code",
      method: "POST",
      urlPattern: "/users/invite-codes",
      entityType: "invites",
      pathParams: [],
      queryParams: [],
      inputSchema: null,
      requiredHeaders: [
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
      ],
      requiredScope: "invites:manage" as OperationScope,
      expectedErrors: [ErrorCode.UNAUTHORIZED, ErrorCode.RATE_LIMITED],
    },
    {
      actionId: "invites:list",
      description: "List the authenticated user's generated invite codes",
      method: "GET",
      urlPattern: "/users/invite-codes",
      entityType: "invites",
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
      ],
      inputSchema: null,
      requiredHeaders: [],
      requiredScope: "invites:read" as OperationScope,
      expectedErrors: [ErrorCode.UNAUTHORIZED],
    },
    {
      actionId: "invites:validate",
      description: "Validate and redeem an invite code during signup",
      method: "POST",
      urlPattern: "/auth/validate-invite",
      entityType: "invites",
      pathParams: [],
      queryParams: [],
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", minLength: 8, maxLength: 16 },
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
        required: ["code"],
      },
      requiredHeaders: [
        {
          name: "Idempotency-Key",
          format: "[a-zA-Z0-9_\\-.]{1,256}",
          description: "Client-generated dedup key",
        },
      ],
      requiredScope: "*" as OperationScope, // Any authenticated user can validate
      expectedErrors: [
        ErrorCode.VALIDATION_ERROR,
        ErrorCode.INVALID_INVITE_CODE,
        ErrorCode.UNAUTHORIZED,
        ErrorCode.RATE_LIMITED,
      ],
    },
  ];

  for (const action of authActions) {
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
 * Register ops actions — batch (Story 3.2.9, AC16).
 */
function registerOpsActions(registry: ActionRegistry): void {
  registry.registerAction({
    actionId: "batch:execute",
    description:
      "Execute multiple API operations in a single request (non-transactional)",
    method: "POST",
    urlPattern: "/batch",
    entityType: "ops",
    pathParams: [],
    queryParams: [],
    inputSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 25,
          items: {
            type: "object",
            properties: {
              method: {
                type: "string",
                enum: ["POST", "PATCH", "DELETE"],
              },
              path: { type: "string", minLength: 1 },
              body: { type: "object" },
              headers: { type: "object" },
            },
            required: ["method", "path"],
          },
        },
      },
      required: ["operations"],
    },
    requiredHeaders: [
      {
        name: "Idempotency-Key",
        format: "[a-zA-Z0-9_\\-.]{1,256}",
        description: "Client-generated dedup key for the batch request",
      },
    ],
    requiredScope: "batch:execute" as OperationScope,
    expectedErrors: [
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.UNAUTHORIZED,
      ErrorCode.SCOPE_INSUFFICIENT,
      ErrorCode.RATE_LIMITED,
    ],
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
  registerAuthActions(registry); // Story 3.2.8
  registerDiscoveryActions(registry);
  registerOpsActions(registry); // Story 3.2.9
  _registeredInstances.add(registry);
}
