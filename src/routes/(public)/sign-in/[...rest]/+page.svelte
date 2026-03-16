<script lang="ts">
    import { SignIn } from "svelte-clerk";
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-eg-bg font-sans">
    <div class="w-full max-w-md p-6 flex flex-col items-center">
        <div class="mb-8 text-center">
            <div class="w-12 h-12 bg-eg-accent rounded-lg flex items-center justify-center mx-auto mb-6">
                <span class="text-eg-accent-text font-bold text-xl">E</span>
            </div>
            <h1 class="text-[28px] leading-tight font-medium tracking-tight text-eg-text mb-2">
                Welcome to Evergood
            </h1>
            <p class="text-base text-eg-text-secondary">
                Sign in to start exploring.
            </p>
        </div>

        <div class="w-full relative z-10 transition-all duration-300">
            <SignIn />
        </div>
    </div>
</div>
