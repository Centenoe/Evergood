<script lang="ts">
    import { useConvexClient } from "convex-svelte";
    import { useClerkContext, UserButton } from "svelte-clerk";
    import Toggle from "$lib/components/ui/Toggle.svelte";
    import Tooltip from "$lib/components/ui/Tooltip.svelte";
    import { themeStore, type ThemePreference } from "$lib/stores/theme.svelte";
    import { api } from "$convex/_generated/api";
    import Layers from "lucide-svelte/icons/layers";
    import Search from "lucide-svelte/icons/search";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import SlidersHorizontal from "lucide-svelte/icons/sliders-horizontal";
    import Sparkles from "lucide-svelte/icons/sparkles";
    import ArrowUp from "lucide-svelte/icons/arrow-up";
    import ArrowDown from "lucide-svelte/icons/arrow-down";
    import GripVertical from "lucide-svelte/icons/grip-vertical";
    import { onMount } from "svelte";

    interface ModelInfo {
        id: string;
        label: string;
        provider: string;
        inputCostPer1M: number;
        outputCostPer1M: number;
    }

    type ProviderGroup = "google" | "anthropic" | "perplexity" | "openai" | "others";
    type ModelSection = "core" | "audio" | "image";
    type SortMode = "name" | "input" | "output";

    const client = useConvexClient();
    const clerkCtx = useClerkContext();

    const providerMeta: Record<ProviderGroup, { label: string; accent: string }> = {
        google: { label: "Google", accent: "text-[#6EA8FE]" },
        anthropic: { label: "Anthropic", accent: "text-[#D97706]" },
        perplexity: { label: "Perplexity", accent: "text-[#0EA5E9]" },
        openai: { label: "OpenAI", accent: "text-[#10B981]" },
        others: { label: "Others", accent: "text-eg-text-secondary" },
    };
    const providerOrder = (Object.keys(providerMeta) as ProviderGroup[]).sort((left, right) =>
        providerMeta[left].label.localeCompare(providerMeta[right].label),
    );
    const sectionMeta: Array<{ key: ModelSection; label: string }> = [
        { key: "core", label: "Core" },
        { key: "audio", label: "Audio" },
        { key: "image", label: "Image" },
    ];
    const sortOptions: Array<{ value: SortMode; label: string }> = [
        { value: "name", label: "Name" },
        { value: "input", label: "Cheapest input" },
        { value: "output", label: "Cheapest output" },
    ];

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
    let modelSearch = $state("");
    let loadError = $state("");
    let expandedGroups = $state<Record<ProviderGroup, boolean>>({
        google: false,
        anthropic: false,
        perplexity: false,
        openai: false,
        others: false,
    });
    let sortModes = $state<Record<ProviderGroup, SortMode>>({
        google: "name",
        anthropic: "name",
        perplexity: "name",
        openai: "name",
        others: "name",
    });

    let orderedEnabledModels = $derived(
        modelOrder
            .filter((id) => enabledModelIds.has(id))
            .map((id) => allModels.find((m) => m.id === id))
            .filter((m): m is ModelInfo => m !== undefined),
    );

    let allChecked = $derived(allModels.length > 0 && enabledModelIds.size === allModels.length);
    let noneChecked = $derived(enabledModelIds.size === 0);
    let allGroupsExpanded = $derived(providerOrder.every((group) => expandedGroups[group]));
    let accountEmail = $derived(
        clerkCtx.user?.primaryEmailAddress?.emailAddress ??
            clerkCtx.user?.emailAddresses?.[0]?.emailAddress ??
            "No email available",
    );

    function isExplicitOpenAIModel(modelId: string): boolean {
        return (
            modelId.startsWith("openai/") ||
            modelId.startsWith("gpt-") ||
            modelId.startsWith("o1") ||
            modelId.startsWith("o3") ||
            modelId.startsWith("o4") ||
            modelId.startsWith("chatgpt-")
        );
    }

    function getProviderGroup(model: ModelInfo): ProviderGroup {
        const modelId = model.id.toLowerCase();
        if (model.provider === "google" || modelId.startsWith("google/") || modelId.startsWith("gemini")) {
            return "google";
        }
        if (model.provider === "anthropic" || modelId.startsWith("anthropic/") || modelId.startsWith("claude-")) {
            return "anthropic";
        }
        if (model.provider === "perplexity" || modelId.startsWith("perplexity/") || modelId.startsWith("sonar")) {
            return "perplexity";
        }
        if (model.provider === "openai" && isExplicitOpenAIModel(modelId)) {
            return "openai";
        }
        return "others";
    }

    function matchesModelSearch(model: ModelInfo, group: ProviderGroup): boolean {
        const query = modelSearch.trim().toLowerCase();
        if (!query) return true;
        return (
            model.label.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query) ||
            providerMeta[group].label.toLowerCase().includes(query)
        );
    }

    function getModelSection(model: ModelInfo): ModelSection {
        const haystack = `${model.id} ${model.label}`.toLowerCase();
        if (
            ["gpt-image", "dall", "image", "vision", "flux", "midjourney", "render", "visual"].some((token) =>
                haystack.includes(token),
            )
        ) {
            return "image";
        }
        if (
            ["audio", "speech", "tts", "transcription", "transcribe", "whisper", "voice"].some((token) =>
                haystack.includes(token),
            )
        ) {
            return "audio";
        }
        return "core";
    }

    function hasKnownPricing(model: ModelInfo): boolean {
        return model.inputCostPer1M > 0 || model.outputCostPer1M > 0;
    }

    function compareModels(left: ModelInfo, right: ModelInfo, sortMode: SortMode): number {
        if (sortMode === "name") {
            return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
        }

        const leftPriced = hasKnownPricing(left);
        const rightPriced = hasKnownPricing(right);
        if (leftPriced !== rightPriced) return leftPriced ? -1 : 1;

        const leftValue = sortMode === "input" ? left.inputCostPer1M : left.outputCostPer1M;
        const rightValue = sortMode === "input" ? right.inputCostPer1M : right.outputCostPer1M;

        if (leftValue !== rightValue) return leftValue - rightValue;

        const fallbackValue = sortMode === "input" ? left.outputCostPer1M - right.outputCostPer1M : left.inputCostPer1M - right.inputCostPer1M;
        if (fallbackValue !== 0) return fallbackValue;

        return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
    }

    function formatPricing(model: ModelInfo): string {
        if (!hasKnownPricing(model)) return "No pricing listed";
        return `$${model.inputCostPer1M.toFixed(2)} in / $${model.outputCostPer1M.toFixed(2)} out per 1M`;
    }

    let groupedModels = $derived.by(() =>
        providerOrder.map((group) => {
            const models = allModels.filter((model) => {
                const providerGroup = getProviderGroup(model);
                return providerGroup === group && matchesModelSearch(model, providerGroup);
            });

            const sections = sectionMeta
                .map((section) => {
                    const sectionModels = models
                        .filter((model) => getModelSection(model) === section.key)
                        .slice()
                        .sort((left, right) => compareModels(left, right, sortModes[group]));

                    return {
                        key: section.key,
                        label: section.label,
                        models: sectionModels,
                    };
                })
                .filter((section) => section.models.length > 0);

            return {
                key: group,
                label: providerMeta[group].label,
                accent: providerMeta[group].accent,
                models,
                sections,
                sortMode: sortModes[group],
            };
        }),
    );

    function syncModelOrder(nextEnabled: Set<string>) {
        // Remove IDs no longer enabled, append newly enabled IDs at the end
        const existingOrder = modelOrder.filter((id) => nextEnabled.has(id));
        const missing = [...nextEnabled].filter((id) => !existingOrder.includes(id));
        const next = [...existingOrder, ...missing];
        modelOrder = next;
        localStorage.setItem("evergood-model-order", JSON.stringify(next));
    }

    function toggleModel(modelId: string) {
        const next = new Set(enabledModelIds);
        if (next.has(modelId)) next.delete(modelId);
        else next.add(modelId);
        enabledModelIds = next;
        localStorage.setItem("evergood-enabled-models", JSON.stringify([...next]));
        syncModelOrder(next);
    }

    function selectAll() {
        const next = new Set(allModels.map((model) => model.id));
        enabledModelIds = next;
        localStorage.setItem("evergood-enabled-models", JSON.stringify([...next]));
        syncModelOrder(next);
    }

    function deselectAll() {
        const next = new Set<string>();
        enabledModelIds = next;
        localStorage.setItem("evergood-enabled-models", JSON.stringify([]));
        syncModelOrder(next);
    }

    function moveModel(fromIdx: number, toIdx: number) {
        if (toIdx < 0 || toIdx >= modelOrder.length) return;
        const next = [...modelOrder];
        const [item] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, item);
        modelOrder = next;
        localStorage.setItem("evergood-model-order", JSON.stringify(next));
    }

    function moveModelUp(idx: number) {
        moveModel(idx, idx - 1);
    }

    function moveModelDown(idx: number) {
        moveModel(idx, idx + 1);
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
            moveModel(draggedIdx, dragOverIdx);
        }
        draggedIdx = null;
        dragOverIdx = null;
    }

    function handleDragEnd() {
        draggedIdx = null;
        dragOverIdx = null;
    }

    function toggleGroup(group: ProviderGroup) {
        expandedGroups = {
            ...expandedGroups,
            [group]: !expandedGroups[group],
        };
    }

    function setAllGroups(expanded: boolean) {
        expandedGroups = {
            google: expanded,
            anthropic: expanded,
            perplexity: expanded,
            openai: expanded,
            others: expanded,
        };
    }

    function toggleAllGroups() {
        setAllGroups(!allGroupsExpanded);
    }

    function updateSortMode(group: ProviderGroup, value: string) {
        if (value !== "name" && value !== "input" && value !== "output") return;
        sortModes = {
            ...sortModes,
            [group]: value,
        };
    }

    function getProviderColor(modelId: string): string {
        const id = modelId.toLowerCase();
        if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4") || id.startsWith("chatgpt-") || id.startsWith("openai/")) return "bg-provider-openai";
        if (id.startsWith("claude-") || id.startsWith("anthropic/")) return "bg-provider-anthropic";
        if (id.startsWith("sonar") || id.startsWith("perplexity/")) return "bg-provider-perplexity";
        return "bg-eg-text-tertiary";
    }

    function handleModelRowKeydown(event: KeyboardEvent, modelId: string) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleModel(modelId);
    }

    function setThemePreference(preference: ThemePreference) {
        themeStore.setPreference(preference);
    }

    $effect(() => {
        const query = modelSearch.trim();
        if (!query) return;

        const nextExpanded = { ...expandedGroups };
        let changed = false;
        for (const providerGroup of groupedModels) {
            if (providerGroup.models.length > 0 && !nextExpanded[providerGroup.key]) {
                nextExpanded[providerGroup.key] = true;
                changed = true;
            }
        }

        if (changed) {
            expandedGroups = nextExpanded;
        }
    });

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
        <p class="mt-2 text-sm text-eg-text-secondary">Manage your account details, appearance preferences, and visible model list.</p>
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
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <GripVertical size={20} class="text-eg-warning" />
                    <h2 class="text-xl font-medium text-eg-text">Model Order</h2>
                </div>
                <p class="text-sm text-eg-text-secondary">Drag or use arrows to reorder how models appear in the chat selector. Requires models to be enabled in Visible Models.</p>
            </div>
        </div>

        {#if modelsLoading}
            <div class="flex justify-center py-10">
                <div class="h-6 w-6 rounded-full border-2 border-eg-border border-t-transparent animate-spin"></div>
            </div>
        {:else if orderedEnabledModels.length === 0}
            <div class="rounded-xl border border-eg-border-subtle bg-eg-bg-secondary px-4 py-8 text-center text-sm text-eg-text-tertiary">
                No models enabled. Enable models in Visible Models to reorder them here.
            </div>
        {:else}
            <div class="space-y-1.5">
                {#each orderedEnabledModels as model, idx}
                    <div
                        role="listitem"
                        draggable="true"
                        ondragstart={() => handleDragStart(idx)}
                        ondragover={(e) => handleDragOver(idx, e)}
                        ondrop={handleDrop}
                        ondragend={handleDragEnd}
                        class="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors cursor-grab active:cursor-grabbing select-none
                            {dragOverIdx === idx && draggedIdx !== idx ? 'border-eg-accent bg-eg-accent/10' : 'border-eg-border-subtle bg-eg-bg-secondary hover:bg-eg-bg-tertiary'}"
                    >
                        <!-- Drag handle — hidden on mobile -->
                        <span class="hidden md:flex text-eg-text-tertiary flex-shrink-0" aria-hidden="true">
                            <GripVertical size={16} />
                        </span>

                        <!-- Order number -->
                        <span class="text-xs text-eg-text-tertiary tabular-nums w-5 flex-shrink-0 text-right">{idx + 1}</span>

                        <!-- Provider dot -->
                        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 {getProviderColor(model.id)}"></span>

                        <!-- Label -->
                        <span class="flex-1 min-w-0 text-sm text-eg-text truncate">{model.label}</span>

                        <!-- Arrow buttons -->
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button
                                onclick={() => moveModelUp(idx)}
                                disabled={idx === 0}
                                class="p-1 rounded-md text-eg-text-tertiary hover:text-eg-text hover:bg-eg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Move {model.label} up"
                            >
                                <ArrowUp size={14} />
                            </button>
                            <button
                                onclick={() => moveModelDown(idx)}
                                disabled={idx === orderedEnabledModels.length - 1}
                                class="p-1 rounded-md text-eg-text-tertiary hover:text-eg-text hover:bg-eg-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Move {model.label} down"
                            >
                                <ArrowDown size={14} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>

    <section class="rounded-2xl border border-eg-border bg-eg-surface p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <Layers size={20} class="text-eg-info" />
                    <h2 class="text-xl font-medium text-eg-text">Visible Models</h2>
                </div>
                <p class="text-sm text-eg-text-secondary">Filter which models appear in selectors. Unknown providers are grouped under Others by design.</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick={selectAll} disabled={allChecked} class="rounded-lg px-3 py-1.5 text-xs font-medium text-eg-text-secondary transition-colors hover:text-eg-text disabled:opacity-40">Select All</button>
                <button onclick={deselectAll} disabled={noneChecked} class="rounded-lg px-3 py-1.5 text-xs font-medium text-eg-text-secondary transition-colors hover:text-eg-text disabled:opacity-40">Deselect All</button>
            </div>
        </div>

        <div class="mt-5 rounded-xl border border-eg-border-subtle bg-eg-bg-secondary p-3">
            <div class="flex items-center gap-2">
                <div class="relative flex-1">
                    <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-eg-text-tertiary" />
                    <input
                        bind:value={modelSearch}
                        placeholder="Search models, ids, or providers..."
                        class="w-full rounded-lg border border-eg-border bg-eg-bg px-10 py-2.5 text-sm text-eg-text outline-none transition-colors placeholder:text-eg-text-tertiary focus:border-eg-accent"
                    />
                </div>
                <Tooltip text={allGroupsExpanded ? 'Collapse all' : 'Expand all'} position="top">
                    {#snippet children()}
                        <button
                            type="button"
                            onclick={toggleAllGroups}
                            aria-label={allGroupsExpanded ? 'Collapse all sections' : 'Expand all sections'}
                            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-eg-border bg-eg-bg text-eg-text-secondary transition-colors hover:bg-eg-bg-tertiary hover:text-eg-text"
                        >
                            <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                                <path d="M7 9l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                                <path d="M7 15l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                            </svg>
                        </button>
                    {/snippet}
                </Tooltip>
            </div>
        </div>

        {#if modelsLoading}
            <div class="flex justify-center py-10">
                <div class="h-6 w-6 rounded-full border-2 border-eg-border border-t-transparent animate-spin"></div>
            </div>
        {:else if loadError}
            <div class="mt-5 rounded-xl border border-eg-danger/30 bg-eg-danger/10 px-4 py-3 text-sm text-eg-danger">{loadError}</div>
        {:else}
            <div class="mt-5 space-y-3">
                {#each groupedModels as providerGroup}
                    {#if providerGroup.models.length > 0}
                        <div class="overflow-hidden rounded-2xl border border-eg-border-subtle bg-eg-bg-secondary">
                            <button
                                onclick={() => toggleGroup(providerGroup.key)}
                                class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-eg-bg-tertiary"
                            >
                                <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-eg-border bg-eg-bg">
                                    {#if providerGroup.key === 'google'}
                                        <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                                            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>
                                            <path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                                        </svg>
                                    {:else if providerGroup.key === 'anthropic'}
                                        <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                                            <path d="M6 18 12 6l6 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
                                        </svg>
                                    {:else if providerGroup.key === 'perplexity'}
                                        <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                                            <path d="M6 8h12M6 12h12M6 16h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                                        </svg>
                                    {:else if providerGroup.key === 'openai'}
                                        <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                                            <path d="M12 4 18 8v8l-6 4-6-4V8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
                                        </svg>
                                    {:else}
                                        <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                                            <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                                            <circle cx="12" cy="5" r="2" fill="currentColor"></circle>
                                            <circle cx="19" cy="12" r="2" fill="currentColor"></circle>
                                            <circle cx="12" cy="19" r="2" fill="currentColor"></circle>
                                            <circle cx="5" cy="12" r="2" fill="currentColor"></circle>
                                        </svg>
                                    {/if}
                                </span>
                                <div class="min-w-0 flex-1">
                                    <div class="text-sm font-medium text-eg-text {providerGroup.accent}">{providerGroup.label}</div>
                                    <div class="text-xs text-eg-text-tertiary">{providerGroup.models.length} visible option{providerGroup.models.length === 1 ? '' : 's'}</div>
                                </div>
                                <ChevronDown size={16} class="text-eg-text-tertiary transition-transform {expandedGroups[providerGroup.key] ? 'rotate-180' : ''}" />
                            </button>

                            {#if expandedGroups[providerGroup.key]}
                                <div class="space-y-4 border-t border-eg-border-subtle px-3 py-3">
                                    <div class="flex flex-col gap-3 rounded-xl border border-eg-border-subtle bg-eg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-eg-text-tertiary">Sort provider models</div>
                                            <p class="mt-1 text-xs text-eg-text-tertiary">Reorder this provider by name or the lowest listed input or output price.</p>
                                        </div>
                                        <label class="flex items-center gap-2 text-sm text-eg-text-secondary">
                                            <span>Sort by</span>
                                            <select
                                                value={providerGroup.sortMode}
                                                onchange={(event) => updateSortMode(providerGroup.key, event.currentTarget.value)}
                                                class="rounded-lg border border-eg-border bg-eg-bg-secondary px-3 py-2 text-sm text-eg-text outline-none transition-colors focus:border-eg-accent"
                                            >
                                                {#each sortOptions as option}
                                                    <option value={option.value}>{option.label}</option>
                                                {/each}
                                            </select>
                                        </label>
                                    </div>

                                    {#each providerGroup.sections as section}
                                        <div class="space-y-2">
                                            <div class="flex items-center justify-between px-1">
                                                <div class="text-xs font-semibold uppercase tracking-[0.18em] text-eg-text-tertiary">{section.label}</div>
                                                <div class="text-xs text-eg-text-tertiary">{section.models.length}</div>
                                            </div>

                                            {#each section.models as model}
                                                <div
                                                    role="button"
                                                    tabindex="0"
                                                    aria-pressed={enabledModelIds.has(model.id)}
                                                    onclick={() => toggleModel(model.id)}
                                                    onkeydown={(event) => handleModelRowKeydown(event, model.id)}
                                                    class="flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-eg-accent/40 {enabledModelIds.has(model.id) ? 'border-eg-accent/30 bg-eg-accent/5 hover:bg-eg-accent/10' : 'border-eg-border-subtle bg-eg-bg hover:bg-eg-bg-tertiary'}"
                                                >
                                                    <div class="min-w-0 flex-1">
                                                        <div class="text-sm font-medium text-eg-text break-words">{model.label}</div>
                                                        <div class="mt-1 text-[11px] text-eg-text-tertiary">{formatPricing(model)}</div>
                                                    </div>
                                                    <Toggle checked={enabledModelIds.has(model.id)} onchange={() => toggleModel(model.id)} />
                                                </div>
                                            {/each}
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}

                {#if groupedModels.every((providerGroup) => providerGroup.models.length === 0)}
                    <div class="rounded-xl border border-eg-border-subtle bg-eg-bg-secondary px-4 py-8 text-center text-sm text-eg-text-tertiary">No models match your search.</div>
                {/if}
            </div>
        {/if}
    </section>
</div>