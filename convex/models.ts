/**
 * Model configuration — maps model IDs to API details and pricing.
 *
 * Models are keyed by their actual API model ID so the user sees
 * exactly what they're using. The frontend fetches the full list
 * and groups by provider.
 */

export interface ModelConfig {
  provider: "anthropic" | "openai" | "perplexity";
  apiModel: string;
  label: string;
  maxTokens: number;
  /** Cost per 1M input tokens in USD */
  inputCostPer1M: number;
  /** Cost per 1M output tokens in USD */
  outputCostPer1M: number;
}

/**
 * Known models with pricing. These are the "curated" defaults.
 * Dynamic models fetched from the OpenAI API will be merged in at runtime.
 */
export const MODELS: Record<string, ModelConfig> = {
  // ── OpenAI ──
  "gpt-4o": {
    provider: "openai",
    apiModel: "gpt-4o",
    label: "GPT-4o",
    maxTokens: 128_000,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
  },
  "gpt-4o-mini": {
    provider: "openai",
    apiModel: "gpt-4o-mini",
    label: "GPT-4o Mini",
    maxTokens: 128_000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
  },
  "gpt-4.1": {
    provider: "openai",
    apiModel: "gpt-4.1",
    label: "GPT-4.1",
    maxTokens: 1_047_576,
    inputCostPer1M: 2.0,
    outputCostPer1M: 8.0,
  },
  "gpt-4.1-mini": {
    provider: "openai",
    apiModel: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    maxTokens: 1_047_576,
    inputCostPer1M: 0.4,
    outputCostPer1M: 1.6,
  },
  "gpt-4.1-nano": {
    provider: "openai",
    apiModel: "gpt-4.1-nano",
    label: "GPT-4.1 Nano",
    maxTokens: 1_047_576,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
  },
  "o4-mini": {
    provider: "openai",
    apiModel: "o4-mini",
    label: "o4 Mini",
    maxTokens: 200_000,
    inputCostPer1M: 1.1,
    outputCostPer1M: 4.4,
  },
  "o3": {
    provider: "openai",
    apiModel: "o3",
    label: "o3",
    maxTokens: 200_000,
    inputCostPer1M: 2.0,
    outputCostPer1M: 8.0,
  },
  "o3-mini": {
    provider: "openai",
    apiModel: "o3-mini",
    label: "o3 Mini",
    maxTokens: 200_000,
    inputCostPer1M: 1.1,
    outputCostPer1M: 4.4,
  },

  // ── Anthropic ──
  "claude-sonnet-4-20250514": {
    provider: "anthropic",
    apiModel: "claude-sonnet-4-20250514",
    label: "Claude Sonnet 4",
    maxTokens: 200_000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  "claude-opus-4-20250514": {
    provider: "anthropic",
    apiModel: "claude-opus-4-20250514",
    label: "Claude Opus 4",
    maxTokens: 200_000,
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
  },
  "claude-3-5-sonnet-20241022": {
    provider: "anthropic",
    apiModel: "claude-3-5-sonnet-20241022",
    label: "Claude 3.5 Sonnet",
    maxTokens: 200_000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  "claude-3-5-haiku-20241022": {
    provider: "anthropic",
    apiModel: "claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku",
    maxTokens: 200_000,
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
  },

  // ── Perplexity ──
  "sonar-pro": {
    provider: "perplexity",
    apiModel: "sonar-pro",
    label: "Sonar Pro",
    maxTokens: 127_072,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  "sonar": {
    provider: "perplexity",
    apiModel: "sonar",
    label: "Sonar",
    maxTokens: 127_072,
    inputCostPer1M: 1.0,
    outputCostPer1M: 1.0,
  },
};

/** Calculate cost in USD from token counts */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODELS[model];
  if (!config) return 0;
  return (
    (inputTokens / 1_000_000) * config.inputCostPer1M +
    (outputTokens / 1_000_000) * config.outputCostPer1M
  );
}

/**
 * Get a fallback ModelConfig for a model that was discovered dynamically
 * (e.g. from the OpenAI /v1/models endpoint) but isn't in our curated list.
 */
export function makeDynamicModelConfig(
  modelId: string,
  provider: "openai" | "anthropic" | "perplexity"
): ModelConfig {
  return {
    provider,
    apiModel: modelId,
    label: modelId,
    maxTokens: 128_000,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
  };
}
