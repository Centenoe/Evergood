<script lang="ts">
    import { page } from "$app/stores";
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import ChatMessage from "$lib/components/ChatMessage.svelte";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import DebugPanel from "$lib/components/DebugPanel.svelte";
    import ChatInput from "$lib/components/ChatInput.svelte";
    import TokenCostBar from "$lib/components/TokenCostBar.svelte";
    import Search from "lucide-svelte/icons/search";
    import Globe from "lucide-svelte/icons/globe";
    import History from "lucide-svelte/icons/history";
    import Bug from "lucide-svelte/icons/bug";
    import ChevronDown from "lucide-svelte/icons/chevron-down";

    import { tick, onMount } from "svelte";

    const client = useConvexClient();

    let sessionId: Id<"sessions"> | undefined = $derived(
        $page.params.sessionId as Id<"sessions"> | undefined,
    );

    let providers = $state<{ openai: boolean; anthropic: boolean; perplexity: boolean; tavily: boolean }>({
        openai: false,
        anthropic: false,
        perplexity: false,
        tavily: false,
    });

    onMount(async () => {
        try {
            providers = await client.action(api.providers.getAvailable, {});
        } catch {
            // Silently fail
        }
    });

    const sessionQuery = useQuery(
        api.sessions.get,
        () => (sessionId ? { id: sessionId } : "skip"),
    );
    const messagesQuery = useQuery(
        api.messages.list,
        () => (sessionId ? { sessionId } : "skip"),
    );
    const streamingQuery = useQuery(
        api.messages.getStreamingMessage,
        () => (sessionId ? { sessionId } : "skip"),
    );

    let prompt = $state("");
    let sending = $state(false);
    let searchProvider = $state<"off" | "perplexity" | "tavily">("off");
    let searchDropdownOpen = $state(false);
    let searchPastChats = $state(false);
    let debugOpen = $state(false);
    let messagesContainer: HTMLDivElement | undefined = $state(undefined);

    let currentModel = $derived(sessionQuery.data?.model ?? "gpt-4o");
    let isStreaming = $derived(streamingQuery.data?.isStreaming === true);
    let displayMessages = $derived(messagesQuery.data ?? []);

    let totalCost = $derived.by(() => {
        let cost = 0;
        for (const msg of displayMessages) { if (msg.costUsd) cost += msg.costUsd; }
        return cost;
    });
    let totalInputTokens = $derived.by(() => {
        let t = 0;
        for (const msg of displayMessages) { if (msg.inputTokens) t += msg.inputTokens; }
        return t;
    });
    let totalOutputTokens = $derived.by(() => {
        let t = 0;
        for (const msg of displayMessages) { if (msg.outputTokens) t += msg.outputTokens; }
        return t;
    });

    $effect(() => {
        if (displayMessages.length > 0 || streamingQuery.data) {
            tick().then(() => {
                if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        }
    });

    async function handleModelChange(model: string) {
        if (!sessionId) return;
        try { await client.mutation(api.sessions.updateModel, { id: sessionId, model }); }
        catch (error) { console.error("Failed to update model:", error); }
    }

    let hasAnySearch = $derived(providers.perplexity || providers.tavily);

    function selectSearchProvider(provider: "off" | "perplexity" | "tavily") {
        searchProvider = provider;
        searchDropdownOpen = false;
    }

    let titleGenerated = $state(false);
    $effect(() => { if (sessionId) titleGenerated = false; });

    let errorMessage = $state("");

    async function handleSubmit() {
        if (!prompt.trim() || sending || !sessionId) return;
        const userMessage = prompt.trim();
        prompt = "";
        sending = true;
        errorMessage = "";
        try {
            await client.mutation(api.messages.send, { sessionId, content: userMessage, model: currentModel });
            await client.action(api.ai.chat, {
                sessionId,
                model: currentModel,
                searchPastChats,
                searchProvider: searchProvider !== "off" ? searchProvider : undefined,
            });
            if (!titleGenerated && !sessionQuery.data?.title) {
                titleGenerated = true;
                client.action(api.ai.generateTitle, { sessionId }).catch(() => {});
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "An error occurred";
            console.error("Chat error:", msg);
            errorMessage = msg;
        } finally {
            sending = false;
        }
    }
</script>

<main class="flex-1 flex flex-col relative min-w-0 min-h-0 bg-eg-bg">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-eg-border bg-eg-bg">
        <div class="flex items-center gap-3">
            <ModelSelector selected={currentModel} onSelect={handleModelChange} />
        </div>

        <div class="flex items-center gap-4">
            <div class="relative group/tip">
                <button onclick={() => (searchPastChats = !searchPastChats)} class="flex items-center gap-2 text-xs font-medium text-eg-text-secondary">
                    <History size={14} />
                    <span class="hidden sm:inline">History</span>
                    <span class="toggle-switch variant-purple {searchPastChats ? 'active' : ''}" role="switch" aria-checked={searchPastChats}></span>
                </button>
                <div class="absolute right-0 top-full mt-2 w-56 p-2.5 bg-eg-surface text-eg-text text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-50 pointer-events-none border border-eg-border">
                    <p class="font-medium mb-1">Recall Past Conversations</p>
                    <p class="text-eg-text-secondary leading-relaxed">When enabled, the AI searches your previous chats for relevant context.</p>
                </div>
            </div>

            <div class="relative group/tip">
                <button onclick={() => { if (hasAnySearch) searchDropdownOpen = !searchDropdownOpen; }} disabled={!hasAnySearch} class="flex items-center gap-2 text-xs font-medium {hasAnySearch ? 'text-eg-text-secondary' : 'text-eg-text-tertiary cursor-not-allowed'}">
                    <Globe size={14} />
                    <span class="hidden sm:inline">Web</span>
                    {#if searchProvider !== "off"}
                        <span class="px-1.5 py-0.5 bg-eg-accent/15 text-eg-accent rounded text-[10px] font-semibold uppercase">{searchProvider}</span>
                    {:else}
                        <span class="toggle-switch {!hasAnySearch ? 'disabled' : ''}" role="switch" aria-checked={false}></span>
                    {/if}
                    {#if hasAnySearch}
                        <ChevronDown size={12} class="text-eg-text-tertiary" />
                    {/if}
                </button>

                {#if searchDropdownOpen}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="fixed inset-0 z-40" onclick={() => (searchDropdownOpen = false)}></div>
                    <div class="absolute right-0 top-full mt-2 w-48 bg-eg-surface border border-eg-border rounded-lg shadow-lg z-50 py-1">
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

                {#if !hasAnySearch && !searchDropdownOpen}
                    <div class="absolute right-0 top-full mt-2 w-56 p-2.5 bg-eg-surface text-eg-text text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-50 pointer-events-none border border-eg-border">
                        <p class="font-medium mb-1">Web Search Unavailable</p>
                        <p class="text-eg-text-secondary leading-relaxed">Add PERPLEXITY_API_KEY or TAVILY_API_KEY to Convex to enable.</p>
                    </div>
                {/if}
            </div>

            <button onclick={() => (debugOpen = !debugOpen)} class="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors {debugOpen ? 'bg-eg-warning/15 text-eg-warning' : 'text-eg-text-tertiary hover:text-eg-text-secondary'}" title="Debug Panel">
                <Bug size={14} />
            </button>
        </div>
    </div>

    {#if totalCost > 0}
        <div class="flex items-center justify-between px-4 py-1.5 bg-eg-bg-secondary border-b border-eg-border-subtle">
            <TokenCostBar inputText="" model={currentModel} {totalCost} {totalInputTokens} {totalOutputTokens} />
            <span class="text-[11px] text-eg-text-tertiary">{displayMessages.filter(m => m.role === "assistant" && !m.isStreaming).length} responses</span>
        </div>
    {/if}

    <div class="flex flex-1 overflow-hidden">
        <div bind:this={messagesContainer} class="flex-1 overflow-y-auto px-4 sm:px-10 py-6">
            <div class="max-w-3xl mx-auto w-full">
                {#if messagesQuery.isLoading}
                    <div class="flex items-center justify-center py-16">
                        <div class="w-6 h-6 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
                    </div>
                {:else if displayMessages.length === 0}
                    <div class="flex flex-col items-center justify-center py-16">
                        <div class="w-12 h-12 bg-eg-bg-tertiary rounded-full flex items-center justify-center mb-4">
                            <Search size={20} class="text-eg-text-tertiary" />
                        </div>
                        <p class="text-eg-text-tertiary text-sm">Send a message to get started</p>
                    </div>
                {:else}
                    {#each displayMessages as message (message._id)}
                        <ChatMessage
                            role={message.role as "user" | "assistant" | "system"}
                            content={message.content}
                            model={message.model}
                            inputTokens={message.inputTokens}
                            outputTokens={message.outputTokens}
                            costUsd={message.costUsd}
                            isStreaming={message.isStreaming}
                            citations={message.citations}
                            searchProvider={message.searchProvider}
                        />
                    {/each}
                {/if}
            </div>
        </div>

        {#if debugOpen}
            <DebugPanel messages={displayMessages} {searchPastChats} searchEnabled={searchProvider !== "off"} model={currentModel} sessionId={sessionId} />
        {/if}
    </div>

    <!-- Input — floating near bottom, Perplexity-style -->
    <div class="px-4 sm:px-10 pb-4 pt-2">
        <div class="max-w-3xl mx-auto w-full">
            {#if errorMessage}
                <div class="mb-2 px-4 py-2 bg-eg-danger/10 border border-eg-danger/30 rounded-lg text-sm text-eg-danger flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <button onclick={() => (errorMessage = "")} class="hover:opacity-80 ml-2">&times;</button>
                </div>
            {/if}
            <ChatInput
                bind:value={prompt}
                placeholder={isStreaming ? "Waiting for response..." : "Ask anything..."}
                disabled={sending}
                {isStreaming}
                onsubmit={handleSubmit}
            />
            <div class="mt-1.5 px-1">
                <TokenCostBar inputText={prompt} model={currentModel} {totalCost} {totalInputTokens} {totalOutputTokens} />
            </div>
        </div>
    </div>
</main>
