<script lang="ts">
    import { UserButton } from "svelte-clerk";
    import Settings from "lucide-svelte/icons/settings";
    import Plus from "lucide-svelte/icons/plus";
    import Moon from "lucide-svelte/icons/moon";
    import Sun from "lucide-svelte/icons/sun";
    import MessageSquare from "lucide-svelte/icons/message-square";
    import { page } from "$app/stores";
    import { onMount } from "svelte";

    let theme = $state("light");

    function toggleTheme() {
        theme = theme === "light" ? "dark" : "light";
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }

    onMount(() => {
        if (
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
            theme = "dark";
            document.documentElement.classList.add("dark");
        }
    });
</script>

<aside
    class="w-[260px] h-full flex-shrink-0 bg-[#f7f7f8] dark:bg-[#1a1a1a] border-r border-[#e5e5e5] dark:border-[#2d2d2d] flex flex-col transition-colors duration-200"
>
    <!-- Top Area -->
    <div class="p-4 flex flex-col h-full">
        <!-- Logo -->
        <a
            href="/"
            class="flex items-center gap-2 mb-6 px-2 hover:opacity-80 transition-opacity"
        >
            <div
                class="w-7 h-7 bg-black dark:bg-white rounded-md flex items-center justify-center"
            >
                <span class="text-white dark:text-black font-bold text-sm"
                    >E</span
                >
            </div>
            <span
                class="font-medium text-lg tracking-tight text-gray-900 dark:text-gray-100"
                >Evergood</span
            >
        </a>

        <!-- New Thread Button -->
        <a
            href="/"
            class="flex items-center gap-2 w-full bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-[#3d3d3d] hover:border-gray-300 dark:hover:border-[#4d4d4d] text-gray-900 dark:text-gray-100 px-4 py-2.5 rounded-lg shadow-sm transition-all duration-200 font-medium mb-8"
        >
            <Plus size={18} class="text-gray-500 dark:text-gray-400" />
            <span>New Thread</span>
        </a>

        <!-- Chat History (Placeholder) -->
        <div class="flex-1 overflow-y-auto">
            <div
                class="text-xs font-semibold text-gray-500 dark:text-[#888] mb-3 px-2 uppercase tracking-wide"
            >
                Today
            </div>
            <div class="space-y-1">
                <button
                    class="w-full text-left px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors truncate flex items-center gap-2"
                >
                    <MessageSquare
                        size={16}
                        class="text-gray-400 dark:text-[#888] flex-shrink-0"
                    />
                    How to configure Vite with Tailwind v4
                </button>
                <button
                    class="w-full text-left px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors truncate flex items-center gap-2"
                >
                    <MessageSquare
                        size={16}
                        class="text-gray-400 dark:text-[#888] flex-shrink-0"
                    />
                    Explain Next.js Server Actions
                </button>
            </div>
        </div>

        <!-- Bottom Area -->
        <div
            class="mt-auto pt-4 border-t border-gray-200 dark:border-[#2d2d2d] space-y-2"
        >
            <!-- Theme Toggle -->
            <button
                onclick={toggleTheme}
                class="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors"
            >
                <span class="flex items-center gap-2">
                    {#if theme === "light"}
                        <Moon size={18} />
                    {:else}
                        <Sun size={18} />
                    {/if}
                    Theme
                </span>
                <span class="text-xs text-gray-400 capitalize">{theme}</span>
            </button>

            <!-- Settings -->
            <a
                href="/settings"
                class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#e5e5e5] dark:hover:bg-[#2d2d2d] rounded-md transition-colors {$page
                    .url.pathname === '/settings'
                    ? 'bg-[#e5e5e5] dark:bg-[#2d2d2d] font-medium text-black dark:text-white'
                    : ''}"
            >
                <Settings size={18} />
                <span>Settings</span>
            </a>

            <!-- User Auth Profile -->
            <div
                class="w-full flex items-center gap-3 px-3 py-2.5 mt-2 overflow-hidden h-12"
            >
                <UserButton afterSignOutUrl="/sign-in" />
                <span
                    class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1"
                    >My Account</span
                >
            </div>
        </div>
    </div>
</aside>
