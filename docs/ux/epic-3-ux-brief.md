# Epic 3 UX Design Brief — Lovable.dev Prototype Input

**Purpose:** Feed this document to Lovable.dev to generate interactive prototypes for Epic 3 (Save URLs). The prototypes serve as visual reference for frontend implementation — code will be built separately by AI agents.

---

## Product Context

AI Learning Hub is a save-to-build platform for AI/GenAI practitioners. Users save URLs (articles, videos, tutorials, podcasts, GitHub repos) from any source, then organize them into projects to track what they're learning and building. Think of it as a professional bookmark manager that assumes you saved something because you intend to build with it.

**Target users:**

- **Maya** — Saves on mobile during commute (iOS share sheet, 2-tap capture), organizes on desktop with coffee on Saturday
- **Marcus** — Deep desktop sessions, links resources to projects, pastes LLM conversations into project notes
- **Priya** — Beginner, saves sporadically from phone, browses occasionally, eventually creates her first project

**This prototype covers:** The saves/library experience — saving URLs, browsing the list, filtering, sorting, editing, deleting. No project management, no linking, no notes (those are later epics).

---

## Design Direction

### Visual Style

- **Inspiration:** Linear — clean, minimal, fast-feeling
- **Density:** Balanced — moderate information density, efficient use of space but not cramped
- **Color palette:** Vibrant primary accent on a neutral base. One bold accent color (blue, indigo, or teal) for primary actions and active states. Muted grays for backgrounds and secondary text. Red for destructive actions (delete). Green for success states.
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). Clean and native-feeling.
- **Mode:** Light mode only (V1). Dark mode deferred.
- **Corners:** Slightly rounded (4-8px radius). Not pill-shaped, not sharp.
- **Shadows:** Subtle, used sparingly for elevation (modals, dropdowns).

### Layout

- **Desktop (> 1024px):** Left sidebar navigation (collapsible) + main content area. Saves displayed as a card grid (2-3 columns).
- **Tablet (768-1024px):** Sidebar collapsed to icons. Card grid adapts to 2 columns.
- **Mobile (< 768px):** No sidebar — bottom navigation bar or hamburger menu. Single-column card list. Touch-friendly tap targets.

---

## Screens to Prototype

### 1. App Layout Shell

The persistent chrome around all pages.

**Desktop:**

- Left sidebar with: App logo/name, navigation items (Saves/Library, Projects [greyed out — future], Tutorials [greyed out — future]), user avatar + settings at bottom
- Main content area fills remaining width
- Top bar with page title and primary action button ("Save URL")

**Mobile:**

- Bottom nav bar with 3-4 icons (Library active, Projects disabled, Tutorials disabled, Settings)
- Top bar with page title and "+" floating action button for quick save

### 2. Saves List Page (Library)

The main page users land on. Shows all saved URLs.

**Each save card shows:**

- Content type icon (left side): video, podcast, article, github_repo, newsletter, tool, reddit, linkedin, other
- Title (primary text, bold) — falls back to URL if no title
- Domain name (secondary text, muted) — e.g., "youtube.com", "github.com"
- Relative time saved — e.g., "2 hours ago", "3 days ago"
- Tags (if any) — small badges/chips below the title
- Overflow menu (three dots) — edit, delete

**Page elements:**

- "Save URL" primary button (top right on desktop, FAB on mobile)
- Search input (top, with search icon, placeholder "Search saves...")
- Filter chips row: All, Videos, Podcasts, Articles, GitHub, Newsletters, Other (horizontally scrollable on mobile)
- Sort dropdown: "Newest first" (default), "Oldest first", "Title A-Z", "Last accessed"
- Pagination: infinite scroll with "Loading more..." indicator, or "Load more" button

**States to show:**

- Default state with 6-8 example saves (mix of content types)
- Active filter state (e.g., "Videos" chip highlighted, list filtered)

### 3. Empty State

Shown when the user has zero saves.

- Friendly illustration or icon (inbox/bookmark themed)
- Headline: "Save your first URL"
- Subtext: "Save articles, videos, tutorials, and more from any source. Use the iOS Shortcut for quick capture on the go."
- Primary CTA: "Save a URL" button
- Secondary link: "Set up iOS Shortcut" (links to setup guide)

### 4. Save Detail Page

Shown when a user clicks a save card. Navigates to `/saves/:id`.

**Layout:**

- Back arrow / breadcrumb ("Library > Save Title")
- Large title
- URL displayed as clickable link (opens in new tab)
- Content type badge
- Domain with favicon (or fallback icon)
- Date saved, last accessed
- Tags (editable chips)
- User notes section (plain text, editable)
- Action buttons: "Edit", "Delete" (in top right or as toolbar)

### 5. Create Save Modal

Triggered by "Save URL" button. Appears as a centered modal with backdrop.

**Fields:**

- URL (required) — text input, auto-focuses on open, placeholder "https://..."
- Title (optional) — text input, placeholder "Title (auto-detected later)"
- Notes (optional) — textarea, placeholder "Add notes about this resource..."
- Content Type (optional) — dropdown or chip selector: Article, Video, Podcast, GitHub Repo, Newsletter, Tool, Reddit, LinkedIn, Other
- Tags (optional) — tag input with add/remove. Small text: "Up to 20 tags"

**Buttons:**

