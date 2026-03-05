import { App, Stack } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { describe, it, expect, beforeAll } from "vitest";
import { AuthStack } from "../../../lib/stacks/auth/auth.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("AuthStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const awsEnv = getAwsEnv();

    // Create a mock tables stack to provide the users and invite-codes tables
    const tablesStack = new Stack(app, "TestTablesStack", { env: awsEnv });
    const usersTable = new dynamodb.Table(tablesStack, "UsersTable", {
      tableName: "ai-learning-hub-users",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });
    const inviteCodesTable = new dynamodb.Table(
      tablesStack,
      "InviteCodesTable",
      {
        tableName: "ai-learning-hub-invite-codes",
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      }
    );
    const savesTable = new dynamodb.Table(tablesStack, "SavesTable", {
      tableName: "ai-learning-hub-saves",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });
    const idempotencyTable = new dynamodb.Table(
      tablesStack,
      "IdempotencyTable",
      {
        tableName: "ai-learning-hub-idempotency",
        partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      }
    );
    const eventsTable = new dynamodb.Table(tablesStack, "EventsTable", {
      tableName: "ai-learning-hub-events",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
    });

    const stack = new AuthStack(app, "TestAuthStack", {
      env: awsEnv,
      usersTable,
      inviteCodesTable,
      savesTable,
      idempotencyTable,
      eventsTable,
    });
    template = Template.fromStack(stack);
  });

  // ─── Helper: find IAM policies attached to a specific function's role ──
  function findPoliciesForRole(roleSubstring: string) {
    const policies = template.findResources("AWS::IAM::Policy");
    return Object.values(policies).filter((resource) => {
      const roles = resource.Properties?.Roles ?? [];
      return roles.some((r: Record<string, unknown>) => {
        const ref = r.Ref ?? "";
        return typeof ref === "string" && ref.includes(roleSubstring);
      });
    });
  }

  function hasIamAction(
    policy: Record<string, unknown>,
    action: string
  ): boolean {
    const props = (
      policy as {
        Properties?: {
          PolicyDocument?: { Statement?: Record<string, unknown>[] };
        };
      }
    ).Properties;
    const statements = props?.PolicyDocument?.Statement ?? [];
    return (statements as Record<string, unknown>[]).some(
      (s: Record<string, unknown>) => {
        const actions = s.Action;
        if (Array.isArray(actions)) return actions.includes(action);
        return actions === action;
      }
    );
  }

  // ─── Lambda Function Counts & Configuration ──────────────────────────

  describe("Lambda Functions", () => {
    it("creates 10 Lambda functions (JWT, API Key, 3 api-keys, 2 invite-codes, 2 users-me, validate-invite)", () => {
      template.resourceCountIs("AWS::Lambda::Function", 10);
    });

    it("uses the latest Node.js runtime", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Runtime: lambda.Runtime.NODEJS_LATEST.name,
      });
    });

    it("has X-Ray tracing enabled", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        TracingConfig: { Mode: "Active" },
      });
    });

    it("has reasonable memory and timeout", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        MemorySize: 256,
        Timeout: 10,
      });
    });

    // Finding 5.1 workaround: all functions get all env vars due to @ai-learning-hub/db
    // barrel import calling requireEnv() at module load. Update count when fixed.
    it("all Lambdas have INVITE_CODES_TABLE_NAME environment variable", () => {
      const lambdas = template.findResources("AWS::Lambda::Function");
      const inviteCodeLambdas = Object.values(lambdas).filter((resource) => {
        const envVars = resource.Properties?.Environment?.Variables ?? {};
        return envVars.INVITE_CODES_TABLE_NAME;
      });
      expect(inviteCodeLambdas).toHaveLength(10);
    });
  });

  // ─── Per-Method Handler Verification (AC1-AC3, AC5) ──────────────────

  describe("Per-method handler strings (AC1-AC3, AC5)", () => {
    it("createApiKeyFunction has handler createHandler", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.createHandler",
      });
    });

    it("listApiKeyFunction has handler listHandler", () => {
      // Multiple functions use listHandler (api-keys, invite-codes)
      const lambdas = template.findResources("AWS::Lambda::Function");
      const listHandlers = Object.values(lambdas).filter(
        (r) => r.Properties?.Handler === "index.listHandler"
      );
      expect(listHandlers.length).toBeGreaterThanOrEqual(2);
    });

    it("revokeApiKeyFunction has handler revokeHandler", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.revokeHandler",
      });
    });

    it("generateInviteFunction has handler generateHandler", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.generateHandler",
      });
    });

    it("readUsersMeFunction has handler readHandler", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.readHandler",
      });
    });

    it("writeUsersMeFunction has handler writeHandler", () => {
      template.hasResourceProperties("AWS::Lambda::Function", {
        Handler: "index.writeHandler",
      });
    });
  });

  // ─── Authorizer IAM ──────────────────────────────────────────────────

  describe("Authorizer IAM", () => {
    it("jwtAuthorizerFunction gets GetItem + PutItem + UpdateItem + Query on usersTable", () => {
      const jwtPolicies = findPoliciesForRole("JwtAuthorizer");
      const hasFourActions = jwtPolicies.some((policy) => {
        const statements = policy.Properties?.PolicyDocument?.Statement ?? [];
        return statements.some((s: Record<string, unknown>) => {
          const actions = s.Action;
          if (!Array.isArray(actions)) return false;
          return (
            actions.includes("dynamodb:GetItem") &&
            actions.includes("dynamodb:PutItem") &&
            actions.includes("dynamodb:UpdateItem") &&
            actions.includes("dynamodb:Query") &&
            actions.length === 4
          );
        });
      });
      expect(hasFourActions).toBe(true);
    });

    it("grants ssm:GetParameter for the Clerk secret key", () => {
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: "ssm:GetParameter",
              Effect: "Allow",
            }),
          ]),
        },
      });
    });

    it("API Key authorizer has ssm:GetParameter permission for Clerk secret", () => {
      const policies = findPoliciesForRole("ApiKeyAuthorizer");
      const hasSsm = policies.some((p) => hasIamAction(p, "ssm:GetParameter"));
      expect(hasSsm).toBe(true);
    });

    it("API Key authorizer has dynamodb:PutItem permission for ensureProfile", () => {
      const policies = findPoliciesForRole("ApiKeyAuthorizer");
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasPut).toBe(true);
    });
  });

  // ─── Events Table IAM (AC7) ──────────────────────────────────────────

  describe("Events table PutItem IAM (AC7)", () => {
    it("createApiKeyFunction has PutItem on eventsTable", () => {
      const policies = findPoliciesForRole("CreateApiKey");
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasPut).toBe(true);
    });

    it("revokeApiKeyFunction has PutItem on eventsTable", () => {
      const policies = findPoliciesForRole("RevokeApiKey");
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasPut).toBe(true);
    });

    it("generateInviteFunction has PutItem on eventsTable", () => {
      const policies = findPoliciesForRole("GenerateInvite");
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasPut).toBe(true);
    });

    it("validateInviteFunction has PutItem on eventsTable", () => {
      const policies = findPoliciesForRole("ValidateInvite");
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasPut).toBe(true);
    });

    it("writeUsersMeFunction has PutItem on eventsTable", () => {
      const policies = findPoliciesForRole("WriteUsersMe");
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasPut).toBe(true);
    });
  });

  // ─── Idempotency Table IAM (AC8, AC9) ────────────────────────────────

  describe("Idempotency table GetItem/PutItem IAM (AC8, AC9)", () => {
    it("createApiKeyFunction has GetItem+PutItem on idempotencyTable", () => {
      const policies = findPoliciesForRole("CreateApiKey");
      const hasGet = policies.some((p) => hasIamAction(p, "dynamodb:GetItem"));
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasGet).toBe(true);
      expect(hasPut).toBe(true);
    });

    it("revokeApiKeyFunction has GetItem+PutItem on idempotencyTable", () => {
      const policies = findPoliciesForRole("RevokeApiKey");
      const hasGet = policies.some((p) => hasIamAction(p, "dynamodb:GetItem"));
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasGet).toBe(true);
      expect(hasPut).toBe(true);
    });

    it("generateInviteFunction has GetItem+PutItem on idempotencyTable", () => {
      const policies = findPoliciesForRole("GenerateInvite");
      const hasGet = policies.some((p) => hasIamAction(p, "dynamodb:GetItem"));
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasGet).toBe(true);
      expect(hasPut).toBe(true);
    });

    it("validateInviteFunction has GetItem+PutItem on idempotencyTable (AC8)", () => {
      const policies = findPoliciesForRole("ValidateInvite");
      const hasGet = policies.some((p) => hasIamAction(p, "dynamodb:GetItem"));
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasGet).toBe(true);
      expect(hasPut).toBe(true);
    });

    it("writeUsersMeFunction has GetItem+PutItem on idempotencyTable", () => {
      const policies = findPoliciesForRole("WriteUsersMe");
      const hasGet = policies.some((p) => hasIamAction(p, "dynamodb:GetItem"));
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      expect(hasGet).toBe(true);
      expect(hasPut).toBe(true);
    });

    it("listApiKeyFunction has NO idempotency or events table grants", () => {
      const policies = findPoliciesForRole("ListApiKey");
      // listApiKeyFunction should only have Query on usersTable
      // Verify it does NOT have PutItem (which would indicate events/idempotency grants)
      const statements = policies.flatMap(
        (p) => p.Properties?.PolicyDocument?.Statement ?? []
      );
      const allActions = statements.flatMap((s: Record<string, unknown>) =>
        Array.isArray(s.Action) ? s.Action : [s.Action]
      );
      expect(allActions).not.toContain("dynamodb:PutItem");
      expect(allActions).not.toContain("dynamodb:GetItem");
    });

    it("listInviteCodesFunction has NO idempotency or events table grants", () => {
      const policies = findPoliciesForRole("ListInviteCodes");
      const statements = policies.flatMap(
        (p) => p.Properties?.PolicyDocument?.Statement ?? []
      );
      const allActions = statements.flatMap((s: Record<string, unknown>) =>
        Array.isArray(s.Action) ? s.Action : [s.Action]
      );
      expect(allActions).not.toContain("dynamodb:PutItem");
      expect(allActions).not.toContain("dynamodb:GetItem");
    });
  });

  // ─── Users Me specific IAM ───────────────────────────────────────────

  describe("Users Me IAM", () => {
    it("readUsersMeFunction gets GetItem only on usersTable", () => {
      const policies = findPoliciesForRole("ReadUsersMe");
      const statements = policies.flatMap(
        (p) => p.Properties?.PolicyDocument?.Statement ?? []
      );
      const allActions = statements.flatMap((s: Record<string, unknown>) =>
        Array.isArray(s.Action) ? s.Action : [s.Action]
      );
      expect(allActions).toContain("dynamodb:GetItem");
      expect(allActions).not.toContain("dynamodb:UpdateItem");
      expect(allActions).not.toContain("dynamodb:PutItem");
    });

    it("writeUsersMeFunction gets GetItem + UpdateItem on usersTable", () => {
      const policies = findPoliciesForRole("WriteUsersMe");
      const hasGet = policies.some((p) => hasIamAction(p, "dynamodb:GetItem"));
      const hasUpdate = policies.some((p) =>
        hasIamAction(p, "dynamodb:UpdateItem")
      );
      expect(hasGet).toBe(true);
      expect(hasUpdate).toBe(true);
    });
  });

  // ─── Validate Invite IAM ────────────────────────────────────────────

  describe("Validate Invite IAM", () => {
    it("validateInviteFunction gets GetItem + UpdateItem on inviteCodesTable", () => {
      const policies = findPoliciesForRole("ValidateInvite");
      const hasGet = policies.some((p) => hasIamAction(p, "dynamodb:GetItem"));
      const hasUpdate = policies.some((p) =>
        hasIamAction(p, "dynamodb:UpdateItem")
      );
      expect(hasGet).toBe(true);
      expect(hasUpdate).toBe(true);
    });
  });

  // ─── Invite Codes IAM ───────────────────────────────────────────────

  describe("Invite Codes IAM", () => {
    it("generateInviteFunction gets PutItem + Query on inviteCodesTable", () => {
      const policies = findPoliciesForRole("GenerateInvite");
      const hasPut = policies.some((p) => hasIamAction(p, "dynamodb:PutItem"));
      const hasQuery = policies.some((p) => hasIamAction(p, "dynamodb:Query"));
      expect(hasPut).toBe(true);
      expect(hasQuery).toBe(true);
    });

    it("listInviteCodesFunction gets Query on inviteCodesTable", () => {
      const policies = findPoliciesForRole("ListInviteCodes");
      const hasQuery = policies.some((p) => hasIamAction(p, "dynamodb:Query"));
      expect(hasQuery).toBe(true);
    });
  });

  // ─── Stack Outputs ───────────────────────────────────────────────────

  describe("Stack Outputs", () => {
    it("exports the JWT authorizer function ARN and name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.JwtAuthorizerFunctionArn).toBeDefined();
      expect(outputs.JwtAuthorizerFunctionName).toBeDefined();
    });

    it("exports the API key authorizer function ARN and name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ApiKeyAuthorizerFunctionArn).toBeDefined();
      expect(outputs.ApiKeyAuthorizerFunctionName).toBeDefined();
    });

    it("exports per-method users/me function ARNs and names", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ReadUsersMeFunctionArn).toBeDefined();
      expect(outputs.ReadUsersMeFunctionName).toBeDefined();
      expect(outputs.WriteUsersMeFunctionArn).toBeDefined();
      expect(outputs.WriteUsersMeFunctionName).toBeDefined();
    });

    it("exports the validate invite function ARN and name", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.ValidateInviteFunctionArn).toBeDefined();
      expect(outputs.ValidateInviteFunctionName).toBeDefined();
    });

    it("exports per-method API key function ARNs and names", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.CreateApiKeyFunctionArn).toBeDefined();
      expect(outputs.CreateApiKeyFunctionName).toBeDefined();
      expect(outputs.ListApiKeyFunctionArn).toBeDefined();
      expect(outputs.ListApiKeyFunctionName).toBeDefined();
      expect(outputs.RevokeApiKeyFunctionArn).toBeDefined();
      expect(outputs.RevokeApiKeyFunctionName).toBeDefined();
    });

    it("exports per-method invite code function ARNs and names", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.GenerateInviteFunctionArn).toBeDefined();
      expect(outputs.GenerateInviteFunctionName).toBeDefined();
      expect(outputs.ListInviteCodesFunctionArn).toBeDefined();
      expect(outputs.ListInviteCodesFunctionName).toBeDefined();
    });
  });

  // ─── ALLOW_DEV_AUTH_HEADER Audit ─────────────────────────────────────

  describe("ALLOW_DEV_AUTH_HEADER CDK environment audit (D9, AC7)", () => {
    it("no Lambda has ALLOW_DEV_AUTH_HEADER in environment variables", () => {
      const functions = template.findResources("AWS::Lambda::Function");
      const violations: string[] = [];

      for (const [logicalId, fn] of Object.entries(functions)) {
        const envVars = fn.Properties?.Environment?.Variables ?? {};
        if ("ALLOW_DEV_AUTH_HEADER" in envVars) {
          violations.push(logicalId);
        }
      }

      if (violations.length > 0) {
        expect.fail(
          `Lambdas with ALLOW_DEV_AUTH_HEADER (production auth bypass risk):\n${violations.map((v) => `  - ${v}`).join("\n")}\n\n` +
            "If this env var is needed for a dev stage, gate it behind a CDK context flag " +
            "and update this test to allow it only for stage === 'dev'."
        );
      }
    });
  });
});
