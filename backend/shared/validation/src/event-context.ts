/**
 * Event context metadata Zod schema (Story 3.2.4, FR104)
 *
 * Validates the `context` field from request bodies. Mirrors the
 * EventContext type from @ai-learning-hub/types/src/events.ts.
 *
 * Usage by handlers (in 3.2.7 retrofit):
 *   const bodySchema = z.object({ url: urlSchema, context: eventContextSchema });
 */
import { z } from "zod";

export const eventContextSchema = z
  .object({
    trigger: z.string().max(100).optional(),
    source: z.string().max(200).optional(),
    confidence: z.number().min(0).max(1).optional(),
    upstream_ref: z.string().max(500).optional(),
  })
  .strict()
  .optional();
