/**
 * Batch operation Zod schemas (Story 3.2.9, AC6-AC7).
 *
 * Validates batch request body: operation array with method, path, body,
 * headers. Enforces max 25 operations, recursive batch prevention,
 * and unique Idempotency-Key values across operations.
 */
import { z } from "@ai-learning-hub/validation";

/**
 * Single batch operation schema.
 * Rejects paths targeting /batch to prevent recursive batch calls.
 */
export const batchOperationSchema = z.object({
  method: z.enum(["POST", "PATCH", "DELETE"]),
  path: z
    .string()
    .min(1)
    .refine((p) => !p.startsWith("/batch"), {
      message: "Batch operations cannot target /batch (recursive prevention)",
    }),
  body: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * Batch request schema.
 * Enforces 1-25 operations and unique Idempotency-Key values.
 */
export const batchRequestSchema = z
  .object({
    operations: z
      .array(batchOperationSchema)
      .min(1, "Batch must contain at least 1 operation")
      .max(25, "Batch cannot exceed 25 operations"),
  })
  .superRefine((data, ctx) => {
    // Validate unique Idempotency-Key values across all operations
    const keys = new Set<string>();
    for (let i = 0; i < data.operations.length; i++) {
      const key = data.operations[i].headers?.["Idempotency-Key"];
      if (key !== undefined) {
        if (keys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate Idempotency-Key "${key}" across operations`,
            path: ["operations", i, "headers", "Idempotency-Key"],
          });
        }
        keys.add(key);
      }
    }
  });

export type BatchOperationInput = z.infer<typeof batchOperationSchema>;
export type BatchRequestInput = z.infer<typeof batchRequestSchema>;
