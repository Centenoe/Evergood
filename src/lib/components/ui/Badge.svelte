<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        variant?: "default" | "success" | "warning" | "danger" | "info";
        children: Snippet;
    }

    let { variant = "default", children }: Props = $props();

    const variantClasses: Record<string, string> = {
        default: "bg-eg-bg-tertiary text-eg-text-secondary",
        success: "bg-eg-success/15 text-eg-success",
        warning: "bg-eg-warning/15 text-eg-warning",
        danger: "bg-eg-danger/15 text-eg-danger",
        info: "bg-eg-info/15 text-eg-info",
    };
</script>

<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full {variantClasses[variant]}">
    {@render children()}
</span>
