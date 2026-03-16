<script lang="ts">
	import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
	import X from 'lucide-svelte/icons/x';
	import { tempChatStore } from '$lib/stores/tempChat.svelte';
	import { goto } from '$app/navigation';

	function endTempChat() {
		tempChatStore.end();
		goto('/');
	}
</script>

{#if tempChatStore.active}
	<div
		class="flex items-center justify-between px-4 py-2 bg-eg-warning/10 border-b border-eg-warning/30"
	>
		<div class="flex items-center gap-2 text-sm text-eg-warning font-medium">
			<AlertTriangle size={15} />
			<span>Temp Chat — messages are <strong>not saved</strong> and will be lost when you close this tab</span>
		</div>
		<button
			onclick={endTempChat}
			class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-eg-warning hover:text-eg-text hover:bg-eg-warning/20 rounded-md transition-colors"
			title="End temp chat"
		>
			<X size={14} />
			End
		</button>
	</div>
{/if}
