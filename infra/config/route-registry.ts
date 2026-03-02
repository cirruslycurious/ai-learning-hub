/**
 * Route Registry — Canonical source of truth for all API routes.
 *
 * Each epic adds entries here; architecture enforcement tests (T1-T4 in D5)
 * validate that CDK resources match this registry. Route stacks consume this
 * registry to wire API Gateway resources.
 *
 * Auth types:
 *   - "jwt"            → JWT authorizer only (Clerk token)
 *   - "jwt-or-apikey"  → JWT authorizer with API key fallback
 *   - "iam"            → AWS IAM auth (internal pipelines)
 *   - "admin"          → JWT + admin role check
 *   - "analyst"        → JWT + admin-or-analyst role check
 */

export type AuthType = "jwt" | "jwt-or-apikey" | "iam" | "admin" | "analyst";

/**
 * Handler reference keys matching AuthStack public property names.
 * Future epics extend this union with their handler property names.
 */
export type HandlerRef =
  | "validateInviteFunction"
  | "usersMeFunction"
  | "apiKeysFunction"
  | "generateInviteFunction"
  | "savesCreateFunction"
  | "savesListFunction"
  | "savesGetFunction"
  | "savesUpdateFunction"
  | "savesDeleteFunction"
  | "savesRestoreFunction"
  | "savesEventsFunction"
  | "actionsCatalogFunction"
  | "stateGraphFunction";

export interface RouteEntry {
  /** URL path (e.g., "/auth/validate-invite") */
  path: string;
  /** HTTP methods for this path */
  methods: string[];
  /** Auth type required */
  authType: AuthType;
  /** CDK handler reference key (matches AuthStack property name) */
  handlerRef: HandlerRef;
  /** Epic that introduced this route */
  epic: string;
}

/**
 * All registered API routes. Tests validate CDK matches this registry.
 */
export const ROUTE_REGISTRY: RouteEntry[] = [
  // Epic 2 — Authentication & Profile
  {
    path: "/auth/validate-invite",
    methods: ["POST"],
    authType: "jwt",
    handlerRef: "validateInviteFunction",
    epic: "Epic-2",
  },
  {
    path: "/users/me",
    methods: ["GET", "PATCH"],
    authType: "jwt-or-apikey",
    handlerRef: "usersMeFunction",
    epic: "Epic-2",
  },
  {
    path: "/users/api-keys",
    methods: ["POST", "GET"],
    authType: "jwt-or-apikey",
    handlerRef: "apiKeysFunction",
    epic: "Epic-2",
  },
  {
    path: "/users/api-keys/{id}",
    methods: ["DELETE"],
    authType: "jwt-or-apikey",
    handlerRef: "apiKeysFunction",
    epic: "Epic-2",
  },
  // Epic 3.2.8 — Auth Domain Retrofit (command endpoints)
  {
    path: "/users/me/update",
    methods: ["POST"],
    authType: "jwt-or-apikey",
    handlerRef: "usersMeFunction",
    epic: "Epic-3.2",
  },
  {
    path: "/users/api-keys/{id}/revoke",
    methods: ["POST"],
    authType: "jwt-or-apikey",
    handlerRef: "apiKeysFunction",
    epic: "Epic-3.2",
  },
  {
    path: "/users/invite-codes",
    methods: ["POST", "GET"],
    authType: "jwt-or-apikey",
    handlerRef: "generateInviteFunction",
    epic: "Epic-2",
  },
  // Epic 3 — Save URLs (Core CRUD)
  //
  // API key scope matrix (Story 3.2.7):
  //   POST   /saves                           → requiredScope: "saves:create"
  //   GET    /saves                           → requiredScope: "saves:read"
  //   GET    /saves/{saveId}                  → requiredScope: "saves:read"
  //   PATCH  /saves/{saveId}                  → requiredScope: "saves:write"
  //   DELETE /saves/{saveId}                  → requiredScope: "saves:write"
  //   POST   /saves/{saveId}/restore          → requiredScope: "saves:write"
  //   POST   /saves/{saveId}/update-metadata  → requiredScope: "saves:write"
  //   GET    /saves/{saveId}/events           → requiredScope: "saves:read"
  //
  // Scope enforced in each handler via wrapHandler({ requiredScope }).
  // JWT users bypass scope checks (all scopes implicitly granted).
  //
  {
    path: "/saves",
    methods: ["POST"],
    authType: "jwt-or-apikey",
    handlerRef: "savesCreateFunction",
    epic: "Epic-3",
  },
  {
    path: "/saves",
    methods: ["GET"],
    authType: "jwt-or-apikey",
    handlerRef: "savesListFunction",
    epic: "Epic-3",
  },
  {
    path: "/saves/{saveId}",
    methods: ["GET"],
    authType: "jwt-or-apikey",
    handlerRef: "savesGetFunction",
    epic: "Epic-3",
  },
  {
    path: "/saves/{saveId}",
    methods: ["PATCH"],
    authType: "jwt-or-apikey",
    handlerRef: "savesUpdateFunction",
    epic: "Epic-3",
  },
  {
    path: "/saves/{saveId}",
    methods: ["DELETE"],
    authType: "jwt-or-apikey",
    handlerRef: "savesDeleteFunction",
    epic: "Epic-3",
  },
  {
    path: "/saves/{saveId}/restore",
    methods: ["POST"],
    authType: "jwt-or-apikey",
    handlerRef: "savesRestoreFunction",
    epic: "Epic-3",
  },
  // Epic 3.2.7 — Command Endpoint Pattern & Saves Domain Retrofit
  {
    path: "/saves/{saveId}/update-metadata",
    methods: ["POST"],
    authType: "jwt-or-apikey",
    handlerRef: "savesUpdateFunction",
    epic: "Epic-3.2",
  },
  {
    path: "/saves/{saveId}/events",
    methods: ["GET"],
    authType: "jwt-or-apikey",
    handlerRef: "savesEventsFunction",
    epic: "Epic-3.2",
  },
  // Epic 3.2.10 — Proactive Action Discoverability
  {
    path: "/actions",
    methods: ["GET"],
    authType: "jwt-or-apikey",
    handlerRef: "actionsCatalogFunction",
    epic: "Epic-3.2",
  },
  {
    path: "/states/{entityType}",
    methods: ["GET"],
    authType: "jwt-or-apikey",
    handlerRef: "stateGraphFunction",
    epic: "Epic-3.2",
  },
];
