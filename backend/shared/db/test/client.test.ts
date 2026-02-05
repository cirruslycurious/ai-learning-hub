import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDynamoDBClient,
  getDefaultClient,
  resetDefaultClient,
} from "../src/client.js";

describe("DynamoDB Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetDefaultClient();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDefaultClient();
  });

  describe("createDynamoDBClient", () => {
    it("should create a DynamoDB document client", () => {
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
    });

    it("should use default region when not specified", () => {
      delete process.env.AWS_REGION;
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
    });

    it("should use AWS_REGION from environment", () => {
      process.env.AWS_REGION = "eu-west-1";
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
    });

    it("should accept custom region", () => {
      const client = createDynamoDBClient({ region: "ap-southeast-1" });
      expect(client).toBeDefined();
    });

    it("should accept custom endpoint", () => {
      const client = createDynamoDBClient({
        endpoint: "http://localhost:8000",
      });
      expect(client).toBeDefined();
    });

    it("should use DYNAMODB_ENDPOINT from environment", () => {
      process.env.DYNAMODB_ENDPOINT = "http://localhost:8000";
      const client = createDynamoDBClient();
      expect(client).toBeDefined();
    });
  });

  describe("getDefaultClient", () => {
    it("should return a singleton client", () => {
      const client1 = getDefaultClient();
      const client2 = getDefaultClient();
      expect(client1).toBe(client2);
    });
  });

  describe("resetDefaultClient", () => {
    it("should reset the singleton client", () => {
      const client1 = getDefaultClient();
      resetDefaultClient();
      const client2 = getDefaultClient();
      expect(client1).not.toBe(client2);
    });
  });
});
