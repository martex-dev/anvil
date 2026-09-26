import { describe, expect, it, vi } from 'vitest';

// The command modules pull in stores and Monaco helpers; only their static data matters here.
vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));

describe('command registry', () => {
	it('has unique ids and no shortcut bound twice in the same scope', async () => {
		const { ALL_COMMANDS } = await import('./all');
		const ids = ALL_COMMANDS.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		const seen = new Map<string, string>();
		for (const c of ALL_COMMANDS) {
			if (!c.shortcut) continue;
			const key = `${c.scope ?? 'global'}|${c.editorLanguage ?? '*'}|${c.shortcut.toLowerCase()}`;
			expect(
				seen.get(key),
				`${c.id} and ${seen.get(key)} share ${c.shortcut}`,
			).toBeUndefined();
			seen.set(key, c.id);
		}
	});

	it('only binds bare keys that are function keys, or editor-scoped ones', async () => {
		const { ALL_COMMANDS } = await import('./all');
		const { isBindable } = await import('../../lib/shortcuts');
		for (const c of ALL_COMMANDS) {
			if (c.shortcut && (c.scope ?? 'global') === 'global')
				expect(isBindable(c.shortcut), c.id).toBe(true);
		}
	});
});
