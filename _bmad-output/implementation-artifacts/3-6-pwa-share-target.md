---
id: "3.6"
title: "PWA Share Target"
status: ready-for-dev
depends_on: []
touches:
  - frontend/vite.config.ts
  - frontend/src/sw.ts
  - frontend/src/pages/ShareTargetPage.tsx
  - frontend/src/pages/guides/AndroidPwaSetup.tsx
  - frontend/src/App.tsx
  - frontend/public/icons/pwa-192x192.png
  - frontend/public/icons/pwa-512x512.png
risk: medium
---

# Story 3.6: PWA Share Target

## Story

As an Android user with AI Learning Hub installed as a PWA,
I want to tap "AI Learning Hub" in my Android share sheet from any app,
so that I can save any URL in under 3 seconds without navigating to the app.

## Acceptance Criteria

1. **AC1: Manifest share_target registered** — The web app manifest includes a valid `share_target` object with `action: "/save"`, `method: "POST"`, `enctype: "application/x-www-form-urlencoded"`, and params mapping `url`, `title`, and `text`. Android Chrome registers the PWA as a share target when the app is installed ("Add to Home Screen").

2. **AC2: Share target appears in Android share sheet** — After the user installs the PWA ("Add to Home Screen"), "AI Learning Hub" appears as an option in the Android share sheet. Tapping it opens the `/save` page.

3. **AC3: URL extracted and saved** — The share target page extracts the shared URL from the service worker cache, calls `POST /saves` authenticated via Clerk JWT session, and the save is created within 3 seconds on a warm Lambda invocation (FR46).

4. **AC4: Success confirmation screen** — On successful save (201), the `/save` page shows a full-screen confirmation: "✓ Saved" with the saved URL displayed. An optional "+ Add a note" prompt appears for 3–4 seconds. A "← Back" button returns the user to the originating Android app: it calls `window.history.back()` if `window.history.length > 1`, otherwise falls back to `window.close()` (handles the case where the share target opened a fresh standalone PWA window with no prior history).

5. **AC5: Duplicate URL handling** — If the API returns 409 with `error.code === "DUPLICATE_SAVE"`, the page treats it as success and shows the same "✓ Saved" confirmation. No distinct duplicate message.

6. **AC6: Error state** — On network failure or non-2xx (excluding DUPLICATE_SAVE), the page shows: "Couldn't save — try again." with a retry button that re-attempts the save without user needing to re-share.

7. **AC7: Unauthenticated state** — If the user is not signed into the PWA, the `/save` page shows: "Sign in to AI Learning Hub to save this link" with a Sign In button (Clerk modal, not redirect). The shared URL is preserved: the cache entry in `share-target-data` is **not consumed** until the save is attempted. After the Clerk sign-in modal closes and `isSignedIn` becomes `true`, the page re-reads the cached URL and proceeds with the save automatically — the user does not need to re-share.

8. **AC8: Offline queue** — When the device is offline and a share is attempted, the save request is queued in IndexedDB via Workbox BackgroundSync. The page shows: "Saved offline — will sync when you reconnect." When connectivity returns, the queued save is automatically submitted. Queue retries for up to 24 hours.

