<script lang="ts">
    import { useClerkContext } from "svelte-clerk";
    import { useConvexClient } from "convex-svelte";

    const clerkCtx = useClerkContext();
    const convexClient = useConvexClient();

    // Wire Clerk session tokens into the Convex client.
    // setAuth expects a token-fetcher callback; Convex calls it
    // automatically when it needs fresh/cached tokens.
    $effect(() => {
        // Re-run when session changes (login/logout)
        const session = clerkCtx.session;

        convexClient.setAuth(
            async ({ forceRefreshToken }) => {
                if (!session) return null;
                const token = await session.getToken({
                    template: "convex",
                    skipCache: forceRefreshToken,
                });
                return token ?? null;
            },
            (_isAuthenticated: boolean) => {
                // Auth state synced
            },
        );
    });
</script>
