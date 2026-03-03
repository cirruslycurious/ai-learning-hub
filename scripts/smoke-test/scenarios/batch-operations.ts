/**
 * smoke-test/scenarios/batch-operations.ts
 * Phase 3: Batch operation scenarios (BA1–BA3).
 *
 * Story 3.2.11: Tests POST /batch endpoint introduced in Epic 3.2.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import { assertStatus, jwtAuth, idempotencyKey } from "../helpers.js";

export const batchOperationScenarios: ScenarioDefinition[] = [
  // BA1: Batch basic execution — 2 GETs, both succeed
  {
    id: "BA1",
    name: "POST /batch with 2 GETs → 200 + 2 succeeded",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.post(
        "/batch",
        {
          operations: [
            { method: "GET", path: "/actions" },
            { method: "GET", path: "/users/me" },
          ],
        },
        { auth, headers: idempotencyKey() }
      );
      assertStatus(res.status, 200, "BA1: POST /batch");

      const body = res.body as {
        data: {
          results: Array<{ statusCode: number }>;
          summary: { total: number; succeeded: number; failed: number };
        };
      };
      if (body.data.results?.length !== 2) {
        throw new Error(
          `BA1: expected 2 results, got ${body.data.results?.length}`
        );
      }
      if (body.data.summary?.total !== 2) {
        throw new Error(
          `BA1: expected summary.total 2, got ${body.data.summary?.total}`
        );
      }
      if (body.data.summary?.succeeded !== 2) {
        throw new Error(
          `BA1: expected summary.succeeded 2, got ${body.data.summary?.succeeded}`
        );
      }

      return res.status;
    },
  },

  // BA2: Batch partial failure — 1 success + 1 404
  {
    id: "BA2",
    name: "POST /batch with 1 valid + 1 404 → 200 + partial failure",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.post(
        "/batch",
        {
          operations: [
            { method: "GET", path: "/actions" },
            { method: "GET", path: "/saves/00000000000000000000000000" },
          ],
        },
        { auth, headers: idempotencyKey() }
      );
      assertStatus(res.status, 200, "BA2: POST /batch");

      const body = res.body as {
        data: {
          results: Array<{ statusCode: number }>;
          summary: { total: number; succeeded: number; failed: number };
        };
      };
      if (body.data.summary?.succeeded !== 1) {
        throw new Error(
          `BA2: expected summary.succeeded 1, got ${body.data.summary?.succeeded}`
        );
      }
      if (body.data.summary?.failed !== 1) {
        throw new Error(
          `BA2: expected summary.failed 1, got ${body.data.summary?.failed}`
        );
      }

      // Validate per-operation statusCode
      const statusCodes = body.data.results.map((r) => r.statusCode);
      if (!statusCodes.includes(200)) {
        throw new Error(
          `BA2: no 200 status in results: ${JSON.stringify(statusCodes)}`
        );
      }
      if (!statusCodes.includes(404)) {
        throw new Error(
          `BA2: no 404 status in results: ${JSON.stringify(statusCodes)}`
        );
      }

      return res.status;
    },
  },

  // BA3: Batch requires authentication
  {
    id: "BA3",
    name: "POST /batch unauthenticated → 401 or 403",
    async run() {
      const client = getClient();

      const res = await client.post(
        "/batch",
        {
          operations: [{ method: "GET", path: "/actions" }],
        },
        { auth: { type: "none" } }
      );
      if (res.status !== 401 && res.status !== 403) {
        throw new Error(
          `BA3: expected 401 or 403, got ${res.status}: ${JSON.stringify(res.body)}`
        );
      }

      return res.status;
    },
  },
];
