# Evergood — Project Status & Agent Guide

> **Last updated:** 2026-03-15
> **Purpose:** Onboard any AI agent (Opus 4.6, etc.) working on this project. Read this FIRST.

---

## What Is Evergood?

A self-hosted, privacy-first AI command center web app. Single-user. Aggregates AI models (OpenAI, Anthropic, Perplexity, Google, Tavily) through one interface with organized workspaces (Spaces), persistent memory, deep research, live code previews, web search, temp chats, and real-time cost tracking.

**Full architecture spec:** See `.Agents/claude.md`
**UI/UX spec:** See `.Agents/ui-ux-frontend-skills.md`
**Security rules:** See `.Agents/security-skills.md`

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | SvelteKit (SPA mode) | 2.53.4 |
| UI Framework | Svelte 5 (runes ONLY) | 5.53.6 |
| Styling | Tailwind CSS v4 + `@tailwindcss/vite` | 4.2.1 |
| Language | TypeScript (strict mode) | 5.9.3 |
| Backend/DB | Convex | 1.33.0 |
| Svelte-Convex bridge | convex-svelte | 0.0.12 |
| Authentication | Clerk + svelte-clerk | 0.20.5 |
| Icons | lucide-svelte | 0.575.0 |
| Build | Vite | 7.3.1 |
| Package Manager | **PNPM only** | — |
| Adapter | adapter-auto (switch to Cloudflare Pages later) | — |

---

## Current Working State

### What Works
- Clerk authentication (sign-in, protected routes, SSR auth)
- Clerk JWT auth in Convex (`convex/auth.config.ts` + `requireAuth()` on ALL functions)
- Full userId ownership on sessions, messages, memories
- Chat sessions: create, list, delete, bookmark with auth guards
- Message streaming (OpenAI, Anthropic, Perplexity providers in `convex/ai.ts`)
- Model selector with dynamic model discovery from OpenAI
- Full-text search across messages
- Vector embeddings for semantic search (OpenAI text-embedding-3-small)
- Memory extraction from conversations (gpt-4o-mini)
- Memory injection into system prompts (Global + Space-scoped layers)
- Settings page: memory management, model visibility toggles
- CSS variable theming system (Midnight dark + Snow light themes)
- Responsive sidebar: 260px default, 64px collapsed, mobile overlay
- Sidebar: date-grouped sessions, Spaces with nested sessions, bookmarks, search
- Spaces system: CRUD, collapsible groups, system prompt injection, cascade delete
- Usage logging & cost dashboard with SVG bar charts
- **Temp Chats** (Phase 3.4): sessionStorage-backed ephemeral chat, `Ctrl/Cmd+Shift+N`, amber banner, no DB writes
- **Web Search** (Phase 3.5): Perplexity Sonar + Tavily providers, citation pills with favicons, source sidebar/bottom-sheet
- **Deep Research** (Phase 3.6): Perplexity `sonar-deep-research`, auto-saved to session, ToC sidebar, citation cards
- Reusable UI primitives: Button, Input, Modal, ConfirmDialog, Badge, Tooltip, Toggle, Skeleton
- ChatInput with auto-resize, TokenCostBar with live cost estimation
- Markdown rendering: marked + DOMPurify + shiki syntax highlighting
- Code blocks: copy/download buttons, streaming cursor animation
- CORS: origin allowlist (not permissive `*`)
- HTTP endpoints secured with auth checks + `Vary: Origin` header
- `svelte-check` passes: 0 errors, 0 warnings

### What's Broken / Missing (Known Issues)
1. **Artifact Sandbox** (Phase 3.7) — No iframe-based code preview yet
2. **Command Palette** (Phase 3.8) — No `Cmd+K` quick switcher yet
3. **Model native web_search** — Per-model tool-use for web search deferred (currently injects search results into system prompt)
4. **Accessibility audit** (Phase 4.1) — Not yet done
5. **Performance optimization** (Phase 4.2) — Lazy loading, bundle analysis pending
6. **Security headers** (Phase 4.3) — CSP, X-Frame-Options not yet configured
7. **Production hosting** (Phase 4.4) — Still on adapter-auto
8. **Testing** (Phase 4.5) — No Vitest or Playwright tests yet

---

## API Keys

### In `.env` (SvelteKit server-side)
- `PUBLIC_CLERK_PUBLISHABLE_KEY` — Required by Clerk client SDK. MUST be PUBLIC_.
- `CLERK_SECRET_KEY` — Used by `hooks.server.ts` for SSR auth. Server-only.

### In Convex Environment Variables (set via dashboard or CLI)
- `OPENAI_API_KEY` — ✅ Configured
- `ANTHROPIC_API_KEY` — Optional (enables Claude models)
- `PERPLEXITY_API_KEY` — ✅ Configured (enables web search + deep research)
- `GOOGLE_GEMINI_API_KEY` — Optional (enables Gemini models)
- `TAVILY_API_KEY` — Optional (enables Tavily as alternative search provider)
- `CLERK_ISSUER_URL` — ✅ Configured (required for Convex auth)

**How to add Convex env vars:**
```bash
pnpm convex env set VARIABLE_NAME "value"
```
Or use Convex Dashboard → Settings → Environment Variables.

**How to add Clerk JWT auth to Convex:**
1. Go to Clerk Dashboard → JWT Templates → Create template for "Convex"
2. Copy the Issuer URL (e.g., `https://helpful-mammoth-87.clerk.accounts.dev`)
3. Run: `pnpm convex env set CLERK_ISSUER_URL "https://helpful-mammoth-87.clerk.accounts.dev"`
4. Create `convex/auth.config.ts` (see Phase 1 in IMPLEMENTATION_CHECKLIST.md)

---

## File Structure (Current)

