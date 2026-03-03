/**
 * smoke-test/scenarios/saves-validation.ts
 * Phase 4: Saves Validation Error smoke scenarios (SV1–SV4).
 *
 * Story 3.1.6: Validates ADR-008 error handling for invalid inputs,
 * nonexistent resources, and immutable field mutations.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import {
  assertStatus,
  assertADR008,
  jwtAuth,
  idempotencyKey,
  createSave,
  deleteSave,
} from "../helpers.js";

export const savesValidationScenarios: ScenarioDefinition[] = [
  // SV1: Invalid URL → 400 VALIDATION_ERROR (Story 3.2.11: + Idempotency-Key)
  {
    id: "SV1",
    name: "POST /saves with invalid URL → 400 VALIDATION_ERROR",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.post(
        "/saves",
        { url: "not-a-url" },
        {
          auth,
          headers: idempotencyKey(),
        }
      );
      assertStatus(res.status, 400, "SV1: POST /saves invalid URL");
      assertADR008(res.body, "VALIDATION_ERROR");

      return res.status;
    },
  },

  // SV2: Invalid ULID in path → 400 VALIDATION_ERROR
  {
    id: "SV2",
    name: "GET /saves/not-a-valid-ulid → 400 VALIDATION_ERROR",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get("/saves/not-a-valid-ulid", { auth });
      assertStatus(res.status, 400, "SV2: GET /saves/invalid-ulid");
      assertADR008(res.body, "VALIDATION_ERROR");

      return res.status;
    },
  },

  // SV3: Nonexistent ULID → 404 NOT_FOUND
  {
    id: "SV3",
    name: "GET /saves/00000000000000000000000000 → 404 NOT_FOUND",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get("/saves/00000000000000000000000000", {
        auth,
      });
      assertStatus(res.status, 404, "SV3: GET nonexistent save");
      assertADR008(res.body, "NOT_FOUND");

      return res.status;
    },
  },

  // SV4: Immutable field (url) in PATCH → 400 VALIDATION_ERROR
  // Story 3.2.11: uses createSave/deleteSave helpers, sends If-Match + Idempotency-Key
  {
    id: "SV4",
    name: "PATCH /saves/:saveId with immutable url field → 400 VALIDATION_ERROR",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const save = await createSave(auth);

      try {
        // Attempt to PATCH with immutable field — send required headers
        const res = await client.patch(
          `/saves/${save.saveId}`,
          { url: "https://changed.com" },
          {
            auth,
            headers: {
              ...idempotencyKey(),
              "If-Match": String(save.version),
            },
          }
        );
        assertStatus(res.status, 400, "SV4: PATCH immutable field");
        assertADR008(res.body, "VALIDATION_ERROR");

        return res.status;
      } finally {
        try {
          await deleteSave(save.saveId, auth);
        } catch {
          // Cleanup errors are non-fatal
        }
      }
    },
  },
];
