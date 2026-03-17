<script lang="ts">
    import { UserButton } from "svelte-clerk";
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { uiStore } from "$lib/stores/ui.svelte";
    import Settings from "lucide-svelte/icons/settings";
    import Plus from "lucide-svelte/icons/plus";
    import MessageSquare from "lucide-svelte/icons/message-square";
    import Search from "lucide-svelte/icons/search";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import Bookmark from "lucide-svelte/icons/bookmark";
    import X from "lucide-svelte/icons/x";
    import FlaskConical from "lucide-svelte/icons/flask-conical";
    import { tempChatStore } from "$lib/stores/tempChat.svelte";
    import ChevronRight from "lucide-svelte/icons/chevron-right";
    import FolderOpen from "lucide-svelte/icons/folder-open";
    import Pencil from "lucide-svelte/icons/pencil";
    import Check from "lucide-svelte/icons/check";
    import Home from "lucide-svelte/icons/home";
    import Clock from "lucide-svelte/icons/clock";
    import LayoutGrid from "lucide-svelte/icons/layout-grid";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    interface Props {
        isMobile?: boolean;
        onCloseMobile?: () => void;
    }
    let { isMobile = false, onCloseMobile }: Props = $props();

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
    class="w-full h-full bg-eg-bg-secondary flex flex-col overflow-hidden"
