<script lang="ts">
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import Search from "lucide-svelte/icons/search";
    import { onMount } from "svelte";

    interface Props {
        selected: string;
        onSelect: (model: string) => void;
    }

    let { selected, onSelect }: Props = $props();

    const client = useConvexClient();

    let open = $state(false);
    let searchFilter = $state("");
    let models = $state<
        Array<{
            id: string;
            label: string;
            provider: string;
            maxTokens: number;
            hasPricing: boolean;
            inputCostPer1M: number;
            outputCostPer1M: number;
        }>
    >([]);
    let loading = $state(true);
    let fetchError = $state<string | null>(null);

    async function fetchModels() {
        loading = true;
        fetchError = null;
        try {
            const allModels = await client.action(api.available_models.listAvailable, {});
            // Filter by user's enabled models from settings
            const enabledRaw = localStorage.getItem("evergood-enabled-models");
            if (enabledRaw) {
                try {
                    const enabledIds: string[] = JSON.parse(enabledRaw);
                    if (Array.isArray(enabledIds) && enabledIds.length > 0) {
                        models = allModels.filter((m: { id: string }) => enabledIds.includes(m.id));
                        // If filtering removed everything, show all
                        if (models.length === 0) models = allModels;
                    } else {
                        models = allModels;
                    }
                } catch {
                    models = allModels;
                }
            } else {
                models = allModels;
            }
        } catch (e) {
            console.error("Failed to fetch models:", e);
            fetchError = e instanceof Error ? e.message : "Failed to fetch models";
            models = [];
        } finally {
            loading = false;
        }
    }

    // Fetch available models on mount
    onMount(() => {
        fetchModels();
    });

    const providerColors: Record<string, string> = {
        openai: "bg-green-500",
        anthropic: "bg-orange-500",
        perplexity: "bg-blue-500",
    };

    const providerLabels: Record<string, string> = {
        openai: "OpenAI",
        anthropic: "Anthropic",
        perplexity: "Perplexity",
    };

    let selectedModel = $derived(
        models.find((m) => m.id === selected) ?? {
            id: selected,
            label: selected,
            provider: "openai",
        },
    );

    // Group and filter models by provider
    let filteredModels = $derived.by(() => {
        const q = searchFilter.toLowerCase();
        const filtered = q
            ? models.filter(
                  (m) =>
                      m.label.toLowerCase().includes(q) ||
                      m.id.toLowerCase().includes(q) ||
                      m.provider.toLowerCase().includes(q),
              )
            : models;

        const groups: Record<string, typeof models> = {};
        for (const m of filtered) {
            const key = m.provider;
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        }
        return groups;
    });

    function handleSelect(modelId: string) {
        onSelect(modelId);
        open = false;
        searchFilter = "";
    }

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest(".model-selector")) {
            open = false;
            searchFilter = "";
        }
    }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative model-selector">
    <button
        onclick={() => (open = !open)}
        class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2d2d2d] rounded-lg transition-colors border border-gray-200 dark:border-[#333]"
    >
        {#if loading}
            <span
                class="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"
            ></span>
        {:else if fetchError}
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
        {:else}
            <span
                class="w-2 h-2 rounded-full {providerColors[
                    selectedModel.provider
                ] ?? 'bg-gray-400'}"
            ></span>
        {/if}
        {#if fetchError}
            <span class="text-red-500">Error loading models</span>
        {:else}
            {selectedModel.label}
        {/if}
        <ChevronDown size={14} class="opacity-50" />
    </button>

    {#if open}
        <div
            class="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl z-50 overflow-hidden max-h-[400px] flex flex-col"
        >
            {#if fetchError}
                <!-- Error State -->
                <div class="p-4 text-center">
                    <div class="text-red-500 text-sm font-medium mb-1">⚠ Failed to load models</div>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mb-3">{fetchError}</p>
                    <button
                        onclick={() => fetchModels()}
                        class="px-4 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Retry
                    </button>
                </div>
            {:else}
                <!-- Search Input -->
                <div class="p-2 border-b border-gray-100 dark:border-[#2a2a2a]">
                    <div class="relative">
                        <Search
                            size={14}
                            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            bind:value={searchFilter}
                            placeholder="Search models..."
                            class="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-[#2a2a2a] rounded-lg outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 border border-gray-100 dark:border-[#333]"
                        />
                    </div>
                </div>

                <!-- Model List -->
                <div class="overflow-y-auto flex-1">
                    {#each Object.entries(filteredModels) as [provider, providerModels]}
                        <div
                            class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#181818] sticky top-0"
                        >
                            {providerLabels[provider] ?? provider}
                        </div>
                        {#each providerModels as model}
                            <button
                                onclick={() => handleSelect(model.id)}
                                class="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors flex items-center gap-2.5 {model.id ===
                                selected
                                    ? 'bg-gray-50 dark:bg-[#2a2a2a]'
                                    : ''}"
                            >
                                <span
                                    class="w-2 h-2 rounded-full flex-shrink-0 {providerColors[
                                        model.provider
                                    ] ?? 'bg-gray-400'}"
                                ></span>
                                <div class="flex-1 min-w-0">
                                    <div
                                        class="font-medium text-gray-900 dark:text-gray-100 truncate"
                                    >
                                        {model.label}
                                    </div>
                                    {#if model.id !== model.label}
                                        <div
                                            class="text-[11px] text-gray-400 dark:text-gray-500 truncate"
                                        >
                                            {model.id}
                                        </div>
                                    {/if}
                                    {#if model.inputCostPer1M > 0 || model.outputCostPer1M > 0}
                                        <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                            ${model.inputCostPer1M.toFixed(2)} in / ${model.outputCostPer1M.toFixed(2)} out per 1M
                                        </div>
                                    {:else}
                                        <div class="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5 italic">
                                            No pricing data
                                        </div>
                                    {/if}
                                </div>
                                {#if model.id === selected}
                                    <span class="text-blue-500 text-xs">✓</span>
                                {/if}
                            </button>
                        {/each}
                    {/each}

                    {#if Object.keys(filteredModels).length === 0}
                        <div class="px-3 py-4 text-sm text-gray-400 text-center">
                            No matching models
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>
