<script lang="ts">
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { goto } from "$app/navigation";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import ChatInput from "$lib/components/ChatInput.svelte";


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
            const sessionId = await client.mutation(api.sessions.create, { model: selectedModel });
            await client.mutation(api.messages.send, { sessionId, content: userMessage, model: selectedModel });
            goto(`/chat/${sessionId}`);
            client.action(api.ai.chat, { sessionId, model: selectedModel });
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
                    <ModelSelector selected={selectedModel} onSelect={(m) => (selectedModel = m)} />
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
