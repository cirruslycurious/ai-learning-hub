#!/usr/bin/env tsx
/**
 * scripts/smoke-test/run.ts
 * Deployed environment smoke test runner.
 *
 * Validates the real Clerk → API Gateway → Lambda → DynamoDB chain.
 * NOT part of the vitest test suite. Run with: npm run smoke-test
 *
 * Required env vars: SMOKE_TEST_API_URL
 * JWT auth (one of):
 *   --auto-auth                 Programmatic JWT via Clerk Backend API (recommended)
 *   SMOKE_TEST_CLERK_JWT        Pre-set JWT token (manual)
 *
 * Auto-auth requires:
 *   SMOKE_TEST_CLERK_USER_ID    Clerk user ID for the test user
 *   CLERK_SECRET_KEY            (optional — fetched from AWS SSM if not set)
 *
 * Optional:  SMOKE_TEST_ADMIN_JWT, SMOKE_TEST_EXPIRED_JWT,
 *            SMOKE_TEST_RATE_LIMIT_JWT, SMOKE_TEST_SKIP
 * See: scripts/smoke-test/.env.smoke.example
 *
 * Phase support (Story 3.1.6):
 *   npm run smoke-test -- --auto-auth             # all phases, auto JWT
 *   npm run smoke-test -- --auto-auth --phase=1   # Phase 1 only
 *   npm run smoke-test -- --auto-auth --phase=2   # Phase 2 only
 *   npm run smoke-test -- --auto-auth --up-to=2   # Phases 1 and 2
 */

import { getFilteredPhases } from "./phases.js";
import { ScenarioSkipped } from "./types.js";
import type { CleanupFn, Result } from "./types.js";

// ─── CLI flags ───────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);
const useAutoAuth = cliArgs.includes("--auto-auth");

// ─── Startup validation & auto-auth ─────────────────────────────────────────

// AC19: Exit immediately if required env vars are not set
if (!process.env.SMOKE_TEST_API_URL) {
  console.error(
    "SMOKE_TEST_API_URL is required. See scripts/smoke-test/.env.smoke.example"
  );
  process.exit(1);
}

if (useAutoAuth) {
  // Lazy import to avoid pulling in @clerk/backend and @aws-sdk/client-ssm
  // when not using auto-auth
  const { autoFetchJwt } = await import("./auto-auth.js");
  try {
    await autoFetchJwt();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Auto-auth failed: ${msg}\n`);
    process.exit(1);
  }
}

if (!process.env.SMOKE_TEST_CLERK_JWT) {
  console.error(
    "SMOKE_TEST_CLERK_JWT is required.\n" +
      "  Either set it in .env.smoke, or use --auto-auth with SMOKE_TEST_CLERK_USER_ID.\n" +
      "  See: scripts/smoke-test/.env.smoke.example"
  );
  process.exit(1);
}

// ─── Cleanup registry ─────────────────────────────────────────────────────────

const cleanups: CleanupFn[] = [];

function registerCleanup(fn: CleanupFn): void {
  cleanups.push(fn);
}

async function runCleanups(): Promise<void> {
  for (const fn of [...cleanups].reverse()) {
    try {
      await fn();
    } catch {
      // Cleanup errors are non-fatal
    }
  }
}

// ─── Skip logic (AC20) ────────────────────────────────────────────────────────

const skipSet = new Set(
  (process.env.SMOKE_TEST_SKIP ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// ─── Results table (AC17) ─────────────────────────────────────────────────────

function printTable(results: Result[]): void {
  const COL = { id: 6, name: 58, status: 6, http: 6, ms: 8 };
  const hr = `${"─".repeat(COL.id + 2)}┼${"─".repeat(COL.name + 2)}┼${"─".repeat(COL.status + 2)}┼${"─".repeat(COL.http + 2)}┼${"─".repeat(COL.ms + 2)}`;

  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  const padL = (s: string, n: number) => s.slice(0, n).padStart(n);

  console.log();
  console.log(
    ` ${"ID".padEnd(COL.id)} │ ${"Scenario".padEnd(COL.name)} │ ${"Status".padEnd(COL.status)} │ ${"HTTP".padStart(COL.http)} │ ${"ms".padStart(COL.ms)} `
  );
  console.log(hr);

  for (const r of results) {
    const statusSymbol =
      r.status === "PASS"
        ? "✅ PASS"
        : r.status === "FAIL"
          ? "❌ FAIL"
          : "⏭  SKIP";
    const http = r.httpStatus != null ? String(r.httpStatus) : "—";
    const ms = r.ms > 0 ? String(r.ms) : "—";
    console.log(
      ` ${pad(r.id, COL.id)} │ ${pad(r.name, COL.name)} │ ${pad(statusSymbol, COL.status + 2)} │ ${padL(http, COL.http)} │ ${padL(ms, COL.ms)} `
    );
    if ((r.status === "FAIL" || r.status === "SKIP") && r.error) {
      const msg = r.error instanceof Error ? r.error.message : String(r.error);
      console.log(`         ↳ ${msg}`);
    }
  }

  console.log(hr);

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  const total = results.length;
  const elapsed = results.reduce((sum, r) => sum + (r.ms || 0), 0);

  console.log(
    `\n  ${passed}/${total} scenarios passed  (${failed} failed, ${skipped} skipped)  ${elapsed}ms total\n`
  );
}

// ─── Main runner ──────────────────────────────────────────────────────────────

const selectedPhases = getFilteredPhases(cliArgs);

// Initialize cleanup registry for each selected phase
for (const phase of selectedPhases) {
  if (phase.init) {
    phase.init(registerCleanup);
  }
}

const results: Result[] = [];

try {
  for (const phase of selectedPhases) {
    console.log(`\n── Phase ${phase.id}: ${phase.name} ──`);

    for (const scenario of phase.scenarios) {
      if (skipSet.has(scenario.id)) {
        results.push({
          id: scenario.id,
          name: scenario.name,
          status: "SKIP",
          ms: 0,
        });
        continue;
      }

      const start = Date.now();
      try {
        const httpStatus = await scenario.run();
        results.push({
          id: scenario.id,
          name: scenario.name,
          status: "PASS",
          ms: Date.now() - start,
          httpStatus: httpStatus > 0 ? httpStatus : undefined,
        });
      } catch (err) {
        if (err instanceof ScenarioSkipped) {
          results.push({
            id: scenario.id,
            name: scenario.name,
            status: "SKIP",
            ms: Date.now() - start,
            error: err,
          });
        } else {
          results.push({
            id: scenario.id,
            name: scenario.name,
            status: "FAIL",
            ms: Date.now() - start,
            error: err,
          });
        }
      }
    }
  }
} finally {
  // AC18: Clean up any resources created during the run
  await runCleanups();
}

printTable(results);

// AC17: Exit code 0 if all pass, 1 if any fail
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
