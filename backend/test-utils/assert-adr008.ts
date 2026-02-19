/**
 * T5: ADR-008 Error Response Shape Assertion Utility (Story 2.1-D5, AC11)
 *
 * Validates that API error responses conform to ADR-008:
 * { error: { code, message, requestId, details? } }
 *
 * - `code` must be a valid ErrorCode enum value
 * - HTTP status must match the ErrorCodeToStatus mapping
 */
import { expect } from "vitest";
import { ErrorCode, ErrorCodeToStatus } from "@ai-learning-hub/types";

interface ApiGatewayResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string | number | boolean>;
}

/**
 * Asserts that a Lambda/API Gateway response conforms to ADR-008 error shape.
 *
 * @param response - The API Gateway proxy response object
 * @param expectedCode - Expected ErrorCode enum value (optional, validates if provided)
 * @param expectedStatus - Expected HTTP status code (optional, inferred from code if not provided)
 */
export function assertADR008Error(
  response: ApiGatewayResponse,
  expectedCode?: ErrorCode,
  expectedStatus?: number
): void {
  // 1. Body must parse as JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    expect.fail(
      `ADR-008: Response body is not valid JSON. Got: ${response.body}`
    );
    return;
  }

  // 2. Must have .error object
  expect(parsed).toHaveProperty("error");
  const error = (parsed as { error: Record<string, unknown> }).error;

  // 3. Must have required fields
  expect(error).toHaveProperty("code");
  expect(error).toHaveProperty("message");
  expect(error).toHaveProperty("requestId");

  // 4. code must be a valid ErrorCode enum value
  const code = error.code as string;
  const validCodes = Object.values(ErrorCode) as string[];
  expect(
    validCodes,
    `ADR-008: error.code "${code}" is not a valid ErrorCode enum value`
  ).toContain(code);

  // 5. message must be a non-empty string
  expect(typeof error.message).toBe("string");
  expect(
    (error.message as string).length,
    "ADR-008: error.message must be non-empty"
  ).toBeGreaterThan(0);

  // 6. requestId must be a non-empty string
  expect(typeof error.requestId).toBe("string");
  expect(
    (error.requestId as string).length,
    "ADR-008: error.requestId must be non-empty"
  ).toBeGreaterThan(0);

  // 7. If expectedCode provided, validate it
  if (expectedCode) {
    expect(code, `ADR-008: Expected error code ${expectedCode}`).toBe(
      expectedCode
    );
  }

  // 8. HTTP status must match ErrorCodeToStatus mapping
  const mappedStatus = ErrorCodeToStatus[code as ErrorCode];
  if (expectedStatus) {
    expect(
      response.statusCode,
      `ADR-008: Expected HTTP ${expectedStatus}`
    ).toBe(expectedStatus);
  }
  if (mappedStatus) {
    expect(
      response.statusCode,
      `ADR-008: HTTP status ${response.statusCode} does not match ErrorCodeToStatus[${code}] = ${mappedStatus}`
    ).toBe(mappedStatus);
  }

  // 9. details field is optional but must be an object if present
  if (error.details !== undefined) {
    expect(typeof error.details).toBe("object");
  }
}
