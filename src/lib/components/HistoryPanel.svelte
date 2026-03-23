<script lang="ts">
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { goto } from "$app/navigation";
    import Search from "lucide-svelte/icons/search";
    import Plus from "lucide-svelte/icons/plus";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import ThreadCard from "$lib/components/ThreadCard.svelte";
    import ChooseSpaceModal from "$lib/components/ChooseSpaceModal.svelte";
    import ConfirmDialog from "$lib/components/ui/ConfirmDialog.svelte";

    const client = useConvexClient();

    // --- Tabs (future-proof: just push more entries) ---
    const tabs = ["Threads"] as const;
    let activeTab = $state<(typeof tabs)[number]>("Threads");

    // --- Search ---
    let searchQuery = $state("");

    const searchResults = useQuery(
        api.messages.searchFullText,
        () => (searchQuery.trim() ? { query: searchQuery.trim() } : "skip"),
    );

    // --- Sessions with preview ---
    const sessionsQuery = useQuery(api.sessions.listWithPreview, () => ({}));
    const spacesQuery = useQuery(api.spaces.list, () => ({}));

    // Build a space lookup map for enriching thread cards
    let spaceMap = $derived(
        new Map(
            (spacesQuery.data ?? []).map((s) => [
                s._id,
                { name: s.name, icon: s.icon },
            ]),
        ),
    );

    // --- Sort ---
    type SortOption = "newest" | "oldest";
    let sortBy = $state<SortOption>("newest");
    let sortDropdownOpen = $state(false);

    // --- Type filter ---
    type TypeFilter = "all" | "deep-research" | "regular";
    let typeFilter = $state<TypeFilter>("all");
    let typeDropdownOpen = $state(false);

    // --- Temp threads filter ---
    let showTempThreads = $state(true);
    let tempDropdownOpen = $state(false);

    // --- Filtered + sorted sessions ---
    let filteredSessions = $derived.by(() => {
        let sessions = sessionsQuery.data ?? [];

        // Merge search results by sessionId when searching
        if (searchQuery.trim() && searchResults.data) {
            const matchedSessionIds = new Set(
                searchResults.data.map((r) => r.sessionId as string),
            );
            // Also do client-side title matching
            const titleMatches = sessions.filter((s) =>
                s.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
            );
            const titleMatchIds = new Set(titleMatches.map((s) => s._id));

            sessions = sessions.filter(
                (s) => matchedSessionIds.has(s._id) || titleMatchIds.has(s._id),
            );
        }

        // Type filter
        if (typeFilter === "deep-research") {
            sessions = sessions.filter(
                (s) =>
                    s.model === "sonar-deep-research" || s.title.startsWith("🔬"),
            );
        } else if (typeFilter === "regular") {
            sessions = sessions.filter(
                (s) =>
                    s.model !== "sonar-deep-research" && !s.title.startsWith("🔬"),
            );
        }

        // Temp threads filter (hide sessions with 0 messages)
        if (!showTempThreads) {
            sessions = sessions.filter((s) => s.messageCount > 0);
        }

        // Sort
        const sorted = [...sessions];
        if (sortBy === "newest") {
            sorted.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
        } else {
            sorted.sort((a, b) => a.lastActiveAt - b.lastActiveAt);
        }

        // Enrich with space info
        return sorted.map((s) => {
            const spaceInfo = s.spaceId ? spaceMap.get(s.spaceId) : undefined;
            return {
                ...s,
                _id: s._id as string,
                spaceId: s.spaceId as string | undefined,
                spaceName: spaceInfo?.name,
                spaceIcon: spaceInfo?.icon,
            };
        });
    });

    // --- Rename state ---
    let renamingId = $state<string | null>(null);
    let renameValue = $state("");

    function startRename(id: string) {
        const session = filteredSessions.find((s) => s._id === id);
        if (session) {
            renamingId = id;
            renameValue = session.title;
        }
    }

    async function commitRename() {
        if (renamingId && renameValue.trim()) {
            await client.mutation(api.sessions.updateTitle, {
                id: renamingId as Id<"sessions">,
                title: renameValue.trim(),
            });
        }
        renamingId = null;
        renameValue = "";
    }

    function cancelRename() {
        renamingId = null;
        renameValue = "";
    }

    // --- Delete state ---
    let deleteTarget = $state<string | null>(null);
    let deleteTitle = $state("");

    function startDelete(id: string) {
        const session = filteredSessions.find((s) => s._id === id);
        deleteTarget = id;
        deleteTitle = session?.title ?? "this thread";
    }

    async function confirmDelete() {
        if (deleteTarget) {
            await client.mutation(api.sessions.remove, {
                id: deleteTarget as Id<"sessions">,
            });
        }
        deleteTarget = null;
    }

    // --- Add to Space state ---
    let spaceModalTarget = $state<string | null>(null);

    function startAddToSpace(id: string) {
        spaceModalTarget = id;
    }

    async function assignToSpace(spaceId: Id<"spaces">) {
        if (spaceModalTarget) {
            await client.mutation(api.sessions.assignToSpace, {
                id: spaceModalTarget as Id<"sessions">,
                spaceId,
            });
        }
        spaceModalTarget = null;
    }

    async function createNewSpaceAndAssign() {
        if (!spaceModalTarget) return;
        const sessionId = spaceModalTarget;
        spaceModalTarget = null;

        const newSpaceId = await client.mutation(api.spaces.create, {
            name: "New Space",
        });
        await client.mutation(api.sessions.assignToSpace, {
            id: sessionId as Id<"sessions">,
            spaceId: newSpaceId,
        });
        goto(`/spaces/${newSpaceId}`);
    }

    // Close dropdowns on outside click
    function closeDropdowns() {
        sortDropdownOpen = false;
        typeDropdownOpen = false;
        tempDropdownOpen = false;
    }

    const sortLabels: Record<SortOption, string> = {
        newest: "Newest",
        oldest: "Oldest",
    };

    const typeLabels: Record<TypeFilter, string> = {
        all: "Type",
        "deep-research": "Deep Research",
        regular: "Regular",
    };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={closeDropdowns} />

