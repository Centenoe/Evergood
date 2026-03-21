<script lang="ts">
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import Search from "lucide-svelte/icons/search";
    import { onMount } from "svelte";

    interface Props {
        selected: string;
        onSelect: (model: string) => void;
        selectedSupportsThinking?: boolean;
    }

    let { selected, onSelect, selectedSupportsThinking = $bindable(false) }: Props = $props();

    const client = useConvexClient();

    let open = $state(false);
    let openUpward = $state(false);
    let searchFilter = $state("");
    let triggerEl: HTMLButtonElement | undefined = $state(undefined);
    let models = $state<
        Array<{
            id: string;
            label: string;
            provider: string;
            maxTokens: number;
            hasPricing: boolean;
            inputCostPer1M: number;
            outputCostPer1M: number;
            supportsThinking: boolean;
        }>
    >([]);
    let loading = $state(true);
    let fetchError = $state<string | null>(null);

    async function fetchModels() {
        loading = true;
        fetchError = null;
        try {
            const allModels = await client.query(api.available_models.listAvailable, {});
            const enabledRaw = localStorage.getItem("evergood-enabled-models");
            if (enabledRaw) {
                try {
                    const enabledIds: string[] = JSON.parse(enabledRaw);
                    if (Array.isArray(enabledIds) && enabledIds.length > 0) {
                        models = allModels.filter((m: { id: string }) => enabledIds.includes(m.id));
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

    onMount(() => {
        fetchModels();
    });

    const providerColors: Record<string, string> = {
        openai: "bg-provider-openai",
        anthropic: "bg-provider-anthropic",
        perplexity: "bg-provider-perplexity",
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

    // Sync bindable thinking capability when selection changes
    $effect(() => {
        const found = models.find((m) => m.id === selected);
        selectedSupportsThinking = found?.supportsThinking ?? false;
    });

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
            if (!groups[m.provider]) groups[m.provider] = [];
            groups[m.provider].push(m);
        }
        return groups;
    });

    function handleSelect(modelId: string) {
        onSelect(modelId);
        open = false;
        searchFilter = "";
    }

    function toggleOpen() {
        if (!open && triggerEl) {
            const rect = triggerEl.getBoundingClientRect();
            // 420px = max dropdown height (400) + gap (20)
            openUpward = rect.bottom + 420 > window.innerHeight;
        }
        open = !open;
        if (!open) searchFilter = "";
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
        bind:this={triggerEl}
        onclick={toggleOpen}
        class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-eg-text-secondary hover:bg-eg-bg-tertiary rounded-lg transition-colors border border-eg-border"
    >
        {#if loading}
            <span class="w-3 h-3 border border-eg-text-tertiary border-t-transparent rounded-full animate-spin"></span>
        {:else if fetchError}
            <span class="w-2 h-2 rounded-full bg-eg-danger"></span>
        {:else}
            <span class="w-2 h-2 rounded-full {providerColors[selectedModel.provider] ?? 'bg-eg-text-tertiary'}"></span>
        {/if}
        {#if fetchError}
            <span class="text-eg-danger">Error loading models</span>
        {:else}
            {selectedModel.label}
        {/if}
        <ChevronDown size={14} class="opacity-50" />
    </button>

    {#if open}
        <div
            class="absolute {openUpward ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-80 bg-eg-surface border border-eg-border rounded-xl z-50 overflow-hidden max-h-[400px] flex flex-col"
            style="box-shadow: 0 8px 30px var(--eg-shadow);"
        >
            {#if fetchError}
                <div class="p-4 text-center">
                    <div class="text-eg-danger text-sm font-medium mb-1">Failed to load models</div>
                    <p class="text-xs text-eg-text-tertiary mb-3">{fetchError}</p>
                    <button
                        onclick={() => fetchModels()}
                        class="px-4 py-1.5 text-xs font-medium bg-eg-accent text-eg-accent-text rounded-lg hover:bg-eg-accent-hover transition-colors"
                    >
                        Retry
                    </button>
                </div>
            {:else}
                <div class="p-2 border-b border-eg-border-subtle">
                    <div class="relative">
                        <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-eg-text-tertiary" />
                        <input
                            bind:value={searchFilter}
                            placeholder="Search models..."
                            class="w-full pl-8 pr-3 py-1.5 text-sm bg-eg-bg-tertiary rounded-lg outline-none text-eg-text placeholder:text-eg-text-tertiary border border-eg-border-subtle focus:border-eg-accent"
                        />
                    </div>
                </div>

                <div class="overflow-y-auto flex-1">
                    {#each Object.entries(filteredModels) as [provider, providerModels]}
                        <div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary bg-eg-bg-secondary sticky top-0">
                            {providerLabels[provider] ?? provider}
                        </div>
                        {#each providerModels as model}
                            <button
                                onclick={() => handleSelect(model.id)}
                                class="w-full text-left px-3 py-2.5 text-sm hover:bg-eg-bg-tertiary transition-colors flex items-center gap-2.5 {model.id === selected ? 'bg-eg-bg-tertiary' : ''}"
                            >
                                <span class="w-2 h-2 rounded-full flex-shrink-0 {providerColors[model.provider] ?? 'bg-eg-text-tertiary'}"></span>
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium text-eg-text truncate">{model.label}</div>
                                    {#if model.id !== model.label}
                                        <div class="text-[11px] text-eg-text-tertiary truncate">{model.id}</div>
                                    {/if}
                                    {#if model.inputCostPer1M > 0 || model.outputCostPer1M > 0}
                                        <div class="text-[10px] text-eg-text-tertiary mt-0.5">
                                            ${model.inputCostPer1M.toFixed(2)} in / ${model.outputCostPer1M.toFixed(2)} out per 1M
                                        </div>
                                    {:else}
                                        <div class="text-[10px] text-eg-text-tertiary mt-0.5 italic">No pricing data</div>
                                    {/if}
                                </div>
                                {#if model.id === selected}
                                    <span class="text-eg-accent text-xs">&#10003;</span>
                                {/if}
                            </button>
                        {/each}
                    {/each}

                    {#if Object.keys(filteredModels).length === 0}
                        <div class="px-3 py-4 text-sm text-eg-text-tertiary text-center">No matching models</div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>
