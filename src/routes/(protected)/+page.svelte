<script lang="ts">
    import { useConvexClient, useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { goto } from "$app/navigation";
    import ChatInput from "$lib/components/ChatInput.svelte";
    import ChatInputActions from "$lib/components/ChatInputActions.svelte";
    import { onMount } from "svelte";


    const client = useConvexClient();
    const userPreferencesQuery = useQuery(api.userPreferences.get, () => ({}));

    let prompt = $state("");
    let selectedModel = $state("gpt-5-nano");
    let submitting = $state(false);
    let enableThinking = $state(false);
    let modelSupportsThinking = $state(false);
    let selectedModelTouched = $state(false);
    let searchProvider = $state<"off" | "perplexity" | "tavily">("off");
    let searchPastChats = $state(false);
    let providers = $state<{ perplexity: boolean; tavily: boolean }>({ perplexity: false, tavily: false });

    onMount(async () => {
        try {
            const p = await client.action(api.providers.getAvailable, {});
            providers = { perplexity: p.perplexity, tavily: p.tavily };
        } catch {
            // Silently fail
        }
    });

    $effect(() => {
        if (!selectedModelTouched && userPreferencesQuery.data?.defaultModel) {
            selectedModel = userPreferencesQuery.data.defaultModel;
        }
    });

    // Sync default search preferences
    $effect(() => {
        if (userPreferencesQuery.data?.defaultSearchProvider) {
            searchProvider = (userPreferencesQuery.data.defaultSearchProvider as "off" | "perplexity" | "tavily") ?? "off";
        }
        if (userPreferencesQuery.data?.defaultSearchPastChats !== undefined) {
            searchPastChats = userPreferencesQuery.data.defaultSearchPastChats;
        }
    });

    // Reset thinking toggle when model doesn't support it
    $effect(() => {
        if (!modelSupportsThinking) enableThinking = false;
    });

    async function handleSubmit() {
        if (!prompt.trim() || submitting) return;
        const userMessage = prompt.trim();
        prompt = "";
        submitting = true;

        try {
            const sessionId = await client.mutation(api.sessions.create, {
                model: selectedModel,
                searchProvider,
                searchPastChats,
            });
            await client.mutation(api.messages.send, { sessionId, content: userMessage, model: selectedModel });
            goto(`/chat/${sessionId}`);
            client.action(api.ai.chat, {
                sessionId,
                model: selectedModel,
                searchPastChats,
                searchProvider: searchProvider !== "off" ? searchProvider : undefined,
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
            <div class="mb-10 text-center">
                <h1 class="text-4xl sm:text-5xl font-serif text-eg-text font-medium tracking-tight">
                    evergood
                </h1>
            </div>

            <!-- Input -->
            <ChatInput bind:value={prompt} disabled={submitting} onsubmit={handleSubmit}>
                {#snippet actions()}
                    <ChatInputActions
                        model={selectedModel}
                        onModelChange={(m) => {
                            selectedModelTouched = true;
                            selectedModel = m;
                        }}
                        bind:modelSupportsThinking
                        bind:enableThinking
                        {searchProvider}
                        onSearchProviderChange={(p) => (searchProvider = p)}
                        {searchPastChats}
                        onSearchPastChatsToggle={() => (searchPastChats = !searchPastChats)}
                        {providers}
                    />
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
