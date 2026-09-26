import { describe, expect, it } from 'vitest';

import { chatTrigger, SLASH_COMMANDS, STARTERS } from './chat-shortcuts';
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
