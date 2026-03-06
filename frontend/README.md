# Frontend — AI Learning Hub

React + Vite PWA. Currently serves as the reference web client and a JWT utility for smoke testing. Full save-management UI is planned for Epic 4+.

## Stack

- **React 18** + **TypeScript**
- **Vite** + `vite-plugin-pwa` (service worker, auto-update)
- **Tailwind CSS**
- **Clerk** (`@clerk/clerk-react`) — authentication, user management
- **Vitest** + React Testing Library

## Quick start

```bash
# From repo root
npm install

# From this directory
cd frontend
cp .env.example .env.local        # add VITE_CLERK_PUBLISHABLE_KEY
npm run dev                        # http://localhost:5173
```

## Required environment variables

| Variable                     | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key — get from the Clerk dashboard |

Copy `.env.example` to `.env.local` and fill in the value. Never commit `.env.local`.

## Commands

| Command           | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Start Vite dev server with HMR                 |
| `npm run build`   | Type-check then build for production (`dist/`) |
| `npm run preview` | Serve the production build locally             |
| `npm run test`    | Run Vitest with coverage                       |
| `npm run lint`    | ESLint                                         |

## Project structure

```
src/
  main.tsx          # Entry — ClerkProvider wraps App
  App.tsx           # Root component (SignIn + JWT copier for smoke tests)
  api/
    client.ts       # ApiClient — typed fetch wrapper, unwraps { data } envelope
    hooks.ts        # React hooks over ApiClient
    index.ts        # Re-exports
  index.css         # Tailwind base styles
```

## API client

`src/api/client.ts` exports `ApiClient` — a thin typed wrapper around `fetch`:

- Injects `Authorization: Bearer <token>` via a `GetTokenFn` callback (compatible with Clerk's `useAuth().getToken`)
- Unwraps the `{ data: T }` success envelope automatically
- Throws `ApiError` on non-2xx responses, preserving `code`, `statusCode`, and `requestId`
- Treats HTTP 204 as `void`

```ts
import { ApiClient } from "./api/client";
import { useAuth } from "@clerk/clerk-react";

const { getToken } = useAuth();
const client = new ApiClient(import.meta.env.VITE_API_BASE_URL, getToken);
const saves = await client.get<Save[]>("/saves");
```

## Clerk integration

- `ClerkProvider` is mounted in `main.tsx` with `VITE_CLERK_PUBLISHABLE_KEY`
- The app throws at startup if the key is missing — fail fast
- `useAuth().getToken()` returns a short-lived JWT for API calls
- Sign-out redirects to `/` via `afterSignOutUrl`

## PWA

The service worker is registered via `vite-plugin-pwa` with `registerType: "autoUpdate"`. Manifest and Workbox caching config will be added in the Epic 4 frontend story.
