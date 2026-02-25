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
import { assertStatus, assertSaveShape, jwtAuth } from "../helpers.js";
import { waitForLogEvent } from "../cloudwatch-helpers.js";

// Module-level shared state for the EB1→EB2→EB3 chain
let createdSaveId: string | null = null;
let queryStartEpochMs: number | null = null;
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
      queryStartEpochMs = Date.now() - 30_000;

      const res = await client.post("/saves", { url: uniqueUrl }, { auth });
      assertStatus(res.status, 201, "EB1: POST /saves");
      assertSaveShape(res.body);

      const data = (res.body as { data: { saveId: string } }).data;
      createdSaveId = data.saveId;

      // Register cleanup: soft-delete the save after all scenarios
      if (registerCleanupFn) {
        registerCleanupFn(async () => {
          try {
            await getClient().delete(`/saves/${createdSaveId}`, {
              auth: jwtAuth(),
            });
          } catch {
            // Cleanup errors are non-fatal
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

      // Verify event envelope
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

      const res = await client.patch(
        `/saves/${createdSaveId}`,
        { title: "EB2 Smoke" },
        { auth }
      );
      assertStatus(res.status, 200, "EB2: PATCH /saves/:saveId");

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

      const res = await client.delete(`/saves/${createdSaveId}`, { auth });
      assertStatus(res.status, 204, "EB3: DELETE /saves/:saveId");

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
