<script lang="ts">
    import { goto } from "$app/navigation";
    import MoreHorizontal from "lucide-svelte/icons/more-horizontal";
    import Pencil from "lucide-svelte/icons/pencil";
    import Trash2 from "lucide-svelte/icons/trash-2";
    import FolderPlus from "lucide-svelte/icons/folder-plus";
    import FlaskConical from "lucide-svelte/icons/flask-conical";
    import FolderOpen from "lucide-svelte/icons/folder-open";
    import Clock from "lucide-svelte/icons/clock";

    interface SessionWithPreview {
        _id: string;
        title: string;
        model: string;
        lastActiveAt: number;
        messageCount: number;
        spaceId?: string;
        bookmarked?: boolean;
        preview: string | null;
        spaceName?: string;
        spaceIcon?: string;
    }

    interface Props {
        session: SessionWithPreview;
        ondelete: (id: string) => void;
        onrename: (id: string) => void;
        onaddtospace: (id: string) => void;
    }

    let { session, ondelete, onrename, onaddtospace }: Props = $props();

    let menuOpen = $state(false);

    let isDeepResearch = $derived(
        session.model === "sonar-deep-research" || session.title.startsWith("🔬"),
    );

    function formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    function handleCardClick() {
        goto(`/chat/${session._id}`);
    }

    function handleMenuAction(action: () => void) {
        menuOpen = false;
        action();
    }

    function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-menu]")) {
            menuOpen = false;
        }
    }
</script>

<svelte:window onclick={menuOpen ? handleClickOutside : undefined} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="group relative px-5 py-4 border-b border-eg-border/30 hover:bg-eg-bg-tertiary/50 transition-colors cursor-pointer"
    onclick={handleCardClick}
>
    <div class="flex items-start justify-between gap-3">
        <!-- Main content -->
        <div class="flex-1 min-w-0">
            <h3 class="text-sm font-medium text-eg-text truncate">{session.title}</h3>
            {#if session.preview}
                <p class="text-xs text-eg-text-tertiary mt-1 line-clamp-2 leading-relaxed">
                    {session.preview}
                </p>
            {/if}

            <!-- Meta row: pills + timestamp -->
            <div class="flex items-center gap-2 mt-2 flex-wrap">
                {#if isDeepResearch}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-eg-accent/15 text-eg-accent rounded-full">
                        <FlaskConical size={11} />
                        Deep research
                    </span>
                {/if}
                {#if session.spaceId}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-eg-bg-tertiary text-eg-text-secondary rounded-full">
                        {#if session.spaceIcon}
                            <span class="text-xs">{session.spaceIcon}</span>
                        {:else}
                            <FolderOpen size={11} />
                        {/if}
                        {session.spaceName ?? "Space"}
                    </span>
                {/if}
                {#if session.messageCount === 0}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-eg-bg-tertiary text-eg-text-tertiary rounded-full">
                        <Clock size={11} />
                        Empty
                    </span>
                {/if}

                <span class="text-[11px] text-eg-text-tertiary flex items-center gap-1">
                    <Clock size={11} />
                    {formatDate(session.lastActiveAt)}
                </span>
            </div>
        </div>

        <!-- Ellipsis menu -->
        <div class="relative flex-shrink-0" data-menu>
            <button
                onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
                class="p-1.5 text-eg-text-tertiary hover:text-eg-text rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Thread options"
            >
                <MoreHorizontal size={16} />
            </button>

            {#if menuOpen}
                <div class="absolute right-0 top-full mt-1 w-44 bg-eg-surface border border-eg-border rounded-lg shadow-lg z-20 py-1">
                    <button
                        onclick={(e) => { e.stopPropagation(); handleMenuAction(() => onrename(session._id)); }}
                        class="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary transition-colors"
                    >
                        <Pencil size={14} />
                        Rename
                    </button>
                    <button
                        onclick={(e) => { e.stopPropagation(); handleMenuAction(() => onaddtospace(session._id)); }}
                        class="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-eg-text-secondary hover:text-eg-text hover:bg-eg-bg-tertiary transition-colors"
                    >
                        <FolderPlus size={14} />
                        Add to Space
                    </button>
                    <div class="border-t border-eg-border/50 my-1"></div>
                    <button
                        onclick={(e) => { e.stopPropagation(); handleMenuAction(() => ondelete(session._id)); }}
                        class="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-eg-danger hover:bg-eg-danger/10 transition-colors"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>
