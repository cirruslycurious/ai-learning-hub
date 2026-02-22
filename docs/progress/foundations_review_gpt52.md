1. Foundation Scorecard (0–10)
   Epic-to-code map (evidence)
   Epic 1 (repo/quality foundations): CI + gates in .github/workflows/ci.yml; workspace gates in package.json; coverage threshold “self-test” in backend/test/quality-gate-self-test.test.ts; shared libs in backend/shared/_ (e.g. backend/shared/middleware/src/wrapper.ts, backend/shared/types/src/errors.ts, backend/shared/logging/src/logger.ts).
   Epic 2 (auth + core user routes): authorizers and handlers in backend/functions/{jwt-authorizer,api-key-authorizer,users-me,api-keys,validate-invite,invite-codes}; wiring surfaces in infra/lib/stacks/auth/auth.stack.ts and infra/lib/stacks/api/auth-routes.stack.ts.
   Epic 2.1 (API Gateway + enforcement tests): route registry in infra/config/route-registry.ts; API Gateway stack in infra/lib/stacks/api/api-gateway.stack.ts; architecture enforcement in infra/test/architecture-enforcement/{api-gateway-contract,route-completeness,authorizer-type-correctness,lambda-route-wiring,handler-miswiring-detection}.test.ts.
   Architecture enforceability: 7/10
   Strong: route registry exists and multiple CDK-template tests compare synthesized templates to it (T1–T4 under infra/test/architecture-enforcement/_). Example registry claim:
   route-registry.ts
   Lines 1-20
   /\*\* _ Route Registry — Canonical source of truth for all API routes. _ _ Each epic adds entries here; architecture enforcement tests (T1-T4 in D5) _ validate that CDK resources match this registry. Route stacks consume this _ registry to wire API Gateway resources. _ _ Auth types: _ - "jwt" → JWT authorizer only (Clerk token) _ - "jwt-or-apikey" → JWT authorizer with API key fallback _ - "iam" → AWS IAM auth (internal pipelines) _ - "admin" → JWT + admin role check _ - "analyst" → JWT + admin-or-analyst role check \*/export type AuthType = "jwt" | "jwt-or-apikey" | "iam" | "admin" | "analyst";
   Weak: the route stacks are still manually authored (e.g. AuthRoutesStack hardcodes resources/methods) and tests primarily enforce registry ⊆ stacks, not stacks ⊆ registry (see T2/T3 behavior: they look up registryEntry and continue when absent in authorizer-type-correctness.test.ts).
   Test trustworthiness: 6/10
   Strong: the repo includes “negative tests” that prove the detector trips (e.g. miswiring fixture infra/test/architecture-enforcement/handler-miswiring-detection.test.ts; import scanner negative tests in backend/test/import-enforcement.test.ts).
   Weak: several “gates” are placeholders (CI “integration-tests” and “contract-tests” jobs just echo success in .github/workflows/ci.yml), so green CI does not mean integration/contract coverage exists.
   Contract & error correctness: 5/10
   Strong: handler-side ADR-008 error envelope is implemented (AppError.toApiError() in backend/shared/types/src/errors.ts, createErrorResponse() in backend/shared/middleware/src/error-handler.ts) and asserted via backend/test-utils/assert-adr008.ts plus multiple handler tests (e.g. backend/functions/users-me/handler.test.ts).
   Weak: API Gateway “gateway responses” are hardcoded to generic codes (UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, INTERNAL_ERROR) in infra/lib/stacks/api/api-gateway.stack.ts and only validate those (T1). Anything denied at authorizer/gateway layer can’t carry domain-specific codes like INVITE_REQUIRED to clients.
   Ops/observability readiness: 4/10
   Strong: structured logger exists (backend/shared/logging/src/logger.ts) and API Gateway tracing is enabled (tracingEnabled: true in infra/lib/stacks/api/api-gateway.stack.ts).
   Weak: Observability stack currently only creates an X-Ray sampling rule; dashboards/alarms are explicitly “Future” comments (infra/lib/stacks/observability/observability.stack.ts). API Gateway access logging is explicitly suppressed as “future” (NagSuppressions reasons in infra/lib/stacks/api/api-gateway.stack.ts).
   Config & environment discipline: 5/10
   Strong: frontend client hard-fails if VITE_API_URL missing (frontend/src/api/hooks.ts), secret fetch enforces required env var (CLERK_SECRET_KEY_PARAM in backend/shared/middleware/src/ssm.ts).
   Weak: auth middleware contains an explicit dev-bypass header gated only by an env var (ALLOW_DEV_AUTH_HEADER) with no infra-level guard shown here; if set in prod, it’s an auth bypass:
   auth.ts
   Lines 62-74
   // For development/testing: only when explicitly allowed. // Production must NOT set ALLOW_DEV_AUTH_HEADER (Lambda does not set NODE_ENV by default). const allowDevAuth = process.env.ALLOW_DEV_AUTH_HEADER === "true" || process.env.ALLOW_DEV_AUTH_HEADER === "1"; const devUserId = allowDevAuth ? event.headers["x-dev-user-id"] : undefined; if (devUserId) { return { userId: devUserId, roles: ["user"], isApiKey: false, }; }
   Extensibility for future epics: 6/10
   Strong: CDK stack decomposition is real, with explicit ordering and dependency tests (infra/test/stacks/api/cross-stack-deps.test.ts checks infra/bin/app.ts instantiation order and specific wiring strings).
   Weak: scaling from ~5 routes to “dozens” increases the manual duplication burden (registry + route stack code + handlerRef typing + test helper mapping). Missing an “extra routes not in registry” assertion makes drift more likely as route count grows.
