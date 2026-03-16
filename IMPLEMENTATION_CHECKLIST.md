# Evergood — Implementation Checklist

> **Instructions for agents:** Work through phases IN ORDER. Each phase must be verified before starting the next. Check off items as completed. Mark items `[x]` when done.
>
> **User uses PNPM only.** Never use npm or yarn.
> **User only has OPENAI_API_KEY in Convex.** Other providers should be coded but gracefully disabled.

---

## Phase 1: Bug Fixes + Security Hardening

**Goal:** Make the existing chat reliable and secure. No new features.

### 1.1 — Add Clerk Auth to Convex
- [x] Created `convex/auth.config.ts` with Clerk OIDC provider (domain + applicationID: "convex")
- [x] Created `src/lib/components/ConvexClerkAuth.svelte` to bridge Clerk JWT tokens to Convex client via `setAuth()`
- [x] Updated `src/routes/+layout.svelte` to render `<ConvexClerkAuth />` inside `<ClerkLoaded>`
- [x] **User action required:** Create a JWT template named "convex" in Clerk Dashboard
- [x] Verified: `pnpm convex dev --once` deploys successfully with auth config

### 1.2 — Add userId to Database Schema
- [x] Updated `convex/schema.ts`: Added `userId: v.optional(v.string())` to sessions + memories tables
- [x] Added `by_user` index on sessions: `["userId", "lastActiveAt"]`
- [x] Added `by_user` index on memories: `["userId", "category"]`
- [x] Fields are optional to avoid breaking existing data
- [x] Deployed via `pnpm convex dev --once` — indexes created successfully

### 1.3 — Add Auth Guards to ALL Convex Functions
- [x] Created `convex/auth.helpers.ts` with shared `requireAuth()` function
- [x] `convex/sessions.ts` — All functions guarded: list (by_user index), get/create/updateTitle/updateModel/toggleSearch/toggleBookmark/remove (ownership check)
- [x] `convex/messages.ts` — All functions guarded via session ownership verification
- [x] `convex/memories.ts` — All functions guarded, userId set on create/upsert, ownership checked on get/update/remove
- [x] `convex/ai.ts` — `chat` and `generateTitle` actions require auth (downstream calls also guarded)
- [x] `convex/embeddings.ts` — `embedMessage` and `searchSimilar` require auth
- [x] `convex/summarize.ts` — `extractMemories` requires auth

### 1.4 — Fix HTTP Endpoint Security
- [x] Replaced `CORS: *` with origin allowlist (localhost:5173/4173 + SITE_URL env var)
- [x] Added `Authorization` to CORS preflight allowed headers
- [x] Added explicit auth check (`ctx.auth.getUserIdentity()`) returning 401 for unauthenticated requests
- [x] Replaced `as any` with `Id<"sessions">` type casting
- [x] Added `Vary: Origin` header for proper caching

### 1.5 — Fix Client-Side Bugs
- [x] **Title generation race condition**: Added `titleGenerated` flag + checks `sessionQuery.data?.title`
- [x] **Error handling**: All mutations/actions wrapped in try/catch, added dismissable error banner
- [x] **Removed `as any`**: Imported `Id` type, cast sessionId once at declaration
- [x] **hooks.server.ts**: Verified trailing slash handling is fine — no change needed

### 1.6 — Provider Key Detection System
- [x] Created `convex/providers.ts` with `getAvailable` action returning `{ openai, anthropic, perplexity }` booleans
- [x] `ModelSelector.svelte` already filters by provider availability via `available_models.ts` (no change needed)
- [x] Updated Web Search toggle in chat page: disabled when `PERPLEXITY_API_KEY` missing, tooltip explains how to enable
- [x] Removed ALL `as any` from `src/` and `convex/` — replaced with `Id<"sessions">` / `Id<"memories">` types
- [x] `available_models.ts` already uses provider detection (checks `process.env` per provider)

### Phase 1 Verification
- [x] `pnpm convex dev --once` runs without errors — all functions deployed
- [x] `pnpm check` passes — 0 errors, 0 warnings
- [x] JWT template "convex" created in Clerk Dashboard with `aud: "convex"`
- [x] `PERPLEXITY_API_KEY` added to Convex environment variables
- [x] No `as any` in any project files (verified via grep)

---

## Phase 2: UI Overhaul

