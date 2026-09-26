import type { AiContext, AiMessage } from '@shared/ipc/channels/ai';

import type { ChatMessage } from './chat-store';

// Keep the context window sane: long chats send only the most recent turns.
export const HISTORY = 40;
/** Context items one request may carry (the ai:send limit). */
export const MAX_CONTEXT = 20;
// Earlier attachments are re-sent only up to this much text, so long chats stay affordable.
const CARRIED_CHARS = 400_000;

/**
 * The turns sent with a request: the recent ones that have text and didn't fail. It always
 * opens with the user (Anthropic rejects a conversation that starts with the assistant), and
 * turns left next to each other by a failed reply are merged so roles alternate.
 */
export function buildHistory(messages: readonly ChatMessage[]): AiMessage[] {
	const turns = messages.filter((m) => !m.error && m.content).slice(-HISTORY);
	while (turns[0]?.role === 'assistant') turns.shift();
	const out: AiMessage[] = [];
	for (const m of turns) {
		const prev = out.at(-1);
		if (prev?.role === m.role) prev.content += `\n\n${m.content}`;
		else out.push({ role: m.role, content: m.content });
	}
	return out;
}

const contextKey = (c: AiContext): string => `${c.kind}\u0000${c.label}`;

/**
 * Context for a request: the new attachments, then those of earlier questions still in the
 * history window (newest first), so a follow-up still sees the file it is about. One item per
 * kind+label, the newest copy wins. Context restored after a restart has no text (it isn't
 * persisted) and is not carried.
 */
export function buildContext(
	before: readonly ChatMessage[],
	current: readonly AiContext[],
): AiContext[] {
	const out = current.slice(0, MAX_CONTEXT);
	const seen = new Set(out.map(contextKey));
	let carried = 0;
	const earlier = before
		.slice(-HISTORY)
		.filter((m) => m.role === 'user')
		.reverse();
	for (const m of earlier) {
		for (const c of [...(m.context ?? [])].reverse()) {
			if (out.length >= MAX_CONTEXT) return out;
			if (!c.text || seen.has(contextKey(c)) || carried + c.text.length > CARRIED_CHARS)
				continue;
			seen.add(contextKey(c));
			carried += c.text.length;
			out.push(c);
		}
	}
	return out;
}
