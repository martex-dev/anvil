import { describe, expect, it } from 'vitest';

import { buildContext, buildHistory, HISTORY, MAX_CONTEXT } from './chat-history';
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

describe('buildContext', () => {
	const file = (label: string, text = 'x = 1') => ({
		kind: 'file' as const,
		label,
		language: null,
		text,
	});

	it('carries files attached to earlier questions into a follow-up', () => {
		const before: ChatMessage[] = [
			{ id: 'u1', role: 'user', content: 'what does this do?', context: [file('a.py')] },
			{ id: 'a1', role: 'assistant', content: 'It adds.' },
		];
		expect(buildContext(before, [])).toEqual([file('a.py')]);
	});

	it('keeps the newest copy of a file and skips context restored without text', () => {
		const before: ChatMessage[] = [
			{
				id: 'u1',
				role: 'user',
				content: 'q1',
				context: [file('a.py', 'old'), file('b.py', '')],
			},
			{ id: 'a1', role: 'assistant', content: 'r1' },
		];
		expect(buildContext(before, [file('a.py', 'new')])).toEqual([file('a.py', 'new')]);
	});

	it('never goes over the per-request limit', () => {
		const many = Array.from({ length: MAX_CONTEXT }, (_, i) => file(`f${i}.py`));
		const before: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'q', context: many }];
		expect(buildContext(before, [file('new.py')])).toHaveLength(MAX_CONTEXT);
		expect(buildContext(before, [file('new.py')])[0]?.label).toBe('new.py');
	});
});
