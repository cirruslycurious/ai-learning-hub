/**
 * Rate Limiting Stack (Story 2.7, AC1)
 *
 * Layer 1: Infrastructure-level rate limiting.
 * - WAF WebACL with rate-based rule: 500 requests per 5 minutes per IP
 * - API Gateway throttling settings: 100 requests/second (default stage)
 *
 * The WebACL is created as a standalone resource. It will be associated
 * with the API Gateway REST API when the API stack is created (future epic).
 * The throttle settings are exported as outputs for the API stack to consume.
 */
import * as cdk from "aws-cdk-lib";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export class RateLimitingStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // WAF WebACL with rate-based rule (AC1: 500 req/5min per IP)
    this.webAcl = new wafv2.CfnWebACL(this, "ApiRateLimitWebAcl", {
      name: "ai-learning-hub-api-rate-limit",
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "AiLearningHubApiRateLimit",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "RateBasedRule",
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AiLearningHubRateBasedRule",
            sampledRequestsEnabled: true,
          },
          statement: {
            rateBasedStatement: {
              // 500 requests per 5 minutes per IP (AC1)
              // WAF evaluates over a rolling 5-minute window
              limit: 500,
              aggregateKeyType: "IP",
            },
          },
        },
      ],
    });

    NagSuppressions.addResourceSuppressions(
      this.webAcl,
      [
        {
          id: "AwsSolutions-WAF1",
          reason:
            "WAF logging will be configured when API Gateway stack is created. Rate limiting stack is preparatory.",
        },
      ],
      true
    );

    // Outputs for API Gateway stack to consume
    new cdk.CfnOutput(this, "WebAclArn", {
      value: this.webAcl.attrArn,
      description: "WAF WebACL ARN for API Gateway association",
      exportName: "AiLearningHub-RateLimitWebAclArn",
    });

    // Export recommended throttling settings for API Gateway stage (AC1: 100 req/s)
    new cdk.CfnOutput(this, "RecommendedThrottleRate", {
      value: "100",
      description:
        "Recommended API Gateway throttle rate (requests/second) per AC1",
      exportName: "AiLearningHub-ApiThrottleRate",
    });

    new cdk.CfnOutput(this, "RecommendedThrottleBurst", {
      value: "200",
      description: "Recommended API Gateway throttle burst capacity",
      exportName: "AiLearningHub-ApiThrottleBurst",
    });
  }
}
