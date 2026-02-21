import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it, expect } from "vitest";
import { TablesStack } from "../../../lib/stacks/core/tables.stack";
import { getAwsEnv } from "../../../config/aws-env";

// Type definitions for CloudFormation template resources
interface CfnResource {
  Properties: {
    TableName?: string;
    SSESpecification?: {
      SSEEnabled: boolean;
    };
    PointInTimeRecoverySpecification?: {
      PointInTimeRecoveryEnabled: boolean;
    };
    BillingMode?: string;
    GlobalSecondaryIndexes?: Array<{
      IndexName: string;
      Projection: {
        ProjectionType: string;
      };
    }>;
    AttributeDefinitions?: Array<{
      AttributeName: string;
    }>;
  };
}

describe("TablesStack", () => {
  const app = new App();
  const awsEnv = getAwsEnv();
  const stack = new TablesStack(app, "TestTablesStack", { env: awsEnv });
  const template = Template.fromStack(stack);

  describe("DynamoDB Tables", () => {
    it("should create exactly 7 DynamoDB tables", () => {
      const tables = template.findResources("AWS::DynamoDB::Table");
      expect(Object.keys(tables)).toHaveLength(7);
    });

    it("should create users table with correct keys", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-users",
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "PK", AttributeType: "S" },
          { AttributeName: "SK", AttributeType: "S" },
          { AttributeName: "keyHash", AttributeType: "S" },
        ],
      });
    });

    it("should create saves table with correct keys", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-saves",
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      });
      // Verify attribute definitions separately
      const tables = template.findResources("AWS::DynamoDB::Table");
      const savesTable = Object.values(tables).find(
        (t) =>
          (t as CfnResource).Properties.TableName ===
          "dev-ai-learning-hub-saves"
      ) as CfnResource;
      const attrNames = savesTable.Properties.AttributeDefinitions!.map(
        (attr) => attr.AttributeName
      );
      expect(attrNames).toContain("PK");
      expect(attrNames).toContain("SK");
      expect(attrNames).toContain("userId");
      expect(attrNames).toContain("contentType");
      expect(attrNames).toContain("tutorialStatus");
      expect(attrNames).toContain("urlHash");
    });

    it("should create projects table with correct keys", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-projects",
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      });
    });

    it("should create links table with correct keys", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-links",
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      });
    });

    it("should create content table with correct keys", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-content",
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      });
    });

    it("should create search-index table with correct keys", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-search-index",
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      });
    });

    it("should create invite-codes table with correct keys", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-invite-codes",
        KeySchema: [
          { AttributeName: "PK", KeyType: "HASH" },
          { AttributeName: "SK", KeyType: "RANGE" },
        ],
      });
    });

    it("should enable encryption at rest for all tables", () => {
      const tables = template.findResources("AWS::DynamoDB::Table");
      Object.values(tables).forEach((table) => {
        const cfnTable = table as CfnResource;
        expect(cfnTable.Properties.SSESpecification).toBeDefined();
        expect(cfnTable.Properties.SSESpecification?.SSEEnabled).toBe(true);
      });
    });

    it("should enable Point-in-Time Recovery for all tables", () => {
      const tables = template.findResources("AWS::DynamoDB::Table");
      Object.values(tables).forEach((table) => {
        const cfnTable = table as CfnResource;
        expect(
          cfnTable.Properties.PointInTimeRecoverySpecification
        ).toBeDefined();
        expect(
          cfnTable.Properties.PointInTimeRecoverySpecification
            ?.PointInTimeRecoveryEnabled
        ).toBe(true);
      });
    });

    it("should enable TTL on users table for rate limit counter cleanup", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-users",
        TimeToLiveSpecification: {
          AttributeName: "ttl",
          Enabled: true,
        },
      });
    });

    it("should use on-demand billing mode", () => {
      const tables = template.findResources("AWS::DynamoDB::Table");
      Object.values(tables).forEach((table) => {
        const cfnTable = table as CfnResource;
        expect(cfnTable.Properties.BillingMode).toBe("PAY_PER_REQUEST");
      });
    });
  });

  describe("Global Secondary Indexes", () => {
    it("should create apiKeyHash-index on users table", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-users",
      });
      // Verify GSI details separately
      const tables = template.findResources("AWS::DynamoDB::Table");
      const usersTable = Object.values(tables).find(
        (t) =>
          (t as CfnResource).Properties.TableName ===
          "dev-ai-learning-hub-users"
      ) as CfnResource;
      const gsi = usersTable.Properties.GlobalSecondaryIndexes?.find(
        (g) => g.IndexName === "apiKeyHash-index"
      );
      expect(gsi).toBeDefined();
      expect(gsi?.Projection.ProjectionType).toBe("ALL");
    });

    it("should create 3 GSIs on saves table", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-saves",
      });
      // Verify GSI count separately
      const tables = template.findResources("AWS::DynamoDB::Table");
      const savesTable = Object.values(tables).find(
        (t) =>
          (t as CfnResource).Properties.TableName ===
          "dev-ai-learning-hub-saves"
      ) as CfnResource;
      expect(savesTable.Properties.GlobalSecondaryIndexes).toHaveLength(3);

      // Verify GSI names
      const gsiNames = savesTable.Properties.GlobalSecondaryIndexes?.map(
        (gsi) => gsi.IndexName
      );
      expect(gsiNames).toContain("userId-contentType-index");
      expect(gsiNames).toContain("userId-tutorialStatus-index");
      expect(gsiNames).toContain("urlHash-index");
    });

    it("should create 2 GSIs on projects table", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-projects",
      });
      // Verify GSI count separately
      const tables = template.findResources("AWS::DynamoDB::Table");
      const projectsTable = Object.values(tables).find(
        (t) =>
          (t as CfnResource).Properties.TableName ===
          "dev-ai-learning-hub-projects"
      ) as CfnResource;
      expect(projectsTable.Properties.GlobalSecondaryIndexes).toHaveLength(2);
    });

    it("should create 2 GSIs on links table", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-links",
      });
      // Verify GSI count separately
      const tables = template.findResources("AWS::DynamoDB::Table");
      const linksTable = Object.values(tables).find(
        (t) =>
          (t as CfnResource).Properties.TableName ===
          "dev-ai-learning-hub-links"
      ) as CfnResource;
      expect(linksTable.Properties.GlobalSecondaryIndexes).toHaveLength(2);
    });

    it("should create 1 GSI on search-index table", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-search-index",
      });
      // Verify GSI count separately
      const tables = template.findResources("AWS::DynamoDB::Table");
      const searchIndexTable = Object.values(tables).find(
        (t) =>
          (t as CfnResource).Properties.TableName ===
          "dev-ai-learning-hub-search-index"
      ) as CfnResource;
      expect(searchIndexTable.Properties.GlobalSecondaryIndexes).toHaveLength(
        1
      );
    });

    it("should create 1 GSI on invite-codes table", () => {
      template.hasResourceProperties("AWS::DynamoDB::Table", {
        TableName: "dev-ai-learning-hub-invite-codes",
      });
      // Verify GSI count separately
      const tables = template.findResources("AWS::DynamoDB::Table");
      const inviteCodesTable = Object.values(tables).find(
        (t) =>
          (t as CfnResource).Properties.TableName ===
          "dev-ai-learning-hub-invite-codes"
      ) as CfnResource;
      expect(inviteCodesTable.Properties.GlobalSecondaryIndexes).toHaveLength(
        1
      );
    });

    it("should have exactly 10 GSIs across all tables", () => {
      const tables = template.findResources("AWS::DynamoDB::Table");
      let totalGSIs = 0;
      Object.values(tables).forEach((table) => {
        const cfnTable = table as CfnResource;
        if (cfnTable.Properties.GlobalSecondaryIndexes) {
          totalGSIs += cfnTable.Properties.GlobalSecondaryIndexes.length;
        }
      });
      expect(totalGSIs).toBe(10);
    });
  });

  describe("Stack Outputs", () => {
    it("should export table names via CloudFormation outputs", () => {
      const outputs = template.findOutputs("*");
      const outputKeys = Object.keys(outputs);

      // Should have outputs for all 7 tables
      expect(outputKeys).toContain("UsersTableName");
      expect(outputKeys).toContain("SavesTableName");
      expect(outputKeys).toContain("ProjectsTableName");
      expect(outputKeys).toContain("LinksTableName");
      expect(outputKeys).toContain("ContentTableName");
      expect(outputKeys).toContain("SearchIndexTableName");
      expect(outputKeys).toContain("InviteCodesTableName");
    });

    it("should export table names with correct export name format", () => {
      const outputs = template.findOutputs("*");

      expect(outputs.UsersTableName.Export.Name).toBe(
        "AiLearningHub-UsersTableName"
      );
      expect(outputs.SavesTableName.Export.Name).toBe(
        "AiLearningHub-SavesTableName"
      );
      expect(outputs.ProjectsTableName.Export.Name).toBe(
        "AiLearningHub-ProjectsTableName"
      );
      expect(outputs.LinksTableName.Export.Name).toBe(
        "AiLearningHub-LinksTableName"
      );
      expect(outputs.ContentTableName.Export.Name).toBe(
        "AiLearningHub-ContentTableName"
      );
      expect(outputs.SearchIndexTableName.Export.Name).toBe(
        "AiLearningHub-SearchIndexTableName"
      );
      expect(outputs.InviteCodesTableName.Export.Name).toBe(
        "AiLearningHub-InviteCodesTableName"
      );
    });
  });
});
