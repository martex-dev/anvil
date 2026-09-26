import { describe, expect, it } from 'vitest';

import { chatTrigger, mentionStatus, SLASH_COMMANDS, STARTERS } from './chat-shortcuts';
import { AI_COMMANDS } from './commands';

describe('chat shortcuts', () => {
	it('only name registered AI commands, so they run through runCommandById', () => {
		const ids = new Set(AI_COMMANDS.map((c) => c.id));
		for (const s of [...SLASH_COMMANDS, ...STARTERS]) expect(ids).toContain(s.commandId);
	});
});

describe('chatTrigger', () => {
	it('finds an @ mention or a leading slash command being typed', () => {
		expect(chatTrigger('look at @src/ma')).toEqual({ kind: '@', query: 'src/ma' });
		expect(chatTrigger('/rev')).toEqual({ kind: '/', query: 'rev' });
		expect(chatTrigger('a /rev')).toBeNull();
		expect(chatTrigger('mail@example')).toBeNull();
	});
});

describe('mentionStatus', () => {
	const base = { hasFolder: true, loading: false, error: null, matches: 0 };

	it('stays out of the way when there are files to pick', () => {
		expect(mentionStatus({ ...base, matches: 3 })).toBeNull();
	});

	it('explains an empty @ popup', () => {
		expect(mentionStatus({ ...base, hasFolder: false })?.text).toBe(
			'Open a folder to mention files',
		);
		expect(mentionStatus({ ...base, loading: true })?.tone).toBe('loading');
		expect(mentionStatus({ ...base, error: new Error('boom') })).toEqual({
			tone: 'error',
			text: 'Could not list files: boom',
		});
		expect(mentionStatus(base)?.text).toBe('No matching files');
	});
});
