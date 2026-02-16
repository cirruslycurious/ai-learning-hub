import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class TablesStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly savesTable: dynamodb.Table;
  public readonly projectsTable: dynamodb.Table;
  public readonly linksTable: dynamodb.Table;
  public readonly contentTable: dynamodb.Table;
  public readonly searchIndexTable: dynamodb.Table;
  public readonly inviteCodesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // NOTE: Table names are currently hardcoded without environment prefix.
    // This prevents deploying multiple environments (dev, staging, prod) to the same AWS account.
    // TODO: Add environment prefix support in Epic 2 for multi-environment deployment.

    // Table 1: users
    // PK: USER#<clerkId>, SK: PROFILE or APIKEY#<keyId>
    this.usersTable = new dynamodb.Table(this, "UsersTable", {
      tableName: "ai-learning-hub-users",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI: apiKeyHash-index (for API key authentication)
    this.usersTable.addGlobalSecondaryIndex({
      indexName: "apiKeyHash-index",
      partitionKey: { name: "keyHash", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 2: saves
    // PK: USER#<userId>, SK: SAVE#<saveId>
    this.savesTable = new dynamodb.Table(this, "SavesTable", {
      tableName: "ai-learning-hub-saves",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI 1: userId-contentType-index
    this.savesTable.addGlobalSecondaryIndex({
      indexName: "userId-contentType-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "contentType", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI 2: userId-tutorialStatus-index
    this.savesTable.addGlobalSecondaryIndex({
      indexName: "userId-tutorialStatus-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: {
        name: "tutorialStatus",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI 3: urlHash-index (for deduplication and content linking)
    this.savesTable.addGlobalSecondaryIndex({
      indexName: "urlHash-index",
      partitionKey: { name: "urlHash", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 3: projects
    // PK: USER#<userId>, SK: PROJECT#<projectId> or FOLDER#<folderId>
    this.projectsTable = new dynamodb.Table(this, "ProjectsTable", {
      tableName: "ai-learning-hub-projects",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI 1: userId-status-index
    this.projectsTable.addGlobalSecondaryIndex({
      indexName: "userId-status-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "status", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI 2: userId-folderId-index
    this.projectsTable.addGlobalSecondaryIndex({
      indexName: "userId-folderId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "folderId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 4: links
    // PK: USER#<userId>, SK: LINK#<projectId>#<saveId>
    this.linksTable = new dynamodb.Table(this, "LinksTable", {
      tableName: "ai-learning-hub-links",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI 1: userId-projectId-index (get all saves for a project)
    this.linksTable.addGlobalSecondaryIndex({
      indexName: "userId-projectId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "projectId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI 2: userId-saveId-index (get all projects for a save)
    this.linksTable.addGlobalSecondaryIndex({
      indexName: "userId-saveId-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "saveId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 5: content
    // PK: CONTENT#<urlHash>, SK: META
    // Global table, not user-partitioned
    this.contentTable = new dynamodb.Table(this, "ContentTable", {
      tableName: "ai-learning-hub-content",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true, // Critical data per NFR-R3
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Table 6: search-index
    // PK: USER#<userId>, SK: INDEX#<sourceType>#<sourceId>
    this.searchIndexTable = new dynamodb.Table(this, "SearchIndexTable", {
      tableName: "ai-learning-hub-search-index",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI: userId-sourceType-index (filter by source type)
    this.searchIndexTable.addGlobalSecondaryIndex({
      indexName: "userId-sourceType-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sourceType", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Table 7: invite-codes
    // PK: CODE#<code>, SK: META
    this.inviteCodesTable = new dynamodb.Table(this, "InviteCodesTable", {
      tableName: "ai-learning-hub-invite-codes",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI: generatedBy-index (list codes generated by a user)
    this.inviteCodesTable.addGlobalSecondaryIndex({
      indexName: "generatedBy-index",
      partitionKey: {
        name: "generatedBy",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // CloudFormation Outputs (for cross-stack references)
    new cdk.CfnOutput(this, "UsersTableName", {
      value: this.usersTable.tableName,
      description: "Users table name",
      exportName: "AiLearningHub-UsersTableName",
    });

    new cdk.CfnOutput(this, "SavesTableName", {
      value: this.savesTable.tableName,
      description: "Saves table name",
      exportName: "AiLearningHub-SavesTableName",
    });

    new cdk.CfnOutput(this, "ProjectsTableName", {
      value: this.projectsTable.tableName,
      description: "Projects table name",
      exportName: "AiLearningHub-ProjectsTableName",
    });

    new cdk.CfnOutput(this, "LinksTableName", {
      value: this.linksTable.tableName,
      description: "Links table name",
      exportName: "AiLearningHub-LinksTableName",
    });

    new cdk.CfnOutput(this, "ContentTableName", {
      value: this.contentTable.tableName,
      description: "Content table name",
      exportName: "AiLearningHub-ContentTableName",
    });

    new cdk.CfnOutput(this, "SearchIndexTableName", {
      value: this.searchIndexTable.tableName,
      description: "Search index table name",
      exportName: "AiLearningHub-SearchIndexTableName",
    });

    new cdk.CfnOutput(this, "InviteCodesTableName", {
      value: this.inviteCodesTable.tableName,
      description: "Invite codes table name",
      exportName: "AiLearningHub-InviteCodesTableName",
    });
  }
}
