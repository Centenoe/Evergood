<script lang="ts">
    import {
        ClerkProvider,
        ClerkLoaded,
        ClerkLoading,
    } from "svelte-clerk";
    import { setupConvex } from "convex-svelte";
    import { PUBLIC_CONVEX_URL } from "$env/static/public";
    import Toast from "$lib/components/Toast.svelte";
    import AuthToast from "$lib/components/AuthToast.svelte";
    import ConvexClerkAuth from "$lib/components/ConvexClerkAuth.svelte";
    import { themeStore } from "$lib/stores/theme.svelte";
    import { initHighlighter } from "$lib/utils/markdown";
    import { onMount } from "svelte";
    import "../app.css";

    let { children } = $props();

    setupConvex(PUBLIC_CONVEX_URL);

    onMount(() => {
        themeStore.init();
        initHighlighter();
    });
</script>

<ClerkProvider>
    <Toast />

    <ClerkLoading>
        <div
            class="fixed inset-0 flex items-center justify-center bg-eg-bg"
        >
            <div class="flex flex-col items-center gap-4">
                <div
                    class="w-10 h-10 bg-eg-accent rounded-lg flex items-center justify-center animate-pulse"
                >
                    <span class="text-eg-accent-text font-bold text-lg"
                        >E</span
                    >
                </div>
                <p class="text-sm text-eg-text-tertiary">
                    Loading...
                </p>
            </div>
        </div>
    </ClerkLoading>

    <ClerkLoaded>
        <AuthToast />
        <ConvexClerkAuth />
        {@render children()}
    </ClerkLoaded>
</ClerkProvider>