- "Cancel" (secondary/ghost) and "Save" (primary, vibrant accent)

**Validation:**

- URL field shows red border + "A valid URL is required" if empty or malformed on submit

### 6. Edit Save Modal

Same layout as Create modal but:

- URL shown as non-editable text (displayed, not an input field)
- All other fields pre-populated with current values
- Button text: "Cancel" and "Update"

### 7. Delete Confirmation Dialog

Small centered dialog (not full modal).

- Icon: warning/trash icon
- Text: "Delete this save?"
- Subtext: "You can undo this within 5 seconds."
- Buttons: "Cancel" (secondary) and "Delete" (red/destructive)

### 8. Toast Notifications

Show in bottom-right corner (desktop) or bottom-center (mobile). Auto-dismiss after 5 seconds.

**Variants to show:**

- **Success:** "URL saved successfully" (green accent, check icon)
- **Info/Duplicate:** "This URL is already in your library" (blue accent, info icon, with "View save" link)
- **Error:** "Failed to save URL. Please try again." (red accent, X icon, with "Retry" button)
- **Undo Delete:** "Save deleted" with "Undo" action button (5 second countdown)

### 9. Offline Banner

Persistent banner at the top of the page when offline.

- Yellow/amber background
- Text: "You're offline — some features may be unavailable"
- Dismissible (X button) but returns if still offline on next action
- Clears automatically when back online

### 10. Truncation Banner

Info banner shown above the saves list when user has >1000 saves.

- Light blue/info background
- Text: "Showing results from your most recent 1000 saves"
- Non-dismissible (always shown when truncated)

---

## User Flows to Prototype

### Flow 1: Browse and View

1. User lands on Saves List Page (Library) with 6-8 saves
2. Scrolls through saves
3. Clicks a save card
4. Navigates to Save Detail Page

### Flow 2: Save a URL

1. User clicks "Save URL" button
2. Create Save Modal opens
3. User enters URL, optionally adds title and tags
4. Clicks "Save"
5. Modal closes, success toast appears, new save appears at top of list

### Flow 3: Filter and Search

1. User clicks "Videos" filter chip
2. List filters to show only video saves
3. User types "react" in search bar
4. List further filters by search term
5. User clears filters — full list restored

### Flow 4: Delete with Undo

1. User clicks overflow menu on a save card, selects "Delete"
2. Delete confirmation dialog appears
3. User clicks "Delete"
4. Save removed from list with animation
5. "Save deleted — Undo" toast appears
6. (Option A) User clicks "Undo" — save reappears
7. (Option B) Toast auto-dismisses after 5 seconds — delete is permanent

### Flow 5: Empty State to First Save

1. New user lands on empty Saves List Page
2. Sees empty state illustration + "Save your first URL"
3. Clicks "Save a URL" button
4. Create Save Modal opens
5. Completes save — empty state replaced by saves list with one card

---

## Content Type Icons

Map each content type to a recognizable icon:

| Content Type | Icon Suggestion                 | Description                   |
| ------------ | ------------------------------- | ----------------------------- |
| video        | Play button in rectangle        | YouTube, Vimeo, etc.          |
| podcast      | Headphones                      | Apple Podcasts, Spotify shows |
| article      | Document/page with text         | Blog posts, articles          |
| github_repo  | GitHub octocat or code brackets | Repositories                  |
| newsletter   | Envelope/mail                   | Substack, Medium newsletters  |
| tool         | Wrench or gear                  | Developer tools, apps         |
| reddit       | Speech bubble or Reddit icon    | Reddit threads                |
| linkedin     | LinkedIn "in" logo or briefcase | LinkedIn posts                |
| other        | Chain link                      | Default fallback              |

---

## Sample Data for Prototypes

Use these example saves to populate the prototype:

| Title                                    | URL                | Type        | Tags                     | Saved       |
| ---------------------------------------- | ------------------ | ----------- | ------------------------ | ----------- |
| Building RAG Applications with LangChain | youtube.com        | video       | rag, langchain, tutorial | 2 hours ago |
| Anthropic's Guide to Prompt Engineering  | docs.anthropic.com | article     | prompts, anthropic       | 1 day ago   |
| awesome-llm-agents                       | github.com         | github_repo | agents, awesome-list     | 2 days ago  |
| Latent Space Podcast: AI Engineering     | podcasts.apple.com | podcast     | ai-engineering           | 3 days ago  |
| The Pragmatic Engineer Newsletter        | substack.com       | newsletter  | engineering, career      | 5 days ago  |
| Cursor IDE Tips and Tricks               | reddit.com         | reddit      | cursor, productivity     | 1 week ago  |
| AI in HR: Building Custom GPTs           | linkedin.com       | linkedin    | hr, custom-gpt           | 1 week ago  |
| LangSmith Observability Platform         | langsmith.com      | tool        | observability, langchain | 2 weeks ago |

---

## Notes for Lovable

- This is an **API-first application** — the backend already exists. The frontend is a React + Vite + TypeScript PWA.
- Do NOT prototype project management, linking, tutorial tracking, or search — those are future epics.
- Navigation items for "Projects" and "Tutorials" should appear in the sidebar/nav but be visually disabled (greyed out, not clickable).
- The "Save URL" action is the most important interaction — it should feel fast and prominent.
- Mobile experience matters — Maya saves from her phone during commute. The mobile layout should feel native and effortless.
