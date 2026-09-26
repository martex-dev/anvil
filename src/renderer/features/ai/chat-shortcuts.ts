/**
 * Slash commands and starter chips in the chat panel. They name registered commands by id
 * (run via `runCommandById`) so a failure is logged and toasted, not an unhandled rejection.
 */
export const SLASH_COMMANDS: ReadonlyArray<{ cmd: string; hint: string; commandId: string }> = [
	{ cmd: '/explain', hint: 'explain the selection or function', commandId: 'ai.explain' },
	{ cmd: '/review', hint: 'find bugs and edge cases', commandId: 'ai.review' },
	{ cmd: '/tests', hint: 'write pytest / vitest tests', commandId: 'ai.tests' },
	{
		cmd: '/lookahead',
		hint: 'audit for look-ahead bias and leakage',
		commandId: 'ai.lookahead',
	},
	{ cmd: '/clear', hint: 'new conversation', commandId: 'ai.newChat' },
];

export const STARTERS: ReadonlyArray<{ label: string; commandId: string }> = [
	{ label: 'Explain this code', commandId: 'ai.explain' },
	{ label: 'Find bugs', commandId: 'ai.review' },
	{ label: 'Write tests', commandId: 'ai.tests' },
	{ label: 'Check for look-ahead bias', commandId: 'ai.lookahead' },
];

export type ChatTrigger = { kind: '@' | '/'; query: string };

/** `@partial` or `/partial` being typed at the end of the input. */
export function chatTrigger(text: string): ChatTrigger | null {
	const at = /(?:^|\s)@([\w./-]*)$/.exec(text);
	if (at) return { kind: '@', query: at[1] ?? '' };
	const slash = /^\/(\w*)$/.exec(text);
	return slash ? { kind: '/', query: slash[1] ?? '' } : null;
}
