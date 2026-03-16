import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./auth.helpers";

/**
 * Insert a usage log entry. Called after every AI response.
 */
export const insert = mutation({
  args: {
    sessionId: v.optional(v.id("sessions")),
    spaceId: v.optional(v.id("spaces")),
    model: v.string(),
    feature: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.insert("usageLogs", {
      userId,
      sessionId: args.sessionId,
      spaceId: args.spaceId,
      model: args.model,
      feature: args.feature,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costUsd: args.costUsd,
      timestamp: Date.now(),
    });
  },
});

/**
 * List usage logs for the authenticated user, within an optional time range.
 */
export const list = query({
  args: {
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { startTime, endTime, limit }) => {
    const userId = await requireAuth(ctx);
    const allLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    let filtered = allLogs;
    if (startTime !== undefined) filtered = filtered.filter((l) => l.timestamp >= startTime);
    if (endTime !== undefined) filtered = filtered.filter((l) => l.timestamp <= endTime);
    if (limit) filtered = filtered.slice(0, limit);
    return filtered;
  },
});

/**
 * Get usage logs for a specific session.
 */
export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireAuth(ctx);

    // Verify session ownership
    const session = await ctx.db.get(sessionId);
    if (!session || (session.userId && session.userId !== userId)) return [];

    return await ctx.db
      .query("usageLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .collect();
  },
});
