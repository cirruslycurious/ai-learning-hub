/**
 * smoke-test/scenarios/eventbridge-verify.ts
 * Phase 7: EventBridge Verification smoke scenarios (EB1–EB3).
 *
 * Story 3.1.9: Verifies that save operations actually deliver EventBridge events
 * by querying CloudWatch Logs after each operation. Catches silent failures
 * (missing IAM, wrong bus name, broken rule targets) before users hit them.
 *
 * Prerequisite: Story 3.1.8 must be deployed (CloudWatch Log Group target on EventBridge).
 * If SMOKE_TEST_EVENT_LOG_GROUP is not set, all scenarios skip gracefully.
 */

import type { ScenarioDefinition, CleanupFn } from "../types.js";
import { ScenarioSkipped } from "../types.js";
import { getClient } from "../client.js";
import {
  assertStatus,
  assertSaveShape,
  jwtAuth,
  idempotencyKey,
  deleteSave,
} from "../helpers.js";
import { waitForLogEvent } from "../cloudwatch-helpers.js";

// Module-level shared state for the EB1→EB2→EB3 chain
let createdSaveId: string | null = null;
// Flush save: a second save used to "thaw" each Lambda context after the main
// API call. Lambda's fire-and-forget emitEvent runs in a detached async IIFE;
// the runtime may freeze the process before PutEvents completes. A follow-up
// request to the same Lambda unfreezes the context and lets the pending HTTP
// call finish. The flush save is created in EB1, patched in EB2, deleted in EB3.
let flushSaveId: string | null = null;
let registerCleanupFn: ((fn: CleanupFn) => void) | null = null;

/**
 * Wire cleanup registry from the runner. Call before executing Phase 7.
 */
export function initEventBridgeCleanup(
  register: (fn: CleanupFn) => void
): void {
  registerCleanupFn = register;
}

function getLogGroupName(): string {
  const logGroup = process.env.SMOKE_TEST_EVENT_LOG_GROUP;
  if (!logGroup) {
    throw new ScenarioSkipped(
      "EventBridge log group not configured — set SMOKE_TEST_EVENT_LOG_GROUP or deploy Story 3.1.8"
    );
  }
  return logGroup;
}