2. Invariants Inventory (Must/Should/Could)
   Must
   Invariant: CI enforces lint + format + type-check + tests + CDK synth.
   Defined: .github/workflows/ci.yml; package.json scripts.
   Enforced: test/ci-workflow.test.ts (validates job presence/order); CI jobs execute npm run format:check, npm run lint, npm run type-check, npm test -- --coverage, npx cdk synth.
   How it could fail green: “integration-tests” and “contract-tests” are placeholders that always pass (echo), so “CI green” can still mean no integration/contract coverage.
   Invariant: Coverage thresholds
   ≥
   80
   ≥80 for multiple packages can’t be silently lowered.
   Defined: vitest configs vitest.config.ts, backend/vitest.config.ts, infra/vitest.config.ts, etc.
   Enforced: backend/test/quality-gate-self-test.test.ts parses those configs and fails if thresholds missing or <80.
   How it could fail green: you can keep thresholds at 80 but exclude key paths from coverage via exclude lists in vitest configs; the self-test does not validate exclusion scope is reasonable.
   Invariant: Handlers in backend/functions/\*_ do not directly import DynamoDB SDK or validation libs; no console._ in handlers.
   Defined: planning requirement FR80 in \_bmad-output/planning-artifacts/epics.md (explicitly calls out ESLint enforcement).
   Enforced: ESLint local rule local-rules/enforce-shared-imports in eslint.config.js; plus a hard test scanner backend/test/import-enforcement.test.ts.
   How it could fail green: dynamic imports/indirection bypass the scanners (e.g. await import("@aws-sdk/client-dynamodb") or const { log } = console; log("x")), because the test scanner matches from "..." and console.<method> patterns only.
   Invariant: Every non-OPTIONS API Gateway method is auth-protected (AuthorizationType != NONE).
   Defined: .claude/docs/api-gateway-conventions.md (“Auth Domains”, “Mandatory Conventions”); docstrings in T1 (infra/test/architecture-enforcement/api-gateway-contract.test.ts).
   Enforced: infra/test/architecture-enforcement/api-gateway-contract.test.ts checks both ApiGatewayStack and AuthRoutesStack methods.
   How it could fail green: you can add an extra route/method with CUSTOM auth but attach the wrong authorizer; if it’s not in ROUTE_REGISTRY, T3 won’t validate the authorizer type for it.
   Should
   Invariant: Route registry is authoritative (no route drift; no “mystery routes”).
   Defined: infra/config/route-registry.ts comment (“Canonical source of truth”); .claude/docs/api-gateway-conventions.md (“Canonical source of truth: infra/config/route-registry.ts”).
   Enforced: partially by T2/T3/T4 (they validate registry entries exist in templates and match certain properties).
   How it could fail green: adding a new API Gateway method/resource in infra/lib/stacks/api/auth-routes.stack.ts without adding it to ROUTE_REGISTRY is not asserted today (T2 validates registry→stack; not stack→registry). This is a direct “route drift” path.
   Invariant: Wrong-handler wiring is detected.
   Defined: T2 comments (“correct handler Lambda”) and the explicit miswiring test intent in infra/test/architecture-enforcement/handler-miswiring-detection.test.ts.
   Enforced: infra/test/architecture-enforcement/route-completeness.test.ts + handler-miswiring-detection.test.ts.
   How it could fail green: any route not present in ROUTE_REGISTRY will not be covered by the handler-identity check (because expected mapping is registry-driven).
   Invariant: ADR-008 error envelope is consistent for Lambda-thrown errors.
   Defined: .claude/docs/api-patterns.md (“Error Response Shape (ADR-008)”); backend/shared/types/src/errors.ts (AppError.toApiError); backend/shared/middleware/src/error-handler.ts.
   Enforced: backend/test-utils/assert-adr008.ts used in handler tests (e.g. backend/functions/users-me/handler.test.ts).
   How it could fail green: wrapHandler() explicitly passes through already-shaped API Gateway results (isApiGatewayResult), so a handler can return a non-ADR-008 error body and bypass normalization; unless a test asserts body shape for that path, it stays green.
   Could
   Invariant: Auth type semantics match real behavior (“jwt-or-apikey” means JWT works).
   Defined: infra/config/route-registry.ts (authType docs); .claude/docs/api-gateway-conventions.md (“JWT-or-API-Key Authorizer Pattern”).
   Enforced: only at CDK-template level (T3 checks correct authorizer type attached), not at runtime semantics.
   How it could fail green (and currently does): routes marked jwt-or-apikey are wired to the REQUEST authorizer (apiKeyAuthorizer) in AuthRoutesStack, but backend/functions/api-key-authorizer/handler.ts rejects missing x-api-key and does not process JWTs. That makes “JWT fallback” absent.
