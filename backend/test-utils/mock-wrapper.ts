/**
 * Shared test mock utilities for handler tests.
 *
 * Extracts duplicated wrapHandler mock setup, event factories, and logger
 * mocks that were repeated across 4+ handler test files.
 *
 * Story 2.1-D3: wrapHandler Test Mock Dedup
 */
import { vi } from "vitest";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";

/** Shape of a mock logger matching @ai-learning-hub/logging Logger */
export interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  timed: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
  setRequestContext: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock logger object matching the @ai-learning-hub/logging Logger shape.
 */
export function createMockLogger(): MockLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    timed: vi.fn(),
    child: vi.fn().mockReturnThis(),
    setRequestContext: vi.fn(),
  };
}

/**
 * Returns a vi.mock factory for @ai-learning-hub/logging.
 * Usage: `vi.mock("@ai-learning-hub/logging", () => mockCreateLoggerModule());`
 */
export function mockCreateLoggerModule(): { createLogger: () => MockLogger } {
  return {
    createLogger: () => createMockLogger(),
  };
}

/**
 * Creates a mock Lambda context object.
 */
export function createMockContext(): Context {
  return {} as Context;
}

export interface MockEventOptions {
  method?: string;
  path?: string;
  body?: Record<string, unknown> | null;
  userId?: string;
  role?: string;
  authMethod?: string;
  scopes?: string[];
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
}

/**
 * Creates a properly shaped APIGatewayProxyEvent for handler tests.
 *
 * Supports configurable auth context (userId, role, authMethod, scopes)
 * and all standard event fields.
 */
export function createMockEvent(
  options: MockEventOptions = {}
): APIGatewayProxyEvent {
  const {
    method = "GET",
    path = "/test",
    body = null,
    userId,
    role = "user",
    authMethod = "jwt",
    scopes,
    pathParameters = null,
    queryStringParameters = null,
  } = options;

  return {
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
    headers: { "Content-Type": "application/json" },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters,
    queryStringParameters,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: path,
    requestContext: {
      accountId: "123456789",
      apiId: "api-id",
      authorizer: userId
        ? {
            userId,
            role,
            authMethod,
            ...(authMethod === "api-key" ? { isApiKey: "true" } : {}),
            ...(scopes ? { scopes } : {}),
          }
        : undefined,
      protocol: "HTTP/1.1",
      httpMethod: method,
      identity: {
        sourceIp: "127.0.0.1",
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userAgent: null,
        userArn: null,
      },
      path,
      stage: "dev",
      requestId: "test-request-id",
      requestTimeEpoch: Date.now(),
      resourceId: "resource-id",
      resourcePath: path,
    },
  };
}

export interface MockMiddlewareOptions {
  /** Additional middleware exports to include (e.g., getClerkSecretKey) */
  extraExports?: Record<string, unknown>;
}

/**
 * Returns a vi.mock factory for @ai-learning-hub/middleware that includes
 * the wrapHandler mock and standard helper mocks.
 *
 * Usage: `vi.mock("@ai-learning-hub/middleware", () => mockMiddlewareModule());`
 */
