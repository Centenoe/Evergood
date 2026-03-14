<script lang="ts">
    import X from "lucide-svelte/icons/x";

    interface MessageData {
        _id: string;
        role: string;
        content: string;
        model: string;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        isStreaming?: boolean;
    }

    interface Props {
        messages: MessageData[];
        searchPastChats: boolean;
        searchEnabled: boolean;
        model: string;
    }

    let { messages, searchPastChats, searchEnabled, model }: Props = $props();

    // Compute stats from messages
    let userMessages = $derived(messages.filter(m => m.role === "user"));
    let assistantMessages = $derived(messages.filter(m => m.role === "assistant" && !m.isStreaming));

    let totalInputTokens = $derived(
        messages.reduce((sum, m) => sum + (m.inputTokens ?? 0), 0)
    );
    let totalOutputTokens = $derived(
        messages.reduce((sum, m) => sum + (m.outputTokens ?? 0), 0)
    );
    let totalCost = $derived(
        messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0)
    );

    // Estimate system prompt size (rough heuristic: ~500 chars base + memories)
    let estimatedSystemPromptTokens = $derived(Math.ceil(500 / 4));

    // Estimate total context being sent for the next message
    let estimatedContextTokens = $derived.by(() => {
        // Each message's content length / 4 is a rough token estimate
        let contextTokens = estimatedSystemPromptTokens;
        for (const msg of messages.filter(m => !m.isStreaming)) {
            contextTokens += Math.ceil(msg.content.length / 4);
        }
        return contextTokens;
    });
</script>

<aside
    class="w-[320px] flex-shrink-0 border-l border-gray-200 dark:border-[#2d2d2d] bg-gray-50 dark:bg-[#1a1a1a] overflow-y-auto"
>
    <div class="p-4">
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Debug Info
            </h3>
        </div>

        <!-- Current Model -->
        <div class="mb-4">
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                Active Model
            </div>
            <div class="text-sm font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-[#222] px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333]">
                {model}
            </div>
        </div>

        <!-- Feature Flags -->
        <div class="mb-4">
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                Features
            </div>
            <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs bg-white dark:bg-[#222] px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333]">
                    <span class="text-gray-600 dark:text-gray-400">History Search (Embeddings)</span>
                    <span class="font-medium {searchPastChats ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}">
                        {searchPastChats ? "ON" : "OFF"}
                    </span>
                </div>
                <div class="flex items-center justify-between text-xs bg-white dark:bg-[#222] px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333]">
                    <span class="text-gray-600 dark:text-gray-400">Web Search</span>
                    <span class="font-medium {searchEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}">
                        {searchEnabled ? "ON" : "OFF"}
                    </span>
                </div>
            </div>
        </div>

        <!-- Context Summary -->
        <div class="mb-4">
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                Context Being Sent
            </div>
            <div class="bg-white dark:bg-[#222] rounded-lg border border-gray-200 dark:border-[#333] p-3 space-y-2">
                <div class="flex justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400">System prompt</span>
                    <span class="font-mono text-gray-700 dark:text-gray-300">~{estimatedSystemPromptTokens} tokens</span>
                </div>
                <div class="flex justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400">History messages</span>
                    <span class="font-mono text-gray-700 dark:text-gray-300">{messages.filter(m => !m.isStreaming).length} msgs</span>
                </div>
                <div class="flex justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400">Embedding search</span>
                    <span class="font-mono text-gray-700 dark:text-gray-300">{searchPastChats ? "up to 3 results" : "disabled"}</span>
                </div>
                <div class="border-t border-gray-100 dark:border-[#333] pt-2 flex justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400 font-medium">Est. next input</span>
                    <span class="font-mono font-medium text-gray-800 dark:text-gray-200">~{estimatedContextTokens.toLocaleString()} tokens</span>
                </div>
            </div>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
                The <strong>full conversation history</strong> is sent with each request. When History Search is on, up to 3 similar past exchanges are injected into the system prompt.
            </p>
        </div>

        <!-- Session Totals -->
        <div class="mb-4">
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                Session Totals
            </div>
            <div class="bg-white dark:bg-[#222] rounded-lg border border-gray-200 dark:border-[#333] p-3 space-y-2">
                <div class="flex justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400">Total input tokens</span>
                    <span class="font-mono text-gray-700 dark:text-gray-300">{totalInputTokens.toLocaleString()}</span>
                </div>
                <div class="flex justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400">Total output tokens</span>
                    <span class="font-mono text-gray-700 dark:text-gray-300">{totalOutputTokens.toLocaleString()}</span>
                </div>
                <div class="border-t border-gray-100 dark:border-[#333] pt-2 flex justify-between text-xs">
                    <span class="text-gray-500 dark:text-gray-400 font-medium">Total cost</span>
                    <span class="font-mono font-medium text-gray-800 dark:text-gray-200">${totalCost.toFixed(4)}</span>
                </div>
            </div>
        </div>

        <!-- Per-Message Breakdown -->
        <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                Per-Message Tokens
            </div>
            <div class="space-y-1">
                {#each assistantMessages as msg, i}
                    <div class="bg-white dark:bg-[#222] rounded-lg border border-gray-200 dark:border-[#333] px-3 py-2">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                Response {i + 1}
                            </span>
                            {#if msg.costUsd}
                                <span class="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                                    ${msg.costUsd.toFixed(4)}
                                </span>
                            {/if}
                        </div>
                        <div class="flex gap-3 mt-1 text-[11px]">
                            {#if msg.inputTokens}
                                <span class="text-gray-400">
                                    <span class="font-mono text-gray-600 dark:text-gray-300">{msg.inputTokens.toLocaleString()}</span> in
                                </span>
                            {/if}
                            {#if msg.outputTokens}
                                <span class="text-gray-400">
                                    <span class="font-mono text-gray-600 dark:text-gray-300">{msg.outputTokens.toLocaleString()}</span> out
                                </span>
                            {/if}
                            {#if !msg.inputTokens && !msg.outputTokens}
                                <span class="text-gray-400 italic">No token data</span>
                            {/if}
                        </div>
                    </div>
                {/each}
                {#if assistantMessages.length === 0}
                    <div class="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
                        No responses yet
                    </div>
                {/if}
            </div>
        </div>
    </div>
</aside>
