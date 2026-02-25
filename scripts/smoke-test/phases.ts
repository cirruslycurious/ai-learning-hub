/**
 * smoke-test/phases.ts
 * Phase registry for grouped scenario execution.
 *
 * Story 3.1.6: Introduces phase-based grouping with --phase=N and --up-to=N support.
 *
 * Phase numbering:
 *   Phase 1: Infrastructure & Auth (existing AC1–AC14)
 *   Phase 2: Saves CRUD Lifecycle (SC1–SC8)
 *   Phase 3: (reserved for future)
 *   Phase 4: Saves Validation Errors (SV1–SV4)
 *   Phases 5–6: (reserved for future)
 *   Phase 7: EventBridge Verification (EB1–EB3)
 */

import type { ScenarioDefinition, CleanupFn } from "./types.js";

export interface Phase {
  /** Phase number (1, 2, 3, ...) */
  id: number;
  /** Human-readable phase name */
  name: string;
  /** Scenarios in execution order */
  scenarios: ScenarioDefinition[];
  /** Optional init function called before phase runs (e.g., to wire cleanup registry) */
  init?: (registerCleanup: (fn: CleanupFn) => void) => void;
}

// Lazy imports to avoid circular dependencies — phases are populated at import time
import { jwtAuthScenarios } from "./scenarios/jwt-auth.js";
import {
  apiKeyScenarios,
  initApiKeyCleanup,
} from "./scenarios/api-key-auth.js";
import { routeConnectivityScenarios } from "./scenarios/route-connectivity.js";
import { userProfileScenarios } from "./scenarios/user-profile.js";
import { rateLimitingScenarios } from "./scenarios/rate-limiting.js";
import {
  savesCrudScenarios,
  initSavesCrudCleanup,
} from "./scenarios/saves-crud.js";
import { savesValidationScenarios } from "./scenarios/saves-validation.js";
import {
  eventBridgeVerifyScenarios,
  initEventBridgeCleanup,
} from "./scenarios/eventbridge-verify.js";

export const phases: Phase[] = [
  {
    id: 1,
    name: "Infrastructure & Auth",
    scenarios: [
      ...jwtAuthScenarios,
      ...apiKeyScenarios,
      ...routeConnectivityScenarios,
      ...userProfileScenarios,
      ...rateLimitingScenarios,
    ],
    init: (registerCleanup) => {
      initApiKeyCleanup(registerCleanup);
    },
  },
  {
    id: 2,
    name: "Saves CRUD Lifecycle",
    scenarios: [...savesCrudScenarios],
    init: (registerCleanup) => {
      initSavesCrudCleanup(registerCleanup);
    },
  },
  // Phase 3 reserved for future use
  {
    id: 4,
    name: "Saves Validation Errors",
    scenarios: [...savesValidationScenarios],
  },
  // Phases 5–6 reserved for future use
  {
    id: 7,
    name: "EventBridge Verification",
    scenarios: [...eventBridgeVerifyScenarios],
    init: (registerCleanup) => {
      initEventBridgeCleanup(registerCleanup);
    },
  },
];

/**
 * Get phases filtered by --phase=N or --up-to=N CLI args.
 *
 * --phase=N  → run only phase N
 * --up-to=N  → run phases 1 through N (inclusive)
 * (neither)  → run all phases
 */
export function getFilteredPhases(args: string[]): Phase[] {
  const phaseArg = args.find((a) => a.startsWith("--phase="));
  const upToArg = args.find((a) => a.startsWith("--up-to="));

  if (phaseArg && upToArg) {
    console.error(
      "Cannot use both --phase and --up-to. Provide one or the other."
    );
    process.exit(1);
  }

  if (phaseArg) {
    const phaseId = parseInt(phaseArg.split("=")[1], 10);
    if (isNaN(phaseId)) {
      console.error(
        `Invalid --phase value: "${phaseArg.split("=")[1]}". Must be a number.`
      );
      process.exit(1);
    }
    const found = phases.filter((p) => p.id === phaseId);
    if (found.length === 0) {
      console.error(
        `Phase ${phaseId} not found. Available: ${phases.map((p) => p.id).join(", ")}`
      );
      process.exit(1);
    }
    return found;
  }

  if (upToArg) {
    const upToId = parseInt(upToArg.split("=")[1], 10);
    if (isNaN(upToId)) {
      console.error(
        `Invalid --up-to value: "${upToArg.split("=")[1]}". Must be a number.`
      );
      process.exit(1);
    }
    const filtered = phases.filter((p) => p.id <= upToId);
    if (filtered.length === 0) {
      console.error(
        `No phases found with id <= ${upToId}. Available: ${phases.map((p) => p.id).join(", ")}`
      );
      process.exit(1);
    }
    return filtered;
  }

  return phases;
}
