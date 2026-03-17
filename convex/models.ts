/**
 * Model utilities — provider inference and cost calculation.
 *
 * All model data (names, pricing, context lengths) now lives in the
 * Convex `modelPricing` table, populated by the OpenRouter pricing oracle.
 * This file provides lightweight helpers for routing and cost math.
 */

/** Provider type supported by the app */
export type Provider = "anthropic" | "openai" | "perplexity" | "google";

/**
 * Minimal config needed to route an API call to the correct provider.
 * No pricing — that comes from the database.
 */
export interface ModelRouting {
  provider: Provider;
  apiModel: string;
}

/**
 * Infer the provider and API model ID from an OpenRouter-style model ID.
 * OpenRouter IDs follow the format "provider/model-name".
 */
export function inferModelRouting(modelId: string): ModelRouting {
  const slashIndex = modelId.indexOf("/");
  if (slashIndex > 0) {
    const prefix = modelId.slice(0, slashIndex);
    const apiModel = modelId.slice(slashIndex + 1);

    const providerMap: Record<string, Provider> = {
      openai: "openai",
      anthropic: "anthropic",
      perplexity: "perplexity",
      google: "google",
    };

    const provider = providerMap[prefix];
    if (provider) {
      return { provider, apiModel };
    }
  }

  // Fallback: try to guess from the model name itself
  if (modelId.startsWith("claude-")) return { provider: "anthropic", apiModel: modelId };
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4") || modelId.startsWith("chatgpt-"))
    return { provider: "openai", apiModel: modelId };
  if (modelId.startsWith("sonar")) return { provider: "perplexity", apiModel: modelId };
  if (modelId.startsWith("gemini")) return { provider: "google", apiModel: modelId };

  // Default to openai if we truly can't tell
  return { provider: "openai", apiModel: modelId };
}

/**
 * Pricing data from the modelPricing table (per-token prices).
 */
export interface OraclePricing {
  prompt: number;
  completion: number;
  input_cache_read?: number;
  input_cache_write?: number;
  web_search?: number;
}

/**
 * Calculate cost using Oracle pricing from the modelPricing table.
 * Supports cache token breakdowns (Anthropic cache_read/cache_write, OpenAI cached_tokens).
 * Returns 0 if no pricing data is available.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  oraclePricing: OraclePricing | null,
  cacheTokens?: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  }
): number {
  if (!oraclePricing) return 0;

  let cost = 0;

  const cachedRead = cacheTokens?.cacheReadTokens ?? 0;
  const cachedWrite = cacheTokens?.cacheWriteTokens ?? 0;
  const regularInputTokens = Math.max(0, inputTokens - cachedRead - cachedWrite);

  cost += regularInputTokens * oraclePricing.prompt;

  // Cache read tokens (cheaper than regular input)
  if (cachedRead > 0 && oraclePricing.input_cache_read != null) {
    cost += cachedRead * oraclePricing.input_cache_read;
  } else {
    cost += cachedRead * oraclePricing.prompt;
  }

  // Cache write tokens (often more expensive than regular input)
  if (cachedWrite > 0 && oraclePricing.input_cache_write != null) {
    cost += cachedWrite * oraclePricing.input_cache_write;
  } else {
    cost += cachedWrite * oraclePricing.prompt;
  }

  // Output/completion tokens
  cost += outputTokens * oraclePricing.completion;

  return cost;
}
