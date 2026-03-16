<script lang="ts">
    interface Props {
        open: boolean;
        title?: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        onconfirm: () => void;
        oncancel: () => void;
    }

    let {
        open,
        title = "Are you sure?",
        message,
        confirmLabel = "Delete",
        cancelLabel = "Cancel",
        onconfirm,
        oncancel,
    }: Props = $props();

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") oncancel();
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) oncancel();
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
            class="bg-eg-surface border border-eg-border rounded-xl shadow-lg max-w-sm w-full p-6"
            role="alertdialog"
            aria-modal="true"
        >
            <h3 class="text-lg font-semibold text-eg-text mb-2">{title}</h3>
            <p class="text-sm text-eg-text-secondary mb-6">{message}</p>
            <div class="flex justify-end gap-3">
                <button
                    onclick={oncancel}
                    class="px-4 py-2 text-sm font-medium text-eg-text-secondary hover:text-eg-text rounded-lg transition-colors"
                >
                    {cancelLabel}
                </button>
                <button
                    onclick={onconfirm}
                    class="px-4 py-2 text-sm font-medium bg-eg-danger text-white rounded-lg hover:opacity-90 transition-colors eg-focus-ring"
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
{/if}
