<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        open: boolean;
        onclose: () => void;
        children: Snippet;
    }

    let { open, onclose, children }: Props = $props();

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onclose();
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) onclose();
    }
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onclick={handleBackdropClick}
    >
        <div
            class="bg-eg-surface border border-eg-border rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
        >
            {@render children()}
        </div>
    </div>
{/if}
