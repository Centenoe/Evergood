<script lang="ts">
    import { SignIn } from "svelte-clerk";
</script>

<div
    class="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa] dark:bg-[#121212] font-sans"
>
    <div class="w-full max-w-md p-6 flex flex-col items-center">
        <!-- Minimal Logo / Header -->
        <div class="mb-8 text-center">
            <div
                class="w-12 h-12 bg-black dark:bg-white rounded-lg flex items-center justify-center mx-auto mb-6"
            >
                <span class="text-white dark:text-black font-bold text-xl"
                    >E</span
                >
            </div>
            <h1
                class="text-[28px] leading-tight font-medium tracking-tight text-gray-900 dark:text-gray-100 mb-2"
            >
                Welcome to Evergood
            </h1>
            <p class="text-base text-gray-500 dark:text-gray-400">
                Sign in to start exploring.
            </p>
        </div>

        <!-- Clerk SignIn Component -->
        <div class="w-full relative z-10 transition-all duration-300">
            <SignIn />
        </div>
    </div>
</div>
