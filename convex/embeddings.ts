import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Embed a text string and return the 1536-dim vector.
 * Uses OpenAI text-embedding-3-small.
 */
export const embedText = action({
  args: { text: v.string() },
  handler: async (_ctx, { text }): Promise<number[]> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY not configured. Add it in the Convex Dashboard → Settings → Environment Variables."
      );
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `OpenAI Embeddings API error (${response.status}): ${error}`
      );
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data[0].embedding;
  },
});

/**
 * Embed a message's content and save the vector to the message record.
 * Designed to be called after a message is fully saved.
 */
export const embedMessage = action({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    // Fetch the message to get its content
    const message = await ctx.runQuery(api.messages.get, { id: messageId });
    if (!message || !message.content) return;

    // Skip very short messages (not worth embedding)
    if (message.content.length < 20) return;

    // Generate embedding
    const embedding = await ctx.runAction(api.embeddings.embedText, {
      text: message.content.slice(0, 8000), // Truncate for embedding model limits
    });

    // Save to the message
    await ctx.runMutation(api.messages.saveEmbedding, {
      messageId,
      embedding,
    });
  },
});

/**
 * Search for semantically similar messages using vector search.
 * Returns the top N most similar messages, optionally excluding a session.
 */
export const searchSimilar = action({
  args: {
    queryText: v.string(),
    excludeSessionId: v.optional(v.id("sessions")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { queryText, excludeSessionId, limit }) => {
    const targetLimit = limit ?? 3;

    // 1. Embed the query text
    const queryEmbedding = await ctx.runAction(api.embeddings.embedText, {
      text: queryText,
    });

    // 2. Run vector search (fetch extra results to allow for filtering)
    const results = await ctx.vectorSearch("messages", "by_embedding", {
      vector: queryEmbedding,
      limit: targetLimit + 10,
    });

    // 3. Fetch full message docs and filter
    const enriched: Array<{
      _id: Id<"messages">;
      _score: number;
      content: string;
      role: string;
      sessionId: Id<"sessions">;
    }> = [];

    for (const result of results) {
      if (enriched.length >= targetLimit) break;

      const message = await ctx.runQuery(api.messages.get, {
        id: result._id,
      });
      if (!message) continue;

      // Skip messages from the excluded session
      if (excludeSessionId && message.sessionId === excludeSessionId) continue;

      enriched.push({
        _id: result._id,
        _score: result._score,
        content: message.content,
        role: message.role,
        sessionId: message.sessionId,
      });
    }

    return enriched;
  },
});
