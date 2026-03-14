<script lang="ts">
    import { UserButton } from "svelte-clerk";
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import Settings from "lucide-svelte/icons/settings";
    import Plus from "lucide-svelte/icons/plus";
    import Moon from "lucide-svelte/icons/moon";
    import Sun from "lucide-svelte/icons/sun";
    import MessageSquare from "lucide-svelte/icons/message-square";
    import Search from "lucide-svelte/icons/search";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import X from "lucide-svelte/icons/x";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    const client = useConvexClient();
    const sessionsQuery = useQuery(api.sessions.list, () => ({}));

    let theme = $state("light");
    let searchQuery = $state("");
    let searchMode = $state(false);
    let hoveredSessionId = $state<string | null>(null);

    // Full-text search query (only active when searching)
    const searchResults = useQuery(
        api.messages.searchFullText,
        () => (searchQuery.trim() ? { query: searchQuery.trim() } : "skip"),
    );

    // Derive current sessionId from the URL
    let currentSessionId = $derived(
        $page.url.pathname.startsWith("/chat/")
            ? $page.url.pathname.split("/chat/")[1]
            : null,
    );

    function toggleTheme() {
        theme = theme === "light" ? "dark" : "light";
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }

    onMount(() => {
        if (
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
            theme = "dark";
            document.documentElement.classList.add("dark");
        }
    });

    async function createNewThread() {
        const sessionId = await client.mutation(api.sessions.create, {
            model: "gpt-4o",
        });
        goto(`/chat/${sessionId}`);
    }

    async function deleteSession(sessionId: string) {
        await client.mutation(api.sessions.remove, {
            id: sessionId as any,
        });
        if (currentSessionId === sessionId) {
            goto("/");
        }
    }

    // Group sessions by date
    function groupByDate(
        sessions: Array<{
            _id: string;
            title: string;
            model: string;
            lastActiveAt: number;
        }>,
    ) {
        const now = Date.now();
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
            }>
        > = {};

        for (const session of sessions) {
            const date = new Date(session.lastActiveAt);
            let label: string;
            if (date >= today) {
                label = "Today";
            } else if (date >= yesterday) {
                label = "Yesterday";
            } else if (date >= weekAgo) {
                label = "This Week";
            } else {
                label = "Older";
            }
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
            return "bg-green-500";
        if (modelId.startsWith("claude-")) return "bg-orange-500";
        if (modelId.startsWith("sonar")) return "bg-blue-500";
        return "bg-gray-400";
    }

    let sessionGroups = $derived(
        sessionsQuery.data ? groupByDate(sessionsQuery.data) : {},
    );
</script>

<aside
    class="w-[260px] h-full flex-shrink-0 bg-[#f7f7f8] dark:bg-[#1a1a1a] border-r border-[#e5e5e5] dark:border-[#2d2d2d] flex flex-col transition-colors duration-200"
