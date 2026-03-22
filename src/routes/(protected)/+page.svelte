<script lang="ts">
    import { useConvexClient, useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { goto } from "$app/navigation";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import ChatInput from "$lib/components/ChatInput.svelte";
    import Brain from "lucide-svelte/icons/brain";


    const client = useConvexClient();
    const userPreferencesQuery = useQuery(api.userPreferences.get, () => ({}));

    let prompt = $state("");
    let selectedModel = $state("gpt-5-nano");
    let submitting = $state(false);
    let enableThinking = $state(false);
    let modelSupportsThinking = $state(false);
    let selectedModelTouched = $state(false);

    $effect(() => {
        if (!selectedModelTouched && userPreferencesQuery.data?.defaultModel) {
            selectedModel = userPreferencesQuery.data.defaultModel;
        }
    });

    // Reset thinking toggle when model doesn't support it
    $effect(() => {
        if (!modelSupportsThinking) enableThinking = false;
    });

    async function handleSubmit() {
        if (!prompt.trim() || submitting) return;
        const userMessage = prompt.trim();
        const defaultSearchProvider = userPreferencesQuery.data?.defaultSearchProvider ?? "off";
        const defaultSearchPastChats = userPreferencesQuery.data?.defaultSearchPastChats ?? false;
        prompt = "";
        submitting = true;

        try {
            const sessionId = await client.mutation(api.sessions.create, {
                model: selectedModel,
                searchProvider: defaultSearchProvider,
                searchPastChats: defaultSearchPastChats,
            });
            await client.mutation(api.messages.send, { sessionId, content: userMessage, model: selectedModel });
            goto(`/chat/${sessionId}`);
            client.action(api.ai.chat, {
                sessionId,
                model: selectedModel,
                searchPastChats: defaultSearchPastChats,
                searchProvider: defaultSearchProvider !== "off" ? defaultSearchProvider : undefined,
                enableThinking: enableThinking || undefined,
            });
            client.action(api.ai.generateTitle, { sessionId });
        } catch (error) {
            console.error("Failed to create chat:", error);
            submitting = false;
        }
    }

    function fillPrompt(text: string) {
        prompt = text;
    }
</script>

<main class="flex-1 flex flex-col relative min-w-0 min-h-0 bg-eg-bg">
    <!-- Content — vertically centered, biased toward bottom like Perplexity -->
    <div class="flex-1 flex flex-col items-center justify-end px-4 sm:px-10 pb-[15vh]">
        <div class="max-w-3xl w-full">
            <div class="mb-10">
                <h1 class="text-4xl sm:text-5xl font-serif text-eg-text font-medium tracking-tight mb-3">
                    Where knowledge begins
                </h1>
                <p class="text-lg text-eg-text-secondary">
                    Start a conversation with AI — powered by multiple providers.
                </p>
            </div>

            <!-- Input -->
            <ChatInput bind:value={prompt} disabled={submitting} onsubmit={handleSubmit}>
                {#snippet actions()}
                    <ModelSelector selected={selectedModel} onSelect={(m) => {
                        selectedModelTouched = true;
                        selectedModel = m;
                    }} bind:selectedSupportsThinking={modelSupportsThinking} />

                    {#if modelSupportsThinking}
                        <button
                            onclick={() => (enableThinking = !enableThinking)}
                            class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors
                                {enableThinking ? 'bg-purple-500/15 text-purple-400' : 'text-eg-text-tertiary hover:text-eg-text-secondary hover:bg-eg-bg-tertiary'}"
                            title="Enable extended thinking"
                        >
                            <Brain size={14} />
                            <span class="hidden sm:inline">Think</span>
                        </button>
                    {/if}
                {/snippet}
            </ChatInput>

            <!-- Suggestions -->
            <div class="mt-6 flex items-center justify-center gap-2 flex-wrap text-sm text-eg-text-tertiary">
                <span class="mr-2">Try:</span>
                <button
                    onclick={() => fillPrompt("How does SvelteKit compare to Next.js?")}
                    class="bg-eg-bg-tertiary hover:bg-eg-border transition-colors px-3 py-1.5 rounded-full border border-eg-border text-eg-text-secondary"
                >
                    SvelteKit vs Next.js
                </button>
                <button
                    onclick={() => fillPrompt("Guide to Tailwind CSS v4")}
                    class="bg-eg-bg-tertiary hover:bg-eg-border transition-colors px-3 py-1.5 rounded-full border border-eg-border text-eg-text-secondary"
                >
                    Tailwind v4 Guide
                </button>
                <button
                    onclick={() => fillPrompt("What are the best practices for TypeScript?")}
                    class="bg-eg-bg-tertiary hover:bg-eg-border transition-colors px-3 py-1.5 rounded-full border border-eg-border text-eg-text-secondary"
                >
                    TypeScript Best Practices
                </button>
            </div>
        </div>
    </div>
</main>
