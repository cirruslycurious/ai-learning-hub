/**
 * Common validation schemas using Zod
 */
import { z } from "zod";

/** Default number of items per page (matches @ai-learning-hub/db) */
const DEFAULT_PAGE_SIZE = 25;

/** Maximum allowed items per page (matches @ai-learning-hub/db) */
const MAX_PAGE_SIZE = 100;

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
 * Canonical pagination query schema (Story 3.2.5, AC13).
 * Single schema used across ALL list endpoints. Uses constants from @ai-learning-hub/db.
 * For API Gateway query params (strings) — limit is coerced from string to number.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Number of items per page (1-${MAX_PAGE_SIZE})`),
  cursor: z
    .string()
    .max(2048, "Cursor token too long")
    .optional()
    .describe("Cursor for pagination (from previous response)"),
});

/**
 * Pagination parameters schema (for typed/JSON input; expects numeric limit).
 * For API Gateway query params (where limit is a string), use paginationQuerySchema instead.
 */
export const paginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Number of items per page (1-${MAX_PAGE_SIZE})`),
  cursor: z
    .string()
    .max(2048, "Cursor token too long")
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
 * API Key scope schema (Story 3.2.6, AC1).
 * 5 named permission tiers + 2 legacy values for backward compatibility.
 */
export const apiKeyScopeSchema = z.enum([
  "full",
  "capture",
  "read",
  "saves:write",
  "projects:write",
  "*",
  "saves:read",
]);

/**
 * API Key scopes array (Story 3.2.6, AC12).
 * Normalizes `*` to `full` on creation, deduplicates.
 */
export const apiKeyScopesSchema = z
  .array(apiKeyScopeSchema)
  .min(1)
  .transform((scopes) =>
    Array.from(new Set(scopes.map((s) => (s === "*" ? "full" : s))))
  )
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
 * List saves query schema (GET /saves) — Story 3.2.5, AC6, AC13
 * Extends paginationQuerySchema with filter, search, and sort params.
 * `nextToken` renamed to `cursor` per AC6.
 */
export const listSavesQuerySchema = paginationQuerySchema.extend({
  contentType: contentTypeSchema.optional(),
  linkStatus: z.enum(["linked", "unlinked"]).optional(),
  search: z.string().min(1).max(200).optional(),
  sort: z.enum(["createdAt", "lastAccessedAt", "title"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

/**
 * Save ID path parameter schema — validates :saveId as a 26-character ULID.
 * Used by saves-get, saves-update, saves-delete, saves-restore handlers.
 */
export const saveIdPathSchema = z.object({
  saveId: z
    .string()
    .regex(/^[0-9A-Z]{26}$/, "saveId must be a 26-character ULID"),
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
