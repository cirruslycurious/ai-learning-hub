/**
 * smoke-test/scenarios/user-profile.ts
 * AC11–AC12: User profile CRUD scenarios
 */

import { getClient } from "../client.js";
import { assertADR008, assertStatus, idempotencyKey } from "../helpers.js";
import type { ScenarioDefinition } from "../types.js";

export const userProfileScenarios: ScenarioDefinition[] = [
  // Story 3.2.11: + If-Match + Idempotency-Key on PATCH /users/me
  {
    id: "AC11",
    name: "Valid JWT → PATCH /users/me displayName → 200 + updated value",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC11");
      const auth = { type: "jwt" as const, token: jwt };

      // Fetch current profile to get version + original displayName
      const getRes = await getClient().get("/users/me", { auth });
      assertStatus(getRes.status, 200, "GET /users/me before PATCH");
      const profileData = (getRes.body as Record<string, unknown>).data as
        | Record<string, unknown>
        | undefined;
      const original = profileData?.displayName as string | undefined;
      const version = profileData?.version as number | undefined;

      let patched = false;
      try {
        const patchRes = await getClient().patch(
          "/users/me",
          { displayName: "Smoke Test User" },
          {
            auth,
            headers: {
              ...idempotencyKey(),
              ...(version != null ? { "If-Match": String(version) } : {}),
            },
          }
        );
        assertStatus(patchRes.status, 200, "PATCH /users/me with displayName");
        patched = true;

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
        if (patched && original) {
          // Re-fetch version before restoring
          const refetch = await getClient()
            .get("/users/me", { auth })
            .catch(() => null);
          const newVersion = refetch
            ? ((
                (refetch.body as Record<string, unknown>).data as
                  | Record<string, unknown>
                  | undefined
              )?.version as number | undefined)
            : undefined;
          await getClient()
            .patch(
              "/users/me",
              { displayName: original },
              {
                auth,
                headers: {
                  ...idempotencyKey(),
                  ...(newVersion != null
                    ? { "If-Match": String(newVersion) }
                    : {}),
                },
              }
            )
            .catch(() => undefined);
        }
      }
    },
  },

  // Story 3.2.11: + If-Match + Idempotency-Key before testing validation
  {
    id: "AC12",
    name: "Invalid PATCH body → 400 VALIDATION_ERROR",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC12");
      const auth = { type: "jwt" as const, token: jwt };

      // Fetch version so middleware doesn't reject with 428 before body validation
      const getRes = await getClient().get("/users/me", { auth });
      assertStatus(getRes.status, 200, "GET /users/me before invalid PATCH");
      const version = (
        (getRes.body as Record<string, unknown>).data as
          | Record<string, unknown>
          | undefined
      )?.version as number | undefined;

      const res = await getClient().patch(
        "/users/me",
        { role: "superadmin" },
        {
          auth,
          headers: {
            ...idempotencyKey(),
            ...(version != null ? { "If-Match": String(version) } : {}),
          },
        }
      );
      assertStatus(res.status, 400, "PATCH /users/me with invalid body");
      assertADR008(res.body, "VALIDATION_ERROR");
      return res.status;
    },
  },
];
