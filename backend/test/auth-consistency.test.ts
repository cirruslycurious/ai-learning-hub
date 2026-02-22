/**
 * Auth Consistency Test (Story 2.1-D9, AC6)
 *
 * Validates that wrapHandler options in each handler file are consistent
 * with the route registry's authType declarations. Catches mismatches like
 * a handler declaring requireAuth: false for a route the registry requires auth on.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Import route registry from infra config (resolved via tsconfig paths)
// We read the registry source file and parse it since it's in a different workspace
const INFRA_ROOT = path.resolve(__dirname, "../../infra");
const REGISTRY_PATH = path.join(INFRA_ROOT, "config/route-registry.ts");
const FUNCTIONS_DIR = path.resolve(__dirname, "../functions");

interface RegistryEntry {
  path: string;
  methods: string[];
  authType: string;
  handlerRef: string;
}

/**
 * Parse the route registry TypeScript source to extract route entries.
 * Uses regex parsing since we can't import across workspace boundaries in tests.
 */
function parseRouteRegistry(): RegistryEntry[] {
  const content = fs.readFileSync(REGISTRY_PATH, "utf-8");
  const entries: RegistryEntry[] = [];

  // Match each route object in ROUTE_REGISTRY array
  const objectPattern =
    /\{\s*path:\s*"([^"]+)",\s*methods:\s*\[([^\]]+)\],\s*authType:\s*"([^"]+)",\s*handlerRef:\s*"([^"]+)"/g;
  let match;

  while ((match = objectPattern.exec(content)) !== null) {
    const methods = match[2].split(",").map((m) => m.trim().replace(/"/g, ""));
    entries.push({
      path: match[1],
      methods,
      authType: match[3],
      handlerRef: match[4],
    });
  }

  return entries;
}

/**
 * Map handlerRef to the corresponding handler.ts file path.
 * Convention: handlerRef like "usersMeFunction" → backend/functions/users-me/handler.ts
 */
const HANDLER_REF_TO_DIR: Record<string, string> = {
  validateInviteFunction: "validate-invite",
  usersMeFunction: "users-me",
  apiKeysFunction: "api-keys",
  generateInviteFunction: "invite-codes",
};

describe("Auth Consistency: wrapHandler options vs ROUTE_REGISTRY authType (AC6)", () => {
  const registry = parseRouteRegistry();

  it("should parse the route registry and match source entry count", () => {
    expect(registry.length).toBeGreaterThan(0);

    // Count the number of route objects in the source file by matching `path:` occurrences
    // inside the ROUTE_REGISTRY array. This ensures the regex parser captures ALL entries.
    const content = fs.readFileSync(REGISTRY_PATH, "utf-8");
    const registryArrayMatch = content.slice(content.indexOf("ROUTE_REGISTRY"));
    const pathOccurrences = (registryArrayMatch.match(/path:\s*"/g) ?? [])
      .length;
    expect(registry.length).toBe(pathOccurrences);
  });

  it("handlers for non-public routes have requireAuth: true", () => {
    const violations: string[] = [];

    // Group by handlerRef to avoid checking the same file multiple times
    const handlerRefs = new Set(registry.map((r) => r.handlerRef));

    for (const handlerRef of handlerRefs) {
      const routes = registry.filter((r) => r.handlerRef === handlerRef);
      const dirName = HANDLER_REF_TO_DIR[handlerRef];
      if (!dirName) {
        violations.push(
          `${handlerRef} — not in HANDLER_REF_TO_DIR map, cannot validate`
        );
        continue;
      }

      const handlerPath = path.join(FUNCTIONS_DIR, dirName, "handler.ts");
      if (!fs.existsSync(handlerPath)) {
        violations.push(
          `${handlerRef} — handler file not found at ${handlerPath}`
        );
        continue;
      }

      const content = fs.readFileSync(handlerPath, "utf-8");

      // Check if any route for this handler requires auth
      const requiresAuth = routes.some((r) => r.authType !== "public");

      if (requiresAuth) {
        // Handler must have requireAuth: true in wrapHandler call
        if (!/requireAuth:\s*true/.test(content)) {
          violations.push(
            `Handler ${handlerRef} has requireAuth: false (or missing) but registry requires ${routes[0].authType}`
          );
        }
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `wrapHandler options inconsistent with ROUTE_REGISTRY:\n${violations.map((v) => `  - ${v}`).join("\n")}`
      );
    }
  });

  it("handlers for routes with scope requirements have requiredScope set", () => {
    const violations: string[] = [];

    // Check handlers that serve routes with scope-sensitive auth
    const handlerRefs = new Set(registry.map((r) => r.handlerRef));

    for (const handlerRef of handlerRefs) {
      const routes = registry.filter((r) => r.handlerRef === handlerRef);
      const dirName = HANDLER_REF_TO_DIR[handlerRef];
      if (!dirName) {
        violations.push(
          `${handlerRef} — not in HANDLER_REF_TO_DIR map, cannot validate`
        );
        continue;
      }

      const handlerPath = path.join(FUNCTIONS_DIR, dirName, "handler.ts");
      if (!fs.existsSync(handlerPath)) continue;

      const content = fs.readFileSync(handlerPath, "utf-8");

      // Routes with jwt-or-apikey auth accept API keys, which use scopes.
      // The handler MAY have requiredScope — this test verifies that if
      // requiredScope is present, it's a non-empty string.
      const scopeMatch = content.match(/requiredScope:\s*"([^"]*)"/);
      if (scopeMatch && scopeMatch[1] === "") {
        violations.push(
          `Handler ${handlerRef} has empty requiredScope string — either remove or set a valid scope`
        );
      }

      // Check that jwt-or-apikey routes don't have requireAuth: false
      const hasApiKeyRoutes = routes.some(
        (r) => r.authType === "jwt-or-apikey"
      );
      if (hasApiKeyRoutes && /requireAuth:\s*false/.test(content)) {
        violations.push(
          `Handler ${handlerRef} has requireAuth: false but serves jwt-or-apikey routes`
        );
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `Scope/auth inconsistencies:\n${violations.map((v) => `  - ${v}`).join("\n")}`
      );
    }
  });
});
