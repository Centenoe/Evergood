<script lang="ts">
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import Plus from "lucide-svelte/icons/plus";
    import Pencil from "lucide-svelte/icons/pencil";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import Check from "lucide-svelte/icons/check";
    import X from "lucide-svelte/icons/x";
    import Brain from "lucide-svelte/icons/brain";
    import Globe from "lucide-svelte/icons/globe";
    import FolderOpen from "lucide-svelte/icons/folder-open";

    const client = useConvexClient();

    let memoryScope = $state<"global" | "space">("global");
    let selectedSpaceId = $state<string | null>(null);

    const spacesQuery = useQuery(api.spaces.list, () => ({}));
    const memoriesQuery = useQuery(api.memories.list, () => {
        if (memoryScope === "space" && selectedSpaceId) {
            return { spaceId: selectedSpaceId as Id<"spaces"> };
        }
        return {};
    });
    const sessionsQuery = useQuery(api.sessions.list, () => ({}));

    let addingMemory = $state(false);
    let newCategory = $state("stack");
    let newContent = $state("");
    let editingId = $state<string | null>(null);
    let editContent = $state("");
    let editCategory = $state("");
    let extractingSessionId = $state<string | null>(null);

    const categories = ["stack", "project", "preference", "work", "personal", "goal"];

    const categoryColors: Record<string, string> = {
        stack: "bg-blue-100 text-blue-700",
        project: "bg-green-100 text-green-700",
        preference: "bg-purple-100 text-purple-700",
        work: "bg-amber-100 text-amber-700",
        personal: "bg-pink-100 text-pink-700",
        goal: "bg-teal-100 text-teal-700",
    };

    async function addMemory() {
        if (!newContent.trim()) return;
        const args: { category: string; content: string; confidence: number; spaceId?: Id<"spaces"> } = {
            category: newCategory,
            content: newContent.trim(),
            confidence: 0.8,
        };
        if (memoryScope === "space" && selectedSpaceId) {
            args.spaceId = selectedSpaceId as Id<"spaces">;
        }
        await client.mutation(api.memories.upsert, args);
        newContent = "";
        addingMemory = false;
    }

    async function saveEdit(id: string) {
        await client.mutation(api.memories.update, { id: id as Id<"memories">, content: editContent, category: editCategory });
        editingId = null;
    }

    async function deleteMemory(id: string) {
        await client.mutation(api.memories.remove, { id: id as Id<"memories"> });
    }

    async function extractFromSession(sessionId: string) {
        extractingSessionId = sessionId;
        try {
            const session = sessionsQuery.data?.find((entry) => entry._id === sessionId);
            await client.action(api.summarize.extractMemories, {
                sessionId: sessionId as Id<"sessions">,
                spaceId: session?.spaceId ?? undefined,
            });
        } catch (error) {
            console.error("Memory extraction failed:", error);
        } finally {
            extractingSessionId = null;
        }
    }
</script>

