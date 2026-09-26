import { describe, expect, it } from 'vitest';

import { useChat } from './chat-store';

describe('chat send', () => {
	it('refuses a second message while a reply is streaming, so the draft can be kept', () => {
		const model = { provider: 'anthropic' as const, model: 'claude-opus-5' };
		expect(useChat.getState().send('first', model)).toBe(true);
		expect(useChat.getState().activeRequest).not.toBeNull();
		expect(useChat.getState().send('second', model)).toBe(false);
		expect(useChat.getState().messages.filter((m) => m.role === 'user')).toHaveLength(1);
		expect(useChat.getState().send('   ', model)).toBe(false);
	});
});

describe('chat draft', () => {
	it('keeps the unsent message in the store, outside the panel component', () => {
		useChat.getState().setDraft('half a question');
		expect(useChat.getState().draft).toBe('half a question');
	});
});
