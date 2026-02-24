/**
 * smoke-test/scenarios/index.ts
 * Aggregates all scenario definitions in execution order.
 *
 * Story 3.1.6: Added saves-crud and saves-validation exports.
 * Phase-grouped execution is handled by phases.ts; this file
 * re-exports individual scenario arrays for flexibility.
 */

export { jwtAuthScenarios } from "./jwt-auth.js";
export { apiKeyScenarios, initApiKeyCleanup } from "./api-key-auth.js";
export { routeConnectivityScenarios } from "./route-connectivity.js";
export { userProfileScenarios } from "./user-profile.js";
export { rateLimitingScenarios } from "./rate-limiting.js";
export { savesCrudScenarios, initSavesCrudCleanup } from "./saves-crud.js";
export { savesValidationScenarios } from "./saves-validation.js";

import { jwtAuthScenarios } from "./jwt-auth.js";
import { apiKeyScenarios } from "./api-key-auth.js";
import { routeConnectivityScenarios } from "./route-connectivity.js";
import { userProfileScenarios } from "./user-profile.js";
import { rateLimitingScenarios } from "./rate-limiting.js";
import { savesCrudScenarios } from "./saves-crud.js";
import { savesValidationScenarios } from "./saves-validation.js";

/** Flat list of all scenarios across all phases. */
export const scenarios = [
  ...jwtAuthScenarios,
  ...apiKeyScenarios,
  ...routeConnectivityScenarios,
  ...userProfileScenarios,
  ...rateLimitingScenarios,
  ...savesCrudScenarios,
  ...savesValidationScenarios,
];
