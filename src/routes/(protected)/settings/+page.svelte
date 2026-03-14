<script lang="ts">
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import Plus from "lucide-svelte/icons/plus";
    import Pencil from "lucide-svelte/icons/pencil";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import Check from "lucide-svelte/icons/check";
    import X from "lucide-svelte/icons/x";
    import Brain from "lucide-svelte/icons/brain";
    import Layers from "lucide-svelte/icons/layers";
    import { onMount } from "svelte";

    const client = useConvexClient();
    const memoriesQuery = useQuery(api.memories.list, () => ({}));
    const sessionsQuery = useQuery(api.sessions.list, () => ({}));

    let addingMemory = $state(false);
    let newCategory = $state("stack");
    let newContent = $state("");
    let editingId = $state<string | null>(null);
    let editContent = $state("");
    let editCategory = $state("");
    let extractingSessionId = $state<string | null>(null);

    // Model visibility feature
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
            // Load saved state
            const saved = localStorage.getItem("evergood-enabled-models");
            if (saved) {
                try {
                    const ids: string[] = JSON.parse(saved);
                    enabledModelIds = new Set(ids);
                } catch {
                    enabledModelIds = new Set(allModels.map(m => m.id));
                }
            } else {
                // All enabled by default
                enabledModelIds = new Set(allModels.map(m => m.id));
            }
        } catch {
            // Error handled — models won't load
        } finally {
            modelsLoading = false;
        }
    });

    function toggleModel(modelId: string) {
        const next = new Set(enabledModelIds);
        if (next.has(modelId)) {
            next.delete(modelId);
        } else {
            next.add(modelId);
        }
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

    const categories = [
        "stack",
        "project",
        "preference",
        "work",
        "personal",
        "goal",
    ];

    const categoryColors: Record<string, string> = {
        stack: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        project:
            "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
        preference:
            "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
        work: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        personal:
            "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
        goal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    };

    async function addMemory() {
        if (!newContent.trim()) return;
        await client.mutation(api.memories.upsert, {
            category: newCategory,
            content: newContent.trim(),
            confidence: 0.8,
        });
        newContent = "";
        addingMemory = false;
    }

    async function saveEdit(id: string) {
        await client.mutation(api.memories.update, {
            id: id as any,
            content: editContent,
            category: editCategory,
        });
        editingId = null;
    }

    async function deleteMemory(id: string) {
        await client.mutation(api.memories.remove, { id: id as any });
    }

    async function extractFromSession(sessionId: string) {
        extractingSessionId = sessionId;
        try {
            await client.action(api.summarize.extractMemories, {
                sessionId: sessionId as any,
            });
        } catch (error) {
            console.error("Memory extraction failed:", error);
        } finally {
            extractingSessionId = null;
        }
    }
</script>

<main class="flex-1 p-10 overflow-auto">
    <h1 class="text-3xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        Settings
    </h1>

    <!-- Memory & Profile Section -->
    <div
        class="max-w-2xl border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8"
    >
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <Brain size={22} class="text-purple-500" />
                <h2
                    class="text-xl font-medium text-gray-900 dark:text-gray-100"
                >
                    Memory & Profile
                </h2>
            </div>
            <button
                onclick={() => (addingMemory = !addingMemory)}
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
            >
                <Plus size={14} />
                Add Memory
            </button>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            These facts are automatically injected into every conversation so
            the AI knows your context.
        </p>

        <!-- Add Memory Form -->
        {#if addingMemory}
            <div
                class="mb-6 bg-gray-50 dark:bg-[#1e1e1e] rounded-lg p-4 border border-gray-200 dark:border-[#333]"
            >
                <div class="flex gap-3 mb-3">
                    <select
                        bind:value={newCategory}
                        class="px-3 py-2 text-sm bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3d3d3d] rounded-lg text-gray-900 dark:text-gray-100"
                    >
                        {#each categories as cat}
                            <option value={cat}>{cat}</option>
                        {/each}
                    </select>
                    <input
                        bind:value={newContent}
                        placeholder="e.g., Uses SvelteKit + Tailwind v4"
                        class="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3d3d3d] rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                        onkeydown={(e) => {
                            if (e.key === "Enter") addMemory();
                        }}
                    />
                </div>
                <div class="flex justify-end gap-2">
                    <button
                        onclick={() => (addingMemory = false)}
                        class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onclick={addMemory}
                        disabled={!newContent.trim()}
                        class="px-4 py-1.5 text-sm font-medium bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                        Save
                    </button>
                </div>
            </div>
        {/if}

        <!-- Memory List -->
        {#if memoriesQuery.isLoading}
            <div class="flex justify-center py-8">
                <div
                    class="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if memoriesQuery.data && memoriesQuery.data.length > 0}
            <div class="space-y-2">
                {#each memoriesQuery.data as memory}
                    <div
                        class="flex items-center gap-3 bg-gray-50 dark:bg-[#1e1e1e] p-3 rounded-lg group"
                    >
                        {#if editingId === memory._id}
                            <!-- Edit Mode -->
                            <select
                                bind:value={editCategory}
                                class="px-2 py-1 text-xs bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3d3d3d] rounded text-gray-900 dark:text-gray-100"
                            >
                                {#each categories as cat}
                                    <option value={cat}>{cat}</option>
                                {/each}
                            </select>
                            <input
                                bind:value={editContent}
                                class="flex-1 px-2 py-1 text-sm bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3d3d3d] rounded text-gray-900 dark:text-gray-100"
                            />
                            <button
                                onclick={() => saveEdit(memory._id)}
                                class="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                            >
                                <Check size={14} />
                            </button>
                            <button
                                onclick={() => (editingId = null)}
                                class="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded"
                            >
                                <X size={14} />
                            </button>
                        {:else}
                            <!-- Display Mode -->
                            <span
                                class="px-2 py-0.5 text-xs font-medium rounded-full {categoryColors[
                                    memory.category
                                ] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}"
                            >
                                {memory.category}
                            </span>
                            <span
                                class="flex-1 text-sm text-gray-800 dark:text-gray-200"
                                >{memory.content}</span
                            >
                            <div
                                class="flex-shrink-0 w-16 h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden"
                                title="Confidence: {(memory.confidence * 100).toFixed(0)}%"
                            >
                                <div
                                    class="h-full bg-purple-500 rounded-full"
                                    style="width: {memory.confidence * 100}%"
                                ></div>
                            </div>
                            <div
                                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <button
                                    onclick={() => {
                                        editingId = memory._id;
                                        editContent = memory.content;
                                        editCategory = memory.category;
                                    }}
                                    class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onclick={() => deleteMemory(memory._id)}
                                    class="p-1.5 text-gray-400 hover:text-red-500 rounded"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div
                class="text-center py-8 text-sm text-gray-400 dark:text-gray-500"
            >
                <Brain size={24} class="mx-auto mb-2 opacity-50" />
                No memories yet. Start chatting and the AI will learn about you!
            </div>
        {/if}
    </div>

    <!-- Extract from Conversation -->
    <div
        class="max-w-2xl border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8"
    >
        <div class="flex items-center gap-3 mb-2">
            <h2
                class="text-xl font-medium text-gray-900 dark:text-gray-100"
            >
                Extract from Conversation
            </h2>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mb-3 text-sm">
            Use AI to automatically scan a past conversation and extract
            useful facts about you — like your tech stack, preferences, or
            current projects.
        </p>
        <div
            class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg p-3 mb-5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed"
        >
            <p class="font-medium mb-1">📌 How it works</p>
            <ol class="list-decimal list-inside space-y-0.5 opacity-90">
                <li>Pick a conversation below</li>
                <li>
                    AI reads through it and pulls out 0–3 lasting facts
                </li>
                <li>
                    Those facts are saved as Memories (shown above)
                </li>
                <li>
                    Future conversations automatically include your
                    memories so the AI already knows your context
                </li>
            </ol>
        </div>
        {#if sessionsQuery.isLoading}
            <p class="text-sm text-gray-400">Loading sessions...</p>
        {:else if sessionsQuery.data && sessionsQuery.data.length > 0}
            <div class="space-y-2 max-h-60 overflow-y-auto">
                {#each sessionsQuery.data as session}
                    <div
                        class="flex items-center justify-between bg-gray-50 dark:bg-[#1e1e1e] p-3 rounded-lg"
                    >
                        <span
                            class="text-sm text-gray-800 dark:text-gray-200 truncate flex-1"
                            >{session.title}</span
                        >
                        <button
                            onclick={() => extractFromSession(session._id)}
                            disabled={extractingSessionId === session._id}
                            class="px-3 py-1 text-xs font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {#if extractingSessionId === session._id}
                                <span
                                    class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"
                                ></span>
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
            <p class="text-sm text-gray-400 dark:text-gray-500">
                No conversations to extract from yet.
            </p>
        {/if}
    </div>

    <!-- Visible Models Section -->
    <div
        class="max-w-2xl border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8"
    >
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <Layers size={22} class="text-blue-500" />
                <h2
                    class="text-xl font-medium text-gray-900 dark:text-gray-100"
                >
                    Visible Models
                </h2>
            </div>
            <div class="flex items-center gap-2">
                <button
                    onclick={selectAll}
                    disabled={allChecked}
                    class="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 transition-colors"
                >
                    Select All
                </button>
                <button
                    onclick={deselectAll}
                    disabled={noneChecked}
                    class="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 transition-colors"
                >
                    Deselect All
                </button>
            </div>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            Choose which models appear in the chat model selector. Unchecked models will be hidden.
        </p>

        {#if modelsLoading}
            <div class="flex justify-center py-8">
                <div
                    class="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"
                ></div>
            </div>
        {:else if allModels.length > 0}
            <div class="space-y-4">
                {#each Object.entries(groupedModels) as [provider, models]}
                    <div>
                        <div class="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">
                            {providerLabels[provider] ?? provider}
                        </div>
                        <div class="space-y-1">
                            {#each models as model}
                                <label
                                    class="flex items-center gap-3 bg-gray-50 dark:bg-[#1e1e1e] p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        checked={enabledModelIds.has(model.id)}
                                        onchange={() => toggleModel(model.id)}
                                        class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-500"
                                    />
                                    <div class="flex-1 min-w-0">
                                        <div class="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            {model.label}
                                        </div>
                                        {#if model.inputCostPer1M > 0}
                                            <div class="text-[11px] text-gray-400 dark:text-gray-500">
                                                ${model.inputCostPer1M.toFixed(2)} in / ${model.outputCostPer1M.toFixed(2)} out per 1M
                                            </div>
                                        {/if}
                                    </div>
                                    {#if model.id !== model.label}
                                        <span class="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                                            {model.id}
                                        </span>
                                    {/if}
                                </label>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div
                class="text-center py-8 text-sm text-gray-400 dark:text-gray-500"
            >
                <Layers size={24} class="mx-auto mb-2 opacity-50" />
                Could not load models. Check your API keys.
            </div>
        {/if}
    </div>

    <!-- Account Config Section -->
    <div
        class="max-w-2xl border border-gray-200 dark:border-gray-800 rounded-xl p-6"
    >
        <h2 class="text-xl font-medium mb-4 text-gray-900 dark:text-gray-100">
            Account Configuration
        </h2>
        <p class="text-gray-500 dark:text-gray-400 mb-6">
            Manage your account settings and preferences.
        </p>
        <div class="space-y-4">
            <div
                class="flex justify-between items-center bg-gray-50 dark:bg-[#1e1e1e] p-4 rounded-lg"
            >
                <span>Email Notifications</span>
                <input type="checkbox" class="toggle" checked />
            </div>
            <div
                class="flex justify-between items-center bg-gray-50 dark:bg-[#1e1e1e] p-4 rounded-lg"
            >
                <span>Data Privacy</span>
                <button
                    class="bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-md text-sm font-medium"
                    >Manage</button
                >
            </div>
        </div>
    </div>
</main>
