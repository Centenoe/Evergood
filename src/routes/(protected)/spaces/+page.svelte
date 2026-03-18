<script lang="ts">
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { goto } from "$app/navigation";
    import FolderOpen from "lucide-svelte/icons/folder-open";
    import Plus from "lucide-svelte/icons/plus";
    import MessageSquare from "lucide-svelte/icons/message-square";

    const client = useConvexClient();
    const spacesQuery = useQuery(api.spaces.list, () => ({}));
    const sessionsQuery = useQuery(api.sessions.list, () => ({}));

    let creating = $state(false);

    // Count sessions per space
    let sessionCounts = $derived.by(() => {
        const counts = new Map<string, number>();
        for (const s of sessionsQuery.data ?? []) {
            if (s.spaceId) {
                counts.set(s.spaceId, (counts.get(s.spaceId) ?? 0) + 1);
            }
        }
        return counts;
    });

    async function createSpace() {
        if (creating) return;
        creating = true;
        try {
            const spaceId = await client.mutation(api.spaces.create, {
                name: "New Space",
                icon: "📁",
            });
            goto(`/spaces/${spaceId}`);
        } catch (error) {
            console.error("Failed to create space:", error);
        } finally {
            creating = false;
        }
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
</script>

<main class="flex-1 min-h-0 overflow-y-auto bg-eg-bg">
    <div class="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-3xl font-semibold text-eg-text tracking-tight">Spaces</h1>
                <p class="text-sm text-eg-text-secondary mt-1">Isolated knowledge hubs with custom instructions and localized memory.</p>
            </div>
            <button
                onclick={createSpace}
                disabled={creating}
                class="flex items-center gap-2 px-4 py-2.5 bg-eg-accent text-eg-accent-text rounded-lg font-medium text-sm hover:bg-eg-accent-hover transition-colors disabled:opacity-50"
            >
                <Plus size={16} />
                New Space
            </button>
        </div>

        <!-- Spaces Grid -->
        {#if spacesQuery.isLoading}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each Array(4) as _}
                    <div class="bg-eg-surface border border-eg-border rounded-xl p-5 animate-pulse">
                        <div class="h-10 w-10 bg-eg-bg-tertiary rounded-lg mb-4"></div>
                        <div class="h-4 bg-eg-bg-tertiary rounded w-24 mb-2"></div>
                        <div class="h-3 bg-eg-bg-tertiary rounded w-full"></div>
                    </div>
                {/each}
            </div>
        {:else if spacesQuery.data && spacesQuery.data.length > 0}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each spacesQuery.data as space}
                    {@const threadCount = sessionCounts.get(space._id) ?? 0}
                    <button
                        onclick={() => goto(`/spaces/${space._id}`)}
                        class="bg-eg-surface border border-eg-border rounded-xl p-5 text-left hover:border-eg-text-tertiary hover:shadow-md transition-all group"
                    >
                        <div class="flex items-start justify-between mb-3">
                            <div class="w-10 h-10 bg-eg-bg-tertiary rounded-lg flex items-center justify-center text-lg">
                                {space.icon ?? "📁"}
                            </div>
                            <div class="flex items-center gap-1.5 text-xs text-eg-text-tertiary">
                                <MessageSquare size={12} />
                                <span>{threadCount}</span>
                            </div>
                        </div>
                        <h3 class="font-semibold text-eg-text text-sm mb-1 truncate group-hover:text-eg-accent transition-colors">
                            {space.name}
                        </h3>
                        {#if space.description}
                            <p class="text-xs text-eg-text-tertiary line-clamp-2">{space.description}</p>
                        {:else}
                            <p class="text-xs text-eg-text-tertiary italic">No description</p>
                        {/if}
                        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-eg-border-subtle">
                            {#if space.defaultModel}
                                <span class="text-[10px] px-1.5 py-0.5 bg-eg-bg-tertiary rounded text-eg-text-tertiary">{space.defaultModel}</span>
                            {/if}
                            <span class="text-[10px] text-eg-text-tertiary ml-auto">{formatRelativeTime(space.createdAt)}</span>
                        </div>
                    </button>
                {/each}
            </div>
        {:else}
            <!-- Empty state -->
            <div class="flex flex-col items-center justify-center py-20">
                <div class="w-16 h-16 bg-eg-bg-tertiary rounded-2xl flex items-center justify-center mb-4">
                    <FolderOpen size={28} class="text-eg-text-tertiary" />
                </div>
                <h2 class="text-lg font-medium text-eg-text mb-1">No spaces yet</h2>
                <p class="text-sm text-eg-text-secondary mb-6 text-center max-w-md">
                    Create a Space to organize conversations with custom AI instructions and localized memory.
                </p>
                <button
                    onclick={createSpace}
                    disabled={creating}
                    class="flex items-center gap-2 px-5 py-2.5 bg-eg-accent text-eg-accent-text rounded-lg font-medium text-sm hover:bg-eg-accent-hover transition-colors disabled:opacity-50"
                >
                    <Plus size={16} />
                    Create Your First Space
                </button>
            </div>
        {/if}
    </div>
</main>
