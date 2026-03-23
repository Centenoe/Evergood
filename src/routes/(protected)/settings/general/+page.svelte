<script lang="ts">
    import { useConvexClient } from "convex-svelte";
    import { useClerkContext, UserButton } from "svelte-clerk";
    import { themeStore, type ThemePreference } from "$lib/stores/theme.svelte";
    import { api } from "$convex/_generated/api";
    import Search from "lucide-svelte/icons/search";
    import SlidersHorizontal from "lucide-svelte/icons/sliders-horizontal";
    import Sparkles from "lucide-svelte/icons/sparkles";
    import ArrowUp from "lucide-svelte/icons/arrow-up";
    import ArrowDown from "lucide-svelte/icons/arrow-down";
    import GripVertical from "lucide-svelte/icons/grip-vertical";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import Plus from "lucide-svelte/icons/plus";
    import { onMount } from "svelte";

    interface ModelInfo {
        id: string;
        label: string;
        provider: string;
        inputCostPer1M: number;
        outputCostPer1M: number;
    }

    const client = useConvexClient();
    const clerkCtx = useClerkContext();

    const themeOptions: Array<{ id: ThemePreference; label: string; description: string }> = [
        { id: "light", label: "Light", description: "Always use the light theme." },
        { id: "dark", label: "Dark", description: "Always use the dark theme." },
        { id: "system", label: "System", description: "Follow your device appearance." },
    ];

    let allModels = $state<ModelInfo[]>([]);
    let enabledModelIds = $state<Set<string>>(new Set());
    let modelOrder = $state<string[]>([]);
    let draggedIdx = $state<number | null>(null);
    let dragOverIdx = $state<number | null>(null);
    let modelsLoading = $state(true);
    let loadError = $state("");
    let addModelSearch = $state("");

    let orderedEnabledModels = $derived(
        modelOrder
            .filter((id) => enabledModelIds.has(id))
            .map((id) => allModels.find((m) => m.id === id))
            .filter((m): m is ModelInfo => m !== undefined),
    );

    let showAddResults = $derived(addModelSearch.trim().length > 0);

    let addModelResults = $derived(
        showAddResults
            ? allModels
                  .filter(
                      (m) =>
                          !enabledModelIds.has(m.id) &&
                          (m.label.toLowerCase().includes(addModelSearch.trim().toLowerCase()) ||
                              m.id.toLowerCase().includes(addModelSearch.trim().toLowerCase())),
                  )
                  .slice(0, 8)
            : [],
    );

    let accountEmail = $derived(
        clerkCtx.user?.primaryEmailAddress?.emailAddress ??
            clerkCtx.user?.emailAddresses?.[0]?.emailAddress ??
            "No email available",
    );

    function getProviderColor(modelId: string): string {
        const id = modelId.toLowerCase();
        if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("chatgpt-") || id.startsWith("openai/")) return "bg-provider-openai";
        if (id.startsWith("claude-") || id.startsWith("anthropic/")) return "bg-provider-anthropic";
        if (id.startsWith("sonar") || id.startsWith("perplexity/")) return "bg-provider-perplexity";
        return "bg-eg-text-tertiary";
    }

    function syncModelOrder(nextEnabled: Set<string>) {
        const existingOrder = modelOrder.filter((id) => nextEnabled.has(id));
        const missing = [...nextEnabled].filter((id) => !existingOrder.includes(id));
        const next = [...existingOrder, ...missing];
        modelOrder = next;
        localStorage.setItem("evergood-model-order", JSON.stringify(next));
    }

    function addModel(modelId: string) {
        if (enabledModelIds.has(modelId)) return;
        const next = new Set(enabledModelIds);
        next.add(modelId);
        enabledModelIds = next;
        localStorage.setItem("evergood-enabled-models", JSON.stringify([...next]));
        const nextOrder = [...modelOrder, modelId];
        modelOrder = nextOrder;
        localStorage.setItem("evergood-model-order", JSON.stringify(nextOrder));
        addModelSearch = "";
    }

    function removeModelAtIdx(idx: number) {
        const model = orderedEnabledModels[idx];
        if (!model) return;
        const next = new Set(enabledModelIds);
        next.delete(model.id);
        enabledModelIds = next;
        localStorage.setItem("evergood-enabled-models", JSON.stringify([...next]));
        syncModelOrder(next);
    }

    function moveModelById(fromId: string, toId: string) {
        const fromIdx = modelOrder.indexOf(fromId);
        const toIdx = modelOrder.indexOf(toId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
        const next = [...modelOrder];
        const [item] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, item);
        modelOrder = next;
        localStorage.setItem("evergood-model-order", JSON.stringify(next));
    }

    function moveModelUp(idx: number) {
        const from = orderedEnabledModels[idx];
        const to = orderedEnabledModels[idx - 1];
        if (from && to) moveModelById(from.id, to.id);
    }

    function moveModelDown(idx: number) {
        const from = orderedEnabledModels[idx];
        const to = orderedEnabledModels[idx + 1];
        if (from && to) moveModelById(from.id, to.id);
    }

    function handleDragStart(idx: number) {
        draggedIdx = idx;
    }

    function handleDragOver(idx: number, e: DragEvent) {
        e.preventDefault();
        dragOverIdx = idx;
    }

    function handleDrop() {
        if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
            const from = orderedEnabledModels[draggedIdx];
            const to = orderedEnabledModels[dragOverIdx];
            if (from && to) moveModelById(from.id, to.id);
        }
        draggedIdx = null;
        dragOverIdx = null;
    }

    function handleDragEnd() {
        draggedIdx = null;
        dragOverIdx = null;
    }

    function setThemePreference(preference: ThemePreference) {
        themeStore.setPreference(preference);
    }

    onMount(async () => {
        try {
            allModels = await client.query(api.available_models.listAvailable, {});
            const saved = localStorage.getItem("evergood-enabled-models");
            let enabledIds: string[];
            if (saved) {
                try {
                    enabledIds = JSON.parse(saved);
                    enabledModelIds = new Set(enabledIds);
                } catch {
                    enabledIds = allModels.map((model) => model.id);
                    enabledModelIds = new Set(enabledIds);
                }
            } else {
                enabledIds = allModels.map((model) => model.id);
                enabledModelIds = new Set(enabledIds);
            }

            // Load or initialise model order
            const savedOrder = localStorage.getItem("evergood-model-order");
            if (savedOrder) {
                try {
                    const parsedOrder: string[] = JSON.parse(savedOrder);
                    // Keep only IDs still enabled, append any newly enabled ones
                    const cleaned = parsedOrder.filter((id) => enabledModelIds.has(id));
                    const missing = [...enabledModelIds].filter((id) => !cleaned.includes(id));
                    modelOrder = [...cleaned, ...missing];
                } catch {
                    modelOrder = [...enabledModelIds];
                }
            } else {
                modelOrder = [...enabledModelIds];
            }
            localStorage.setItem("evergood-model-order", JSON.stringify(modelOrder));
        } catch (error) {
            loadError = error instanceof Error ? error.message : "Failed to load available models";
        } finally {
            modelsLoading = false;
        }
    });
