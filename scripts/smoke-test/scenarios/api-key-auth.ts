/**
 * smoke-test/scenarios/api-key-auth.ts
 * AC5–AC8, AC13: API key authentication and lifecycle scenarios
 */

import { getClient } from "../client.js";
import {
  assertADR008,
  assertStatus,
  assertUserProfileShape,
  randomInvalidKey,
} from "../helpers.js";
import type { ScenarioDefinition, CleanupFn } from "../types.js";

let registerCleanupFn: ((fn: CleanupFn) => void) | null = null;

/** Call this from run.ts to wire up the cleanup registry */
export function initApiKeyCleanup(register: (fn: CleanupFn) => void): void {
  registerCleanupFn = register;
}

async function createKey(
  jwt: string,
  scopes: string[]
): Promise<{ id: string; keyValue: string }> {
  const res = await getClient().post(
    "/users/api-keys",
    { scopes },
    { auth: { type: "jwt", token: jwt } }
  );
  assertStatus(res.status, 201, "POST /users/api-keys");
  const body = res.body as Record<string, unknown>;
  const data =
    (body.data as Record<string, unknown> | undefined) ??
    (body as Record<string, unknown>);
  if (!data.id || !data.keyValue) {
    throw new Error(
      `API key response missing id or keyValue: ${JSON.stringify(body)}`
    );
  }
  return { id: String(data.id), keyValue: String(data.keyValue) };
}

async function deleteKey(id: string, jwt: string): Promise<number> {
  const res = await getClient().delete(`/users/api-keys/${id}`, {
    auth: { type: "jwt", token: jwt },
  });
  return res.status;
}

export const apiKeyScenarios: ScenarioDefinition[] = [
  {
    id: "AC13",
    name: "API key full lifecycle: create → list → delete → verify absent",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC13");

      let keyId: string | null = null;
      try {
        // Step 1: create
        const key = await createKey(jwt, ["read", "write", "capture"]);
        keyId = key.id;
        if (registerCleanupFn) {
          registerCleanupFn(async () => {
            if (keyId) await deleteKey(keyId, jwt).catch(() => undefined);
          });
        }

        // Step 2: list → new key must appear
        const listRes = await getClient().get("/users/api-keys", {
          auth: { type: "jwt", token: jwt },
        });
        assertStatus(listRes.status, 200, "GET /users/api-keys");
        const listBody = listRes.body as Record<string, unknown>;
        const items = (listBody.data ?? listBody) as unknown[];
        const found =
          Array.isArray(items) &&
          items.some((k) => {
            const kk = k as Record<string, unknown>;
            return kk.id === keyId;
          });
        if (!found)
          throw new Error(`Key ${keyId} not found in list after creation`);

        // Step 3: delete
        const deleteStatus = await deleteKey(keyId, jwt);
        assertStatus(deleteStatus, 204, `DELETE /users/api-keys/${keyId}`);
        keyId = null; // mark cleaned up

        // Step 4: list → key must be absent
        const listRes2 = await getClient().get("/users/api-keys", {
          auth: { type: "jwt", token: jwt },
        });
        assertStatus(listRes2.status, 200, "GET /users/api-keys after delete");
        const items2 = ((listRes2.body as Record<string, unknown>).data ??
          listRes2.body) as unknown[];
        const stillPresent =
          Array.isArray(items2) &&
          items2.some((k) => {
            const kk = k as Record<string, unknown>;
            return kk.id === key.id;
          });
        if (stillPresent)
          throw new Error(`Key ${key.id} still present after deletion`);

        return 204;
      } finally {
        // Belt-and-suspenders: delete key if not already cleaned up
        if (keyId) await deleteKey(keyId, jwt).catch(() => undefined);
      }
    },
  },

  {
    id: "AC5",
    name: "Valid API key → GET /users/me → 200 + profile shape",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC5");

      const key = await createKey(jwt, ["read", "write", "capture"]);
      try {
        const res = await getClient().get("/users/me", {
          auth: { type: "apikey", key: key.keyValue },
        });
        assertStatus(res.status, 200, "GET /users/me with valid API key");
        assertUserProfileShape(res.body);
        return res.status;
      } finally {
        await deleteKey(key.id, jwt).catch(() => undefined);
      }
    },
  },

  {
    id: "AC6",
    name: "Capture-scope API key → PATCH /users/me → 403 SCOPE_INSUFFICIENT",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC6");

      const key = await createKey(jwt, ["capture"]);
      try {
        const res = await getClient().patch(
          "/users/me",
          { displayName: "Scope Test" },
          { auth: { type: "apikey", key: key.keyValue } }
        );
        assertStatus(res.status, 403, "PATCH /users/me with capture-scope key");
        assertADR008(res.body, "SCOPE_INSUFFICIENT");
        return res.status;
      } finally {
        await deleteKey(key.id, jwt).catch(() => undefined);
      }
    },
  },

  {
    id: "AC7",
    name: "Revoked API key → GET /users/me → 401 REVOKED_API_KEY",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC7");

      const key = await createKey(jwt, ["read", "write", "capture"]);
      // Delete (revoke) the key
      await deleteKey(key.id, jwt);
      // Attempt to use revoked key
      const res = await getClient().get("/users/me", {
        auth: { type: "apikey", key: key.keyValue },
      });
      assertStatus(res.status, 401, "GET /users/me with revoked API key");
      assertADR008(res.body, "REVOKED_API_KEY");
      return res.status;
    },
  },

  {
    id: "AC8",
    name: "Invalid API key string → GET /users/me → 401 INVALID_API_KEY",
    async run() {
      const res = await getClient().get("/users/me", {
        auth: { type: "apikey", key: randomInvalidKey() },
      });
      assertStatus(res.status, 401, "GET /users/me with invalid API key");
      assertADR008(res.body, "INVALID_API_KEY");
      return res.status;
    },
  },
];
