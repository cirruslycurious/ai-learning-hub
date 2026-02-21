/**
 * scripts/smoke-test/types.ts
 * Shared type definitions for the smoke-test runner.
 */

/** Thrown from a scenario's run() to signal a conditional skip (not a failure). */
export class ScenarioSkipped extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ScenarioSkipped";
  }
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  /** Returns the HTTP status code of the key assertion, or 0 if no HTTP call was made (skip). */
  run(): Promise<number>;
}

export type CleanupFn = () => Promise<void>;

export interface Result {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  ms: number;
  httpStatus?: number;
  error?: unknown;
}
