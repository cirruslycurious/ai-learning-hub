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
 * URL validation (http/https only)
 */
export const urlSchema = z
  .string()
  .url()
  .refine(
    (url) => url.startsWith("http://") || url.startsWith("https://"),
    "URL must use http or https protocol"
  )
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
 * Resource type enum schema
 */
export const resourceTypeSchema = z.enum([
  "ARTICLE",
  "VIDEO",
  "PODCAST",
  "TUTORIAL",
  "DOCUMENTATION",
  "REPOSITORY",
  "OTHER",
]);

/**
 * Tutorial status enum schema
 */
export const tutorialStatusSchema = z.enum([
  "SAVED",
  "STARTED",
  "IN_PROGRESS",
  "COMPLETED",
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
 * Tags array schema (max 10 tags, each 1-50 chars)
 */
export const tagsSchema = z
  .array(z.string().min(1).max(50))
  .max(10)
  .default([])
  .describe("Array of tags (max 10, each 1-50 characters)");

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
 * API Key scopes array
 */
export const apiKeyScopesSchema = z
  .array(apiKeyScopeSchema)
  .min(1)
  .describe("API key permission scopes");
