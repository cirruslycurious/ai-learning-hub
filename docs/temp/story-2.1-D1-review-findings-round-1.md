# Story 2.1-D1 Code Review Findings - Round 1

**Reviewer:** Agent (Fresh Context)
**Date:** 2026-02-18
**Branch:** story-2-1-d1-api-gateway-conventions-route-registry
**Note:** Changes are uncommitted in the working directory (branch is at same commit as main).

## Critical Issues (Must Fix)

### 1. CDK synth fails with circular dependency -- AC18 violated

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/bin/app.ts` (lines 64-77) and `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/api-gateway.stack.ts` (lines 257-317)

**Problem:** Running `cdk synth` produces the error:

```
ValidationError: 'AiLearningHubApiGateway' depends on 'AiLearningHubAuth'
({AiLearningHubApiGateway}.addDependency({AiLearningHubAuth})).
Adding this dependency (AiLearningHubAuth -> AiLearningHubApiGateway/RestApi/Resource.Ref)
would create a cyclic reference.
```

When `ApiGatewayStack` receives real Lambda constructs (e.g., `authStack.validateInviteFunction`) from `AuthStack` and wires them as `LambdaIntegration` targets, CDK automatically creates `lambda:InvokeFunction` permissions that reference the API Gateway's REST API ARN. This creates an implicit dependency from `AuthStack` back to `ApiGatewayStack`, forming a cycle with the explicit `apiGatewayStack.addDependency(authStack)`.

The unit tests mask this problem by using `lambda.Function.fromFunctionArn()` (imported references that do not generate cross-stack permission grants), as the test comments themselves acknowledge.

**Impact:** The stack cannot be deployed. This is the primary deliverable of the story and violates AC18 ("cdk synth runs -- All stacks synthesize without errors").

**Fix:** Break the cycle using one of these approaches:

- (A) Use `Function.fromFunctionArn()` or `Function.fromFunctionAttributes()` in `app.ts` to import Lambda references by ARN rather than passing the constructs directly. This means `AuthStack` would export function ARNs via CfnOutput and `app.ts` would use `Fn.importValue()` or pass ARN strings.
- (B) Move the `LambdaIntegration` permission grants into `ApiGatewayStack` explicitly (using `addPermission` on imported function references) so CDK doesn't create the cross-stack back-reference.
- (C) Combine the routes into a separate stack (as originally designed in AC16: "AuthRoutesStack") that takes both the API and Lambda references, keeping the permission grants in a third stack that depends on both.

### 2. JWT-or-API-Key routes wired only to API Key authorizer -- AC8, AC9, AC10 partially broken

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/api-gateway.stack.ts` (lines 270-317)

**Problem:** Routes documented as "jwt-or-apikey" (`/users/me`, `/users/api-keys`, `/users/api-keys/{id}`, `/users/invite-codes`) are wired exclusively to the `apiKeyAuthorizer` (REQUEST type, identity source `x-api-key`). The `apiKeyAuthorizer`'s Lambda only checks for `x-api-key` headers and does not handle JWT `Authorization` headers.

API Gateway with a REQUEST authorizer that has `identitySources: [IdentitySource.header("x-api-key")]` will return 401 for any request that does not include the `x-api-key` header, **before the authorizer Lambda is even invoked**. This means JWT-only clients (e.g., the frontend web app using Clerk tokens in the `Authorization` header) cannot access `/users/me`, `/users/api-keys`, or `/users/invite-codes`.

The story's technical notes acknowledge this design challenge: "JWT-or-API-Key: Implement as a single custom authorizer that checks Authorization header first, falls back to x-api-key. OR use two separate authorizers and let the route choose. Document decision in conventions."

The implementation chose neither approach correctly -- it just wired the API Key authorizer alone.

**Impact:** The web frontend (using Clerk JWTs) will receive 401 errors on all `/users/*` endpoints. Only API key clients can authenticate. This breaks the core user experience for AC8 (profile), AC9 (API key management), and AC10 (invite codes).

**Fix:** Create a combined authorizer Lambda (or modify the API Key authorizer) that:

1. Checks `Authorization` header first (JWT path -- delegates to Clerk verification)
2. Falls back to `x-api-key` header (API key path -- current behavior)
3. Returns the same policy/context shape either way

Wire this combined authorizer as a `RequestAuthorizer` with `identitySources` including both headers (or remove identity sources to skip caching validation), and use it on all jwt-or-apikey routes. Document the decision in the conventions document.

## Important Issues (Should Fix)

