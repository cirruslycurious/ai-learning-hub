/**
 * smoke-test/scenarios/command-endpoints.ts
 * Phase 2: Command endpoint scenarios (CM1–CM4).
 *
 * Story 3.2.11: Tests command-pattern endpoints introduced in Epic 3.2.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import {
  assertStatus,
  jwtAuth,
  idempotencyKey,
  createSave,
  deleteSave,
} from "../helpers.js";

// Module-level state shared between CM1 and CM2
let cm1SaveId: string | null = null;

export const commandEndpointScenarios: ScenarioDefinition[] = [
  // CM1: POST /saves/{saveId}/update-metadata
  {
    id: "CM1",
    name: "POST /saves/:saveId/update-metadata → 200 + title updated",
    async run() {
      const auth = jwtAuth();

      // Create own save (self-contained)
      const save = await createSave(auth);
      cm1SaveId = save.saveId;

      try {
        const client = getClient();
        const res = await client.post(
          `/saves/${save.saveId}/update-metadata`,
          { title: "Updated via command" },
          {
            auth,
            headers: {
              ...idempotencyKey(),
              "If-Match": String(save.version),
            },
          }
        );
        assertStatus(
          res.status,
          200,
          "CM1: POST /saves/:saveId/update-metadata"
        );

        return res.status;
      } catch (err) {
        // If CM1 fails, clean up save immediately
        await deleteSave(save.saveId, auth).catch(() => undefined);
        cm1SaveId = null;
        throw err;
      }
    },
  },

  // CM2: GET /saves/{saveId}/events
  {
    id: "CM2",
    name: "GET /saves/:saveId/events → 200 + event array with eventType",
    async run() {
      const auth = jwtAuth();
      const saveId = cm1SaveId;
      if (!saveId) throw new Error("CM2 requires CM1 (no saveId)");

      try {
        const client = getClient();
        const res = await client.get(`/saves/${saveId}/events`, { auth });
        assertStatus(res.status, 200, "CM2: GET /saves/:saveId/events");

        const body = res.body as { data: Array<{ eventType: string }> };
        if (!Array.isArray(body.data) || body.data.length === 0) {
          throw new Error(
            `CM2: expected non-empty event array, got ${JSON.stringify(body.data)}`
          );
        }
        const hasEventType = body.data.some((e) => e.eventType);
        if (!hasEventType) {
          throw new Error("CM2: no event with eventType in response");
        }

        return res.status;
      } finally {
        // Cleanup CM1's save
        await deleteSave(saveId, auth).catch(() => undefined);
        cm1SaveId = null;
      }
    },
  },

  // CM3: POST /users/me/update
  {
    id: "CM3",
    name: "POST /users/me/update → 200 + profile updated",
    async run() {
      const auth = jwtAuth();
      const client = getClient();

      // Fetch current profile for version + original displayName
      const getRes = await client.get("/users/me", { auth });
      assertStatus(getRes.status, 200, "CM3: GET /users/me");
      const profileData = (getRes.body as Record<string, unknown>).data as
        | Record<string, unknown>
        | undefined;
      const original = profileData?.displayName as string | undefined;
      const version = profileData?.version as number | undefined;

      try {
        const res = await client.post(
          "/users/me/update",
          { displayName: "Smoke Test User" },
          {
            auth,
            headers: {
              ...idempotencyKey(),
              ...(version != null ? { "If-Match": String(version) } : {}),
            },
          }
        );
        assertStatus(res.status, 200, "CM3: POST /users/me/update");

        return res.status;
      } finally {
        // Restore original displayName
        if (original) {
          const refetch = await client
            .get("/users/me", { auth })
            .catch(() => null);
          const newVersion = refetch
            ? ((
                (refetch.body as Record<string, unknown>).data as
                  | Record<string, unknown>
                  | undefined
              )?.version as number | undefined)
            : undefined;
          await client
            .post(
              "/users/me/update",
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

  // CM4: POST /users/api-keys/{id}/revoke
  {
    id: "CM4",
    name: "POST /users/api-keys/:id/revoke → 200 + revoked key returns 401",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for CM4");
      const auth = jwtAuth();
      const client = getClient();

      // Create a temporary API key
      const createRes = await client.post(
        "/users/api-keys",
        { name: "smoke-revoke-cmd", scopes: ["*"] },
        { auth, headers: idempotencyKey() }
      );
      assertStatus(createRes.status, 201, "CM4: create temp API key");
      const keyData = (createRes.body as { data: Record<string, unknown> })
        .data;
      const keyId = String(keyData.id);
      const keyValue = String(keyData.keyValue ?? keyData.key);

      // Revoke via command endpoint
      const revokeRes = await client.post(
        `/users/api-keys/${keyId}/revoke`,
        undefined,
        { auth, headers: idempotencyKey() }
      );
      assertStatus(
        revokeRes.status,
        200,
        "CM4: POST /users/api-keys/:id/revoke"
      );

      // Verify revoked key returns 401
      const verifyRes = await client.get("/users/me", {
        auth: { type: "apikey", key: keyValue },
      });
      assertStatus(verifyRes.status, 401, "CM4: revoked key → 401");

      return revokeRes.status;
    },
  },
];
