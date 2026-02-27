/**
 * Scope tier resolution module (Story 3.2.6, AC2).
 *
 * Maps named permission tiers to granular operation permissions.
 * Handles hierarchical scope resolution for API key authorization.
 */
import type { ApiKeyScope } from "@ai-learning-hub/types";

/** Known valid scope tier values — used for runtime validation of deserialized scopes. */
export const VALID_SCOPES: ReadonlySet<string> = new Set<string>([
  "full",
  "capture",
  "read",
  "saves:write",
  "projects:write",
  "*",
  "saves:read",
]);

/**
 * Maps each API key tier to the operation permissions it grants.
 * Treat changes to this map as security-sensitive — modifying grants
 * affects ALL existing keys using the affected tiers.
 *
 * IMPORTANT: Every ApiKeyScope value MUST have an entry here.
 * Unrecognized scopes are dropped (not passed through) to prevent
 * privilege escalation via corrupted scope data.
 */
export const SCOPE_GRANTS: Record<ApiKeyScope, readonly string[]> = {
  full: ["*"],
  "*": ["*"],
  capture: ["saves:create"],
  read: [
    "saves:read",
    "projects:read",
    "links:read",
    "users:read",
    "keys:read",
  ],
  "saves:read": ["saves:read"],
  "saves:write": [
    "saves:read",
    "saves:write",
    "saves:create",
    "links:read",
    "links:write",
  ],
  "projects:write": ["projects:read", "projects:write"],
};

/**
 * Resolve granted scope tiers to a set of operation permissions.
 * Multiple tiers combine additively. Unrecognized scopes are silently
 * dropped to prevent privilege escalation via corrupted scope data.
 */
export function resolveScopeGrants(grantedScopes: string[]): Set<string> {
  const resolved = new Set<string>();
  for (const scope of grantedScopes) {
    const grants = SCOPE_GRANTS[scope as ApiKeyScope];
    if (grants) {
      for (const g of grants) resolved.add(g);
    }
    // Unrecognized scopes are dropped — not passed through as direct grants
  }
  return resolved;
}

/**
 * Check if granted scopes satisfy the required operation scope.
 * Returns true if the resolved grants include wildcard (`*`) or the exact required scope.
 */
export function checkScopeAccess(
  grantedScopes: string[],
  requiredScope: string
): boolean {
  const resolved = resolveScopeGrants(grantedScopes);
  return resolved.has("*") || resolved.has(requiredScope);
}
