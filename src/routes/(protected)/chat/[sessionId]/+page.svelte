<script lang="ts">
    import { page } from "$app/stores";
    import { useQuery, useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import ChatMessage from "$lib/components/ChatMessage.svelte";
    import ModelSelector from "$lib/components/ModelSelector.svelte";
    import ArrowRight from "lucide-svelte/icons/arrow-right";
    import Search from "lucide-svelte/icons/search";
    import Globe from "lucide-svelte/icons/globe";
    import History from "lucide-svelte/icons/history";
    import { tick } from "svelte";

    const client = useConvexClient();

    // Get sessionId from URL
    let sessionId = $derived($page.params.sessionId);

    // Reactive queries
    const sessionQuery = useQuery(
        api.sessions.get,
        () => (sessionId ? { id: sessionId as any } : "skip"),
    );

    const messagesQuery = useQuery(
        api.messages.list,
        () => (sessionId ? { sessionId: sessionId as any } : "skip"),
    );

    const streamingQuery = useQuery(
        api.messages.getStreamingMessage,
        () => (sessionId ? { sessionId: sessionId as any } : "skip"),
    );

    let prompt = $state("");
    let sending = $state(false);
    let searchEnabled = $state(false);
    let searchPastChats = $state(false);
    let messagesContainer: HTMLDivElement | undefined = $state(undefined);

    // Current model from session
    let currentModel = $derived(sessionQuery.data?.model ?? "gpt-4o");

    // Is currently streaming
    let isStreaming = $derived(streamingQuery.data?.isStreaming === true);

    // Combined messages: all non-streaming + streaming message
    let displayMessages = $derived.by(() => {
        const msgs = messagesQuery.data ?? [];
        return msgs;
    });

    // Auto-scroll to bottom when messages change
    $effect(() => {
        if (displayMessages.length > 0 || streamingQuery.data) {
            tick().then(() => {
                if (messagesContainer) {
                    messagesContainer.scrollTop =
                        messagesContainer.scrollHeight;
                }
            });
        }
    });

    async function handleModelChange(model: string) {
        if (!sessionId) return;
        await client.mutation(api.sessions.updateModel, {
            id: sessionId as any,
            model,
        });
    }

    async function toggleWebSearch() {
        searchEnabled = !searchEnabled;
        if (sessionId) {
            await client.mutation(api.sessions.toggleSearch, {
                id: sessionId as any,
            });
        }
    }

    async function handleSubmit() {
        if (!prompt.trim() || sending || !sessionId) return;

        const userMessage = prompt.trim();
        prompt = "";
        sending = true;

        try {
            // 1. Send user message
            await client.mutation(api.messages.send, {
                sessionId: sessionId as any,
                content: userMessage,
                model: currentModel,
            });

            // 2. Trigger AI chat action (this streams via DB write-back)
            await client.action(api.ai.chat, {
                sessionId: sessionId as any,
                model: currentModel,
                searchPastChats,
            });

            // 3. Auto-generate title on first message
            const msgs = messagesQuery.data;
            if (msgs && msgs.filter((m: { role: string }) => m.role === "user").length <= 1) {
                // Fire-and-forget title generation
                client.action(api.ai.generateTitle, {
                    sessionId: sessionId as any,
                });
            }
        } catch (error) {
            console.error("Chat error:", error);
        } finally {
            sending = false;
        }
    }
</script>

<main
    class="flex-1 flex flex-col relative min-w-0 transition-colors duration-200"
>
    <!-- Chat Toolbar -->
    <div
        class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
    >
        <div class="flex items-center gap-3">
            <ModelSelector
                selected={currentModel}
                onSelect={handleModelChange}
            />
        </div>

        <div class="flex items-center gap-2">
            <!-- Search Past Chats Toggle -->
            <div class="relative group/tip">
                <button
                    onclick={() => (searchPastChats = !searchPastChats)}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border {searchPastChats
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#2a2a2a]'}"
                >
                    <History size={14} />
                    History{searchPastChats ? ": On" : ""}
                </button>
                <div
                    class="absolute right-0 top-full mt-2 w-56 p-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-50 pointer-events-none"
                >
                    <p class="font-medium mb-1">Recall Past Conversations</p>
                    <p class="opacity-80 leading-relaxed">
                        When enabled, the AI searches your previous chats for
                        relevant context and includes it in the current
                        conversation.
                    </p>
                </div>
            </div>

            <!-- Web Search Toggle -->
            <div class="relative group/tip">
                <button
                    onclick={toggleWebSearch}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border {searchEnabled
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#2a2a2a]'}"
                >
                    <Globe size={14} />
                    Search{searchEnabled ? ": On" : ""}
                </button>
                <div
                    class="absolute right-0 top-full mt-2 w-56 p-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-50 pointer-events-none"
                >
                    <p class="font-medium mb-1">Web Search</p>
                    <p class="opacity-80 leading-relaxed">
                        When enabled, the AI can search the web for up-to-date
                        information. Best used with Perplexity's Sonar models.
                    </p>
                </div>
            </div>
        </div>
    </div>

    <!-- Messages Area -->
    <div
        bind:this={messagesContainer}
        class="flex-1 overflow-y-auto px-4 sm:px-10 py-6"
    >
        <div class="max-w-3xl mx-auto w-full">
            {#if messagesQuery.isLoading}
                <div class="flex items-center justify-center py-16">
                    <div
                        class="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>
            {:else if displayMessages.length === 0}
                <div class="flex flex-col items-center justify-center py-16">
                    <div
                        class="w-12 h-12 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center mb-4"
                    >
                        <Search
                            size={20}
                            class="text-gray-400 dark:text-gray-500"
                        />
                    </div>
                    <p class="text-gray-400 dark:text-gray-500 text-sm">
                        Send a message to get started
                    </p>
                </div>
            {:else}
                {#each displayMessages as message (message._id)}
                    <ChatMessage
                        role={message.role as
                            | "user"
                            | "assistant"
                            | "system"}
                        content={message.content}
                        model={message.model}
                        inputTokens={message.inputTokens}
                        outputTokens={message.outputTokens}
                        costUsd={message.costUsd}
                        isStreaming={message.isStreaming}
                    />
                {/each}
            {/if}
        </div>
    </div>

    <!-- Input Area -->
    <div class="px-4 sm:px-10 pb-6 pt-2 bg-white dark:bg-[#121212]">
        <div class="max-w-3xl mx-auto w-full">
            <div
                class="bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#444] transition-colors rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] flex flex-col focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-gray-300 dark:focus-within:border-[#555] p-1"
            >
                <textarea
                    bind:value={prompt}
                    placeholder={isStreaming
                        ? "Waiting for response..."
                        : "Ask anything..."}
                    rows="3"
                    disabled={isStreaming || sending}
                    class="w-full bg-transparent resize-none outline-none text-gray-800 dark:text-gray-200 p-4 text-[15px] placeholder:text-gray-400 dark:placeholder:text-[#666] disabled:opacity-50"
                    onkeydown={(e) => {
                        if (
                            e.key === "Enter" &&
                            !e.shiftKey
                        ) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                ></textarea>

                <div
                    class="flex items-center justify-between px-3 py-2"
                >
                    <div class="flex items-center gap-2 text-xs text-gray-400">
                        {#if isStreaming}
                            <span class="flex items-center gap-1.5">
                                <span
                                    class="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                                ></span>
                                Streaming...
                            </span>
                        {/if}
                    </div>
                    <button
                        onclick={handleSubmit}
                        disabled={!prompt.trim() || isStreaming || sending}
                        class="p-2 rounded-full transition-all duration-200 shadow-sm disabled:opacity-50 {prompt.trim() &&
                        !isStreaming &&
                        !sending
                            ? 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90'
                            : 'bg-gray-100 text-gray-400 dark:bg-[#2d2d2d] dark:text-[#666]'}"
                        title="Submit"
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    </div>
</main>
