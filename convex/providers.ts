import { action } from "./_generated/server";
import { requireAuth } from "./auth.helpers";

/** Provider availability flags returned to the frontend. */
export interface ProviderStatus {
  openai: boolean;
  anthropic: boolean;
  perplexity: boolean;
  tavily: boolean;
}

/**
 * Check which AI providers have API keys configured.
 * Returns a boolean for each provider.
 *
 * Note: process.env is only available in Convex actions, not queries.
 */
export const getAvailable = action({
  args: {},
  handler: async (ctx): Promise<ProviderStatus> => {
    await requireAuth(ctx);
    return {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      tavily: !!process.env.TAVILY_API_KEY,
    };
  },
});
