<script lang="ts">
    import { useClerkContext } from "svelte-clerk";
    import { showToast } from "$lib/components/Toast.svelte";
    import { onMount } from "svelte";
    import { page } from "$app/stores";

    const ctx = useClerkContext();

    onMount(() => {
        if (ctx.user) {
            const name =
                ctx.user.primaryEmailAddress?.emailAddress ||
                ctx.user.firstName ||
                "user";
            showToast(`Authenticated as ${name}`, "success", 5000);
        } else {
            showToast("Not authenticated — please sign in", "warning", 5000);
        }
    });
</script>
