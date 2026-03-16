import { v } from "convex/values";
import { action } from "../_generated/server";
import { requireAuth } from "../auth.helpers";

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  answer: string;
  results: TavilySearchResult[];
  inputTokens: number;
}

/**
 * Call Tavily Search API for web search results.
 * Returns an AI-generated answer + ranked search results with snippets.
 */
export const search = action({
  args: {
    query: v.string(),
    maxResults: v.optional(v.number()),
    searchDepth: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"))
    ),
    includeAnswer: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<TavilySearchResponse> => {
    await requireAuth(ctx);

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "TAVILY_API_KEY not configured. Add it via Convex Dashboard → Settings → Environment Variables."
      );
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: args.query,
        max_results: args.maxResults ?? 5,
        search_depth: args.searchDepth ?? "basic",
        include_answer: args.includeAnswer ?? true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tavily API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
      answer?: string;
      results: Array<{
        title: string;
        url: string;
        content: string;
        score: number;
      }>;
    };

    return {
      answer: data.answer ?? "",
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
      })),
      // Tavily doesn't report token counts, estimate from query length
      inputTokens: Math.ceil(args.query.length / 4),
    };
  },
});