3. Adversarial Failure-Mode Tests
   Below are “break the repo” changes that should fail CI, plus whether they actually would today.
   Wire /users/me GET to the apiKeysFunction integration
   Exact change: in infra/lib/stacks/api/auth-routes.stack.ts, change new apigateway.LambdaIntegration(usersMeFunction) to ... (apiKeysFunction) for /users/me methods.
   Should be caught by: infra/test/architecture-enforcement/route-completeness.test.ts (T2 AC5).
   Would it catch?: Yes (handler identity check compares expected function name per handlerRef; plus handler-miswiring-detection.test.ts proves this class of bug is detectable).
   Change /auth/validate-invite to use the API key authorizer
   Exact change: in AuthRoutesStack, swap authorizer: jwtAuthorizer → apiKeyAuthorizer for validate-invite.
   Should be caught by: infra/test/architecture-enforcement/authorizer-type-correctness.test.ts (T3).
   Would it catch?: Yes (T3 maps authorizers by Name and checks per registry path+method).
   Remove an OPTIONS preflight from one resource
   Exact change: delete one addCorsPreflight(corsOptions) call in infra/lib/stacks/api/auth-routes.stack.ts.
   Should be caught by: infra/test/architecture-enforcement/api-gateway-contract.test.ts (T1 AC3).
   Would it catch?: Yes (asserts every AWS::ApiGateway::Resource has an OPTIONS method).
   Delete one gateway response template field (e.g. remove requestId)
   Exact change: in infra/lib/stacks/api/api-gateway.stack.ts, remove requestId: "$context.requestId" from gateway response templates.
   Should be caught by: infra/test/architecture-enforcement/api-gateway-contract.test.ts (T1 AC2).
   Would it catch?: Yes (parses JSON template and asserts .error.requestId exists).
   Lower coverage thresholds to 60 in any vitest config
   Exact change: edit thresholds: { lines: 60, ... } in infra/vitest.config.ts (or any listed config).
   Should be caught by: backend/test/quality-gate-self-test.test.ts.
   Would it catch?: Yes (regex parser asserts all metrics exist and are >=80).
   Import @aws-sdk/client-dynamodb directly inside a handler
   Exact change: add import { DynamoDBClient } from "@aws-sdk/client-dynamodb" to backend/functions/users-me/handler.ts.
   Should be caught by: backend/test/import-enforcement.test.ts (T6) and eslint.config.js local rule.
   Would it catch?: Yes (scanner explicitly checks from "@aws-sdk/client-dynamodb").
   Add a “mystery route” in AuthRoutesStack but don’t add it to ROUTE_REGISTRY
   Exact change: in infra/lib/stacks/api/auth-routes.stack.ts, add /users/debug GET wired to any Lambda; do not touch infra/config/route-registry.ts.
   Should be caught by: “route registry is authoritative” enforcement (claimed in docs).
   Would it catch?: No (no test asserts stacks ⊆ registry; T2/T3/T4 are registry-driven and will ignore unmatched methods).
   Mark a route as authType: "admin" in ROUTE_REGISTRY but don’t add role enforcement in the handler
   Exact change: set one route’s authType to "admin" in infra/config/route-registry.ts but keep handler wrapper wrapHandler(...,{requireAuth:true}).
   Should be caught by: auth regression tests.
   Would it catch?: No (T3 maps "admin" → JWT authorizer attachment only; it does not verify handler role checks. Nothing scans wrapHandler options against registry authType).
   Make a handler return a non-ADR-008 error response by bypassing AppError
   Exact change: in some handler, return { statusCode: 400, body: "bad" } (already an APIGatewayProxyResult).
   Should be caught by: ADR-008 contract tests.
   Would it catch?: Maybe / only if a specific handler test asserts ADR-008 for that path. wrapHandler explicitly passes through API Gateway results without normalization.
   Enable the dev auth bypass in production via env
   Exact change: set ALLOW_DEV_AUTH_HEADER=true in Lambda environment (or deployment config) and send x-dev-user-id.
   Should be caught by: config discipline / security gates.
   Would it catch?: No (no infra test asserts it is never set; no runtime guard ties it to stage).
