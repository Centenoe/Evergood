import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  spaces: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    systemPrompt: v.string(),
    defaultModel: v.optional(v.string()),
    webSearchDefault: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_sort", ["userId", "sortOrder"]),

  sessions: defineTable({
    userId: v.optional(v.string()),
    spaceId: v.optional(v.id("spaces")),
    title: v.string(),
    model: v.string(),
    searchEnabled: v.boolean(),
    bookmarked: v.optional(v.boolean()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    messageCount: v.number(),
  })
    .index("by_last_active", ["lastActiveAt"])
    .index("by_user", ["userId", "lastActiveAt"])
    .index("by_space", ["spaceId", "lastActiveAt"]),

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
    /** Web search citations (URLs) attached to this message */
    citations: v.optional(v.array(v.string())),
    /** Web search provider that produced the citations */
    searchProvider: v.optional(v.string()),
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
    userId: v.optional(v.string()),
    spaceId: v.optional(v.id("spaces")),
    sourceSessionId: v.optional(v.id("sessions")),
    category: v.string(),
    content: v.string(),
    confidence: v.number(),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
    lastReinforced: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_user", ["userId", "category"])
    .index("by_user_global", ["userId", "spaceId"])
    .index("by_space", ["spaceId"])
    .index("by_source_session", ["sourceSessionId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId", "spaceId"],
    }),

  usageLogs: defineTable({
    userId: v.string(),
    sessionId: v.optional(v.id("sessions")),
    spaceId: v.optional(v.id("spaces")),
    model: v.string(),
    feature: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    costUsd: v.number(),
    timestamp: v.number(),
  })
    .index("by_user_time", ["userId", "timestamp"])
    .index("by_user_model", ["userId", "model"])
    .index("by_user_feature", ["userId", "feature"])
    .index("by_session", ["sessionId"])
    .index("by_space", ["spaceId"]),

  modelPricing: defineTable({
    modelId: v.string(),
    name: v.optional(v.string()),
    maxTokens: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    prompt: v.number(),
    completion: v.number(),
    input_cache_read: v.optional(v.number()),
    input_cache_write: v.optional(v.number()),
    web_search: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_model", ["modelId"]),
});