>
    <div class="p-4 flex flex-col h-full">
        <!-- Logo -->
        <a
            href="/"
            class="flex items-center gap-2 mb-6 px-2 hover:opacity-80 transition-opacity"
        >
            <div
                class="w-7 h-7 bg-black dark:bg-white rounded-md flex items-center justify-center"
            >
                <span class="text-white dark:text-black font-bold text-sm"
                    >E</span
                >
            </div>
            <span
                class="font-medium text-lg tracking-tight text-gray-900 dark:text-gray-100"
                >Evergood</span
            >
        </a>

        <!-- New Thread Button -->
        <button
            onclick={createNewThread}
            class="flex items-center gap-2 w-full bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#3d3d3d] hover:border-gray-300 dark:hover:border-[#4d4d4d] text-gray-900 dark:text-gray-100 px-4 py-2.5 rounded-lg shadow-sm transition-all duration-200 font-medium mb-4"
        >
            <Plus size={18} class="text-gray-500 dark:text-gray-400" />
            <span>New Thread</span>
        </button>

        <!-- Search Bar -->
        <div class="relative mb-4">
            {#if searchMode}
                <div class="flex items-center gap-1">
                    <div class="relative flex-1">
                        <Search
                            size={14}
                            class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            bind:value={searchQuery}
                            placeholder="Search messages..."
                            class="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#3d3d3d] rounded-lg outline-none focus:border-gray-300 dark:focus:border-[#555] text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                        />
                    </div>
                    <button
                        onclick={() => {
                            searchMode = false;
                            searchQuery = "";
                        }}
                        class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"
                    >
                        <X size={16} />
                    </button>
                </div>
            {:else}
                <button
                    onclick={() => (searchMode = true)}
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-lg transition-colors"
                >
                    <Search size={14} />
                    <span>Search chats...</span>
                </button>
            {/if}
        </div>

        <!-- Chat History -->
        <div class="flex-1 overflow-y-auto">
            {#if searchMode && searchQuery.trim()}
                <!-- Search Results -->
                {#if searchResults.isLoading}
                    <p
                        class="text-xs text-gray-400 dark:text-gray-500 px-2 py-4"
                    >
                        Searching...
                    </p>
                {:else if searchResults.data && searchResults.data.length > 0}
                    <div
                        class="text-xs font-semibold text-gray-500 dark:text-[#888] mb-3 px-2 uppercase tracking-wide"
                    >
                        Results
                    </div>
                    <div class="space-y-1">
                        {#each searchResults.data as result}
                            <button
                                onclick={() =>
                                    goto(`/chat/${result.sessionId}`)}
                                class="w-full text-left px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors"
                            >
                                <div class="font-medium truncate">
                                    {result.sessionTitle}
                                </div>
                                <div
                                    class="text-xs text-gray-400 truncate mt-0.5"
                                >
                                    {result.content.slice(0, 80)}...
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <p
                        class="text-xs text-gray-400 dark:text-gray-500 px-2 py-4"
                    >
                        No results found
                    </p>
                {/if}
            {:else if sessionsQuery.isLoading}
                <div class="flex items-center justify-center py-8">
                    <div
                        class="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>
            {:else if sessionsQuery.data && sessionsQuery.data.length > 0}
                {#each Object.entries(sessionGroups) as [label, sessions]}
                    <div
                        class="text-xs font-semibold text-gray-500 dark:text-[#888] mb-3 px-2 uppercase tracking-wide mt-4 first:mt-0"
                    >
                        {label}
                    </div>
                    <div class="space-y-1">
                        {#each sessions as session}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                role="button"
                                tabindex="0"
                                onclick={() =>
                                    goto(`/chat/${session._id}`)}
                                onkeydown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') goto(`/chat/${session._id}`);
                                }}
                                onmouseenter={() =>
                                    (hoveredSessionId = session._id)}
                                onmouseleave={() =>
                                    (hoveredSessionId = null)}
                                class="w-full text-left px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors truncate flex items-center gap-2 group cursor-pointer {currentSessionId ===
                                session._id
                                    ? 'bg-[#e5e5e5] dark:bg-[#2d2d2d] font-medium text-black dark:text-white'
                                    : ''}"
                            >
                                <span
                                    class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(session.model)}"
                                ></span>
                                <span class="truncate flex-1"
                                    >{session.title}</span
                                >
                                {#if hoveredSessionId === session._id}
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            deleteSession(session._id);
                                        }}
                                        class="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/each}
            {:else}
                <div class="text-center py-8 px-4">
                    <MessageSquare
                        size={24}
                        class="mx-auto text-gray-300 dark:text-gray-600 mb-2"
                    />
                    <p class="text-xs text-gray-400 dark:text-gray-500">
                        No conversations yet
                    </p>
                </div>
            {/if}
        </div>

        <!-- Bottom Area -->
        <div
            class="mt-auto pt-4 border-t border-gray-200 dark:border-[#2d2d2d] space-y-2"
        >
            <!-- Theme Toggle -->
            <button
                onclick={toggleTheme}
                class="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors"
            >
                <span class="flex items-center gap-2">
                    {#if theme === "light"}
                        <Moon size={18} />
                    {:else}
                        <Sun size={18} />
                    {/if}
                    Theme
                </span>
                <span class="text-xs text-gray-400 capitalize">{theme}</span>
            </button>

            <!-- Settings -->
            <a
                href="/settings"
                class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors {$page
                    .url.pathname === '/settings'
                    ? 'bg-[#e5e5e5] dark:bg-[#2d2d2d] font-medium text-black dark:text-white'
                    : ''}"
            >
                <Settings size={18} />
                <span>Settings</span>
            </a>

            <!-- User Auth Profile -->
            <div
                class="w-full flex items-center gap-3 px-3 py-2.5 mt-2 overflow-hidden h-12"
            >
                <UserButton afterSignOutUrl="/sign-in" />
                <span
                    class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1"
                    >My Account</span
                >
            </div>
        </div>
    </div>
</aside>
