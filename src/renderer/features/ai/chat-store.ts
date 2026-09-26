import { create } from 'zustand';

import type { AiContext, AiModelRef } from '@shared/ipc/channels/ai';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	/** Context sent with a user message (shown as chips). */
	context?: AiContext[];
	model?: AiModelRef;
	error?: string;
	streaming?: boolean;
	usage?: { inputTokens: number | null; outputTokens: number | null };
	/** Cut off at the model's output-token limit. */
	truncated?: boolean;
	/** Epoch ms, for the timestamp under a reply. */
	at?: number;
}

interface ChatState {
	messages: ChatMessage[];
	/** Request id of the reply being streamed, if any. */
	activeRequest: string | null;
	/** Context chips waiting to go out with the next message. */
	attached: AiContext[];
	/** The unsent message. Lives here so closing the panel (or zen mode) doesn't lose it. */
	draft: string;
	setDraft: (text: string) => void;
	attach: (item: AiContext) => void;
	detach: (index: number) => void;
	/** Starts a reply; false (nothing sent) while another reply is streaming or text is empty. */
	send: (text: string, model: AiModelRef) => boolean;
	stop: () => void;
	/** Starts a new conversation; an Undo toast brings the old messages back. */
	clear: () => void;
	/** Puts cleared messages back in front of whatever was said since. */
	restore: (messages: ChatMessage[]) => void;
	onDelta: (requestId: string, text: string) => void;
	onDone: (
		requestId: string,
		usage: ChatMessage['usage'],
		cancelled: boolean,
		truncated?: boolean,
	) => void;
	onError: (requestId: string, message: string) => void;
}

// Keep the context window sane: long chats send only the most recent turns.
const HISTORY = 40;
const KEY = 'anvil.chat';

function load(): ChatMessage[] {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
		return Array.isArray(raw)
			? (raw as ChatMessage[])
					.filter(
						(m) =>
							m &&
							typeof m.content === 'string' &&
							(m.role === 'user' || m.role === 'assistant'),
					)
					.map((m) => ({ ...m, streaming: false }))
			: [];
	} catch {
		return [];
	}
}

export const useChat = create<ChatState>((set, get) => ({
	messages: load(),
	activeRequest: null,
	attached: [],
	draft: '',
	setDraft: (draft) => set({ draft }),
	attach: (item) =>
		set((s) => ({
			// One item per kind+label: re-attaching the same file refreshes it.
			attached: [
				...s.attached.filter((a) => !(a.kind === item.kind && a.label === item.label)),
				item,
			],
		})),
	detach: (index) => set((s) => ({ attached: s.attached.filter((_, i) => i !== index) })),
	send: (text, model) => {
		if (get().activeRequest || !text.trim()) return false;
		const requestId = crypto.randomUUID();
		const context = get().attached;
		const user: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			context,
			at: Date.now(),
		};
		const reply: ChatMessage = {
			id: requestId,
			role: 'assistant',
			content: '',
			model,
			streaming: true,
			at: Date.now(),
		};
		const history = [...get().messages, user]
			.filter((m) => !m.error && m.content)
			.slice(-HISTORY)
			.map((m) => ({ role: m.role, content: m.content }));
		set((s) => ({
			messages: [...s.messages, user, reply],
			activeRequest: requestId,
			attached: [],
		}));
		call('ai:send', { requestId, mode: 'chat', model, messages: history, context }).catch(
			(error: unknown) =>
				get().onError(requestId, error instanceof Error ? error.message : String(error)),
		);
		return true;
	},
	stop: () => {
		const id = get().activeRequest;
		if (id) void call('ai:cancel', id).catch(() => undefined);
	},
	clear: () => {
		const previous = get().messages;
		get().stop();
		set({ messages: [], activeRequest: null, attached: [] });
		// One click on + (or /clear) shouldn't lose a conversation for good.
		if (previous.length > 0)
			toast.info('Conversation cleared', undefined, {
				label: 'Undo',
				run: () => get().restore(previous),
			});
	},
	restore: (messages) =>
		set((s) => ({
			messages: [
				// The reply that was streaming was cancelled by clear().
				...messages.map((m) =>
					m.streaming
						? { ...m, streaming: false, ...(m.content ? {} : { error: 'Stopped' }) }
						: m,
				),
				...s.messages,
			],
		})),
	onDelta: (requestId, text) =>
		set((s) => ({
			messages: s.messages.map((m) =>
				m.id === requestId ? { ...m, content: m.content + text } : m,
			),
		})),
	onDone: (requestId, usage, cancelled, truncated = false) =>
		set((s) => ({
			activeRequest: s.activeRequest === requestId ? null : s.activeRequest,
			messages: s.messages.map((m) =>
				m.id === requestId
					? {
							...m,
							streaming: false,
							usage,
							...(truncated ? { truncated } : {}),
							...(cancelled && !m.content ? { error: 'Stopped' } : {}),
						}
					: m,
			),
		})),
	onError: (requestId, message) =>
		set((s) => ({
			activeRequest: s.activeRequest === requestId ? null : s.activeRequest,
			messages: s.messages.map((m) =>
				m.id === requestId ? { ...m, streaming: false, error: message } : m,
			),
		})),
}));

// Keep the conversation across restarts, without the (possibly large) attached context.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useChat.subscribe((s) => {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		try {
			const slim = s.messages.slice(-80).map(({ context, ...m }) => ({
				...m,
				...(context ? { context: context.map((c) => ({ ...c, text: '' })) } : {}),
			}));
			localStorage.setItem(KEY, JSON.stringify(slim));
		} catch {
			// Storage full: the chat just won't be restored.
		}
	}, 500);
});
