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
    import Layers from "lucide-svelte/icons/layers";
    import Globe from "lucide-svelte/icons/globe";
    import FolderOpen from "lucide-svelte/icons/folder-open";
    import { onMount } from "svelte";

    const client = useConvexClient();

    // Memory scope filter
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

    interface ModelInfo {
        id: string;
        label: string;
        provider: string;
        inputCostPer1M: number;
        outputCostPer1M: number;
    }
    let allModels = $state<ModelInfo[]>([]);
    let enabledModelIds = $state<Set<string>>(new Set());
    let modelsLoading = $state(true);

    const providerLabels: Record<string, string> = {
        openai: "OpenAI",
        anthropic: "Anthropic",
        perplexity: "Perplexity",
    };

    let groupedModels = $derived.by(() => {
        const groups: Record<string, ModelInfo[]> = {};
        for (const m of allModels) {
            if (!groups[m.provider]) groups[m.provider] = [];
            groups[m.provider].push(m);
        }
        return groups;
    });

    let allChecked = $derived(allModels.length > 0 && enabledModelIds.size === allModels.length);
    let noneChecked = $derived(enabledModelIds.size === 0);

    onMount(async () => {
        try {
            allModels = await client.action(api.available_models.listAvailable, {});
            const saved = localStorage.getItem("evergood-enabled-models");
            if (saved) {
                try {
                    const ids: string[] = JSON.parse(saved);
                    enabledModelIds = new Set(ids);
                } catch {
                    enabledModelIds = new Set(allModels.map(m => m.id));
                }
            } else {
                enabledModelIds = new Set(allModels.map(m => m.id));
            }
        } catch {
        } finally {
            modelsLoading = false;
        }
    });

    function toggleModel(modelId: string) {
        const next = new Set(enabledModelIds);
        if (next.has(modelId)) next.delete(modelId);
        else next.add(modelId);
        enabledModelIds = next;
        localStorage.setItem("evergood-enabled-models", JSON.stringify([...next]));
    }

    function selectAll() {
        enabledModelIds = new Set(allModels.map(m => m.id));
        localStorage.setItem("evergood-enabled-models", JSON.stringify([...enabledModelIds]));
    }

    function deselectAll() {
        enabledModelIds = new Set();
        localStorage.setItem("evergood-enabled-models", JSON.stringify([]));
    }

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
            const session = sessionsQuery.data?.find(s => s._id === sessionId);
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

