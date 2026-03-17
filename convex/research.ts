import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { requireAuth } from "./auth.helpers";
import { api } from "./_generated/api";
import { calculateCost } from "./models";
import type { OraclePricing } from "./models";

/**
 * Start a deep research query using Perplexity's sonar-deep-research model.
 * This returns a comprehensive, well-cited research document.
 *
 * Note: Deep research takes significantly longer than regular chat (30s–2min+).
 */
export const run = action({
  args: {
    query: v.string(),
    sessionId: v.optional(v.id("sessions")),
    spaceId: v.optional(v.id("spaces")),
  },
  handler: async (
    ctx,
    { query: researchQuery, sessionId, spaceId }
  ): Promise<{
    content: string;
    citations: string[];
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }> => {
    const userId = await requireAuth(ctx);

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PERPLEXITY_API_KEY not configured. Add it via Convex Dashboard → Settings → Environment Variables."
      );
    }

    if (researchQuery.length > 10_000) {
      throw new Error("Research query too long (max 10,000 characters)");
    }

    const response = await fetch(
      "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "sonar-deep-research",
          messages: [
            {
              role: "system",
              content:
                "You are an expert research assistant. Provide a comprehensive, well-structured research document with clear sections, citations, and key findings. Use markdown formatting with proper headings.",
            },
            {
              role: "user",
              content: researchQuery,
            },
          ],
          return_citations: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Perplexity Deep Research API error (${response.status}): ${error}`
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
      citations?: string[];
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
      };
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const citations = data.citations ?? [];
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    // Oracle pricing lookup
    let oraclePricing: OraclePricing | null = null;
    try {
      const pricingRow = await ctx.runQuery(api.pricing.getModelPricing, { modelId: "perplexity/sonar-deep-research" });
      if (pricingRow) {
        oraclePricing = {
          prompt: pricingRow.prompt,
          completion: pricingRow.completion,
          input_cache_read: pricingRow.input_cache_read ?? undefined,
          input_cache_write: pricingRow.input_cache_write ?? undefined,
          web_search: pricingRow.web_search ?? undefined,
        };
      }
    } catch {
      // Non-critical
    }

    const costUsd = calculateCost(inputTokens, outputTokens, oraclePricing);

    // Log usage for the cost dashboard
    try {
      await ctx.runMutation(api.usageLogs.insert, {
        sessionId: sessionId ?? undefined,
        spaceId: spaceId ?? undefined,
        model: "sonar-deep-research",
        feature: "deep-research",
        inputTokens,
        outputTokens,
        costUsd,
      });
    } catch {
      // Usage logging is non-critical
    }

    // Save the research result to a new session for future reference
    try {
      const researchSessionId = await ctx.runMutation(
        api.sessions.create,
        {
          model: "sonar-deep-research",
          spaceId: spaceId ?? undefined,
        }
      );

      // Save the query as user message
      await ctx.runMutation(api.messages.send, {
        sessionId: researchSessionId,
        content: `[Deep Research] ${researchQuery}`,
        model: "sonar-deep-research",
      });

      // Save the response as assistant message with finishStreaming pattern
      const streamingId = await ctx.runMutation(
        api.messages.startStreaming,
        {
          sessionId: researchSessionId,
          model: "sonar-deep-research",
        }
      );
      await ctx.runMutation(api.messages.updateStreamingContent, {
        messageId: streamingId,
        contentChunk: content,
      });
      await ctx.runMutation(api.messages.finishStreaming, {
        messageId: streamingId,
        inputTokens,
        outputTokens,
        costUsd,
        citations: citations.length > 0 ? citations : undefined,
        searchProvider: "perplexity",
      });

      // Generate a title for the research session
      const shortTitle =
        researchQuery.length > 50
          ? researchQuery.slice(0, 50) + "..."
          : researchQuery;
      await ctx.runMutation(api.sessions.updateTitle, {
        id: researchSessionId,
        title: `🔬 ${shortTitle}`,
      });
    } catch {
      // Session saving is non-critical — user still gets the research result
    }

    return {
      content,
      citations,
      inputTokens,
      outputTokens,
      costUsd,
    };
  },
});