>
    <div class="flex flex-col h-full px-3 py-4">
        <!-- Header: Logo + close on mobile -->
        <div class="flex items-center justify-between mb-5 px-2">
            <button
                onclick={() => navigateTo("/")}
                class="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
                <div class="w-7 h-7 bg-eg-accent rounded-md flex items-center justify-center">
                    <span class="text-eg-accent-text font-bold text-sm">E</span>
                </div>
                <span class="font-semibold text-lg tracking-tight text-eg-text">Evergood</span>
            </button>

            {#if isMobile && onCloseMobile}
                <button
                    onclick={() => onCloseMobile?.()}
                    class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded-md transition-colors"
                    aria-label="Close sidebar"
                >
                    <X size={18} />
                </button>
            {/if}
        </div>

        <!-- New Thread button -->
        <button
            onclick={() => createNewThread()}
            class="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-medium text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary rounded-lg transition-colors mb-1"
        >
            <Plus size={18} />
            <span>New Thread</span>
        </button>

        <!-- Primary navigation -->
        <nav class="flex flex-col gap-0.5 mb-4">
            <button
                onclick={() => navigateTo("/")}
                class="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors
                    {$page.url.pathname === '/' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
            >
                <Home size={16} />
                <span>Home</span>
            </button>

            <button
                onclick={() => navigateTo("/research")}
                class="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors
                    {$page.url.pathname === '/research' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
            >
                <FlaskConical size={16} />
                <span>Research</span>
            </button>

            <button
                onclick={() => navigateTo("/dashboard")}
                class="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors
                    {$page.url.pathname === '/dashboard' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
            >
                <LayoutGrid size={16} />
                <span>Dashboard</span>
            </button>
        </nav>

        <!-- Search -->
        <div class="mb-3 px-1">
            {#if searchMode}
                <div class="flex items-center gap-1">
                    <div class="relative flex-1">
                        <Search
                            size={14}
                            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-eg-text-tertiary"
                        />
                        <input
                            bind:value={searchQuery}
                            placeholder="Search messages..."
                            class="w-full pl-8 pr-3 py-2 text-sm bg-eg-bg-tertiary rounded-lg outline-none focus:ring-1 focus:ring-eg-text-tertiary text-eg-text placeholder:text-eg-text-tertiary"
                        />
                    </div>
                    <button
                        onclick={() => {
                            searchMode = false;
                            searchQuery = "";
                        }}
                        class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded-md transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            {:else}
                <button
                    onclick={() => (searchMode = true)}
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary rounded-lg transition-colors"
                >
                    <Search size={14} />
                    <span>Search chats...</span>
                </button>
            {/if}
        </div>

        <!-- Chat History: scrollable area -->
        <div class="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
            {#if searchMode && searchQuery.trim()}
                <!-- Search results -->
                {#if searchResults.isLoading}
                    <p class="text-xs text-eg-text-tertiary px-2 py-4">Searching...</p>
                {:else if searchResults.data && searchResults.data.length > 0}
                    <div class="text-[11px] font-semibold text-eg-text-tertiary mb-1.5 px-2 uppercase tracking-wider">Results</div>
                    {#each searchResults.data as result}
                        <button
                            onclick={() => navigateTo(`/chat/${result.sessionId}`)}
                            class="w-full text-left px-2.5 py-2 text-sm text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary rounded-lg transition-colors"
                        >
                            <div class="font-medium truncate text-eg-text">{result.sessionTitle}</div>
                            <div class="text-xs text-eg-text-tertiary truncate mt-0.5">{result.content.slice(0, 80)}...</div>
                        </button>
                    {/each}
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
                    <div class="text-[11px] font-semibold text-eg-text-tertiary mb-1 px-2 uppercase tracking-wider flex items-center gap-1.5">
                        <Bookmark size={11} />
                        Bookmarks
                    </div>
                    <div class="space-y-px mb-3">
                        {#each bookmarkedSessions as session}
                            <div
                                role="button"
                                tabindex="0"
                                onclick={() => navigateTo(`/chat/${session._id}`)}
                                onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") navigateTo(`/chat/${session._id}`); }}
                                onmouseenter={() => (hoveredSessionId = session._id)}
                                onmouseleave={() => (hoveredSessionId = null)}
                                class="w-full text-left px-2.5 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer
                                    {currentSessionId === session._id ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
                            >
                                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                <span class="truncate flex-1">{session.title}</span>
                                {#if hoveredSessionId === session._id}
                                    <button onclick={(e) => { e.stopPropagation(); toggleBookmark(session._id); }} class="flex-shrink-0 p-0.5 text-eg-warning hover:opacity-80 rounded transition-colors" title="Unbookmark">
                                        <Bookmark size={13} />
                                    </button>
                                    <button onclick={(e) => { e.stopPropagation(); deleteSession(session._id); }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-danger rounded transition-colors" title="Delete">
                                        <Trash2 size={13} />
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Spaces -->
                {#if spacesQuery.data && spacesQuery.data.length > 0}
                    <div class="flex items-center justify-between mb-1 px-2 mt-3">
                        <div class="text-[11px] font-semibold text-eg-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                            <FolderOpen size={11} />
                            Spaces
                        </div>
                        <button
                            onclick={() => (creatingSpace = true)}
                            class="p-0.5 text-eg-text-tertiary hover:text-eg-text rounded transition-colors"
                            title="Create Space"
                        >
                            <Plus size={13} />
                        </button>
                    </div>

                    {#if creatingSpace}
                        <div class="mb-2 px-2">
                            <div class="flex items-center gap-1.5 bg-eg-bg-tertiary rounded-lg p-1.5">
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

                    <div class="space-y-px mb-3">
                        {#each spacesQuery.data as space}
                            {@const spaceSessions = sessionsBySpace.get(space._id) ?? []}
                            {@const isExpanded = expandedSpaceIds.has(space._id)}
                            <div>
                                <div
                                    role="button"
                                    tabindex="0"
                                    onclick={() => toggleSpaceExpanded(space._id)}
                                    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSpaceExpanded(space._id); }}
                                    onmouseenter={() => (hoveredSpaceId = space._id)}
                                    onmouseleave={() => (hoveredSpaceId = null)}
                                    class="w-full text-left px-2.5 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer hover:bg-eg-bg-tertiary group"
                                >
                                    <span class="transition-transform duration-150 {isExpanded ? 'rotate-90' : ''}">
                                        <ChevronRight size={13} class="text-eg-text-tertiary" />
                                    </span>
                                    {#if editingSpaceId === space._id}
                                        <!-- svelte-ignore a11y_autofocus -->
                                        <input
                                            bind:value={editSpaceName}
                                            autofocus
                                            class="flex-1 text-sm bg-eg-bg-tertiary rounded px-1.5 py-0.5 outline-none text-eg-text"
                                            onclick={(e) => e.stopPropagation()}
                                            onkeydown={(e) => {
                                                e.stopPropagation();
                                                if (e.key === "Enter") saveSpaceName(space._id);
                                                if (e.key === "Escape") editingSpaceId = null;
                                            }}
                                        />
                                        <button onclick={(e) => { e.stopPropagation(); saveSpaceName(space._id); }} class="p-0.5 text-eg-success"><Check size={12} /></button>
                                    {:else}
                                        <span class="text-sm">{space.icon ?? "📁"}</span>
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

                                {#if isExpanded}
                                    <div class="ml-5 space-y-px mt-0.5">
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
                                                    class="w-full text-left px-2.5 py-1.5 text-[13px] rounded-lg transition-colors flex items-center gap-2 cursor-pointer
                                                        {currentSessionId === session._id ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
                                                >
                                                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                                    <span class="truncate flex-1">{session.title}</span>
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
                {:else}
                    <!-- No spaces yet -->
                    {#if !creatingSpace}
                        <div class="flex items-center justify-between mb-1 px-2 mt-3">
                            <div class="text-[11px] font-semibold text-eg-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                                <FolderOpen size={11} />
                                Spaces
                            </div>
                            <button
                                onclick={() => (creatingSpace = true)}
                                class="p-0.5 text-eg-text-tertiary hover:text-eg-text rounded transition-colors"
                                title="Create Space"
                            >
                                <Plus size={13} />
                            </button>
                        </div>
                    {/if}

                    {#if creatingSpace}
                        <div class="mb-2 px-2 mt-2">
                            <div class="flex items-center gap-1.5 bg-eg-bg-tertiary rounded-lg p-1.5">
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

                <!-- Recent (general sessions) — date-grouped -->
                {#if generalSessions.length > 0 || (sessionsQuery.data && sessionsQuery.data.length === 0)}
                    {#if (spacesQuery.data?.length ?? 0) > 0}
                        <div class="text-[11px] font-semibold text-eg-text-tertiary mb-1 px-2 uppercase tracking-wider mt-3 flex items-center gap-1.5">
                            <Clock size={11} />
                            Recent
                        </div>
                    {/if}

                    {#each Object.entries(generalSessionGroups) as [label, sessions]}
                        <div class="text-[11px] font-semibold text-eg-text-tertiary mb-1 px-2 uppercase tracking-wider mt-2 first:mt-0">{label}</div>
                        <div class="space-y-px">
                            {#each sessions as session}
                                <div
                                    role="button"
                                    tabindex="0"
                                    onclick={() => navigateTo(`/chat/${session._id}`)}
                                    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") navigateTo(`/chat/${session._id}`); }}
                                    onmouseenter={() => (hoveredSessionId = session._id)}
                                    onmouseleave={() => (hoveredSessionId = null)}
                                    class="w-full text-left px-2.5 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer
                                        {currentSessionId === session._id ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
                                >
                                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 {getProviderColor(session.model)}"></span>
                                    <span class="truncate flex-1">{session.title}</span>
                                    {#if hoveredSessionId === session._id}
                                        <button onclick={(e) => { e.stopPropagation(); toggleBookmark(session._id); }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-warning rounded transition-colors" title="Bookmark">
                                            <Bookmark size={13} />
                                        </button>
                                        <button onclick={(e) => { e.stopPropagation(); deleteSession(session._id); }} class="flex-shrink-0 p-0.5 text-eg-text-tertiary hover:text-eg-danger rounded transition-colors" title="Delete">
                                            <Trash2 size={13} />
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/each}

                    {#if sessionsQuery.data && sessionsQuery.data.length === 0}
                        <div class="text-center py-8 px-4">
                            <MessageSquare size={24} class="mx-auto text-eg-text-tertiary mb-2 opacity-50" />
                            <p class="text-xs text-eg-text-tertiary">No conversations yet</p>
                        </div>
                    {/if}
                {/if}
            {/if}
        </div>

        <!-- Bottom: Settings + User -->
        <div class="mt-auto pt-3 border-t border-eg-border/50 space-y-0.5">
            <button
                onclick={() => navigateTo("/settings")}
                class="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors
                    {$page.url.pathname === '/settings' ? 'bg-eg-bg-tertiary text-eg-text font-medium' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
            >
                <Settings size={16} />
                <span>Settings</span>
            </button>

            <div class="flex items-center gap-3 px-3 py-2.5 overflow-hidden">
                <UserButton afterSignOutUrl="/sign-in" />
                <span class="text-sm text-eg-text-secondary truncate flex-1">My Account</span>
            </div>
        </div>
    </div>
</aside>
