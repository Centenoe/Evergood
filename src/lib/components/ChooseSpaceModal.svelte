<script lang="ts">
    import Modal from "$lib/components/ui/Modal.svelte";
    import { useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import Plus from "lucide-svelte/icons/plus";
    import X from "lucide-svelte/icons/x";

    interface Props {
        open: boolean;
        onclose: () => void;
        onselect: (spaceId: Id<"spaces">) => void;
        oncreatenew: () => void;
    }

    let { open, onclose, onselect, oncreatenew }: Props = $props();

    const spacesQuery = useQuery(api.spaces.list, () => (open ? {} : "skip"));
</script>

<Modal {open} {onclose}>
    <div class="p-6">
        <!-- Header -->
        <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-semibold text-eg-text">Choose Space</h2>
            <button
                onclick={onclose}
                class="p-1 text-eg-text-tertiary hover:text-eg-text rounded-md transition-colors"
                aria-label="Close"
            >
                <X size={18} />
            </button>
        </div>

        <!-- Space list -->
        <div class="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
            <!-- New Space button (persistent at top) -->
            <button
                onclick={oncreatenew}
                class="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-eg-text bg-eg-bg-tertiary hover:bg-eg-accent/10 rounded-lg transition-colors"
            >
                <Plus size={16} class="text-eg-accent" />
                <span>New Space</span>
            </button>

            {#if spacesQuery.isLoading}
                <div class="flex items-center justify-center py-6">
                    <div class="w-5 h-5 border-2 border-eg-border border-t-transparent rounded-full animate-spin"></div>
                </div>
            {:else if spacesQuery.data && spacesQuery.data.length > 0}
                {#each spacesQuery.data as space}
                    <button
                        onclick={() => onselect(space._id)}
                        class="flex items-center gap-3 w-full px-4 py-3 text-sm text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary rounded-lg transition-colors text-left"
                    >
                        {#if space.icon}
                            <span class="text-base flex-shrink-0">{space.icon}</span>
                        {/if}
                        <span class="truncate">{space.name}</span>
                    </button>
                {/each}
            {:else}
                <p class="text-sm text-eg-text-tertiary text-center py-4">No spaces yet</p>
            {/if}
        </div>
    </div>
</Modal>
