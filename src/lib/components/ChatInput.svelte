<script lang="ts">
    import type { Snippet } from "svelte";
    import ArrowUp from "lucide-svelte/icons/arrow-up";

    interface Props {
        value: string;
        placeholder?: string;
        disabled?: boolean;
        isStreaming?: boolean;
        onsubmit: () => void;
        actions?: Snippet;
    }

    let {
        value = $bindable(""),
        placeholder = "Ask anything...",
        disabled = false,
        isStreaming = false,
        onsubmit,
        actions,
    }: Props = $props();

    let textareaEl: HTMLTextAreaElement | undefined = $state(undefined);

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
    class="bg-eg-surface border border-eg-border hover:border-eg-text-tertiary transition-colors rounded-2xl flex flex-col focus-within:ring-2 focus-within:ring-[var(--eg-ring)] focus-within:border-eg-accent p-1"
    style="box-shadow: 0 2px 12px var(--eg-shadow);"
>
    <textarea
        bind:this={textareaEl}
        bind:value
        {placeholder}
        rows="1"
        disabled={disabled || isStreaming}
        class="w-full bg-transparent resize-none outline-none text-eg-text p-4 text-[15px] placeholder:text-eg-text-tertiary disabled:opacity-50"
        oninput={autoResize}
        onkeydown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onsubmit();
            }
        }}
    ></textarea>

    <div class="flex items-center justify-between px-3 py-2">
        <div class="flex items-center gap-2 text-xs text-eg-text-tertiary">
            {#if isStreaming}
                <span class="flex items-center gap-1.5">
                    <span class="w-2 h-2 bg-eg-success rounded-full animate-pulse"></span>
                    Streaming...
                </span>
            {/if}
        </div>

        <div class="flex items-center gap-2">
            {#if actions}
                {@render actions()}
            {/if}
            <button
                onclick={onsubmit}
                disabled={!value.trim() || disabled || isStreaming}
                class="p-2 rounded-full transition-all duration-200 disabled:opacity-30 {value.trim() && !disabled && !isStreaming
                    ? 'bg-eg-accent text-eg-accent-text hover:bg-eg-accent-hover'
                    : 'bg-eg-bg-tertiary text-eg-text-tertiary'}"
                title="Send (Enter)"
            >
                <ArrowUp size={18} />
            </button>
        </div>
    </div>
</div>
