/**
 * ApiClient unit tests (mock fetch).
 *
 * Story 2.1-D7, AC17
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient, ApiError } from "../../src/api/client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("ApiClient", () => {
  const getToken = vi.fn().mockResolvedValue("test-token");
  let client: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ApiClient("https://api.example.com/dev", getToken);
  });

  it("GET unwraps { data } envelope", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { userId: "user_1", email: "a@b.com" } }),
    });

    const result = await client.get<{ userId: string; email: string }>(
      "/users/me"
    );

    expect(result).toEqual({ userId: "user_1", email: "a@b.com" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/dev/users/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("POST sends JSON body and unwraps response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        data: { id: "key_01", name: "My Key", key: "raw-key" },
      }),
    });

    const result = await client.post<{ id: string }>("/users/api-keys", {
      name: "My Key",
      scopes: ["*"],
    });

    expect(result.id).toBe("key_01");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/dev/users/api-keys",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "My Key", scopes: ["*"] }),
      })
    );
  });

  it("PATCH sends body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { displayName: "New Name" } }),
    });

    const result = await client.patch<{ displayName: string }>("/users/me", {
      displayName: "New Name",
    });

    expect(result.displayName).toBe("New Name");
  });

  it("DELETE returns void on 204", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    await expect(
      client.delete("/users/api-keys/key_01")
    ).resolves.toBeUndefined();
  });

  it("throws ApiError on non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId: "req-123",
        },
      }),
    });

    await expect(client.get("/users/me")).rejects.toThrow(ApiError);
  });

  it("ApiError contains correct code, statusCode, and requestId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          requestId: "req-123",
        },
      }),
    });

    await expect(client.get("/users/me")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
      requestId: "req-123",
    });
  });

  it("sends Authorization header with token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    await client.get("/test");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-token"
    );
  });

  it("omits Authorization header when token is null", async () => {
    getToken.mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    await client.get("/test");

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(
      (options.headers as Record<string, string>)["Authorization"]
    ).toBeUndefined();
  });

  it("strips trailing slash from base URL", async () => {
    const trailingClient = new ApiClient(
      "https://api.example.com/dev/",
      getToken
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    });

    await trailingClient.get("/test");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/dev/test",
      expect.anything()
    );
  });
});
