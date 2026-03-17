<script lang="ts">
    import type { Snippet } from "svelte";
    import ArrowUp from "lucide-svelte/icons/arrow-up";
    import Plus from "lucide-svelte/icons/plus";

    interface Props {
        value: string;
        placeholder?: string;
        disabled?: boolean;
        isStreaming?: boolean;
        onsubmit: () => void;
        onAttach?: () => void;
        actions?: Snippet;
    }

    let {
        value = $bindable(""),
        placeholder = "Ask anything...",
        disabled = false,
        isStreaming = false,
        onsubmit,
        onAttach,
        actions,
    }: Props = $props();

    let textareaEl: HTMLTextAreaElement | undefined = $state(undefined);

    let canSend = $derived(value.trim().length > 0 && !disabled && !isStreaming);

    function autoResize() {
        if (!textareaEl) return;
        textareaEl.style.height = "auto";
        const maxH = 12 * 24;
        textareaEl.style.height = Math.min(textareaEl.scrollHeight, maxH) + "px";
    }

    export function focus() {
        textareaEl?.focus();
    }

    export function resetHeight() {
        if (textareaEl) textareaEl.style.height = "auto";
    }
</script>

<div
    class="bg-eg-surface border border-eg-border rounded-2xl flex flex-col transition-colors focus-within:border-eg-text-tertiary"
    style="box-shadow: 0 4px 24px rgba(0,0,0,0.25);"
>
    <!-- Textarea -->
    <textarea
        bind:this={textareaEl}
        bind:value
        {placeholder}
        rows="1"
        disabled={disabled || isStreaming}
        class="w-full bg-transparent resize-none outline-none text-eg-text px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-eg-text-tertiary disabled:opacity-50"
        oninput={autoResize}
        onkeydown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onsubmit();
            }
        }}
    ></textarea>

    <!-- Bottom action bar -->
    <div class="flex items-center justify-between px-3 pb-3 pt-1">
        <!-- Left: attach button -->
        <div class="flex items-center">
            <button
                onclick={() => onAttach?.()}
                class="w-8 h-8 flex items-center justify-center rounded-full text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary transition-colors"
                title="Attach file"
            >
                <Plus size={18} />
            </button>
        </div>

        <!-- Right: actions (model selector, toggles) + send -->
        <div class="flex items-center gap-1.5">
            {#if isStreaming}
                <span class="flex items-center gap-1.5 text-xs text-eg-text-tertiary mr-2">
                    <span class="w-2 h-2 bg-eg-success rounded-full animate-pulse"></span>
                    Streaming
                </span>
            {/if}

            {#if actions}
                {@render actions()}
            {/if}

            <button
                onclick={onsubmit}
                disabled={!canSend}
                class="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ml-1
                    {canSend
                    ? 'bg-eg-accent text-eg-accent-text hover:bg-eg-accent-hover'
                    : 'bg-eg-bg-tertiary text-eg-text-tertiary opacity-40'}"
                title="Send (Enter)"
            >
                <ArrowUp size={18} />
            </button>
        </div>
    </div>
</div>
