<script lang="ts">
    import { useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { estimateTokens } from "$lib/utils/tokenEstimator";
    import { estimateCost } from "$lib/utils/costCalculator";

    interface Props {
        inputText: string;
        model: string;
        totalCost?: number;
        totalInputTokens?: number;
        totalOutputTokens?: number;
    }

    let { inputText, model, totalCost = 0, totalInputTokens = 0, totalOutputTokens = 0 }: Props = $props();

    const pricingQuery = useQuery(api.pricing.listAllPricing, () => ({}));
    let oraclePricing = $derived(pricingQuery.data ?? null);

    let estimatedInputTokens = $derived(estimateTokens(inputText));
    let estimatedMessageCost = $derived(estimateCost(model, estimatedInputTokens, 0, oraclePricing));

    function formatCost(cost: number): string {
        if (cost === 0) return "$0.00";
        if (cost < 0.0001) return "<$0.0001";
        return `$${cost.toFixed(4)}`;
    }
</script>

{#if estimatedInputTokens > 0 || totalCost > 0}
    <div class="flex items-center gap-3 text-[11px] text-eg-text-tertiary tabular-nums">
        {#if estimatedInputTokens > 0}
            <span>~{estimatedInputTokens.toLocaleString()} tokens</span>
            <span class="text-eg-border">·</span>
        {/if}
        {#if estimatedMessageCost > 0}
            <span>~{formatCost(estimatedMessageCost)} est.</span>
            <span class="text-eg-border">·</span>
        {/if}
        {#if totalCost > 0}
            <span>Session: <strong class="text-eg-text-secondary">{formatCost(totalCost)}</strong></span>
            <span class="text-eg-border">·</span>
            <span>{totalInputTokens.toLocaleString()} in / {totalOutputTokens.toLocaleString()} out</span>
        {/if}
    </div>
{/if}