**Goal:** Redesign per `ui-ux-frontend-skills.md`. Perplexity-inspired minimalism, CSS variable theming, responsive.

### 2.1 — Theming System
- [x] Create `src/lib/types/theme.ts` with `EvergoodTheme` interface (~20 color properties)
- [x] Create `src/lib/themes/midnight.ts` (default dark theme)
- [x] Create `src/lib/themes/snow.ts` (light theme)
- [x] Create `src/lib/themes/index.ts` (registry + `setTheme()` function)
- [x] Create `src/lib/stores/theme.svelte.ts` (runes-based, persisted to localStorage)
- [x] Update `src/app.css`:
  - Define `@theme` block mapping Tailwind colors to CSS vars: `--color-bg: var(--evergood-bg);`
  - Remove all hardcoded colors
  - Add typography scale, spacing scale per spec
- [x] Color roles: bg, bg-secondary, bg-tertiary, surface, text, text-secondary, text-tertiary, accent, border, border-subtle

### 2.2 — Layout Restructure
- [x] Refactor `(protected)/+layout.svelte`:
  - Sidebar (260px by default, user-resizable 200–400px, ability to resize on mobile is not an option) + Main content area
  - Sidebar collapses to 64px icon-only mode on desktop (never fully hidden)
  - On mobile (<1024px) sidebar is an overlay
  - `Cmd/Ctrl + /` keyboard shortcut to toggle collapse/expand
- [x] Create `src/lib/stores/ui.svelte.ts` for sidebar state (collapsed, width, mobileOpen)

### 2.3 — Sidebar Redesign
- [x] Per spec: 260px, `bg-secondary`, date-grouped sessions
- [x] Active session: `bg-tertiary` + 3px left accent border
- [x] Hover: `bg-tertiary` 150ms transition
- [x] Bottom nav: Chat, Settings (Research + Dashboard deferred to Phase 3)
- [x] "Temp Chat" button (amber outline, ⚡ icon) at top — implemented in Phase 3.4
- [x] Clerk UserButton + theme toggle at bottom
- [x] Mobile: slide-over overlay with backdrop
- [x] Collapsed mode: 64px width, icons-only for nav, truncated titles for sessions
- [x] Expand/collapse toggle buttons (PanelLeftOpen/PanelLeftClose icons)

### 2.4 — Chat Panel Redesign
- [x] Max width 768px, centered, mobile-friendly
- [x] User messages in collapsible card, AI response below full-width
- [x] Add markdown rendering: `marked` + `DOMPurify` (see security-skills.md for config)
- [x] When enabling web search, sources provided by Perplexity/Tavily are handled gracefully: citation pills (max 3 visible) at bottom of response with favicons, "+N more" button opens full sources sidebar (desktop) or bottom sheet (mobile), hover shows domain + URL preview — implemented in Phase 3.5
- [x] Syntax highlighting: install `shiki` for code blocks
- [x] Copy/download buttons on code blocks
- [x] Streaming cursor blink animation
- [x] include the amount of tokens in and out plus estimated or actual cost.
- [x] Install: `pnpm add marked dompurify shiki`
- [x] Install types: `pnpm add -D @types/dompurify`

### 2.5 — ChatInput Component
- [x] Create `src/lib/components/ChatInput.svelte`
- [x] Auto-resize textarea (min 1 row, max 12 rows)
- [x] Toolbar row within: actions snippet slot for Model selector + toggles
- [x] Send button: accent bg, arrow-up icon, visible only when non-empty
- [x] Themed: `surface` bg, `border-subtle`, `border-accent` on focus
- [x] `Enter` to send (Shift+Enter for newline)

### 2.6 — TokenCostBar
- [x] Create `src/lib/components/TokenCostBar.svelte`
- [x] Create `src/lib/utils/tokenEstimator.ts` (text.length / 4 heuristic)
- [x] Create `src/lib/utils/costCalculator.ts` (model → price map)
- [x] Layout: `[tokens] · [this message cost] · [total chat cost]`
- [x] Reactively update as user types

