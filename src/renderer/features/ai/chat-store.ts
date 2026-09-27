import { create } from 'zustand';

import type { AiContext, AiModelRef } from '@shared/ipc/channels/ai';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { buildContext, buildHistory, MAX_CONTEXT } from './chat-history';
import { loadChat, saveChat, stoppedReply } from './chat-persist';
import { safeContext } from './secret-filter';

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
	/** Ended before the model finished: Stop, clearing the chat, or a restart mid-reply. */
	stopped?: boolean;
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
	/**
	 * Asks again for the failed last reply: resends the question before it, with its context,
	 * and replaces the failed reply. False when nothing was sent.
	 */
	retry: (replyId: string, model: AiModelRef) => boolean;
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
	/**
	 * The open folder, whose conversation is shown; undefined until it is known, and then
	 * nothing is saved (an empty chat must not overwrite a folder's history).
	 */
	workspace: string | null | undefined;
	/** Switches to the conversation of the folder just opened (null: no folder). */
	openWorkspace: (root: string | null) => void;
}

const MAX_LABEL = 500;

export const useChat = create<ChatState>((set, get) => {
	/** Appends `user` and a streaming reply after `before`, and sends the request. */
	const startReply = (
		before: ChatMessage[],
		user: ChatMessage,
		context: AiContext[],
		model: AiModelRef,
	): void => {
		const requestId = crypto.randomUUID();
		const reply: ChatMessage = {
			id: requestId,
			role: 'assistant',
			content: '',
			model,
			streaming: true,
			at: Date.now(),
		};
		const history = buildHistory([...before, user]);
		set({ messages: [...before, user, reply], activeRequest: requestId });
		call('ai:send', {
			requestId,
			mode: 'chat',
			model,
			messages: history,
			context: buildContext(before, context),
		}).catch((error: unknown) =>
			get().onError(requestId, error instanceof Error ? error.message : String(error)),
		);
	};

	return {
		messages: [],
		workspace: undefined,
		openWorkspace: (root) => {
			if (get().workspace === root) return;
			// The previous folder's latest messages are still waiting for the debounced save.
			flushSave();
			// A reply still streaming belongs to the folder being left; it is saved as stopped.
			get().stop();
			set({ workspace: root, messages: loadChat(root), activeRequest: null, attached: [] });
		},
		activeRequest: null,
		attached: [],
		draft: '',
		setDraft: (draft) => set({ draft }),
		attach: (raw) => {
			// Every chat attachment passes here, so this is where secrets are masked: the model
			// can explain or fix code without ever seeing a key's value.
			const { item: safe, hidden } = safeContext(raw);
			// Labels are capped by the ai:send schema; a longer one would fail the whole request.
			const item = { ...safe, label: safe.label.slice(0, MAX_LABEL) };
			// One item per kind+label: re-attaching the same file refreshes it.
			const others = get().attached.filter(
				(a) => !(a.kind === item.kind && a.label === item.label),
			);
			if (others.length >= MAX_CONTEXT) {
				toast.warn(
					`Up to ${MAX_CONTEXT} attachments`,
					'Remove one before attaching another.',
				);
				return;
			}
			set({ attached: [...others, item] });
			if (hidden > 0)
				toast.info(
					'Secrets kept out of the chat',
					`${item.label}: ${hidden === 1 ? 'one secret was' : `${hidden} secrets were`} masked before sending.`,
				);
		},
		detach: (index) => set((s) => ({ attached: s.attached.filter((_, i) => i !== index) })),
		send: (text, model) => {
			if (get().activeRequest || !text.trim()) return false;
			const user: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: text,
				context: get().attached,
				at: Date.now(),
			};
			set({ attached: [] });
			startReply(get().messages, user, user.context ?? [], model);
			return true;
		},
		retry: (replyId, model) => {
			const { messages, activeRequest } = get();
			const index = messages.findIndex((m) => m.id === replyId);
			const reply = messages[index];
			const user = messages[index - 1];
			// Only the latest reply: retrying an old one would reorder the conversation.
			if (
				activeRequest ||
				index !== messages.length - 1 ||
				reply?.role !== 'assistant' ||
				!reply.error ||
				user?.role !== 'user'
			)
				return false;
			// Context restored after a restart has no text (it isn't persisted): don't send it empty.
			const context = (user.context ?? []).filter((c) => c.text);
			startReply(messages.slice(0, index - 1), user, context, model);
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
					...messages.map((m) => (m.streaming ? stoppedReply(m) : m)),
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
					m.id !== requestId
						? m
						: cancelled
							? stoppedReply({ ...m, usage })
							: {
									...m,
									streaming: false,
									usage,
									...(truncated ? { truncated } : {}),
								},
				),
			})),
		onError: (requestId, message) =>
			set((s) => ({
				activeRequest: s.activeRequest === requestId ? null : s.activeRequest,
				messages: s.messages.map((m) =>
					m.id === requestId ? { ...m, streaming: false, error: message } : m,
				),
			})),
	};
});

// Keep each folder's conversation across restarts. Saves are debounced (a reply streams in
// many small updates) and bound to the folder they belong to when scheduled.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: (() => void) | null = null;

function flushSave(): void {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = null;
	const save = pendingSave;
	pendingSave = null;
	save?.();
}

useChat.subscribe((s, prev) => {
	if (s.workspace === undefined || s.messages === prev.messages) return;
	const { workspace, messages } = s;
	pendingSave = () => saveChat(workspace, messages);
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(flushSave, 500);
});
