/**
 * smoke-test/cloudwatch-helpers.ts
 * CloudWatch Logs query helper with retry logic for EventBridge verification.
 *
 * Story 3.1.9: Queries CloudWatch Logs to verify EventBridge event delivery.
 * Uses dynamic import() for @aws-sdk/client-cloudwatch-logs to avoid crashing
 * the runner when the package isn't installed (non-Phase-7 runs).
 */

export interface LogEventMatch {
  /** The full parsed EventBridge envelope */
  detailType: string;
  source: string;
  detail: Record<string, unknown>;
}

export interface WaitForLogEventOptions {
  /** Max number of retries (default: 3) */
  maxRetries?: number;
  /** Milliseconds between retries (default: 5000) */
  retryIntervalMs?: number;
}

/**
 * Poll CloudWatch Logs for an EventBridge event matching the given saveId and detailType.
 *
 * @param logGroupName - CloudWatch Log Group name (e.g., /aws/events/ai-learning-hub-events)
 * @param saveId - The saveId to search for in event detail
 * @param detailType - The detail-type to match (e.g., SaveCreated, SaveUpdated, SaveDeleted)
 * @param queryStartEpochMs - Epoch ms to bound the query window (exclude old events)
 * @param options - Retry configuration
 * @returns Parsed event match on success
 * @throws On timeout or permission errors
 */
export async function waitForLogEvent(
  logGroupName: string,
  saveId: string,
  detailType: string,
  queryStartEpochMs: number,
  options: WaitForLogEventOptions = {}
): Promise<LogEventMatch> {
  const maxRetries = options.maxRetries ?? 3;
  const retryIntervalMs = options.retryIntervalMs ?? 5000;

  // Dynamic import to avoid hard dependency for non-Phase-7 runs
  const { CloudWatchLogsClient, FilterLogEventsCommand } =
    await import("@aws-sdk/client-cloudwatch-logs");

  const cwlClient = new CloudWatchLogsClient({});
  const filterPattern = `{ $.detail.saveId = "${saveId}" && $["detail-type"] = "${detailType}" }`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      await sleep(retryIntervalMs);
    }

    let result;
    try {
      result = await cwlClient.send(
        new FilterLogEventsCommand({
          logGroupName,
          filterPattern,
          startTime: queryStartEpochMs,
        })
      );
    } catch (err: unknown) {
      // Detect permission errors on first call and provide helpful message
      if (
        attempt === 1 &&
        err instanceof Error &&
        err.name === "AccessDeniedException"
      ) {
        throw new Error(
          "Missing logs:FilterLogEvents permission. Ensure your AWS credentials have CloudWatch Logs read access."
        );
      }
      throw err;
    }

    const events = result.events ?? [];
    if (events.length > 0) {
      // Parse the first matching log event
      const message = events[0].message;
      if (!message) {
        throw new Error(
          `CloudWatch log event has no message field (attempt ${attempt})`
        );
      }

      const parsed = JSON.parse(message);
      return {
        detailType: parsed["detail-type"],
        source: parsed.source,
        detail: parsed.detail,
      };
    }
  }

  throw new Error(
    `EventBridge event not found in CloudWatch Logs after ${(maxRetries * retryIntervalMs) / 1000}s ` +
      `(saveId=${saveId}, detailType=${detailType}, logGroup=${logGroupName})`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
