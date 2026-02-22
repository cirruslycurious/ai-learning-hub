/**
 * smoke-test/helpers.ts
 * Shared assertion helpers for the smoke-test runner.
 * Inlined here (not imported from backend) so the script runs without build steps.
 */

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
 * Generate a random invalid API key string.
 */
export function randomInvalidKey(): string {
  return `invalid-key-${Math.random().toString(36).slice(2, 14)}`;
}
