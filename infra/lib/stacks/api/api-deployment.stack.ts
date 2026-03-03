/**
 * API Deployment Stack -- Deployment + Stage + WAF for the REST API
 *
 * Solves the CDK cross-stack deployment problem: routes are added by separate
 * stacks (AuthRoutesStack, SavesRoutesStack) via fromRestApiAttributes(), but
 * CDK's RestApi auto-deployment only hashes resources in its own construct scope.
 * By managing the Deployment + Stage in a dedicated stack that depends on ALL
 * route stacks, we guarantee every route is included in the deployed stage.
 *
 * Dependency chain:
 *   ApiGatewayStack → AuthRoutesStack  ─┐
 *                   → SavesRoutesStack ─┤→ ApiDeploymentStack
 *
 * Uses L1 constructs (CfnDeployment, CfnStage) for full control over
 * deployment lifecycle without CDK's auto-hashing behavior.
 */
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface ApiDeploymentStackProps extends cdk.StackProps {
  /** REST API ID from ApiGatewayStack */
  restApiId: string;
  /** Deployment stage name (e.g., "dev", "staging", "prod"). Defaults to "dev". */
  stageName?: string;
  /** WAF WebACL (from RateLimitingStack) */
  webAcl: wafv2.CfnWebACL;
}

export class ApiDeploymentStack extends cdk.Stack {
  /** The deployment stage ARN — for cross-stack references */
  public readonly stageArn: string;

  constructor(scope: Construct, id: string, props: ApiDeploymentStackProps) {
    super(scope, id, props);

    const { restApiId, stageName = "dev", webAcl } = props;

    // --- Deployment ---
    // A new CfnDeployment must be created (REPLACED, not updated) on every
    // synth so API Gateway takes a fresh snapshot of all current routes.
    // Description-only changes do NOT trigger CloudFormation replacement —
    // we must change the logical ID to force resource replacement.
    const deploymentHash = Date.now().toString(36);
    const deployment = new apigateway.CfnDeployment(
      this,
      `Deployment${deploymentHash}`,
      {
        restApiId,
        description: `Managed by ApiDeploymentStack — ${new Date().toISOString()}`,
      }
    );

    // --- Stage ---
    const stage = new apigateway.CfnStage(this, "Stage", {
      restApiId,
      deploymentId: deployment.ref,
      stageName,
      tracingEnabled: true,
      methodSettings: [
        {
          httpMethod: "*",
          resourcePath: "/*",
          throttlingRateLimit: 100,
          throttlingBurstLimit: 200,
        },
        // Tighter throttling on unauthenticated health/readiness endpoints (AC15)
        {
          httpMethod: "GET",
          resourcePath: "/health",
          throttlingRateLimit: 50,
          throttlingBurstLimit: 100,
        },
        {
          httpMethod: "GET",
          resourcePath: "/ready",
          throttlingRateLimit: 50,
          throttlingBurstLimit: 100,
        },
      ],
    });

    // Construct the stage ARN for WAF association and cross-stack references.
    this.stageArn = cdk.Arn.format(
      {
        service: "apigateway",
        resource: "/restapis",
        resourceName: `${restApiId}/stages/${stageName}`,
      },
      this
    );

    // --- WAF Association (AC2) ---
    const wafAssociation = new wafv2.CfnWebACLAssociation(
      this,
      "WebAclAssociation",
      {
        resourceArn: this.stageArn,
        webAclArn: webAcl.attrArn,
      }
    );
    // Explicit DependsOn: WAF association requires the stage to exist.
    // CloudFormation can't infer this from the string-based stageArn.
    wafAssociation.addDependency(stage);

    // --- CDK Nag Suppressions ---
    NagSuppressions.addResourceSuppressions(
      stage,
      [
        {
          id: "AwsSolutions-APIG3",
          reason:
            "WAF is associated via CfnWebACLAssociation. CDK Nag does not detect CfnWebACLAssociation automatically.",
        },
        {
          id: "AwsSolutions-APIG1",
          reason:
            "API Gateway access logging will be configured in observability stack enhancement",
        },
        {
          id: "AwsSolutions-APIG6",
          reason:
            "CloudWatch logging for API Gateway stages will be configured when observability stack is enhanced",
        },
      ],
      true
    );

    // --- Stack Outputs ---
    const restApiUrl = `https://${restApiId}.execute-api.${this.region}.amazonaws.com/${stageName}/`;

    new cdk.CfnOutput(this, "RestApiUrl", {
      value: restApiUrl,
      description: "REST API URL (deployed stage)",
      exportName: "AiLearningHub-RestApiUrl",
    });

    new cdk.CfnOutput(this, "StageName", {
      value: stageName,
      description: "Deployed stage name",
    });
  }
}
