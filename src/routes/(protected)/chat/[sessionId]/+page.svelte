<script lang="ts">
    import { page } from "$app/stores";
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { goto } from "$app/navigation";
    import ChatMessage from "$lib/components/ChatMessage.svelte";
    import DebugPanel from "$lib/components/DebugPanel.svelte";
    import ChatInput from "$lib/components/ChatInput.svelte";
    import ChatInputActions from "$lib/components/ChatInputActions.svelte";
    import TokenCostBar from "$lib/components/TokenCostBar.svelte";
    import Search from "lucide-svelte/icons/search";
    import ChevronRight from "lucide-svelte/icons/chevron-right";

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

    // Space query for breadcrumbs
    let spaceId = $derived(sessionQuery.data?.spaceId as Id<"spaces"> | undefined);
    const spaceQuery = useQuery(
        api.spaces.get,
        () => (spaceId ? { id: spaceId } : "skip"),
    );

    let prompt = $state("");
    let sending = $state(false);
    let debugOpen = $state(false);
    let messagesContainer: HTMLDivElement | undefined = $state(undefined);
    let enableThinking = $state(false);
    let modelSupportsThinking = $state(false);

    // Reset thinking toggle when model doesn't support it
    $effect(() => {
        if (!modelSupportsThinking) enableThinking = false;
    });

    let currentModel = $derived(sessionQuery.data?.model ?? "gpt-5-nano");
    let searchProvider = $derived(
        (sessionQuery.data?.searchProvider as "off" | "perplexity" | "tavily" | undefined) ?? "off",
    );
    let searchPastChats = $derived(sessionQuery.data?.searchPastChats ?? false);
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

    async function selectSearchProvider(provider: "off" | "perplexity" | "tavily") {
        if (!sessionId) return;
        try {
            await client.mutation(api.sessions.updatePreferences, {
                id: sessionId,
                searchProvider: provider,
            });
        } catch (error) {
            console.error("Failed to update search provider:", error);
        }
    }

    async function toggleSearchPastChats() {
        if (!sessionId) return;
        try {
            await client.mutation(api.sessions.updatePreferences, {
                id: sessionId,
                searchPastChats: !searchPastChats,
            });
        } catch (error) {
            console.error("Failed to update history setting:", error);
        }
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
                enableThinking: enableThinking || undefined,
            });
            if (!titleGenerated && (!sessionQuery.data?.title || sessionQuery.data.title === "New Chat")) {
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
    {#if totalCost > 0}
        <div class="flex items-center justify-between px-4 py-1.5 bg-eg-bg-secondary border-b border-eg-border-subtle">
            <TokenCostBar inputText="" model={currentModel} {totalCost} {totalInputTokens} {totalOutputTokens} />
            <span class="text-[11px] text-eg-text-tertiary">{displayMessages.filter(m => m.role === "assistant" && !m.isStreaming).length} responses</span>
        </div>
    {/if}

    {#if spaceQuery.data}
        <nav class="flex items-center gap-1.5 px-4 sm:px-10 py-2 border-b border-eg-border-subtle bg-eg-bg-secondary text-sm">
            <button onclick={() => goto('/spaces')} class="text-eg-text-tertiary hover:text-eg-text transition-colors">Spaces</button>
            <ChevronRight size={14} class="text-eg-text-tertiary" />
            <button onclick={() => goto(`/spaces/${spaceQuery.data?._id}`)} class="flex items-center gap-1.5 text-eg-text-tertiary hover:text-eg-text transition-colors">
                <span>{spaceQuery.data?.icon ?? '📁'}</span>
                <span>{spaceQuery.data?.name}</span>
            </button>
            <ChevronRight size={14} class="text-eg-text-tertiary" />
            <span class="text-eg-text font-medium truncate">{sessionQuery.data?.title ?? 'Chat'}</span>
        </nav>
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
            >
                {#snippet actions()}
                    <ChatInputActions
                        model={currentModel}
                        onModelChange={handleModelChange}
                        bind:modelSupportsThinking
                        bind:enableThinking
                        {searchProvider}
                        onSearchProviderChange={selectSearchProvider}
                        {searchPastChats}
                        onSearchPastChatsToggle={toggleSearchPastChats}
                        bind:debugOpen
                        showDebug={true}
                        {providers}
                    />
                {/snippet}
            </ChatInput>
            <div class="mt-1.5 px-1">
                <TokenCostBar inputText={prompt} model={currentModel} {totalCost} {totalInputTokens} {totalOutputTokens} />
            </div>
        </div>
    </div>
</main>