<div class="h-full bg-eg-bg overflow-hidden">
    <div class="h-full overflow-y-auto eg-scrollbar px-4 sm:px-10 py-6">
        <div class="max-w-3xl mx-auto w-full min-h-full flex flex-col">
            <!-- Header: Title + New Thread button -->
            <div class="flex items-center justify-between pb-2">
                <h1 class="text-xl font-semibold text-eg-text">History</h1>
                <button
                    onclick={async () => {
                        const id = await client.mutation(api.sessions.create, {});
                        goto(`/chat/${id}`);
                    }}
                    class="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-eg-bg-tertiary text-eg-text hover:bg-eg-border/50 rounded-lg transition-colors"
                >
                    <Plus size={15} />
                    New Thread
                </button>
            </div>

            <!-- Sub-tabs -->
            <div class="border-b border-eg-border/50">
                <nav class="flex gap-6">
                    {#each tabs as tab}
                        <button
                            onclick={() => (activeTab = tab)}
                            class="relative pb-3 text-sm font-medium transition-colors
                                {activeTab === tab ? 'text-eg-text' : 'text-eg-text-tertiary hover:text-eg-text-secondary'}"
                        >
                            {tab}
                            {#if activeTab === tab}
                                <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-eg-accent rounded-full"></span>
                            {/if}
                        </button>
                    {/each}
                </nav>
            </div>

            <!-- Search + Filters -->
            <div class="py-4 space-y-3">
                <!-- Search bar -->
                <div class="relative">
                    <Search
                        size={16}
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-eg-text-tertiary"
                    />
                    <input
                        bind:value={searchQuery}
                        placeholder="Search your threads..."
                        class="w-full pl-10 pr-4 py-2.5 text-sm bg-eg-bg-secondary border border-eg-border/50 rounded-lg outline-none focus:ring-1 focus:ring-eg-accent/50 text-eg-text placeholder:text-eg-text-tertiary"
                    />
                </div>

                <!-- Filter/Sort row -->
                <div class="flex items-center gap-2 flex-wrap">
            <!-- Type filter dropdown -->
            <div class="relative" data-menu>
                <button
                    onclick={(e) => { e.stopPropagation(); typeDropdownOpen = !typeDropdownOpen; sortDropdownOpen = false; tempDropdownOpen = false; }}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-full transition-colors
                        {typeFilter !== 'all' ? 'border-eg-accent text-eg-accent bg-eg-accent/10' : 'border-eg-border text-eg-text-secondary hover:text-eg-text hover:border-eg-text-tertiary'}"
                >
                    {typeLabels[typeFilter]}
                    <ChevronDown size={12} />
                </button>
                {#if typeDropdownOpen}
                    <div class="absolute left-0 top-full mt-1 w-40 bg-eg-surface border border-eg-border rounded-lg shadow-lg z-20 py-1">
                        {#each (["all", "deep-research", "regular"] as TypeFilter[]) as opt}
                            <button
                                onclick={(e) => { e.stopPropagation(); typeFilter = opt; typeDropdownOpen = false; }}
                                class="w-full px-3 py-2 text-left text-sm transition-colors
                                    {typeFilter === opt ? 'text-eg-text bg-eg-bg-tertiary' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
                            >
                                {typeLabels[opt]}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Temp threads toggle -->
            <div class="relative" data-menu>
                <button
                    onclick={(e) => { e.stopPropagation(); tempDropdownOpen = !tempDropdownOpen; sortDropdownOpen = false; typeDropdownOpen = false; }}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-full transition-colors
                        {!showTempThreads ? 'border-eg-accent text-eg-accent bg-eg-accent/10' : 'border-eg-border text-eg-text-secondary hover:text-eg-text hover:border-eg-text-tertiary'}"
                >
                    Temporary Threads: {showTempThreads ? "Show" : "Hide"}
                    <ChevronDown size={12} />
                </button>
                {#if tempDropdownOpen}
                    <div class="absolute left-0 top-full mt-1 w-48 bg-eg-surface border border-eg-border rounded-lg shadow-lg z-20 py-1">
                        <button
                            onclick={(e) => { e.stopPropagation(); showTempThreads = true; tempDropdownOpen = false; }}
                            class="w-full px-3 py-2 text-left text-sm transition-colors
                                {showTempThreads ? 'text-eg-text bg-eg-bg-tertiary' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
                        >
                            Show
                        </button>
                        <button
                            onclick={(e) => { e.stopPropagation(); showTempThreads = false; tempDropdownOpen = false; }}
                            class="w-full px-3 py-2 text-left text-sm transition-colors
                                {!showTempThreads ? 'text-eg-text bg-eg-bg-tertiary' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
                        >
                            Hide
                        </button>
                    </div>
                {/if}
            </div>

            <!-- Spacer -->
            <div class="flex-1"></div>

            <!-- Sort dropdown (right-aligned) -->
            <div class="relative" data-menu>
                <button
                    onclick={(e) => { e.stopPropagation(); sortDropdownOpen = !sortDropdownOpen; typeDropdownOpen = false; tempDropdownOpen = false; }}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-eg-text-secondary hover:text-eg-text transition-colors"
                >
                    Sort: {sortLabels[sortBy]}
                    <ChevronDown size={12} />
                </button>
                {#if sortDropdownOpen}
                    <div class="absolute right-0 top-full mt-1 w-36 bg-eg-surface border border-eg-border rounded-lg shadow-lg z-20 py-1">
                        {#each (["newest", "oldest"] as SortOption[]) as opt}
                            <button
                                onclick={(e) => { e.stopPropagation(); sortBy = opt; sortDropdownOpen = false; }}
                                class="w-full px-3 py-2 text-left text-sm transition-colors
                                    {sortBy === opt ? 'text-eg-text bg-eg-bg-tertiary' : 'text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary'}"
                            >
                                {sortLabels[opt]}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
                </div>
            </div>

            <!-- Thread list -->
            <div class="flex-1 min-h-0 rounded-2xl border border-eg-border/40 bg-eg-bg-secondary/40 overflow-hidden">
                {#if sessionsQuery.isLoading}
                    <div class="flex items-center justify-center py-16">
                        <div class="w-6 h-6 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
                    </div>
                {:else if filteredSessions.length > 0}
                    {#each filteredSessions as session (session._id)}
                        {#if renamingId === session._id}
                            <!-- Inline rename row -->
                            <div class="px-5 py-4 border-b border-eg-border/30 bg-eg-bg-tertiary/50">
                                <!-- svelte-ignore a11y_autofocus -->
                                <input
                                    bind:value={renameValue}
                                    onkeydown={(e) => {
                                        if (e.key === "Enter") commitRename();
                                        if (e.key === "Escape") cancelRename();
                                    }}
                                    onblur={commitRename}
                                    class="w-full px-3 py-2 text-sm bg-eg-bg-secondary border border-eg-accent/50 rounded-lg outline-none focus:ring-1 focus:ring-eg-accent/50 text-eg-text"
                                    autofocus
                                />
                            </div>
                        {:else}
                            <ThreadCard
                                {session}
                                ondelete={startDelete}
                                onrename={startRename}
                                onaddtospace={startAddToSpace}
                            />
                        {/if}
                    {/each}
                {:else}
                    <div class="flex flex-col items-center justify-center py-16 text-center px-6">
                        <p class="text-sm text-eg-text-tertiary">
                            {searchQuery.trim() ? "No threads found matching your search." : "No threads yet. Start a new conversation!"}
                        </p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

<!-- Delete confirmation dialog -->
<ConfirmDialog
    open={deleteTarget !== null}
    title="Delete Thread"
    message={`Are you sure you want to delete "${deleteTitle}"? This will permanently remove all messages in this thread.`}
    confirmLabel="Delete"
    cancelLabel="Cancel"
    onconfirm={confirmDelete}
    oncancel={() => (deleteTarget = null)}
/>

<!-- Choose Space modal -->
<ChooseSpaceModal
    open={spaceModalTarget !== null}
    onclose={() => (spaceModalTarget = null)}
    onselect={assignToSpace}
    oncreatenew={createNewSpaceAndAssign}
/>
