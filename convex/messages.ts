import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./auth.helpers";

/** Helper to verify the authenticated user owns a session */
async function verifySessionOwnership(
  ctx: { db: { get: (id: any) => Promise<any> }; auth: { getUserIdentity: () => Promise<any> } },
  sessionId: any,
  userId: string
) {
  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.userId && session.userId !== userId) throw new Error("Forbidden");
  return session;
}

/**
 * Get a single message by ID. Verifies session ownership.
 */
export const get = query({
  args: { id: v.id("messages") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const message = await ctx.db.get(id);
    if (!message) return null;
    await verifySessionOwnership(ctx, message.sessionId, userId);
    return message;
  },
});

/**
 * List all messages for a session, ordered by timestamp ascending.
 * Verifies the authenticated user owns the session.
 */
export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireAuth(ctx);
    await verifySessionOwnership(ctx, sessionId, userId);
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();
  },
});

/**
 * Get the currently-streaming message for a session (if any).
 * Verifies session ownership.
 */
export const getStreamingMessage = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireAuth(ctx);
    await verifySessionOwnership(ctx, sessionId, userId);
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
 * Verifies session ownership.
 */
export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    model: v.string(),
  },
  handler: async (ctx, { sessionId, content, model }) => {
    const userId = await requireAuth(ctx);
    const session = await verifySessionOwnership(ctx, sessionId, userId);

    if (content.length > 100_000) throw new Error("Message too long");
    if (content.trim().length === 0) throw new Error("Message cannot be empty");

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
 * Verifies session ownership.
 */
export const startStreaming = mutation({
  args: {
    sessionId: v.id("sessions"),
    model: v.string(),
  },
  handler: async (ctx, { sessionId, model }) => {
    const userId = await requireAuth(ctx);
    await verifySessionOwnership(ctx, sessionId, userId);
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
    const userId = await requireAuth(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    await verifySessionOwnership(ctx, message.sessionId, userId);
    await ctx.db.patch(messageId, {
      content: message.content + contentChunk,
    });
  },
});

/**
 * Mark streaming as complete and save final metadata.
 * Verifies session ownership.
 */
export const finishStreaming = mutation({
  args: {
    messageId: v.id("messages"),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    citations: v.optional(v.array(v.string())),
    searchProvider: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, inputTokens, outputTokens, costUsd, citations, searchProvider }) => {
    const userId = await requireAuth(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    await verifySessionOwnership(ctx, message.sessionId, userId);

    const patch: Record<string, unknown> = {
      isStreaming: false,
      inputTokens,
      outputTokens,
      costUsd,
    };
    if (citations && citations.length > 0) {
      patch.citations = citations;
    }
    if (searchProvider) {
      patch.searchProvider = searchProvider;
    }

    await ctx.db.patch(messageId, patch);

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
 * Filters results to only the authenticated user's sessions.
 */
export const searchFullText = query({
  args: {
    query: v.string(),
    sessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, { query: searchQuery, sessionId }) => {
    const userId = await requireAuth(ctx);

    // If sessionId provided, verify ownership
    if (sessionId) {
      await verifySessionOwnership(ctx, sessionId, userId);
    }

    const search = ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) => {
        const base = q.search("content", searchQuery);
        if (sessionId) {
          return base.eq("sessionId", sessionId);
        }
        return base;
      });

    const results = await search.take(25);

    // Filter results to only user's sessions and enrich with session info
    const enriched: Array<typeof results[number] & { sessionTitle: string }> = [];
    for (const msg of results) {
      const session = await ctx.db.get(msg.sessionId);
      if (!session) continue;
      // Only include results from sessions owned by the user
      if (session.userId && session.userId !== userId) continue;
      enriched.push({
        ...msg,
        sessionTitle: session.title ?? "Unknown",
      });
    }

    return enriched;
  },
});

/**
 * Save an embedding vector to a message (called after embedding generation).
 * Verifies session ownership.
 */
export const saveEmbedding = mutation({
  args: {
    messageId: v.id("messages"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { messageId, embedding }) => {
    const userId = await requireAuth(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    await verifySessionOwnership(ctx, message.sessionId, userId);
    await ctx.db.patch(messageId, { embedding });
  },
});
