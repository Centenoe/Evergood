<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        variant?: "primary" | "secondary" | "ghost" | "danger";
        size?: "sm" | "md" | "lg";
        disabled?: boolean;
        type?: "button" | "submit" | "reset";
        onclick?: (e: MouseEvent) => void;
        children: Snippet;
        class?: string;
    }

    let {
        variant = "primary",
        size = "md",
        disabled = false,
        type = "button",
        onclick,
        children,
        class: className = "",
    }: Props = $props();

    const variantClasses: Record<string, string> = {
        primary: "bg-eg-accent text-eg-accent-text hover:bg-eg-accent-hover",
        secondary: "bg-eg-surface text-eg-text border border-eg-border hover:bg-eg-bg-tertiary",
        ghost: "text-eg-text-secondary hover:bg-eg-bg-tertiary hover:text-eg-text",
        danger: "bg-eg-danger text-white hover:opacity-90",
    };

    const sizeClasses: Record<string, string> = {
        sm: "px-2.5 py-1 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-2.5 text-base",
    };
</script>

<button
    {type}
    {disabled}
    {onclick}
    class="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 eg-focus-ring disabled:opacity-50 disabled:pointer-events-none {variantClasses[variant]} {sizeClasses[size]} {className}"
>
    {@render children()}
</button>
