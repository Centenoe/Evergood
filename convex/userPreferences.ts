import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth.helpers";

const FALLBACK_MODEL = "gpt-5-nano";

type SearchProvider = "off" | "perplexity" | "tavily";

function normalizeSearchProvider(value?: SearchProvider): SearchProvider {
  return value ?? "off";
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return {
      defaultModel: existing?.defaultModel ?? FALLBACK_MODEL,
      defaultSearchProvider: normalizeSearchProvider(existing?.defaultSearchProvider),
      defaultSearchPastChats: existing?.defaultSearchPastChats ?? false,
    };
  },
});

export const update = mutation({
  args: {
    defaultModel: v.string(),
    defaultSearchProvider: v.union(
      v.literal("off"),
      v.literal("perplexity"),
      v.literal("tavily")
    ),
    defaultSearchPastChats: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        defaultModel: args.defaultModel,
        defaultSearchProvider: args.defaultSearchProvider,
        defaultSearchPastChats: args.defaultSearchPastChats,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("userPreferences", {
      userId,
      defaultModel: args.defaultModel,
      defaultSearchProvider: args.defaultSearchProvider,
      defaultSearchPastChats: args.defaultSearchPastChats,
      createdAt: now,
      updatedAt: now,
    });
  },
});