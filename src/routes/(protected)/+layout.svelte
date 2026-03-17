<script lang="ts">
    import Sidebar from "$lib/components/Sidebar.svelte";
    import { uiStore } from "$lib/stores/ui.svelte";
    import { tempChatStore } from "$lib/stores/tempChat.svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import Menu from "lucide-svelte/icons/menu";

    let { children } = $props();

    let isMobile = $state(false);

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
            // Ctrl/Cmd + / → toggle sidebar on mobile
            if ((e.metaKey || e.ctrlKey) && e.key === "/") {
                e.preventDefault();
                if (isMobile) uiStore.toggleMobile();
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
</script>

<div class="flex h-screen bg-eg-bg font-sans overflow-hidden">
    <!-- Mobile: overlay backdrop -->
    {#if isMobile && uiStore.mobileOpen}
        <button
            class="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
            onclick={() => uiStore.closeMobile()}
            aria-label="Close sidebar"
        ></button>
    {/if}

    {#if isMobile}
        <!-- Mobile: slide-in overlay sidebar -->
        <div
            class="fixed left-0 top-0 h-full z-40 transition-transform duration-250 ease-in-out w-[280px] {uiStore.mobileOpen ? 'translate-x-0' : '-translate-x-full'}"
        >
            <Sidebar {isMobile} onCloseMobile={() => uiStore.closeMobile()} />
        </div>
    {:else}
        <!-- Desktop: fixed sidebar, always visible -->
        <div class="h-full flex-shrink-0 w-[260px]">
            <Sidebar {isMobile} />
        </div>
    {/if}

    <!-- Main content area -->
    <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <!-- Mobile top header with hamburger -->
        {#if isMobile}
            <div class="flex items-center px-4 py-3 border-b border-eg-border/50 bg-eg-bg">
                <button
                    onclick={() => uiStore.openMobile()}
                    class="p-1.5 -ml-1 text-eg-text-secondary hover:text-eg-text rounded-lg transition-colors"
                    aria-label="Open sidebar"
                >
                    <Menu size={20} />
                </button>
                <div class="flex items-center gap-2 ml-3">
                    <div class="w-6 h-6 bg-eg-accent rounded-md flex items-center justify-center">
                        <span class="text-eg-accent-text font-bold text-xs">E</span>
                    </div>
                    <span class="font-semibold text-eg-text tracking-tight">Evergood</span>
                </div>
            </div>
        {/if}

        {@render children()}
    </div>
</div>
