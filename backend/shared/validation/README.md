# @ai-learning-hub/validation

Zod-based validation utilities and shared schemas for Lambda handlers. Check here before defining a new schema — the common ones are already exported.

## Quick start

```ts
import {
  validate,
  validateJsonBody,
  validateQueryParams,
} from "@ai-learning-hub/validation";
import { createSaveSchema } from "@ai-learning-hub/validation";

// Parse and validate a JSON request body
const body = validateJsonBody(event, createSaveSchema);

// Parse and validate query string parameters (strings auto-coerced where needed)
const query = validateQueryParams(event, listSavesQuerySchema);
```

## Validation utilities

```ts
import {
  validate,
  safeValidate,
  validateJsonBody,
  validateQueryParams,
  validatePathParams,
  formatZodErrors,
  z,
  ZodError,
} from "@ai-learning-hub/validation";
import type {
  ValidationErrorDetail,
  ZodSchema,
} from "@ai-learning-hub/validation";
```

| Function                             | Throws                       | Description                                                                                         |
| ------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `validate(schema, data)`             | `AppError(VALIDATION_ERROR)` | Parse data; throw structured error on failure                                                       |
| `safeValidate(schema, data)`         | Never                        | Returns `{ success, data }` or `{ success: false, error }`                                          |
| `validateJsonBody(event, schema)`    | `AppError(VALIDATION_ERROR)` | Parse `event.body` as JSON then validate                                                            |
| `validateQueryParams(event, schema)` | `AppError(VALIDATION_ERROR)` | Parse `event.queryStringParameters` then validate                                                   |
| `validatePathParams(event, schema)`  | `AppError(VALIDATION_ERROR)` | Parse `event.pathParameters` then validate                                                          |
| `formatZodErrors(error)`             | —                            | Map `ZodError` to `ValidationErrorDetail[]` with `field`, `message`, `constraint`, `allowed_values` |

Validation errors are automatically serialised to the standard error contract by `wrapHandler` — no manual error handling needed.

**Note on query params:** API Gateway passes all query string values as strings. Use `paginationQuerySchema` (not `paginationSchema`) for query-string pagination params — it coerces `limit` from string to number.

## Exported schemas

### Primitives

| Export                 | Validates                                            |
| ---------------------- | ---------------------------------------------------- |
| `uuidSchema`           | UUID v4 string                                       |
| `urlSchema`            | `http://` or `https://` URL, no embedded credentials |
| `emailSchema`          | Email address                                        |
| `nonEmptyStringSchema` | Non-empty, trimmed string                            |
| `isoDateSchema`        | ISO 8601 date string                                 |
| `userIdSchema`         | Clerk user ID string                                 |

### Pagination

| Export                  | Use case                                                         |
| ----------------------- | ---------------------------------------------------------------- |
| `paginationSchema`      | Cursor + limit — use for JSON body or pre-parsed values          |
| `paginationQuerySchema` | Cursor + limit from query string — coerces `limit` from `string` |
| `sortDirectionSchema`   | `"asc"` \| `"desc"`                                              |

### Domain schemas

| Export                        | Shape                                                   |
| ----------------------------- | ------------------------------------------------------- |
| `createSaveSchema`            | `{ url, title?, tags?, contentType?, tutorialStatus? }` |
| `updateSaveSchema`            | Partial save fields for PATCH                           |
| `updateMetadataCommandSchema` | Metadata update command                                 |
| `listSavesQuerySchema`        | Filtering + sorting + pagination for GET /saves         |
| `saveIdPathSchema`            | `{ saveId: uuid }`                                      |
| `apiKeyIdPathSchema`          | `{ keyId: uuid }`                                       |

### Auth / user schemas

| Export                     | Shape                      |
| -------------------------- | -------------------------- |
| `updateProfileBodySchema`  | `{ displayName?, bio? }`   |
| `validateInviteBodySchema` | `{ inviteCode }`           |
| `apiKeyScopeSchema`        | Single `ApiKeyScope` value |
| `apiKeyScopesSchema`       | Array of `ApiKeyScope`     |

### Enum schemas

| Export                 | Values                             |
| ---------------------- | ---------------------------------- |
| `contentTypeSchema`    | `ContentType` enum values          |
| `tutorialStatusSchema` | `TutorialStatus` enum values       |
| `projectStatusSchema`  | `ProjectStatus` enum values        |
| `tagsSchema`           | Array of non-empty strings, max 20 |

### Other utilities

```ts
import { normalizeUrl, NormalizeError } from "@ai-learning-hub/validation";
import type { NormalizeResult } from "@ai-learning-hub/validation";

import { detectContentType } from "@ai-learning-hub/validation";
import { eventContextSchema } from "@ai-learning-hub/validation";
```

- `normalizeUrl(url)` — canonicalise a URL (lowercase host, strip tracking params, etc.); throws `NormalizeError` on invalid input
- `detectContentType(url)` — heuristic content-type detection from URL pattern
- `eventContextSchema` — Zod schema for `X-Agent-ID` / actor-type event context metadata

## Direct Zod access

The package re-exports `z`, `ZodError`, and `ZodSchema` so handlers don't need a separate `zod` import:

```ts
import { z } from "@ai-learning-hub/validation";

const mySchema = z.object({ name: z.string().min(1) });
```