export interface MockMiddlewareModule {
  wrapHandler: (
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    handler: Function,
    opts: Record<string, unknown>
  ) => (
    event: APIGatewayProxyEvent,
    context: Context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>;
  extractAuthContext: ReturnType<typeof vi.fn>;
  requireAuth: ReturnType<typeof vi.fn>;
  createSuccessResponse: (
    data: unknown,
    requestId: string,
    statusCode?: number
  ) => { statusCode: number; headers: Record<string, string>; body: string };
  createNoContentResponse: (requestId: string) => {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
  handleError: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

export function mockMiddlewareModule(
  options: MockMiddlewareOptions = {}
): MockMiddlewareModule {
  const { extraExports = {} } = options;

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    wrapHandler: (handler: Function, opts: Record<string, unknown>) => {
      return async (event: APIGatewayProxyEvent, context: Context) => {
        // Simulate auth requirement
        if (opts.requireAuth) {
          const authorizer = event.requestContext?.authorizer;
          if (!authorizer?.userId) {
            return {
              statusCode: 401,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                error: {
                  code: "UNAUTHORIZED",
                  message: "Authentication required",
                  requestId: "test-req-id",
                },
              }),
            };
          }
        }

        // Simulate scope enforcement for API key auth (AC15)
        // Match real middleware: check isApiKey field (boolean or string "true")
        if (opts.requiredScope) {
          const authorizer = event.requestContext?.authorizer;
          if (
            authorizer?.isApiKey === true ||
            authorizer?.isApiKey === "true"
          ) {
            const rawScopes = authorizer.scopes;
            let scopes: string[] = [];
            if (Array.isArray(rawScopes)) {
              scopes = rawScopes;
            } else if (typeof rawScopes === "string") {
              try {
                const parsed = JSON.parse(rawScopes);
                scopes = Array.isArray(parsed) ? parsed : [];
              } catch {
                scopes = [];
              }
            }
            if (
              !scopes.includes("*") &&
              !scopes.includes(opts.requiredScope as string)
            ) {
              return {
                statusCode: 403,
                headers: {
                  "Content-Type": "application/json",
                  "X-Request-Id": "test-req-id",
                },
                body: JSON.stringify({
                  error: {
                    code: "SCOPE_INSUFFICIENT",
                    message: "API key lacks required scope",
                    requestId: "test-req-id",
                  },
                }),
              };
            }
          }
        }

        const authorizer = event.requestContext?.authorizer;
        let auth = null;
        if (authorizer) {
          // Parse scopes: may be an array (from test code) or a JSON string
          // (from API Gateway). Mirrors real middleware behavior.
          const rawScopes = authorizer.scopes;
          let scopes: string[] | undefined;
          if (Array.isArray(rawScopes)) {
            scopes = rawScopes;
          } else if (typeof rawScopes === "string") {
            try {
              const parsed = JSON.parse(rawScopes);
              scopes = Array.isArray(parsed) ? parsed : undefined;
            } catch {
              scopes = undefined;
            }
          }

          auth = {
            userId: authorizer.userId as string,
            roles: [(authorizer.role as string) || "user"],
            // Match real middleware: check isApiKey field (boolean or string "true")
            isApiKey:
              authorizer.isApiKey === true || authorizer.isApiKey === "true",
            ...(scopes ? { scopes } : {}),
          };
        }

        try {
          const result = await handler({
            event,
            context,
            auth,
            requestId: "test-req-id",
            logger: createMockLogger(),
            startTime: Date.now(),
          });

          // If result is already an API Gateway response, return as-is
          if (
            typeof result === "object" &&
            result !== null &&
            "statusCode" in result
          ) {
            return result;
          }

          // Auto-wrap success
          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Request-Id": "test-req-id",
            },
            body: JSON.stringify({ data: result }),
          };
        } catch (error: unknown) {
          const err = error as {
            code?: string;
            statusCode?: number;
            message?: string;
            details?: Record<string, unknown>;
          };
          const code = err.code ?? "INTERNAL_ERROR";
          const statusCode = err.statusCode ?? 500;
          const message = err.message ?? "An unexpected error occurred";
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-Request-Id": "test-req-id",
          };
          // Add Retry-After header for rate-limited responses (AC16)
          if (code === "RATE_LIMITED" && err.details?.retryAfter != null) {
            headers["Retry-After"] = String(err.details.retryAfter);
          }
          return {
            statusCode,
            headers,
            body: JSON.stringify({
              error: { code, message, requestId: "test-req-id" },
            }),
          };
        }
      };
    },
    extractAuthContext: vi.fn(),
    requireAuth: vi.fn(),
    createSuccessResponse: (
      data: unknown,
      requestId: string,
      statusCode = 200
    ) => ({
      statusCode,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
      body: JSON.stringify({ data }),
    }),
    createNoContentResponse: (requestId: string) => ({
      statusCode: 204,
      headers: {
        "X-Request-Id": requestId,
      },
      body: "",
    }),
    handleError: vi.fn(),
    ...extraExports,
  };
}
