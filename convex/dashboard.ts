import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuth } from "./auth.helpers";

/**
 * Get summary spend cards: today, this week, this month, all time.
 */
export const spendSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const weekMs = todayMs - 6 * 24 * 60 * 60 * 1000;
    const monthMs = todayMs - 29 * 24 * 60 * 60 * 1000;

    const allLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .collect();

    let today = 0;
    let week = 0;
    let month = 0;
    let allTime = 0;
    let totalRequests = 0;

    for (const log of allLogs) {
      allTime += log.costUsd;
      totalRequests++;
      if (log.timestamp >= todayMs) today += log.costUsd;
      if (log.timestamp >= weekMs) week += log.costUsd;
      if (log.timestamp >= monthMs) month += log.costUsd;
    }

    return { today, week, month, allTime, totalRequests };
  },
});

/**
 * Get daily spend for the last N days.
 */
export const dailySpend = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    const userId = await requireAuth(ctx);
    const numDays = days ?? 30;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startMs = now.getTime() - (numDays - 1) * 24 * 60 * 60 * 1000;

    const logs = await ctx.db
      .query("usageLogs")
      .withIndex("by_user_time", (q) => q.eq("userId", userId).gte("timestamp", startMs))
      .collect();

    // Group by day
    const dayMap: Record<string, number> = {};
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startMs + i * 24 * 60 * 60 * 1000);
      dayMap[d.toISOString().slice(0, 10)] = 0;
    }

    for (const log of logs) {
      const key = new Date(log.timestamp).toISOString().slice(0, 10);
      if (dayMap[key] !== undefined) dayMap[key] += log.costUsd;
    }

    return Object.entries(dayMap).map(([date, cost]) => ({ date, cost }));
  },
});

/**
 * Get spend broken down by model.
 */
export const spendByModel = query({
  args: {
    startTime: v.optional(v.number()),
  },
  handler: async (ctx, { startTime }) => {
    const userId = await requireAuth(ctx);
    const allLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .collect();

    const logs = startTime ? allLogs.filter((l) => l.timestamp >= startTime) : allLogs;

    const modelMap: Record<string, { cost: number; requests: number; inputTokens: number; outputTokens: number }> = {};
    for (const log of logs) {
      if (!modelMap[log.model]) modelMap[log.model] = { cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
      modelMap[log.model].cost += log.costUsd;
      modelMap[log.model].requests++;
      modelMap[log.model].inputTokens += log.inputTokens;
      modelMap[log.model].outputTokens += log.outputTokens;
    }

    return Object.entries(modelMap)
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.cost - a.cost);
  },
});

/**
 * Get spend broken down by feature (chat, research, embedding, etc.).
 */
export const spendByFeature = query({
  args: {
    startTime: v.optional(v.number()),
  },
  handler: async (ctx, { startTime }) => {
    const userId = await requireAuth(ctx);
    const allLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .collect();

    const logs = startTime ? allLogs.filter((l) => l.timestamp >= startTime) : allLogs;

    const featureMap: Record<string, { cost: number; requests: number }> = {};
    for (const log of logs) {
      if (!featureMap[log.feature]) featureMap[log.feature] = { cost: 0, requests: 0 };
      featureMap[log.feature].cost += log.costUsd;
      featureMap[log.feature].requests++;
    }

    return Object.entries(featureMap)
      .map(([feature, data]) => ({ feature, ...data }))
      .sort((a, b) => b.cost - a.cost);
  },
});

/**
 * Get spend broken down by space.
 */
export const spendBySpace = query({
  args: {
    startTime: v.optional(v.number()),
  },
  handler: async (ctx, { startTime }) => {
    const userId = await requireAuth(ctx);
    const allLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_user_time", (q) => q.eq("userId", userId))
      .collect();

    const logs = startTime ? allLogs.filter((l) => l.timestamp >= startTime) : allLogs;

    const spaceMap: Record<string, { cost: number; requests: number }> = {};
    for (const log of logs) {
      const key = log.spaceId ?? "general";
      if (!spaceMap[key]) spaceMap[key] = { cost: 0, requests: 0 };
      spaceMap[key].cost += log.costUsd;
      spaceMap[key].requests++;
    }

    // Resolve space names
    const result: Array<{ spaceId: string; spaceName: string; cost: number; requests: number }> = [];
    for (const [spaceId, data] of Object.entries(spaceMap)) {
      let spaceName = "General";
      if (spaceId !== "general") {
        try {
          const space = await ctx.db.get(spaceId as any);
          if (space && "name" in space) spaceName = space.name as string;
        } catch {
          spaceName = "Deleted Space";
        }
      }
      result.push({ spaceId, spaceName, ...data });
    }

    return result.sort((a, b) => b.cost - a.cost);
  },
});
