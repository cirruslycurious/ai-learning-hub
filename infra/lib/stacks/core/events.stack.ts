/**
 * EventBridge Stack — Custom event bus for async domain events.
 *
 * Story 3.1b, Task 3: Create EventBridge CDK stack (AC4).
 * ADR-003: EventBridge for async communication.
 */
import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import { Construct } from "constructs";

export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.eventBus = new events.EventBus(this, "EventBus", {
      eventBusName: "ai-learning-hub-events",
    });

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
  }
}
