import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get a single message by ID.
 */
export const get = query({
  args: { id: v.id("messages") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * List all messages for a session, ordered by timestamp ascending.
 */
export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();
  },
});

/**
 * Get the currently-streaming message for a session (if any).
 * The client subscribes to this for real-time token display.
 */
export const getStreamingMessage = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .collect();
    return messages.find((m) => m.isStreaming === true) ?? null;
  },
});

/**
 * Insert a user message and bump the session's activity counters.
 */
export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    model: v.string(),
  },
  handler: async (ctx, { sessionId, content, model }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      sessionId,
      role: "user",
      content,
      model,
      timestamp: now,
    });

    await ctx.db.patch(sessionId, {
      lastActiveAt: now,
      messageCount: session.messageCount + 1,
    });

    return messageId;
  },
});

/**
 * Create a placeholder assistant message for streaming.
 */
export const startStreaming = mutation({
  args: {
    sessionId: v.id("sessions"),
    model: v.string(),
  },
  handler: async (ctx, { sessionId, model }) => {
    return await ctx.db.insert("messages", {
      sessionId,
      role: "assistant",
      content: "",
      model,
      timestamp: Date.now(),
      isStreaming: true,
    });
  },
});

/**
 * Append a chunk of streamed content to a message.
 * Called repeatedly as LLM tokens arrive.
 */
export const updateStreamingContent = mutation({
  args: {
    messageId: v.id("messages"),
    contentChunk: v.string(),
  },
  handler: async (ctx, { messageId, contentChunk }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    await ctx.db.patch(messageId, {
      content: message.content + contentChunk,
    });
  },
});

/**
 * Mark streaming as complete and save final metadata.
 */
export const finishStreaming = mutation({
  args: {
    messageId: v.id("messages"),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
  },
  handler: async (ctx, { messageId, inputTokens, outputTokens, costUsd }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");

    await ctx.db.patch(messageId, {
      isStreaming: false,
      inputTokens,
      outputTokens,
      costUsd,
    });

    // Bump session activity & message count
    const session = await ctx.db.get(message.sessionId);
    if (session) {
      await ctx.db.patch(message.sessionId, {
        lastActiveAt: Date.now(),
        messageCount: session.messageCount + 1,
      });
    }
  },
});

/**
 * Full-text search across all message content.
 * Uses Convex's built-in Tantivy full-text index.
 */
export const searchFullText = query({
  args: {
    query: v.string(),
    sessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, { query: searchQuery, sessionId }) => {
    let search = ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) => {
        const base = q.search("content", searchQuery);
        if (sessionId) {
          return base.eq("sessionId", sessionId);
        }
        return base;
      });

    const results = await search.take(25);

    // Enrich results with session info
    const enriched = await Promise.all(
      results.map(async (msg) => {
        const session = await ctx.db.get(msg.sessionId);
        return {
          ...msg,
          sessionTitle: session?.title ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

/**
 * Save an embedding vector to a message (called after embedding generation).
 */
export const saveEmbedding = mutation({
  args: {
    messageId: v.id("messages"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { messageId, embedding }) => {
    await ctx.db.patch(messageId, { embedding });
  },
});
