<script lang="ts">
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { goto } from "$app/navigation";
    import Search from "lucide-svelte/icons/search";
    import ArrowRight from "lucide-svelte/icons/arrow-right";
    import Paperclip from "lucide-svelte/icons/paperclip";
    import ModelSelector from "$lib/components/ModelSelector.svelte";

    const client = useConvexClient();

    let prompt = $state("");
    let selectedModel = $state("gpt-4o");
    let submitting = $state(false);

    async function handleSubmit() {
        if (!prompt.trim() || submitting) return;

        const userMessage = prompt.trim();
        prompt = "";
        submitting = true;

        try {
            // 1. Create a new session
            const sessionId = await client.mutation(api.sessions.create, {
                model: selectedModel,
            });

            // 2. Send the first message
            await client.mutation(api.messages.send, {
                sessionId,
                content: userMessage,
                model: selectedModel,
            });

            // 3. Navigate to the chat route
            goto(`/chat/${sessionId}`);

            // 4. Trigger AI response (runs in background after navigation)
            client.action(api.ai.chat, {
                sessionId,
                model: selectedModel,
            });

            // 5. Auto-generate title
            client.action(api.ai.generateTitle, {
                sessionId,
            });
        } catch (error) {
            console.error("Failed to create chat:", error);
            submitting = false;
        }
    }

    function fillPrompt(text: string) {
        prompt = text;
    }
</script>

<main
    class="flex-1 flex flex-col relative min-w-0 transition-colors duration-200"
>
    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto px-4 sm:px-10 pb-40">
        <div
            class="max-w-3xl mx-auto w-full h-full flex flex-col justify-center min-h-[60vh]"
        >
            <div class="mb-12">
                <h1
                    class="text-4xl sm:text-5xl font-serif text-gray-900 dark:text-gray-100 font-medium tracking-tight mb-4 flex items-center gap-4"
                >
                    Where knowledge begins
                </h1>
            </div>

            <!-- Main Input Box -->
            <div
                class="bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#444] transition-colors rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] flex flex-col focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-gray-300 dark:focus-within:border-[#555] p-1"
            >
                <textarea
                    bind:value={prompt}
                    placeholder="Ask anything..."
                    rows="3"
                    disabled={submitting}
                    class="w-full bg-transparent resize-none outline-none text-gray-800 dark:text-gray-200 p-4 text-lg placeholder:text-gray-400 dark:placeholder:text-[#666] disabled:opacity-50"
                    onkeydown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                ></textarea>

                <div class="flex items-center justify-between px-3 py-2 mt-2">
                    <!-- Left Action Bar -->
                    <div class="flex items-center gap-2">
                        <ModelSelector
                            selected={selectedModel}
                            onSelect={(m) => (selectedModel = m)}
                        />
                    </div>

                    <!-- Right Action Bar -->
                    <div class="flex items-center gap-1">
                        <button
                            onclick={handleSubmit}
                            disabled={!prompt.trim() || submitting}
                            class="p-2 ml-1 rounded-full transition-all duration-200 shadow-sm disabled:opacity-50 {prompt.trim() &&
                            !submitting
                                ? 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90'
                                : 'bg-gray-100 text-gray-400 dark:bg-[#2d2d2d] dark:text-[#666]'}"
                            title="Submit"
                        >
                            {#if submitting}
                                <div
                                    class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                                ></div>
                            {:else}
                                <ArrowRight size={20} />
                            {/if}
                        </button>
                    </div>
                </div>
            </div>

            <div
                class="mt-8 flex items-center justify-center gap-2 flex-wrap text-sm text-gray-500 dark:text-[#777]"
            >
                <span class="mr-2">Try asking:</span>
                <button
                    onclick={() =>
                        fillPrompt(
                            "How does SvelteKit compare to Next.js?",
                        )}
                    class="bg-[#f0f0f0] dark:bg-[#222] hover:bg-gray-200 dark:hover:bg-[#333] transition-colors px-3 py-1.5 rounded-full border border-gray-200 dark:border-[#333]"
                >
                    How does SvelteKit compare to Next.js?
                </button>
                <button
                    onclick={() =>
                        fillPrompt("Guide to Tailwind CSS v4")}
                    class="bg-[#f0f0f0] dark:bg-[#222] hover:bg-gray-200 dark:hover:bg-[#333] transition-colors px-3 py-1.5 rounded-full border border-gray-200 dark:border-[#333]"
                >
                    Guide to Tailwind CSS v4
                </button>
            </div>
        </div>
    </div>
</main>
