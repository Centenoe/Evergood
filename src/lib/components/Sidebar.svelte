<script lang="ts">
    import { UserButton } from "svelte-clerk";
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { themeStore } from "$lib/stores/theme.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import Settings from "lucide-svelte/icons/settings";
    import BarChart3 from "lucide-svelte/icons/bar-chart-3";
    import Plus from "lucide-svelte/icons/plus";
    import Moon from "lucide-svelte/icons/moon";
    import Sun from "lucide-svelte/icons/sun";
    import MessageSquare from "lucide-svelte/icons/message-square";
    import Search from "lucide-svelte/icons/search";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import Bookmark from "lucide-svelte/icons/bookmark";
    import X from "lucide-svelte/icons/x";
    import Zap from "lucide-svelte/icons/zap";
    import FlaskConical from "lucide-svelte/icons/flask-conical";
    import { tempChatStore } from "$lib/stores/tempChat.svelte";
    import PanelLeftClose from "lucide-svelte/icons/panel-left-close";
    import PanelLeftOpen from "lucide-svelte/icons/panel-left-open";
    import ChevronRight from "lucide-svelte/icons/chevron-right";
    import FolderOpen from "lucide-svelte/icons/folder-open";
    import Pencil from "lucide-svelte/icons/pencil";
    import Check from "lucide-svelte/icons/check";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    interface Props {
        collapsed?: boolean;
        isMobile?: boolean;
        onCloseMobile?: () => void;
    }
    let { collapsed = false, isMobile = false, onCloseMobile }: Props = $props();

    const client = useConvexClient();
    const sessionsQuery = useQuery(api.sessions.list, () => ({}));
    const spacesQuery = useQuery(api.spaces.list, () => ({}));

    let searchQuery = $state("");
    let searchMode = $state(false);
    let hoveredSessionId = $state<string | null>(null);
    let hoveredSpaceId = $state<string | null>(null);
    let expandedSpaceIds = $state<Set<string>>(new Set());

    // Space creation/editing
    let creatingSpace = $state(false);
    let newSpaceName = $state("");
    let newSpaceIcon = $state("📁");
    let editingSpaceId = $state<string | null>(null);
    let editSpaceName = $state("");

    const searchResults = useQuery(
        api.messages.searchFullText,
        () => (searchQuery.trim() ? { query: searchQuery.trim() } : "skip"),
    );

    let currentSessionId = $derived(
        $page.url.pathname.startsWith("/chat/")
            ? $page.url.pathname.split("/chat/")[1]
            : null,
    );

    // Separate sessions: those in spaces vs general (no space)
    let generalSessions = $derived(
        sessionsQuery.data?.filter((s) => !s.spaceId && !s.bookmarked) ?? [],
    );

    let bookmarkedSessions = $derived(
        sessionsQuery.data?.filter((s) => s.bookmarked) ?? [],
    );

    // Group sessions by spaceId
    let sessionsBySpace = $derived.by(() => {
        const map = new Map<string, Array<typeof sessionsQuery.data extends (infer T)[] | undefined ? T : never>>();
        for (const session of sessionsQuery.data ?? []) {
            if (session.spaceId) {
                const existing = map.get(session.spaceId) ?? [];
                existing.push(session);
                map.set(session.spaceId, existing);
            }
        }
        return map;
    });

    function toggleSpaceExpanded(spaceId: string) {
        const next = new Set(expandedSpaceIds);
        if (next.has(spaceId)) next.delete(spaceId);
        else next.add(spaceId);
        expandedSpaceIds = next;
    }

    async function createNewThread(spaceId?: Id<"spaces">) {
        const model = spaceId
            ? (spacesQuery.data?.find((s) => s._id === spaceId)?.defaultModel ?? "gpt-4o")
            : "gpt-4o";
        const sessionId = await client.mutation(api.sessions.create, {
            model,
            spaceId,
        });
        onCloseMobile?.();
        goto(`/chat/${sessionId}`);
    }

    async function deleteSession(sessionId: string) {
        await client.mutation(api.sessions.remove, {
            id: sessionId as Id<"sessions">,
        });
        if (currentSessionId === sessionId) {
            goto("/");
        }
    }

    async function toggleBookmark(sessionId: string) {
        await client.mutation(api.sessions.toggleBookmark, {
            id: sessionId as Id<"sessions">,
        });
    }

    async function createSpace() {
        if (!newSpaceName.trim()) return;
        const spaceId = await client.mutation(api.spaces.create, {
            name: newSpaceName.trim(),
            icon: newSpaceIcon || "📁",
        });
        creatingSpace = false;
        newSpaceName = "";
        newSpaceIcon = "📁";
        // Auto-expand the new space
        expandedSpaceIds = new Set([...expandedSpaceIds, spaceId]);
    }

    async function saveSpaceName(spaceId: string) {
        if (!editSpaceName.trim()) return;
        await client.mutation(api.spaces.update, {
            id: spaceId as Id<"spaces">,
            name: editSpaceName.trim(),
        });
        editingSpaceId = null;
    }

    async function deleteSpace(spaceId: string) {
        await client.mutation(api.spaces.remove, {
            id: spaceId as Id<"spaces">,
        });
    }

    function groupByDate(
        sessions: Array<{
            _id: string;
            title: string;
            model: string;
            lastActiveAt: number;
            bookmarked?: boolean;
        }>,
    ) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const groups: Record<
            string,
            Array<{
                _id: string;
                title: string;
                model: string;
                lastActiveAt: number;
                bookmarked?: boolean;
            }>
        > = {};

        for (const session of sessions) {
            const date = new Date(session.lastActiveAt);
            let label: string;
            if (date >= today) label = "Today";
            else if (date >= yesterday) label = "Yesterday";
            else if (date >= weekAgo) label = "This Week";
            else label = "Older";
            if (!groups[label]) groups[label] = [];
            groups[label].push(session);
        }
        return groups;
    }

    function getProviderColor(modelId: string): string {
        if (
            modelId.startsWith("gpt-") ||
            modelId.startsWith("o1") ||
            modelId.startsWith("o3") ||
            modelId.startsWith("o4") ||
            modelId.startsWith("chatgpt-")
        )
            return "bg-provider-openai";
        if (modelId.startsWith("claude-")) return "bg-provider-anthropic";
        if (modelId.startsWith("sonar")) return "bg-provider-perplexity";
        return "bg-eg-text-tertiary";
    }

    let generalSessionGroups = $derived(groupByDate(generalSessions));

    function navigateTo(path: string) {
        onCloseMobile?.();
        goto(path);
    }
