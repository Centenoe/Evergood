import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { MODELS, makeDynamicModelConfig } from "./models";
import type { ModelConfig } from "./models";

/** Serializable model info returned to the frontend. */
export interface AvailableModel {
  id: string;
  label: string;
  provider: "openai" | "anthropic" | "perplexity";
  maxTokens: number;
  hasPricing: boolean;
}

/**
 * Returns all available models — curated list merged with
 * any additional models discovered from the OpenAI /v1/models endpoint.
 *
 * Only includes models for providers whose API keys are configured.
 */
export const listAvailable = action({
  args: {},
  handler: async (): Promise<AvailableModel[]> => {
    const models: AvailableModel[] = [];
    const seen = new Set<string>();

    // Determine which providers have API keys
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;

    // 1. Add curated models (only for providers with keys)
    for (const [id, config] of Object.entries(MODELS)) {
      if (config.provider === "openai" && !hasOpenAI) continue;
      if (config.provider === "anthropic" && !hasAnthropic) continue;
      if (config.provider === "perplexity" && !hasPerplexity) continue;

      models.push({
        id,
        label: config.label,
        provider: config.provider,
        maxTokens: config.maxTokens,
        hasPricing: config.inputCostPer1M > 0,
      });
      seen.add(id);
    }

    // 2. Fetch dynamic OpenAI models
    if (hasOpenAI) {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        });

        if (response.ok) {
          const data = (await response.json()) as {
            data: Array<{ id: string; owned_by: string }>;
          };

          // Filter for chat-capable models (gpt-*, o1-*, o3-*, o4-*, chatgpt-*)
          const chatModels = data.data.filter((m) => {
            const id = m.id.toLowerCase();
            return (
              (id.startsWith("gpt-") ||
                id.startsWith("o1") ||
                id.startsWith("o3") ||
                id.startsWith("o4") ||
                id.startsWith("chatgpt-")) &&
              !id.includes("instruct") &&
              !id.includes("realtime") &&
              !id.includes("audio") &&
              !id.includes("transcribe") &&
              !id.includes("tts") &&
              !id.includes("dall-e") &&
              !id.includes("whisper") &&
              !id.includes("embedding") &&
              !id.includes("search") &&
              !id.includes("moderation")
            );
          });

          for (const m of chatModels) {
            if (!seen.has(m.id)) {
              models.push({
                id: m.id,
                label: m.id,
                provider: "openai",
                maxTokens: 128_000,
                hasPricing: false,
              });
              seen.add(m.id);
            }
          }
        }
      } catch {
        // Silently skip — curated list is good enough
      }
    }

    // Sort: curated (with pricing) first, then alphabetical
    models.sort((a, b) => {
      if (a.hasPricing !== b.hasPricing) return a.hasPricing ? -1 : 1;
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.label.localeCompare(b.label);
    });

    return models;
  },
});
