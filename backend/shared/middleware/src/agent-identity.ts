/**
 * Agent identity extraction middleware (Story 3.2.4, FR103)
 *
 * Extracts X-Agent-ID header from incoming requests to determine
 * whether the caller is a human or an AI agent. Always-on (no opt-in flag)
 * because it's zero-cost and universally useful.
 */
import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  AppError,
  ErrorCode,
  type AgentIdentity,
} from "@ai-learning-hub/types";

const AGENT_ID_PATTERN = /^[a-zA-Z0-9_\-.]{1,128}$/;

/**
 * Extract agent identity from X-Agent-ID header.
 *
 * - Header present + valid format → actorType: "agent", agentId: header value
 * - Header absent → actorType: "human", agentId: null
 * - Header present + invalid format → throws VALIDATION_ERROR
 *
 * API Gateway normalizes headers to lowercase, but we check both cases
 * for safety.
 */
export function extractAgentIdentity(
  event: APIGatewayProxyEvent
): AgentIdentity {
  const headers = event.headers ?? {};
  const rawAgentId = headers["x-agent-id"] ?? headers["X-Agent-ID"] ?? null;

  if (rawAgentId === null || rawAgentId === undefined) {
    return { agentId: null, actorType: "human" };
  }

  if (!AGENT_ID_PATTERN.test(rawAgentId)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "X-Agent-ID header must be 1-128 characters matching [a-zA-Z0-9_\\-.]",
      {
        fields: [
          {
            field: "X-Agent-ID",
            code: "invalid_format",
            message:
              "X-Agent-ID header must be 1-128 characters matching [a-zA-Z0-9_\\-.]",
          },
        ],
      }
    );
  }

  return { agentId: rawAgentId, actorType: "agent" };
}
