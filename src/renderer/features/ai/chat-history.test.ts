import { describe, expect, it } from 'vitest';

import { buildHistory, HISTORY } from './chat-history';
import type { ChatMessage } from './chat-store';

const turn = (i: number, role: ChatMessage['role']): ChatMessage => ({
	id: `${role}${i}`,
	role,
	content: `${role} ${i}`,
});

describe('buildHistory', () => {
	it('never starts with an assistant turn after trimming a long chat', () => {
		const messages: ChatMessage[] = [];
		for (let i = 1; i <= 20; i++) messages.push(turn(i, 'user'), turn(i, 'assistant'));
		messages.push(turn(21, 'user'));
		const history = buildHistory(messages);
		expect(history[0]).toEqual({ role: 'user', content: 'user 2' });
		expect(history.at(-1)).toEqual({ role: 'user', content: 'user 21' });
		expect(history.length).toBeLessThanOrEqual(HISTORY);
	});

	it('drops failed replies and merges the questions around them', () => {
		const history = buildHistory([
			{ id: 'u1', role: 'user', content: 'first' },
			{ id: 'a1', role: 'assistant', content: '', error: 'Rate limited' },
			{ id: 'u2', role: 'user', content: 'second' },
		]);
		expect(history).toEqual([{ role: 'user', content: 'first\n\nsecond' }]);
	});
});
