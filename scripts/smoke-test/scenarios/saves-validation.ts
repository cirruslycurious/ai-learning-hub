/**
 * smoke-test/scenarios/saves-validation.ts
 * Phase 4: Saves Validation Error smoke scenarios (SV1–SV4).
 *
 * Story 3.1.6: Validates ADR-008 error handling for invalid inputs,
 * nonexistent resources, and immutable field mutations.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import { assertStatus, assertADR008, jwtAuth } from "../helpers.js";

export const savesValidationScenarios: ScenarioDefinition[] = [
  // SV1: Invalid URL → 400 VALIDATION_ERROR
  {
    id: "SV1",
    name: "POST /saves with invalid URL → 400 VALIDATION_ERROR",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.post("/saves", { url: "not-a-url" }, { auth });
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
  {
    id: "SV4",
    name: "PATCH /saves/:saveId with immutable url field → 400 VALIDATION_ERROR",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      // Create a temporary save for this test
      const uniqueUrl = `https://example.com/smoke-validation-${Date.now()}`;
      const createRes = await client.post(
        "/saves",
        { url: uniqueUrl },
        { auth }
      );
      assertStatus(createRes.status, 201, "SV4: setup POST /saves");

      const saveId = (createRes.body as { data: { saveId: string } }).data
        .saveId;

      try {
        // Attempt to PATCH with immutable field
        const res = await client.patch(
          `/saves/${saveId}`,
          { url: "https://changed.com" },
          { auth }
        );
        assertStatus(res.status, 400, "SV4: PATCH immutable field");
        assertADR008(res.body, "VALIDATION_ERROR");

        return res.status;
      } finally {
        // Cleanup: soft-delete the temporary save
        try {
          await client.delete(`/saves/${saveId}`, { auth });
        } catch {
          // Cleanup errors are non-fatal
        }
      }
    },
  },
];
