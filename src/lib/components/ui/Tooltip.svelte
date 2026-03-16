<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        text: string;
        position?: "top" | "bottom" | "left" | "right";
        children: Snippet;
    }

    let { text, position = "top", children }: Props = $props();

    const positionClasses: Record<string, string> = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };
</script>

<div class="relative group/tooltip inline-flex">
    {@render children()}
    <div
        class="absolute {positionClasses[position]} px-2.5 py-1.5 text-xs font-medium bg-eg-surface text-eg-text border border-eg-border rounded-lg shadow-md whitespace-nowrap opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-150 z-50 pointer-events-none"
        role="tooltip"
    >
        {text}
    </div>
</div>