4. Drift Risk Analysis
   Registry vs route stacks: High
   Why: infra/config/route-registry.ts claims canonical, but infra/lib/stacks/api/auth-routes.stack.ts is manually authored and does not derive its routes from the registry. Current tests enforce registry→template matching, not “no extra routes”.
   Route stacks vs composition (infra/bin/app.ts): Medium
   Why: miswiring at composition is partially guarded by substring-based tests in infra/test/stacks/api/cross-stack-deps.test.ts (checks that usersMeFunction: authStack.usersMeFunction appears in source). This is brittle: refactors can invalidate checks without changing semantics, and it doesn’t scale cleanly to many stacks/props.
   Auth intent (jwt-or-apikey) vs runtime authorizer behavior: High
   Why: route wiring uses the REQUEST authorizer for /users/\*:
   auth-routes.stack.ts
   Lines 101-112
   // /users/me (AC8) -- JWT or API Key const usersMeResource = usersResource.addResource("me"); usersMeResource.addCorsPreflight(corsOptions); for (const method of ["GET", "PATCH"]) { usersMeResource.addMethod( method, new apigateway.LambdaIntegration(usersMeFunction), { authorizer: apiKeyAuthorizer, authorizationType: apigateway.AuthorizationType.CUSTOM, } ); }
   But the authorizer rejects missing x-api-key:
   handler.ts
   Lines 42-54
   const headerKey = Object.keys(event.headers || {}).find( (k) => k.toLowerCase() === "x-api-key" ); const apiKey = headerKey ? event.headers?.[headerKey] : undefined; if (!apiKey) { logger.warn("Missing x-api-key header"); throw new Error("Unauthorized"); }
   Impact: the “JWT fallback” is not present; expanding routes will amplify confusion and regression risk.
   Error codes vs gateway responses: Medium
   Why: ErrorCode enum includes fine-grained auth codes (e.g. INVITE_REQUIRED, SUSPENDED_ACCOUNT in backend/shared/types/src/errors.ts), but API Gateway gateway responses only emit coarse codes (e.g. FORBIDDEN) in infra/lib/stacks/api/api-gateway.stack.ts. Anything rejected at gateway/authorizer layer cannot preserve those codes.
   Observability docs vs actual infra: Medium
   Why: .claude/docs/observability.md describes dashboards/alarms/EMF patterns; infra/lib/stacks/observability/observability.stack.ts currently only provisions an X-Ray sampling rule.
   Env config vs runtime fallbacks: Medium
   Why: explicit dev bypass in middleware (ALLOW_DEV_AUTH_HEADER) is a production footgun unless deployment-time constraints exist. No shown enforcement ties it to “dev only.”
