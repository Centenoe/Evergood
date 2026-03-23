<script lang="ts">
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { tempChatStore } from '$lib/stores/tempChat.svelte';
	import type { TempMessage } from '$lib/stores/tempChat.svelte';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import ChatInput from '$lib/components/ChatInput.svelte';
	import ChatInputActions from '$lib/components/ChatInputActions.svelte';
	import TokenCostBar from '$lib/components/TokenCostBar.svelte';
	import TempChatBanner from '$lib/components/TempChatBanner.svelte';
	import DebugPanel from '$lib/components/DebugPanel.svelte';
	import { tick, onMount } from 'svelte';

	const client = useConvexClient();
	const userPreferencesQuery = useQuery(api.userPreferences.get, () => ({}));

	let prompt = $state('');
	let sending = $state(false);
	let errorMessage = $state('');
	let messagesContainer: HTMLDivElement | undefined = $state(undefined);
	let tempChatReady = $state(false);
	let enableThinking = $state(false);
	let modelSupportsThinking = $state(false);
	let searchProvider = $state<'off' | 'perplexity' | 'tavily'>('off');
	let searchPastChats = $state(false);
	let debugOpen = $state(false);
	let providers = $state<{ perplexity: boolean; tavily: boolean }>({ perplexity: false, tavily: false });

	onMount(async () => {
		tempChatStore.init();
		tempChatReady = true;
		try {
			const p = await client.action(api.providers.getAvailable, {});
			providers = { perplexity: p.perplexity, tavily: p.tavily };
		} catch {
			// Silently fail
		}
	});

	$effect(() => {
		if (!tempChatReady || userPreferencesQuery.data === undefined) return;
		if (!tempChatStore.active) {
			tempChatStore.start(userPreferencesQuery.data.defaultModel);
		}
	});

	let totalCost = $derived.by(() => {
		let cost = 0;
		for (const msg of tempChatStore.messages) {
			if (msg.costUsd) cost += msg.costUsd;
		}
		return cost;
	});

	let totalInputTokens = $derived.by(() => {
		let t = 0;
		for (const msg of tempChatStore.messages) {
			if (msg.inputTokens) t += msg.inputTokens;
		}
		return t;
	});

	let totalOutputTokens = $derived.by(() => {
		let t = 0;
		for (const msg of tempChatStore.messages) {
			if (msg.outputTokens) t += msg.outputTokens;
		}
		return t;
	});

	$effect(() => {
		if (tempChatStore.messages.length > 0) {
			tick().then(() => {
				if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
			});
		}
	});

	// Reset thinking toggle when model doesn't support it
	$effect(() => {
		if (!modelSupportsThinking) enableThinking = false;
	});

	function handleModelChange(m: string) {
		tempChatStore.setModel(m);
	}

	async function handleSubmit() {
		if (!prompt.trim() || sending) return;
		const userMessage = prompt.trim();
		prompt = '';
		sending = true;
		errorMessage = '';

		tempChatStore.addUserMessage(userMessage);
		const assistantId = tempChatStore.startAssistantMessage();

		try {
			// Call the AI via Convex action — still goes through the LLM,
			// but we handle streaming manually via a temporary session approach.
			// Since temp chats must NOT write to Convex, we call the LLM directly
			// from a Convex action that returns the full response.
			const result = await client.action(api.ai.tempChat, {
				model: tempChatStore.model,
				messages: tempChatStore.messages
					.filter((m: TempMessage) => !m.isStreaming && m.role !== 'assistant' || m.id !== assistantId)
					.filter((m: TempMessage) => m.id !== assistantId)
					.map((m: TempMessage) => ({ role: m.role, content: m.content })),
				searchProvider: searchProvider !== 'off' ? searchProvider : undefined,
				enableThinking: enableThinking || undefined,
			});

			tempChatStore.finishStreaming(assistantId, {
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				costUsd: result.costUsd,
			});
			// Replace content with full response
			tempChatStore.appendContent(assistantId, '');
			// We need to set the full content — modify the store
			const finalMessages = tempChatStore.messages.map((m: TempMessage) =>
				m.id === assistantId ? { ...m, content: result.content } : m,
			);
			// Directly update via finishStreaming already stopped streaming, so just persist
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.setItem(
					'evergood-temp-chat',
					JSON.stringify({
						active: true,
						messages: finalMessages,
						model: tempChatStore.model,
					}),
				);
			}
			// Re-init to pick up the change
			tempChatStore.init();
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'An error occurred';
			tempChatStore.setError(assistantId, msg);
			errorMessage = msg;
		} finally {
			sending = false;
		}
	}
