<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { renderMarkdown } from '$lib/utils/markdown';
	import FlaskConical from 'lucide-svelte/icons/flask-conical';
	import Globe from 'lucide-svelte/icons/globe';
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import Loader from 'lucide-svelte/icons/loader';
	import Copy from 'lucide-svelte/icons/copy';
	import Check from 'lucide-svelte/icons/check';
	import { onMount } from 'svelte';

	const client = useConvexClient();

	let query = $state('');
	let running = $state(false);
	let errorMessage = $state('');
	let result = $state<{
		content: string;
		citations: string[];
		inputTokens: number;
		outputTokens: number;
		costUsd: number;
	} | null>(null);
	let copied = $state(false);

	let perplexityAvailable = $state(false);

	onMount(async () => {
		try {
			const providers = await client.action(api.providers.getAvailable, {});
			perplexityAvailable = providers.perplexity;
		} catch {
			// Silently fail
		}
	});

	let renderedContent = $derived(result ? renderMarkdown(result.content) : '');

	/** Extract table of contents from markdown headings */
	let tocEntries = $derived.by(() => {
		if (!result) return [];
		const headingRegex = /^(#{1,4})\s+(.+)$/gm;
		const entries: Array<{ level: number; text: string; id: string }> = [];
		let match;
		while ((match = headingRegex.exec(result.content)) !== null) {
			const level = match[1].length;
			const text = match[2].trim();
			const id = text
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, '')
				.replace(/\s+/g, '-');
			entries.push({ level, text, id });
		}
		return entries;
	});

	function extractDomain(url: string): string {
		try {
			const parsed = new URL(url);
			return parsed.hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	function getFavicon(url: string): string {
		try {
			const parsed = new URL(url);
			return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=16`;
		} catch {
			return '';
		}
	}

	async function runResearch() {
		if (!query.trim() || running) return;
		running = true;
		errorMessage = '';
		result = null;

		try {
			result = await client.action(api.research.run, {
				query: query.trim(),
			});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Research failed';
		} finally {
			running = false;
		}
	}

	async function copyContent() {
		if (!result) return;
		await navigator.clipboard.writeText(result.content);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<main class="flex-1 flex flex-col min-w-0 min-h-0 bg-eg-bg overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-eg-border bg-eg-bg">
		<div class="flex items-center gap-3">
			<div class="w-8 h-8 bg-eg-accent/15 rounded-lg flex items-center justify-center">
				<FlaskConical size={18} class="text-eg-accent" />
			</div>
			<div>
				<h1 class="text-lg font-semibold text-eg-text">Deep Research</h1>
				<p class="text-xs text-eg-text-tertiary">Powered by Perplexity Sonar Deep Research</p>
			</div>
		</div>
		{#if result}
			<button
				onclick={copyContent}
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-eg-surface border border-eg-border rounded-lg hover:bg-eg-bg-tertiary transition-colors text-eg-text-secondary"
			>
				{#if copied}
					<Check size={14} class="text-eg-success" />
					Copied
				{:else}
					<Copy size={14} />
					Copy
				{/if}
			</button>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto">
		{#if !result && !running}
			<!-- Research Input -->
			<div class="flex flex-col items-center justify-center px-4 sm:px-8 pt-[12vh] pb-8">
				<div class="max-w-2xl w-full">
					<div class="mb-8 text-center">
						<FlaskConical size={40} class="mx-auto text-eg-accent mb-4" />
						<h2 class="text-2xl sm:text-3xl font-serif text-eg-text font-medium tracking-tight mb-2">
							Deep Research
						</h2>
						<p class="text-eg-text-secondary text-sm">
							Ask a complex question and get a comprehensive, well-cited research document.
						</p>
					</div>

					{#if !perplexityAvailable}
						<div
							class="mb-6 px-4 py-3 bg-eg-warning/10 border border-eg-warning/30 rounded-lg text-sm text-eg-warning"
						>
							PERPLEXITY_API_KEY required. Add it in the Convex Dashboard to enable Deep Research.
						</div>
					{/if}

					<div class="relative">
						<textarea
							bind:value={query}
							placeholder="What would you like to research? e.g., 'Compare leading AI frameworks for production use in 2026'"
							rows={4}
							disabled={!perplexityAvailable}
							class="w-full px-4 py-3 bg-eg-surface border border-eg-border rounded-xl text-eg-text text-sm placeholder:text-eg-text-tertiary resize-none focus:border-eg-accent focus:ring-1 focus:ring-eg-accent/30 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							onkeydown={(e) => {
								if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									runResearch();
								}
							}}
						></textarea>
					</div>

					<div class="flex items-center justify-between mt-3">
						<p class="text-xs text-eg-text-tertiary">
							{#if query.trim()}
								Press <kbd class="px-1.5 py-0.5 bg-eg-bg-tertiary border border-eg-border-subtle rounded text-[10px]">Ctrl+Enter</kbd> to run
							{:else}
								Tip: Be specific and detailed for better results
							{/if}
						</p>
						<button
							onclick={runResearch}
							disabled={!query.trim() || !perplexityAvailable}
							class="flex items-center gap-2 px-5 py-2.5 bg-eg-accent hover:bg-eg-accent/90 text-eg-accent-text rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<FlaskConical size={16} />
							Run Deep Research
						</button>
					</div>

					{#if errorMessage}
						<div
							class="mt-4 px-4 py-2 bg-eg-danger/10 border border-eg-danger/30 rounded-lg text-sm text-eg-danger flex items-center justify-between"
						>
							<span>{errorMessage}</span>
							<button onclick={() => (errorMessage = '')} class="hover:opacity-80 ml-2"
								>&times;</button
							>
						</div>
					{/if}

					<!-- Example queries -->
					<div class="mt-8 space-y-2">
						<p class="text-xs text-eg-text-tertiary font-medium uppercase tracking-wider">
							Example queries
						</p>
						{#each [
							'Compare the top 5 JavaScript frameworks for production use in 2026',
							'What are the latest advances in battery technology for EVs?',
							'Analyze the competitive landscape of cloud computing providers',
						] as example}
							<button
								onclick={() => (query = example)}
								class="w-full text-left px-4 py-2.5 bg-eg-bg-tertiary hover:bg-eg-border border border-eg-border-subtle rounded-lg text-sm text-eg-text-secondary hover:text-eg-text transition-colors"
							>
								{example}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else if running}
			<!-- Loading state -->
			<div class="flex flex-col items-center justify-center px-4 py-20">
				<div class="flex flex-col items-center gap-4">
					<div class="relative">
						<div
							class="w-16 h-16 bg-eg-accent/10 rounded-full flex items-center justify-center"
						>
							<Loader size={28} class="text-eg-accent animate-spin" />
						</div>
					</div>
					<div class="text-center">
						<p class="text-eg-text font-medium mb-1">Researching...</p>
						<p class="text-sm text-eg-text-tertiary">
							Deep research can take 30 seconds to 2 minutes
						</p>
					</div>
				</div>
			</div>
		{:else if result}
			<!-- Research Results -->
			<div class="flex gap-0 h-full">
				<!-- Table of Contents (desktop only) -->
				{#if tocEntries.length > 2}
					<div
						class="hidden xl:block w-56 flex-shrink-0 border-r border-eg-border-subtle overflow-y-auto p-4 sticky top-0"
					>
						<p
							class="text-xs font-semibold text-eg-text-tertiary uppercase tracking-wider mb-3"
						>
							Contents
						</p>
						<nav class="space-y-1">
							{#each tocEntries as entry}
								<a
									href={`#${entry.id}`}
									class="block text-xs text-eg-text-secondary hover:text-eg-text transition-colors truncate"
									style="padding-left: {(entry.level - 1) * 12}px"
								>
									{entry.text}
								</a>
							{/each}
						</nav>
					</div>
				{/if}

				<!-- Main content -->
				<div class="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
					<div class="max-w-3xl mx-auto">
						<!-- Research query badge -->
						<div
							class="mb-6 px-4 py-3 bg-eg-bg-tertiary border border-eg-border-subtle rounded-xl"
						>
							<p class="text-xs text-eg-text-tertiary font-medium mb-1">Research Query</p>
							<p class="text-sm text-eg-text">{query}</p>
						</div>

						<!-- Rendered research document -->
						<div class="prose-eg">
							{@html renderedContent}
						</div>

						<!-- Token / cost metadata -->
						<div
							class="mt-8 pt-4 border-t border-eg-border-subtle flex items-center gap-4 text-xs text-eg-text-tertiary"
						>
							<span>{result.inputTokens.toLocaleString()} tokens in</span>
							<span>{result.outputTokens.toLocaleString()} tokens out</span>
							<span>${result.costUsd.toFixed(4)} est. cost</span>
							<span>sonar-deep-research</span>
						</div>

						<!-- Citations -->
						{#if result.citations.length > 0}
							<div class="mt-6 pb-8">
								<div class="flex items-center gap-2 mb-3">
									<Globe size={14} class="text-eg-text-tertiary" />
									<h3 class="text-sm font-semibold text-eg-text">
										Sources ({result.citations.length})
									</h3>
								</div>
								<div class="grid gap-2 sm:grid-cols-2">
									{#each result.citations as url, i}
										<a
											href={url}
											target="_blank"
											rel="noopener noreferrer"
											class="flex items-center gap-3 px-3 py-2.5 bg-eg-bg-tertiary hover:bg-eg-border border border-eg-border-subtle rounded-lg transition-colors group"
										>
											<img
												src={getFavicon(url)}
												alt=""
												class="w-4 h-4 rounded-sm flex-shrink-0"
											/>
											<div class="flex-1 min-w-0">
												<p class="text-xs font-medium text-eg-text truncate">
													[{i + 1}] {extractDomain(url)}
												</p>
												<p class="text-[10px] text-eg-text-tertiary truncate">{url}</p>
											</div>
											<ExternalLink
												size={12}
												class="text-eg-text-tertiary group-hover:text-eg-text flex-shrink-0"
											/>
										</a>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</main>
