import { describe, expect, it } from 'vitest';

import { isBindable, matchesShortcut, parseShortcut } from './shortcuts';

const ev = (
	key: string,
	mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {},
	code?: string,
) => ({
	key,
	...(code ? { code } : {}),
	ctrlKey: mods.ctrl ?? false,
	shiftKey: mods.shift ?? false,
	altKey: mods.alt ?? false,
});

describe('shortcuts', () => {
	it('parses modifiers and key', () => {
		expect(parseShortcut('Ctrl+Shift+P')).toEqual({
			ctrl: true,
			shift: true,
			alt: false,
			key: 'p',
		});
		expect(parseShortcut('Ctrl++').key).toBe('+');
	});

	it('matches exact modifier combos only', () => {
		expect(matchesShortcut(ev('p', { ctrl: true }), 'Ctrl+P')).toBe(true);
		expect(matchesShortcut(ev('P', { ctrl: true, shift: true }), 'Ctrl+P')).toBe(false);
		expect(matchesShortcut(ev('P', { ctrl: true, shift: true }), 'Ctrl+Shift+P')).toBe(true);
	});

	it('falls back to the physical key for punctuation', () => {
		expect(matchesShortcut(ev('~', { ctrl: true }, 'Backquote'), 'Ctrl+`')).toBe(true);
		expect(matchesShortcut(ev('|', { ctrl: true }, 'Backslash'), 'Ctrl+\\')).toBe(true);
		expect(
			matchesShortcut(ev('!', { ctrl: true, shift: true }, 'Digit1'), 'Ctrl+Shift+1'),
		).toBe(true);
	});

	it('matches letters by physical key on non-Latin layouts', () => {
		// Bulgarian / Greek layouts report the local letter in `key` for the C key.
		expect(matchesShortcut(ev('ц', { ctrl: true }, 'KeyC'), 'Ctrl+C')).toBe(true);
		expect(matchesShortcut(ev('ψ', { ctrl: true }, 'KeyC'), 'Ctrl+C')).toBe(true);
		expect(matchesShortcut(ev('ц', { ctrl: true, shift: true }, 'KeyC'), 'Ctrl+C')).toBe(false);
	});

	it('allows bare function keys only', () => {
		expect(isBindable('F5')).toBe(true);
		expect(isBindable('Shift+Enter')).toBe(false);
		expect(isBindable('Ctrl+Enter')).toBe(true);
		expect(matchesShortcut(ev('F5'), 'F5')).toBe(true);
	});
});
