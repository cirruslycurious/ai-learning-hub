/**
 * smoke-test/scenarios/index.ts
 * Aggregates all scenario definitions in execution order.
 */

export { jwtAuthScenarios } from "./jwt-auth.js";
export { apiKeyScenarios, initApiKeyCleanup } from "./api-key-auth.js";
export { routeConnectivityScenarios } from "./route-connectivity.js";
export { userProfileScenarios } from "./user-profile.js";
export { rateLimitingScenarios } from "./rate-limiting.js";

import { jwtAuthScenarios } from "./jwt-auth.js";
import { apiKeyScenarios } from "./api-key-auth.js";
import { routeConnectivityScenarios } from "./route-connectivity.js";
import { userProfileScenarios } from "./user-profile.js";
import { rateLimitingScenarios } from "./rate-limiting.js";

export const scenarios = [
  ...jwtAuthScenarios,
  ...apiKeyScenarios,
  ...routeConnectivityScenarios,
  ...userProfileScenarios,
  ...rateLimitingScenarios,
];
