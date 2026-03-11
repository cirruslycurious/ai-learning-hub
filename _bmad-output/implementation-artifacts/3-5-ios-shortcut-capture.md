---
id: "3.5"
title: "iOS Shortcut Capture"
status: ready-for-dev
depends_on:
  - "3.1b"
  - "2.2"
touches:
  - frontend/public/shortcuts/ai-learning-hub.shortcut
  - frontend/src/pages/guides/IosShortcutSetup.tsx
  - frontend/src/App.tsx
risk: medium
---

# Story 3.5: iOS Shortcut Capture

## Story

As a mobile user on iPhone or iPad,
I want to tap "Save to AI Learning Hub" in my share sheet,
so that I can capture any URL in under 3 seconds without opening the app.

## Acceptance Criteria

1. **AC1: Share sheet integration** — An iOS Shortcut named "Save to AI Learning Hub" appears in the iPhone/iPad share sheet after the user installs it. The shortcut can be triggered from any app that surfaces the share sheet (Safari, podcasts, LinkedIn, YouTube, etc.). Requires iOS 16 or later; the shortcut binary sets minimum client version to iOS 16.

2. **AC2: URL capture and save** — When triggered, the shortcut extracts the shared URL and calls `POST /saves` with `x-api-key` header (capture-scoped) and body `{ "url": "<shared_url>" }`. The save is created within 3 seconds (FR46).

3. **AC3: Success confirmation** — On a successful save (HTTP 201) the shortcut displays an iOS native notification: "✓ Saved". Short and instant — no need to read it, just glance and continue.

4. **AC4: Duplicate handling** — On a duplicate URL (HTTP 409), the shortcut treats it as success and shows "✓ Saved to AI Learning Hub" — identical to a new save. No distinct duplicate message; the URL is in the library either way.

5. **AC5: Non-URL input guard** — If the shared content contains no extractable URL (e.g. plain text, image, file), the shortcut stops immediately and shows: "Nothing to save — share a link, not text or an image." No API call is made.

6. **AC6: Error notification** — On network failure or non-2xx/non-DUPLICATE_SAVE response, the shortcut shows an iOS native notification: "Couldn't save. Check your API key or connection."

7. **AC7: API key import question** — When the user first installs the shortcut, they are prompted (via one iOS Shortcuts Import Question) to enter their API key. The key is stored as a shortcut variable and used on every capture. The API base URL (`https://api.build.cirrusly-clever.com`) is hardcoded in the shortcut binary — no second Import Question.

8. **AC8: Downloadable shortcut file** — The `.shortcut` binary file is served from the frontend public path (`/shortcuts/ai-learning-hub.shortcut`) with `Content-Type: application/octet-stream`. A direct link opens the Shortcuts app installation flow on iOS.

9. **AC9: Setup guide page** — A page exists at `/guides/ios-shortcut-setup` that is publicly accessible (no auth required). The guide covers: generate a capture-scoped API key → install the shortcut → run it once to paste the key → test from the share sheet. The API key generation step includes an inline sign-in prompt for users who are not yet authenticated. The guide states the iOS 16+ requirement.

10. **AC10: Capture-scoped API key** — The guide directs users to generate an API key with the `capture` scope. The `capture` scope grants only `saves:create` and nothing else — verified in middleware's scope-resolver.

11. **AC11: Integration test** — A test exercises `POST /saves` with a `capture`-scoped mock API key and verifies a 201 response, confirming the entire auth+save pipeline works for the shortcut's request format.

## Tasks / Subtasks

