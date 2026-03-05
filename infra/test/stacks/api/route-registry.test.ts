/**
 * Route Registry Tests (AC14-AC15)
 *
 * Validates the route registry is complete and well-formed.
 */
import { describe, it, expect } from "vitest";
import { ROUTE_REGISTRY } from "../../../config/route-registry";

describe("Route Registry (AC14-AC15)", () => {
  it("contains all Epic 2 routes", () => {
    const paths = ROUTE_REGISTRY.map((r) => r.path);
    expect(paths).toContain("/auth/validate-invite");
    expect(paths).toContain("/users/me");
    expect(paths).toContain("/users/api-keys");
    expect(paths).toContain("/users/api-keys/{id}");
    expect(paths).toContain("/users/invite-codes");
  });

  it("all routes have valid auth types", () => {
    const validAuthTypes = [
      "jwt",
      "jwt-or-apikey",
      "iam",
      "admin",
      "analyst",
      "none",
    ];
    for (const route of ROUTE_REGISTRY) {
      expect(validAuthTypes).toContain(route.authType);
    }
  });

  it("all routes have non-empty methods", () => {
    for (const route of ROUTE_REGISTRY) {
      expect(route.methods.length).toBeGreaterThan(0);
    }
  });

  it("all routes have handler references", () => {
    for (const route of ROUTE_REGISTRY) {
      expect(route.handlerRef).toBeTruthy();
    }
  });

  it("all routes have epic references", () => {
    for (const route of ROUTE_REGISTRY) {
      expect(route.epic).toBeTruthy();
    }
  });

  it("/auth/validate-invite uses JWT-only auth", () => {
    const route = ROUTE_REGISTRY.find(
      (r) => r.path === "/auth/validate-invite"
    );
    expect(route?.authType).toBe("jwt");
    expect(route?.methods).toEqual(["POST"]);
  });

  it("/users/* routes use jwt-or-apikey auth", () => {
    const userRoutes = ROUTE_REGISTRY.filter((r) =>
      r.path.startsWith("/users/")
    );
    for (const route of userRoutes) {
      expect(route.authType).toBe("jwt-or-apikey");
    }
  });

  it("has correct per-method entries for /users/me", () => {
    const routes = ROUTE_REGISTRY.filter((r) => r.path === "/users/me");
    const allMethods = routes.flatMap((r) => r.methods);
    expect(allMethods).toContain("GET");
    expect(allMethods).toContain("PATCH");
    expect(routes.find((r) => r.methods.includes("GET"))?.handlerRef).toBe(
      "readUsersMeFunction"
    );
    expect(routes.find((r) => r.methods.includes("PATCH"))?.handlerRef).toBe(
      "writeUsersMeFunction"
    );
  });

  it("has correct per-method entries for /users/api-keys", () => {
    const routes = ROUTE_REGISTRY.filter((r) => r.path === "/users/api-keys");
    const allMethods = routes.flatMap((r) => r.methods);
    expect(allMethods).toContain("POST");
    expect(allMethods).toContain("GET");
    expect(routes.find((r) => r.methods.includes("POST"))?.handlerRef).toBe(
      "createApiKeyFunction"
    );
    expect(routes.find((r) => r.methods.includes("GET"))?.handlerRef).toBe(
      "listApiKeyFunction"
    );
  });

  it("has DELETE method for /users/api-keys/{id}", () => {
    const route = ROUTE_REGISTRY.find((r) => r.path === "/users/api-keys/{id}");
    expect(route?.methods).toEqual(["DELETE"]);
    expect(route?.handlerRef).toBe("revokeApiKeyFunction");
  });

  it("has correct per-method entries for /users/invite-codes", () => {
    const routes = ROUTE_REGISTRY.filter(
      (r) => r.path === "/users/invite-codes"
    );
    const allMethods = routes.flatMap((r) => r.methods);
    expect(allMethods).toContain("POST");
    expect(allMethods).toContain("GET");
    expect(routes.find((r) => r.methods.includes("POST"))?.handlerRef).toBe(
      "generateInviteFunction"
    );
    expect(routes.find((r) => r.methods.includes("GET"))?.handlerRef).toBe(
      "listInviteCodesFunction"
    );
  });
});
