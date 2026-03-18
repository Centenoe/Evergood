import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./auth.helpers";

/**
 * List all spaces for the authenticated user, ordered by sortOrder.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("spaces")
      .withIndex("by_user_sort", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Get a single space by ID. Verifies ownership.
 */
export const get = query({
  args: { id: v.id("spaces") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const space = await ctx.db.get(id);
    if (!space) return null;
    if (space.userId !== userId) return null;
    return space;
  },
});

/**
 * Create a new space.
 */
export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    defaultModel: v.optional(v.string()),
    webSearchDefault: v.optional(v.string()),
  },
  handler: async (ctx, { name, icon, color, description, systemPrompt, defaultModel, webSearchDefault }) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    // Get next sortOrder
    const existing = await ctx.db
      .query("spaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const maxSort = existing.reduce((max, s) => Math.max(max, s.sortOrder), -1);

    return await ctx.db.insert("spaces", {
      userId,
      name,
      description,
      icon,
      color,
      systemPrompt: systemPrompt ?? "",
      defaultModel,
      webSearchDefault,
      sortOrder: maxSort + 1,
      createdAt: now,
    });
  },
});

/**
 * Update a space. Verifies ownership.
 */
export const update = mutation({
  args: {
    id: v.id("spaces"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    defaultModel: v.optional(v.string()),
    webSearchDefault: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await requireAuth(ctx);
    const space = await ctx.db.get(id);
    if (!space) throw new Error("Space not found");
    if (space.userId !== userId) throw new Error("Forbidden");

    const patch: Record<string, string | undefined> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.icon !== undefined) patch.icon = fields.icon;
    if (fields.color !== undefined) patch.color = fields.color;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.systemPrompt !== undefined) patch.systemPrompt = fields.systemPrompt;
    if (fields.defaultModel !== undefined) patch.defaultModel = fields.defaultModel;
    if (fields.webSearchDefault !== undefined) patch.webSearchDefault = fields.webSearchDefault;

    await ctx.db.patch(id, patch);
  },
});

/**
 * Delete a space and cascade-delete all sessions + messages + memories + usage logs inside it.
 */
export const remove = mutation({
  args: { id: v.id("spaces") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const space = await ctx.db.get(id);
    if (!space) throw new Error("Space not found");
    if (space.userId !== userId) throw new Error("Forbidden");

    // Cascade: delete all sessions in this space (and their messages + source memories)
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_space", (q) => q.eq("spaceId", id))
      .collect();

    for (const session of sessions) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }

      // Delete source memories for this session
      const sourceMemories = await ctx.db
        .query("memories")
        .withIndex("by_source_session", (q) => q.eq("sourceSessionId", session._id))
        .collect();
      for (const mem of sourceMemories) {
        await ctx.db.delete(mem._id);
      }

      // Delete usage logs for this session
      const sessionLogs = await ctx.db
        .query("usageLogs")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const log of sessionLogs) {
        await ctx.db.delete(log._id);
      }

      await ctx.db.delete(session._id);
    }

    // Delete space-scoped memories (that weren't already deleted via session cascade)
    const spaceMemories = await ctx.db
      .query("memories")
      .withIndex("by_space", (q) => q.eq("spaceId", id))
      .collect();
    for (const mem of spaceMemories) {
      if (mem.userId === userId) {
        await ctx.db.delete(mem._id);
      }
    }

    // Delete usage logs scoped to this space (orphaned ones not tied to a session)
    const spaceLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_space", (q) => q.eq("spaceId", id))
      .collect();
    for (const log of spaceLogs) {
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(id);
  },
});

/**
 * Reorder spaces. Takes an array of space IDs in the desired order.
 */
export const reorder = mutation({
  args: {
    spaceIds: v.array(v.id("spaces")),
  },
  handler: async (ctx, { spaceIds }) => {
    const userId = await requireAuth(ctx);
    for (let i = 0; i < spaceIds.length; i++) {
      const space = await ctx.db.get(spaceIds[i]);
      if (!space || space.userId !== userId) continue;
      await ctx.db.patch(spaceIds[i], { sortOrder: i });
    }
  },
});
