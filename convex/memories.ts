import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * List all memories, optionally filtered by category.
 */
export const list = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, { category }) => {
    if (category) {
      return await ctx.db
        .query("memories")
        .withIndex("by_category", (q) => q.eq("category", category))
        .collect();
    }
    return await ctx.db.query("memories").collect();
  },
});

/**
 * Get a single memory by ID.
 */
export const get = query({
  args: { id: v.id("memories") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
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
  },
  handler: async (ctx, { category, content, confidence }) => {
    // Look for an existing memory with a similar category
    const existing = await ctx.db
      .query("memories")
      .withIndex("by_category", (q) => q.eq("category", category))
      .collect();

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

    // Create new memory
    return await ctx.db.insert("memories", {
      category,
      content,
      confidence,
      createdAt: now,
      lastReinforced: now,
    });
  },
});

/**
 * Update a memory's content and/or confidence.
 */
export const update = mutation({
  args: {
    id: v.id("memories"),
    content: v.optional(v.string()),
    confidence: v.optional(v.number()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, content, confidence, category }) => {
    const patch: Record<string, unknown> = {};
    if (content !== undefined) patch.content = content;
    if (confidence !== undefined) patch.confidence = confidence;
    if (category !== undefined) patch.category = category;
    await ctx.db.patch(id, patch);
  },
});

/**
 * Delete a memory.
 */
export const remove = mutation({
  args: { id: v.id("memories") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

/**
 * Get all memories formatted as a system prompt block.
 * This is injected at the start of every conversation.
 * Returns a string ready to use as a system message content.
 */
export const getSystemPromptBlock = query({
  args: {},
  handler: async (ctx) => {
    const memories = await ctx.db.query("memories").collect();

    if (memories.length === 0) {
      return null;
    }

    // Group by category for clean formatting
    const grouped: Record<string, string[]> = {};
    for (const m of memories) {
      if (!grouped[m.category]) {
        grouped[m.category] = [];
      }
      grouped[m.category].push(m.content);
    }

    let block = "## User Profile & Context\n";
    block +=
      "The following information has been learned about the user from previous conversations.\n\n";

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