<div class="mx-auto max-w-3xl space-y-8">
    <div>
        <h1 class="text-3xl font-semibold text-eg-text">Memory & Profile</h1>
        <p class="mt-2 text-sm text-eg-text-secondary">Manage the lasting facts the assistant remembers and extract new memories from past conversations.</p>
    </div>

    <section class="rounded-2xl border border-eg-border bg-eg-surface p-6">
        <div class="flex items-center justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
                <Brain size={22} class="text-purple-500" />
                <h2 class="text-xl font-medium text-eg-text">Memory & Profile</h2>
            </div>
            <button onclick={() => (addingMemory = !addingMemory)} class="flex items-center gap-1.5 rounded-lg bg-eg-accent px-3 py-1.5 text-sm font-medium text-eg-accent-text transition-colors hover:bg-eg-accent-hover">
                <Plus size={14} />
                Add Memory
            </button>
        </div>
        <p class="mb-4 text-sm text-eg-text-secondary">These facts are injected into every conversation so the AI keeps your context in mind.</p>

        <div class="mb-4 flex items-center gap-2">
            <button
                onclick={() => { memoryScope = 'global'; selectedSpaceId = null; }}
                class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {memoryScope === 'global' ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
            >
                <Globe size={12} />
                Global
            </button>
            <button
                onclick={() => { memoryScope = 'space'; }}
                class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {memoryScope === 'space' ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
            >
                <FolderOpen size={12} />
                Space
            </button>
            {#if memoryScope === 'space'}
                <select bind:value={selectedSpaceId} class="ml-2 rounded-lg border border-eg-border bg-eg-bg-secondary px-3 py-1.5 text-xs text-eg-text">
                    <option value={null}>Select a space...</option>
                    {#if spacesQuery.data}
                        {#each spacesQuery.data as space}
                            <option value={space._id}>{space.icon ?? '📁'} {space.name}</option>
                        {/each}
                    {/if}
                </select>
            {/if}
        </div>

        <p class="mb-4 text-[11px] text-eg-text-tertiary">
            {#if memoryScope === 'global'}
                Global memories are injected into <strong>all</strong> conversations.
            {:else if selectedSpaceId}
                Space memories are only injected into conversations within this space.
            {:else}
                Select a space to manage its memories.
            {/if}
        </p>

        {#if addingMemory}
            <div class="mb-6 rounded-lg border border-eg-border bg-eg-bg-secondary p-4">
                <div class="mb-3 flex gap-3">
                    <select bind:value={newCategory} class="rounded-lg border border-eg-border bg-eg-surface px-3 py-2 text-sm text-eg-text">
                        {#each categories as cat}
                            <option value={cat}>{cat}</option>
                        {/each}
                    </select>
                    <input bind:value={newContent} placeholder="e.g., Uses SvelteKit + Tailwind v4" class="flex-1 rounded-lg border border-eg-border bg-eg-surface px-3 py-2 text-sm text-eg-text placeholder:text-eg-text-tertiary" onkeydown={(e) => { if (e.key === 'Enter') addMemory(); }} />
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick={() => (addingMemory = false)} class="rounded-lg px-3 py-1.5 text-sm text-eg-text-secondary hover:text-eg-text">Cancel</button>
                    <button onclick={addMemory} disabled={!newContent.trim()} class="rounded-lg bg-eg-accent px-4 py-1.5 text-sm font-medium text-eg-accent-text transition-colors hover:bg-eg-accent-hover disabled:opacity-50">Save</button>
                </div>
            </div>
        {/if}

        {#if memoriesQuery.isLoading}
            <div class="flex justify-center py-8">
                <div class="h-5 w-5 rounded-full border-2 border-eg-border border-t-transparent animate-spin"></div>
            </div>
        {:else if memoriesQuery.data && memoriesQuery.data.length > 0}
            <div class="space-y-2">
                {#each memoriesQuery.data as memory}
                    <div class="group flex items-center gap-3 rounded-lg bg-eg-bg-secondary p-3">
                        {#if editingId === memory._id}
                            <select bind:value={editCategory} class="rounded border border-eg-border bg-eg-surface px-2 py-1 text-xs text-eg-text">
                                {#each categories as cat}
                                    <option value={cat}>{cat}</option>
                                {/each}
                            </select>
                            <input bind:value={editContent} class="flex-1 rounded border border-eg-border bg-eg-surface px-2 py-1 text-sm text-eg-text" />
                            <button onclick={() => saveEdit(memory._id)} class="rounded p-1.5 text-eg-success hover:opacity-80"><Check size={14} /></button>
                            <button onclick={() => (editingId = null)} class="rounded p-1.5 text-eg-text-tertiary hover:text-eg-text"><X size={14} /></button>
                        {:else}
                            <span class="rounded-full px-2 py-0.5 text-xs font-medium {categoryColors[memory.category] ?? 'bg-eg-bg-tertiary text-eg-text-secondary'}">{memory.category}</span>
                            {#if memory.spaceId}
                                <span class="rounded bg-eg-bg-tertiary px-1.5 py-0.5 text-[10px] font-medium text-eg-text-tertiary">Space</span>
                            {/if}
                            <span class="flex-1 text-sm text-eg-text">{memory.content}</span>
                            <div class="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-eg-border" title="Confidence: {(memory.confidence * 100).toFixed(0)}%">
                                <div class="h-full rounded-full bg-purple-500" style="width: {memory.confidence * 100}%"></div>
                            </div>
                            <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button onclick={() => { editingId = memory._id; editContent = memory.content; editCategory = memory.category; }} class="rounded p-1.5 text-eg-text-tertiary hover:text-eg-text"><Pencil size={14} /></button>
                                <button onclick={() => deleteMemory(memory._id)} class="rounded p-1.5 text-eg-text-tertiary hover:text-eg-danger"><Trash2 size={14} /></button>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="py-8 text-center text-sm text-eg-text-tertiary">
                <Brain size={24} class="mx-auto mb-2 opacity-50" />
                No memories yet. Start chatting and the AI will learn about you!
            </div>
        {/if}
    </section>

    <section class="rounded-2xl border border-eg-border bg-eg-surface p-6">
        <h2 class="text-xl font-medium text-eg-text mb-2">Extract from Conversation</h2>
        <p class="mb-3 text-sm text-eg-text-secondary">Use AI to scan a past conversation and extract useful facts about you.</p>
        <div class="mb-5 rounded-lg border border-eg-info/20 bg-eg-info/10 p-3 text-xs leading-relaxed text-eg-text">
            <p class="mb-1 font-medium">How it works</p>
            <ol class="list-inside list-decimal space-y-0.5 text-eg-text-secondary">
                <li>Pick a conversation below</li>
                <li>AI reads through it and pulls out 0-3 lasting facts</li>
                <li>Those facts are saved as memories</li>
                <li>Future conversations automatically include your memories</li>
            </ol>
        </div>
        {#if sessionsQuery.isLoading}
            <p class="text-sm text-eg-text-tertiary">Loading sessions...</p>
        {:else if sessionsQuery.data && sessionsQuery.data.length > 0}
            <div class="max-h-60 space-y-2 overflow-y-auto">
                {#each sessionsQuery.data as session}
                    <div class="flex items-center justify-between rounded-lg bg-eg-bg-secondary p-3">
                        <span class="flex-1 truncate text-sm text-eg-text">{session.title}</span>
                        <button onclick={() => extractFromSession(session._id)} disabled={extractingSessionId === session._id} class="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50">
                            {#if extractingSessionId === session._id}
                                <span class="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin"></span>
                                Extracting...
                            {:else}
                                <Brain size={12} />
                                Extract
                            {/if}
                        </button>
                    </div>
                {/each}
            </div>
        {:else}
            <p class="text-sm text-eg-text-tertiary">No conversations to extract from yet.</p>
        {/if}
    </section>
</div>