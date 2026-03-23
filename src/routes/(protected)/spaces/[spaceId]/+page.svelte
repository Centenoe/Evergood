<script lang="ts">
    import { page } from "$app/stores";
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { goto } from "$app/navigation";
    import ChatInput from "$lib/components/ChatInput.svelte";
    import ChatInputActions from "$lib/components/ChatInputActions.svelte";
    import SpaceSettingsModal from "$lib/components/SpaceSettingsModal.svelte";
    import ChevronRight from "lucide-svelte/icons/chevron-right";
    import Settings from "lucide-svelte/icons/settings";
    import MessageSquare from "lucide-svelte/icons/message-square";
    import Pencil from "lucide-svelte/icons/pencil";
    import Check from "lucide-svelte/icons/check";
    import X from "lucide-svelte/icons/x";

    const client = useConvexClient();

    let spaceId = $derived($page.params.spaceId as Id<"spaces">);

    const spaceQuery = useQuery(
        api.spaces.get,
        () => (spaceId ? { id: spaceId } : "skip"),
    );
    const userPreferencesQuery = useQuery(api.userPreferences.get, () => ({}));
    const sessionsQuery = useQuery(
        api.sessions.list,
        () => (spaceId ? { spaceId } : "skip"),
    );

    let prompt = $state("");
    let submitting = $state(false);
    let settingsOpen = $state(false);
    let enableThinking = $state(false);
    let modelSupportsThinking = $state(false);
    let searchProvider = $state<"off" | "perplexity" | "tavily">("off");
    let searchPastChats = $state(false);
    let providers = $state<{ perplexity: boolean; tavily: boolean }>({ perplexity: false, tavily: false });

    import { onMount } from "svelte";
    onMount(async () => {
        try {
            const p = await client.action(api.providers.getAvailable, {});
            providers = { perplexity: p.perplexity, tavily: p.tavily };
        } catch {
            // Silently fail
        }
    });

    // Reset thinking toggle when model doesn't support it
    $effect(() => {
        if (!modelSupportsThinking) enableThinking = false;
    });

    // Inline editing
    let editingTitle = $state(false);
    let editTitleValue = $state("");
    let editingDesc = $state(false);
    let editDescValue = $state("");

    let selectedModel = $derived(spaceQuery.data?.defaultModel ?? userPreferencesQuery.data?.defaultModel ?? "gpt-5-nano");
    let defaultSearchProvider = $derived.by(() => {
        const spaceDefault = spaceQuery.data?.webSearchDefault;
        if (spaceDefault === "perplexity" || spaceDefault === "tavily") {
            return spaceDefault;
        }
        return userPreferencesQuery.data?.defaultSearchProvider ?? "off";
    });
    let defaultSearchPastChats = $derived(userPreferencesQuery.data?.defaultSearchPastChats ?? false);

    // Sync search defaults into local state
    $effect(() => {
        searchProvider = (defaultSearchProvider as "off" | "perplexity" | "tavily") ?? "off";
    });
    $effect(() => {
        searchPastChats = defaultSearchPastChats;
    });

    function getProviderColor(modelId: string): string {
        if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4") || modelId.startsWith("chatgpt-"))
            return "bg-provider-openai";
        if (modelId.startsWith("claude-")) return "bg-provider-anthropic";
        if (modelId.startsWith("sonar")) return "bg-provider-perplexity";
        return "bg-eg-text-tertiary";
    }

    function formatRelativeTime(timestamp: number): string {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60_000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    async function handleSubmit() {
        if (!prompt.trim() || submitting || !spaceId) return;
        const userMessage = prompt.trim();
        prompt = "";
        submitting = true;

        try {
            const sessionId = await client.mutation(api.sessions.create, {
                model: selectedModel,
                spaceId,
                searchProvider,
                searchPastChats,
            });
            await client.mutation(api.messages.send, {
                sessionId,
                content: userMessage,
                model: selectedModel,
            });
            goto(`/chat/${sessionId}`);
            client.action(api.ai.chat, {
                sessionId,
                model: selectedModel,
                searchPastChats,
                searchProvider: searchProvider !== "off" ? searchProvider : undefined,
                enableThinking: enableThinking || undefined,
            });
            client.action(api.ai.generateTitle, { sessionId });
        } catch (error) {
            console.error("Failed to create chat:", error);
            submitting = false;
        }
    }

    async function saveTitle() {
        if (!editTitleValue.trim() || !spaceId) return;
        await client.mutation(api.spaces.update, {
            id: spaceId,
            name: editTitleValue.trim(),
        });
        editingTitle = false;
    }

    async function saveDescription() {
        if (!spaceId) return;
        await client.mutation(api.spaces.update, {
            id: spaceId,
            description: editDescValue.trim(),
        });
        editingDesc = false;
    }

    function startEditTitle() {
        editTitleValue = spaceQuery.data?.name ?? "";
        editingTitle = true;
    }

    function startEditDesc() {
        editDescValue = spaceQuery.data?.description ?? "";
        editingDesc = true;
    }
</script>

<main class="flex-1 min-h-0 overflow-y-auto bg-eg-bg">
    {#if spaceQuery.isLoading}
        <div class="flex items-center justify-center py-20">
            <div class="w-6 h-6 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
        </div>
    {:else if !spaceQuery.data}
        <div class="flex flex-col items-center justify-center py-20">
            <p class="text-eg-text-secondary">Space not found.</p>
            <button onclick={() => goto("/spaces")} class="mt-4 text-sm text-eg-accent hover:underline">Back to Spaces</button>
        </div>
    {:else}
        {@const space = spaceQuery.data}
        <div class="max-w-3xl mx-auto px-4 sm:px-8 py-8">
            <!-- Breadcrumb -->
            <nav class="flex items-center gap-1.5 text-sm text-eg-text-tertiary mb-6">
                <button onclick={() => goto("/spaces")} class="hover:text-eg-text transition-colors">Spaces</button>
                <ChevronRight size={14} />
                <span class="text-eg-text font-medium truncate">{space.name}</span>
            </nav>

            <!-- Space Header -->
            <div class="mb-8">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 bg-eg-bg-tertiary rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {space.icon ?? "📁"}
                    </div>
                    <div class="flex-1 min-w-0">
                        <!-- Editable Title -->
                        {#if editingTitle}
                            <div class="flex items-center gap-2 mb-1">
                                <!-- svelte-ignore a11y_autofocus -->
                                <input
                                    bind:value={editTitleValue}
                                    autofocus
                                    class="text-2xl font-semibold text-eg-text bg-eg-bg-tertiary rounded-lg px-2 py-1 outline-none flex-1"
                                    onkeydown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") editingTitle = false; }}
                                />
                                <button onclick={saveTitle} class="p-1.5 text-eg-success hover:opacity-80 rounded-lg"><Check size={16} /></button>
                                <button onclick={() => (editingTitle = false)} class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded-lg"><X size={16} /></button>
                            </div>
                        {:else}
                            <div class="flex items-center gap-2 group">
                                <h1 class="text-2xl font-semibold text-eg-text tracking-tight">{space.name}</h1>
                                <button
                                    onclick={startEditTitle}
                                    class="p-1 text-eg-text-tertiary hover:text-eg-text rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Edit title"
                                >
                                    <Pencil size={14} />
                                </button>
                            </div>
                        {/if}

                        <!-- Editable Description -->
                        {#if editingDesc}
                            <div class="flex items-start gap-2 mt-2">
                                <textarea
                                    bind:value={editDescValue}
                                    rows={2}
                                    class="flex-1 text-sm text-eg-text-secondary bg-eg-bg-tertiary rounded-lg px-3 py-2 outline-none resize-none"
                                    onkeydown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveDescription(); if (e.key === "Escape") editingDesc = false; }}
                                ></textarea>
                                <div class="flex flex-col gap-1">
                                    <button onclick={saveDescription} class="p-1.5 text-eg-success hover:opacity-80 rounded-lg"><Check size={14} /></button>
                                    <button onclick={() => (editingDesc = false)} class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded-lg"><X size={14} /></button>
                                </div>
                            </div>
                        {:else}
                            <div class="flex items-center gap-2 group mt-1">
                                {#if space.description}
                                    <p class="text-sm text-eg-text-secondary">{space.description}</p>
                                {:else}
                                    <p class="text-sm text-eg-text-tertiary italic">Add a description...</p>
                                {/if}
                                <button
                                    onclick={startEditDesc}
                                    class="p-1 text-eg-text-tertiary hover:text-eg-text rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                    title="Edit description"
                                >
                                    <Pencil size={12} />
                                </button>
                            </div>
                        {/if}
                    </div>

                    <!-- Settings button -->
                    <button
                        onclick={() => (settingsOpen = true)}
                        class="p-2 text-eg-text-tertiary hover:text-eg-text hover:bg-eg-bg-tertiary rounded-lg transition-colors flex-shrink-0"
                        title="Space settings"
                    >
                        <Settings size={18} />
                    </button>
                </div>

                <!-- Tags / metadata -->
                <div class="flex items-center gap-2 mt-4 flex-wrap">
                    {#if space.defaultModel}
                        <span class="text-[11px] px-2 py-0.5 bg-eg-bg-tertiary border border-eg-border-subtle rounded-full text-eg-text-secondary">
                            Model: {space.defaultModel}
                        </span>
                    {/if}
                    {#if space.webSearchDefault}
                        <span class="text-[11px] px-2 py-0.5 bg-eg-bg-tertiary border border-eg-border-subtle rounded-full text-eg-text-secondary">
                            Web: {space.webSearchDefault}
                        </span>
                    {/if}
                    {#if space.systemPrompt}
                        <span class="text-[11px] px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400">
                            Custom Instructions
                        </span>
                    {/if}
                </div>
            </div>

            <!-- Chat Input -->
            <div class="mb-10">
                <ChatInput
                    bind:value={prompt}
                    placeholder="Ask anything in {space.name}..."
                    disabled={submitting}
                    onsubmit={handleSubmit}
                >
                    {#snippet actions()}
                        <ChatInputActions
                            model={selectedModel}
                            onModelChange={(m) => {
                                client.mutation(api.spaces.update, { id: spaceId, defaultModel: m });
                            }}
                            bind:modelSupportsThinking
                            bind:enableThinking
                            {searchProvider}
                            onSearchProviderChange={(p) => (searchProvider = p)}
                            {searchPastChats}
                            onSearchPastChatsToggle={() => (searchPastChats = !searchPastChats)}
                            {providers}
                        />
                    {/snippet}
                </ChatInput>
            </div>

            <!-- My Threads -->
            <div>
                <div class="flex items-center gap-2 mb-4">
                    <MessageSquare size={16} class="text-eg-text-tertiary" />
                    <h2 class="text-sm font-semibold text-eg-text uppercase tracking-wider">My Threads</h2>
                    {#if sessionsQuery.data}
                        <span class="text-xs text-eg-text-tertiary">({sessionsQuery.data.length})</span>
                    {/if}
                </div>

                {#if sessionsQuery.isLoading}
                    <div class="space-y-2">
                        {#each Array(3) as _}
                            <div class="bg-eg-surface border border-eg-border rounded-lg p-4 animate-pulse">
                                <div class="h-4 bg-eg-bg-tertiary rounded w-48 mb-2"></div>
                                <div class="h-3 bg-eg-bg-tertiary rounded w-24"></div>
                            </div>
                        {/each}
                    </div>
                {:else if sessionsQuery.data && sessionsQuery.data.length > 0}
                    <div class="space-y-2">
                        {#each sessionsQuery.data as session}
                            <button
                                onclick={() => goto(`/chat/${session._id}`)}
                                class="w-full text-left bg-eg-surface border border-eg-border rounded-lg p-4 hover:border-eg-text-tertiary transition-all group"
                            >
                                <div class="flex items-center gap-3">
                                    <span class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                    <span class="font-medium text-sm text-eg-text truncate flex-1 group-hover:text-eg-accent transition-colors">
                                        {session.title}
                                    </span>
                                    <span class="text-[11px] text-eg-text-tertiary flex-shrink-0">
                                        {formatRelativeTime(session.lastActiveAt)}
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 mt-1.5 ml-5">
                                    <span class="text-[10px] text-eg-text-tertiary">{session.model}</span>
                                    <span class="text-[10px] text-eg-text-tertiary">&middot;</span>
                                    <span class="text-[10px] text-eg-text-tertiary">{session.messageCount} messages</span>
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="text-center py-12 bg-eg-surface border border-eg-border rounded-xl">
                        <MessageSquare size={24} class="mx-auto text-eg-text-tertiary mb-2 opacity-50" />
                        <p class="text-sm text-eg-text-tertiary">No conversations yet in this space.</p>
                        <p class="text-xs text-eg-text-tertiary mt-1">Use the chat input above to start one.</p>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Settings Modal -->
        <SpaceSettingsModal {spaceId} bind:open={settingsOpen} space={space} />
    {/if}
</main>
