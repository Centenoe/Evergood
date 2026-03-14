<script lang="ts">
</script>

<main class="flex-1 p-10 overflow-auto">
    <h1 class="text-3xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        Settings
    </h1>
    <div
        class="max-w-2xl border border-gray-200 dark:border-gray-800 rounded-xl p-6"
    >
        <h2 class="text-xl font-medium mb-4 text-gray-900 dark:text-gray-100">
            Account Configuration
        </h2>
        <p class="text-gray-500 dark:text-gray-400 mb-6">
            Manage your account settings and preferences.
        </p>
        <div class="space-y-4">
            <div
                class="flex justify-between items-center bg-gray-50 dark:bg-[#1e1e1e] p-4 rounded-lg"
            >
                <span>Email Notifications</span>
                <input type="checkbox" class="toggle" checked />
            </div>
            <div
                class="flex justify-between items-center bg-gray-50 dark:bg-[#1e1e1e] p-4 rounded-lg"
            >
                <span>Data Privacy</span>
                <button
                    class="bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-md text-sm font-medium"
                    >Manage</button
                >
            </div>
        </div>
    </div>
</main>