9. **AC9: PWA manifest complete** — The manifest includes `name`, `short_name`, `description`, `theme_color` (#4f46e5 — Quetzal brand indigo), `background_color`, `display: standalone`, `start_url: /`, `scope: /`, and two icon sizes (192×192 and 512×512 PNG). The manifest passes Chrome's PWA installability criteria.

10. **AC10: Service worker uses injectManifest strategy** — `vite.config.ts` is updated to use `strategies: 'injectManifest'` with `srcDir: 'src'` and `filename: 'sw.ts'`. The custom service worker at `frontend/src/sw.ts` includes precaching via `precacheAndRoute(self.__WB_MANIFEST)`, the share target fetch handler, and BackgroundSync plugin registration.

11. **AC11: Unit tests** — `ShareTargetPage` has unit tests covering: (a) authenticated + URL available → shows success UI after mock API call; (b) unauthenticated → shows sign-in prompt; (c) API error → shows retry UI; (d) DUPLICATE_SAVE → treated as success; (e) non-URL text content → shows "Nothing to save" message; (f) Cancel during loading → mutation is reset and back navigation fires. Tests use `vi.mock` for `useAuth` and `useCreateSave`.

12. **AC12: Cancel during in-flight save** — While the save is in-flight (loading state), a "Cancel" button is visible alongside the loading spinner. Tapping Cancel calls `mutation.reset()` and navigates back via the same `window.close()` / `history.back()` logic as the success Back button. This prevents accidental saves when the user taps the wrong app in the share sheet.

13. **AC13: Non-URL content guard** — Before calling `POST /saves`, the page validates that the resolved shared content is a parseable URL (passes `new URL(value)` without throwing). If the `url` param is absent and the `text` param contains non-URL prose (e.g. a tweet body), the page shows: "Nothing to save — share a link, not text or an image." No API call is made. This mirrors the iOS Shortcut guard in Story 3.5 (AC5).

14. **AC14: Android PWA install guide** — A publicly accessible page exists at `/guides/android-pwa-setup` explaining how to install the PWA on Android and enable the share target. The guide covers: open AI Learning Hub in Chrome → tap the three-dot menu → "Add to Home Screen" → confirm → locate the app on your home screen → test from any app's share sheet. The page is outside `<ProtectedRoute>`. It is linked from the iOS guide page footer ("On Android? See the Android setup guide →") and reachable directly.

## Tasks / Subtasks

- [ ] Task 1: Add workbox dev dependencies and update vite.config.ts (AC: #9, #10)
  - [ ] 1.1 Install devDependencies: `workbox-precaching workbox-routing workbox-strategies workbox-background-sync workbox-core` — run `npm install -D workbox-precaching workbox-routing workbox-strategies workbox-background-sync workbox-core` from `frontend/` directory.
  - [ ] 1.2 Update `frontend/vite.config.ts`: change VitePWA plugin to use `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`. Add complete `manifest` object (name, short_name, description, theme_color `#4f46e5`, background_color `#ffffff`, display `standalone`, start_url `/`, scope `/`, icons array with 192x192 and 512x512). Add `share_target` object per ADR-012 spec (see Dev Notes).
  - [ ] 1.3 Run `npm run build` from `frontend/` to confirm the build succeeds with the new vite.config. The SW file will fail to compile until Task 2 is complete — that is expected.

- [ ] Task 2: Create custom service worker `frontend/src/sw.ts` (AC: #1, #8, #10)
  - [ ] 2.1 Create `frontend/src/sw.ts` with: `declare let self: ServiceWorkerGlobalScope` type declaration, import `precacheAndRoute` from `workbox-precaching` and call `precacheAndRoute(self.__WB_MANIFEST)`.
  - [ ] 2.2 Add the Web Share Target fetch handler: intercept `fetch` events where `url.pathname === '/save'` and `method === 'POST'`. Extract `url`, `text`, `title` from `event.request.formData()`. Resolve the shared content: prefer `url` param, fall back to `text` param. Store the raw value (validated or not) as a JSON response in `caches.open('share-target-data')` at key `/share-target-pending` — include both `url` (the raw value) and `title` fields. Respond with `Response.redirect('/save?shared=1', 302)`. **Note:** URL validity is validated in the React page (Task 4.3), not in the SW — the SW stores whatever was shared and lets the UI decide.
  - [ ] 2.3 Register a BackgroundSync queue named `'saves-queue'` using `workbox-background-sync` `BackgroundSyncPlugin` with `maxRetentionTime: 24 * 60` (24 hours in minutes). Register a POST route for `(url) => url.pathname === '/saves'` using `NetworkOnly` strategy with the plugin attached — so POST /saves calls that fail offline are queued and replayed automatically.
  - [ ] 2.4 Add a `message` event listener on `self` for `{ type: 'SKIP_WAITING' }` to call `self.skipWaiting()` — enables the `autoUpdate` registration type to work correctly.
  - [ ] 2.5 Run `npm run build` again to confirm no TypeScript errors in the SW file.

- [ ] Task 3: Create PWA icons (AC: #9)
  - [ ] 3.1 Create directory `frontend/public/icons/`.
  - [ ] 3.2 Generate two PNG icons: `pwa-192x192.png` (192×192) and `pwa-512x512.png` (512×512). Design: indigo (#4f46e5) square background with a white bookmark icon (Lucide `BookmarkCheck` shape). These can be created using any image tool, Canvas API script, or an online PWA icon generator (e.g. maskable.app). The 512×512 icon should also serve as the maskable icon.
  - [ ] 3.3 Place both files under `frontend/public/icons/` so Vite copies them to the build output root. Verify paths match the manifest `icons` array entries: `/icons/pwa-192x192.png` and `/icons/pwa-512x512.png`.

- [ ] Task 4: Create `ShareTargetPage.tsx` (AC: #3, #4, #5, #6, #7, #8, #12, #13)
  - [ ] 4.1 Create `frontend/src/pages/ShareTargetPage.tsx`. The page reads the pending share URL on mount: open `caches.open('share-target-data')`, `match('/share-target-pending')`, parse JSON to extract `{ url, title }`. **Do not delete the cache entry here** — only consume it (call `cache.delete`) after a successful save or explicit user cancel (finding #3: preserves URL through sign-in flow). If `?shared=1` query param is absent or no cached URL found, display a fallback "Nothing to save — try sharing again from the app you were in" message.
  - [ ] 4.2 Implement auth gate: use Clerk's `useAuth()` hook. If `!isLoaded` show a centered loading spinner (Clerk initialising). If `!isSignedIn` show the unauthenticated UI — "Sign in to AI Learning Hub to save this link" with the pending URL displayed and a `<SignInButton mode="modal">`. **After sign-in**, Clerk fires an `isSignedIn` state change — use a `useEffect` that watches `isSignedIn` to trigger the save automatically once authenticated. Do not delete the cache entry until the save attempt.
  - [ ] 4.3 Before calling `POST /saves`, validate the resolved URL: attempt `new URL(sharedUrl)`. If it throws, show: "Nothing to save — share a link, not text or an image." and do not call the API (AC13). If valid, call `useCreateSave()`. Show a loading spinner **and a "Cancel" button** while in-flight (AC12). On success (or DUPLICATE_SAVE error code), delete the cache entry and transition to the success state. On other errors, show the retry UI.
  - [ ] 4.4 Implement the Cancel button (AC12): visible during loading state only. On click: call `mutation.reset()`, delete the cache entry (`caches.open('share-target-data').then(c => c.delete('/share-target-pending'))`), then navigate back using: `window.history.length > 1 ? window.history.back() : window.close()`.
  - [ ] 4.5 Implement the success state UI (see Dev Notes for exact design): "✓ Saved" headline, the URL in a muted pill, optional "+ Add a note" CTA (input + "Save note" button), and a "← Back" button. Back button logic: `window.history.length > 1 ? window.history.back() : window.close()` (AC4 — handles standalone PWA window with no prior history).
  - [ ] 4.6 Implement the error state UI: "Couldn't save — try again." message, a Retry button that re-fires the `createSave` mutation, and a "Go to app" fallback link to `/app`. Do not delete the cache entry on error — so Retry can re-attempt.
  - [ ] 4.7 Implement offline detection: if `navigator.onLine === false` before the save attempt, show "Saved offline — will sync when you reconnect." and delete the cache entry (the BackgroundSync plugin has already queued the request via the SW). No manual IDB write needed in the React layer per V1 decision.
  - [ ] 4.8 Implement the note prompt: after successful save, show a text input "Add a note (optional)" that auto-focuses. If the user types and submits within 10 seconds, call `useUpdateSave()` with the note. If they ignore it or tap elsewhere, it disappears after 4 seconds (use a countdown state). This is optional context capture per the UX spec.

- [ ] Task 5: Add routes in App.tsx (AC: #2, #14)
  - [ ] 5.1 Import `ShareTargetPage` and `AndroidPwaSetup` in `frontend/src/App.tsx`.
  - [ ] 5.2 Add `<Route path="/save" element={<ShareTargetPage />} />` as a top-level route **outside** the `<ProtectedRoute>` wrapper, before the `<Route path="*">` catch-all. The page handles its own auth state internally.
  - [ ] 5.3 Add `<Route path="/guides/android-pwa-setup" element={<AndroidPwaSetup />} />` as a top-level public route alongside the iOS guide route.

- [ ] Task 6: Write tests (AC: #11, #12, #13)
  - [ ] 6.1 Create `frontend/src/pages/ShareTargetPage.test.tsx`. Mock `caches` globally using `vi.stubGlobal('caches', ...)` with a fake Cache that returns configurable test data. Mock `useAuth` from `@clerk/clerk-react` to control signed-in/out state. Mock `useCreateSave` from `@/api/saves`. Mock `window.history` and `window.close` for navigation assertions.
  - [ ] 6.2 Test: `authenticated + valid URL → shows success UI`. Mock cache returns `{ url: 'https://example.com' }`, `isSignedIn: true`, mutation resolves — assert "✓ Saved" visible and cache was deleted.
  - [ ] 6.3 Test: `unauthenticated → shows sign-in prompt, cache not deleted`. Mock `{ isSignedIn: false, isLoaded: true }`. Assert "Sign in to AI Learning Hub" visible; assert `cache.delete` not called; assert no API call made.
  - [ ] 6.4 Test: `sign-in triggers auto-save`. Start with `isSignedIn: false`, then re-render with `isSignedIn: true` (simulating Clerk modal close) — assert `createSave` is called with the cached URL.
  - [ ] 6.5 Test: `API error → shows retry UI, cache not deleted`. Mock mutation rejects with a non-DUPLICATE_SAVE error. Assert "Couldn't save — try again." visible; assert `cache.delete` not called (so Retry can re-attempt).
  - [ ] 6.6 Test: `DUPLICATE_SAVE → treated as success`. Mock mutation rejects with `ApiError` where `code === 'DUPLICATE_SAVE'`. Assert "✓ Saved" visible.
  - [ ] 6.7 Test: `non-URL text → shows nothing-to-save guard` (AC13). Mock cache returns `{ url: 'just some tweet text without a URL' }`. Assert "Nothing to save — share a link" visible; assert no API call made.
  - [ ] 6.8 Test: `Cancel during loading → reset mutation and close/back` (AC12). Mock mutation in pending state. Assert Cancel button visible. Fire click — assert `mutation.reset` called and `window.close` or `history.back` fired.
  - [ ] 6.9 Test: `Back button uses window.close when history.length === 1`. Mock `window.history.length = 1`. In success state, click "← Back" — assert `window.close()` called, not `history.back()`.
  - [ ] 6.10 Run `npm test`, `npm run lint`, `npm run build`, `npm run type-check`, `npm run format`. All must pass.

- [ ] Task 7: Create Android PWA setup guide page (AC: #14)
  - [ ] 7.1 Create `frontend/src/pages/guides/AndroidPwaSetup.tsx`. Follow the same Quetzal design conventions as `IosShortcutSetup.tsx` (Inter font, CSS variables, shadcn Button/Badge/Separator components, Lucide icons). Persona-driven header: "Save anything in 3 taps — no app needed."
  - [ ] 7.2 Guide content (4 steps): (1) Open AI Learning Hub in Chrome on Android; (2) Tap the three-dot menu (⋮) → "Add to Home Screen" → "Add" — the app icon appears on your home screen; (3) Open any app (YouTube, Chrome, LinkedIn, Reddit…) → tap Share → "AI Learning Hub" appears in the sheet; (4) Tap it — your link is saved instantly. Include a requirements note: "Requires Android with Chrome (or Firefox). The app must be installed to your home screen first."
  - [ ] 7.3 Add an "Open AI Learning Hub" CTA button linking to `/` (prompts Chrome to show the install banner if not already installed).
  - [ ] 7.4 In the footer of `IosShortcutSetup.tsx`, add a discreet link: "On Android? [See the Android setup guide →](/guides/android-pwa-setup)".
  - [ ] 7.5 Route already added in Task 5.3.

## Dev Notes

### Web Share Target API — Architecture Spec (ADR-012)

The `share_target` entry in the manifest (per ADR-012):

```json
{
  "share_target": {
    "action": "/save",
    "method": "POST",
    "enctype": "application/x-www-form-urlencoded",
    "params": {
      "url": "url",
      "title": "title",
      "text": "text"
    }
  }
}
```

- **method: POST** is required because `application/x-www-form-urlencoded` shares include a request body
- The service worker **must** intercept the POST to `/save` — React Router never sees a POST request; the SW handles it first
- Android Chrome requires the PWA to be installed ("Add to Home Screen") before the share target is registered in the OS share sheet
- iOS Safari does **not** support Web Share Target — iOS users use the Shortcut (Story 3.5)

[Source: _bmad-output/planning-artifacts/architecture.md#ADR-012]

### Service Worker: Share Data Handoff Pattern

The SW intercepts the POST, stores the URL, then redirects. This avoids the complexity of `BroadcastChannel` or `postMessage` to an as-yet-unopened client:

```typescript
// frontend/src/sw.ts — share target handler

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/save' && event.request.method === 'POST') {
    event.respondWith(
      (async (): Promise<Response> => {
        const formData = await event.request.formData();
        const sharedUrl =
          (formData.get('url') as string) ||
          (formData.get('text') as string) ||
          '';

        // Persist URL so the React page can read it after redirect
        const cache = await caches.open('share-target-data');
        await cache.put(
          '/share-target-pending',
          new Response(JSON.stringify({ url: sharedUrl }), {
            headers: { 'Content-Type': 'application/json' },
          })
        );

        return Response.redirect('/save?shared=1', 302);
      })()
    );
  }
});
```

The React page reads the cache on mount — but does **not** delete the entry until the save is confirmed. This preserves the URL through the sign-in flow (finding #3):

```typescript
// In ShareTargetPage.tsx — effect to read shared URL

useEffect(() => {
  const readSharedUrl = async () => {
    if (!searchParams.get('shared')) return;
    const cache = await caches.open('share-target-data');
    const response = await cache.match('/share-target-pending');
    if (response) {
      const data = await response.json() as { url: string; title?: string };
      // ⚠️  Do NOT delete here — preserve until save succeeds, errors, or user cancels
      setSharedUrl(data.url);
      setSharedTitle(data.title ?? '');
    }
  };
  readSharedUrl().catch(() => {/* handle gracefully */});
}, [searchParams]);

// Separate helper — call this after successful save or explicit cancel:
const consumeCache = async () => {
  const cache = await caches.open('share-target-data');
  await cache.delete('/share-target-pending');
};
```

**Sign-in flow:** When the user signs in via Clerk modal, `isSignedIn` transitions from `false` → `true`. A `useEffect` watching `isSignedIn` triggers `consumeCache` + `createSave` automatically:

```typescript
useEffect(() => {
  if (isSignedIn && sharedUrl && mutation.isIdle) {
    triggerSave(sharedUrl);
  }
}, [isSignedIn, sharedUrl]);
```

### Non-URL Content Guard (AC13)

Some Android apps populate the `text` share param with prose (e.g. a tweet body) rather than a URL. Validate before calling the API:

```typescript
function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// In save trigger:
if (!isValidUrl(sharedUrl)) {
  setPhase('invalid');  // shows "Nothing to save — share a link, not text or an image."
  await consumeCache();
  return;
}
```

This mirrors the iOS Shortcut guard at Action 2b (Story 3.5, AC5).

### Back Button: `window.close()` Fallback (AC4, AC12)

When the share target opens a **new** standalone PWA window (common on Android), `window.history.length` is `1` — there is no prior page to go back to. `window.history.back()` would silently do nothing, stranding the user on the confirmation screen.

```typescript
function navigateBack(): void {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}
```

Use `navigateBack()` for all three exit points: Cancel, Back (success), and error state "Go to app" button.

### Service Worker: BackgroundSync for Offline Queue

```typescript
// frontend/src/sw.ts — BackgroundSync registration

import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

const savesQueue = new BackgroundSyncPlugin('saves-queue', {
  maxRetentionTime: 24 * 60,  // 24 hours in minutes
});

// Queue POST /saves calls that fail due to network error
registerRoute(
  ({ url, request }) =>
    url.pathname === '/saves' && request.method === 'POST',
  new NetworkOnly({ plugins: [savesQueue] }),
  'POST'
);
```

Note: `registerRoute` for POST methods requires the `method` argument as the third parameter (Workbox 7+).

### Updated vite.config.ts Structure

```typescript
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  devOptions: {
    enabled: true,         // Enable SW in dev mode for testing
    type: 'module',
  },
  manifest: {
    name: 'AI Learning Hub',
    short_name: 'ALH',
    description: 'Save and organise your learning resources',
    theme_color: '#4f46e5',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'any',
    scope: '/',
    start_url: '/',
    icons: [
      {
        src: '/icons/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    share_target: {
      action: '/save',
      method: 'POST',
      enctype: 'application/x-www-form-urlencoded',
      params: {
        url: 'url',
        title: 'title',
        text: 'text',
      },
    },
  },
}),
```

### ShareTargetPage: Confirmed Design (from UX Spec)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              ✓ Saved                                 │
│    example.com · via share                           │
│                                                      │
│   ┌─────────────────────────────────────────────┐   │
│   │  + Add a note...              [Save note]   │   │
│   └─────────────────────────────────────────────┘   │
│         (disappears after 4 seconds if ignored)      │
│                                                      │
│              ← Back                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

[Source: _bmad-output/planning-artifacts/ux-design-specification.md#9-Mobile-Capture-System]

- Full screen, centred layout (no NavRail, no AppLayout)
- Quetzal design: `--brand` color for the ✓ checkmark, `--foreground` for text
- `--background` for the page — matches system light/dark
- Font: Inter via Tailwind `font-sans`
- The note input should use the `Input` shadcn component; the Save note button uses the `Button` component (secondary variant)

### API Client in Service Worker Context

The service worker BackgroundSync plugin replays the raw `fetch` call — it does **not** go through the `ApiClient` class. The Clerk JWT token embedded in the original request headers is replayed as-is. This works correctly as long as the JWT hasn't expired (Clerk JWTs expire in ~60s by default for short-lived tokens, or up to 1 hour depending on config). If the token is expired when the SW retries, the API returns 401 — the save fails silently in the queue and will be retried until `maxRetentionTime` expires.

**V1 accepted limitation — silent JWT expiry:** If a JWT expires before the offline queue drains (queue TTL is 24 hours; Clerk JWT TTL is ~1 hour by default), the BackgroundSync retry will receive a 401 from the API. Workbox treats this as a network success (non-network-error) and **removes** the request from the queue without retrying further. The save is silently lost from the user's perspective — they were shown "Saved offline" but the save never appears in their library.

Mitigations considered for V1:
- The 24-hour queue window is generous; most offline scenarios resolve within minutes
- Users actively using the PWA will re-authenticate before the JWT expires
- No user-visible notification of queue failure exists in V1

**Future story recommendation:** Add a `sync` event listener in the service worker that re-validates the JWT before replaying queued saves, or use Workbox's `fetchDidFail` plugin callback to log failures to an app-visible store (IDB) so the library page can surface a "some saves may not have synced" banner. Track as a follow-up in Epic 3 or Epic 9.

### Authentication Flow for Share Target

The share target opens a new PWA window at `/save?shared=1`. Clerk restores the session from `localStorage` on the client side:

1. PWA window opens → React loads → Clerk initialises from localStorage
2. If session is valid: `isSignedIn = true` → proceed with save
3. If session expired or absent: `isSignedIn = false` → show sign-in UI

```typescript
// In ShareTargetPage.tsx
import { useAuth, SignInButton } from '@clerk/clerk-react';

const { isSignedIn, isLoaded } = useAuth();

if (!isLoaded) return <LoadingSpinner />;
if (!isSignedIn) {
  return <UnauthenticatedView pendingUrl={sharedUrl} />;
}
// proceed to save...
```

### Offline IDB Direct Queue (Fallback for Share Target)

When `navigator.onLine === false` at the time of share:
- The service worker's BackgroundSync will handle the retry automatically
- BUT the React page should also show the right UI state (not a spinner)
- Detection: `navigator.onLine` check before calling `createSave`

For direct IDB queuing (supplementary to BackgroundSync):
```typescript
import { openDB } from 'idb'; // add idb as dependency if needed

const db = await openDB('alh-offline-queue', 1, {
  upgrade(db) {
    db.createObjectStore('pending-saves', { keyPath: 'id', autoIncrement: true });
  },
});
await db.add('pending-saves', { url: sharedUrl, queuedAt: Date.now() });
```

**Decision for V1:** Rely on Workbox BackgroundSync for offline retry (no manual IDB queue needed). The ShareTargetPage only needs to detect `navigator.onLine` to show appropriate UI — the actual retry is handled by the SW.

### PWA Icon Generation

Options for creating the icons:
1. **Maskable.app** (online tool): paste the Quetzal brand mark, export 192/512 variants with safe zone
2. **Canvas script**: see `scripts/generate-icons.ts` if one exists, or create a one-off Node script
3. **Figma / Photoshop**: design a bookmark icon on `#4f46e5` background

Icon requirements:
- Both icons must be valid PNGs
- 512×512 icon doubles as maskable (safe zone = inner 80%)
- Icons referenced in manifest must exist at build time (Vite copies `public/` as-is)

### Platform Support Matrix

| Platform | Share Target Works | Requirement |
|----------|-------------------|-------------|
| Android Chrome | ✓ Full support | PWA installed |
| Android Firefox | ✓ Supported | PWA installed |
| iOS Safari | ✗ Not supported | Use iOS Shortcut (Story 3.5) |
| Desktop Chrome | Limited | PWA installed on desktop |
| Desktop Firefox | ✗ Not supported | N/A |

[Source: _bmad-output/planning-artifacts/architecture.md#ADR-011, ADR-012]

### Project Structure Notes

- `frontend/src/sw.ts` — Custom service worker. Compiled by Vite to `dist/sw.js`. **Must** import `self.__WB_MANIFEST` via `precacheAndRoute` for vite-plugin-pwa injection to work.
- `frontend/src/pages/ShareTargetPage.tsx` — New page. No `AppLayout` wrapper (full-screen capture UI). No NavRail. Must render standalone.
- `frontend/src/pages/guides/AndroidPwaSetup.tsx` — New public guide page. Mirrors the pattern of `IosShortcutSetup.tsx`. Outside `<ProtectedRoute>`.
- `frontend/src/App.tsx` — Add `/save` and `/guides/android-pwa-setup` routes before the `*` catch-all, **outside** `<ProtectedRoute>`.
- `frontend/public/icons/` — Static icons. Vite copies `public/` verbatim into build output. No import needed.
- No new Lambda functions, DynamoDB tables, or CDK changes — `POST /saves` already exists and handles capture.
- No changes to shared backend packages — this is a pure frontend story.

### iOS Shortcut vs PWA Share Target — Key Differences

| Aspect | iOS Shortcut (3.5) | PWA Share Target (3.6) |
|--------|-------------------|----------------------|
| Auth | Capture-scoped API key | Clerk JWT session |
| Setup | Manual install + API key entry | "Add to Home Screen" (Android Chrome) |
| Platform | iOS/iPadOS | Android |
| Offline | No queue (timeout → fail) | BackgroundSync queue (24h TTL) |
| UX after save | iOS notification banner | Full-screen confirmation screen |
| Notes capture | Not supported | Optional "+ Add a note" prompt (4s) |
| Non-URL guard | AC5: shows "Nothing to save" | AC13: same guard, same wording |
| Cancel mid-save | N/A (shortcut, no UI) | AC12: Cancel button during loading |
| Back navigation | System handles (shortcut exits) | `history.back()` → `window.close()` fallback |
| Setup guide | `/guides/ios-shortcut-setup` | `/guides/android-pwa-setup` (new) |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-012] — Web Share Target API manifest spec
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-011] — Platform strategy (PWA + Shortcut)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#9-Mobile-Capture-System] — PWA share target flow, confirmation screen design, offline save spec
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-3] — FR45 (PWA share target), FR46 (<3 second latency), FR47 (quick-save)
- [Source: _bmad-output/implementation-artifacts/3-5-ios-shortcut-capture.md] — iOS Shortcut story; context on API endpoint, capture scope, and capture flow performance
- [Source: frontend/vite.config.ts] — Existing VitePWA setup (`vite-plugin-pwa` v0.17.0 already installed)
- [Source: frontend/src/api/client.ts] — ApiClient; JWT auth via Bearer token
- [Source: frontend/src/App.tsx] — Routing structure; ProtectedRoute pattern
- [Source: frontend/src/pages/guides/IosShortcutSetup.tsx] — Reference for public page pattern (no auth wrapper)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
