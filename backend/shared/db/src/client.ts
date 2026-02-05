/**
 * DynamoDB client with X-Ray tracing
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * DynamoDB client configuration options
 */
export interface DynamoDBClientOptions {
  region?: string;
  endpoint?: string;
}

/**
 * Create a configured DynamoDB DocumentClient with X-Ray tracing
 */
export function createDynamoDBClient(
  options: DynamoDBClientOptions = {}
): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: options.region ?? process.env.AWS_REGION ?? "us-east-1",
    endpoint: options.endpoint ?? process.env.DYNAMODB_ENDPOINT,
  });

  // Create DocumentClient with marshalling options
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      // Convert empty strings to null (DynamoDB doesn't allow empty strings)
      convertEmptyValues: true,
      // Remove undefined values from objects
      removeUndefinedValues: true,
    },
    unmarshallOptions: {
      // Return numbers as native JS numbers (not strings)
      wrapNumbers: false,
    },
  });

  return docClient;
}

// Default client instance
let defaultClient: DynamoDBDocumentClient | null = null;

/**
 * Get the default DynamoDB client (singleton)
 */
export function getDefaultClient(): DynamoDBDocumentClient {
  if (!defaultClient) {
    defaultClient = createDynamoDBClient();
  }
  return defaultClient;
}

/**
 * Reset the default client (useful for testing)
 */
export function resetDefaultClient(): void {
  defaultClient = null;
}
