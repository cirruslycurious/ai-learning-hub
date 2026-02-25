import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { describe, it, expect } from "vitest";
import { EventsStack } from "../../../lib/stacks/core/events.stack";
import { getAwsEnv } from "../../../config/aws-env";

describe("EventsStack", () => {
  const app = new App();
  const awsEnv = getAwsEnv();
  const stack = new EventsStack(app, "TestEventsStack", { env: awsEnv });
  const template = Template.fromStack(stack);

  describe("EventBus", () => {
    it("should create an EventBridge event bus", () => {
      template.hasResourceProperties("AWS::Events::EventBus", {
        Name: "ai-learning-hub-events",
      });
    });
  });

  describe("CloudWatch Log Group (AC2, AC4)", () => {
    it("should create a log group for event bus logging", () => {
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/aws/events/ai-learning-hub-events",
      });
    });

    it("should set retention to 14 days by default", () => {
      template.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/aws/events/ai-learning-hub-events",
        RetentionInDays: 14,
      });
    });

    it("should set retention to 90 days for prod stage", () => {
      const prodApp = new App();
      const prodStack = new EventsStack(prodApp, "ProdEventsStack", {
        env: awsEnv,
        stage: "prod",
      });
      const prodTemplate = Template.fromStack(prodStack);
      prodTemplate.hasResourceProperties("AWS::Logs::LogGroup", {
        LogGroupName: "/aws/events/ai-learning-hub-events",
        RetentionInDays: 90,
      });
    });

    it("should have DESTROY removal policy for non-prod (ephemeral observability data)", () => {
      template.hasResource("AWS::Logs::LogGroup", {
        DeletionPolicy: "Delete",
      });
    });

    it("should have RETAIN removal policy for prod stage", () => {
      const prodApp = new App();
      const prodStack = new EventsStack(prodApp, "ProdEventsStack", {
        env: awsEnv,
        stage: "prod",
      });
      const prodTemplate = Template.fromStack(prodStack);
      prodTemplate.hasResource("AWS::Logs::LogGroup", {
        DeletionPolicy: "Retain",
      });
    });
  });

  describe("EventBridge Rule (AC1, AC3)", () => {
    it("should create a rule matching ai-learning-hub source prefix", () => {
      template.hasResourceProperties("AWS::Events::Rule", {
        EventPattern: {
          source: [{ prefix: "ai-learning-hub" }],
        },
      });
    });

    it("should target the CloudWatch Log Group", () => {
      template.hasResourceProperties("AWS::Events::Rule", {
        Targets: Match.arrayWith([
          Match.objectLike({
            Arn: Match.objectLike({
              "Fn::Join": Match.anyValue(),
            }),
          }),
        ]),
      });
    });

    it("should use the custom event bus, not the default bus", () => {
      template.hasResourceProperties("AWS::Events::Rule", {
        EventBusName: Match.objectLike({
          Ref: Match.anyValue(),
        }),
      });
    });
  });

  describe("Stack Outputs", () => {
    it("should export event bus name", () => {
      const outputs = template.findOutputs("*");
      const outputKeys = Object.keys(outputs);
      expect(outputKeys).toContain("EventBusName");
    });

    it("should export event bus ARN", () => {
      const outputs = template.findOutputs("*");
      const outputKeys = Object.keys(outputs);
      expect(outputKeys).toContain("EventBusArn");
    });

    it("should export event log group name (AC2)", () => {
      const outputs = template.findOutputs("*");
      const outputKeys = Object.keys(outputs);
      expect(outputKeys).toContain("EventLogGroupName");
    });
  });
});
