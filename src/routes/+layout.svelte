<script lang="ts">
    import { ClerkProvider, ClerkLoaded, ClerkLoading } from "svelte-clerk";
    import { setupConvex } from "convex-svelte";
    import { PUBLIC_CONVEX_URL } from "$env/static/public";
    import Toast from "$lib/components/Toast.svelte";
    import AuthToast from "$lib/components/AuthToast.svelte";
    import "../app.css";

    let { children } = $props();

    setupConvex(PUBLIC_CONVEX_URL);
</script>

<ClerkProvider>
    <Toast />

    <ClerkLoading>
        <div
            class="fixed inset-0 flex items-center justify-center bg-[#f8f9fa] dark:bg-[#121212]"
        >
            <div class="flex flex-col items-center gap-4">
                <div
                    class="w-10 h-10 bg-black dark:bg-white rounded-lg flex items-center justify-center animate-pulse"
                >
                    <span class="text-white dark:text-black font-bold text-lg"
                        >E</span
                    >
                </div>
                <p class="text-sm text-gray-400 dark:text-gray-500">
                    Loading...
                </p>
            </div>
        </div>
    </ClerkLoading>

    <ClerkLoaded>
        <AuthToast />
        {@render children()}
    </ClerkLoaded>
</ClerkProvider>