### 3. AuthRoutes is an embedded Construct, not a separate stack as specified in AC16

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/api-gateway.stack.ts` (lines 229-319)

**Problem:** AC16 states: "Developer adds `ApiGatewayStack` + `AuthRoutesStack` to app" with dependency order "Tables -> Auth -> ApiGateway -> AuthRoutes -> Observability". The story's Files to Create/Modify table also lists `infra/lib/stacks/api/auth-routes.stack.ts` as a separate file. The implementation instead embeds `AuthRoutes` as a Construct class within `api-gateway.stack.ts`, and there is no `auth-routes.stack.ts` file at all.

While using a Construct is a reasonable CDK pattern, it deviates from the story's specified architecture. Having `AuthRoutes` inside `ApiGatewayStack` means adding routes for a new epic (e.g., Epic 3 saves routes) would still require creating a separate stack, but the pattern isn't demonstrated with the existing routes. Also, embedding routes in the gateway stack reduces the "independently deployable" property described in the conventions doc.

**Impact:** Deviates from story specification. Future developers following the conventions doc (which says "Each route stack independently deployable") won't see this pattern demonstrated for Epic 2 routes. The CDK cyclic dependency issue (Finding #1) might also be addressed more naturally by separating routes into a distinct stack.

**Fix:** Extract `AuthRoutes` into a separate `infra/lib/stacks/api/auth-routes.stack.ts` file as a Stack (not just a Construct), instantiate it in `app.ts`, and add dependency `authRoutesStack.addDependency(apiGatewayStack)`. This also helps resolve the cyclic dependency issue since the Lambda integration permissions would be in the routes stack, not crossing back to the auth stack.

### 4. Gateway Response CORS headers missing `Access-Control-Allow-Methods`

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/lib/stacks/api/api-gateway.stack.ts` (lines 120-124)

**Problem:** The Gateway Response CORS headers include `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers`, but omit `Access-Control-Allow-Methods`. When the API Gateway returns a non-Lambda error (401, 403, 429, 500), browser clients making cross-origin requests may fail to read the response body if the `Access-Control-Allow-Methods` header is missing. The RestApi's `defaultCorsPreflightOptions` handles OPTIONS preflight correctly, but the Gateway Response error responses are separate and need their own complete CORS headers.

**Impact:** Frontend web app may not be able to read error response bodies (ADR-008 format) from cross-origin API calls that fail at the gateway level. The browser will show a CORS error instead of the structured error JSON, making error handling unreliable.

**Fix:** Add the missing CORS header to Gateway Responses:

```typescript
responseHeaders: {
  "Access-Control-Allow-Origin": "'*'",
  "Access-Control-Allow-Headers": "'Content-Type,Authorization,x-api-key'",
  "Access-Control-Allow-Methods": "'GET,POST,PATCH,DELETE,OPTIONS'",
},
```

### 5. API Key authorizer identity source not tested (AC6 incomplete test coverage)

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/api/api-gateway.stack.test.ts` (lines 169-183)

**Problem:** AC6 specifies the API Key authorizer should have identity source `method.request.header.x-api-key`. The JWT authorizer test (AC5) correctly verifies `IdentitySource: "method.request.header.Authorization"`, but the API Key authorizer test only checks `Type: "REQUEST"` and `Name: "api-key-authorizer"` -- it does not verify the identity source.

**Impact:** If the identity source were accidentally changed or removed, the test would still pass, potentially letting a misconfigured authorizer through to deployment.

**Fix:** Add identity source assertion to the API Key authorizer test:

```typescript
it("uses x-api-key header as identity source", () => {
  template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
    Name: "api-key-authorizer",
    IdentitySource: "method.request.header.x-api-key",
  });
});
```

### 6. T7 cross-stack dependency test uses source text parsing instead of CDK assertions

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/api/cross-stack-deps.test.ts` (entire file)