export const eventBridgeVerifyScenarios: ScenarioDefinition[] = [
  // EB1: Create save → verify SaveCreated event in CloudWatch Logs
  {
    id: "EB1",
    name: "POST /saves → CloudWatch Logs contains SaveCreated event",
    async run() {
      const logGroupName = getLogGroupName();
      const client = getClient();
      const auth = jwtAuth();
      const uniqueUrl = `https://example.com/eb-smoke-${Date.now()}`;

      // Record time before API call to bound the CloudWatch query window
      const queryStartEpochMs = Date.now() - 30_000;

      const res = await client.post(
        "/saves",
        { url: uniqueUrl },
        {
          auth,
          headers: idempotencyKey(),
        }
      );
      assertStatus(res.status, 201, "EB1: POST /saves");
      assertSaveShape(res.body);

      const data = (res.body as { data: { saveId: string } }).data;
      createdSaveId = data.saveId;

      // Flush: hit SavesCreateFunction again to thaw the Lambda context and let
      // the fire-and-forget PutEvents from the main request complete.
      const flushUrl = `https://example.com/eb-flush-${Date.now()}`;
      const flushRes = await client.post(
        "/saves",
        { url: flushUrl },
        {
          auth,
          headers: idempotencyKey(),
        }
      );
      if (flushRes.status === 201) {
        flushSaveId = (flushRes.body as { data: { saveId: string } }).data
          .saveId;
      }

      // Register cleanup as a safety net: EB3 deletes the saves in the happy path,
      // but if EB2 or EB3 fails/is skipped, cleanup ensures they are removed.
      if (registerCleanupFn) {
        registerCleanupFn(async () => {
          const cleanupAuth = jwtAuth();
          for (const id of [createdSaveId, flushSaveId]) {
            if (!id) continue;
            try {
              await deleteSave(id, cleanupAuth);
            } catch {
              // Cleanup errors are non-fatal
            }
          }
        });
      }

      // Poll CloudWatch Logs for the SaveCreated event
      const event = await waitForLogEvent(
        logGroupName,
        createdSaveId,
        "SaveCreated",
        queryStartEpochMs
      );

      // Verify event envelope (belt-and-suspenders: filter pattern already matches saveId)
      if (event.detail.saveId !== createdSaveId) {
        throw new Error(
          `EB1: Expected detail.saveId "${createdSaveId}", got "${event.detail.saveId}"`
        );
      }
      if (event.source !== "ai-learning-hub.saves") {
        throw new Error(
          `EB1: Expected source "ai-learning-hub.saves", got "${event.source}"`
        );
      }
      if (event.detailType !== "SaveCreated") {
        throw new Error(
          `EB1: Expected detail-type "SaveCreated", got "${event.detailType}"`
        );
      }

      return res.status;
    },
  },

  // EB2: Update save → verify SaveUpdated event in CloudWatch Logs
  {
    id: "EB2",
    name: "PATCH /saves/:saveId → CloudWatch Logs contains SaveUpdated event",
    async run() {
      if (!createdSaveId) {
        throw new ScenarioSkipped("EB2 requires EB1 (no saveId)");
      }
      const logGroupName = getLogGroupName();
      const client = getClient();
      const auth = jwtAuth();

      // Record time before update
      const updateStartEpochMs = Date.now() - 30_000;

      // Fetch current version for If-Match
      const getRes = await client.get(`/saves/${createdSaveId}`, { auth });
      const saveVersion =
        (getRes.body as { data: { version?: number } })?.data?.version ?? 1;

      const res = await client.patch(
        `/saves/${createdSaveId}`,
        { title: "EB2 Smoke" },
        {
          auth,
          headers: {
            ...idempotencyKey(),
            "If-Match": String(saveVersion),
          },
        }
      );
      assertStatus(res.status, 200, "EB2: PATCH /saves/:saveId");

      // Flush: hit SavesUpdateFunction again to thaw context
      if (flushSaveId) {
        const flushGet = await client.get(`/saves/${flushSaveId}`, { auth });
        const flushVersion =
          (flushGet.body as { data: { version?: number } })?.data?.version ?? 1;
        await client.patch(
          `/saves/${flushSaveId}`,
          { title: "EB2 Flush" },
          {
            auth,
            headers: {
              ...idempotencyKey(),
              "If-Match": String(flushVersion),
            },
          }
        );
      }

      // Poll CloudWatch Logs for the SaveUpdated event
      const event = await waitForLogEvent(
        logGroupName,
        createdSaveId,
        "SaveUpdated",
        updateStartEpochMs
      );

      if (event.detailType !== "SaveUpdated") {
        throw new Error(
          `EB2: Expected detail-type "SaveUpdated", got "${event.detailType}"`
        );
      }
      if (!event.detail.updatedFields) {
        throw new Error(
          "EB2: Expected detail.updatedFields to be present in SaveUpdated event"
        );
      }

      return res.status;
    },
  },

  // EB3: Delete save → verify SaveDeleted event in CloudWatch Logs
  {
    id: "EB3",
    name: "DELETE /saves/:saveId → CloudWatch Logs contains SaveDeleted event",
    async run() {
      if (!createdSaveId) {
        throw new ScenarioSkipped("EB3 requires EB1 (no saveId)");
      }
      const logGroupName = getLogGroupName();
      const client = getClient();
      const auth = jwtAuth();

      // Record time before delete
      const deleteStartEpochMs = Date.now() - 30_000;

      const res = await client.delete(`/saves/${createdSaveId}`, {
        auth,
        headers: idempotencyKey(),
      });
      assertStatus(res.status, 204, "EB3: DELETE /saves/:saveId");

      // Flush: hit SavesDeleteFunction again to thaw context
      if (flushSaveId) {
        await deleteSave(flushSaveId, auth);
        flushSaveId = null; // already cleaned up
      }

      // Poll CloudWatch Logs for the SaveDeleted event
      const event = await waitForLogEvent(
        logGroupName,
        createdSaveId,
        "SaveDeleted",
        deleteStartEpochMs
      );

      if (event.detailType !== "SaveDeleted") {
        throw new Error(
          `EB3: Expected detail-type "SaveDeleted", got "${event.detailType}"`
        );
      }

      return res.status;
    },
  },
];
