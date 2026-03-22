/**
 * Temp Chat Store — sessionStorage-backed ephemeral chat.
 *
 * Messages are never written to Convex. Closing the tab
 * permanently destroys the conversation.
 */

const STORAGE_KEY = 'evergood-temp-chat';

export interface TempMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	model: string;
	inputTokens?: number;
	outputTokens?: number;
	costUsd?: number;
	isStreaming?: boolean;
	timestamp: number;
}

interface TempChatState {
	active: boolean;
	messages: TempMessage[];
	model: string;
}

function loadState(): TempChatState {
	if (typeof sessionStorage === 'undefined') {
		return { active: false, messages: [], model: 'gpt-5-nano' };
	}
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as TempChatState;
			return parsed;
		}
	} catch {
		// Corrupted data — start fresh
	}
	return { active: false, messages: [], model: 'gpt-5-nano' };
}

function saveState(state: TempChatState) {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// sessionStorage full or unavailable
	}
}

let active = $state(false);
let messages = $state<TempMessage[]>([]);
let model = $state('gpt-5-nano');
let isStreaming = $state(false);

export const tempChatStore = {
	get active() {
		return active;
	},
	get messages() {
		return messages;
	},
	get model() {
		return model;
	},
	get isStreaming() {
		return isStreaming;
	},

	/** Restore state from sessionStorage (call on mount) */
	init() {
		const state = loadState();
		active = state.active;
		messages = state.messages;
		model = state.model;
	},

	/** Start a new temp chat session (clear any existing) */
	start(selectedModel?: string) {
		active = true;
		messages = [];
		model = selectedModel ?? 'gpt-5-nano';
		isStreaming = false;
		saveState({ active, messages, model });
	},

	/** End temp chat and discard all messages */
	end() {
		active = false;
		messages = [];
		model = 'gpt-5-nano';
		isStreaming = false;
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.removeItem(STORAGE_KEY);
		}
	},

	setModel(m: string) {
		model = m;
		saveState({ active, messages, model });
	},

	/** Add a user message */
	addUserMessage(content: string): string {
		const id = crypto.randomUUID();
		const msg: TempMessage = {
			id,
			role: 'user',
			content,
			model,
			timestamp: Date.now(),
		};
		messages = [...messages, msg];
		saveState({ active, messages, model });
		return id;
	},

	/** Add a streaming placeholder for assistant response */
	startAssistantMessage(): string {
		const id = crypto.randomUUID();
		const msg: TempMessage = {
			id,
			role: 'assistant',
			content: '',
			model,
			isStreaming: true,
			timestamp: Date.now(),
		};
		messages = [...messages, msg];
		isStreaming = true;
		return id;
	},

	/** Append content to the streaming assistant message */
	appendContent(messageId: string, chunk: string) {
		messages = messages.map((m) =>
			m.id === messageId ? { ...m, content: m.content + chunk } : m,
		);
	},

	/** Finalize the streaming assistant message with metadata */
	finishStreaming(
		messageId: string,
		meta?: { inputTokens?: number; outputTokens?: number; costUsd?: number },
	) {
		messages = messages.map((m) =>
			m.id === messageId
				? {
						...m,
						isStreaming: false,
						inputTokens: meta?.inputTokens,
						outputTokens: meta?.outputTokens,
						costUsd: meta?.costUsd,
					}
				: m,
		);
		isStreaming = false;
		saveState({ active, messages, model });
	},

	/** Set error content on a streaming message and stop */
	setError(messageId: string, error: string) {
		messages = messages.map((m) =>
			m.id === messageId
				? { ...m, content: m.content + `\n\n**Error:** ${error}`, isStreaming: false }
				: m,
		);
		isStreaming = false;
		saveState({ active, messages, model });
	},
};
