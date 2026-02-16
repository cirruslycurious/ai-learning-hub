/**
 * Rate Limiting Stack tests (Story 2.7, AC1)
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { RateLimitingStack } from "../../../lib/stacks/api/rate-limiting.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("RateLimitingStack", () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const awsEnv = getAwsEnv();
    const stack = new RateLimitingStack(app, "TestRateLimiting", {
      env: awsEnv,
    });
    template = Template.fromStack(stack);
  });

  describe("WAF WebACL (AC1)", () => {
    it("creates a WAF WebACL", () => {
      template.resourceCountIs("AWS::WAFv2::WebACL", 1);
    });

    it("uses REGIONAL scope for API Gateway", () => {
      template.hasResourceProperties("AWS::WAFv2::WebACL", {
        Scope: "REGIONAL",
      });
    });

    it("has a rate-based rule with 500 req/5min limit", () => {
      template.hasResourceProperties("AWS::WAFv2::WebACL", {
        Rules: [
          {
            Name: "RateBasedRule",
            Action: { Block: {} },
            Statement: {
              RateBasedStatement: {
                Limit: 500,
                AggregateKeyType: "IP",
              },
            },
          },
        ],
      });
    });

    it("enables CloudWatch metrics", () => {
      template.hasResourceProperties("AWS::WAFv2::WebACL", {
        VisibilityConfig: {
          CloudWatchMetricsEnabled: true,
          SampledRequestsEnabled: true,
        },
      });
    });

    it("has default allow action", () => {
      template.hasResourceProperties("AWS::WAFv2::WebACL", {
        DefaultAction: { Allow: {} },
      });
    });
  });

  describe("Outputs", () => {
    it("exports the WebACL ARN", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.WebAclArn).toBeDefined();
    });

    it("exports the recommended throttle rate", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.RecommendedThrottleRate).toBeDefined();
    });

    it("exports the recommended throttle burst", () => {
      const outputs = template.findOutputs("*");
      expect(outputs.RecommendedThrottleBurst).toBeDefined();
    });
  });
});