5. Hardening Plan (Minimum Effective Work)
   Top 3 changes (surgical, not rewrites)
   Make the route registry authoritative in both directions*
   Goal: prevent “mystery routes” and route drift as route count grows.
   Files to touch: add/extend tests in infra/test/architecture-enforcement/ (extend T2 or add a new test).
   New assertion/gate: enumerate every non-OPTIONS AWS::ApiGateway::Method in the routes templates and assert it maps to exactly one ROUTE_REGISTRY entry (path+method). Fail on extras.
   Prevents: (1) route drift (stack-only routes), (2) wrong-handler wiring on unregistered routes.
   Fix the jwt-or-apikey semantic mismatch
   Goal: ensure /users/* routes actually accept JWTs (as the registry + docs claim).
   Files to touch: backend/functions/api-key-authorizer/handler.ts and/or infra/lib/stacks/api/auth-routes.stack.ts (choose one consistent strategy).
   New assertion/gate: add a runtime-level test (backend) that constructs a request-authorizer event with an Authorization header and proves it returns Allow with context.authMethod="jwt" (or, if you decide not to support JWT there, change route wiring/tests/docs to stop claiming it).
   Prevents: (3) auth regression, plus reduces confusion when scaling routes.
   Close the “dev auth header” production bypass
   Goal: remove/contain a trivial auth bypass that can be enabled by env drift.
   Files to touch: backend/shared/middleware/src/auth.ts and infra stack env injection sites (if any) or add infra tests.
   New assertion/gate: infra test that scans synthesized Lambda environments (or infra/bin/app.ts/stack code) and asserts ALLOW_DEV_AUTH_HEADER is never set; optionally require STAGE==="dev" to enable it.
   Prevents: (5) configuration footguns leading to auth bypass.
   Next 5 changes
   Enforce “admin/analyst” invariants end-to-end (when those routes appear)
   Goal: prevent role-check regressions that T3 explicitly doesn’t cover (it maps admin/analyst to JWT authorizer only).
   Files to touch: infra/test/architecture-enforcement/authorizer-type-correctness.test.ts (or new test) + handler wrappers.
   New assertion/gate: for registry entries with authType: "admin" | "analyst", assert corresponding handler uses wrapHandler(...,{requiredRoles:[...]}) or equivalent (you’ll need a handlerRef→file mapping).
   Prevents: (3) auth regression on privileged routes.
   Harden import enforcement against easy bypasses
   Goal: prevent await import("@aws-sdk/client-dynamodb") / console destructuring bypass.
   Files to touch: backend/test/import-enforcement.test.ts and/or scripts/eslint-rules/enforce-shared-imports.js.
   New assertion/gate: scan for import("...") and for console identifier usage patterns (destructuring, aliasing).
   Prevents: architecture erosion as codebase grows.
   Add a “pass-through response” ADR-008 contract test
   Goal: prevent handlers from bypassing middleware normalization with malformed error bodies.
   Files to touch: backend/shared/middleware/test/wrapper.test.ts.
   New assertion/gate: add a test where inner handler returns {statusCode: 400, body: "not-json"} and decide policy: either forbid pass-through for non-2xx, or require pass-through bodies be valid ADR-008.
   Prevents: (4) error contract divergence.
   Turn CI placeholders into real gates incrementally
   Goal: remove false confidence from “integration-tests” / “contract-tests” jobs.
   Files to touch: .github/workflows/ci.yml (and the new test suites).
   New assertion/gate: make those jobs run actual vitest projects (even if tiny) rather than echo.
   Prevents: “green CI” while critical suites are absent.
   Observability: add minimum viable API Gateway access logs + alarms
   Goal: reduce observability blind spots before route count grows.
   Files to touch: infra/lib/stacks/api/api-gateway.stack.ts, infra/lib/stacks/observability/observability.stack.ts.
   New assertion/gate: infra tests that assert stage access log settings and at least one alarm exists.
   Prevents: (6) observability blind spots becoming operational incidents as Lambda/route count increases.
