import { describe, expect, it } from 'vitest';

import { parseStoredTerminals } from './terminal-persist';

const a = { id: 'anvil-0a1b2c3d-1111', preset: 'powershell', title: 'pwsh 1' };
const b = {
	id: 'anvil-0a1b2c3d-2222',
	preset: 'repl',
	title: 'IPython',
	role: 'repl',
	root: 'C:/p',
};

describe('parseStoredTerminals', () => {
	it('restores valid tabs and the active one', () => {
		expect(parseStoredTerminals({ tabs: [a, b], active: b.id })).toEqual({
			tabs: [a, b],
			active: b.id,
		});
	});

	it('keeps the folder an Open in Terminal tab started in', () => {
		const c = { ...a, id: 'anvil-0a1b2c3d-3333', cwd: 'src/strategies' };
		expect(parseStoredTerminals({ tabs: [c] }).tabs).toEqual([c]);
		const empty = { ...a, cwd: '' };
		expect(parseStoredTerminals({ tabs: [empty] }).tabs).toEqual([]);
	});

	it('drops corrupt entries and falls back to the first tab', () => {
		const stored = {
			tabs: [
				{ id: 'x', preset: 'powershell', title: 't' },
				{ ...a, preset: 'fish' },
				{ ...a, title: 42 },
				b,
				b,
				null,
			],
			active: 'anvil-gone',
		};
		expect(parseStoredTerminals(stored)).toEqual({ tabs: [b], active: b.id });
	});

	it('reads the older bare-array form and rejects junk', () => {
		expect(parseStoredTerminals([a])).toEqual({ tabs: [a], active: a.id });
		expect(parseStoredTerminals('nope')).toEqual({ tabs: [], active: null });
	});
});
