Adversarial Architecture Review: ai-learning-hub Foundations (Epics 1, 2, 2.1)
Epic-to-Code Mapping
Foundation Area Key Code Locations
Route Registry infra/config/route-registry.ts (81 lines, 5 route entries)
Route Wiring infra/lib/stacks/api/auth-routes.stack.ts (manual wiring, NOT registry-driven)
CDK Entry infra/bin/app.ts (7 stacks, explicit dependency chain)
Shared Middleware backend/shared/middleware/src/wrapper.ts, error-handler.ts, auth.ts
Error Contract backend/shared/types/src/errors.ts (18 error codes, status mapping)
Architecture Tests infra/test/architecture-enforcement/ (T1-T4 + miswiring detection)
Import Enforcement backend/test/import-enforcement.test.ts (T6)
Quality Gate Meta backend/test/quality-gate-self-test.test.ts (coverage threshold scanner)
Handlers backend/functions/ (6 handlers: 4 API + 2 authorizers)
CI Pipeline .github/workflows/ci.yml (10 stages)

1. Foundation Scorecard (0-10)
   Dimension Score Rationale
   Architecture enforceability 7 Route registry + T1-T4 tests are genuinely strong. The miswiring detection test (handler-miswiring-detection.test.ts) is a notable defense. However, AuthRoutesStack does NOT consume the registry programmatically — it hardcodes the same routes independently. The registry is validated by tests but not used as input. This is coincidental alignment, not structural enforcement.
   Test trustworthiness 7 Impressive breadth: T1-T4, T6, T7, handler integration tests, auth contract tests, ADR-008 assertion utility. The miswiring detection is a genuine adversarial test. Weaknesses: the T2/T4 tests validate a test-only CDK synthesis with HANDLER_REF_TO_FUNCTION_NAME mapping, not the real app.ts wiring. CI integration/contract/E2E tests are all placeholders.
   Contract & error correctness 8 ADR-008 is well-implemented. ErrorCode enum with ErrorCodeToStatus mapping, AppError.toApiError(), Gateway Responses with ADR-008 templates, assertADR008Error test utility, and auth-specific contract tests. The normalizeError function ensures even uncaught exceptions conform. This is the strongest dimension.
   Ops/observability readiness 6 Structured JSON logging with X-Ray trace ID extraction, sensitive data redaction, request-scoped logger propagation via wrapHandler. DB logger signature test (AC19) is clever. However: ObservabilityStack exists but dashboard/alarm content is unclear. No test validates that X-Ray is actually enabled on Lambda functions. Authorizer handlers create their own logger outside wrapHandler — no test ensures consistent observability for authorizers.
   Config & environment discipline 7 Table names injected via CDK tableName references (not hardcoded). secrets-scan.test.ts scans for hardcoded AWS identifiers. getAwsEnv() reads from CDK defaults. Clerk secret via SSM Parameter Store. One concern: HANDLER_REF_TO_FUNCTION_NAME contains hardcoded function names that must match the CDK construct names manually.
   Extensibility for future epics 7 The pattern is clear: add entries to ROUTE_REGISTRY, create a new route stack (e.g., SavesRoutesStack), add Lambdas to a new handler stack. HandlerRef union type forces compile-time updates when adding handlers. But the manual wiring in route stacks means every new route requires coordinated changes in 3+ places (registry, route stack, handler stack, test helper HANDLER_REF_TO_FUNCTION_NAME).
   Composite: 7.0 — Solid foundations with specific structural weaknesses that become increasingly dangerous as the route/handler count grows.
