import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mockGetToken = vi.fn().mockResolvedValue("test-token");

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

import { useApiClient } from "../../src/api/hooks";
import { ApiClient } from "../../src/api/client";

describe("useApiClient", () => {
  it("returns an ApiClient instance", () => {
    const { result } = renderHook(() => useApiClient());
    expect(result.current).toBeInstanceOf(ApiClient);
  });

  it("returns a stable reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useApiClient());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
