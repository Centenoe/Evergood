<script lang="ts" module>
    import X from "lucide-svelte/icons/x";
    import CircleCheck from "lucide-svelte/icons/circle-check";
    import CircleAlert from "lucide-svelte/icons/circle-alert";
    import TriangleAlert from "lucide-svelte/icons/triangle-alert";
    import Info from "lucide-svelte/icons/info";

    export type ToastType = "success" | "error" | "warning" | "info";

    interface ToastItem {
        id: number;
        message: string;
        type: ToastType;
        duration: number;
        createdAt: number;
        remaining: number;
        paused: boolean;
    }

    let toasts: ToastItem[] = $state([]);
    let nextId = 0;

    export function showToast(
        message: string,
        type: ToastType = "success",
        duration = 30000,
    ) {
        const id = nextId++;
        const toast: ToastItem = {
            id,
            message,
            type,
            duration,
            createdAt: Date.now(),
            remaining: duration,
            paused: false,
        };
        toasts = [...toasts, toast];
    }

    function removeToast(id: number) {
        toasts = toasts.filter((t) => t.id !== id);
    }

    function pauseToast(id: number) {
        const toast = toasts.find((t) => t.id === id);
        if (toast) {
            toast.paused = true;
        }
    }

    function resumeToast(id: number) {
        const toast = toasts.find((t) => t.id === id);
        if (toast) {
            toast.paused = false;
            toast.createdAt = Date.now();
        }
    }
</script>

<script lang="ts">
    $effect(() => {
        if (toasts.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            toasts = toasts.filter((t) => {
                if (t.paused) return true;
                const elapsed = now - t.createdAt;
                t.remaining = Math.max(0, t.remaining - elapsed);
                t.createdAt = now;
                return t.remaining > 0;
            });
        }, 50);

        return () => clearInterval(interval);
    });

    const typeConfig = {
        success: {
            bg: "bg-eg-success/10",
            border: "border-eg-success/20",
            text: "text-eg-text",
            bar: "bg-eg-success",
            iconColor: "text-eg-success",
        },
        error: {
            bg: "bg-eg-danger/10",
            border: "border-eg-danger/20",
            text: "text-eg-text",
            bar: "bg-eg-danger",
            iconColor: "text-eg-danger",
        },
        warning: {
            bg: "bg-eg-warning/10",
            border: "border-eg-warning/20",
            text: "text-eg-text",
            bar: "bg-eg-warning",
            iconColor: "text-eg-warning",
        },
        info: {
            bg: "bg-eg-info/10",
            border: "border-eg-info/20",
            text: "text-eg-text",
            bar: "bg-eg-info",
            iconColor: "text-eg-info",
        },
    };
</script>

{#if toasts.length > 0}
    <div
        class="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
    >
        {#each toasts as t (t.id)}
            {@const config = typeConfig[t.type]}
            {@const progress =
                t.duration > 0 ? (t.remaining / t.duration) * 100 : 0}
            <div
                class="pointer-events-auto w-[380px] max-w-[calc(100vw-3rem)] rounded-xl border shadow-lg backdrop-blur-sm overflow-hidden toast-enter {config.bg} {config.border}"
                role="alert"
                onmouseenter={() => pauseToast(t.id)}
                onmouseleave={() => resumeToast(t.id)}
            >
                <div class="flex items-start gap-3 px-4 py-3">
                    <!-- Icon -->
                    <div class="flex-shrink-0 mt-0.5 {config.iconColor}">
                        {#if t.type === "success"}
                            <CircleCheck size={18} />
                        {:else if t.type === "error"}
                            <CircleAlert size={18} />
                        {:else if t.type === "warning"}
                            <TriangleAlert size={18} />
                        {:else}
                            <Info size={18} />
                        {/if}
                    </div>

                    <!-- Message -->
                    <p
                        class="flex-1 text-sm font-medium leading-snug {config.text}"
                    >
                        {t.message}
                    </p>

                    <!-- Close Button -->
                    <button
                        onclick={() => removeToast(t.id)}
                        class="flex-shrink-0 p-0.5 rounded-md opacity-60 hover:opacity-100 transition-opacity {config.text}"
                        aria-label="Close notification"
                    >
                        <X size={14} />
                    </button>
                </div>

                <!-- Progress Bar -->
                <div class="h-1 w-full bg-eg-border/30">
                    <div
                        class="h-full transition-none {config.bar}"
                        style="width: {progress}%"
                    ></div>
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    @keyframes toastSlideIn {
        from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .toast-enter {
        animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
</style>