</script>

<div class="mx-auto max-w-5xl space-y-8">
    <div>
        <h1 class="text-3xl font-semibold text-eg-text">General Settings</h1>
        <p class="mt-2 text-sm text-eg-text-secondary">Manage your account details, appearance preferences, and model order.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
    <section class="rounded-2xl border border-eg-border bg-eg-surface p-6">
        <div class="flex items-center gap-3 mb-4">
            <Sparkles size={20} class="text-eg-accent" />
            <h2 class="text-xl font-medium text-eg-text">Account</h2>
        </div>
        <div class="flex flex-col gap-4 rounded-xl border border-eg-border-subtle bg-eg-bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
                <p class="text-sm font-medium text-eg-text">Signed in with Clerk</p>
                <p class="mt-1 truncate text-sm text-eg-text-secondary">{accountEmail}</p>
            </div>
            <div class="flex items-center gap-3">
                <UserButton afterSignOutUrl="/sign-in" />
            </div>
        </div>
    </section>

    <section class="rounded-2xl border border-eg-border bg-eg-surface p-6">
        <div class="flex items-center gap-3 mb-4">
            <SlidersHorizontal size={20} class="text-eg-info" />
            <h2 class="text-xl font-medium text-eg-text">Appearance</h2>
        </div>
        <div class="grid gap-3 grid-cols-3">
            {#each themeOptions as option}
                <button
                    onclick={() => setThemePreference(option.id)}
                    class="rounded-xl border px-3 py-3 text-left transition-colors
                        {themeStore.preference === option.id ? 'border-eg-accent bg-eg-accent/10 text-eg-text' : 'border-eg-border bg-eg-bg-secondary text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                >
                    <div class="text-sm font-medium">{option.label}</div>
                    <div class="mt-1 text-xs text-eg-text-tertiary">{option.description}</div>
                </button>
            {/each}
        </div>
    </section>
    </div>

    <section class="rounded-2xl border border-eg-border bg-eg-surface p-6">
        <div class="flex items-center gap-3 mb-2">
            <GripVertical size={20} class="text-eg-warning" />
            <h2 class="text-xl font-medium text-eg-text">Model Order</h2>
        </div>
        <p class="text-sm text-eg-text-secondary mb-5">
            Drag or use arrows to reorder how models appear in the chat selector. Add models here, or enable/disable them on the <a href="/settings/models" class="text-eg-accent hover:underline">Models</a> tab.
        </p>

        <!-- Search to add a model -->
        <div class="relative mb-4">
            <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-eg-text-tertiary z-10 pointer-events-none" />
            <input
                bind:value={addModelSearch}
                placeholder="Add a model..."
                autocomplete="off"
                class="w-full rounded-lg border border-eg-border bg-eg-bg-secondary pl-9 pr-4 py-3 text-sm text-eg-text outline-none transition-colors placeholder:text-eg-text-tertiary focus:border-eg-accent"
            />
            {#if showAddResults}
                <div class="absolute top-full left-0 right-0 mt-1 bg-eg-surface border border-eg-border rounded-xl overflow-hidden z-20 shadow-lg max-h-60 overflow-y-auto">
                    {#if addModelResults.length > 0}
                        {#each addModelResults as model}
                            <button
                                type="button"
                                onclick={() => addModel(model.id)}
                                class="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-eg-bg-tertiary transition-colors text-left"
                            >
                                <span class="w-2 h-2 rounded-full flex-shrink-0 {getProviderColor(model.id)}"></span>
                                <span class="flex-1 min-w-0 text-eg-text truncate">{model.label}</span>
                                <Plus size={14} class="flex-shrink-0 text-eg-text-tertiary" />
                            </button>
                        {/each}
                    {:else}
                        <p class="px-4 py-3 text-sm text-eg-text-tertiary">No models to add matching your search.</p>
                    {/if}
                </div>
            {/if}
        </div>

        {#if modelsLoading}
            <div class="flex justify-center py-10">
                <div class="h-6 w-6 rounded-full border-2 border-eg-border border-t-transparent animate-spin"></div>
            </div>
        {:else if loadError}
            <div class="rounded-xl border border-eg-danger/30 bg-eg-danger/10 px-4 py-3 text-sm text-eg-danger">{loadError}</div>
        {:else if orderedEnabledModels.length === 0}
            <div class="rounded-xl border border-eg-border-subtle bg-eg-bg-secondary px-4 py-8 text-center text-sm text-eg-text-tertiary">
                No models added yet. Use the search above to add models.
            </div>
        {:else}
            <div class="space-y-2">
                {#each orderedEnabledModels as model, idx}
                    <div
                        role="listitem"
                        draggable="true"
                        ondragstart={() => handleDragStart(idx)}
                        ondragover={(e) => handleDragOver(idx, e)}
                        ondrop={handleDrop}
                        ondragend={handleDragEnd}
                        class="flex items-start gap-3 rounded-xl border px-4 py-4 transition-colors cursor-grab active:cursor-grabbing select-none
                            {dragOverIdx === idx && draggedIdx !== idx ? 'border-eg-accent bg-eg-accent/10' : 'border-eg-border-subtle bg-eg-bg-secondary hover:bg-eg-bg-tertiary'}"
                    >
                        <!-- Drag handle — desktop only -->
                        <span class="hidden md:flex text-eg-text-tertiary flex-shrink-0" aria-hidden="true">
                            <GripVertical size={18} />
                        </span>

                        <!-- Order number -->
                        <span class="text-sm text-eg-text-tertiary tabular-nums w-5 flex-shrink-0 text-right mt-0.5">{idx + 1}</span>

                        <!-- Provider dot -->
                        <span class="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 {getProviderColor(model.id)}"></span>

                        <!-- Label -->
                        <span class="flex-1 min-w-0 text-base text-eg-text break-words">{model.label}</span>

                        <!-- Controls -->
                        <div class="flex items-center gap-1 flex-shrink-0 self-start">
                            <button
                                onclick={() => moveModelUp(idx)}
                                disabled={idx === 0}
                                class="p-2.5 rounded-md text-eg-text-tertiary hover:text-eg-text hover:bg-eg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Move {model.label} up"
                            >
                                <ArrowUp size={18} />
                            </button>
                            <button
                                onclick={() => moveModelDown(idx)}
                                disabled={idx === orderedEnabledModels.length - 1}
                                class="p-2.5 rounded-md text-eg-text-tertiary hover:text-eg-text hover:bg-eg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Move {model.label} down"
                            >
                                <ArrowDown size={18} />
                            </button>
                            <button
                                onclick={() => removeModelAtIdx(idx)}
                                class="p-2.5 rounded-md text-eg-text-tertiary hover:text-eg-danger transition-colors"
                                aria-label="Remove {model.label}"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>
</div>