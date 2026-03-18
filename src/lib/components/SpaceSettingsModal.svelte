<script lang="ts">
    import Modal from "$lib/components/ui/Modal.svelte";
    import ConfirmDialog from "$lib/components/ui/ConfirmDialog.svelte";
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { goto } from "$app/navigation";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import X from "lucide-svelte/icons/x";

    interface SpaceData {
        _id: Id<"spaces">;
        name: string;
        description?: string;
        systemPrompt?: string;
        defaultModel?: string;
        webSearchDefault?: string;
    }

    interface Props {
        spaceId: Id<"spaces">;
        open: boolean;
        space: SpaceData;
    }

    let { spaceId, open = $bindable(), space }: Props = $props();

    const client = useConvexClient();

    let systemPrompt = $state("");
    let webSearchDefault = $state("");
    let defaultModel = $state("");
    let saving = $state(false);
    let deleteConfirmOpen = $state(false);

    // Sync local state when space data changes
    $effect(() => {
        if (space) {
            systemPrompt = space.systemPrompt ?? "";
            webSearchDefault = space.webSearchDefault ?? "";
            defaultModel = space.defaultModel ?? "";
        }
    });

    async function save() {
        saving = true;
        try {
            await client.mutation(api.spaces.update, {
                id: spaceId,
                systemPrompt,
                webSearchDefault: webSearchDefault || undefined,
                defaultModel: defaultModel || undefined,
            });
            open = false;
        } catch (error) {
            console.error("Failed to save space settings:", error);
        } finally {
            saving = false;
        }
    }

    async function handleDelete() {
        try {
            await client.mutation(api.spaces.remove, { id: spaceId });
            deleteConfirmOpen = false;
            open = false;
            goto("/spaces");
        } catch (error) {
            console.error("Failed to delete space:", error);
        }
    }

    const webSearchOptions = [
        { value: "", label: "Off" },
        { value: "perplexity", label: "Perplexity" },
        { value: "tavily", label: "Tavily" },
    ];
</script>

<Modal {open} onclose={() => (open = false)}>
    <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-eg-text">Space Settings</h2>
            <button onclick={() => (open = false)} class="p-1 text-eg-text-tertiary hover:text-eg-text rounded-lg transition-colors">
                <X size={18} />
            </button>
        </div>

        <!-- Answer Instructions -->
        <div class="mb-6">
            <label for="system-prompt" class="block text-sm font-medium text-eg-text mb-1.5">Answer Instructions</label>
            <p class="text-xs text-eg-text-tertiary mb-2">Custom system prompt injected into every conversation in this space.</p>
            <textarea
                id="system-prompt"
                bind:value={systemPrompt}
                rows={4}
                placeholder="e.g., Always respond in bullet points. Focus on TypeScript examples."
                class="w-full bg-eg-bg border border-eg-border rounded-lg px-3 py-2 text-sm text-eg-text placeholder-eg-text-tertiary outline-none resize-none focus:border-eg-accent transition-colors"
            ></textarea>
        </div>

        <!-- Web Search Default -->
        <div class="mb-6">
            <label for="web-search" class="block text-sm font-medium text-eg-text mb-1.5">Web Search Default</label>
            <p class="text-xs text-eg-text-tertiary mb-2">Automatically include web search results in every new conversation.</p>
            <select
                id="web-search"
                bind:value={webSearchDefault}
                class="w-full bg-eg-bg border border-eg-border rounded-lg px-3 py-2 text-sm text-eg-text outline-none focus:border-eg-accent transition-colors"
            >
                {#each webSearchOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                {/each}
            </select>
        </div>

        <!-- Default Model -->
        <div class="mb-8">
            <label for="default-model" class="block text-sm font-medium text-eg-text mb-1.5">Default Model</label>
            <p class="text-xs text-eg-text-tertiary mb-2">The model pre-selected for new conversations in this space.</p>
            <input
                id="default-model"
                bind:value={defaultModel}
                placeholder="e.g., gpt-4o"
                class="w-full bg-eg-bg border border-eg-border rounded-lg px-3 py-2 text-sm text-eg-text placeholder-eg-text-tertiary outline-none focus:border-eg-accent transition-colors"
            />
        </div>

        <!-- Save -->
        <button
            onclick={save}
            disabled={saving}
            class="w-full py-2.5 bg-eg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 eg-focus-ring mb-6"
        >
            {saving ? "Saving..." : "Save Settings"}
        </button>

        <!-- Danger Zone -->
        <div class="border-t border-eg-border pt-6">
            <h3 class="text-sm font-medium text-eg-danger mb-2">Danger Zone</h3>
            <p class="text-xs text-eg-text-tertiary mb-3">Deleting a space permanently removes all its conversations, messages, and memories.</p>
            <button
                onclick={() => (deleteConfirmOpen = true)}
                class="flex items-center gap-2 px-4 py-2 text-sm text-eg-danger border border-eg-danger/30 rounded-lg hover:bg-eg-danger/10 transition-colors"
            >
                <Trash2 size={14} />
                Delete Space
            </button>
        </div>
    </div>
</Modal>

<ConfirmDialog
    open={deleteConfirmOpen}
    title="Delete Space?"
    message="This will permanently delete &quot;{space.name}&quot; and all its conversations, messages, and memories. This action cannot be undone."
    confirmLabel="Delete Space"
    cancelLabel="Cancel"
    onconfirm={handleDelete}
    oncancel={() => (deleteConfirmOpen = false)}
/>
