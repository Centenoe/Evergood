import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./auth.helpers";

const FALLBACK_MODEL = "gpt-5-nano";

type SearchProvider = "off" | "perplexity" | "tavily";

function normalizeSearchProvider(value?: string): SearchProvider | undefined {
  if (value === "perplexity" || value === "tavily" || value === "off") {
    return value;
  }
  return undefined;
}

/**
 * List sessions for the authenticated user.
 * If spaceId is provided, returns only sessions in that space.
 * If spaceId is omitted, returns all sessions (including unassigned).
 */
export const list = query({
  args: {
    spaceId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, { spaceId }) => {
    const userId = await requireAuth(ctx);
    if (spaceId !== undefined) {
      return await ctx.db
        .query("sessions")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .order("desc")
        .collect()
        .then((sessions) => sessions.filter((s) => s.userId === userId));
    }
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single session by ID. Verifies ownership.
 */
export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(id);
    if (!session) return null;
    if (session.userId && session.userId !== userId) return null;
    return session;
  },
});

/**
 * Create a new chat session.
 */
export const create = mutation({
  args: {
    model: v.optional(v.string()),
    title: v.optional(v.string()),
    spaceId: v.optional(v.id("spaces")),
    searchProvider: v.optional(
      v.union(v.literal("off"), v.literal("perplexity"), v.literal("tavily"))
    ),
    searchPastChats: v.optional(v.boolean()),
  },
  handler: async (ctx, { model, title, spaceId, searchProvider, searchPastChats }) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    const userPreferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let spaceDefaultModel: string | undefined;
    let spaceDefaultSearchProvider: SearchProvider | undefined;

    // Verify space ownership if provided
    if (spaceId) {
      const space = await ctx.db.get(spaceId);
      if (!space || space.userId !== userId) throw new Error("Space not found");
      spaceDefaultModel = space.defaultModel;
      spaceDefaultSearchProvider = normalizeSearchProvider(space.webSearchDefault);
    }

    const resolvedModel =
      model ?? spaceDefaultModel ?? userPreferences?.defaultModel ?? FALLBACK_MODEL;
    const resolvedSearchProvider =
      searchProvider ??
      spaceDefaultSearchProvider ??
      userPreferences?.defaultSearchProvider ??
      "off";
    const resolvedSearchPastChats =
      searchPastChats ?? userPreferences?.defaultSearchPastChats ?? false;

    return await ctx.db.insert("sessions", {
      userId,
      spaceId,
      title: title ?? "New Chat",
      model: resolvedModel,
      searchEnabled: resolvedSearchProvider !== "off",
      searchProvider: resolvedSearchProvider,
      searchPastChats: resolvedSearchPastChats,
      createdAt: now,
      lastActiveAt: now,
      messageCount: 0,
    });
  },
});

/**
 * Update a session's title. Verifies ownership.
 */
export const updateTitle = mutation({
  args: {
    id: v.id("sessions"),
    title: v.string(),
  },
  handler: async (ctx, { id, title }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) throw new Error("Forbidden");
    await ctx.db.patch(id, { title });
  },
});

/**
 * Update the active model for a session. Verifies ownership.
 */
export const updateModel = mutation({
  args: {
    id: v.id("sessions"),
    model: v.string(),
  },
  handler: async (ctx, { id, model }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) throw new Error("Forbidden");
    await ctx.db.patch(id, { model });
  },
});

/**
 * Update the remembered chat settings for a session. Verifies ownership.
 */
export const updatePreferences = mutation({
  args: {
    id: v.id("sessions"),
    searchProvider: v.optional(
      v.union(v.literal("off"), v.literal("perplexity"), v.literal("tavily"))
    ),
    searchPastChats: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, searchProvider, searchPastChats }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) throw new Error("Forbidden");

    const patch: {
      searchProvider?: SearchProvider;
      searchPastChats?: boolean;
      searchEnabled?: boolean;
    } = {};

    if (searchProvider !== undefined) {
      patch.searchProvider = searchProvider;
      patch.searchEnabled = searchProvider !== "off";
    }
    if (searchPastChats !== undefined) {
      patch.searchPastChats = searchPastChats;
    }

    await ctx.db.patch(id, patch);
  },
});

/**
 * Toggle the web search setting for a session. Verifies ownership.
 */
export const toggleSearch = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) throw new Error("Forbidden");
    await ctx.db.patch(id, { searchEnabled: !session.searchEnabled });
  },
});

/**
 * Delete a session and all of its messages + source memories. Verifies ownership.
 */
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) throw new Error("Forbidden");

    // Delete all messages belonging to this session
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // Delete memory entries where sourceSessionId matches (NOT global memories)
    const sourceMemories = await ctx.db
      .query("memories")
      .withIndex("by_source_session", (q) => q.eq("sourceSessionId", id))
      .collect();
    for (const mem of sourceMemories) {
      await ctx.db.delete(mem._id);
    }

    // Delete usage logs for this session
    const usageLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", id))
      .collect();
    for (const log of usageLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete the session itself
    await ctx.db.delete(id);
  },
});

/**
 * Toggle the bookmarked status of a session. Verifies ownership.
 */
export const toggleBookmark = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) throw new Error("Forbidden");
    await ctx.db.patch(id, { bookmarked: !session.bookmarked });
  },
});
