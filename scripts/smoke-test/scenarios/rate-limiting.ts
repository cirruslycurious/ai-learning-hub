/**
 * smoke-test/scenarios/rate-limiting.ts
 * AC14: Rate limiting scenario — 11 rapid requests should trigger 429
 */

import { getClient } from "../client.js";
import { assertADR008, assertHeader } from "../helpers.js";
import { ScenarioSkipped } from "../types.js";
import type { ScenarioDefinition } from "../types.js";

export const rateLimitingScenarios: ScenarioDefinition[] = [
  {
    id: "AC14",
    name: "11 rapid requests → at least one 429 RATE_LIMITED + Retry-After",
    async run() {
      const jwt = process.env.SMOKE_TEST_RATE_LIMIT_JWT;
      if (!jwt) {
        throw new ScenarioSkipped(
          "SMOKE_TEST_RATE_LIMIT_JWT not set — use a dedicated rate-limit identity to enable"
        );
      }

      // Send 11 requests in rapid succession
      const promises = Array.from({ length: 11 }, () =>
        getClient().get("/users/me", { auth: { type: "jwt", token: jwt } })
      );
      const responses = await Promise.all(promises);

      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      if (rateLimitedResponses.length === 0) {
        throw new Error(
          `AC14 FAILED — sent 11 rapid requests, expected at least one 429, ` +
            `got statuses: [${responses.map((r) => r.status).join(", ")}]`
        );
      }

      // Validate the 429 response body and headers
      const sample = rateLimitedResponses[0];
      assertADR008(sample.body, "RATE_LIMITED");
      assertHeader(
        sample.headers,
        "retry-after",
        "429 response must include Retry-After header"
      );

      return 429;
    },
  },
];
