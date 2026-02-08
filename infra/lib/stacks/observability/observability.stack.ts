import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as xray from "aws-cdk-lib/aws-xray";
import { NagSuppressions } from "cdk-nag";

/**
 * Observability Stack - X-Ray tracing, CloudWatch dashboards, and alarms
 * Per ADR-006: Deployment order is Core → Auth → API → Workflows → Observability
 * Per ADR-008: Structured logging with correlation IDs and X-Ray trace integration
 */
export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // X-Ray Sampling Rule for Lambda tracing (AC1)
    // This rule applies to all Lambda functions in the account/region
    // 5% sampling rate with reservoir of 1 ensures we capture some traces without overwhelming X-Ray
    const samplingRule = new xray.CfnSamplingRule(this, "LambdaSamplingRule", {
      samplingRule: {
        ruleName: "ai-learning-hub-lambda-sampling",
        // ARN pattern - matches all resources (Lambda functions will self-identify via SDK)
        resourceArn: "*",
        // Priority - lower number = higher priority (1000 is standard for application rules)
        priority: 1000,
        // Fixed rate - 5% of requests are sampled
        fixedRate: 0.05,
        // Reservoir - always sample at least this many requests per second per host
        reservoirSize: 1,
        // Service matching - wildcards match all Lambda invocations
        serviceName: "*",
        serviceType: "AWS::Lambda",
        host: "*",
        httpMethod: "*",
        urlPath: "*",
        // Version is required for CloudFormation
        version: 1,
      },
    });

    // CDK Nag suppression: Sampling rule requires wildcards to apply to all Lambdas
    NagSuppressions.addResourceSuppressions(
      samplingRule,
      [
        {
          id: "AwsSolutions-XR2",
          reason:
            "Sampling rule intentionally uses wildcards to apply to all Lambda functions (ADR-006)",
        },
      ],
      true
    );

    // Outputs for cross-stack references (future use)
    new cdk.CfnOutput(this, "SamplingRuleName", {
      value: samplingRule.ref,
      description:
        "X-Ray sampling rule name for Lambda tracing (NFR-O1, ADR-008)",
      exportName: "AiLearningHub-XRaySamplingRule",
    });

    // Future: CloudWatch Dashboards
    // When implemented, add dashboard resources here showing:
    // - Lambda duration/errors/invocations
    // - DynamoDB throttles/read-write capacity
    // - API Gateway 4xx/5xx rates
    // - X-Ray trace analytics

    // Future: CloudWatch Alarms
    // When implemented, add alarm resources here for:
    // - Lambda error rate > threshold
    // - API Gateway 5xx rate > threshold
    // - DynamoDB throttles
    // - High Lambda duration (P99)
  }
}
