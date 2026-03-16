<script lang="ts">
    interface Props {
        value: string;
        label?: string;
        placeholder?: string;
        type?: "text" | "email" | "password" | "search" | "url" | "number";
        disabled?: boolean;
        class?: string;
    }

    let {
        value = $bindable(""),
        label,
        placeholder = "",
        type = "text",
        disabled = false,
        class: className = "",
    }: Props = $props();
</script>

<div class="flex flex-col gap-1.5 {className}">
    {#if label}
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="text-sm font-medium text-eg-text">
            {label}
            <input
                {type}
                {placeholder}
                {disabled}
                bind:value
                class="mt-1.5 block w-full px-3 py-2 text-sm bg-eg-surface border border-eg-border rounded-lg text-eg-text placeholder:text-eg-text-tertiary outline-none focus:border-eg-accent eg-focus-ring disabled:opacity-50 transition-colors"
            />
        </label>
    {:else}
        <input
            {type}
            {placeholder}
            {disabled}
            bind:value
            class="px-3 py-2 text-sm bg-eg-surface border border-eg-border rounded-lg text-eg-text placeholder:text-eg-text-tertiary outline-none focus:border-eg-accent eg-focus-ring disabled:opacity-50 transition-colors"
        />
    {/if}
</div>
