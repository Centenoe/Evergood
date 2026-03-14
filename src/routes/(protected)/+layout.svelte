<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";

    let { children } = $props();
</script>

<div
    class="flex h-screen bg-white dark:bg-[#121212] font-sans selection:bg-teal-200/40"
>
    <Sidebar />
    {@render children()}
</div>
