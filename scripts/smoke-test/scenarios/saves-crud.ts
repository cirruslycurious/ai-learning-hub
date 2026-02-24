/**
 * smoke-test/scenarios/saves-crud.ts
 * Phase 2: Saves CRUD Lifecycle smoke scenarios (SC1–SC8).
 *
 * Story 3.1.6: Full lifecycle — create, get, list, update, delete,
 * get-deleted, restore, get-restored. Validates DynamoDB access, IAM,
 * env vars, TransactWriteItems, soft-delete, restore, and ADR-008.
 */

import type { ScenarioDefinition, CleanupFn } from "../types.js";
import { getClient } from "../client.js";
import {
  assertStatus,
  assertADR008,
  assertSaveShape,
  jwtAuth,
} from "../helpers.js";

// ULID: 26 uppercase alphanumeric characters — aligned with the backend's
// saveIdPathSchema regex /^[0-9A-Z]{26}$/ (see backend/shared/validation/src/schemas.ts)
const ULID_RE = /^[0-9A-Z]{26}$/;

// Module-level shared state for the lifecycle chain
let createdSaveId: string | null = null;
let createdSaveUrl: string | null = null;
let registerCleanupFn: ((fn: CleanupFn) => void) | null = null;

/**
 * Wire cleanup registry from the runner. Call before executing Phase 2.
 */
export function initSavesCrudCleanup(register: (fn: CleanupFn) => void): void {
  registerCleanupFn = register;
}

