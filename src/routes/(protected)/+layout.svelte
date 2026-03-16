<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { tempChatStore } from "$lib/stores/tempChat.svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    let { children } = $props();

    let isMobile = $state(false);
    let resizing = $state(false);
    let startX = 0;
    let startWidth = 0;

    onMount(() => {
        tempChatStore.init();

        function checkMobile() {
            const mobile = window.innerWidth < 1024;
            if (mobile !== isMobile) {
                isMobile = mobile;
                if (mobile) uiStore.closeMobile();
            }
        }
        checkMobile();
        window.addEventListener("resize", checkMobile);

        function handleKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "/") {
                e.preventDefault();
                if (isMobile) {
                    uiStore.toggleMobile();
                } else {
                    uiStore.toggleSidebar();
                }
            }
            // Ctrl/Cmd + Shift + N → open temp chat
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "N") {
                e.preventDefault();
                tempChatStore.start();
                goto("/temp");
            }
        }
        window.addEventListener("keydown", handleKey);

        return () => {
            window.removeEventListener("resize", checkMobile);
            window.removeEventListener("keydown", handleKey);
        };
    });

    function onResizeStart(e: MouseEvent) {
        if (isMobile || uiStore.sidebarCollapsed) return;
        e.preventDefault();
        resizing = true;
        startX = e.clientX;
        startWidth = uiStore.expandedWidth;
        window.addEventListener("mousemove", onResizeMove);
        window.addEventListener("mouseup", onResizeEnd);
    }

    function onResizeMove(e: MouseEvent) {
        const delta = e.clientX - startX;
        uiStore.setSidebarWidth(startWidth + delta);
    }

    function onResizeEnd() {
        resizing = false;
        window.removeEventListener("mousemove", onResizeMove);
        window.removeEventListener("mouseup", onResizeEnd);
    }
</script>

<div
    class="flex h-screen bg-eg-bg font-sans overflow-hidden"
    class:select-none={resizing}
>
    <!-- Mobile overlay backdrop -->
    {#if isMobile && uiStore.mobileOpen}
        <button
            class="fixed inset-0 bg-black/50 z-30"
            onclick={() => uiStore.closeMobile()}
            aria-label="Close sidebar"
        ></button>
    {/if}

    <!-- Mobile sidebar (overlay) -->
    {#if isMobile}
        <div
            class="fixed left-0 top-0 h-full z-40 transition-transform duration-250 ease-in-out {uiStore.mobileOpen ? 'translate-x-0' : '-translate-x-full'}"
            style="width: {uiStore.expandedWidth}px"
        >
            <Sidebar {isMobile} onCloseMobile={() => uiStore.closeMobile()} />
        </div>
    {:else}
        <!-- Desktop sidebar (always visible, collapses to icons) -->
        <div
            class="h-full flex-shrink-0 relative transition-[width] duration-200 ease-in-out"
            style="width: {uiStore.sidebarWidth}px"
        >
            <Sidebar {isMobile} collapsed={uiStore.sidebarCollapsed} />
        </div>

        <!-- Resize handle (only when expanded) -->
        {#if !uiStore.sidebarCollapsed}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div
                role="separator"
                aria-orientation="vertical"
                aria-valuenow={uiStore.sidebarWidth}
                aria-valuemin={200}
                aria-valuemax={400}
                tabindex="-1"
                class="w-1 cursor-col-resize hover:bg-eg-accent/30 active:bg-eg-accent/50 transition-colors flex-shrink-0 z-10"
                onmousedown={onResizeStart}
            ></div>
        {/if}
    {/if}

    <!-- Main content -->
    <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {@render children()}
    </div>
</div>
