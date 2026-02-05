import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { createLogger, logger } from "../src/logger.js";

describe("Logger", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: MockInstance<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: MockInstance<any>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete process.env._X_AMZN_TRACE_ID;
  });

  describe("createLogger", () => {
    it("should create a logger with default context", () => {
      const log = createLogger();
      log.info("test message");

      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.message).toBe("test message");
      expect(output.level).toBe("INFO");
    });

    it("should create a logger with custom context", () => {
      const log = createLogger({ requestId: "req-123", userId: "user-456" });
      log.info("test message");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.requestId).toBe("req-123");
      expect(output.userId).toBe("user-456");
    });
  });

  describe("log levels", () => {
    it("should log debug messages", () => {
      const log = createLogger({}, "debug");
      log.debug("debug message");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("DEBUG");
    });

    it("should log info messages", () => {
      const log = createLogger();
      log.info("info message");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("INFO");
    });

    it("should log warn messages", () => {
      const log = createLogger();
      log.warn("warn message");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("WARN");
    });

    it("should log error messages to stderr", () => {
      const log = createLogger();
      log.error("error message");

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(output.level).toBe("ERROR");
    });

    it("should respect minimum log level", () => {
      const log = createLogger({}, "warn");
      log.debug("debug");
      log.info("info");
      log.warn("warn");
      log.error("error");

      // Debug and info should not be logged
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("structured output", () => {
    it("should include timestamp", () => {
      const log = createLogger();
      log.info("test");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.timestamp).toBeDefined();
      expect(new Date(output.timestamp).getTime()).not.toBeNaN();
    });

    it("should include additional data", () => {
      const log = createLogger();
      log.info("test", { foo: "bar", count: 42 });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.foo).toBe("bar");
      expect(output.data.count).toBe(42);
    });

    it("should include error information", () => {
      const log = createLogger();
      const error = new Error("Test error");
      log.error("error occurred", error);

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(output.error.name).toBe("Error");
      expect(output.error.message).toBe("Test error");
      expect(output.error.stack).toBeDefined();
    });
  });

  describe("X-Ray integration", () => {
    it("should capture X-Ray trace ID from environment", () => {
      process.env._X_AMZN_TRACE_ID = "Root=1-abc-def;Parent=xyz;Sampled=1";
      const log = createLogger();
      log.info("test");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.traceId).toBe("1-abc-def");
    });

    it("should handle missing X-Ray trace ID", () => {
      const log = createLogger();
      log.info("test");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.traceId).toBeUndefined();
    });
  });

  describe("sensitive data redaction", () => {
    it("should redact API keys in data", () => {
      const log = createLogger();
      log.info("test", { apiKey: "secret-key-12345" });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.apiKey).toBe("[REDACTED]");
    });

    it("should redact passwords in data", () => {
      const log = createLogger();
      log.info("test", { password: "my-secret-pass" });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.password).toBe("[REDACTED]");
    });

    it("should redact tokens in data", () => {
      const log = createLogger();
      log.info("test", { authToken: "bearer-token-xyz" });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.authToken).toBe("[REDACTED]");
    });

    it("should redact secrets in data", () => {
      const log = createLogger();
      log.info("test", { clientSecret: "client-secret-abc" });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.clientSecret).toBe("[REDACTED]");
    });

    it("should redact authorization headers", () => {
      const log = createLogger();
      log.info("test", { authorization: "Bearer abc123" });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.authorization).toBe("[REDACTED]");
    });

    it("should redact nested sensitive data", () => {
      const log = createLogger();
      log.info("test", {
        user: { name: "John", apiKey: "key-123" },
      });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.user.name).toBe("John");
      expect(output.data.user.apiKey).toBe("[REDACTED]");
    });

    it("should redact API key patterns in strings", () => {
      const log = createLogger();
      log.info("test", { message: "apikey=secretvalue123456789012" });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.message).toBe("[REDACTED]");
    });

    it("should redact bearer tokens in strings", () => {
      const log = createLogger();
      log.info("test", {
        header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      });

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.header).toBe("[REDACTED]");
    });
  });

  describe("child logger", () => {
    it("should create child with merged context", () => {
      const parent = createLogger({ requestId: "req-123" });
      const child = parent.child({ userId: "user-456" });
      child.info("test");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.requestId).toBe("req-123");
      expect(output.userId).toBe("user-456");
    });
  });

  describe("setRequestContext", () => {
    it("should update context", () => {
      const log = createLogger();
      log.setRequestContext({ requestId: "req-new", userId: "user-new" });
      log.info("test");

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.requestId).toBe("req-new");
      expect(output.userId).toBe("user-new");
    });
  });

  describe("timed logging", () => {
    it("should log duration", () => {
      const log = createLogger();
      const startTime = Date.now() - 100;
      log.timed("operation complete", startTime);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.data.durationMs).toBeGreaterThanOrEqual(100);
    });
  });

  describe("default logger instance", () => {
    it("should be available", () => {
      logger.info("test from default logger");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
