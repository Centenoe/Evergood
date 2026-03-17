import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/** Pricing fields extracted from the OpenRouter API response */
interface OpenRouterPricing {
  prompt: string;
  completion: string;
  input_cache_read?: string;
  input_cache_write?: string;
  web_search?: string;
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
  pricing?: OpenRouterPricing;
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

/**
 * Fetch ALL models and pricing from OpenRouter's public /api/v1/models endpoint
 * and upsert into the modelPricing table.
 *
 * This is an internal action — only callable from crons or other internal functions.
 */
export const fetchPricing = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `OpenRouter API error (${response.status}): ${await response.text()}`
      );
    }

    const body = (await response.json()) as OpenRouterResponse;

    // Collect model + pricing info for every model in the response
    const updates: Array<{
      modelId: string;
      name: string;
      maxTokens: number;
      prompt: number;
      completion: number;
      input_cache_read?: number;
      input_cache_write?: number;
      web_search?: number;
    }> = [];

    for (const model of body.data) {
      if (!model.pricing) continue;

      const prompt = parseFloat(model.pricing.prompt);
      const completion = parseFloat(model.pricing.completion);

      // Skip models with unparseable core pricing
      if (isNaN(prompt) || isNaN(completion)) continue;

      const entry: (typeof updates)[number] = {
        modelId: model.id,
        name: model.name,
        maxTokens: model.context_length ?? 0,
        prompt,
        completion,
      };

      if (model.pricing.input_cache_read != null) {
        const val = parseFloat(model.pricing.input_cache_read);
        if (!isNaN(val)) entry.input_cache_read = val;
      }
      if (model.pricing.input_cache_write != null) {
        const val = parseFloat(model.pricing.input_cache_write);
        if (!isNaN(val)) entry.input_cache_write = val;
      }
      if (model.pricing.web_search != null) {
        const val = parseFloat(model.pricing.web_search);
        if (!isNaN(val)) entry.web_search = val;
      }

      updates.push(entry);
    }

    // Convex mutations have argument size limits, so batch in chunks
    const BATCH_SIZE = 100;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      await ctx.runMutation(internal.pricing.upsertPricing, {
        updates: updates.slice(i, i + BATCH_SIZE),
      });
    }
  },
});

/**
 * Upsert pricing data into the modelPricing table.
 * Internal mutation — only callable from internal actions (e.g., fetchPricing).
 */
export const upsertPricing = internalMutation({
  args: {
    updates: v.array(
      v.object({
        modelId: v.string(),
        name: v.string(),
        maxTokens: v.number(),
        prompt: v.number(),
        completion: v.number(),
        input_cache_read: v.optional(v.number()),
        input_cache_write: v.optional(v.number()),
        web_search: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { updates }) => {
    const now = Date.now();

    for (const u of updates) {
      const existing = await ctx.db
        .query("modelPricing")
        .withIndex("by_model", (q) => q.eq("modelId", u.modelId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: u.name,
          maxTokens: u.maxTokens,
          prompt: u.prompt,
          completion: u.completion,
          input_cache_read: u.input_cache_read,
          input_cache_write: u.input_cache_write,
          web_search: u.web_search,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("modelPricing", {
          modelId: u.modelId,
          name: u.name,
          maxTokens: u.maxTokens,
          isActive: true,
          prompt: u.prompt,
          completion: u.completion,
          input_cache_read: u.input_cache_read,
          input_cache_write: u.input_cache_write,
          web_search: u.web_search,
          updatedAt: now,
        });
      }
    }
  },
});

/**
 * Get pricing for a specific model by its OpenRouter ID.
 */
export const getModelPricing = query({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    return await ctx.db
      .query("modelPricing")
      .withIndex("by_model", (q) => q.eq("modelId", modelId))
      .unique();
  },
});

/**
 * Get all model pricing rows. Used by the frontend cost estimator
 * and model selector to build a complete pricing/model map.
 */
export const listAllPricing = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("modelPricing").collect();
  },
});