</script>

<main class="flex-1 flex flex-col relative min-w-0 min-h-0 bg-eg-bg">
	<TempChatBanner />

	{#if totalCost > 0}
		<div
			class="flex items-center justify-between px-4 py-1.5 bg-eg-bg-secondary border-b border-eg-border-subtle"
		>
			<TokenCostBar
				inputText=""
				model={tempChatStore.model}
				{totalCost}
				{totalInputTokens}
				{totalOutputTokens}
			/>
			<span class="text-[11px] text-eg-text-tertiary">
				{tempChatStore.messages.filter((m: TempMessage) => m.role === 'assistant' && !m.isStreaming)
					.length} responses
			</span>
		</div>
	{/if}

	<div class="flex flex-1 overflow-hidden">
		<div bind:this={messagesContainer} class="flex-1 overflow-y-auto px-4 sm:px-10 py-6">
			<div class="max-w-3xl mx-auto w-full">
				{#if tempChatStore.messages.length === 0}
					<div class="flex flex-col items-center justify-center py-16">
						<div
							class="w-12 h-12 bg-eg-warning/15 rounded-full flex items-center justify-center mb-4"
						>
							<span class="text-eg-warning text-lg">⚡</span>
						</div>
						<p class="text-eg-text-secondary text-sm font-medium mb-1">Temporary Chat</p>
						<p class="text-eg-text-tertiary text-xs">
							Messages won't be saved. Close the tab to discard.
						</p>
					</div>
				{:else}
					{#each tempChatStore.messages as message (message.id)}
						<ChatMessage
							role={message.role}
							content={message.content}
							model={message.model}
							inputTokens={message.inputTokens}
							outputTokens={message.outputTokens}
							costUsd={message.costUsd}
							isStreaming={message.isStreaming}
						/>
					{/each}
				{/if}
			</div>
		</div>

		{#if debugOpen}
			<DebugPanel
				messages={tempChatStore.messages.map((m) => ({
					_id: m.id,
					role: m.role,
					content: m.content,
					model: m.model,
					inputTokens: m.inputTokens,
					outputTokens: m.outputTokens,
					costUsd: m.costUsd,
					isStreaming: m.isStreaming,
				}))}
				searchPastChats={searchPastChats}
				searchEnabled={searchProvider !== 'off'}
				model={tempChatStore.model}
			/>
		{/if}
	</div>

	<!-- Input -->
	<div class="px-4 sm:px-10 pb-4 pt-2">
		<div class="max-w-3xl mx-auto w-full">
			{#if errorMessage}
				<div
					class="mb-2 px-4 py-2 bg-eg-danger/10 border border-eg-danger/30 rounded-lg text-sm text-eg-danger flex items-center justify-between"
				>
					<span>{errorMessage}</span>
					<button onclick={() => (errorMessage = '')} class="hover:opacity-80 ml-2">&times;</button>
				</div>
			{/if}
			<ChatInput
				bind:value={prompt}
				placeholder={tempChatStore.isStreaming ? 'Waiting for response...' : 'Ask anything...'}
				disabled={sending}
				isStreaming={tempChatStore.isStreaming}
				onsubmit={handleSubmit}
			>
				{#snippet actions()}
					<ChatInputActions
						model={tempChatStore.model}
						onModelChange={handleModelChange}
						bind:modelSupportsThinking
						bind:enableThinking
						{searchProvider}
						onSearchProviderChange={(p) => (searchProvider = p)}
						{searchPastChats}
						onSearchPastChatsToggle={() => (searchPastChats = !searchPastChats)}
						bind:debugOpen
						showDebug={true}
						{providers}
					/>
				{/snippet}
			</ChatInput>
			<div class="mt-1.5 px-1">
				<TokenCostBar
					inputText={prompt}
					model={tempChatStore.model}
					{totalCost}
					{totalInputTokens}
					{totalOutputTokens}
				/>
			</div>
		</div>
	</div>
</main>
