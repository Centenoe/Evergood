<script lang="ts">
    import { useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import Brain from "lucide-svelte/icons/brain";
    import Globe from "lucide-svelte/icons/globe";
    import FolderOpen from "lucide-svelte/icons/folder-open";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import ChevronRight from "lucide-svelte/icons/chevron-right";

    interface MessageData {
        _id: string;
        role: string;
        content: string;
        model: string;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        isStreaming?: boolean;
        timestamp?: number;
    }

    interface Props {
        messages: MessageData[];
        searchPastChats: boolean;
        searchEnabled: boolean;
        model: string;
        sessionId?: string;
    }

    let { messages, searchPastChats, searchEnabled, model, sessionId }: Props = $props();

    // Memory data for this session
    const memoriesForSession = useQuery(
        api.memories.listForSession,
        () => sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip"
    );

    // Usage logs for this session
    const usageLogsForSession = useQuery(
        api.usageLogs.listBySession,
        () => sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip"
    );

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

    let estimatedSystemPromptTokens = $derived(Math.ceil(500 / 4));

    let estimatedContextTokens = $derived.by(() => {
        let contextTokens = estimatedSystemPromptTokens;
        for (const msg of messages.filter(m => !m.isStreaming)) {
            contextTokens += Math.ceil(msg.content.length / 4);
        }
        return contextTokens;
    });

    // Memory stats
    let globalMemoryCount = $derived(
        memoriesForSession.data && "global" in memoriesForSession.data
            ? memoriesForSession.data.global.length
            : 0
    );
    let spaceMemoryCount = $derived(
        memoriesForSession.data && "space" in memoriesForSession.data
            ? memoriesForSession.data.space.length
            : 0
    );
    let estimatedMemoryTokens = $derived.by(() => {
        if (!memoriesForSession.data || !("global" in memoriesForSession.data)) return 0;
        const allMems = [...memoriesForSession.data.global, ...memoriesForSession.data.space];
        return Math.ceil(allMems.reduce((sum, m) => sum + m.content.length, 0) / 4);
    });

    // Mini cost dashboard
    let costByModel = $derived.by(() => {
        const map: Record<string, { cost: number; requests: number }> = {};
        for (const msg of assistantMessages) {
            if (!msg.costUsd) continue;
            if (!map[msg.model]) map[msg.model] = { cost: 0, requests: 0 };
            map[msg.model].cost += msg.costUsd;
            map[msg.model].requests++;
        }
        return Object.entries(map).sort((a, b) => b[1].cost - a[1].cost);
    });

    let avgCostPerMessage = $derived(
        assistantMessages.length > 0 ? totalCost / assistantMessages.length : 0
    );

    let costOverTime = $derived.by(() => {
        let running = 0;
        return assistantMessages.map((m, i) => {
            running += m.costUsd ?? 0;
            return { index: i + 1, cumulative: running, individual: m.costUsd ?? 0 };
        });
    });

    // Collapsible sections
    let expandedSections = $state<Set<string>>(new Set(["model", "features", "context", "memory", "cost"]));

    function toggleSection(section: string) {
        const next = new Set(expandedSections);
        if (next.has(section)) next.delete(section);
        else next.add(section);
        expandedSections = next;
    }

    function formatCost(cost: number): string {
        if (cost < 0.01) return `$${cost.toFixed(4)}`;
        return `$${cost.toFixed(4)}`;
    }

    const categoryColors: Record<string, string> = {
        stack: "text-blue-400",
        project: "text-green-400",
        preference: "text-purple-400",
        work: "text-amber-400",
        personal: "text-pink-400",
        goal: "text-teal-400",
    };
</script>

<aside class="w-[340px] flex-shrink-0 border-l border-eg-border bg-eg-bg-secondary overflow-y-auto">
    <div class="p-4">
        <h3 class="text-sm font-semibold text-eg-text mb-4">Debug Info</h3>

        <!-- Active Model -->
        <button onclick={() => toggleSection("model")} class="w-full flex items-center justify-between mb-2 group">
            <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary">Active Model</div>
            {#if expandedSections.has("model")}<ChevronDown size={12} class="text-eg-text-tertiary" />{:else}<ChevronRight size={12} class="text-eg-text-tertiary" />{/if}
        </button>
        {#if expandedSections.has("model")}
            <div class="mb-4">
                <div class="text-sm font-medium text-eg-text bg-eg-surface px-3 py-2 rounded-lg border border-eg-border">{model}</div>
            </div>
        {/if}

        <!-- Features -->
        <button onclick={() => toggleSection("features")} class="w-full flex items-center justify-between mb-2 group">
            <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary">Features</div>
            {#if expandedSections.has("features")}<ChevronDown size={12} class="text-eg-text-tertiary" />{:else}<ChevronRight size={12} class="text-eg-text-tertiary" />{/if}
        </button>
        {#if expandedSections.has("features")}
            <div class="mb-4 space-y-1.5">
                <div class="flex items-center justify-between text-xs bg-eg-surface px-3 py-2 rounded-lg border border-eg-border">
                    <span class="text-eg-text-secondary">History Search</span>
                    <span class="font-medium {searchPastChats ? 'text-eg-success' : 'text-eg-text-tertiary'}">{searchPastChats ? "ON" : "OFF"}</span>
                </div>
                <div class="flex items-center justify-between text-xs bg-eg-surface px-3 py-2 rounded-lg border border-eg-border">
                    <span class="text-eg-text-secondary">Web Search</span>
                    <span class="font-medium {searchEnabled ? 'text-eg-success' : 'text-eg-text-tertiary'}">{searchEnabled ? "ON" : "OFF"}</span>
                </div>
            </div>
        {/if}

        <!-- Memory Info -->
        <button onclick={() => toggleSection("memory")} class="w-full flex items-center justify-between mb-2 group">
            <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary flex items-center gap-1.5">
                <Brain size={10} />
                Memory Context
            </div>
            {#if expandedSections.has("memory")}<ChevronDown size={12} class="text-eg-text-tertiary" />{:else}<ChevronRight size={12} class="text-eg-text-tertiary" />{/if}
        </button>
        {#if expandedSections.has("memory")}
            <div class="mb-4">
                <div class="bg-eg-surface rounded-lg border border-eg-border p-3 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-eg-text-secondary flex items-center gap-1.5">
                            <Globe size={10} />
                            Global memories
                        </span>
                        <span class="font-mono text-eg-text">{globalMemoryCount}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-eg-text-secondary flex items-center gap-1.5">
                            <FolderOpen size={10} />
                            Space memories
                        </span>
                        <span class="font-mono text-eg-text">{spaceMemoryCount}</span>
                    </div>
                    <div class="border-t border-eg-border-subtle pt-2 flex justify-between text-xs">
                        <span class="text-eg-text-secondary font-medium">Est. memory tokens</span>
                        <span class="font-mono font-medium text-eg-text">~{estimatedMemoryTokens.toLocaleString()}</span>
                    </div>
                </div>

                <!-- Memory details -->
                {#if memoriesForSession.data && "global" in memoriesForSession.data}
                    {#if memoriesForSession.data.global.length > 0}
                        <div class="mt-2">
                            <div class="text-[10px] text-eg-text-tertiary mb-1">Global ({memoriesForSession.data.global.length})</div>
                            <div class="space-y-1 max-h-32 overflow-y-auto">
                                {#each memoriesForSession.data.global as mem}
                                    <div class="text-[11px] bg-eg-bg px-2 py-1.5 rounded border border-eg-border-subtle flex items-start gap-1.5">
                                        <span class="font-medium flex-shrink-0 {categoryColors[mem.category] ?? 'text-eg-text-tertiary'}">{mem.category}</span>
                                        <span class="text-eg-text-secondary truncate">{mem.content}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                    {#if memoriesForSession.data.space.length > 0}
                        <div class="mt-2">
                            <div class="text-[10px] text-eg-text-tertiary mb-1">Space ({memoriesForSession.data.space.length})</div>
                            <div class="space-y-1 max-h-32 overflow-y-auto">
                                {#each memoriesForSession.data.space as mem}
                                    <div class="text-[11px] bg-eg-bg px-2 py-1.5 rounded border border-eg-border-subtle flex items-start gap-1.5">
                                        <span class="font-medium flex-shrink-0 {categoryColors[mem.category] ?? 'text-eg-text-tertiary'}">{mem.category}</span>
                                        <span class="text-eg-text-secondary truncate">{mem.content}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {:else if memoriesForSession.isLoading}
                    <div class="mt-2 text-[11px] text-eg-text-tertiary text-center py-2">Loading memories...</div>
                {:else}
                    <div class="mt-2 text-[11px] text-eg-text-tertiary text-center py-2">No memories for this session</div>
                {/if}
            </div>
        {/if}

        <!-- Context Being Sent -->
        <button onclick={() => toggleSection("context")} class="w-full flex items-center justify-between mb-2 group">
            <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary">Context Being Sent</div>
            {#if expandedSections.has("context")}<ChevronDown size={12} class="text-eg-text-tertiary" />{:else}<ChevronRight size={12} class="text-eg-text-tertiary" />{/if}
        </button>
        {#if expandedSections.has("context")}
            <div class="mb-4">
                <div class="bg-eg-surface rounded-lg border border-eg-border p-3 space-y-2">
                    <div class="flex justify-between text-xs">
                        <span class="text-eg-text-secondary">System prompt</span>
                        <span class="font-mono text-eg-text">~{estimatedSystemPromptTokens} tokens</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-eg-text-secondary">Memory injection</span>
                        <span class="font-mono text-eg-text">~{estimatedMemoryTokens} tokens</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-eg-text-secondary">History messages</span>
                        <span class="font-mono text-eg-text">{messages.filter(m => !m.isStreaming).length} msgs</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-eg-text-secondary">Embedding search</span>
                        <span class="font-mono text-eg-text">{searchPastChats ? "up to 3 results" : "disabled"}</span>
                    </div>
                    <div class="border-t border-eg-border-subtle pt-2 flex justify-between text-xs">
                        <span class="text-eg-text-secondary font-medium">Est. next input</span>
                        <span class="font-mono font-medium text-eg-text">~{(estimatedContextTokens + estimatedMemoryTokens).toLocaleString()} tokens</span>
                    </div>
                </div>
                <p class="text-[10px] text-eg-text-tertiary mt-1.5 leading-relaxed">
                    The <strong>full conversation history</strong> + memories are sent with each request.
                </p>
            </div>
        {/if}

        <!-- Mini Cost Dashboard -->
        <button onclick={() => toggleSection("cost")} class="w-full flex items-center justify-between mb-2 group">
            <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary">Session Cost Breakdown</div>
            {#if expandedSections.has("cost")}<ChevronDown size={12} class="text-eg-text-tertiary" />{:else}<ChevronRight size={12} class="text-eg-text-tertiary" />{/if}
        </button>
        {#if expandedSections.has("cost")}
            <div class="mb-4">
                <!-- Session Totals -->
                <div class="bg-eg-surface rounded-lg border border-eg-border p-3 space-y-2 mb-3">
                    <div class="flex justify-between text-xs">
                        <span class="text-eg-text-secondary">Input tokens</span>
                        <span class="font-mono text-eg-text">{totalInputTokens.toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-eg-text-secondary">Output tokens</span>
                        <span class="font-mono text-eg-text">{totalOutputTokens.toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-eg-text-secondary">Avg cost/response</span>
                        <span class="font-mono text-eg-text">{formatCost(avgCostPerMessage)}</span>
                    </div>
                    <div class="border-t border-eg-border-subtle pt-2 flex justify-between text-xs">
                        <span class="text-eg-text-secondary font-medium">Total cost</span>
                        <span class="font-mono font-bold text-eg-warning">{formatCost(totalCost)}</span>
                    </div>
                </div>

                <!-- Cost by Model -->
                {#if costByModel.length > 0}
                    <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary mb-1.5">Cost by Model</div>
                    <div class="space-y-1.5 mb-3">
                        {#each costByModel as [modelName, data]}
                            <div class="bg-eg-surface rounded border border-eg-border px-2.5 py-1.5">
                                <div class="flex justify-between text-[11px] mb-1">
                                    <span class="text-eg-text font-medium truncate">{modelName}</span>
                                    <span class="text-eg-warning font-mono ml-2">{formatCost(data.cost)}</span>
                                </div>
                                <div class="h-1 bg-eg-bg-tertiary rounded-full overflow-hidden">
                                    <div class="h-full bg-eg-accent rounded-full" style="width: {totalCost > 0 ? (data.cost / totalCost) * 100 : 0}%"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Cost Trend (mini sparkline) -->
                {#if costOverTime.length > 1}
                    <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary mb-1.5">Cumulative Cost</div>
                    <div class="bg-eg-surface rounded-lg border border-eg-border p-2">
                        <svg viewBox="0 0 {costOverTime.length * 20 + 10} 50" class="w-full" style="max-height: 50px;">
                            <!-- Background grid -->
                            <line x1="5" y1="45" x2={costOverTime.length * 20 + 5} y2="45" stroke="var(--eg-border-subtle, #1e1e2e)" stroke-width="0.5" />
                            <line x1="5" y1="5" x2={costOverTime.length * 20 + 5} y2="5" stroke="var(--eg-border-subtle, #1e1e2e)" stroke-width="0.5" />
                            <!-- Line -->
                            <polyline
                                fill="none"
                                stroke="var(--eg-accent, #6366f1)"
                                stroke-width="1.5"
                                stroke-linejoin="round"
                                points={costOverTime.map((d, i) => `${i * 20 + 10},${totalCost > 0 ? 45 - (d.cumulative / totalCost) * 38 : 45}`).join(" ")}
                            />
                            <!-- Dots -->
                            {#each costOverTime as d, i}
                                <circle cx={i * 20 + 10} cy={totalCost > 0 ? 45 - (d.cumulative / totalCost) * 38 : 45} r="2" fill="var(--eg-accent, #6366f1)">
                                    <title>Response {d.index}: {formatCost(d.individual)} (total: {formatCost(d.cumulative)})</title>
                                </circle>
                            {/each}
                        </svg>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Per-Message -->
        <button onclick={() => toggleSection("messages")} class="w-full flex items-center justify-between mb-2 group">
            <div class="text-[10px] font-bold uppercase tracking-wider text-eg-text-tertiary">Per-Message Tokens</div>
            {#if expandedSections.has("messages")}<ChevronDown size={12} class="text-eg-text-tertiary" />{:else}<ChevronRight size={12} class="text-eg-text-tertiary" />{/if}
        </button>
        {#if expandedSections.has("messages")}
            <div>
                <div class="space-y-1">
                    {#each assistantMessages as msg, i}
                        <div class="bg-eg-surface rounded-lg border border-eg-border px-3 py-2">
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] font-medium text-eg-text-secondary">Response {i + 1}</span>
                                {#if msg.costUsd}
                                    <span class="text-[10px] font-mono text-eg-warning">{formatCost(msg.costUsd)}</span>
                                {/if}
                            </div>
                            <div class="flex gap-3 mt-1 text-[11px]">
                                {#if msg.inputTokens}
                                    <span class="text-eg-text-tertiary"><span class="font-mono text-eg-text">{msg.inputTokens.toLocaleString()}</span> in</span>
                                {/if}
                                {#if msg.outputTokens}
                                    <span class="text-eg-text-tertiary"><span class="font-mono text-eg-text">{msg.outputTokens.toLocaleString()}</span> out</span>
                                {/if}
                                {#if !msg.inputTokens && !msg.outputTokens}
                                    <span class="text-eg-text-tertiary italic">No token data</span>
                                {/if}
                            </div>
                            <div class="text-[10px] text-eg-text-tertiary mt-0.5 truncate">{msg.model}</div>
                        </div>
                    {/each}
                    {#if assistantMessages.length === 0}
                        <div class="text-xs text-eg-text-tertiary text-center py-3">No responses yet</div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</aside>
