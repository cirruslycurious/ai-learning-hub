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
    const validAuthTypes = ["jwt", "jwt-or-apikey", "iam", "admin", "analyst"];
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

  it("has correct methods for /users/me", () => {
    const route = ROUTE_REGISTRY.find((r) => r.path === "/users/me");
    expect(route?.methods).toEqual(["GET", "PATCH"]);
  });

  it("has correct methods for /users/api-keys", () => {
    const route = ROUTE_REGISTRY.find((r) => r.path === "/users/api-keys");
    expect(route?.methods).toEqual(["POST", "GET"]);
  });

  it("has DELETE method for /users/api-keys/{id}", () => {
    const route = ROUTE_REGISTRY.find((r) => r.path === "/users/api-keys/{id}");
    expect(route?.methods).toEqual(["DELETE"]);
  });

  it("has correct methods for /users/invite-codes", () => {
    const route = ROUTE_REGISTRY.find((r) => r.path === "/users/invite-codes");
    expect(route?.methods).toEqual(["POST", "GET"]);
  });
});
