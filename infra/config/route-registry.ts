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
  | "generateInviteFunction";

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
  {
    path: "/users/invite-codes",
    methods: ["POST", "GET"],
    authType: "jwt-or-apikey",
    handlerRef: "generateInviteFunction",
    epic: "Epic-2",
  },
];
