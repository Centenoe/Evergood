<script lang="ts">
    interface Props {
        checked: boolean;
        disabled?: boolean;
        onchange?: (checked: boolean) => void;
        label?: string;
    }

    let { checked = $bindable(false), disabled = false, onchange, label }: Props = $props();

    function toggle() {
        if (disabled) return;
        checked = !checked;
        onchange?.(checked);
    }
</script>

<button
    type="button"
    role="switch"
    aria-checked={checked}
    {disabled}
    onclick={toggle}
    class="inline-flex items-center gap-2.5 {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
>
    <span
        class="relative w-9 h-5 rounded-full transition-colors duration-200 {checked ? 'bg-eg-accent' : 'bg-eg-border'}"
    >
        <span
            class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 {checked ? 'translate-x-4' : ''}"
        ></span>
    </span>
    {#if label}
        <span class="text-sm text-eg-text-secondary">{label}</span>
    {/if}
</button>
