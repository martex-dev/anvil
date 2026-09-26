import type { AiMessage } from '@shared/ipc/channels/ai';

import type { ChatMessage } from './chat-store';

// Keep the context window sane: long chats send only the most recent turns.
export const HISTORY = 40;

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
