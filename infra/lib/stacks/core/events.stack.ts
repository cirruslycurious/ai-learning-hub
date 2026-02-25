/**
 * EventBridge Stack — Custom event bus for async domain events.
 *
 * Story 3.1b, Task 3: Create EventBridge CDK stack (AC4).
 * Story 3.1.8: Add CloudWatch Log Group + Rule for event observability.
 * ADR-003: EventBridge for async communication.
 */
import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface EventsStackProps extends cdk.StackProps {
  /** Stage name — controls log retention. "prod" = 90 days, otherwise 14 days. */
  readonly stage?: string;
}

export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly eventLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props?: EventsStackProps) {
    super(scope, id, props);

    // --- Event Bus ---
    this.eventBus = new events.EventBus(this, "EventBus", {
      eventBusName: "ai-learning-hub-events",
    });

    // --- CloudWatch Log Group for event observability (Story 3.1.8, AC2) ---
    const retention =
      props?.stage === "prod"
        ? logs.RetentionDays.THREE_MONTHS
        : logs.RetentionDays.TWO_WEEKS;

    this.eventLogGroup = new logs.LogGroup(this, "EventLogGroup", {
      logGroupName: "/aws/events/ai-learning-hub-events",
      retention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- EventBridge Rule: capture all ai-learning-hub events (Story 3.1.8, AC1, AC3) ---
    const logAllEventsRule = new events.Rule(this, "LogAllEventsRule", {
      eventBus: this.eventBus,
      eventPattern: {
        source: [{ prefix: "ai-learning-hub" }] as unknown as string[],
      },
      description: "Routes all ai-learning-hub events to CloudWatch Logs",
    });

    logAllEventsRule.addTarget(
      new targets.CloudWatchLogGroup(this.eventLogGroup)
    );

    // --- Stack Outputs ---
    new cdk.CfnOutput(this, "EventBusName", {
      value: this.eventBus.eventBusName,
      description: "EventBridge event bus name",
      exportName: "AiLearningHub-EventBusName",
    });

    new cdk.CfnOutput(this, "EventBusArn", {
      value: this.eventBus.eventBusArn,
      description: "EventBridge event bus ARN",
      exportName: "AiLearningHub-EventBusArn",
    });

    new cdk.CfnOutput(this, "EventLogGroupName", {
      value: this.eventLogGroup.logGroupName,
      description: "CloudWatch Log Group for EventBridge event logging",
      exportName: "AiLearningHub-EventLogGroupName",
    });
  }
}
