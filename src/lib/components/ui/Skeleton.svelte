<script lang="ts">
    interface Props {
        width?: string;
        height?: string;
        rounded?: string;
        class?: string;
    }

    let {
        width = "w-full",
        height = "h-4",
        rounded = "rounded-md",
        class: className = "",
    }: Props = $props();
</script>

<div
    class="animate-pulse bg-eg-bg-tertiary {width} {height} {rounded} {className}"
    aria-hidden="true"
></div>
