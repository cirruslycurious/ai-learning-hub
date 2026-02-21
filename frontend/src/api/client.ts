/**
 * Typed API client for AI Learning Hub backend.
 *
 * Unwraps the standard { data: T } envelope and throws typed errors on non-2xx.
 * Auth token injection is via a callback so the client is framework-agnostic.
 *
 * Story 2.1-D7, AC17
 */
import type { ApiErrorResponse } from "@ai-learning-hub/types";

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly requestId?: string;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

export type GetTokenFn = () => Promise<string | null>;

export class ApiClient {
  private baseUrl: string;
  private getToken: GetTokenFn;

  constructor(baseUrl: string, getToken: GetTokenFn) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.getToken = getToken;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request<void>("DELETE", path);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const json = await response.json();

    if (!response.ok) {
      const errorBody = json as ApiErrorResponse;
      throw new ApiError(
        errorBody.error.code,
        errorBody.error.message,
        response.status,
        errorBody.error.requestId
      );
    }

    return (json as { data: T }).data;
  }
}
