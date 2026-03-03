/**
 * smoke-test/scenarios/discovery-endpoints.ts
 * Phase 1: Discovery endpoint scenarios (DS1–DS2).
 *
 * Story 3.2.11: Actions catalog and state graph — authenticated.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import {
  assertStatus,
  assertResponseEnvelope,
  assertADR008,
  jwtAuth,
} from "../helpers.js";

export const discoveryEndpointScenarios: ScenarioDefinition[] = [
  // DS1: GET /actions (+ entity filter)
  {
    id: "DS1",
    name: "GET /actions → 200 + non-empty catalog with saves and batch actions",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      // Full catalog
      const res = await client.get("/actions", { auth });
      assertStatus(res.status, 200, "DS1: GET /actions");
      assertResponseEnvelope(res.body);

      const body = res.body as { data: Array<Record<string, unknown>> };
      if (!Array.isArray(body.data) || body.data.length === 0) {
        throw new Error(
          `DS1: expected non-empty data array, got ${JSON.stringify(body.data)}`
        );
      }

      // Each action must have required fields
      for (const action of body.data) {
        if (
          !action.actionId ||
          !action.method ||
          !action.urlPattern ||
          !action.description
        ) {
          throw new Error(
            `DS1: action missing required fields: ${JSON.stringify(action)}`
          );
        }
      }

      // Must have at least one saves: action and one batch: action
      const hasSaves = body.data.some((a) =>
        String(a.actionId).startsWith("saves:")
      );
      const hasBatch = body.data.some((a) =>
        String(a.actionId).startsWith("batch:")
      );
      if (!hasSaves) {
        throw new Error("DS1: no action with actionId starting with 'saves:'");
      }
      if (!hasBatch) {
        throw new Error("DS1: no action with actionId starting with 'batch:'");
      }

      // Entity filter: GET /actions?entity=saves
      const filteredRes = await client.get("/actions?entity=saves", { auth });
      assertStatus(filteredRes.status, 200, "DS1: GET /actions?entity=saves");
      const filteredBody = filteredRes.body as {
        data: Array<{ entityType?: string }>;
      };
      if (!Array.isArray(filteredBody.data) || filteredBody.data.length === 0) {
        throw new Error("DS1: entity filter returned empty results");
      }
      for (const action of filteredBody.data) {
        if (action.entityType !== "saves") {
          throw new Error(
            `DS1: entity filter returned non-saves action: ${JSON.stringify(action)}`
          );
        }
      }

      return res.status;
    },
  },

  // DS2: GET /states/saves — no state graph registered for saves entity
  {
    id: "DS2",
    name: "GET /states/saves → 404 (no state graph registered)",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get("/states/saves", { auth });
      assertStatus(res.status, 404, "DS2: GET /states/saves");
      assertADR008(res.body, "NOT_FOUND");

      return res.status;
    },
  },
];
