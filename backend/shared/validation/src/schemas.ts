/**
 * Common validation schemas using Zod
 */
import { z } from "zod";

/**
 * UUID v4 format validation
 */
export const uuidSchema = z
  .string()
  .uuid()
  .describe("UUID v4 format identifier");

/**
 * URL validation (http/https only, no embedded credentials)
 */
export const urlSchema = z
  .string()
  .url()
  .refine(
    (url) => url.startsWith("http://") || url.startsWith("https://"),
    "URL must use http or https protocol"
  )
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return !parsed.username && !parsed.password;
    } catch {
      return true; // Let the .url() check above handle malformed URLs
    }
  }, "URLs with embedded credentials are not allowed")
  .describe("Valid HTTP/HTTPS URL");

/**
 * Email validation
 */
export const emailSchema = z.string().email().describe("Valid email address");

/**
 * Non-empty string validation
 */
export const nonEmptyStringSchema = z
  .string()
  .min(1, "String cannot be empty")
  .describe("Non-empty string");

/**
 * Pagination parameters schema (for typed/JSON input; expects numeric limit).
 * For API Gateway query params (where limit is a string), use paginationQuerySchema instead.
 */
export const paginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of items per page (1-100)"),
  cursor: z
    .string()
    .optional()
    .describe("Cursor for pagination (from previous response)"),
});

/**
 * Pagination schema for API Gateway query params (strings).
 * Use with validateQueryParams(); limit is coerced from string to number.
 * Prefer this over paginationSchema when validating event.queryStringParameters.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of items per page (1-100)"),
  cursor: z
    .string()
    .optional()
    .describe("Cursor for pagination (from previous response)"),
});

/**
 * Sort direction
 */
export const sortDirectionSchema = z.enum(["asc", "desc"]).default("desc");

/**
 * ISO 8601 date string
 */
export const isoDateSchema = z
  .string()
  .refine(
    (val) => !isNaN(Date.parse(val)),
    "Must be a valid ISO 8601 date string"
  )
  .describe("ISO 8601 date string");

/**
 * Content type enum schema (Epic 3 — lowercase values)
 */
export const contentTypeSchema = z.enum([
  "article",
  "video",
  "podcast",
  "github_repo",
  "newsletter",
  "tool",
  "reddit",
  "linkedin",
  "other",
]);

/**
 * Tutorial status enum schema (lowercase, per PRD FR40)
 */
export const tutorialStatusSchema = z.enum([
  "saved",
  "started",
  "in-progress",
  "completed",
]);

/**
 * Project status enum schema
 */
export const projectStatusSchema = z.enum([
  "EXPLORING",
  "BUILDING",
  "PAUSED",
  "COMPLETED",
]);

/**
 * Tags array schema (max 20 tags, each 1-50 chars, trimmed and deduplicated)
 */
export const tagsSchema = z
  .array(z.string().trim().min(1, "Tag cannot be empty").max(50))
  .max(20)
  .default([])
  .transform((tags) => Array.from(new Set(tags)))
  .describe(
    "Array of tags (max 20, each 1-50 characters, trimmed and deduplicated)"
  );

/**
 * User ID schema (Clerk format)
 */
export const userIdSchema = z
  .string()
  .min(1)
  .max(255)
  .describe("User identifier from Clerk");

/**
 * API Key scope schema
 */
export const apiKeyScopeSchema = z.enum(["*", "saves:write", "saves:read"]);

/**
 * API Key scopes array (duplicates are automatically removed)
 */
export const apiKeyScopesSchema = z
  .array(apiKeyScopeSchema)
  .min(1)
  .transform((scopes) => Array.from(new Set(scopes)))
  .describe("API key permission scopes");

/**
 * Update profile request body (PATCH /users/me)
 * At least one field must be provided.
 */
export const updateProfileBodySchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Display name cannot be empty")
      .max(255, "Display name too long")
      .optional(),
    globalPreferences: z
      .record(z.unknown())
      .refine((obj) => JSON.stringify(obj).length <= 10240, {
        message: "globalPreferences must be under 10KB",
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.displayName !== undefined || data.globalPreferences !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

/**
 * Invite code validation request body schema
 * Code format: 8-16 alphanumeric characters (128-bit entropy)
 */
export const validateInviteBodySchema = z.object({
  code: z
    .string()
    .min(8)
    .max(16)
    .regex(/^[a-zA-Z0-9]+$/, "Code must be alphanumeric")
    .describe("Invite code (8-16 alphanumeric characters)"),
});

/**
 * Create save request body schema (POST /saves)
 */
export const createSaveSchema = z.object({
  url: urlSchema,
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(500, "Title must be 500 characters or less")
    .optional(),
  userNotes: z
    .string()
    .trim()
    .min(1, "Notes cannot be empty")
    .max(2000, "User notes must be 2000 characters or less")
    .optional(),
  contentType: contentTypeSchema.optional(),
  tags: tagsSchema,
});

/**
 * Update save request body schema (PATCH /saves/:saveId)
 * URL fields NOT included (immutable after creation).
 * At least one field required.
 */
export const updateSaveSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(500, "Title must be 500 characters or less")
      .optional(),
    userNotes: z
      .string()
      .trim()
      .min(1, "Notes cannot be empty")
      .max(2000, "User notes must be 2000 characters or less")
      .optional(),
    contentType: contentTypeSchema.optional(),
    tags: tagsSchema.optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.userNotes !== undefined ||
      data.contentType !== undefined ||
      data.tags !== undefined,
    {
      message: "At least one field must be provided",
    }
  );
