import { query } from "./_generated/server";
import { inferModelRouting } from "./models";
import type { Provider } from "./models";

/** Serializable model info returned to the frontend. */
export interface AvailableModel {
  id: string;
  label: string;
  provider: Provider;
  maxTokens: number;
  hasPricing: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  supportsThinking: boolean;
}

/**
 * Returns all active models from the modelPricing table.
 * The database (populated by the OpenRouter pricing oracle) is the single source of truth.
 */
export const listAvailable = query({
  args: {},
  handler: async (ctx): Promise<AvailableModel[]> => {
    const allPricing = await ctx.db.query("modelPricing").collect();

    const models: AvailableModel[] = allPricing
      .filter((row) => row.isActive !== false)
      .map((row) => {
        const routing = inferModelRouting(row.modelId);
        return {
          id: row.modelId,
          label: row.name || row.modelId,
          provider: routing.provider,
          maxTokens: row.maxTokens ?? 0,
          hasPricing: row.prompt > 0 || row.completion > 0,
          inputCostPer1M: row.prompt * 1_000_000,
          outputCostPer1M: row.completion * 1_000_000,
          supportsThinking: row.supportsThinking === true,
        };
      });

    // Sort: models with pricing first, then by provider, then alphabetical
    models.sort((a, b) => {
      if (a.hasPricing !== b.hasPricing) return a.hasPricing ? -1 : 1;
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.label.localeCompare(b.label);
    });

    return models;
  },
});
