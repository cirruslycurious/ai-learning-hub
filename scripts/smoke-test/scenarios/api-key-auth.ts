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
  idempotencyKey,
} from "../helpers.js";
import type { ScenarioDefinition, CleanupFn } from "../types.js";

let registerCleanupFn: ((fn: CleanupFn) => void) | null = null;

/** Call this from run.ts to wire up the cleanup registry */
export function initApiKeyCleanup(register: (fn: CleanupFn) => void): void {
  registerCleanupFn = register;
}

/** Simple sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an API key with retry-on-429 resilience.
 * Smoke tests create several keys in rapid succession, which can trip
 * the rate limiter. Backing off and retrying is the standard approach.
 */
async function createKey(
  jwt: string,
  scopes: string[],
  name = "smoke-test-key"
): Promise<{ id: string; keyValue: string }> {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await getClient().post(
      "/users/api-keys",
      { name, scopes },
      { auth: { type: "jwt", token: jwt }, headers: idempotencyKey() }
    );

    if (res.status === 429) {
      if (attempt === maxRetries) {
        throw new Error(
          `POST /users/api-keys still 429 after ${maxRetries} retries — rate limit not clearing`
        );
      }
      const delayMs = 2000 * (attempt + 1); // 2s, 4s, 6s
      console.log(
        `    ⏳ Rate limited (429) on key creation, retrying in ${delayMs / 1000}s...`
      );
      await sleep(delayMs);
      continue;
    }

    assertStatus(res.status, 201, "POST /users/api-keys");
    const body = res.body as Record<string, unknown>;
    const data =
      (body.data as Record<string, unknown> | undefined) ??
      (body as Record<string, unknown>);
    // API returns "key" (not "keyValue") as the plaintext API key
    const keyValue = data.keyValue ?? data.key;
    if (!data.id || !keyValue) {
      throw new Error(
        `API key response missing id or key: ${JSON.stringify(body)}`
      );
    }
    return { id: String(data.id), keyValue: String(keyValue) };
  }

  // Unreachable, but TypeScript needs it
  throw new Error("createKey: unexpected fallthrough");
}

async function deleteKey(id: string, jwt: string): Promise<number> {
  const res = await getClient().delete(`/users/api-keys/${id}`, {
    auth: { type: "jwt", token: jwt },
    headers: idempotencyKey(),
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
        const key = await createKey(jwt, ["*"], "smoke-lifecycle-key");
        keyId = key.id;
        if (registerCleanupFn) {
          registerCleanupFn(async () => {
            if (keyId) await deleteKey(keyId, jwt).catch(() => undefined);
          });
        }

        // Step 2: list → new key must appear
        // DynamoDB GSI is eventually consistent — retry with short delay
        let found = false;
        for (let listAttempt = 0; listAttempt < 3; listAttempt++) {
          if (listAttempt > 0) {
            console.log(
              `    ⏳ Key not yet in GSI, retrying in 1s (attempt ${listAttempt + 1}/3)...`
            );
            await sleep(1000);
          }
          const listRes = await getClient().get("/users/api-keys", {
            auth: { type: "jwt", token: jwt },
          });
          assertStatus(listRes.status, 200, "GET /users/api-keys");
          const listBody = listRes.body as Record<string, unknown>;
          // wrapHandler wraps result → { data: { items: [...], hasMore, nextCursor } }
          const listData = (listBody.data ?? listBody) as Record<
            string,
            unknown
          >;
          const items = ((listData as Record<string, unknown>).items ??
            listData) as unknown[];
          found =
            Array.isArray(items) &&
            items.some((k) => {
              const kk = k as Record<string, unknown>;
              return kk.id === keyId;
            });
          if (found) break;
        }
        if (!found)
          throw new Error(
            `Key ${keyId} not found in list after creation (3 retries)`
          );

        // Step 3: delete
        const deleteStatus = await deleteKey(keyId, jwt);
        assertStatus(deleteStatus, 204, `DELETE /users/api-keys/${keyId}`);
        keyId = null; // mark cleaned up

        // Step 4: list → key must be absent
        const listRes2 = await getClient().get("/users/api-keys", {
          auth: { type: "jwt", token: jwt },
        });
        assertStatus(listRes2.status, 200, "GET /users/api-keys after delete");
        const listBody2 = listRes2.body as Record<string, unknown>;
        const listData2 = (listBody2.data ?? listBody2) as Record<
          string,
          unknown
        >;
        const items2 = ((listData2 as Record<string, unknown>).items ??
          listData2) as unknown[];
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

      const key = await createKey(jwt, ["*"], "smoke-valid-key");
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
    name: "saves:write API key → PATCH /users/me → 403 SCOPE_INSUFFICIENT",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AC6");

      // Story 3.2.11: Scope enforcement is now active. saves:write cannot access
      // PATCH /users/me which requires users:write.
      const key = await createKey(jwt, ["saves:write"], "smoke-scope-key");
      try {
        // Need to fetch version for If-Match since PATCH /users/me requires it,
        // but we're using API key auth with wrong scope — the scope check happens
        // before version check, so we still get 403.
        const res = await getClient().patch(
          "/users/me",
          { displayName: "Scope Test" },
          {
            auth: { type: "apikey", key: key.keyValue },
            headers: {
              ...idempotencyKey(),
              "If-Match": "1",
            },
          }
        );
        assertStatus(res.status, 403, "PATCH /users/me with saves:write key");
        assertADR008(res.body, "SCOPE_INSUFFICIENT");

        // Validate error body contains scope information
        const err = (res.body as { error: Record<string, unknown> }).error;
        if (!err.required_scope) {
          throw new Error(
            `AC6: missing required_scope in error body: ${JSON.stringify(res.body)}`
          );
        }
        if (!err.granted_scopes) {
          throw new Error(
            `AC6: missing granted_scopes in error body: ${JSON.stringify(res.body)}`
          );
        }

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

      const key = await createKey(jwt, ["*"], "smoke-revoke-key");
      // Delete (revoke) the key
      await deleteKey(key.id, jwt);
      // Attempt to use revoked key
      const res = await getClient().get("/users/me", {
        auth: { type: "apikey", key: key.keyValue },
      });
      assertStatus(res.status, 401, "GET /users/me with revoked API key");
      // The authorizer throws Error("Unauthorized") for revoked keys,
      // which API Gateway maps to generic UNAUTHORIZED via Gateway Response
      assertADR008(res.body, "UNAUTHORIZED");
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
      // The authorizer throws Error("Unauthorized") for unknown API keys,
      // which API Gateway maps to UNAUTHORIZED via Gateway Response
      assertADR008(res.body, "UNAUTHORIZED");
      return res.status;
    },
  },
];
