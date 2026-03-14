<script lang="ts">
    import Bot from "lucide-svelte/icons/bot";
    import User from "lucide-svelte/icons/user";

    interface Props {
        role: "user" | "assistant" | "system";
        content: string;
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        isStreaming?: boolean;
    }

    let {
        role,
        content,
        model,
        inputTokens,
        outputTokens,
        costUsd,
        isStreaming,
    }: Props = $props();

    // Provider detection for color dots
    function getProviderColor(modelId: string): string {
        if (
            modelId.startsWith("gpt-") ||
            modelId.startsWith("o1") ||
            modelId.startsWith("o3") ||
            modelId.startsWith("o4") ||
            modelId.startsWith("chatgpt-")
        )
            return "bg-green-500";
        if (modelId.startsWith("claude-")) return "bg-orange-500";
        if (modelId.startsWith("sonar")) return "bg-blue-500";
        return "bg-gray-400";
    }
</script>

{#if role === "user"}
    <div class="flex justify-end mb-6 px-2">
        <div class="flex items-start gap-3 max-w-[80%]">
            <div
                class="bg-gray-100 dark:bg-[#2a2a2a] rounded-2xl rounded-tr-md px-5 py-3"
            >
                <p
                    class="text-gray-900 dark:text-gray-100 text-[15px] leading-relaxed whitespace-pre-wrap"
                >
                    {content}
                </p>
            </div>
            <div
                class="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#333] flex items-center justify-center flex-shrink-0"
            >
                <User size={16} class="text-gray-600 dark:text-gray-400" />
            </div>
        </div>
    </div>
{:else if role === "assistant"}
    <div class="flex justify-start mb-6 px-2">
        <div class="flex items-start gap-3 max-w-[85%]">
            <div
                class="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center flex-shrink-0"
            >
                <Bot size={16} class="text-white dark:text-black" />
            </div>
            <div class="flex-1 min-w-0">
                {#if model}
                    <div class="flex items-center gap-2 mb-1.5">
                        <span
                            class="w-2 h-2 rounded-full {getProviderColor(
                                model,
                            )}"
                        ></span>
                        <span
                            class="text-xs font-medium text-gray-400 dark:text-gray-500"
                        >
                            {model}
                        </span>
                    </div>
                {/if}
                <div
                    class="text-gray-900 dark:text-gray-100 text-[15px] leading-relaxed whitespace-pre-wrap"
                >
                    {content}{#if isStreaming}<span
                            class="inline-block w-2 h-5 bg-gray-400 dark:bg-gray-500 ml-0.5 animate-pulse rounded-sm"
                        ></span>{/if}
                </div>
                {#if !isStreaming && (inputTokens || outputTokens || costUsd)}
                    <div
                        class="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500"
                    >
                        {#if inputTokens}
                            <span>{inputTokens.toLocaleString()} in</span>
                        {/if}
                        {#if outputTokens}
                            <span>{outputTokens.toLocaleString()} out</span>
                        {/if}
                        {#if costUsd}
                            <span>${costUsd.toFixed(4)}</span>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
