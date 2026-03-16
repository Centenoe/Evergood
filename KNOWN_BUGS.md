# Evergood — Known Bugs & Issues

> **Purpose:** Track known bugs, their severity, root cause, and fix instructions.
> **Updated:** 2026-03-15

---

## CRITICAL — Security

### BUG-001: No Clerk Auth in Convex
- **Status:** ✅ Fixed
- **Location:** `convex/auth.config.ts`, `src/lib/components/ConvexClerkAuth.svelte`, `src/routes/+layout.svelte`
- **Resolution:** Created auth.config.ts with Clerk OIDC provider, ConvexClerkAuth.svelte to bridge Clerk tokens to Convex client, updated root layout to wire auth.

### BUG-002: No userId on Data — IDOR Vulnerability
- **Status:** ✅ Fixed
- **Location:** `convex/schema.ts`, all Convex function files
- **Resolution:** Added `userId` (optional) to sessions + memories tables with `by_user` indexes. All queries/mutations/actions now call `requireAuth()` from `convex/auth.helpers.ts` and verify ownership.

### BUG-003: HTTP Endpoints Allow Any Origin (CORS: *)
- **Status:** ✅ Fixed
- **Location:** `convex/http.ts`
- **Resolution:** Replaced wildcard CORS with origin allowlist (localhost:5173/4173 + SITE_URL env var). Added auth validation. Replaced `as any` with `Id<"sessions">`. Added Authorization header to CORS preflight.

---

## HIGH — Functionality

### BUG-004: Title Generation Race Condition
- **Status:** ✅ Fixed
- **Location:** `src/routes/(protected)/chat/[sessionId]/+page.svelte`
- **Resolution:** Added `titleGenerated` boolean flag that resets on session change. Now checks `!titleGenerated && !sessionQuery.data?.title` instead of counting messages from stale query data. Fire-and-forget with `.catch()`.

### BUG-005: Silent Mutation Failures
- **Status:** ✅ Fixed
- **Location:** `src/routes/(protected)/chat/[sessionId]/+page.svelte`
- **Resolution:** All mutation/action calls wrapped in try/catch. Added `errorMessage` state with dismissable error banner above input area. `toggleWebSearch` reverts optimistic state on failure.

---

## MEDIUM — Type Safety

### BUG-006: Excessive `as any` Assertions
- **Status:** ✅ Fixed
- **Location:** `chat/[sessionId]/+page.svelte`, `convex/http.ts`
- **Resolution:** Imported `Id` type from `$convex/_generated/dataModel`. Cast `sessionId` once at declaration to `Id<"sessions">`. All `as any` removed from both files.

### BUG-007: Unverified API Response Shapes
- **Status:** Open
- **Location:** `convex/ai.ts` ~line 52
- **Impact:** `searchSimilar` return type isn't verified. If shape changes, runtime error.
- **Fix:** Add explicit return type annotations to `searchSimilar` and validate response.

---

## LOW — Edge Cases

### BUG-008: Vector Index on Optional Embedding Field
- **Status:** Open (may not cause issues in practice)
- **Location:** `convex/schema.ts` — `messages` table
- **Impact:** `embedding` field is optional but has a vector index. Messages without embeddings are excluded from vector search (expected behavior), but worth noting.
- **Fix:** Acceptable as-is. Convex handles optional fields in vector indexes correctly.

### BUG-009: Generic Error Messages in Settings
- **Status:** Open
- **Location:** `src/routes/(protected)/settings/+page.svelte` ~line 435
- **Impact:** "Could not load models" shown for any error — network, auth, invalid key, etc.
- **Fix:** Show actual error type or at least differentiate network vs auth vs key errors.
