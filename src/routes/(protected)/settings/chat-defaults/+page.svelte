<script lang="ts">
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import Globe from "lucide-svelte/icons/globe";
    import History from "lucide-svelte/icons/history";
    import Sparkles from "lucide-svelte/icons/sparkles";
    import { onMount } from "svelte";

    interface ModelInfo {
        id: string;
        label: string;
        provider: string;
        inputCostPer1M: number;
        outputCostPer1M: number;
    }

    const client = useConvexClient();
    const userPreferencesQuery = useQuery(api.userPreferences.get, () => ({}));

    let allModels = $state<ModelInfo[]>([]);
    let modelsLoading = $state(true);
    let defaultModel = $state("gpt-5-nano");
    let defaultSearchProvider = $state<"off" | "perplexity" | "tavily">("off");
    let defaultSearchPastChats = $state(false);
    let chatDefaultsLoaded = $state(false);
    let chatDefaultsSaving = $state(false);
    let chatDefaultsError = $state("");
    let providers = $state<{ openai: boolean; anthropic: boolean; perplexity: boolean; tavily: boolean }>({
        openai: false,
        anthropic: false,
        perplexity: false,
        tavily: false,
    });

    const providerLabels: Record<string, string> = {
        google: "Google",
        openai: "OpenAI",
        anthropic: "Anthropic",
        perplexity: "Perplexity",
    };

    let groupedModels = $derived.by(() => {
        const groups: Record<string, ModelInfo[]> = {};
        for (const model of allModels) {
            if (!groups[model.provider]) groups[model.provider] = [];
            groups[model.provider].push(model);
        }
        return groups;
    });

    let chatDefaultsDirty = $derived(
        chatDefaultsLoaded && userPreferencesQuery.data
            ? defaultModel !== userPreferencesQuery.data.defaultModel ||
              defaultSearchProvider !== userPreferencesQuery.data.defaultSearchProvider ||
              defaultSearchPastChats !== userPreferencesQuery.data.defaultSearchPastChats
            : false,
    );

    onMount(async () => {
        try {
            allModels = await client.query(api.available_models.listAvailable, {});
            providers = await client.action(api.providers.getAvailable, {});
        } catch (error) {
            chatDefaultsError = error instanceof Error ? error.message : "Failed to load chat default options";
        } finally {
            modelsLoading = false;
        }
    });

    $effect(() => {
        if (!chatDefaultsLoaded && userPreferencesQuery.data) {
            defaultModel = userPreferencesQuery.data.defaultModel;
            defaultSearchProvider = userPreferencesQuery.data.defaultSearchProvider;
            defaultSearchPastChats = userPreferencesQuery.data.defaultSearchPastChats;
            chatDefaultsLoaded = true;
        }
    });

    async function saveChatDefaults() {
        chatDefaultsSaving = true;
        chatDefaultsError = "";
        try {
            await client.mutation(api.userPreferences.update, {
                defaultModel,
                defaultSearchProvider,
                defaultSearchPastChats,
            });
        } catch (error) {
            chatDefaultsError = error instanceof Error ? error.message : "Failed to save chat defaults";
        } finally {
            chatDefaultsSaving = false;
        }
    }
</script>

<div class="mx-auto max-w-3xl space-y-8">
    <div>
        <h1 class="text-3xl font-semibold text-eg-text">Chat Defaults</h1>
        <p class="mt-2 text-sm text-eg-text-secondary">Choose the defaults used when a new chat starts. Existing chats still remember the last settings used inside that chat.</p>
    </div>

    <section class="rounded-2xl border border-eg-border bg-eg-surface p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <div class="flex items-center gap-3 mb-1">
                    <Sparkles size={20} class="text-eg-accent" />
                    <h2 class="text-xl font-medium text-eg-text">Default Chat Behavior</h2>
                </div>
                <p class="text-sm text-eg-text-secondary">Set the model, web search provider, and memory-history toggle used when you open a brand new conversation.</p>
            </div>
            <button
                onclick={saveChatDefaults}
                disabled={!chatDefaultsDirty || chatDefaultsSaving}
                class="rounded-lg bg-eg-accent px-4 py-2 text-sm font-medium text-eg-accent-text transition-colors hover:bg-eg-accent-hover disabled:opacity-50"
            >
                {chatDefaultsSaving ? 'Saving...' : 'Save Defaults'}
            </button>
        </div>

        {#if chatDefaultsError}
            <div class="mt-4 rounded-lg border border-eg-danger/30 bg-eg-danger/10 px-3 py-2 text-sm text-eg-danger">{chatDefaultsError}</div>
        {/if}

        <div class="mt-6 space-y-5">
            <div>
                <div class="mb-2 text-sm font-medium text-eg-text">Default Model</div>
                {#if modelsLoading}
                    <div class="flex items-center gap-2 text-sm text-eg-text-tertiary">
                        <span class="h-4 w-4 rounded-full border-2 border-eg-border border-t-transparent animate-spin"></span>
                        Loading models...
                    </div>
                {:else if allModels.length > 0}
                    <select bind:value={defaultModel} class="w-full rounded-lg border border-eg-border bg-eg-bg-secondary px-3 py-2.5 text-sm text-eg-text outline-none transition-colors focus:border-eg-accent">
                        {#each Object.entries(groupedModels) as [provider, models]}
                            <optgroup label={providerLabels[provider] ?? provider}>
                                {#each models as model}
                                    <option value={model.id}>{model.label}</option>
                                {/each}
                            </optgroup>
                        {/each}
                    </select>
                {:else}
                    <p class="text-sm text-eg-text-tertiary">No models available.</p>
                {/if}
            </div>

            <div>
                <div class="mb-2 flex items-center gap-2 text-sm font-medium text-eg-text">
                    <Globe size={16} class="text-eg-info" />
                    <span>Default Web Search</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button onclick={() => (defaultSearchProvider = 'off')} class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {defaultSearchProvider === 'off' ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}">Off</button>
                    <button onclick={() => (defaultSearchProvider = 'perplexity')} disabled={!providers.perplexity} class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 {defaultSearchProvider === 'perplexity' ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}">Perplexity</button>
                    <button onclick={() => (defaultSearchProvider = 'tavily')} disabled={!providers.tavily} class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 {defaultSearchProvider === 'tavily' ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}">Tavily</button>
                </div>
                <p class="mt-2 text-[11px] text-eg-text-tertiary">Disabled providers are not currently configured in this workspace.</p>
            </div>

            <div class="rounded-xl border border-eg-border-subtle bg-eg-bg-secondary px-4 py-3">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-2 text-sm font-medium text-eg-text">
                            <History size={16} class="text-eg-warning" />
                            <span>Default History Context</span>
                        </div>
                        <p class="mt-1 text-xs text-eg-text-tertiary">New chats start with “Search past conversations for context” {defaultSearchPastChats ? 'enabled' : 'disabled'}.</p>
                    </div>
                    <button
                        onclick={() => (defaultSearchPastChats = !defaultSearchPastChats)}
                        class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {defaultSearchPastChats ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-tertiary text-eg-text-secondary hover:bg-eg-border'}"
                    >
                        {defaultSearchPastChats ? 'On' : 'Off'}
                    </button>
                </div>
            </div>
        </div>
    </section>
</div>