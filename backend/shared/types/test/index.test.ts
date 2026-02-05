import { describe, it, expect } from "vitest";
import {
  ErrorCode,
  ErrorCodeToStatus,
  AppError,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  ResourceType,
  ProjectStatus,
} from "../src/index.js";

describe("index re-exports", () => {
  it("re-exports error types", () => {
    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCodeToStatus[ErrorCode.NOT_FOUND]).toBe(404);
    const err = new AppError(ErrorCode.NOT_FOUND, "test");
    expect(AppError.isAppError(err)).toBe(true);
    const body: ApiErrorResponse = err.toApiError("req-1");
    expect(body.error.requestId).toBe("req-1");
  });

  it("re-exports entity and API types for type-checking", () => {
    const response: ApiSuccessResponse<{ id: string }> = { data: { id: "x" } };
    expect(response.data.id).toBe("x");
    expect(ResourceType.ARTICLE).toBe("ARTICLE");
    expect(ProjectStatus.EXPLORING).toBe("EXPLORING");
  });
});
