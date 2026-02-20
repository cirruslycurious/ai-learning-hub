/**
 * smoke-test/scenarios/route-connectivity.ts
 * AC9–AC10: Route connectivity and CORS preflight for all routes in ROUTE_REGISTRY
 */

import { ROUTE_REGISTRY } from "../route-registry-bridge.js";
import { getClient } from "../client.js";
import type { ScenarioDefinition } from "../types.js";

/**
 * AC9: Distinguishing API Gateway 403 from Lambda 403.
 * API Gateway route-not-found has no x-amzn-requestid header.
 */
function isApiGatewayError(headers: Headers): boolean {
  return !headers.get("x-amzn-requestid");
}

export const routeConnectivityScenarios: ScenarioDefinition[] = [
  {
    id: "AC9",
    name: "All ROUTE_REGISTRY routes reachable (not 403 from API GW itself)",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC9");

      const failures: string[] = [];

      for (const route of ROUTE_REGISTRY) {
        // Resolve path template: replace {id} with a placeholder value
        const resolvedPath = route.path.replace(/\{[^}]+\}/g, "test-id");
        const method = route.methods[0];

        const res = await getClient().request(method, resolvedPath, {
          auth: { type: "jwt", token: jwt },
          // For POST/PATCH, provide a minimal body so the route doesn't fail on parse
          ...(["POST", "PATCH", "PUT"].includes(method) ? { body: {} } : {}),
        });

        // A 403 from API Gateway itself (not Lambda) means the route is not wired
        if (res.status === 403 && isApiGatewayError(res.headers)) {
          failures.push(
            `${method} ${route.path} → 403 from API Gateway (route not wired or integration missing)`
          );
        }
        // Lambda-level 4xx (404, 400, 403 with requestId) is acceptable — route exists
      }

      if (failures.length > 0) {
        throw new Error(
          `AC9 FAILED — ${failures.length} route(s) not reachable:\n${failures.join("\n")}`
        );
      }

      return 200;
    },
  },

  {
    id: "AC10",
    name: "CORS preflight OPTIONS → 200/204 + 3 CORS headers on all routes",
    async run() {
      const failures: string[] = [];

      for (const route of ROUTE_REGISTRY) {
        const resolvedPath = route.path.replace(/\{[^}]+\}/g, "test-id");
        const res = await getClient().options(resolvedPath, {
          auth: { type: "none" },
          headers: {
            Origin: "http://localhost:3000",
            "Access-Control-Request-Method": route.methods[0],
            "Access-Control-Request-Headers":
              "content-type,authorization,x-api-key",
          },
        });

        const issues: string[] = [];

        if (res.status !== 200 && res.status !== 204) {
          issues.push(`status ${res.status} (expected 200 or 204)`);
        }

        const corsHeaders = [
          "access-control-allow-origin",
          "access-control-allow-methods",
          "access-control-allow-headers",
        ];
        for (const h of corsHeaders) {
          if (!res.headers.get(h)) issues.push(`missing header: ${h}`);
        }

        if (issues.length > 0) {
          failures.push(`OPTIONS ${route.path} → ${issues.join(", ")}`);
        }
      }

      if (failures.length > 0) {
        throw new Error(
          `AC10 FAILED — CORS issues on ${failures.length} route(s):\n${failures.join("\n")}`
        );
      }

      // All routes passed their CORS preflight checks
      return 200;
    },
  },
];
