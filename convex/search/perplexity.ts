import { v } from "convex/values";
import { action } from "../_generated/server";
import { requireAuth } from "../auth.helpers";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface PerplexitySearchResponse {
  content: string;
  citations: string[];
  searchResults: SearchResult[];
  inputTokens: number;
  outputTokens: number;
}

/**
 * Call Perplexity Sonar API for web search-augmented responses.
 * Returns the answer content along with citations/sources.
 */
export const search = action({
  args: {
    query: v.string(),
    model: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    chatHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<PerplexitySearchResponse> => {
    await requireAuth(ctx);

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PERPLEXITY_API_KEY not configured. Add it via Convex Dashboard → Settings → Environment Variables."
      );
    }

    const sonarModel = args.model ?? "sonar";
    const systemContent =
      args.systemPrompt ??
      "You are a helpful assistant. Provide accurate, well-sourced answers based on web search results. Always cite your sources.";

    const messages = [
      { role: "system" as const, content: systemContent },
      ...(args.chatHistory ?? []),
      { role: "user" as const, content: args.query },
    ];

    const response = await fetch(
      "https://api.perplexity.ai/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: sonarModel,
          messages,
          return_citations: true,
          return_related_questions: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${error}`);
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

    // Build search results from citations (Perplexity returns URLs)
    const searchResults: SearchResult[] = citations.map(
      (url: string, i: number) => ({
        title: extractDomain(url),
        url,
        snippet: "",
      })
    );

    return {
      content,
      citations,
      searchResults,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  },
});

/** Extract domain name from URL for display */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