2. Invariants Inventory
   MUST-level Invariants
   Invariant 1: Route registry is authoritative — every registry route exists in CDK with correct handler
   Defined: infra/config/route-registry.ts lines 1-6 (JSDoc), ADR-006
   Enforced: T2 (route-completeness.test.ts AC5) validates registry→CDK direction, plus handler identity via HANDLER*REF_TO_FUNCTION_NAME
   Can fail while tests stay green: Yes. The route registry could become incomplete (CDK has routes not in registry) because T2 only checks registry→CDK, not CDK→registry. A developer could add a route in AuthRoutesStack without adding it to the registry, and T2 would pass because it only iterates ROUTE_REGISTRY entries.
   Invariant 2: All non-OPTIONS routes are auth-protected
   Defined: ADR-013, route registry authType field
   Enforced: T1-AC1 (api-gateway-contract.test.ts line 24) checks AuthorizationType != NONE; T3-AC7 checks authorizer type matches registry
   Can fail while tests stay green: Partially. If someone adds a route in AuthRoutesStack with authorizationType: CUSTOM but passes a permissive/broken authorizer, T1 passes (it only checks type != NONE, not that the authorizer actually validates). The actual authorizer logic is tested separately in handler tests, not in T1-T3.
   Invariant 3: ADR-008 error shape is consistent across all error responses
   Defined: ADR-008 in \_bmad-output/planning-artifacts/architecture.md, backend/shared/types/src/errors.ts
   Enforced: wrapHandler catches all errors and passes through handleError→createErrorResponse; assertADR008Error utility used in handler integration tests; Gateway Responses tested in T1-AC2
   Can fail while tests stay green: Yes, if a handler bypasses wrapHandler and returns a raw response with a non-ADR-008 shape. No test enforces that all handlers use wrapHandler.
   Invariant 4: No direct AWS SDK imports in handlers
   Defined: ADR-014, .cursor/rules/architecture-guard.mdc
   Enforced: T6 (import-enforcement.test.ts) scans backend/functions/\*\*/*.ts
   Can fail while tests stay green: No, this is robust. The scanner is regex-based but covers both ESM and CJS patterns, and has negative tests verifying detection. Edge case: dynamic import() would evade the scanner.
   Invariant 5: Coverage >= 80% for all packages
   Defined: ADR-007, vitest configs
   Enforced: Each vitest config has thresholds block; quality-gate-self-test scans configs
   Can fail while tests stay green: Yes. The self-test has a static list of config paths (VITEST*CONFIG_PATHS at quality-gate-self-test.test.ts line 15-23). A new package added without updating this list would have no threshold enforcement, and the self-test would still pass.
   SHOULD-level Invariants
   Invariant 6: All handlers use wrapHandler
   Defined: Implied by ADR-008, middleware pattern
   Enforced: Not enforced by any test or lint rule. Grep confirms all 4 API handlers use it, but nothing prevents a new handler from exporting a raw function.
   Risk: High as handler count grows.
   Invariant 7: Handler ↔ route wiring in app.ts is correct
   Defined: infra/bin/app.ts lines 91-103
   Enforced: Not directly enforced. T2/T4 validate that AuthRoutesStack internally wires functions correctly, but use a test-only synthesis with importFn(depsStack, "ValidateInviteFn") rather than the actual authStack.validateInviteFunction. If someone swaps authStack.usersMeFunction and authStack.apiKeysFunction in app.ts line 101-102, no test catches it.
   Risk: Medium — TypeScript types provide some safety (both are lambda.IFunction), but the swap is type-compatible.
   Invariant 8: HandlerRef union type stays in sync with handlers
   Defined: route-registry.ts lines 22-26
   Enforced: TypeScript compile-time (adding a registry entry with an invalid handlerRef fails compilation). But the reverse — adding a handler to AuthStack without adding its ref to the union — has no enforcement.
   COULD-level Invariants
   Invariant 9: No console.log in handler code
   Defined: Project conventions, .cursor/rules/import-guard.mdc
   Enforced: T6 import-enforcement scans for console.*
   Can fail: Only scans backend/functions/\*\*; shared library code or infra code could use console.
   Invariant 10: Gateway Response status codes match error codes
   Defined: ADR-008
   Enforced: T1-AC2 validates specific templates with hardcoded expectations
   Can fail: If someone adds a new Gateway Response type, T1 wouldn't require it (the list is hardcoded at line 61-66 of api-gateway-contract.test.ts).
3. Adversarial Failure-Mode Tests
   Test 1: Wire /users/me to apiKeysFunction in app.ts
   Change: In infra/bin/app.ts line 101, swap usersMeFunction: authStack.usersMeFunction → usersMeFunction: authStack.apiKeysFunction
   Should catch: T2 (route-completeness), T4 (lambda-route-wiring)
   Would catch: NO. The T2/T4 tests synthesize their own stacks in create-test-api-stacks.ts with independently imported functions. They validate that AuthRoutesStack internally wires usersMeFunction prop to the /users/me resource, but they never validate what app.ts passes as that prop. The swap in app.ts is invisible to these tests. TypeScript won't catch it either since both are lambda.IFunction.
   Test 2: Remove requiredScope from api-keys/handler.ts
   Change: Remove requiredScope: "keys:manage" from backend/functions/api-keys/handler.ts line 136.
   Should catch: Handler unit tests for api-keys
   Would catch: Partially. The api-keys/handler.test.ts tests API key scope behavior but checks it via the mock middleware, not the real wrapHandler options. The handler integration test (handler-integration.test.ts AC15) tests scope enforcement via a separate inline handler, not the actual api-keys handler's options. Removing requiredScope from the real handler would pass all current tests.
   Test 3: Add a route in AuthRoutesStack without registry entry
   Change: Add /admin/dashboard route in auth-routes.stack.ts with apiKeyAuthorizer.
   Should catch: Some "no extra routes outside registry" test
   Would catch: NO. T2 checks registry→CDK (every registry entry exists). There is no CDK→registry check. The route would be deployed without registry tracking. T1-AC1 would check it has an authorizer (which it does), so it would pass.
   Test 4: Bypass wrapHandler in a new handler
   Change: Create backend/functions/new-handler/handler.ts that exports a raw Lambda handler without wrapHandler.
   Should catch: Some "all handlers use wrapHandler" enforcement test
   Would catch: NO. No test or lint rule enforces wrapHandler usage. T6 would catch direct SDK imports and console usage, but not missing middleware wrapping. The handler could return non-ADR-008 error responses without any test failing.
   Test 5: Change Gateway Response status code (THROTTLED from 429 to 500)
   Change: In api-gateway.stack.ts, change the THROTTLED Gateway Response StatusCode from "429" to "500".
   Should catch: T1-AC2 (api-gateway-contract.test.ts line 122-127)
   Would catch: YES. T1-AC2 explicitly checks StatusCode for each response type with hardcoded expected values (THROTTLED: "429" at line 89).
   Test 6: Add direct @aws-sdk/client-dynamodb import in a handler
   Change: Add import { ScanCommand } from "@aws-sdk/client-dynamodb" to backend/functions/users-me/handler.ts.
   Should catch: T6 (import-enforcement.test.ts) and ESLint custom rule
   Would catch: YES. T6's regex scanner explicitly catches this pattern (line 87). The ESLint enforce-shared-imports rule would also flag it.
   Test 7: Remove route from registry but keep stack wiring
   Change: Remove the /users/invite-codes entry from ROUTE_REGISTRY in route-registry.ts.
   Should catch: Route registry tests, T2
   Would catch: PARTIALLY. route-registry.test.ts has a hardcoded check for /users/invite-codes (line 15), which would fail. T2 would pass (fewer registry entries = fewer checks). But if the test was also updated to remove that check, the route would exist in CDK without registry tracking.
   Test 8: Lower coverage threshold to 50% in a shared package
   Change: In backend/shared/middleware/vitest.config.ts, change lines: 80 to lines: 50.
   Should catch: Quality gate self-test (quality-gate-self-test.test.ts)
   Would catch: YES. The self-test scans the vitest config content with regex and asserts thresholds >= 80 (line 107).
   Test 9: Add a new shared package without adding to quality gate config list
   Change: Create backend/shared/new-package/vitest.config.ts with thresholds: { lines: 10 }.
   Should catch: Quality gate self-test
   Would catch: NO. The VITEST_CONFIG_PATHS list at line 15-23 of quality-gate-self-test.test.ts is static. New packages not in this list are invisible to the self-test.
   Test 10: Remove requireAuth: true from users-me/handler.ts
   Change: Change wrapHandler(usersMeHandler, { requireAuth: true }) to wrapHandler(usersMeHandler, {}).
   Should catch: Handler unit tests
   Would catch: YES. The users-me/handler.test.ts tests auth enforcement (missing auth returns 401). With requireAuth removed, wrapHandler would call extractAuthContext (optional) instead of requireAuth (throws). The handler accesses auth!.userId which would crash on null, producing a 500 instead of 401. The test asserting 401 would fail.
   Test 11: Add ALLOW_DEV_AUTH_HEADER=true to a Lambda's environment variables in CDK
   Change: In auth.stack.ts, add ALLOW_DEV_AUTH_HEADER: "true" to any handler's environment.
   Should catch: Some dev-mode check test
   Would catch: NO. The auth module (middleware/src/auth.ts) has dev-mode support gated by process.env.ALLOW_DEV_AUTH_HEADER. No test checks Lambda environment variables for the absence of this dangerous flag. This is a security footgun — setting it in production would allow auth bypass via header.
   Test 12: Add a new ErrorCode without updating ErrorCodeToStatus
   Change: Add TOO_LARGE = "TOO_LARGE" to the ErrorCode enum without adding it to ErrorCodeToStatus.
   Should catch: TypeScript compiler
   Would catch: YES. ErrorCodeToStatus is typed as Record<ErrorCode, number>, so missing a key is a compile error. This is well-designed.
4. Drift Risk Analysis
   Registry vs Stacks — HIGH
   The route registry (route-registry.ts) and the route stack (auth-routes.stack.ts) are independent sources of truth. The stack does NOT import or consume the registry. It manually creates the same routes. Tests validate coincidental alignment, not structural dependency. At 5 routes this is manageable; at 25 routes with multiple route stacks, drift is near-certain. The HANDLER_REF_TO_FUNCTION_NAME map in create-test-api-stacks.ts is a third source of truth that must be manually synced.
   Stacks vs Tests — MEDIUM
   T1-T4 synthesize the real ApiGatewayStack and AuthRoutesStack classes but with test-fabricated inputs (imported function ARNs). They validate stack-internal behavior correctly but miss app.ts wiring errors. The createTestApiStacks helper caches at module level (good for perf), but means all T1-T4 tests share a single synthesis — if the helper setup is wrong, all tests are wrong together.
   Shared Types vs DB Models — LOW
   Entity types in types/src/entities.ts (e.g., UserProfile, ApiKeyItem) are used directly in DB operations (db/src/users.ts). TypeScript enforces consistency. The risk is that DynamoDB is schemaless — the types don't enforce what's actually in the table. But at this scale with a single codebase, this is acceptable.
   Error Codes vs Gateway Responses — LOW
   Gateway Responses are hardcoded in api-gateway.stack.ts with specific codes (UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, INTERNAL_ERROR). These are validated by T1-AC2. The ErrorCodeToStatus mapping is tested by auth contract tests. Low drift risk because Gateway Responses handle a fixed set of non-Lambda error cases.
   Env Config vs Runtime Fallbacks — MEDIUM
   Lambda handlers read table names from process.env.USERS_TABLE_NAME (injected by CDK). The db package's USERS_TABLE_CONFIG reads from process.env.USERS_TABLE_NAME. If CDK injects a different env var name than the DB config expects, the handler silently gets undefined and likely crashes. No test validates that CDK-injected env var names match what the runtime code reads. Additionally, getDefaultClient() silently creates a client with default config — no validation that required env vars are set.
   wrapHandler options vs Route-level auth — MEDIUM
   The route registry declares authType per route. Separately, each handler's wrapHandler call declares requireAuth, requiredRoles, requiredScope. There's no enforcement that these are consistent. For example, users-me/handler.ts has requireAuth: true but no requiredScope, while the route registry says jwt-or-apikey. If a handler sets requireAuth: false for a route the registry claims requires auth, no test catches the mismatch.
5. Hardening Plan (Minimum Effective Work)
   Top 3 Changes
6. Generate route stacks from the registry (or add reverse-direction test)
   Goal: Eliminate the highest-drift-risk issue — registry and stack can diverge silently.
   Files: infra/test/architecture-enforcement/route-completeness.test.ts
   Change: Add a new test "AC6b: No unregistered routes" that iterates all AWS::ApiGateway::Method resources in the routes template and asserts each non-OPTIONS method's path+method exists in ROUTE_REGISTRY. This is the CDK→registry direction that's currently missing.
   New assertion: "Every non-OPTIONS method in CDK templates has a matching ROUTE_REGISTRY entry"
   Prevents: Adversarial test #3 (route added to stack without registry entry), and organic drift as handlers proliferate.
7. Add app.ts wiring integration test
   Goal: Close the gap where T2/T4 miss app.ts prop-passing errors (Adversarial test #1).
   Files: New test in infra/test/stacks/api/ or extend cross-stack-deps.test.ts
   Change: Synthesize the full app (all stacks from app.ts or replicate its wiring), then run the same handler identity checks T2 uses. Alternatively, add a simpler assertion: for each entry in ROUTE_REGISTRY, check that authStack[entry.handlerRef] exists and is a Lambda function, and that it's passed to the correct route stack.
   New assertion: "For each registry entry, authStack.<handlerRef> is passed to the route stack as the <handlerRef> prop"
   Prevents: Adversarial test #1 (swapped handler props in app.ts).
8. Enforce wrapHandler usage in all API handlers
   Goal: Prevent ADR-008 bypass and auth/logging regression (Adversarial tests #4, #3).
   Files: backend/test/import-enforcement.test.ts (extend T6)
   Change: Add a scan that every handler.ts file in backend/functions/_/ that is NOT an authorizer (_-authorizer) exports a handler binding that matches the pattern wrapHandler(. Regex: export\s+const\s+handler\s*=\s*wrapHandler\(. Authorizer handlers are explicitly exempt.
   New assertion: "Every API handler exports handler = wrapHandler(...)"
   Prevents: Adversarial test #4 (handler bypassing wrapHandler), guarantees ADR-008/logging/auth for all future handlers.
   Next 5 Changes
9. Make VITEST_CONFIG_PATHS self-discovering
   Goal: Prevent silently uncovered packages (Adversarial test #9).
   Files: backend/test/quality-gate-self-test.test.ts
   Change: Replace the static VITEST_CONFIG_PATHS array with a glob scan (backend/shared/\*/vitest.config.ts, backend/vitest.config.ts, infra/vitest.config.ts). Assert that every discovered config has 80% thresholds.
   Prevents: New shared packages silently skipping coverage enforcement.
