import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * List all sessions, sorted by most recently active first.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_last_active")
      .order("desc")
      .collect();
  },
});

/**
 * Get a single session by ID.
 */
export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * Create a new chat session.
 */
export const create = mutation({
  args: {
    model: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { model, title }) => {
    const now = Date.now();
    return await ctx.db.insert("sessions", {
      title: title ?? "New Chat",
      model,
      searchEnabled: false,
      createdAt: now,
      lastActiveAt: now,
      messageCount: 0,
    });
  },
});

/**
 * Update a session's title.
 */
export const updateTitle = mutation({
  args: {
    id: v.id("sessions"),
    title: v.string(),
  },
  handler: async (ctx, { id, title }) => {
    await ctx.db.patch(id, { title });
  },
});

/**
 * Update the active model for a session.
 */
export const updateModel = mutation({
  args: {
    id: v.id("sessions"),
    model: v.string(),
  },
  handler: async (ctx, { id, model }) => {
    await ctx.db.patch(id, { model });
  },
});

/**
 * Toggle the web search setting for a session.
 */
export const toggleSearch = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    const session = await ctx.db.get(id);
    if (!session) throw new Error("Session not found");
    await ctx.db.patch(id, { searchEnabled: !session.searchEnabled });
  },
});

/**
 * Delete a session and all of its messages.
 */
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, { id }) => {
    // Delete all messages belonging to this session
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    // Delete the session itself
    await ctx.db.delete(id);
  },
});