### 2.7 — Reusable UI Primitives
- [x] Create `src/lib/components/ui/` directory
- [x] `Button.svelte` — variants: primary, secondary, ghost, danger
- [x] `Input.svelte` — themed input with label support
- [x] `Modal.svelte` — centered overlay with backdrop, Escape to close
- [x] `ConfirmDialog.svelte` — delete confirmation with red accent
- [x] `Badge.svelte` — small colored labels
- [x] `Tooltip.svelte` — hover tooltips
- [x] `Toggle.svelte` — on/off switch
- [x] `Skeleton.svelte` — pulsing loading placeholder
- [x] All themed via CSS variables, all keyboard accessible

### 2.8 — Home Page Redesign
- [x] Minimalist hero: "Where knowledge begins" or similar
- [x] Prominent ChatInput (reuse component from 2.5)
- [x] Example prompts as subtle clickable cards
- [x] Model selector integrated

### Phase 2 Verification
- [x] Toggle themes → all components update correctly
- [x] Resize 1920px → 375px → layout stays usable
- [x] Tab through all interactive elements → focus rings visible
- [x] Chat flow works end-to-end with new UI
- [x] `pnpm check` passes — 0 errors, 0 warnings
- [x] `grep -r "bg-black\|bg-white\|bg-gray\|#[0-9a-f]" src/lib/components/` finds NO hardcoded colors (only acceptable: bg-black/50 backdrops, bg-white toggle knobs)

---

## Phase 3: Full Feature Buildout

### 3.1 — Spaces System
- [x] Add `spaces` table to schema: `{ name, icon, color, systemPrompt, defaultModel, userId, sortOrder, createdAt }`
- [x] Add optional `spaceId: v.optional(v.id("spaces"))` to `sessions`
- [x] Add `by_space` index on sessions: `["spaceId", "lastActiveAt"]`
- [x] Create `convex/spaces.ts`: CRUD with auth + ownership (list, get, create, update, remove, reorder)
- [x] Cascade delete: removing a space deletes all its sessions + messages
- [x] Update `convex/sessions.ts`: create accepts `spaceId`, list can filter by `spaceId`
- [x] Update `convex/ai.ts`: inject Space system prompt into LLM context
- [x] Update Sidebar to show Space groups with nested sessions
- [x] Space groups are collapsible (chevron toggle)
- [x] Inline Space creation (icon + name input)
- [x] Inline Space rename, delete, and "new chat in space" hover actions
- [x] General (unassigned) sessions shown below Spaces, date-grouped
- [x] Clicking a Space shows its sessions; creating new session in Space auto-assigns model
- [x] `pnpm convex dev --once` deploys successfully
- [x] `pnpm check` passes — 0 errors, 0 warnings

### 3.2 — Enhanced Memory System
- [x] Add `spaceId`, `sourceSessionId`, `userId` to memories table
- [x] Implement Space-scoped vs Global memory distinction
- [x] Create Memory Manager UI at `settings/+page.svelte` (scope tabs: Global vs Space)
- [x] Implement delete cascades per security-skills.md
- [x] Memory injection: Layer 1 (Global) + Layer 2 (Space) via `getSystemPromptBlock(spaceId)`

### 3.3 — Usage Logging & Cost Dashboard
- [x] Add `usageLogs` table to schema
- [x] Create `convex/usageLogs.ts` — insert on every AI response
- [x] Create `convex/dashboard.ts` — aggregation queries (by day, model, space, feature)
- [x] Create `/dashboard` route with SVG bar charts
- [x] Dashboard nav added to Sidebar (collapsed + expanded modes)

### 3.4 — Temp Chats
- [x] Create `src/lib/stores/tempChat.svelte.ts` (sessionStorage-backed)
- [x] Create `TempChatBanner.svelte` (amber "not saved" indicator)
- [x] No Convex writes for temp chats — uses `api.ai.tempChat` non-streaming action (returns response without DB persistence)
- [x] Keyboard: `Cmd/Ctrl + Shift + N` — opens `/temp` route
- [x] Created `/temp/+page.svelte` with model selector, message display, and cost tracking
- [x] Sidebar "Temp Chat" button (⚡ Zap icon, amber outline) next to "New Thread"

### 3.5 — Web Search Integration
- [x] Create `convex/search/` directory
- [x] `convex/search/perplexity.ts` — Sonar API call with citations, returns `{content, citations, searchResults, inputTokens, outputTokens}`
- [x] `convex/search/tavily.ts` — Tavily REST API call, returns `{answer, results, inputTokens}`
- [ ] model native web_search tool if available (deferred — requires per-model tool-use implementation)
- [x] Search dropdown in chat toolbar shows available providers (Perplexity/Tavily), disabled if no API key
- [x] Citations rendered in AI responses — source pills with favicons, hover preview, "Show all sources" sidebar/bottom-sheet
- [x] Added `citations` and `searchProvider` fields to messages schema
- [x] Updated `providers.ts` to detect `TAVILY_API_KEY`
- [x] Web search results injected into LLM system prompt for augmented responses

