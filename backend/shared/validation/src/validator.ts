/**
 * Validation utilities and error formatting
 */
import { z, ZodError, ZodSchema } from "zod";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

/**
 * Validation error details (AC6: enhanced with constraint and allowed_values)
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  constraint?: string;
  allowed_values?: string[];
}

/**
 * Format Zod errors into a structured array (AC7: constraint extraction)
 */
export function formatZodErrors(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map((err) => {
    const detail: ValidationErrorDetail = {
      field: err.path.join(".") || "root",
      message: err.message,
      code: err.code,
    };

    // Extract constraint info from Zod error metadata (AC7)
    if (err.code === "too_small") {
      detail.constraint = `minimum ${(err as z.ZodTooSmallIssue).minimum}`;
    } else if (err.code === "too_big") {
      detail.constraint = `maximum ${(err as z.ZodTooBigIssue).maximum}`;
    } else if (err.code === "invalid_enum_value") {
      detail.allowed_values = (err as z.ZodInvalidEnumValueIssue)
        .options as string[];
    } else if (err.code === "invalid_string") {
      const validation = (err as z.ZodInvalidStringIssue).validation;
      if (typeof validation === "string") {
        detail.constraint = `expected ${validation}`;
      }
    }

    return detail;
  });
}

/**
 * Validate data against a Zod schema
 * @throws AppError with VALIDATION_ERROR code if validation fails
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const details = formatZodErrors(result.error);
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Validation failed", {
      fields: details,
    });
  }

  return result.data;
}

/**
 * Validate data without throwing (returns result object)
 */
export function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; errors: ValidationErrorDetail[] } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: formatZodErrors(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Parse JSON body and validate against schema
 * @throws AppError with VALIDATION_ERROR if JSON is invalid or validation fails
 */
export function validateJsonBody<T>(
  schema: ZodSchema<T>,
  body: string | null | undefined
): T {
  if (!body) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Request body is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Invalid JSON in request body"
    );
  }

  return validate(schema, parsed);
}

/**
 * Validate query string parameters
 */
export function validateQueryParams<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | undefined> | null | undefined
): T {
  return validate(schema, params ?? {});
}

/**
 * Validate path parameters
 */
export function validatePathParams<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | undefined> | null | undefined
): T {
  if (!params) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Path parameters are required"
    );
  }
  return validate(schema, params);
}

// Re-export Zod for convenience
export { z, ZodError, type ZodSchema };
