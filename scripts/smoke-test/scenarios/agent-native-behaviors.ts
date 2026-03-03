/**
 * smoke-test/scenarios/agent-native-behaviors.ts
 * Agent-native behavior validation scenarios (AN1–AN8).
 *
 * Story 3.2.11: Cross-cutting agent-native API behaviors introduced in Epic 3.2.
 */

import type { ScenarioDefinition } from "../types.js";
import { getClient } from "../client.js";
import {
  assertStatus,
  assertADR008,
  assertResponseEnvelope,
  assertCursorPagination,
  assertHeader,
  jwtAuth,
  idempotencyKey,
  createSave,
  deleteSave,
} from "../helpers.js";

export const agentNativeBehaviorScenarios: ScenarioDefinition[] = [
  // AN1: Response envelope on authenticated endpoints
  {
    id: "AN1",
    name: "GET /users/me → response envelope (data, links.self)",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get("/users/me", { auth });
      assertStatus(res.status, 200, "AN1: GET /users/me");
      assertResponseEnvelope(res.body);

      return res.status;
    },
  },

  // AN2: Idempotency replay
  {
    id: "AN2",
    name: "POST /saves twice with same Idempotency-Key → same saveId + replayed header",
    async run() {
      const auth = jwtAuth();
      const client = getClient();
      const idemKey = { "Idempotency-Key": crypto.randomUUID() };
      const url = `https://example.com/an2-${Date.now()}`;

      const res1 = await client.post(
        "/saves",
        { url },
        {
          auth,
          headers: idemKey,
        }
      );
      assertStatus(res1.status, 201, "AN2: first POST /saves");
      const saveId1 = (res1.body as { data: { saveId: string } }).data.saveId;

      try {
        const res2 = await client.post(
          "/saves",
          { url },
          {
            auth,
            headers: idemKey,
          }
        );
        assertStatus(res2.status, 201, "AN2: second POST /saves (replay)");
        const saveId2 = (res2.body as { data: { saveId: string } }).data.saveId;

        if (saveId1 !== saveId2) {
          throw new Error(
            `AN2: saveId mismatch on replay: "${saveId1}" vs "${saveId2}"`
          );
        }

        assertHeader(
          res2.headers,
          "x-idempotent-replayed",
          "AN2: X-Idempotent-Replayed header"
        );

        return res2.status;
      } finally {
        await deleteSave(saveId1, auth).catch(() => undefined);
      }
    },
  },

  // AN3: If-Match conflict → 409 VERSION_CONFLICT
  {
    id: "AN3",
    name: "PATCH /saves/:saveId with stale If-Match → 409 VERSION_CONFLICT",
    async run() {
      const auth = jwtAuth();

      const save = await createSave(auth);
      try {
        const client = getClient();
        const res = await client.patch(
          `/saves/${save.saveId}`,
          { title: "Should Fail" },
          {
            auth,
            headers: {
              ...idempotencyKey(),
              "If-Match": "999",
            },
          }
        );
        assertStatus(res.status, 409, "AN3: stale If-Match");
        assertADR008(res.body, "VERSION_CONFLICT");

        const err = (res.body as { error: { currentVersion?: number } }).error;
        if (typeof err.currentVersion !== "number") {
          throw new Error(
            `AN3: expected currentVersion (number) in error body, got: ${JSON.stringify(err)}`
          );
        }

        return res.status;
      } finally {
        await deleteSave(save.saveId, auth).catch(() => undefined);
      }
    },
  },

  // AN4: Missing If-Match → 428 PRECONDITION_REQUIRED
  {
    id: "AN4",
    name: "PATCH /saves/:saveId without If-Match → 428 PRECONDITION_REQUIRED",
    async run() {
      const auth = jwtAuth();

      const save = await createSave(auth);
      try {
        const client = getClient();
        const res = await client.patch(
          `/saves/${save.saveId}`,
          { title: "Should Fail" },
          {
            auth,
            headers: idempotencyKey(), // No If-Match
          }
        );
        assertStatus(res.status, 428, "AN4: missing If-Match");
        assertADR008(res.body, "PRECONDITION_REQUIRED");

        return res.status;
      } finally {
        await deleteSave(save.saveId, auth).catch(() => undefined);
      }
    },
  },

  // AN5: Insufficient scope → 403 SCOPE_INSUFFICIENT
  {
    id: "AN5",
    name: "saves:read API key → POST /saves → 403 SCOPE_INSUFFICIENT",
    async run() {
      const jwt = process.env.SMOKE_TEST_CLERK_JWT;
      if (!jwt) throw new Error("SMOKE_TEST_CLERK_JWT is required for AN5");
      const client = getClient();

      // Create API key with saves:read only
      const createKeyRes = await client.post(
        "/users/api-keys",
        { name: "smoke-scope-an5", scopes: ["saves:read"] },
        { auth: { type: "jwt", token: jwt }, headers: idempotencyKey() }
      );
      assertStatus(createKeyRes.status, 201, "AN5: create API key");
      const keyData = (createKeyRes.body as { data: Record<string, unknown> })
        .data;
      const keyId = String(keyData.id);
      const keyValue = String(keyData.keyValue ?? keyData.key);

      try {
        // Attempt POST /saves (requires saves:create) with saves:read key
        const res = await client.post(
          "/saves",
          { url: "https://example.com/an5-scope-test" },
          {
            auth: { type: "apikey", key: keyValue },
            headers: idempotencyKey(),
          }
        );
        assertStatus(res.status, 403, "AN5: insufficient scope");
        assertADR008(res.body, "SCOPE_INSUFFICIENT");

        const err = (res.body as { error: Record<string, unknown> }).error;
        if (!err.required_scope) {
          throw new Error(
            `AN5: missing required_scope in error body: ${JSON.stringify(err)}`
          );
        }
        if (!err.granted_scopes) {
          throw new Error(
            `AN5: missing granted_scopes in error body: ${JSON.stringify(err)}`
          );
        }

        return res.status;
      } finally {
        // Cleanup API key
        await client
          .delete(`/users/api-keys/${keyId}`, {
            auth: { type: "jwt", token: jwt },
            headers: idempotencyKey(),
          })
          .catch(() => undefined);
      }
    },
  },

  // AN6: Rate limit headers present
  {
    id: "AN6",
    name: "GET /users/me → X-RateLimit-* headers present",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get("/users/me", { auth });
      assertStatus(res.status, 200, "AN6: GET /users/me");

      assertHeader(res.headers, "x-ratelimit-limit", "AN6: X-RateLimit-Limit");
      assertHeader(
        res.headers,
        "x-ratelimit-remaining",
        "AN6: X-RateLimit-Remaining"
      );
      assertHeader(res.headers, "x-ratelimit-reset", "AN6: X-RateLimit-Reset");

      return res.status;
    },
  },

  // AN7: Cursor pagination mechanics
  {
    id: "AN7",
    name: "GET /saves?limit=1 → cursor pagination + follow links.next",
    async run() {
      const auth = jwtAuth();

      // Create 2 saves so we can paginate
      const save1 = await createSave(auth);
      const save2 = await createSave(auth);

      try {
        const client = getClient();

        // Page 1: limit=1
        const res1 = await client.get("/saves?limit=1", { auth });
        assertStatus(res1.status, 200, "AN7: GET /saves?limit=1");
        assertCursorPagination(res1.body);

        const body1 = res1.body as {
          data: Array<{ saveId: string }>;
          meta: { cursor: string | null };
          links: { self: string; next?: string | null };
        };
        if (body1.data.length !== 1) {
          throw new Error(
            `AN7: expected 1 item with limit=1, got ${body1.data.length}`
          );
        }
        if (typeof body1.meta.cursor !== "string" || !body1.meta.cursor) {
          throw new Error(
            `AN7: expected non-null cursor string, got ${JSON.stringify(body1.meta.cursor)}`
          );
        }
        if (!body1.links.next || !body1.links.next.includes("cursor=")) {
          throw new Error(
            `AN7: expected links.next with cursor= param, got "${body1.links.next}"`
          );
        }

        // Page 2: follow links.next
        const res2 = await client.get(body1.links.next, { auth });
        assertStatus(res2.status, 200, "AN7: follow links.next");
        const body2 = res2.body as { data: Array<{ saveId: string }> };
        if (!Array.isArray(body2.data) || body2.data.length === 0) {
          throw new Error("AN7: following links.next returned empty data");
        }

        return res1.status;
      } finally {
        await deleteSave(save1.saveId, auth).catch(() => undefined);
        await deleteSave(save2.saveId, auth).catch(() => undefined);
      }
    },
  },

  // AN8: X-Agent-ID accepted
  {
    id: "AN8",
    name: "GET /users/me with X-Agent-ID → 200 accepted",
    async run() {
      const client = getClient();
      const auth = jwtAuth();

      const res = await client.get("/users/me", {
        auth,
        headers: { "X-Agent-ID": "smoke-test-agent" },
      });
      assertStatus(res.status, 200, "AN8: GET /users/me with X-Agent-ID");

      return res.status;
    },
  },
];
