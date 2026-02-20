/**
 * smoke-test/scenarios/user-profile.ts
 * AC11–AC12: User profile CRUD scenarios
 */

import { getClient } from "../client.js";
import { assertADR008, assertStatus } from "../helpers.js";
import type { ScenarioDefinition } from "../types.js";

export const userProfileScenarios: ScenarioDefinition[] = [
  {
    id: "AC11",
    name: "Valid JWT → PATCH /users/me displayName → 200 + updated value",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC11");

      // Fetch current profile to save original displayName for restore
      const getRes = await getClient().get("/users/me", {
        auth: { type: "jwt", token: jwt },
      });
      assertStatus(getRes.status, 200, "GET /users/me before PATCH");
      const original = (
        (getRes.body as Record<string, unknown>).data as
          | Record<string, unknown>
          | undefined
      )?.displayName as string | undefined;

      let patched = false;
      try {
        const patchRes = await getClient().patch(
          "/users/me",
          { displayName: "Smoke Test User" },
          { auth: { type: "jwt", token: jwt } }
        );
        assertStatus(patchRes.status, 200, "PATCH /users/me with displayName");
        patched = true; // PATCH succeeded — must restore even if body check fails

        const data =
          ((patchRes.body as Record<string, unknown>).data as
            | Record<string, unknown>
            | undefined) ?? (patchRes.body as Record<string, unknown>);
        if (data.displayName !== "Smoke Test User") {
          throw new Error(
            `displayName not updated — expected "Smoke Test User", got "${String(data.displayName)}"`
          );
        }
        return patchRes.status;
      } finally {
        // Restore original displayName
        if (patched) {
          await getClient()
            .patch(
              "/users/me",
              { displayName: original ?? "" },
              {
                auth: { type: "jwt", token: jwt },
              }
            )
            .catch(() => undefined);
        }
      }
    },
  },

  {
    id: "AC12",
    name: "Invalid PATCH body → 400 VALIDATION_ERROR",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC12");

      // Send a field that should fail validation (unknown field or wrong type)
      const res = await getClient().patch(
        "/users/me",
        { role: "superadmin" },
        { auth: { type: "jwt", token: jwt } }
      );
      assertStatus(res.status, 400, "PATCH /users/me with invalid body");
      assertADR008(res.body, "VALIDATION_ERROR");
      return res.status;
    },
  },
];