### 3.6 — Deep Research
- [x] Create `convex/research.ts` — Perplexity `sonar-deep-research` model, auto-saves results to a new session with 🔬 prefix
- [x] Create `/research` route with query input, example prompts, loading state (30s–2min estimate), and results view
- [x] Research output: rendered markdown with Table of Contents sidebar (xl+ screens), citation cards grid, token/cost metadata, copy-to-clipboard
- [x] Requires `PERPLEXITY_API_KEY` — shows error state if missing
- [x] Usage logged via `usageLogs.insert` with feature "deep-research"
- [x] Research nav item added to Sidebar (FlaskConical icon)

### 3.7 — Artifact Sandbox (can defer)
- [ ] Create `sandbox/` directory for separate deployment
- [ ] Sandboxed iframe: `sandbox="allow-scripts"` ONLY
- [ ] PostMessage bridge with strict origin validation
- [ ] Code detection in AI responses → "Run in Sandbox" button
- [ ] Security: NO allow-same-origin, NO allow-top-navigation

### 3.8 — Command Palette
- [ ] Create `CommandPalette.svelte`
- [ ] `Cmd/Ctrl + K` trigger
- [ ] Search: sessions, spaces, models, settings
- [ ] Fuzzy search with keyboard navigation (arrow keys + Enter)

### Phase 3 Verification
- [ ] Create Space → session inside it → chat → Space system prompt injected
- [ ] Memory Manager: add/edit/delete → verify injection into chat context
- [ ] Dashboard shows real cost data
- [ ] Temp chat: messages gone on tab close, no Convex records
- [ ] Delete Space → all children cascade-deleted (check Convex Dashboard)

---

## Phase 4: Polish + Production Prep

### 4.1 — Accessibility Audit
- [ ] Focus rings: 2px accent outline, 2px offset
- [ ] Aria labels on all icon-only buttons
- [ ] WCAG AA contrast validation (4.5:1 minimum)
- [ ] Screen reader test with VoiceOver/NVDA

### 4.2 — Performance
- [ ] Lazy load: charts, artifact panel, heavy components
- [ ] `data-sveltekit-preload-data="hover"` on nav links (already in app.html)
- [ ] Image optimization: `@sveltejs/enhanced-img`
- [ ] Bundle analysis: `pnpm build` and review output sizes

### 4.3 — Security Headers
- [ ] Create `static/_headers` for Cloudflare Pages
- [ ] CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [ ] Validate CSP doesn't break Clerk or Convex WebSocket connections

### 4.4 — Hosting (DEFERRED — revisit when going live)
- [ ] Switch to `@sveltejs/adapter-cloudflare-pages` or `adapter-static`
- [ ] Configure Cloudflare Pages
- [ ] Set up sandbox subdomain for artifact iframe

### 4.5 — Testing
- [ ] Vitest unit tests for: tokenEstimator, costCalculator, formatters, markdown
- [ ] Playwright E2E: login → create session → send message → receive response
- [ ] `svelte-check` in CI pipeline

---

## Quick Reference: Database Changes

After ANY schema change in `convex/schema.ts`:
```bash
pnpm convex dev    # Dev: auto-pushes schema
pnpm convex deploy # Prod: deploys everything
```

If adding a required field to a table with existing data:
1. Make the field `v.optional(...)` first
2. Push the schema
3. Write a migration to backfill existing records
4. Then make the field required (or leave optional)

---

## Quick Reference: Adding a New API Key

```bash
# Add to Convex environment variables
pnpm convex env set ANTHROPIC_API_KEY "sk-ant-..."
pnpm convex env set PERPLEXITY_API_KEY "pplx-..."
pnpm convex env set TAVILY_API_KEY "tvly-..."
pnpm convex env set GOOGLE_GEMINI_API_KEY "..."

# Verify
pnpm convex env list
```

The provider detection system (Phase 1.6) will automatically enable features when keys are present.
