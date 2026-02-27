/**
 * Unit tests for agent identity extraction (Story 3.2.4, AC1-AC4, AC17)
 */
import { describe, it, expect } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { extractAgentIdentity } from "../src/agent-identity.js";

function makeEvent(headers: Record<string, string> = {}): APIGatewayProxyEvent {
  return {
    headers,
    httpMethod: "GET",
    path: "/test",
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: "/test",
    requestContext: {
      accountId: "123",
      apiId: "api",
      authorizer: {},
      protocol: "HTTP/1.1",
      httpMethod: "GET",
      identity: {
        sourceIp: "127.0.0.1",
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userAgent: null,
        userArn: null,
      },
      path: "/test",
      stage: "dev",
      requestId: "req-123",
      requestTimeEpoch: Date.now(),
      resourceId: "res",
      resourcePath: "/test",
    },
  };
}

describe("extractAgentIdentity", () => {
  describe("AC1: X-Agent-ID header extraction", () => {
    it("returns agent actorType when X-Agent-ID is present (lowercase)", () => {
      const event = makeEvent({ "x-agent-id": "claude-code-v1" });
      const result = extractAgentIdentity(event);
      expect(result).toEqual({
        agentId: "claude-code-v1",
        actorType: "agent",
      });
    });

    it("returns agent actorType when X-Agent-ID is present (mixed case)", () => {
      const event = makeEvent({ "X-Agent-ID": "my-agent.prod.1" });
      const result = extractAgentIdentity(event);
      expect(result).toEqual({
        agentId: "my-agent.prod.1",
        actorType: "agent",
      });
    });

    it("returns human actorType when header is absent", () => {
      const event = makeEvent({});
      const result = extractAgentIdentity(event);
      expect(result).toEqual({
        agentId: null,
        actorType: "human",
      });
    });

    it("returns human actorType when headers object is undefined", () => {
      const event = makeEvent();
      event.headers = null as unknown as Record<string, string>;
      const result = extractAgentIdentity(event);
      expect(result).toEqual({
        agentId: null,
        actorType: "human",
      });
    });
  });

  describe("AC2: X-Agent-ID format validation", () => {
    it("accepts valid alphanumeric agent IDs", () => {
      const valid = [
        "agent1",
        "my-agent",
        "my_agent",
        "my.agent",
        "claude-code-v1",
        "github_bot_42",
        "a",
        "A".repeat(128),
      ];
      for (const id of valid) {
        const event = makeEvent({ "x-agent-id": id });
        const result = extractAgentIdentity(event);
        expect(result.agentId).toBe(id);
        expect(result.actorType).toBe("agent");
      }
    });

    it("rejects empty string", () => {
      const event = makeEvent({ "x-agent-id": "" });
      expect(() => extractAgentIdentity(event)).toThrow(
        "X-Agent-ID header must be 1-128 characters"
      );
    });

    it("rejects agent ID exceeding 128 characters", () => {
      const event = makeEvent({ "x-agent-id": "a".repeat(129) });
      expect(() => extractAgentIdentity(event)).toThrow(
        "X-Agent-ID header must be 1-128 characters"
      );
    });

    it("rejects agent ID with special characters", () => {
      const invalid = [
        "agent with spaces",
        "agent@host",
        "agent/path",
        "agent<script>",
        "agent;drop",
        "agent\ttab",
      ];
      for (const id of invalid) {
        const event = makeEvent({ "x-agent-id": id });
        expect(() => extractAgentIdentity(event)).toThrow(
          "X-Agent-ID header must be 1-128 characters"
        );
      }
    });

    it("returns 400 VALIDATION_ERROR with correct error shape", () => {
      const event = makeEvent({ "x-agent-id": "invalid agent!" });
      try {
        extractAgentIdentity(event);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const err = error as {
          code: string;
          statusCode: number;
          details: {
            fields: Array<{
              field: string;
              code: string;
              message: string;
            }>;
          };
        };
        expect(err.code).toBe("VALIDATION_ERROR");
        expect(err.statusCode).toBe(400);
        expect(err.details.fields).toHaveLength(1);
        expect(err.details.fields[0].field).toBe("X-Agent-ID");
        expect(err.details.fields[0].code).toBe("invalid_format");
      }
    });
  });

  describe("case-insensitive header lookup", () => {
    it("prefers lowercase x-agent-id over X-Agent-ID", () => {
      // API Gateway normalizes to lowercase, but both should work
      const event = makeEvent({
        "x-agent-id": "lowercase-agent",
        "X-Agent-ID": "uppercase-agent",
      });
      const result = extractAgentIdentity(event);
      expect(result.agentId).toBe("lowercase-agent");
    });
  });
});
