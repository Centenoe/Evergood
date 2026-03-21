<script lang="ts">
    import Bot from "lucide-svelte/icons/bot";
    import Brain from "lucide-svelte/icons/brain";
    import Braces from "lucide-svelte/icons/braces";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import ChevronUp from "lucide-svelte/icons/chevron-up";
    import Globe from "lucide-svelte/icons/globe";
    import ExternalLink from "lucide-svelte/icons/external-link";
    import FileText from "lucide-svelte/icons/file-text";
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
    let rawResponseCopied = $state(false);
    let sanitizedResponseCopied = $state(false);

    const COPY_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    const DOWNLOAD_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>';
    const SUCCESS_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    const LANGUAGE_EXTENSIONS: Record<string, string> = {
        bash: "sh",
        c: "c",
        "c++": "cpp",
        cpp: "cpp",
        css: "css",
        go: "go",
        html: "html",
        java: "java",
        javascript: "js",
        js: "js",
        json: "json",
        jsx: "jsx",
        markdown: "md",
        md: "md",
        php: "php",
        py: "py",
        python: "py",
        ruby: "rb",
        rust: "rs",
        shell: "sh",
        sh: "sh",
        sql: "sql",
        svelte: "svelte",
        text: "txt",
        plaintext: "txt",
        toml: "toml",
        ts: "ts",
        tsx: "tsx",
        typescript: "ts",
        txt: "txt",
        xml: "xml",
        yaml: "yml",
        yml: "yml",
    };

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

    function getNormalizedLanguage(language: string | null | undefined): string {
        const normalized = language?.trim().toLowerCase().replace(/^language-/, "") ?? "";
        return normalized || "text";
    }

    function getSnippetFilename(language: string | null | undefined): string {
        const normalized = getNormalizedLanguage(language);
        const extension = LANGUAGE_EXTENSIONS[normalized] ?? "txt";
        return `snippet.${extension}`;
    }

    function getCodeTextFromWrapper(wrapper: Element | null): string {
        if (!wrapper) return "";
        const codeElement = wrapper.querySelector("pre code") ?? wrapper.querySelector("pre");
        return codeElement?.textContent ?? "";
    }

    async function copyTextToClipboard(text: string): Promise<boolean> {
        if (!text || typeof navigator === "undefined" || !navigator.clipboard) {
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }

    function flashActionButton(
        button: HTMLButtonElement,
        successClass: "copied" | "downloaded",
        idleIcon: string,
    ): void {
        button.classList.add(successClass);
        button.innerHTML = SUCCESS_ICON_SVG;

        window.setTimeout(() => {
            button.classList.remove(successClass);
            button.innerHTML = idleIcon;
        }, 2000);
    }

    function triggerCodeDownload(code: string, language: string | null | undefined): void {
        const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = objectUrl;
        anchor.download = getSnippetFilename(language);
        document.body.append(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
        }, 0);
    }

    function resetResponseCopiedState(kind: "raw" | "sanitized"): void {
        window.setTimeout(() => {
            if (kind === "raw") {
                rawResponseCopied = false;
                return;
            }

            sanitizedResponseCopied = false;
        }, 2000);
    }

    async function handleCopyRawResponse(): Promise<void> {
        const copied = await copyTextToClipboard(content);
        if (!copied) return;

        rawResponseCopied = true;
        resetResponseCopiedState("raw");
    }

    async function handleCopySanitizedResponse(): Promise<void> {
        const copied = await copyTextToClipboard(renderedHtml);
        if (!copied) return;

        sanitizedResponseCopied = true;
        resetResponseCopiedState("sanitized");
    }

    function handleProseClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        const button = target.closest('.code-copy-btn, .download-code-btn') as HTMLButtonElement | null;
        if (!button) return;

        const wrapper = button.closest('.code-block-wrapper');
        const code = getCodeTextFromWrapper(wrapper);
        if (!code) return;

        if (button.classList.contains('code-copy-btn')) {
            copyTextToClipboard(code).then((copied) => {
                if (copied) {
                    flashActionButton(button, 'copied', COPY_ICON_SVG);
                }
            });
            return;
        }

        const language = button.dataset.lang;
        triggerCodeDownload(code, language);
        flashActionButton(button, 'downloaded', DOWNLOAD_ICON_SVG);
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

    // Extract thinking blocks from content
    let thinkingBlocks = $derived.by(() => {
        const blocks: string[] = [];
        const regex = /<think>([\s\S]*?)<\/think>/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            if (match[1].trim()) blocks.push(match[1].trim());
        }
        return blocks;
    });

    // Check if there's an unclosed thinking block (still streaming thinking)
    let isThinkingInProgress = $derived(
        isStreaming === true && /<think>(?!.*<\/think>)/s.test(content)
    );

    // Content without thinking blocks for markdown rendering
    let contentWithoutThinking = $derived(
        content.replace(/<think>[\s\S]*?<\/think>\s*/g, "").replace(/<think>[\s\S]*/g, "")
    );

    let renderedHtml = $derived(
        role === "assistant" ? renderMarkdown(contentWithoutThinking) : "",
    );

    let thinkingOpen = $state(false);</script>

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

                <!-- Thinking block -->
                {#if thinkingBlocks.length > 0 || isThinkingInProgress}
                    <div class="mb-3">
                        <button
                            onclick={() => (thinkingOpen = !thinkingOpen)}
                            class="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            <Brain size={13} />
                            {#if isThinkingInProgress}
                                <span class="thinking-dots">Thinking</span>
                            {:else}
                                <span>{thinkingOpen ? 'Hide' : 'Show'} thinking</span>
                                {#if thinkingOpen}
                                    <ChevronUp size={12} />
                                {:else}
                                    <ChevronDown size={12} />
                                {/if}
                            {/if}
                        </button>
                        {#if thinkingOpen || isThinkingInProgress}
                            <div class="mt-2 pl-3 border-l-2 border-purple-500/30 text-sm text-eg-text-tertiary leading-relaxed whitespace-pre-wrap">
                                {#each thinkingBlocks as block}
                                    <p>{block}</p>
                                {/each}
                                {#if isThinkingInProgress}
                                    {@const unclosed = content.match(/<think>([^]*?)$/)?.[1]?.trim() ?? ""}
                                    {#if unclosed}
                                        <p>{unclosed}</p>
                                    {/if}
                                    <span class="inline-block w-2 h-4 bg-purple-400/50 ml-0.5 animate-pulse rounded-sm"></span>
                                {/if}
                            </div>
                        {/if}
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

                {#if content.trim()}
                    <div class="mt-2 flex items-center gap-1.5">
                        <button
                            type="button"
                            class="eg-tooltip-trigger inline-flex h-7 w-7 items-center justify-center rounded-md text-eg-text/70 transition-colors hover:bg-eg-bg-tertiary hover:text-eg-text"
                            onclick={handleCopyRawResponse}
                            aria-label="Copy raw response"
                            title={rawResponseCopied ? "Copied raw copy" : "Raw Copy"}
                            data-tooltip={rawResponseCopied ? "Copied raw copy" : "Raw Copy"}
                        >
                            <Braces size={14} />
                        </button>
                        <button
                            type="button"
                            class="eg-tooltip-trigger inline-flex h-7 w-7 items-center justify-center rounded-md text-eg-text/70 transition-colors hover:bg-eg-bg-tertiary hover:text-eg-text"
                            onclick={handleCopySanitizedResponse}
                            aria-label="Copy sanitized response"
                            title={sanitizedResponseCopied ? "Copied copy response" : "Copy Response"}
                            data-tooltip={sanitizedResponseCopied ? "Copied copy response" : "Copy Response"}
                        >
                            <FileText size={14} />
                        </button>
                    </div>
                {/if}

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

    /* Thinking dots animation */
    .thinking-dots::after {
        content: '';
        animation: dots 1.5s steps(4, end) infinite;
    }

    @keyframes dots {
        0%, 20% { content: ''; }
        40% { content: '.'; }
        60% { content: '..'; }
        80%, 100% { content: '...'; }
    }
</style>
