import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    title: v.string(),
    model: v.string(),
    searchEnabled: v.boolean(),
    bookmarked: v.optional(v.boolean()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    messageCount: v.number(),
  }).index("by_last_active", ["lastActiveAt"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    model: v.string(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    timestamp: v.number(),
    isStreaming: v.optional(v.boolean()),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_session", ["sessionId", "timestamp"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["sessionId"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["sessionId"],
    }),

  memories: defineTable({
    category: v.string(),
    content: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
    lastReinforced: v.number(),
  }).index("by_category", ["category"]),
});
