/**
 * Validation schemas for API Keys endpoints (Story 2.6).
 */
import { apiKeyScopesSchema, z } from "@ai-learning-hub/validation";

/**
 * Create API key request body (POST /users/api-keys).
 *
 * AC1: name + scopes required.
 * AC4: scopes: ['saves:write'] creates capture-only key.
 * AC6: Invalid scopes return 400.
 */
export const createApiKeyBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "API key name is required")
    .max(255, "API key name too long"),
  scopes: apiKeyScopesSchema,
});
