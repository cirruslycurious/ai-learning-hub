/**
 * smoke-test/client.ts
 * Thin HTTP client wrapper for the smoke-test runner.
 * Handles base URL, auth headers, JSON parsing, and timing.
 */

export interface AuthJwt {
  type: "jwt";
  token: string;
}

export interface AuthApiKey {
  type: "apikey";
  key: string;
}

export interface AuthNone {
  type: "none";
}

export type Auth = AuthJwt | AuthApiKey | AuthNone;

export interface RequestOptions {
  auth?: Auth;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface SmokeResponse {
  status: number;
  body: unknown;
  headers: Headers;
  ms: number;
}

export class SmokeClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<SmokeResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      ...options.headers,
    };

    if (options.auth?.type === "jwt") {
      headers["Authorization"] = `Bearer ${options.auth.token}`;
    } else if (options.auth?.type === "apikey") {
      headers["x-api-key"] = options.auth.key;
    }

    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const ms = Date.now() - start;

    let body: unknown;
    // 204 No Content has no body; guard against empty-body parsing errors
    if (res.status === 204) {
      body = "";
    } else {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const text = await res.text();
        body = text ? JSON.parse(text) : "";
      } else {
        body = await res.text();
      }
    }

    return { status: res.status, body, headers: res.headers, ms };
  }

  async get(
    path: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<SmokeResponse> {
    return this.request("GET", path, options);
  }

  async patch(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, "body">
  ): Promise<SmokeResponse> {
    return this.request("PATCH", path, { ...options, body });
  }

  async post(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, "body">
  ): Promise<SmokeResponse> {
    return this.request("POST", path, { ...options, body });
  }

  async delete(
    path: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<SmokeResponse> {
    return this.request("DELETE", path, options);
  }

  async options(
    path: string,
    options?: Omit<RequestOptions, "body">
  ): Promise<SmokeResponse> {
    return this.request("OPTIONS", path, options);
  }
}

let _client: SmokeClient | null = null;

/** Returns the singleton SmokeClient. Exits with error if SMOKE_TEST_API_URL is not set. */
export function getClient(): SmokeClient {
  if (!_client) {
    const url = process.env.SMOKE_TEST_API_URL;
    if (!url) {
      console.error(
        "SMOKE_TEST_API_URL is required. See scripts/smoke-test/.env.smoke.example"
      );
      process.exit(1);
    }
    _client = new SmokeClient(url);
  }
  return _client;
}