```
Evergood/
├── .Agents/                      # Agent instruction files
│   ├── claude.md                 # Full architecture spec
│   ├── ui-ux-frontend-skills.md  # UI/UX design spec
│   └── security-skills.md        # Security rules
├── convex/                       # Convex backend (at project root)
│   ├── schema.ts                 # DB schema (sessions, messages, memories, spaces, usageLogs)
│   ├── ai.ts                     # Chat engine (multi-provider streaming + non-streaming)
│   ├── sessions.ts               # Session CRUD (with spaceId support)
│   ├── messages.ts               # Message ops (with citations + searchProvider fields)
│   ├── memories.ts               # Memory CRUD (Global + Space-scoped)
│   ├── embeddings.ts             # Vector embeddings
│   ├── summarize.ts              # Memory extraction
│   ├── available_models.ts       # Model discovery
│   ├── models.ts                 # Model pricing data
│   ├── providers.ts              # API key detection (openai, anthropic, perplexity, tavily)
│   ├── spaces.ts                 # Spaces CRUD with cascade delete
│   ├── dashboard.ts              # Usage aggregation queries
│   ├── usageLogs.ts              # Usage logging insert/query
│   ├── research.ts               # Deep Research (Perplexity sonar-deep-research)
│   ├── search/                   # Web search providers
│   │   ├── perplexity.ts         # Perplexity Sonar search with citations
│   │   └── tavily.ts             # Tavily REST API search
│   ├── auth.config.ts            # Clerk OIDC auth config
│   ├── auth.helpers.ts           # Shared requireAuth() helper
│   ├── http.ts                   # HTTP action endpoints (CORS allowlisted)
│   └── _generated/               # Auto-generated by Convex CLI
├── src/
│   ├── app.css                   # Global styles + Tailwind + CSS variable theming
│   ├── app.html                  # SvelteKit shell
│   ├── app.d.ts                  # App types (Clerk auth locals)
│   ├── hooks.server.ts           # Auth middleware, route protection
│   ├── lib/
│   │   ├── components/           # Svelte components
│   │   │   ├── AuthToast.svelte
│   │   │   ├── ChatInput.svelte
│   │   │   ├── ChatMessage.svelte    # Markdown rendering, citations, code blocks
│   │   │   ├── ConvexClerkAuth.svelte
│   │   │   ├── DebugPanel.svelte
│   │   │   ├── ModelSelector.svelte
│   │   │   ├── Sidebar.svelte        # Spaces, sessions, nav (Chat/Research/Dashboard/Settings)
│   │   │   ├── TempChatBanner.svelte # Amber banner for temp chats
│   │   │   ├── Toast.svelte
│   │   │   ├── TokenCostBar.svelte
│   │   │   └── ui/                   # Reusable primitives
│   │   │       ├── Badge, Button, ConfirmDialog, Input
│   │   │       ├── Modal, Skeleton, Toggle, Tooltip
│   │   ├── stores/
│   │   │   ├── theme.svelte.ts       # Theme state (runes, localStorage)
│   │   │   ├── ui.svelte.ts          # Sidebar state (collapsed, width, mobileOpen)
│   │   │   └── tempChat.svelte.ts    # Temp chat state (sessionStorage-backed)
│   │   ├── themes/               # Midnight (dark) + Snow (light) theme configs
│   │   ├── types/                # TypeScript types (EvergoodTheme)
│   │   └── utils/                # tokenEstimator, costCalculator, markdown
│   └── routes/
│       ├── +layout.svelte        # Root: ClerkProvider + Convex + ConvexClerkAuth
│       ├── +layout.server.ts     # Clerk SSR props
│       ├── (protected)/          # Auth-required routes
│       │   ├── +layout.svelte    # Sidebar + content layout + keyboard shortcuts
│       │   ├── +page.svelte      # Home / new chat
│       │   ├── chat/[sessionId]/ # Chat session view (web search dropdown, citations)
│       │   ├── temp/             # Temp chat page (sessionStorage-only)
│       │   ├── research/         # Deep Research page (Perplexity sonar-deep-research)
│       │   ├── dashboard/        # Usage & cost dashboard
│       │   └── settings/         # Memory management, model toggles
│       └── (public)/
│           └── sign-in/          # Clerk sign-in
└── static/                       # Static assets
```

---

## Convex Commands Reference

```bash
# Start dev server (pushes schema + functions, watches for changes)
pnpm convex dev

# Deploy to production
pnpm convex deploy

# Set environment variable
pnpm convex env set KEY_NAME "value"

# List environment variables
pnpm convex env list

# Open Convex dashboard
pnpm convex dashboard

# After schema changes: just run `pnpm convex dev` — it auto-migrates
# If new required fields conflict with existing data, make them optional first
```

---

## Development Workflow

```bash
# Terminal 1: SvelteKit dev server
pnpm dev

# Terminal 2: Convex dev server (required for backend)
pnpm convex dev

# Type check
pnpm check

# Build
pnpm build
```

---

## Key Patterns in Codebase

### Svelte 5 Runes (REQUIRED — never use Svelte 4 patterns)
```svelte
let count = $state(0);                    // NOT: let count = 0
let doubled = $derived(count * 2);        // NOT: $: doubled = count * 2
let { title, onClose }: Props = $props(); // NOT: export let title
```

### Convex Queries in Svelte
```svelte
<script lang="ts">
  import { useQuery, useConvexClient } from "convex-svelte";
  import { api } from "$convex/_generated/api";

  const sessions = useQuery(api.sessions.list, {});
  const client = useConvexClient();

  // sessions.data — reactive query result
  // sessions.isLoading — loading state
</script>
```

### Auth Pattern for Convex Functions (TO BE IMPLEMENTED)
```typescript
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Unauthenticated");
// Use identity.subject as the user's Clerk ID
```