- [ ] Task 1: Create the iOS Shortcut binary file (AC: #1, #2, #3, #4, #5, #6, #7)
  - [ ] 1.1 On an iPhone/iPad running iOS 16+, open the Shortcuts app and create a new shortcut following the exact action sequence in Dev Notes (includes the non-URL guard at Action 2b). Set the shortcut name to "Save to AI Learning Hub". Add **one** Import Question for the API key only — the API URL `https://api.build.cirrusly-clever.com` is hardcoded in Action 4.
  - [ ] 1.2 In the shortcut settings: enable "Show in Share Sheet", set accepted input types to "URLs" and "Safari web pages", and set minimum iOS version to 16 (Shortcut Details → iOS 16).
  - [ ] 1.3 Test the shortcut from Safari and one non-Safari app (e.g. YouTube). Verify success notification and that the save appears in `GET /saves`.
  - [ ] 1.4 Export the shortcut: long-press → Share → Save to Files → commit the binary at `frontend/public/shortcuts/ai-learning-hub.shortcut`.
  - [ ] 1.5 Verify the file is served correctly by Vite dev server at `http://localhost:5173/shortcuts/ai-learning-hub.shortcut` with a 200 response.

- [ ] Task 2: Add setup guide frontend page (AC: #8, #9)
  - [ ] 2.1 Create `frontend/src/pages/guides/IosShortcutSetup.tsx` following the Quetzal design system (see Dev Notes for design requirements). The page must render without auth.
  - [ ] 2.2 Guide content (5 steps): (1) Generate a capture-scoped API key — include an inline sign-in prompt for unauthenticated users ("Sign in first to generate your key →"); (2) Copy the key; (3) Tap "Install Shortcut" (link to `/shortcuts/ai-learning-hub.shortcut`); (4) Paste your API key when the Shortcuts app prompts; (5) Test — open any app, tap Share → "Save to AI Learning Hub". Include a requirements note near the top: "Requires iPhone or iPad running iOS 16 or later."
  - [ ] 2.3 Include a prominent "Install Shortcut" `<a>` element pointing to `/shortcuts/ai-learning-hub.shortcut`. On iOS this opens the Shortcuts install sheet; on desktop it downloads the file. Use the primary Button style (indigo fill).
  - [ ] 2.4 Add a public route in `frontend/src/App.tsx`: `<Route path="/guides/ios-shortcut-setup" element={<IosShortcutSetup />} />` — outside the `<ProtectedRoute>` wrapper. The step-1 API key link should point to `/settings/api-keys`; if the user is unauthenticated show a `<SignInButton>` / redirect prompt inline rather than a broken link.

- [ ] Task 3: Verify capture scope correctness (AC: #9, #10)
  - [ ] 3.1 Confirm `capture` scope resolves to `saves:create` in `backend/shared/middleware/src/scope-resolver.ts` (already implemented — read and verify only, no code change needed).
  - [ ] 3.2 Add an integration test in `backend/functions/saves/handler.test.ts` that covers: `POST /saves` with a mocked `capture`-scoped API key auth context (`isApiKey: true, scopes: ['capture']`) produces a 201 with a valid save body. Add a second case: same request with scope `read` produces a 403.
  - [ ] 3.3 Run `npm test`, `npm run lint`, `npm run build`, `npm run type-check`, `npm run format`. All must pass.

## Dev Notes

### iOS Shortcut Action Sequence (Exact Spec for Task 1.1)

**API base URL (hardcoded):** `https://api.build.cirrusly-clever.com`
**Import Questions:** one only — API key.

```
Action 1: Receive [URL, Safari web page] as input from Share Sheet
  - "If there's no input" → Stop and Respond
  - Accept: Share Sheet, Action Menus

Action 2: Get URLs from [Shortcut Input]
  - Store result as Magic Variable: InputURL

Action 2b: If [InputURL] has no items  ← NON-URL GUARD
  - Show Notification:
      Title: "Nothing to save"
      Body: "Share a link, not text or an image."
  - Stop Shortcut
  (End If)

Action 3: URL → Text (convert URL type to string)
  - Input: InputURL
  - Store result as variable: URLString

  [URL normalization: iOS share sheet may include trailing slashes or
  tracking parameters. No normalisation needed in the shortcut —
  the backend normalizeUrl() handles this before dedup checks.
  App deep links (spotify://, youtube://) pass through and are rejected
  by the backend's URL validation with a 400 — accepted edge case for V1.]

Action 4: Get Contents of URL
  - URL: https://api.build.cirrusly-clever.com/saves
  - Method: POST
  - Headers:
      Content-Type: application/json
      x-api-key: [API Key] (Import Question variable — see below)
  - Request Body: JSON
      { "url": [URLString] }
  - Store result as variable: Response

Action 5: Get Dictionary Value "error" from [Response]
  - Store result as variable: ErrorValue

Action 6: If [ErrorValue] has any value
  - (error branch — includes DUPLICATE_SAVE which also has an "error" key in the 409 body)
  - Get Dictionary Value "code" from [ErrorValue]
  - If [code] equals "DUPLICATE_SAVE"
      → Go to success notification (Action 8)
    Otherwise
      → Show Notification: Title "Couldn't Save", Body "Check your API key or connection."
      → Stop Shortcut

Action 7 (no error key — HTTP 201): (fall-through)

Action 8: Show Notification
  - Title: "✓ Saved"
  - Body: "" (empty — fast, no extra reading)
```

**Import Question configuration (one only):**
- Name: `API Key`
- Question: "Enter your AI Learning Hub API key (Settings → API Keys → Generate with Capture scope)"
- Default value: (leave empty)

**Why one Import Question:** The API URL `https://api.build.cirrusly-clever.com` is the production domain and is hardcoded in the binary. If the domain ever changes, re-export the shortcut with the updated URL. No need to burden users with entering a URL.

**Why 409 → "✓ Saved":** The URL is already in the user's library — the save succeeded from their perspective. Showing a different message adds cognitive load for zero benefit. The `error.code === "DUPLICATE_SAVE"` branch explicitly routes to the success notification.

### iOS Shortcut Error Handling

| Scenario | API Response | Detection | Shortcut shows |
|----------|-------------|-----------|----------------|
| New save | 201 `{ data: { saveId, ... } }` | No `error` key | "✓ Saved" |
| Duplicate | 409 `{ error: { code: "DUPLICATE_SAVE" }, existingSave: {...} }` | `error.code === "DUPLICATE_SAVE"` | "✓ Saved" |
| Bad API key | 401/403 `{ error: { code: "..." } }` | `error` present, code ≠ DUPLICATE_SAVE | "Couldn't Save" |
| Invalid URL | 400 `{ error: { code: "VALIDATION_ERROR" } }` | `error` present, code ≠ DUPLICATE_SAVE | "Couldn't Save" |
| Network timeout | No response / timeout | Response is empty / null | "Couldn't Save" |
| Server error | 5xx | `error` present or empty response | "Couldn't Save" |

**iOS Shortcuts timeout:** The "Get Contents of URL" action has a ~60-second system timeout. On a failed network request the shortcut will wait up to 60s before surfacing the "Couldn't Save" notification. This is acceptable for V1; users on poor connections can dismiss and retry.

**Multiple installs:** Each import of the shortcut creates an independent copy with its own stored API key variable. Users can install twice with different keys (e.g. personal vs work). Each copy is independent — no conflicts.

### Frontend Guide Page Design Requirements

The guide page at `/guides/ios-shortcut-setup` must follow Quetzal design system:
- **Font**: Inter (ui-sans-serif fallback)
- **Colors**: Use CSS variables (`--background`, `--foreground`, `--brand` for success accents, `--accent` for interactive elements)
- **Icons**: Lucide React
- **Components**: Use existing shadcn components (Button, Badge, Separator)
- **Public access**: Route must be outside `<ProtectedRoute>` in App.tsx

Guide must include:
1. A "persona-driven" header — use Maya persona language ("Save anything in 5 seconds")
2. Step-by-step numbered list with clear step titles
3. An "Install Shortcut" button (`<a href="/shortcuts/ai-learning-hub.shortcut">`) — primary button style
4. Link to Settings → API Keys (`/settings/api-keys`) for key generation step
5. A "What it looks like" mockup or description of the share sheet flow

### Project Structure Notes

- Shortcut binary: `frontend/public/shortcuts/ai-learning-hub.shortcut` — Vite copies `public/` contents as-is to `dist/`; no import needed
- Guide page: `frontend/src/pages/guides/IosShortcutSetup.tsx`
- Route in App.tsx: add before the `<ProtectedRoute>` block, alongside `/` and `*` routes
- No new API endpoints or Lambda functions — `POST /saves` already handles capture
- No new CDK changes — shortcut file is static content bundled with the frontend

### API Contract Reference

The shortcut calls this existing endpoint:

```
POST https://api.build.cirrusly-clever.com/saves
Headers:
  Content-Type: application/json
  x-api-key: <capture-scoped-key>

Body: { "url": "https://example.com" }

Responses:
  201: { data: { saveId, url, contentType, ... } }          → "✓ Saved" (no "error" key)
  409: { error: { code: "DUPLICATE_SAVE", ... }, existingSave: {...} } → "✓ Saved" (error.code check)
  401: { message: "Unauthorized" }                           → "Couldn't Save"
  403: { error: { code: "INSUFFICIENT_SCOPE", ... } }       → "Couldn't Save"
  400: { error: { code: "VALIDATION_ERROR", ... } }         → "Couldn't Save"
```

The `capture` scope key already grants `saves:create` via `scope-resolver.ts`:
```typescript
// backend/shared/middleware/src/scope-resolver.ts
capture: ["saves:create"],  // maps capture tier → saves:create operation
```

The saves-create handler requires `requiredScope: "saves:create"`:
```typescript
// backend/functions/saves/handler.ts
export const handler = wrapHandler(savesCreateHandler, {
  requireAuth: true,
  requiredScope: "saves:create",
  ...
});
```

### Capture Flow Performance (FR46: < 3 seconds)

The entire Shortcuts flow (share sheet tap → API call → notification) must complete in < 3 seconds. Current API hot path:
- Lambda cold start adds 1–3s (documented, accepted per NFR-P1 note)
- Warm invocation: < 1s (API Gateway + Lambda + DynamoDB PutItem)
- For capture path: enable Lambda Provisioned Concurrency for the saves-create function if cold start latency becomes an issue post-deployment (post-deploy optimization, not blocking this story)

### Domain Change Procedure

The API URL `https://api.build.cirrusly-clever.com` is hardcoded in Action 4 of the shortcut binary. If the domain changes:

1. Open the `.shortcut` file on an iPhone (tap the file → opens Shortcuts app for editing)
2. Update the URL in Action 4 to the new domain
3. Re-export: long-press → Share → Save to Files
4. Overwrite `frontend/public/shortcuts/ai-learning-hub.shortcut` in the repo
5. Deploy. The new file is served immediately to any user who re-downloads and reinstalls

**Existing users** must manually reinstall the shortcut — there is no auto-update mechanism. This is why domain stability matters; treat `api.build.cirrusly-clever.com` as permanent for V1.

The domain is managed in the secondary AWS account (us-east-1), separate from the CDK deployment account.

### Offline Behaviour

No offline queue in V1. On poor or no connectivity the shortcut waits up to ~60 seconds (iOS system timeout) then shows "Couldn't Save". The user must retry manually. The PWA (Story 3.6) will implement an offline save queue via service worker + IndexedDB for in-app captures — the iOS Shortcut has no equivalent and this gap is accepted for V1.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Mobile-Capture] — FR44, FR45, FR46, FR47
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#9-Mobile-Capture-System] — iOS Shortcut flow, setup guide spec, error handling
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#6-Information-Architecture] — `/guides/ios-shortcut-setup` route is P0
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-011] — iOS Shortcut + PWA approach decision
- [Source: backend/shared/middleware/src/scope-resolver.ts] — `capture` scope grants `saves:create`
- [Source: backend/functions/saves/handler.ts] — `requiredScope: "saves:create"`, request/response shape
- [Source: _bmad-output/planning-artifacts/prd.md#API-Key-Scopes] — `capture` scope: `POST /saves` only, 100/min rate limit

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
