/** Cost per 1M tokens: [input, output] */
const MODEL_PRICING: Record<string, [number, number]> = {
	// OpenAI
	'gpt-4o': [2.50, 10.00],
	'gpt-4o-mini': [0.15, 0.60],
	'gpt-4.1': [2.00, 8.00],
	'gpt-4.1-mini': [0.40, 1.60],
	'gpt-4.1-nano': [0.10, 0.40],
	'o1': [15.00, 60.00],
	'o1-mini': [1.10, 4.40],
	'o3': [10.00, 40.00],
	'o3-mini': [1.10, 4.40],
	'o4-mini': [1.10, 4.40],
	'chatgpt-4o-latest': [5.00, 15.00],

	// Anthropic
	'claude-sonnet-4-20250514': [3.00, 15.00],
	'claude-3.5-sonnet-latest': [3.00, 15.00],
	'claude-3-haiku-20240307': [0.25, 1.25],
	'claude-3-opus-20240229': [15.00, 75.00],

	// Perplexity
	'sonar': [1.00, 1.00],
	'sonar-pro': [3.00, 15.00],
	'sonar-reasoning': [1.00, 5.00],
	'sonar-reasoning-pro': [2.00, 8.00],
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
	const pricing = MODEL_PRICING[model];
	if (!pricing) return 0;
	const [inputPer1M, outputPer1M] = pricing;
	return (inputTokens * inputPer1M + outputTokens * outputPer1M) / 1_000_000;
}

export function getInputCostPer1M(model: string): number {
	return MODEL_PRICING[model]?.[0] ?? 0;
}

export function getOutputCostPer1M(model: string): number {
	return MODEL_PRICING[model]?.[1] ?? 0;
}
