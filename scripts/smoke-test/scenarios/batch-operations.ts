/**
 * smoke-test/scenarios/batch-operations.ts
 * Phase 3: Batch operation scenarios (BA1–BA3).
 *
 * Story 3.2.11: Tests POST /batch endpoint introduced in Epic 3.2.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import {
  assertStatus,
  assertADR008,
  jwtAuth,
  idempotencyKey,
  deleteSave,
} from "../helpers.js";

export const batchOperationScenarios: ScenarioDefinition[] = [
  // BA1: Batch basic execution — 2 POSTs, both succeed
  // Batch schema only allows POST/PATCH/DELETE (no GET).
  {
    id: "BA1",
    name: "POST /batch with 2 POST /saves → 200 + 2 succeeded",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.post(
        "/batch",
        {
          operations: [
            {
              method: "POST",
              path: "/saves",
              body: { url: `https://example.com/ba1-a-${Date.now()}` },
              headers: { "Idempotency-Key": crypto.randomUUID() },
            },
            {
              method: "POST",
              path: "/saves",
              body: { url: `https://example.com/ba1-b-${Date.now()}` },
              headers: { "Idempotency-Key": crypto.randomUUID() },
            },
          ],
        },
        { auth, headers: idempotencyKey() }
      );
      assertStatus(res.status, 200, "BA1: POST /batch");

      const body = res.body as {
        data: {
          results: Array<{
            statusCode: number;
            data?: { saveId?: string };
          }>;
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

      // Cleanup created saves
      for (const result of body.data.results) {
        if (result.data?.saveId) {
          await deleteSave(result.data.saveId, auth).catch(() => undefined);
        }
      }

      return res.status;
    },
  },

  // BA2: Batch partial failure — 1 POST success + 1 PATCH on nonexistent → error
  // Batch schema only allows POST/PATCH/DELETE (no GET).
  {
    id: "BA2",
    name: "POST /batch with 1 POST /saves + 1 PATCH nonexistent → partial failure",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.post(
        "/batch",
        {
          operations: [
            {
              method: "POST",
              path: "/saves",
              body: { url: `https://example.com/ba2-${Date.now()}` },
              headers: { "Idempotency-Key": crypto.randomUUID() },
            },
            {
              method: "PATCH",
              path: "/saves/00000000000000000000000000",
              body: { title: "Should Not Exist" },
              headers: {
                "Idempotency-Key": crypto.randomUUID(),
                "If-Match": "1",
              },
            },
          ],
        },
        { auth, headers: idempotencyKey() }
      );
      assertStatus(res.status, 200, "BA2: POST /batch");

      const body = res.body as {
        data: {
          results: Array<{
            statusCode: number;
            data?: { saveId?: string };
          }>;
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
      // POST /saves creates → 201
      if (!statusCodes.some((s) => s >= 200 && s < 400)) {
        throw new Error(
          `BA2: no success status in results: ${JSON.stringify(statusCodes)}`
        );
      }
      // PATCH on nonexistent → 404 or other 4xx
      if (!statusCodes.some((s) => s >= 400)) {
        throw new Error(
          `BA2: no error status in results: ${JSON.stringify(statusCodes)}`
        );
      }

      // Cleanup created save
      for (const result of body.data.results) {
        if (result.data?.saveId) {
          await deleteSave(result.data.saveId, auth).catch(() => undefined);
        }
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
          operations: [
            {
              method: "POST",
              path: "/saves",
              body: { url: "https://example.com/ba3-unauth" },
              headers: { "Idempotency-Key": crypto.randomUUID() },
            },
          ],
        },
        { auth: { type: "none" } }
      );
      if (res.status !== 401 && res.status !== 403) {
        throw new Error(
          `BA3: expected 401 or 403, got ${res.status}: ${JSON.stringify(res.body)}`
        );
      }
      assertADR008(res.body, "UNAUTHORIZED");

      return res.status;
    },
  },
];