**Problem:** The T7 test validates cross-stack dependencies by reading the source text of `app.ts`, `auth.stack.ts`, and `rate-limiting.stack.ts` with `readFileSync` and then doing string-contains checks (e.g., `expect(appSource).toContain("apiGatewayStack.addDependency(authStack)")`). This approach is fragile -- it breaks if variable names are renamed, code is reformatted, or addDependency is called with destructured variables. It also cannot detect implicit CDK cross-stack dependencies (which is exactly what caused Finding #1).

The "CfnOutput exports" section (lines 98-131) checks for export name strings in source code, but doesn't verify the actual CloudFormation output exists in the synthesized template.

**Impact:** The test validates code appearance, not actual behavior. It successfully passed while the stack fails CDK synth. The circular dependency (Finding #1) was not caught by this test.

**Fix:** Supplement source-text checks with CDK `Template.fromStack()` assertions:

- Synthesize all stacks in a test app and verify template outputs/dependencies
- Use `template.hasOutput()` to verify CfnOutput exports exist
- Verify that `cdk synth` succeeds as a test (the most direct test of AC17/AC18)

### 7. Test for routes (AC7-AC10) does not verify which authorizer is on which route

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/api/api-gateway.stack.test.ts` (lines 185-227)

**Problem:** The route tests verify that HTTP methods exist with `AuthorizationType: "CUSTOM"`, but do not verify which authorizer (JWT vs API Key) is attached to which route. For example, `POST /auth/validate-invite` should use the JWT authorizer (AC7), but the test only checks that the POST method has `AuthorizationType: "CUSTOM"` -- it doesn't verify the authorizer reference. The test `"all non-OPTIONS methods use CUSTOM auth type"` (line 217) confirms the type but not the authorizer ID.

**Impact:** If routes were accidentally wired to the wrong authorizer (which is exactly what happened -- see Finding #2), the test would still pass.

**Fix:** Extract the authorizer logical IDs from the template and verify that specific routes reference the correct authorizer. For example, verify that the `/auth/validate-invite` POST method references the JWT authorizer, while `/users/me` methods reference the (future combined) authorizer.

## Minor Issues (Nice to Have)

### 8. Test fallback to `us-east-1` instead of project default `us-east-2`

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/test/stacks/api/api-gateway.stack.test.ts` (line 33)

**Problem:** The test uses `const testRegion = awsEnv.region ?? "us-east-1"` as a fallback, but the project's `aws-env.ts` defaults to `us-east-2`. The existing `app-structure.test.ts` explicitly tests that `us-east-1` is NOT the default region. While this is only a test fallback value and the `getAwsEnv()` function will typically provide `us-east-2`, the inconsistency could cause confusion.

**Impact:** Cosmetic inconsistency; unlikely to cause runtime issues since `getAwsEnv()` already defaults to `us-east-2`.

**Fix:** Change to `const testRegion = awsEnv.region ?? "us-east-2"` to match the project convention.

### 9. Conventions document uses `:id` path parameter syntax inconsistently with CDK `{id}` syntax

**File:** `/Users/stephen/Documents/ai-learning-hub/.claude/docs/api-gateway-conventions.md` (lines 8-9)

**Problem:** The conventions document uses Express-style path parameters (`:id`) in examples (line 8: `/projects/:id/saves`, line 9: `/saves/:id/restore`), while API Gateway and the route registry use curly-brace syntax (`{id}`). The route registry and CDK code consistently use `{id}` syntax.

**Impact:** Minor confusion for developers who follow the conventions doc and then write CDK code. API Gateway uses `{id}` syntax, not `:id`.

**Fix:** Use `{id}` syntax throughout the conventions document for consistency:

```
- Nested resources for owned relationships: `/projects/{id}/saves`, `/projects/{id}/notes`
- Sub-actions as verbs only when REST doesn't fit: `/saves/{id}/restore`, `/admin/pipelines/{name}/retry`
```

### 10. Route registry `handlerRef` is a plain string without type validation against actual stack properties

**File:** `/Users/stephen/Documents/ai-learning-hub/infra/config/route-registry.ts` (lines 26, 34-71)

**Problem:** The `handlerRef` field in `RouteEntry` is typed as `string`, and the values (e.g., `"validateInviteFunction"`, `"usersMeFunction"`) are just string literals. There is no compile-time validation that these strings match actual property names on `AuthStack` or any other stack.

**Impact:** If a handler property is renamed in a stack, the route registry will silently become stale. D5's T2/T4 tests will eventually catch this, but a type-safe approach would catch it at compile time.

**Fix:** Consider using `keyof AuthStack` or a string literal union type for `handlerRef` to provide compile-time safety:

```typescript
export type HandlerRef =
  | "validateInviteFunction"
  | "usersMeFunction"
  | "apiKeysFunction"
  | "generateInviteFunction";
```

### 11. Changes are not committed to the branch

**Problem:** All implementation files are either untracked or unstaged in the working directory. The branch `story-2-1-d1-api-gateway-conventions-route-registry` points to the same commit as `main` (0ae0108). No PR can be created without committing and pushing the changes.

**Impact:** The implementation is not version-controlled and could be lost if the working directory is cleaned.

**Fix:** Stage and commit all new and modified files after fixing the critical issues.

## Summary

- **Total findings:** 11
- **Critical:** 2
- **Important:** 5
- **Minor:** 4
- **Recommendation:** **Revise and re-review**

The two critical issues must be resolved before this story can be considered complete:

1. **CDK synth fails** due to a circular cross-stack dependency between `AuthStack` and `ApiGatewayStack`. This is caused by passing real Lambda constructs across stacks, which CDK auto-generates invoke permissions for, creating a back-reference. The test suite masks this by using `fromFunctionArn()` imports that don't trigger cross-stack grants. The fix requires restructuring how Lambda references are passed between stacks.

2. **JWT authentication broken on /users/\* routes** because "jwt-or-apikey" routes only use the API Key authorizer. A combined authorizer strategy must be implemented and documented.

The story deliverables (conventions doc, route registry, tests) are well-structured and largely complete, but the core CDK stack cannot synthesize in its current form.
