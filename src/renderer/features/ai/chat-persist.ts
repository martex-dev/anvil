import type { ChatMessage } from './chat-store';

/**
 * Chat history in localStorage, one conversation per workspace folder: a question about
 * project A has no business in project B's chat (or in the context its follow-ups carry).
 */

/** Before chats were per folder, one conversation was shared by all of them. */
const LEGACY_KEY = 'anvil.chat';
const PREFIX = 'anvil.chat:';
/** Folders with a saved chat, most recently used first; older ones are dropped. */
const INDEX_KEY = 'anvil.chat.index';
const MAX_FOLDERS = 30;
const MAX_MESSAGES = 80;

export function chatKey(root: string | null): string {
	return `${PREFIX}${root ?? '(no folder)'}`;
}

/** A reply that will get no more text; one without any says so as its error. */
export function stoppedReply(m: ChatMessage): ChatMessage {
	return { ...m, streaming: false, stopped: true, ...(m.content ? {} : { error: 'Stopped' }) };
}

function parse(raw: string | null): ChatMessage[] {
	try {
		const data = JSON.parse(raw ?? '[]') as unknown;
		return Array.isArray(data)
			? (data as ChatMessage[])
					.filter(
						(m) =>
							m &&
							typeof m.content === 'string' &&
							(m.role === 'user' || m.role === 'assistant'),
					)
					// A reply still streaming when the app closed never finished.
					.map((m) => (m.streaming ? stoppedReply(m) : m))
			: [];
	} catch {
		return [];
	}
}

/**
 * The saved conversation of a folder. The old shared conversation goes to the first folder
 * opened after the update, so updating doesn't lose it, and then no longer exists.
 */
export function loadChat(root: string | null): ChatMessage[] {
	try {
		const key = chatKey(root);
		let raw = localStorage.getItem(key);
		const legacy = localStorage.getItem(LEGACY_KEY);
		if (legacy !== null && root) {
			if (raw === null) {
				localStorage.setItem(key, legacy);
				raw = legacy;
			}
			localStorage.removeItem(LEGACY_KEY);
		}
		return parse(raw);
	} catch {
		// Storage unavailable: start with an empty chat.
		return [];
	}
}

function readIndex(): string[] {
	try {
		const data = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as unknown;
		return Array.isArray(data) ? data.filter((k): k is string => typeof k === 'string') : [];
	} catch {
		return [];
	}
}

/** Saves the recent messages without their (possibly large) attached context text. */
export function saveChat(root: string | null, messages: readonly ChatMessage[]): void {
	const key = chatKey(root);
	try {
		const slim = messages.slice(-MAX_MESSAGES).map(({ context, ...m }) => ({
			...m,
			...(context ? { context: context.map((c) => ({ ...c, text: '' })) } : {}),
		}));
		localStorage.setItem(key, JSON.stringify(slim));
		// Every folder ever opened would otherwise keep a chat until storage fills up.
		const index = [key, ...readIndex().filter((k) => k !== key)];
		for (const old of index.slice(MAX_FOLDERS)) localStorage.removeItem(old);
		localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_FOLDERS)));
	} catch {
		// Storage full: the chat just won't be restored.
	}
}
