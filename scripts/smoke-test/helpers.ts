/**
 * smoke-test/helpers.ts
 * Shared assertion helpers for the smoke-test runner.
 * Inlined here (not imported from backend) so the script runs without build steps.
 *
 * Story 3.2.11: Added idempotencyKey(), createSave(), deleteSave(),
 * assertResponseEnvelope(), assertCursorPagination().
 */

import crypto from "node:crypto";
import { getClient } from "./client.js";

/**
 * Assert that a response body matches ADR-008 error shape:
 * { error: { code: string, message: string, requestId: string } }
 */
export function assertADR008(body: unknown, expectedCode?: string): void {
  const b = body as Record<string, unknown>;
  const err = b?.error as Record<string, unknown> | undefined;
  if (!err?.code) {
    throw new Error(`Missing error.code in: ${JSON.stringify(body)}`);
  }
  if (!err?.message) {
    throw new Error(`Missing error.message in: ${JSON.stringify(body)}`);
  }
  if (!err?.requestId) {
    throw new Error(`Missing error.requestId in: ${JSON.stringify(body)}`);
  }
  if (expectedCode && err.code !== expectedCode) {
    throw new Error(
      `Expected code "${expectedCode}", got "${String(err.code)}" in: ${JSON.stringify(body)}`
    );
  }
}

/**
 * Assert that a response body matches the user profile shape:
 * { data: { userId, email, role, createdAt } }
 */
export function assertUserProfileShape(body: unknown): void {
  const b = body as Record<string, unknown>;
  const data = b?.data as Record<string, unknown> | undefined;
  const missing: string[] = [];
  if (!data?.userId) missing.push("data.userId");
  // email may be absent for profiles created via ensureProfile (create-on-first-auth)
  // since Clerk JWT does not include email and the authorizer doesn't pass it
  if (!data?.role) missing.push("data.role");
  if (!data?.createdAt) missing.push("data.createdAt");
  if (missing.length > 0) {
    throw new Error(
      `User profile missing fields [${missing.join(", ")}] in: ${JSON.stringify(body)}`
    );
  }
}

/**
 * Assert HTTP status matches expected value.
 */
export function assertStatus(
  actual: number,
  expected: number,
  context: string
): void {
  if (actual !== expected) {
    throw new Error(`Expected HTTP ${expected}, got ${actual} — ${context}`);
  }
}

/**
 * Assert a response header is present and non-empty.
 */
export function assertHeader(
  headers: Headers,
  name: string,
  context: string
): void {
  const value = headers.get(name);
  if (!value) {
    throw new Error(`Missing response header "${name}" — ${context}`);
  }
}

/**
 * Assert that a response body matches the save shape:
 * { data: { saveId, url, normalizedUrl, urlHash, contentType, tags, createdAt, updatedAt } }
 *
 * Story 3.1.6: Used by saves CRUD smoke scenarios (SC1–SC8).
 */
export function assertSaveShape(
  body: unknown,
  options?: { requireLastAccessedAt?: boolean }
): void {
  const b = body as Record<string, unknown>;
  const data = b?.data as Record<string, unknown> | undefined;
  const missing: string[] = [];
  if (!data?.saveId) missing.push("data.saveId");
  if (!data?.url) missing.push("data.url");
  if (!data?.normalizedUrl) missing.push("data.normalizedUrl");
  if (!data?.urlHash) missing.push("data.urlHash");
  if (typeof data?.contentType !== "string") missing.push("data.contentType");
  if (!Array.isArray(data?.tags)) missing.push("data.tags");
  if (!data?.createdAt) missing.push("data.createdAt");
  if (!data?.updatedAt) missing.push("data.updatedAt");
  if (options?.requireLastAccessedAt && !data?.lastAccessedAt) {
    missing.push("data.lastAccessedAt");
  }
  if (missing.length > 0) {
    throw new Error(
      `Save shape missing fields [${missing.join(", ")}] in: ${JSON.stringify(body)}`
    );
  }
}

/**
 * Build the JWT auth object for smoke test requests.
 * Reads from SMOKE_TEST_CLERK_JWT env var.
 */
export function jwtAuth(): { type: "jwt"; token: string } {
  return { type: "jwt" as const, token: process.env.SMOKE_TEST_CLERK_JWT! };
}

/**
 * Generate a random invalid API key string.
 */
export function randomInvalidKey(): string {
  return `invalid-key-${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Return an object with a fresh Idempotency-Key header.
 * Spread into the `headers` option of client requests.
 */
export function idempotencyKey(): { "Idempotency-Key": string } {
  return { "Idempotency-Key": crypto.randomUUID() };
}

/** Simple sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a save with Idempotency-Key and retry-on-429.
 * Returns { saveId, version, url }.
 */
export async function createSave(
  auth: { type: "jwt"; token: string } | { type: "apikey"; key: string },
  opts?: { url?: string }
): Promise<{ saveId: string; version: number; url: string }> {
  const url =
    opts?.url ??
    `https://example.com/smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await getClient().post(
      "/saves",
      { url },
      { auth, headers: idempotencyKey() }
    );
    if (res.status === 429) {
      if (attempt === maxRetries) {
        throw new Error(`POST /saves still 429 after ${maxRetries} retries`);
      }
      const delayMs = 2000 * (attempt + 1);
      console.log(
        `    ⏳ Rate limited (429) on save creation, retrying in ${delayMs / 1000}s...`
      );
      await sleep(delayMs);
      continue;
    }
    assertStatus(res.status, 201, "createSave: POST /saves");
    const data = (res.body as { data: { saveId: string; version: number } })
      .data;
    return { saveId: data.saveId, version: data.version ?? 1, url };
  }
  throw new Error("createSave: unexpected fallthrough");
}

/**
 * Delete a save with Idempotency-Key. 404 is treated as success (already deleted).
 */
export async function deleteSave(
  saveId: string,
  auth: { type: "jwt"; token: string } | { type: "apikey"; key: string }
): Promise<void> {
  const res = await getClient().delete(`/saves/${saveId}`, {
    auth,
    headers: idempotencyKey(),
  });
  if (res.status !== 204 && res.status !== 404) {
    throw new Error(`deleteSave: expected 204 or 404, got ${res.status}`);
  }
}

/**
 * Assert that a response body matches the standard response envelope:
 * { data: ..., links: { self: string } }
 */
export function assertResponseEnvelope(body: unknown): void {
  const b = body as Record<string, unknown>;
  if (b?.data === undefined) {
    throw new Error(
      `Response envelope missing "data": ${JSON.stringify(body)}`
    );
  }
  const links = b?.links as Record<string, unknown> | undefined;
  if (!links?.self) {
    throw new Error(
      `Response envelope missing "links.self": ${JSON.stringify(body)}`
    );
  }
}

/**
 * Assert cursor pagination shape:
 * { data: [...], meta: { cursor }, links: { self } }
 */
export function assertCursorPagination(body: unknown): void {
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b?.data)) {
    throw new Error(
      `Cursor pagination: "data" is not an array: ${JSON.stringify(body)}`
    );
  }
  const meta = b?.meta as Record<string, unknown> | undefined;
  if (!meta || !("cursor" in meta)) {
    throw new Error(
      `Cursor pagination: missing "meta.cursor": ${JSON.stringify(body)}`
    );
  }
  const links = b?.links as Record<string, unknown> | undefined;
  if (!links?.self) {
    throw new Error(
      `Cursor pagination: missing "links.self": ${JSON.stringify(body)}`
    );
  }
}