export const savesCrudScenarios: ScenarioDefinition[] = [
  // SC1: Create save
  {
    id: "SC1",
    name: "POST /saves — create with unique URL → 201 + save shape",
    async run() {
      const client = getClient();
      const auth = jwtAuth();
      const uniqueUrl = `https://example.com/smoke-test-${Date.now()}`;

      const res = await client.post("/saves", { url: uniqueUrl }, { auth });
      assertStatus(res.status, 201, "SC1: POST /saves");
      assertSaveShape(res.body);

      const data = (res.body as { data: { saveId: string } }).data;

      // AC: saveId is a valid ULID (26 chars, Crockford Base32)
      if (!ULID_RE.test(data.saveId)) {
        throw new Error(`SC1: saveId is not a valid ULID: "${data.saveId}"`);
      }

      createdSaveId = data.saveId;
      createdSaveUrl = uniqueUrl;

      // Register cleanup: soft-delete the save after all scenarios.
      // Use jwtAuth() and getClient() at execution time to avoid stale tokens.
      if (registerCleanupFn) {
        registerCleanupFn(async () => {
          try {
            const freshAuth = jwtAuth();
            await getClient().delete(`/saves/${createdSaveId}`, {
              auth: freshAuth,
            });
          } catch {
            // Cleanup errors are non-fatal
          }
        });
      }

      return res.status;
    },
  },

  // SC2: Get save (verifies lastAccessedAt update)
  {
    id: "SC2",
    name: "GET /saves/:saveId — read created save → 200 + lastAccessedAt",
    async run() {
      if (!createdSaveId) throw new Error("SC2 requires SC1 (no saveId)");
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get(`/saves/${createdSaveId}`, { auth });
      assertStatus(res.status, 200, "SC2: GET /saves/:saveId");
      assertSaveShape(res.body, { requireLastAccessedAt: true });

      const data = (res.body as { data: { saveId: string; url: string } }).data;
      if (data.saveId !== createdSaveId) {
        throw new Error(
          `SC2: saveId mismatch: ${data.saveId} !== ${createdSaveId}`
        );
      }
      // AC: data.url matches submitted URL
      if (data.url !== createdSaveUrl) {
        throw new Error(
          `SC2: url mismatch: "${data.url}" !== "${createdSaveUrl}"`
        );
      }

      return res.status;
    },
  },

  // SC3: List saves (verifies save appears in list)
  {
    id: "SC3",
    name: "GET /saves — list contains created save + hasMore present",
    async run() {
      if (!createdSaveId) throw new Error("SC3 requires SC1 (no saveId)");
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get("/saves", { auth });
      assertStatus(res.status, 200, "SC3: GET /saves");

      const body = res.body as {
        data: { items: Array<{ saveId: string }>; hasMore: boolean };
      };
      if (!Array.isArray(body.data?.items)) {
        throw new Error(
          `SC3: data.items is not an array: ${JSON.stringify(res.body)}`
        );
      }
      if (body.data.hasMore === undefined) {
        throw new Error(
          `SC3: data.hasMore is missing: ${JSON.stringify(res.body)}`
        );
      }
      const found = body.data.items.some(
        (item) => item.saveId === createdSaveId
      );
      if (!found) {
        throw new Error(`SC3: Created save ${createdSaveId} not found in list`);
      }

      return res.status;
    },
  },

  // SC4: Update save
  {
    id: "SC4",
    name: "PATCH /saves/:saveId — update title → 200 + title changed",
    async run() {
      if (!createdSaveId) throw new Error("SC4 requires SC1 (no saveId)");
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.patch(
        `/saves/${createdSaveId}`,
        { title: "Smoke Test Updated" },
        { auth }
      );
      assertStatus(res.status, 200, "SC4: PATCH /saves/:saveId");
      assertSaveShape(res.body);

      const data = (
        res.body as {
          data: { title: string; createdAt: string; updatedAt: string };
        }
      ).data;
      if (data.title !== "Smoke Test Updated") {
        throw new Error(`SC4: title not updated, got "${data.title}"`);
      }
      if (data.updatedAt < data.createdAt) {
        throw new Error(
          `SC4: updatedAt (${data.updatedAt}) < createdAt (${data.createdAt})`
        );
      }

      return res.status;
    },
  },

  // SC5: Delete save (soft-delete)
  {
    id: "SC5",
    name: "DELETE /saves/:saveId — soft-delete → 204",
    async run() {
      if (!createdSaveId) throw new Error("SC5 requires SC1 (no saveId)");
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.delete(`/saves/${createdSaveId}`, { auth });
      assertStatus(res.status, 204, "SC5: DELETE /saves/:saveId");

      return res.status;
    },
  },

  // SC6: Get deleted save → 404
  {
    id: "SC6",
    name: "GET /saves/:saveId (deleted) → 404 NOT_FOUND",
    async run() {
      if (!createdSaveId) throw new Error("SC6 requires SC5 (no saveId)");
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get(`/saves/${createdSaveId}`, { auth });
      assertStatus(res.status, 404, "SC6: GET deleted save");
      assertADR008(res.body, "NOT_FOUND");

      return res.status;
    },
  },

  // SC7: Restore deleted save
  {
    id: "SC7",
    name: "POST /saves/:saveId/restore — restore → 200 + no deletedAt",
    async run() {
      if (!createdSaveId) throw new Error("SC7 requires SC5 (no saveId)");
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.post(
        `/saves/${createdSaveId}/restore`,
        undefined,
        { auth }
      );
      assertStatus(res.status, 200, "SC7: POST /saves/:saveId/restore");
      assertSaveShape(res.body);

      const data = (
        res.body as { data: { saveId: string; deletedAt?: string } }
      ).data;
      // AC: body data.saveId matches
      if (data.saveId !== createdSaveId) {
        throw new Error(
          `SC7: saveId mismatch: ${data.saveId} !== ${createdSaveId}`
        );
      }
      if (data.deletedAt) {
        throw new Error(
          `SC7: deletedAt should be absent after restore, got "${data.deletedAt}"`
        );
      }

      return res.status;
    },
  },

  // SC8: Get restored save (verify data persisted through delete/restore)
  {
    id: "SC8",
    name: "GET /saves/:saveId (restored) → 200 + title persisted",
    async run() {
      if (!createdSaveId) throw new Error("SC8 requires SC7 (no saveId)");
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get(`/saves/${createdSaveId}`, { auth });
      assertStatus(res.status, 200, "SC8: GET restored save");
      assertSaveShape(res.body, { requireLastAccessedAt: true });

      const data = (res.body as { data: { title: string } }).data;
      if (data.title !== "Smoke Test Updated") {
        throw new Error(
          `SC8: title not persisted through delete/restore, got "${data.title}"`
        );
      }

      return res.status;
    },
  },
];
