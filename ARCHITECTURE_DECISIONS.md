# Evergood — Architecture Decisions & Conventions

> **Purpose:** Document key decisions so future agents don't re-debate them.
> **Updated:** 2026-03-15

---

## Decisions

### 1. Clerk Keys Stay in `.env`, NOT in Convex
- `PUBLIC_CLERK_PUBLISHABLE_KEY` → `.env` (client-side, required by Clerk SDK)
- `CLERK_SECRET_KEY` → `.env` (server-side only, used by `hooks.server.ts`)
- Convex only receives `CLERK_ISSUER_URL` — it validates JWTs independently
- **Rationale:** Clerk's client SDK requires the publishable key in the browser. The secret key is only needed by SvelteKit's SSR hooks. Convex doesn't need the secret key — it validates JWTs using the issuer URL (JWKS endpoint).

### 2. All Provider APIs Coded, Gracefully Disabled If No Key
- Every provider (OpenAI, Anthropic, Perplexity, Google, Tavily) has full code support
- A `providers.ts` function returns boolean availability per provider
- UI shows disabled state with tooltip explaining how to enable
- Features requiring missing keys are visually present but non-functional
- **Rationale:** Better UX — user sees what's possible and knows how to unlock it.

### 3. Adapter Stays as `adapter-auto` For Now
- Target: Cloudflare Pages (when going live)
- Will switch to `@sveltejs/adapter-cloudflare-pages` or `adapter-static` later
- **Rationale:** adapter-auto works for local dev. No need to prematurely lock in.

### 4. Schema Changes Are Additive
- New fields on existing tables MUST be `v.optional(...)` initially
- Backfill existing records via migration script if needed
- Then optionally make required after backfill
- **Rationale:** Convex enforces schema at write time. Existing records without new fields would cause reads to fail validation.

### 5. PNPM Only
- All commands use `pnpm`, never `npm` or `yarn`
- Lock file: `pnpm-lock.yaml`
- Workspace config: `pnpm-workspace.yaml`

### 6. Svelte 5 Runes Exclusively
- `$state()`, `$derived()`, `$effect()`, `$props()`, `$bindable()`
- NEVER: `export let`, `$:`, `createEventDispatcher`, `<slot>`, `svelte/store`
- See `AGENTS.md` for full anti-patterns list

### 7. Convex Functions Directory at Root
- Convex files live in `/convex/` (project root), NOT `/src/convex/`
- SvelteKit alias: `$convex → ./convex` (set in `svelte.config.js`)
- Generated files: `convex/_generated/`

### 8. Authentication Architecture
- **Layer 1:** Clerk handles identity (sign-in, sign-up, session tokens)
- **Layer 2:** SvelteKit `hooks.server.ts` validates auth for SSR routes
- **Layer 3:** Convex validates JWT independently (via `auth.config.ts`)
- Every request is authenticated at both SvelteKit AND Convex levels
- Client-side route guards are for UX only, never for security

### 9. Single-User But Defense-in-Depth
- App is designed for a single user (the owner)
- Auth guards STILL validate userId ownership on all data
- **Rationale:** Defense against token leaks, future multi-user possibility, accidental data exposure

---

## Conventions

### File Naming
- Svelte components: `PascalCase.svelte` (e.g., `ChatMessage.svelte`)
- Svelte stores: `camelCase.svelte.ts` (e.g., `theme.svelte.ts`)
- Convex functions: `camelCase.ts` (e.g., `sessions.ts`)
- Types: `camelCase.ts` in `src/lib/types/`
- Utils: `camelCase.ts` in `src/lib/utils/`

### Component Props
```svelte
<script lang="ts">
  interface Props {
    title: string;
    onClose?: () => void;
  }
  let { title, onClose }: Props = $props();
</script>
```

### Convex Function Pattern
```typescript
import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";

export const myFunction = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    // ... logic
  },
});
```

### CSS Theming
- All colors reference CSS variables: `bg-bg`, `text-text`, `border-border`
- Never hardcode colors in components
- Theme definitions in `src/lib/themes/`
- Variables prefixed: `--evergood-*`

### Error Handling
- Convex functions: throw descriptive errors ("Unauthenticated", "Session not found", "Forbidden")
- Client: catch errors, show toast notifications
- Never expose internal details in error messages (no stack traces, no IDs)

### Security
- See `.Agents/security-skills.md` for comprehensive rules
- Key principle: validate auth → validate ownership → process request
- Never trust client-provided userId, always derive from JWT
- Sanitize all markdown/HTML before rendering (DOMPurify)
