<script lang="ts">
    import { useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import DollarSign from "lucide-svelte/icons/dollar-sign";
    import TrendingUp from "lucide-svelte/icons/trending-up";
    import Zap from "lucide-svelte/icons/zap";
    import BarChart3 from "lucide-svelte/icons/bar-chart-3";

    const summaryQuery = useQuery(api.dashboard.spendSummary, () => ({}));
    const dailyQuery = useQuery(api.dashboard.dailySpend, () => ({ days: 30 }));
    const modelQuery = useQuery(api.dashboard.spendByModel, () => ({}));
    const featureQuery = useQuery(api.dashboard.spendByFeature, () => ({}));
    const spaceQuery = useQuery(api.dashboard.spendBySpace, () => ({}));

    function formatCost(cost: number): string {
        if (cost < 0.01) return `$${cost.toFixed(4)}`;
        return `$${cost.toFixed(2)}`;
    }

    // Chart helpers for the daily spend SVG chart
    let chartData = $derived(dailyQuery.data ?? []);
    let maxDailyCost = $derived(Math.max(...chartData.map(d => d.cost), 0.001));

    function barHeight(cost: number, maxHeight: number): number {
        return (cost / maxDailyCost) * maxHeight;
    }
</script>

<main class="flex-1 min-h-0 overflow-y-auto p-6 sm:p-10 bg-eg-bg">
    <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-semibold mb-2 text-eg-text">Cost Dashboard</h1>
        <p class="text-eg-text-secondary mb-8 text-sm">Track your AI usage and spending across all conversations.</p>

        <!-- Summary Cards -->
        {#if summaryQuery.isLoading}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {#each Array(4) as _}
                    <div class="bg-eg-surface rounded-xl border border-eg-border p-5 animate-pulse">
                        <div class="h-3 bg-eg-bg-tertiary rounded w-16 mb-3"></div>
                        <div class="h-6 bg-eg-bg-tertiary rounded w-20"></div>
                    </div>
                {/each}
            </div>
        {:else if summaryQuery.data}
            {@const s = summaryQuery.data}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div class="bg-eg-surface rounded-xl border border-eg-border p-5">
                    <div class="flex items-center gap-2 text-eg-text-secondary text-xs font-medium mb-2">
                        <DollarSign size={14} />
                        Today
                    </div>
                    <div class="text-2xl font-bold text-eg-text">{formatCost(s.today)}</div>
                </div>
                <div class="bg-eg-surface rounded-xl border border-eg-border p-5">
                    <div class="flex items-center gap-2 text-eg-text-secondary text-xs font-medium mb-2">
                        <TrendingUp size={14} />
                        This Week
                    </div>
                    <div class="text-2xl font-bold text-eg-text">{formatCost(s.week)}</div>
                </div>
                <div class="bg-eg-surface rounded-xl border border-eg-border p-5">
                    <div class="flex items-center gap-2 text-eg-text-secondary text-xs font-medium mb-2">
                        <BarChart3 size={14} />
                        This Month
                    </div>
                    <div class="text-2xl font-bold text-eg-text">{formatCost(s.month)}</div>
                </div>
                <div class="bg-eg-surface rounded-xl border border-eg-border p-5">
                    <div class="flex items-center gap-2 text-eg-text-secondary text-xs font-medium mb-2">
                        <Zap size={14} />
                        All Time
                    </div>
                    <div class="text-2xl font-bold text-eg-text">{formatCost(s.allTime)}</div>
                    <div class="text-xs text-eg-text-tertiary mt-1">{s.totalRequests} requests</div>
                </div>
            </div>
        {/if}

        <!-- Daily Spend Chart (SVG bar chart) -->
        <div class="bg-eg-surface rounded-xl border border-eg-border p-6 mb-8">
            <h2 class="text-lg font-medium text-eg-text mb-4">Daily Spend (30 days)</h2>
            {#if dailyQuery.isLoading}
                <div class="h-40 flex items-center justify-center">
                    <div class="w-5 h-5 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
                </div>
            {:else if chartData.length > 0}
                <div class="overflow-x-auto">
                    <svg viewBox="0 0 {chartData.length * 20 + 40} 160" class="w-full min-w-[400px]" style="max-height: 200px;">
                        <!-- Y-axis label -->
                        <text x="0" y="10" class="fill-eg-text-tertiary" font-size="8">{formatCost(maxDailyCost)}</text>
                        <text x="0" y="140" class="fill-eg-text-tertiary" font-size="8">$0</text>
                        <!-- Bars -->
                        {#each chartData as day, i}
                            {@const h = barHeight(day.cost, 120)}
                            <rect
                                x={i * 20 + 40}
                                y={130 - h}
                                width="14"
                                height={Math.max(h, 1)}
                                rx="2"
                                class={day.cost > 0 ? "fill-eg-accent" : "fill-eg-border"}
                                opacity={day.cost > 0 ? 0.85 : 0.3}
                            >
                                <title>{day.date}: {formatCost(day.cost)}</title>
                            </rect>
                            <!-- X-axis label (every 5 days) -->
                            {#if i % 5 === 0}
                                <text x={i * 20 + 44} y="150" text-anchor="middle" class="fill-eg-text-tertiary" font-size="7">{day.date.slice(5)}</text>
                            {/if}
                        {/each}
                    </svg>
                </div>
            {:else}
                <p class="text-sm text-eg-text-tertiary text-center py-8">No usage data yet.</p>
            {/if}
        </div>

        <!-- Two-column layout: Model + Feature breakdowns -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <!-- Spend by Model -->
            <div class="bg-eg-surface rounded-xl border border-eg-border p-6">
                <h2 class="text-lg font-medium text-eg-text mb-4">Spend by Model</h2>
                {#if modelQuery.isLoading}
                    <div class="space-y-3">
                        {#each Array(3) as _}
                            <div class="animate-pulse">
                                <div class="h-3 bg-eg-bg-tertiary rounded w-24 mb-2"></div>
                                <div class="h-2 bg-eg-bg-tertiary rounded w-full"></div>
                            </div>
                        {/each}
                    </div>
                {:else if modelQuery.data && modelQuery.data.length > 0}
                    {@const maxModelCost = Math.max(...modelQuery.data.map(m => m.cost))}
                    <div class="space-y-3">
                        {#each modelQuery.data as m}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-eg-text font-medium truncate">{m.model}</span>
                                    <span class="text-eg-text-secondary ml-2 flex-shrink-0">{formatCost(m.cost)} · {m.requests} req</span>
                                </div>
                                <div class="h-2 bg-eg-bg-tertiary rounded-full overflow-hidden">
                                    <div class="h-full bg-eg-accent rounded-full transition-all" style="width: {(m.cost / maxModelCost) * 100}%"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-eg-text-tertiary text-center py-4">No data yet.</p>
                {/if}
            </div>

            <!-- Spend by Feature -->
            <div class="bg-eg-surface rounded-xl border border-eg-border p-6">
                <h2 class="text-lg font-medium text-eg-text mb-4">Spend by Feature</h2>
                {#if featureQuery.isLoading}
                    <div class="space-y-3">
                        {#each Array(3) as _}
                            <div class="animate-pulse">
                                <div class="h-3 bg-eg-bg-tertiary rounded w-24 mb-2"></div>
                                <div class="h-2 bg-eg-bg-tertiary rounded w-full"></div>
                            </div>
                        {/each}
                    </div>
                {:else if featureQuery.data && featureQuery.data.length > 0}
                    {@const maxFeatureCost = Math.max(...featureQuery.data.map(f => f.cost))}
                    <div class="space-y-3">
                        {#each featureQuery.data as f}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-eg-text font-medium capitalize">{f.feature}</span>
                                    <span class="text-eg-text-secondary">{formatCost(f.cost)} · {f.requests} req</span>
                                </div>
                                <div class="h-2 bg-eg-bg-tertiary rounded-full overflow-hidden">
                                    <div class="h-full bg-eg-success rounded-full transition-all" style="width: {(f.cost / maxFeatureCost) * 100}%"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-eg-text-tertiary text-center py-4">No data yet.</p>
                {/if}
            </div>
        </div>

        <!-- Spend by Space -->
        <div class="bg-eg-surface rounded-xl border border-eg-border p-6 mb-8">
            <h2 class="text-lg font-medium text-eg-text mb-4">Spend by Space</h2>
            {#if spaceQuery.isLoading}
                <div class="space-y-3">
                    {#each Array(2) as _}
                        <div class="animate-pulse">
                            <div class="h-3 bg-eg-bg-tertiary rounded w-24 mb-2"></div>
                            <div class="h-2 bg-eg-bg-tertiary rounded w-full"></div>
                        </div>
                    {/each}
                </div>
            {:else if spaceQuery.data && spaceQuery.data.length > 0}
                {@const maxSpaceCost = Math.max(...spaceQuery.data.map(s => s.cost))}
                <div class="space-y-3">
                    {#each spaceQuery.data as s}
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-eg-text font-medium">{s.spaceName}</span>
                                <span class="text-eg-text-secondary">{formatCost(s.cost)} · {s.requests} req</span>
                            </div>
                            <div class="h-2 bg-eg-bg-tertiary rounded-full overflow-hidden">
                                <div class="h-full bg-eg-warning rounded-full transition-all" style="width: {(s.cost / maxSpaceCost) * 100}%"></div>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-sm text-eg-text-tertiary text-center py-4">No data yet.</p>
            {/if}
        </div>
    </div>
</main>
