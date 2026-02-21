/**
 * smoke-test/scenarios/jwt-auth.ts
 * AC1–AC4: JWT authentication scenarios
 */

import { getClient } from "../client.js";
import {
  assertADR008,
  assertStatus,
  assertUserProfileShape,
} from "../helpers.js";
import { ScenarioSkipped } from "../types.js";
import type { ScenarioDefinition } from "../types.js";

export const jwtAuthScenarios: ScenarioDefinition[] = [
  {
    id: "AC1",
    name: "Valid JWT → GET /users/me → 200 + profile shape",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC1");
      const res = await getClient().get("/users/me", {
        auth: { type: "jwt", token: jwt },
      });
      assertStatus(res.status, 200, "GET /users/me with valid JWT");
      assertUserProfileShape(res.body);
      return res.status;
    },
  },

  {
    id: "AC2",
    name: "Malformed JWT → GET /users/me → 401 UNAUTHORIZED",
    async run() {
      const res = await getClient().get("/users/me", {
        auth: { type: "jwt", token: "invalid.jwt.string" },
      });
      assertStatus(res.status, 401, "GET /users/me with malformed JWT");
      assertADR008(res.body, "UNAUTHORIZED");
      return res.status;
    },
  },

  {
    id: "AC3",
    name: "No auth header → GET /users/me → 401 UNAUTHORIZED (Gateway Response)",
    async run() {
      const res = await getClient().get("/users/me", {
        auth: { type: "none" },
      });
      assertStatus(res.status, 401, "GET /users/me with no auth");
      // API Gateway UNAUTHORIZED Gateway Response uses ADR-008 shape
      // requestId is $context.requestId — present but may differ from Lambda format
      assertADR008(res.body, "UNAUTHORIZED");
      return res.status;
    },
  },

  {
    id: "AC4",
    name: "Expired JWT → GET /users/me → 401 EXPIRED_TOKEN (or SKIP)",
    async run() {
      const expiredJwt = process.env.SMOKE_TEST_EXPIRED_JWT;
      if (!expiredJwt) {
        throw new ScenarioSkipped(
          "no expired token provided — set SMOKE_TEST_EXPIRED_JWT to enable"
        );
      }
      const res = await getClient().get("/users/me", {
        auth: { type: "jwt", token: expiredJwt },
      });
      assertStatus(res.status, 401, "GET /users/me with expired JWT");
      assertADR008(res.body, "EXPIRED_TOKEN");
      return res.status;
    },
  },
];
