/**
 * smoke-test/scenarios/ops-endpoints.ts
 * Phase 1: Ops endpoint scenarios (OP1–OP2).
 *
 * Story 3.2.11: Health and readiness endpoints — unauthenticated.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import { assertStatus, assertResponseEnvelope } from "../helpers.js";

export const opsEndpointScenarios: ScenarioDefinition[] = [
  // OP1: GET /health
  {
    id: "OP1",
    name: "GET /health → 200 + healthy status",
    async run() {
      const client = getClient();

      const res = await client.get("/health", { auth: { type: "none" } });
      assertStatus(res.status, 200, "OP1: GET /health");
      assertResponseEnvelope(res.body);

      const body = res.body as {
        data: { status: string; timestamp: string; version: string };
        links: { self: string };
      };
      if (body.data.status !== "healthy") {
        throw new Error(
          `OP1: expected status "healthy", got "${body.data.status}"`
        );
      }
      if (!body.data.timestamp) {
        throw new Error("OP1: missing data.timestamp");
      }
      if (!body.data.version) {
        throw new Error("OP1: missing data.version");
      }
      if (body.links.self !== "/health") {
        throw new Error(
          `OP1: expected links.self "/health", got "${body.links.self}"`
        );
      }

      return res.status;
    },
  },

  // OP2: GET /ready
  {
    id: "OP2",
    name: "GET /ready → 200 + ready with DynamoDB ok",
    async run() {
      const client = getClient();

      const res = await client.get("/ready", { auth: { type: "none" } });
      assertStatus(res.status, 200, "OP2: GET /ready");
      assertResponseEnvelope(res.body);

      const body = res.body as {
        data: {
          ready: boolean;
          timestamp: string;
          dependencies: { dynamodb: string };
        };
        links: { self: string };
      };
      if (body.data.ready !== true) {
        throw new Error(`OP2: expected ready true, got ${body.data.ready}`);
      }
      if (body.data.dependencies?.dynamodb !== "ok") {
        throw new Error(
          `OP2: expected dynamodb "ok", got "${body.data.dependencies?.dynamodb}"`
        );
      }
      if (!body.data.timestamp) {
        throw new Error("OP2: missing data.timestamp");
      }
      if (body.links.self !== "/ready") {
        throw new Error(
          `OP2: expected links.self "/ready", got "${body.links.self}"`
        );
      }

      return res.status;
    },
  },
];
