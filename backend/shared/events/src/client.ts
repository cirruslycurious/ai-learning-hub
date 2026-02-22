/**
 * EventBridge client for Lambda.
 *
 * X-Ray: Lambda injects _X_AMZN_TRACE_ID; trace ID is available via env for
 * logging/correlation. EventBridge subsegment capture (aws-xray-sdk) is deferred
 * to a later story; use the Lambda trace for request-level tracing until then.
 */
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

let defaultClient: EventBridgeClient | null = null;

export function createEventBridgeClient(
  options: { region?: string } = {}
): EventBridgeClient {
  return new EventBridgeClient({
    region: options.region ?? process.env.AWS_REGION ?? "us-east-1",
  });
}

export function getDefaultClient(): EventBridgeClient {
  if (!defaultClient) {
    defaultClient = createEventBridgeClient();
  }
  return defaultClient;
}

/**
 * @internal — for test teardown only. Do not call in production code.
 */
export function resetDefaultClient(): void {
  defaultClient = null;
}