<main class="flex-1 min-h-0 overflow-y-auto p-10 bg-eg-bg">
    <h1 class="text-3xl font-semibold mb-6 text-eg-text">Settings</h1>

    <!-- Memory & Profile -->
    <div class="max-w-2xl border border-eg-border rounded-xl p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <Brain size={22} class="text-purple-500" />
                <h2 class="text-xl font-medium text-eg-text">Memory & Profile</h2>
            </div>
            <button onclick={() => (addingMemory = !addingMemory)} class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-eg-accent text-eg-accent-text rounded-lg hover:bg-eg-accent-hover transition-colors">
                <Plus size={14} />
                Add Memory
            </button>
        </div>
        <p class="text-eg-text-secondary mb-4 text-sm">These facts are injected into every conversation so the AI knows your context.</p>

        <!-- Scope Tabs -->
        <div class="flex items-center gap-2 mb-4">
            <button
                onclick={() => { memoryScope = "global"; selectedSpaceId = null; }}
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {memoryScope === 'global' ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
            >
                <Globe size={12} />
                Global
            </button>
            <button
                onclick={() => { memoryScope = "space"; }}
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {memoryScope === 'space' ? 'bg-eg-accent text-eg-accent-text' : 'bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
            >
                <FolderOpen size={12} />
                Space
            </button>
            {#if memoryScope === "space"}
                <select
                    bind:value={selectedSpaceId}
                    class="ml-2 px-3 py-1.5 text-xs bg-eg-surface border border-eg-border rounded-lg text-eg-text"
                >
                    <option value={null}>Select a space...</option>
                    {#if spacesQuery.data}
                        {#each spacesQuery.data as space}
                            <option value={space._id}>{space.icon ?? "📁"} {space.name}</option>
                        {/each}
                    {/if}
                </select>
            {/if}
        </div>

        <p class="text-[11px] text-eg-text-tertiary mb-4">
            {#if memoryScope === "global"}
                Global memories are injected into <strong>all</strong> conversations.
            {:else if selectedSpaceId}
                Space memories are only injected into conversations within this space.
            {:else}
                Select a space to manage its memories.
            {/if}
        </p>

        {#if addingMemory}
            <div class="mb-6 bg-eg-bg-secondary rounded-lg p-4 border border-eg-border">
                <div class="flex gap-3 mb-3">
                    <select bind:value={newCategory} class="px-3 py-2 text-sm bg-eg-surface border border-eg-border rounded-lg text-eg-text">
                        {#each categories as cat}
                            <option value={cat}>{cat}</option>
                        {/each}
                    </select>
                    <input bind:value={newContent} placeholder="e.g., Uses SvelteKit + Tailwind v4" class="flex-1 px-3 py-2 text-sm bg-eg-surface border border-eg-border rounded-lg text-eg-text placeholder:text-eg-text-tertiary" onkeydown={(e) => { if (e.key === "Enter") addMemory(); }} />
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick={() => (addingMemory = false)} class="px-3 py-1.5 text-sm text-eg-text-secondary hover:text-eg-text rounded-lg">Cancel</button>
                    <button onclick={addMemory} disabled={!newContent.trim()} class="px-4 py-1.5 text-sm font-medium bg-eg-accent text-eg-accent-text rounded-lg hover:bg-eg-accent-hover disabled:opacity-50">Save</button>
                </div>
            </div>
        {/if}

        {#if memoriesQuery.isLoading}
            <div class="flex justify-center py-8">
                <div class="w-5 h-5 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
            </div>
        {:else if memoriesQuery.data && memoriesQuery.data.length > 0}
            <div class="space-y-2">
                {#each memoriesQuery.data as memory}
                    <div class="flex items-center gap-3 bg-eg-bg-secondary p-3 rounded-lg group">
                        {#if editingId === memory._id}
                            <select bind:value={editCategory} class="px-2 py-1 text-xs bg-eg-surface border border-eg-border rounded text-eg-text">
                                {#each categories as cat}
                                    <option value={cat}>{cat}</option>
                                {/each}
                            </select>
                            <input bind:value={editContent} class="flex-1 px-2 py-1 text-sm bg-eg-surface border border-eg-border rounded text-eg-text" />
                            <button onclick={() => saveEdit(memory._id)} class="p-1.5 text-eg-success hover:opacity-80 rounded"><Check size={14} /></button>
                            <button onclick={() => (editingId = null)} class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded"><X size={14} /></button>
                        {:else}
                            <span class="px-2 py-0.5 text-xs font-medium rounded-full {categoryColors[memory.category] ?? 'bg-eg-bg-tertiary text-eg-text-secondary'}">{memory.category}</span>
                            {#if memory.spaceId}
                                <span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-eg-bg-tertiary text-eg-text-tertiary">Space</span>
                            {/if}
                            <span class="flex-1 text-sm text-eg-text">{memory.content}</span>
                            <div class="flex-shrink-0 w-16 h-1.5 bg-eg-border rounded-full overflow-hidden" title="Confidence: {(memory.confidence * 100).toFixed(0)}%">
                                <div class="h-full bg-purple-500 rounded-full" style="width: {memory.confidence * 100}%"></div>
                            </div>
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick={() => { editingId = memory._id; editContent = memory.content; editCategory = memory.category; }} class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded"><Pencil size={14} /></button>
                                <button onclick={() => deleteMemory(memory._id)} class="p-1.5 text-eg-text-tertiary hover:text-eg-danger rounded"><Trash2 size={14} /></button>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="text-center py-8 text-sm text-eg-text-tertiary">
                <Brain size={24} class="mx-auto mb-2 opacity-50" />
                No memories yet. Start chatting and the AI will learn about you!
            </div>
        {/if}
    </div>

    <!-- Extract from Conversation -->
    <div class="max-w-2xl border border-eg-border rounded-xl p-6 mb-8">
        <h2 class="text-xl font-medium text-eg-text mb-2">Extract from Conversation</h2>
        <p class="text-eg-text-secondary mb-3 text-sm">Use AI to scan a past conversation and extract useful facts about you.</p>
        <div class="bg-eg-info/10 border border-eg-info/20 rounded-lg p-3 mb-5 text-xs text-eg-text leading-relaxed">
            <p class="font-medium mb-1">How it works</p>
            <ol class="list-decimal list-inside space-y-0.5 text-eg-text-secondary">
                <li>Pick a conversation below</li>
                <li>AI reads through it and pulls out 0-3 lasting facts</li>
                <li>Those facts are saved as Memories</li>
                <li>Future conversations automatically include your memories</li>
            </ol>
        </div>
        {#if sessionsQuery.isLoading}
            <p class="text-sm text-eg-text-tertiary">Loading sessions...</p>
        {:else if sessionsQuery.data && sessionsQuery.data.length > 0}
            <div class="space-y-2 max-h-60 overflow-y-auto">
                {#each sessionsQuery.data as session}
                    <div class="flex items-center justify-between bg-eg-bg-secondary p-3 rounded-lg">
                        <span class="text-sm text-eg-text truncate flex-1">{session.title}</span>
                        <button onclick={() => extractFromSession(session._id)} disabled={extractingSessionId === session._id} class="px-3 py-1 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
                            {#if extractingSessionId === session._id}
                                <span class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
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
    </div>

    <!-- Visible Models -->
    <div class="max-w-2xl border border-eg-border rounded-xl p-6 mb-8">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <Layers size={22} class="text-eg-info" />
                <h2 class="text-xl font-medium text-eg-text">Visible Models</h2>
            </div>
            <div class="flex items-center gap-2">
                <button onclick={selectAll} disabled={allChecked} class="px-3 py-1 text-xs font-medium text-eg-text-secondary hover:text-eg-text disabled:opacity-40 transition-colors">Select All</button>
                <button onclick={deselectAll} disabled={noneChecked} class="px-3 py-1 text-xs font-medium text-eg-text-secondary hover:text-eg-text disabled:opacity-40 transition-colors">Deselect All</button>
            </div>
        </div>
        <p class="text-eg-text-secondary mb-6 text-sm">Choose which models appear in the model selector.</p>

        {#if modelsLoading}
            <div class="flex justify-center py-8">
                <div class="w-5 h-5 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
            </div>
        {:else if allModels.length > 0}
            <div class="space-y-4">
                {#each Object.entries(groupedModels) as [provider, models]}
                    <div>
                        <div class="text-xs font-bold uppercase tracking-wider text-eg-text-tertiary mb-2 px-1">{providerLabels[provider] ?? provider}</div>
                        <div class="space-y-1">
                            {#each models as model}
                                <label class="flex items-center gap-3 bg-eg-bg-secondary p-3 rounded-lg cursor-pointer hover:bg-eg-bg-tertiary transition-colors">
                                    <input type="checkbox" checked={enabledModelIds.has(model.id)} onchange={() => toggleModel(model.id)} class="w-4 h-4 rounded border-eg-border accent-[var(--eg-accent)]" />
                                    <div class="flex-1 min-w-0">
                                        <div class="text-sm font-medium text-eg-text">{model.label}</div>
                                        {#if model.inputCostPer1M > 0}
                                            <div class="text-[11px] text-eg-text-tertiary">${model.inputCostPer1M.toFixed(2)} in / ${model.outputCostPer1M.toFixed(2)} out per 1M</div>
                                        {/if}
                                    </div>
                                    {#if model.id !== model.label}
                                        <span class="text-[11px] text-eg-text-tertiary truncate max-w-[120px]">{model.id}</span>
                                    {/if}
                                </label>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="text-center py-8 text-sm text-eg-text-tertiary">
                <Layers size={24} class="mx-auto mb-2 opacity-50" />
                Could not load models. Check your API keys.
            </div>
        {/if}
    </div>
</main>
