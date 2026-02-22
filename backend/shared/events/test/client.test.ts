import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createEventBridgeClient,
  getDefaultClient,
  resetDefaultClient,
} from "../src/client.js";

vi.mock("@aws-sdk/client-eventbridge", () => {
  const MockEventBridgeClient = vi.fn();
  return { EventBridgeClient: MockEventBridgeClient };
});

describe("client", () => {
  beforeEach(() => {
    resetDefaultClient();
    vi.clearAllMocks();
  });

  describe("createEventBridgeClient", () => {
    it("creates a new EventBridgeClient instance", () => {
      const client = createEventBridgeClient();
      expect(client).toBeDefined();
    });

    it("creates a different instance on each call", () => {
      const client1 = createEventBridgeClient();
      const client2 = createEventBridgeClient();
      expect(client1).not.toBe(client2);
    });

    it("accepts a custom region option", () => {
      const client = createEventBridgeClient({ region: "eu-west-1" });
      expect(client).toBeDefined();
    });
  });

  describe("getDefaultClient", () => {
    it("returns an EventBridgeClient instance", () => {
      const client = getDefaultClient();
      expect(client).toBeDefined();
    });

    it("returns the same instance on subsequent calls (singleton)", () => {
      const client1 = getDefaultClient();
      const client2 = getDefaultClient();
      expect(client1).toBe(client2);
    });
  });

  describe("resetDefaultClient", () => {
    it("clears the singleton so next call creates a new instance", () => {
      const client1 = getDefaultClient();
      resetDefaultClient();
      const client2 = getDefaultClient();
      expect(client1).not.toBe(client2);
    });
  });
});
