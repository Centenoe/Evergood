<script lang="ts">
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import History from "lucide-svelte/icons/history";
    import Brain from "lucide-svelte/icons/brain";
    import Globe from "lucide-svelte/icons/globe";
    import Bug from "lucide-svelte/icons/bug";
    import ChevronDown from "lucide-svelte/icons/chevron-down";

    type SearchProvider = "off" | "perplexity" | "tavily";

    interface Props {
        model: string;
        onModelChange: (model: string) => void;
        modelSupportsThinking?: boolean;
        enableThinking?: boolean;
        searchProvider?: SearchProvider;
        onSearchProviderChange?: (provider: SearchProvider) => void;
        searchPastChats?: boolean;
        onSearchPastChatsToggle?: () => void;
        debugOpen?: boolean;
        onDebugToggle?: () => void;
        showDebug?: boolean;
        providers?: { perplexity: boolean; tavily: boolean };
    }

    let {
        model,
        onModelChange,
        modelSupportsThinking = $bindable(false),
        enableThinking = $bindable(false),
        searchProvider = "off",
        onSearchProviderChange,
        searchPastChats = false,
        onSearchPastChatsToggle,
        debugOpen = $bindable(false),
        onDebugToggle,
        showDebug = false,
        providers = { perplexity: false, tavily: false },
    }: Props = $props();

    let searchDropdownOpen = $state(false);

    let hasAnySearch = $derived(providers.perplexity || providers.tavily);

    function selectSearchProvider(provider: SearchProvider) {
        searchDropdownOpen = false;
        onSearchProviderChange?.(provider);
    }
</script>

<ModelSelector selected={model} onSelect={onModelChange} bind:selectedSupportsThinking={modelSupportsThinking} />

<!-- History toggle -->
<button
    onclick={() => onSearchPastChatsToggle?.()}
    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors
        {searchPastChats ? 'bg-eg-accent/15 text-eg-accent' : 'text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
    title="Search past conversations for context"
>
    <History size={14} />
    <span class="hidden sm:inline">History</span>
</button>

<!-- Think toggle -->
{#if modelSupportsThinking}
    <button
        onclick={() => (enableThinking = !enableThinking)}
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors
            {enableThinking ? 'bg-purple-500/15 text-purple-400' : 'text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
        title="Enable extended thinking"
    >
        <Brain size={14} />
        <span class="hidden sm:inline">Think</span>
    </button>
{/if}

<!-- Web search toggle -->
<div class="relative">
    <button
        onclick={() => { if (hasAnySearch) searchDropdownOpen = !searchDropdownOpen; }}
        disabled={!hasAnySearch}
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors
            {searchProvider !== 'off' ? 'bg-eg-accent/15 text-eg-accent' : hasAnySearch ? 'text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary' : 'text-eg-text-tertiary opacity-40 cursor-not-allowed'}"
        title={hasAnySearch ? "Web search" : "Add PERPLEXITY_API_KEY or TAVILY_API_KEY to enable"}
    >
        <Globe size={14} />
        <span class="hidden sm:inline">Web</span>
        {#if searchProvider !== "off"}
            <span class="text-[10px] uppercase">{searchProvider}</span>
        {/if}
        {#if hasAnySearch}
            <ChevronDown size={12} />
        {/if}
    </button>

    {#if searchDropdownOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fixed inset-0 z-40" onclick={() => (searchDropdownOpen = false)}></div>
        <div class="absolute bottom-full left-0 mb-2 w-48 bg-eg-surface border border-eg-border rounded-xl shadow-lg z-50 py-1" style="box-shadow: 0 8px 30px rgba(0,0,0,0.3);">
            <button onclick={() => selectSearchProvider("off")} class="w-full px-3 py-2 text-left text-xs hover:bg-eg-bg-tertiary transition-colors flex items-center gap-2 {searchProvider === 'off' ? 'text-eg-accent font-medium' : 'text-eg-text-secondary'}">
                Off
            </button>
            {#if providers.perplexity}
                <button onclick={() => selectSearchProvider("perplexity")} class="w-full px-3 py-2 text-left text-xs hover:bg-eg-bg-tertiary transition-colors flex items-center gap-2 {searchProvider === 'perplexity' ? 'text-eg-accent font-medium' : 'text-eg-text-secondary'}">
                    <span class="w-2 h-2 rounded-full bg-provider-perplexity"></span>
                    Perplexity
                </button>
            {/if}
            {#if providers.tavily}
                <button onclick={() => selectSearchProvider("tavily")} class="w-full px-3 py-2 text-left text-xs hover:bg-eg-bg-tertiary transition-colors flex items-center gap-2 {searchProvider === 'tavily' ? 'text-eg-accent font-medium' : 'text-eg-text-secondary'}">
                    <span class="w-2 h-2 rounded-full bg-eg-accent"></span>
                    Tavily
                </button>
            {/if}
        </div>
    {/if}
</div>

<!-- Debug toggle -->
{#if showDebug}
    <button
        onclick={() => {
            debugOpen = !debugOpen;
            onDebugToggle?.();
        }}
        class="flex items-center gap-1 p-1.5 text-xs font-medium rounded-lg transition-colors
            {debugOpen ? 'bg-eg-warning/15 text-eg-warning' : 'text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
        title="Debug Panel"
    >
        <Bug size={14} />
    </button>
{/if}
