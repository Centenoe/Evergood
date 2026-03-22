<script lang="ts">
    let { children } = $props();
</script>

<div class="flex-1 min-h-0 overflow-y-auto bg-eg-bg">
    <div class="px-4 py-8 sm:px-10">
        {@render children()}
    </div>
</div>