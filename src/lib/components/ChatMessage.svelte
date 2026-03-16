<script lang="ts">
    import Bot from "lucide-svelte/icons/bot";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import ChevronUp from "lucide-svelte/icons/chevron-up";
    import Globe from "lucide-svelte/icons/globe";
    import ExternalLink from "lucide-svelte/icons/external-link";
    import X from "lucide-svelte/icons/x";
    import { renderMarkdown } from "$lib/utils/markdown";

    interface Props {
        role: "user" | "assistant" | "system";
        content: string;
        model?: string;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        isStreaming?: boolean;
        citations?: string[];
        searchProvider?: string;
    }

    let {
        role,
        content,
        model,
        inputTokens,
        outputTokens,
        costUsd,
        isStreaming,
        citations,
        searchProvider,
    }: Props = $props();

    let userExpanded = $state(true);
    let showAllSources = $state(false);
    let hoveredCitation = $state<number | null>(null);

    function getProviderColor(modelId: string): string {
        if (
            modelId.startsWith("gpt-") ||
            modelId.startsWith("o1") ||
            modelId.startsWith("o3") ||
            modelId.startsWith("o4") ||
            modelId.startsWith("chatgpt-")
        )
            return "bg-provider-openai";
        if (modelId.startsWith("claude-")) return "bg-provider-anthropic";
        if (modelId.startsWith("sonar")) return "bg-provider-perplexity";
        return "bg-eg-text-tertiary";
    }

    let renderedHtml = $derived(
        role === "assistant" ? renderMarkdown(content) : "",
    );

    function handleProseClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        const btn = target.closest('.code-copy-btn') as HTMLElement | null;
        if (!btn) return;
        const wrapper = btn.closest('.code-block-wrapper');
        const code = wrapper?.querySelector('code');
        if (!code) return;
        navigator.clipboard.writeText(code.textContent ?? '').then(() => {
            btn.classList.add('copied');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
            }, 2000);
        }).catch(() => {});
    }

    function extractDomain(url: string): string {
        try {
            const parsed = new URL(url);
            return parsed.hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    }

    function getFavicon(url: string): string {
        try {
            const parsed = new URL(url);
            return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=16`;
        } catch {
            return '';
        }
    }

    let visibleCitations = $derived(citations?.slice(0, 3) ?? []);
    let extraCitationCount = $derived(Math.max(0, (citations?.length ?? 0) - 3));
</script>

{#if role === "user"}
    <div class="flex justify-end mb-6 px-2">
        <div class="max-w-[80%]">
            <button
                class="flex items-center gap-1.5 text-xs text-eg-text-tertiary mb-1.5 ml-auto hover:text-eg-text-secondary transition-colors"
                onclick={() => (userExpanded = !userExpanded)}
            >
                {#if userExpanded}
                    <ChevronUp size={12} />
                {:else}
                    <ChevronDown size={12} />
                {/if}
                You
            </button>
            {#if userExpanded}
                <div
                    class="bg-eg-bg-tertiary rounded-2xl rounded-tr-md px-5 py-3"
                >
                    <p
                        class="text-eg-text text-[15px] leading-relaxed whitespace-pre-wrap"
                    >
                        {content}
                    </p>
                </div>
            {/if}
        </div>
    </div>
{:else if role === "assistant"}
    <div class="flex justify-start mb-6 px-2">
        <div class="flex items-start gap-3 w-full">
            <div
                class="w-8 h-8 rounded-full bg-eg-accent flex items-center justify-center flex-shrink-0 mt-0.5"
            >
                <Bot size={16} class="text-eg-accent-text" />
            </div>
            <div class="flex-1 min-w-0">
                {#if model}
                    <div class="flex items-center gap-2 mb-1.5">
                        <span
                            class="w-2 h-2 rounded-full {getProviderColor(model)}"
                        ></span>
                        <span
                            class="text-xs font-medium text-eg-text-tertiary"
                        >
                            {model}
                        </span>
                    </div>
                {/if}

                <!-- Rendered markdown -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="prose-eg" onclick={handleProseClick}>
                    {#if isStreaming && !content}
                        <span class="inline-block w-2 h-5 bg-eg-text-tertiary ml-0.5 animate-pulse rounded-sm"></span>
                    {:else}
                        {@html renderedHtml}
                        {#if isStreaming}
                            <span class="inline-block w-2 h-5 bg-eg-text-tertiary ml-0.5 animate-pulse rounded-sm"></span>
                        {/if}
                    {/if}
                </div>

                <!-- Token / cost footer -->
                {#if !isStreaming && (inputTokens || outputTokens || costUsd)}
                    <div
                        class="flex items-center gap-3 mt-3 text-xs text-eg-text-tertiary"
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

                <!-- Citations / Sources -->
                {#if !isStreaming && citations && citations.length > 0}
                    <div class="mt-3 flex items-center gap-2 flex-wrap">
                        <Globe size={13} class="text-eg-text-tertiary flex-shrink-0" />
                        {#each visibleCitations as url, i}
                            <div class="relative" role="group"
                                 onmouseenter={() => (hoveredCitation = i)}
                                 onmouseleave={() => (hoveredCitation = null)}>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-eg-bg-tertiary hover:bg-eg-border border border-eg-border-subtle rounded-full text-xs text-eg-text-secondary hover:text-eg-text transition-colors"
                                >
                                    <img src={getFavicon(url)} alt="" class="w-3.5 h-3.5 rounded-sm" />
                                    <span class="truncate max-w-[120px]">{extractDomain(url)}</span>
                                </a>
                                <!-- Hover preview -->
                                {#if hoveredCitation === i}
                                    <div class="absolute left-0 bottom-full mb-2 w-64 p-3 bg-eg-surface border border-eg-border rounded-lg shadow-lg z-50 pointer-events-none">
                                        <p class="text-xs font-medium text-eg-text truncate mb-1">{extractDomain(url)}</p>
                                        <p class="text-[10px] text-eg-text-tertiary truncate">{url}</p>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                        {#if extraCitationCount > 0}
                            <button
                                onclick={() => (showAllSources = true)}
                                class="inline-flex items-center gap-1 px-2.5 py-1 bg-eg-bg-tertiary hover:bg-eg-border border border-eg-border-subtle rounded-full text-xs text-eg-text-secondary hover:text-eg-text transition-colors"
                            >
                                +{extraCitationCount} more
                            </button>
                        {/if}
                    </div>

                    <!-- All sources panel (desktop: side sheet, mobile: bottom card) -->
                    {#if showAllSources}
                        <!-- Backdrop -->
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div class="fixed inset-0 bg-black/30 z-40" onclick={() => (showAllSources = false)}></div>

                        <!-- Desktop: right sidebar panel -->
                        <div class="hidden lg:block fixed right-0 top-0 h-full w-80 bg-eg-surface border-l border-eg-border z-50 overflow-y-auto">
                            <div class="flex items-center justify-between px-4 py-3 border-b border-eg-border sticky top-0 bg-eg-surface">
                                <h3 class="text-sm font-semibold text-eg-text">Sources ({citations.length})</h3>
                                <button onclick={() => (showAllSources = false)} class="p-1 text-eg-text-tertiary hover:text-eg-text rounded-md">
                                    <X size={16} />
                                </button>
                            </div>
                            <div class="p-3 space-y-2">
                                {#each citations as url, i}
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-center gap-3 px-3 py-2.5 bg-eg-bg-tertiary hover:bg-eg-border rounded-lg transition-colors group"
                                    >
                                        <img src={getFavicon(url)} alt="" class="w-4 h-4 rounded-sm flex-shrink-0" />
                                        <div class="flex-1 min-w-0">
                                            <p class="text-xs font-medium text-eg-text truncate">[{i + 1}] {extractDomain(url)}</p>
                                            <p class="text-[10px] text-eg-text-tertiary truncate">{url}</p>
                                        </div>
                                        <ExternalLink size={12} class="text-eg-text-tertiary group-hover:text-eg-text flex-shrink-0" />
                                    </a>
                                {/each}
                            </div>
                        </div>

                        <!-- Mobile: bottom card -->
                        <div class="lg:hidden fixed bottom-0 left-0 right-0 max-h-[60vh] bg-eg-surface border-t border-eg-border rounded-t-2xl z-50 overflow-y-auto">
                            <div class="flex items-center justify-between px-4 py-3 border-b border-eg-border sticky top-0 bg-eg-surface">
                                <h3 class="text-sm font-semibold text-eg-text">Sources ({citations.length})</h3>
                                <button onclick={() => (showAllSources = false)} class="p-1 text-eg-text-tertiary hover:text-eg-text rounded-md">
                                    <X size={16} />
                                </button>
                            </div>
                            <div class="p-3 space-y-2 pb-safe">
                                {#each citations as url, i}
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="flex items-center gap-3 px-3 py-2.5 bg-eg-bg-tertiary hover:bg-eg-border rounded-lg transition-colors group"
                                    >
                                        <img src={getFavicon(url)} alt="" class="w-4 h-4 rounded-sm flex-shrink-0" />
                                        <div class="flex-1 min-w-0">
                                            <p class="text-xs font-medium text-eg-text truncate">[{i + 1}] {extractDomain(url)}</p>
                                            <p class="text-[10px] text-eg-text-tertiary truncate">{url}</p>
                                        </div>
                                        <ExternalLink size={12} class="text-eg-text-tertiary group-hover:text-eg-text flex-shrink-0" />
                                    </a>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    /* Markdown prose styling using theme vars */
    :global(.prose-eg) {
        color: var(--eg-text);
        font-size: 15px;
        line-height: 1.7;
    }
    :global(.prose-eg p) {
        margin-bottom: 0.75em;
    }
    :global(.prose-eg p:last-child) {
        margin-bottom: 0;
    }
    :global(.prose-eg strong) {
        font-weight: 600;
        color: var(--eg-text);
    }
    :global(.prose-eg em) {
        font-style: italic;
    }
    :global(.prose-eg a) {
        color: var(--eg-accent);
        text-decoration: underline;
        text-underline-offset: 2px;
    }
    :global(.prose-eg a:hover) {
        opacity: 0.8;
    }
    :global(.prose-eg code) {
        background: var(--eg-bg-tertiary);
        padding: 0.15em 0.4em;
        border-radius: 4px;
        font-size: 0.875em;
        font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    }
    :global(.prose-eg pre) {
        background: var(--eg-bg-tertiary);
        border: 1px solid var(--eg-border-subtle);
        border-radius: 8px;
        padding: 1em;
        overflow-x: auto;
        margin: 0.75em 0;
        position: relative;
    }
    :global(.prose-eg pre code) {
        background: none;
        padding: 0;
        font-size: 0.85em;
        line-height: 1.6;
    }
    :global(.prose-eg blockquote) {
        border-left: 3px solid var(--eg-accent);
        padding-left: 1em;
        margin: 0.75em 0;
        color: var(--eg-text-secondary);
    }
    :global(.prose-eg ul),
    :global(.prose-eg ol) {
        padding-left: 1.5em;
        margin: 0.5em 0;
    }
    :global(.prose-eg li) {
        margin-bottom: 0.25em;
    }
    :global(.prose-eg h1),
    :global(.prose-eg h2),
    :global(.prose-eg h3),
    :global(.prose-eg h4) {
        font-weight: 600;
        margin-top: 1.25em;
        margin-bottom: 0.5em;
        color: var(--eg-text);
    }
    :global(.prose-eg h1) { font-size: 1.5em; }
    :global(.prose-eg h2) { font-size: 1.25em; }
    :global(.prose-eg h3) { font-size: 1.1em; }
    :global(.prose-eg hr) {
        border: none;
        border-top: 1px solid var(--eg-border-subtle);
        margin: 1.5em 0;
    }
    :global(.prose-eg table) {
        width: 100%;
        border-collapse: collapse;
        margin: 0.75em 0;
        font-size: 0.9em;
    }
    :global(.prose-eg th),
    :global(.prose-eg td) {
        border: 1px solid var(--eg-border);
        padding: 0.5em 0.75em;
        text-align: left;
    }
    :global(.prose-eg th) {
        background: var(--eg-bg-tertiary);
        font-weight: 600;
    }
    :global(.prose-eg img) {
        max-width: 100%;
        border-radius: 8px;
    }
</style>
