import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireAuth } from "./auth.helpers";
import type { Id } from "./_generated/dataModel";

/**
 * List all memories for the authenticated user.
 * - If spaceId is provided: returns memories scoped to that space.
 * - If spaceId is undefined: returns global memories (spaceId == undefined).
 * - If neither filter is desired, pass `all: true` to get everything.
 */
export const list = query({
  args: {
    category: v.optional(v.string()),
    spaceId: v.optional(v.id("spaces")),
    all: v.optional(v.boolean()),
  },
  handler: async (ctx, { category, spaceId, all }) => {
    const userId = await requireAuth(ctx);

    if (all) {
      // Return all user's memories
      const allMemories = await ctx.db
        .query("memories")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      if (category) return allMemories.filter((m) => m.category === category);
      return allMemories;
    }

    if (spaceId !== undefined) {
      // Return memories scoped to this space
      const spaceMemories = await ctx.db
        .query("memories")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .collect();
      const filtered = spaceMemories.filter((m) => m.userId === userId);
      if (category) return filtered.filter((m) => m.category === category);
      return filtered;
    }

    // Default: return global memories (no spaceId)
    const globalMemories = await ctx.db
      .query("memories")
      .withIndex("by_user_global", (q) => q.eq("userId", userId).eq("spaceId", undefined))
      .collect();
    if (category) return globalMemories.filter((m) => m.category === category);
    return globalMemories;
  },
});

/**
 * List memories relevant to a specific session.
 * Returns global memories + space-scoped memories if the session belongs to a space.
 */
export const listForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireAuth(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || (session.userId && session.userId !== userId)) return [];

    // Global memories
    const global = await ctx.db
      .query("memories")
      .withIndex("by_user_global", (q) => q.eq("userId", userId).eq("spaceId", undefined))
      .collect();

    // Space-scoped memories
    let spaceMemories: typeof global = [];
    if (session.spaceId) {
      const spaceMems = await ctx.db
        .query("memories")
        .withIndex("by_space", (q) => q.eq("spaceId", session.spaceId!))
        .collect();
      spaceMemories = spaceMems.filter((m) => m.userId === userId);
    }

    return { global, space: spaceMemories };
  },
});

/**
 * Get a single memory by ID. Verifies ownership.
 */
export const get = query({
  args: { id: v.id("memories") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const memory = await ctx.db.get(id);
    if (!memory) return null;
    if (memory.userId && memory.userId !== userId) throw new Error("Forbidden");
    return memory;
  },
});

/**
 * Upsert a memory: if a memory with the same category and content exists,
 * reinforce it (update timestamp + boost confidence). Otherwise, create it.
 */
export const upsert = mutation({
  args: {
    category: v.string(),
    content: v.string(),
    confidence: v.number(),
    spaceId: v.optional(v.id("spaces")),
    sourceSessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, { category, content, confidence, spaceId, sourceSessionId }) => {
    const userId = await requireAuth(ctx);

    if (content.length > 2_000) throw new Error("Memory content too long (max 2000 chars)");

    // Look for an existing memory with same category belonging to this user in the same scope
    let existing;
    if (spaceId) {
      const spaceMems = await ctx.db
        .query("memories")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .collect();
      existing = spaceMems.filter((m) => m.userId === userId && m.category === category);
    } else {
      existing = await ctx.db
        .query("memories")
        .withIndex("by_user_global", (q) => q.eq("userId", userId).eq("spaceId", undefined))
        .collect();
      existing = existing.filter((m) => m.category === category);
    }

    // Check if content is a close match (case-insensitive exact match for now)
    const match = existing.find(
      (m) => m.content.toLowerCase() === content.toLowerCase()
    );

    const now = Date.now();

    if (match) {
      // Reinforce existing memory
      await ctx.db.patch(match._id, {
        confidence: Math.min(1.0, match.confidence + 0.1),
        lastReinforced: now,
      });
      return match._id;
    }

    // Create new memory with userId
    const memoryId = await ctx.db.insert("memories", {
      userId,
      spaceId,
      sourceSessionId,
      category,
      content,
      confidence,
      createdAt: now,
      lastReinforced: now,
    });

    // Schedule async embedding generation
    await ctx.scheduler.runAfter(0, api.embeddings.embedMemory, { memoryId });

    return memoryId;
  },
});

/**
 * Update a memory's content and/or confidence. Verifies ownership.
 */
export const update = mutation({
  args: {
    id: v.id("memories"),
    content: v.optional(v.string()),
    confidence: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, content, confidence, category }) => {
    const userId = await requireAuth(ctx);
    const memory = await ctx.db.get(id);
    if (!memory) throw new Error("Memory not found");
    if (memory.userId && memory.userId !== userId) throw new Error("Forbidden");

    if (content !== undefined && content.length > 2_000) throw new Error("Memory content too long (max 2000 chars)");

    const patch: Record<string, unknown> = {};
    if (content !== undefined) patch.content = content;
    if (confidence !== undefined) patch.confidence = confidence;
    if (category !== undefined) patch.category = category;
    await ctx.db.patch(id, patch);
  },
});

/**
 * Save an embedding vector to a memory document.
 */
export const saveEmbedding = mutation({
  args: {
    memoryId: v.id("memories"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { memoryId, embedding }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) return;
    await ctx.db.patch(memoryId, { embedding });
  },
});

/**
 * Delete a memory. Verifies ownership.
 */
export const remove = mutation({
  args: { id: v.id("memories") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const memory = await ctx.db.get(id);
    if (!memory) throw new Error("Memory not found");
    if (memory.userId && memory.userId !== userId) throw new Error("Forbidden");
    await ctx.db.delete(id);
  },
});

/**
 * Get all memories for the authenticated user formatted as a system prompt block.
 * Returns global memories. If spaceId is provided, also includes space-scoped memories.
 */
export const getSystemPromptBlock = query({
  args: {
    spaceId: v.optional(v.id("spaces")),
  },
  handler: async (ctx, { spaceId }) => {
    const userId = await requireAuth(ctx);

    // Global memories
    const globalMemories = await ctx.db
      .query("memories")
      .withIndex("by_user_global", (q) => q.eq("userId", userId).eq("spaceId", undefined))
      .collect();

    // Space-scoped memories
    let spaceMemories: typeof globalMemories = [];
    if (spaceId) {
      const spaceMems = await ctx.db
        .query("memories")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .collect();
      spaceMemories = spaceMems.filter((m) => m.userId === userId);
    }

    const allMemories = [...globalMemories, ...spaceMemories];
    if (allMemories.length === 0) return null;

    // Group by category for clean formatting
    const grouped: Record<string, string[]> = {};
    for (const m of allMemories) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m.content);
    }

    let block = "## User Profile & Context\n";
    block += "The following information has been learned about the user from previous conversations.\n\n";

    for (const [category, items] of Object.entries(grouped)) {
      block += `### ${category}\n`;
      for (const item of items) {
        block += `- ${item}\n`;
      }
      block += "\n";
    }

    return block;
  },
});
