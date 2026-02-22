import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import type { Logger } from "@ai-learning-hub/logging";

export interface EventEntry<
  TDetailType extends string,
  TDetail extends object,
> {
  source: string;
  detailType: TDetailType;
  detail: TDetail;
}

export function emitEvent<TDetailType extends string, TDetail extends object>(
  client: EventBridgeClient,
  busName: string,
  entry: EventEntry<TDetailType, TDetail>,
  logger: Logger
): void {
  // Fire-and-forget: async work runs in a detached IIFE. Return type is void so
  // callers cannot accidentally await this function and block the response path.
  void (async () => {
    try {
      // JSON.stringify constraints: undefined fields are silently omitted,
      // Date objects serialize to ISO strings, circular references throw (caught
      // below). Callers must pass plain serializable objects — no class instances.
      const result = await client.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: entry.source,
              DetailType: entry.detailType,
              Detail: JSON.stringify(entry.detail),
              EventBusName: busName,
            },
          ],
        })
      );
      if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        logger.warn("EventBridge PutEvents partial failure (non-fatal)", {
          detailType: entry.detailType,
          failedCount: result.FailedEntryCount,
          errorCode: result.Entries?.[0]?.ErrorCode,
          errorMessage: result.Entries?.[0]?.ErrorMessage,
        });
      }
    } catch (err) {
      // Inner try/catch around logger.warn is REQUIRED: if logger.warn throws
      // (logging library bug, serialization error), the exception would propagate
      // out of this catch block into the detached IIFE's promise. In Node 20,
      // unhandled promise rejections terminate the process — crashing the Lambda.
      try {
        logger.warn("EventBridge PutEvents failed (non-fatal)", {
          detailType: entry.detailType,
          error: err instanceof Error ? err.message : String(err),
        });
      } catch {
        // logger itself failed — nothing safe to do here
      }
    }
  })();
}
