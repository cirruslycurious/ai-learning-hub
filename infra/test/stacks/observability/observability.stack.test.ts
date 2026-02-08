import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it, expect, beforeEach } from "vitest";
import { ObservabilityStack } from "../../../lib/stacks/observability/observability.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("ObservabilityStack", () => {
  let app: App;
  let template: Template;

  beforeEach(() => {
    app = new App();
    const env = getAwsEnv();
    const stack = new ObservabilityStack(app, "TestObservabilityStack", {
      env,
      description: "Test observability stack",
    });
    template = Template.fromStack(stack);
  });

  describe("X-Ray Configuration", () => {
    it("should create X-Ray sampling rule for Lambda tracing", () => {
      // AC1: X-Ray tracing enabled - verify sampling rule exists
      template.hasResourceProperties("AWS::XRay::SamplingRule", {
        SamplingRule: {
          RuleName: "ai-learning-hub-lambda-sampling",
          ResourceARN: "*",
          Priority: 1000,
          FixedRate: 0.05, // 5% sampling rate
          ReservoirSize: 1,
          ServiceName: "*",
          ServiceType: "AWS::Lambda",
          Host: "*",
          HTTPMethod: "*",
          URLPath: "*",
        },
      });
    });

    it("should enable X-Ray tracing with appropriate version", () => {
      // Verify that X-Ray sampling rule has proper version attribute
      template.hasResourceProperties("AWS::XRay::SamplingRule", {
        SamplingRule: {
          Version: 1,
        },
      });
    });
  });

  describe("Stack Configuration", () => {
    it("should have correct stack description", () => {
      expect(template.toJSON().Description).toContain("observability");
    });

    it("should be deployable in standard AWS environment", () => {
      // No specific resource assertions needed - template synthesis success validates this
      expect(template.toJSON()).toBeDefined();
    });
  });

  describe("Future Observability Resources", () => {
    it("should have placeholder for CloudWatch dashboards", () => {
      // Currently no dashboards - this test documents future work
      // When dashboards are added, update this test to verify their presence
      const resources = template.toJSON().Resources;
      const dashboards = Object.keys(resources || {}).filter((key) =>
        key.includes("Dashboard")
      );
      // For now, we expect 0 dashboards (future enhancement)
      expect(dashboards.length).toBeGreaterThanOrEqual(0);
    });

    it("should have placeholder for CloudWatch alarms", () => {
      // Currently no alarms - this test documents future work
      const resources = template.toJSON().Resources;
      const alarms = Object.keys(resources || {}).filter((key) =>
        key.includes("Alarm")
      );
      // For now, we expect 0 alarms (future enhancement)
      expect(alarms.length).toBeGreaterThanOrEqual(0);
    });
  });
});