</script>

<aside
    class="w-full h-full bg-eg-bg-secondary border-r border-eg-border flex flex-col transition-all duration-200 overflow-hidden"
>
    <div class="flex flex-col h-full {collapsed ? 'p-2' : 'p-4'}">
        <!-- Header: Logo + collapse toggle -->
        <div class="flex items-center {collapsed ? 'justify-center mb-3' : 'justify-between mb-5'}">
            {#if collapsed}
                <button
                    onclick={() => navigateTo("/")}
                    class="w-9 h-9 bg-eg-accent rounded-md flex items-center justify-center hover:opacity-80 transition-opacity"
                    title="Evergood — Home"
                >
                    <span class="text-eg-accent-text font-bold text-sm">E</span>
                </button>
            {:else}
                <button
                    onclick={() => navigateTo("/")}
                    class="flex items-center gap-2 px-2 hover:opacity-80 transition-opacity"
                >
                    <div
                        class="w-7 h-7 bg-eg-accent rounded-md flex items-center justify-center"
                    >
                        <span class="text-eg-accent-text font-bold text-sm">E</span>
                    </div>
                    <span class="font-medium text-lg tracking-tight text-eg-text"
                        >Evergood</span
                    >
                </button>

                <div class="flex items-center gap-1">
                    {#if isMobile && onCloseMobile}
                        <button
                            onclick={() => onCloseMobile?.()}
                            class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded-md"
                            aria-label="Close sidebar"
                        >
                            <X size={18} />
                        </button>
                    {:else}
                        <button
                            onclick={() => uiStore.collapse()}
                            class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded-md transition-colors"
                            aria-label="Collapse sidebar"
                            title="Collapse sidebar (Ctrl+/)"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- New Thread + Temp Chat Buttons -->
        {#if collapsed}
            <button
                onclick={() => createNewThread()}
                class="w-9 h-9 mx-auto bg-eg-surface border border-eg-border hover:border-eg-text-tertiary rounded-lg flex items-center justify-center transition-all duration-200 mb-1.5"
                title="New Thread"
            >
                <Plus size={18} class="text-eg-text-secondary" />
            </button>
            <button
                onclick={() => { tempChatStore.start(); navigateTo('/temp'); }}
                class="w-9 h-9 mx-auto border border-eg-warning/40 hover:border-eg-warning text-eg-warning rounded-lg flex items-center justify-center transition-all duration-200 mb-3"
                title="Temp Chat (Ctrl+Shift+N)"
            >
                <Zap size={16} />
            </button>
        {:else}
            <div class="flex gap-2 mb-4">
                <button
                    onclick={() => createNewThread()}
                    class="flex items-center gap-2 flex-1 bg-eg-surface border border-eg-border hover:border-eg-text-tertiary text-eg-text px-4 py-2.5 rounded-lg shadow-sm transition-all duration-200 font-medium"
                >
                    <Plus size={18} class="text-eg-text-secondary" />
                    <span>New Thread</span>
                </button>
                <button
                    onclick={() => { tempChatStore.start(); navigateTo('/temp'); }}
                    class="flex items-center justify-center px-3 py-2.5 border border-eg-warning/40 hover:border-eg-warning text-eg-warning rounded-lg transition-all duration-200"
                    title="Temp Chat (Ctrl+Shift+N)"
                >
                    <Zap size={18} />
                </button>
            </div>
        {/if}

        <!-- Search Bar (expanded only) -->
        {#if !collapsed}
            <div class="relative mb-4">
                {#if searchMode}
                    <div class="flex items-center gap-1">
                        <div class="relative flex-1">
                            <Search
                                size={14}
                                class="absolute left-3 top-1/2 -translate-y-1/2 text-eg-text-tertiary"
                            />
                            <input
                                bind:value={searchQuery}
                                placeholder="Search messages..."
                                class="w-full pl-8 pr-3 py-2 text-sm bg-eg-surface border border-eg-border rounded-lg outline-none focus:border-eg-accent text-eg-text placeholder:text-eg-text-tertiary"
                            />
                        </div>
                        <button
                            onclick={() => {
                                searchMode = false;
                                searchQuery = "";
                            }}
                            class="p-2 text-eg-text-tertiary hover:text-eg-text rounded-md"
                        >
                            <X size={16} />
                        </button>
                    </div>
                {:else}
                    <button
                        onclick={() => (searchMode = true)}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-eg-text-secondary hover:bg-eg-bg-tertiary rounded-lg transition-colors"
                    >
                        <Search size={14} />
                        <span>Search chats...</span>
                    </button>
                {/if}
            </div>
        {:else}
            <button
                onclick={() => { uiStore.expand(); searchMode = true; }}
                class="w-9 h-9 mx-auto flex items-center justify-center text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary rounded-lg transition-colors mb-3"
                title="Search chats"
            >
                <Search size={16} />
            </button>
        {/if}

        <!-- Chat History -->
        <div class="flex-1 overflow-y-auto {collapsed ? '-mx-1 px-1' : '-mx-2 px-2'}">
            {#if !collapsed && searchMode && searchQuery.trim()}
                <!-- Search results -->
                {#if searchResults.isLoading}
                    <p class="text-xs text-eg-text-tertiary px-2 py-4">Searching...</p>
                {:else if searchResults.data && searchResults.data.length > 0}
                    <div class="text-[11px] font-semibold text-eg-text-tertiary mb-2 px-2 uppercase tracking-wider">Results</div>
                    <div class="space-y-0.5">
                        {#each searchResults.data as result}
                            <button
                                onclick={() => navigateTo(`/chat/${result.sessionId}`)}
                                class="w-full text-left px-2 py-2 text-sm text-eg-text-secondary hover:bg-eg-bg-tertiary rounded-md transition-colors"
                            >
                                <div class="font-medium truncate text-eg-text">{result.sessionTitle}</div>
                                <div class="text-xs text-eg-text-tertiary truncate mt-0.5">{result.content.slice(0, 80)}...</div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <p class="text-xs text-eg-text-tertiary px-2 py-4">No results found</p>
                {/if}
            {:else if sessionsQuery.isLoading || spacesQuery.isLoading}
                <div class="flex items-center justify-center py-8">
                    <div class="w-5 h-5 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
                </div>
            {:else}
                <!-- Bookmarked -->
                {#if bookmarkedSessions.length > 0}
                    {#if !collapsed}
                        <div class="text-[11px] font-semibold text-eg-warning mb-2 px-2 uppercase tracking-wider flex items-center gap-1.5">
                            <Bookmark size={12} />
                            Bookmarked
                        </div>
                    {/if}
                    <div class="space-y-0.5 mb-4">
                        {#each bookmarkedSessions as session}
                            {#if collapsed}
                                <button
                                    onclick={() => navigateTo(`/chat/${session._id}`)}
                                    class="w-full flex items-center justify-center py-2 rounded-md transition-colors duration-150 {currentSessionId === session._id ? 'bg-eg-bg-tertiary border-l-[3px] border-l-eg-accent' : 'hover:bg-eg-bg-tertiary'}"
                                    title={session.title}
                                >
                                    <span class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                </button>
                            {:else}
                                <div
                                    role="button"
                                    tabindex="0"
                                    onclick={() => navigateTo(`/chat/${session._id}`)}
                                    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") navigateTo(`/chat/${session._id}`); }}
                                    onmouseenter={() => (hoveredSessionId = session._id)}
                                    onmouseleave={() => (hoveredSessionId = null)}
                                    class="w-full text-left px-2 py-2 text-sm rounded-md transition-colors duration-150 flex items-center gap-2 cursor-pointer {currentSessionId === session._id ? 'bg-eg-bg-tertiary border-l-[3px] border-l-eg-accent font-medium text-eg-text' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                                >
                                    <span class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                    <span class="truncate flex-1">{session.title}</span>
                                    {#if hoveredSessionId === session._id}
                                        <button onclick={(e) => { e.stopPropagation(); toggleBookmark(session._id); }} class="flex-shrink-0 p-1 text-eg-warning hover:opacity-80 rounded transition-colors" title="Unbookmark">
                                            <Bookmark size={14} />
                                        </button>
                                        <button onclick={(e) => { e.stopPropagation(); deleteSession(session._id); }} class="flex-shrink-0 p-1 text-eg-text-tertiary hover:text-eg-danger rounded transition-colors" title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/if}

                <!-- Spaces -->
                {#if spacesQuery.data && spacesQuery.data.length > 0 && !collapsed}
                    <div class="flex items-center justify-between mb-2 px-2 mt-4">
                        <div class="text-[11px] font-semibold text-eg-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                            <FolderOpen size={12} />
                            Spaces
                        </div>
                        <button
                            onclick={() => (creatingSpace = true)}
                            class="p-0.5 text-eg-text-tertiary hover:text-eg-text rounded transition-colors"
                            title="Create Space"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {#if creatingSpace}
                        <div class="mb-3 px-2">
                            <div class="flex items-center gap-1.5 bg-eg-surface border border-eg-border rounded-lg p-1.5">
                                <input
                                    bind:value={newSpaceIcon}
                                    class="w-7 h-7 text-center bg-transparent text-sm outline-none"
                                    maxlength="2"
                                />
                                <input
                                    bind:value={newSpaceName}
                                    placeholder="Space name..."
                                    class="flex-1 text-sm bg-transparent outline-none text-eg-text placeholder:text-eg-text-tertiary"
                                    onkeydown={(e) => { if (e.key === "Enter") createSpace(); if (e.key === "Escape") creatingSpace = false; }}
                                />
                                <button onclick={createSpace} disabled={!newSpaceName.trim()} class="p-1 text-eg-success hover:opacity-80 rounded disabled:opacity-30"><Check size={14} /></button>
                                <button onclick={() => (creatingSpace = false)} class="p-1 text-eg-text-tertiary hover:text-eg-text rounded"><X size={14} /></button>
                            </div>
                        </div>
                    {/if}

                    <div class="space-y-0.5 mb-4">
                        {#each spacesQuery.data as space}
                            {@const spaceSessions = sessionsBySpace.get(space._id) ?? []}
                            {@const isExpanded = expandedSpaceIds.has(space._id)}
                            <div>
                                <!-- Space header -->
                                <div
                                    role="button"
                                    tabindex="0"
                                    onclick={() => toggleSpaceExpanded(space._id)}
                                    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSpaceExpanded(space._id); }}
                                    onmouseenter={() => (hoveredSpaceId = space._id)}
                                    onmouseleave={() => (hoveredSpaceId = null)}
                                    class="w-full text-left px-2 py-2 text-sm rounded-md transition-colors duration-150 flex items-center gap-2 cursor-pointer hover:bg-eg-bg-tertiary group"
                                >
                                    <span class="transition-transform duration-150 {isExpanded ? 'rotate-90' : ''}">
                                        <ChevronRight size={14} class="text-eg-text-tertiary" />
                                    </span>
                                    {#if editingSpaceId === space._id}
                                        <!-- svelte-ignore a11y_autofocus -->
                                        <input
                                            bind:value={editSpaceName}
                                            autofocus
                                            class="flex-1 text-sm bg-eg-surface border border-eg-border rounded px-1.5 py-0.5 outline-none text-eg-text"
                                            onclick={(e) => e.stopPropagation()}
                                            onkeydown={(e) => {
                                                e.stopPropagation();
                                                if (e.key === "Enter") saveSpaceName(space._id);
                                                if (e.key === "Escape") editingSpaceId = null;
                                            }}
                                        />
                                        <button onclick={(e) => { e.stopPropagation(); saveSpaceName(space._id); }} class="p-0.5 text-eg-success"><Check size={12} /></button>
                                    {:else}
                                        <span class="text-sm" title={space.icon}>{space.icon ?? "📁"}</span>
                                        <span class="truncate flex-1 font-medium text-eg-text">{space.name}</span>
                                        <span class="text-[10px] text-eg-text-tertiary tabular-nums">{spaceSessions.length}</span>
                                    {/if}
                                    {#if hoveredSpaceId === space._id && editingSpaceId !== space._id}
                                        <button onclick={(e) => { e.stopPropagation(); createNewThread(space._id as Id<"spaces">); }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-text rounded transition-colors" title="New chat in {space.name}">
                                            <Plus size={12} />
                                        </button>
                                        <button onclick={(e) => { e.stopPropagation(); editingSpaceId = space._id; editSpaceName = space.name; }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-text rounded transition-colors" title="Rename">
                                            <Pencil size={12} />
                                        </button>
                                        <button onclick={(e) => { e.stopPropagation(); deleteSpace(space._id); }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-danger rounded transition-colors" title="Delete space">
                                            <Trash2 size={12} />
                                        </button>
                                    {/if}
                                </div>

                                <!-- Space sessions (expanded) -->
                                {#if isExpanded}
                                    <div class="ml-4 space-y-0.5 mt-0.5">
                                        {#if spaceSessions.length === 0}
                                            <p class="text-[11px] text-eg-text-tertiary px-2 py-1.5 italic">No conversations yet</p>
                                        {:else}
                                            {#each spaceSessions as session}
                                                <div
                                                    role="button"
                                                    tabindex="0"
                                                    onclick={() => navigateTo(`/chat/${session._id}`)}
                                                    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") navigateTo(`/chat/${session._id}`); }}
                                                    onmouseenter={() => (hoveredSessionId = session._id)}
                                                    onmouseleave={() => (hoveredSessionId = null)}
                                                    class="w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors duration-150 flex items-center gap-2 cursor-pointer {currentSessionId === session._id ? 'bg-eg-bg-tertiary border-l-[3px] border-l-eg-accent font-medium text-eg-text' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                                                >
                                                    <span class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                                    <span class="truncate flex-1 text-[13px]">{session.title}</span>
                                                    {#if hoveredSessionId === session._id}
                                                        <button onclick={(e) => { e.stopPropagation(); toggleBookmark(session._id); }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-warning rounded transition-colors" title="Bookmark">
                                                            <Bookmark size={12} />
                                                        </button>
                                                        <button onclick={(e) => { e.stopPropagation(); deleteSession(session._id); }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-danger rounded transition-colors" title="Delete">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    {/if}
                                                </div>
                                            {/each}
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else if !collapsed}
                    <!-- No spaces yet — show create button -->
                    {#if !creatingSpace}
                        <div class="flex items-center justify-between mb-2 px-2 mt-4">
                            <div class="text-[11px] font-semibold text-eg-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                                <FolderOpen size={12} />
                                Spaces
                            </div>
                            <button
                                onclick={() => (creatingSpace = true)}
                                class="p-0.5 text-eg-text-tertiary hover:text-eg-text rounded transition-colors"
                                title="Create Space"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    {/if}

                    {#if creatingSpace}
                        <div class="mb-3 px-2 mt-4">
                            <div class="flex items-center gap-1.5 bg-eg-surface border border-eg-border rounded-lg p-1.5">
                                <input
                                    bind:value={newSpaceIcon}
                                    class="w-7 h-7 text-center bg-transparent text-sm outline-none"
                                    maxlength="2"
                                />
                                <input
                                    bind:value={newSpaceName}
                                    placeholder="Space name..."
                                    class="flex-1 text-sm bg-transparent outline-none text-eg-text placeholder:text-eg-text-tertiary"
                                    onkeydown={(e) => { if (e.key === "Enter") createSpace(); if (e.key === "Escape") creatingSpace = false; }}
                                />
                                <button onclick={createSpace} disabled={!newSpaceName.trim()} class="p-1 text-eg-success hover:opacity-80 rounded disabled:opacity-30"><Check size={14} /></button>
                                <button onclick={() => (creatingSpace = false)} class="p-1 text-eg-text-tertiary hover:text-eg-text rounded"><X size={14} /></button>
                            </div>
                        </div>
                    {/if}
                {/if}

                <!-- General (unassigned) sessions — date-grouped -->
                {#if generalSessions.length > 0 || (sessionsQuery.data && sessionsQuery.data.length === 0)}
                    {#if !collapsed && (spacesQuery.data?.length ?? 0) > 0}
                        <div class="text-[11px] font-semibold text-eg-text-tertiary mb-2 px-2 uppercase tracking-wider mt-4 flex items-center gap-1.5">
                            <MessageSquare size={12} />
                            General
                        </div>
                    {/if}

                    {#each Object.entries(generalSessionGroups) as [label, sessions]}
                        {#if !collapsed}
                            <div class="text-[11px] font-semibold text-eg-text-tertiary mb-2 px-2 uppercase tracking-wider mt-3 first:mt-0">{label}</div>
                        {/if}
                        <div class="space-y-0.5">
                            {#each sessions as session}
                                {#if collapsed}
                                    <button
                                        onclick={() => navigateTo(`/chat/${session._id}`)}
                                        class="w-full px-1 py-1.5 rounded-md transition-colors duration-150 {currentSessionId === session._id ? 'bg-eg-bg-tertiary border-l-[3px] border-l-eg-accent' : 'hover:bg-eg-bg-tertiary'}"
                                        title={session.title}
                                    >
                                        <div class="flex items-center gap-1.5 overflow-hidden">
                                            <span class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                            <span class="text-[11px] text-eg-text-secondary truncate">{session.title}</span>
                                        </div>
                                    </button>
                                {:else}
                                    <div
                                        role="button"
                                        tabindex="0"
                                        onclick={() => navigateTo(`/chat/${session._id}`)}
                                        onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") navigateTo(`/chat/${session._id}`); }}
                                        onmouseenter={() => (hoveredSessionId = session._id)}
                                        onmouseleave={() => (hoveredSessionId = null)}
                                        class="w-full text-left px-2 py-2 text-sm rounded-md transition-colors duration-150 flex items-center gap-2 cursor-pointer {currentSessionId === session._id ? 'bg-eg-bg-tertiary border-l-[3px] border-l-eg-accent font-medium text-eg-text' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                                    >
                                        <span class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                        <span class="truncate flex-1">{session.title}</span>
                                        {#if hoveredSessionId === session._id}
                                            <button onclick={(e) => { e.stopPropagation(); toggleBookmark(session._id); }} class="flex-shrink-0 p-1 text-eg-text-tertiary hover:text-eg-warning rounded transition-colors" title="Bookmark">
                                                <Bookmark size={14} />
                                            </button>
                                            <button onclick={(e) => { e.stopPropagation(); deleteSession(session._id); }} class="flex-shrink-0 p-1 text-eg-text-tertiary hover:text-eg-danger rounded transition-colors" title="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        {/if}
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/each}

                    {#if sessionsQuery.data && sessionsQuery.data.length === 0}
                        {#if !collapsed}
                            <div class="text-center py-8 px-4">
                                <MessageSquare size={24} class="mx-auto text-eg-text-tertiary mb-2" />
                                <p class="text-xs text-eg-text-tertiary">No conversations yet</p>
                            </div>
                        {/if}
                    {/if}
                {/if}
            {/if}
        </div>

        <!-- Bottom nav -->
        <div class="mt-auto pt-3 border-t border-eg-border {collapsed ? 'space-y-1' : 'space-y-1'}">
            {#if collapsed}
                <!-- Collapsed: expand button -->
                <button
                    onclick={() => uiStore.expand()}
                    class="w-9 h-9 mx-auto flex items-center justify-center text-eg-text-tertiary hover:text-eg-text hover:bg-eg-bg-tertiary rounded-md transition-colors"
                    title="Expand sidebar (Ctrl+/)"
                >
                    <PanelLeftOpen size={18} />
                </button>

                <!-- Collapsed: Chat -->
                <button
                    onclick={() => navigateTo("/")}
                    class="w-9 h-9 mx-auto flex items-center justify-center rounded-md transition-colors {$page.url.pathname === '/' ? 'bg-eg-bg-tertiary text-eg-text' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                    title="Chat"
                >
                    <MessageSquare size={16} />
                </button>

                <!-- Collapsed: Dashboard -->
                <button
                    onclick={() => navigateTo("/dashboard")}
                    class="w-9 h-9 mx-auto flex items-center justify-center rounded-md transition-colors {$page.url.pathname === '/dashboard' ? 'bg-eg-bg-tertiary text-eg-text' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                    title="Dashboard"
                >
                    <BarChart3 size={16} />
                </button>

                <!-- Collapsed: Research -->
                <button
                    onclick={() => navigateTo("/research")}
                    class="w-9 h-9 mx-auto flex items-center justify-center rounded-md transition-colors {$page.url.pathname === '/research' ? 'bg-eg-bg-tertiary text-eg-text' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                    title="Research"
                >
                    <FlaskConical size={16} />
                </button>

                <!-- Collapsed: Settings -->
                <button
                    onclick={() => navigateTo("/settings")}
                    class="w-9 h-9 mx-auto flex items-center justify-center rounded-md transition-colors {$page.url.pathname === '/settings' ? 'bg-eg-bg-tertiary text-eg-text' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                    title="Settings"
                >
                    <Settings size={16} />
                </button>

                <!-- Collapsed: Theme toggle -->
                <button
                    onclick={() => themeStore.toggle()}
                    class="w-9 h-9 mx-auto flex items-center justify-center text-eg-text-secondary hover:bg-eg-bg-tertiary rounded-md transition-colors"
                    title="Toggle theme ({themeStore.name})"
                >
                    {#if themeStore.isDark}
                        <Sun size={16} />
                    {:else}
                        <Moon size={16} />
                    {/if}
                </button>

                <!-- Collapsed: User button -->
                <div class="flex justify-center py-1 overflow-hidden h-10">
                    <UserButton afterSignOutUrl="/sign-in" />
                </div>
            {:else}
                <!-- Expanded bottom nav -->
                <button
                    onclick={() => navigateTo("/")}
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {$page.url.pathname === '/' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                >
                    <MessageSquare size={16} />
                    <span>Chat</span>
                </button>

                <button
                    onclick={() => navigateTo("/dashboard")}
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {$page.url.pathname === '/dashboard' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                >
                    <BarChart3 size={16} />
                    <span>Dashboard</span>
                </button>

                <button
                    onclick={() => navigateTo("/research")}
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {$page.url.pathname === '/research' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                >
                    <FlaskConical size={16} />
                    <span>Research</span>
                </button>

                <button
                    onclick={() => navigateTo("/settings")}
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {$page.url.pathname === '/settings' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                >
                    <Settings size={16} />
                    <span>Settings</span>
                </button>

                <button
                    onclick={() => themeStore.toggle()}
                    class="w-full flex items-center justify-between px-3 py-2 text-sm text-eg-text-secondary hover:bg-eg-bg-tertiary rounded-md transition-colors"
                >
                    <span class="flex items-center gap-2.5">
                        {#if themeStore.isDark}
                            <Sun size={16} />
                        {:else}
                            <Moon size={16} />
                        {/if}
                        Theme
                    </span>
                    <span class="text-xs text-eg-text-tertiary capitalize">{themeStore.name}</span>
                </button>

                <div class="flex items-center gap-3 px-3 py-2.5 mt-1 overflow-hidden h-12">
                    <UserButton afterSignOutUrl="/sign-in" />
                    <span class="text-sm font-medium text-eg-text truncate flex-1">My Account</span>
                </div>
            {/if}
        </div>
    </div>
</aside>
