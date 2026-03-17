/**
 * Oracle pricing row from the modelPricing table.
 * Per-token prices (not per-1M).
 */
export interface PricingEntry {
	modelId: string;
	prompt: number;
	completion: number;
}

/**
 * Estimate cost using Oracle pricing from the database.
 * Returns 0 if no pricing data is available.
 */
export function estimateCost(
	model: string,
	inputTokens: number,
	outputTokens: number,
	oraclePricing?: PricingEntry[] | null,
): number {
	if (oraclePricing) {
		const entry = oraclePricing.find((p) => p.modelId === model);
		if (entry) {
			return inputTokens * entry.prompt + outputTokens * entry.completion;
		}
	}
	return 0;
}

export function getInputCostPer1M(model: string, oraclePricing?: PricingEntry[] | null): number {
	if (oraclePricing) {
		const entry = oraclePricing.find((p) => p.modelId === model);
		if (entry) return entry.prompt * 1_000_000;
	}
	return 0;
}

export function getOutputCostPer1M(model: string, oraclePricing?: PricingEntry[] | null): number {
	if (oraclePricing) {
		const entry = oraclePricing.find((p) => p.modelId === model);
		if (entry) return entry.completion * 1_000_000;
	}
	return 0;
}