10. Add ALLOW_DEV_AUTH_HEADER CDK environment audit
    Goal: Prevent dev-mode auth bypass reaching production (Adversarial test #11).
    Files: infra/test/stacks/auth/auth.stack.test.ts
    Change: Add assertion that no Lambda function in AuthStack has ALLOW_DEV_AUTH_HEADER in its environment variables. If the env var is needed for dev, gate it behind a CDK context flag and test that production stage doesn't set it.
    Prevents: Accidental or AI-introduced dev auth bypass in deployed Lambdas.
11. Add wrapHandler options vs registry auth-type consistency test
    Goal: Prevent handler-level auth options from contradicting registry declarations (Drift risk: wrapHandler options vs route-level auth).
    Files: New test in backend/test/
    Change: For each backend/functions/\*/handler.ts, parse the wrapHandler options (requireAuth, requiredScope) and cross-reference with the handler's corresponding ROUTE_REGISTRY entry. Assert that requireAuth: true is set for all non-public routes; assert requiredScope is present for routes that should have scope restrictions.
    Prevents: Adversarial test #2 (removing requiredScope silently).
12. Fill CI integration/contract test stages or fail them
    Goal: Placeholder stages that echo success are invisible debt that creates false confidence.
    Files: .github/workflows/ci.yml stages 5-6
    Change: Either implement minimal smoke tests (e.g., CDK synth + stack output validation for integration; error response schema validation for contract) or change the placeholder stages to continue-on-error: true with explicit "PLACEHOLDER" warnings. Currently they report success, which is misleading.
    Prevents: False CI green masking missing test categories.
13. Add HANDLER_REF_TO_FUNCTION_NAME consistency test
    Goal: Eliminate the third source of truth in the test helper.
    Files: infra/test/helpers/create-test-api-stacks.ts, new test or extension of route-registry.test.ts
    Change: Add a test that validates every key in HANDLER_REF_TO_FUNCTION_NAME matches a HandlerRef in the registry, and every HandlerRef in the registry has a key in the map. Also validate that the function names in the map match the actual function names set in AuthStack (by synthesizing the real AuthStack and checking Lambda function names).
    Prevents: HANDLER_REF_TO_FUNCTION_NAME drifting from registry or from actual stack outputs, which would make T2/T4 tests validate against wrong expectations.
    Summary Verdict
    The foundations are better than most solo-built projects at this stage. The route registry + T1-T4 architecture enforcement pattern is genuinely thoughtful. The ADR-008 error contract is well-implemented and well-tested. The wrapHandler middleware correctly forces logging, auth, and error handling for handlers that use it. The quality gate self-test is a clever meta-enforcement.
    The critical weakness is structural: the route registry is not consumed by the code it claims to govern. It's validated by tests that operate on a parallel CDK synthesis, not the real deployment wiring. At 5 routes, this works because humans can eyeball it. At 25 routes across 4+ route stacks, manual coordination of registry entries, route stack code, handler stack exports, app.ts wiring, and the test helper's function name map becomes the dominant source of deployment bugs.
    The top 3 hardening changes (reverse-direction route test, app.ts wiring test, wrapHandler enforcement) would close the most dangerous gaps with surgical changes totaling perhaps 150 lines of test code. Until those are in place, the repo can scale carefully but not confidently.
