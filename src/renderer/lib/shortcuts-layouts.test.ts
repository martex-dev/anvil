import { describe, expect, it } from 'vitest';

import { isAltGraph, type KeyLike, matchesShortcut } from './shortcuts';

interface Press {
	key: string;
	code: string;
	ctrl?: boolean;
	shift?: boolean;
	alt?: boolean;
	/** Right Alt: Chromium sets the AltGraph modifier. */
	altGraph?: boolean;
}

const press = (p: Press): KeyLike => ({
	key: p.key,
	code: p.code,
	ctrlKey: p.ctrl ?? false,
	shiftKey: p.shift ?? false,
	altKey: p.alt ?? false,
	getModifierState: (k: string) => k === 'AltGraph' && (p.altGraph ?? false),
});

/** Every Anvil shortcut a stray match could hit; the matrix checks exactly one (or none) fires. */
const SHORTCUTS = [
	'Ctrl+Z',
	'Ctrl+W',
	'Ctrl+X',
	'Ctrl+B',
	'Ctrl+1',
	'Ctrl+-',
	'Ctrl+=',
	'Ctrl++',
	'Ctrl+/',
	'Ctrl+`',
	'Ctrl+Shift+`',
	'Ctrl+Alt+S',
	'Ctrl+Alt+Z',
	'Ctrl+Alt+N',
	'Ctrl+Alt+C',
	'Ctrl+Alt+L',
	'Ctrl+Alt+B',
	'Ctrl+Alt+V',
	'Ctrl+Alt+X',
	'Ctrl+Alt+7',
	'Ctrl+Alt+=',
	'Ctrl+Alt+/',
	'Ctrl+Alt+.',
];

const matching = (p: Press): string[] =>
	SHORTCUTS.filter((shortcut) => matchesShortcut(press(p), shortcut));

describe('keyboard layout matrix', () => {
	it.each<[string, Press, string[]]>([
		['US Ctrl+Z', { key: 'z', code: 'KeyZ', ctrl: true }, ['Ctrl+Z']],
		// AZERTY swaps Z and W: the printed letter wins, so undo never closes the tab.
		['AZERTY Ctrl+Z (physical W)', { key: 'z', code: 'KeyW', ctrl: true }, ['Ctrl+Z']],
		['AZERTY Ctrl+W (physical Z)', { key: 'w', code: 'KeyZ', ctrl: true }, ['Ctrl+W']],
		// Dvorak prints x on the physical B key: cut must not toggle the side bar.
		['Dvorak Ctrl+X (physical B)', { key: 'x', code: 'KeyB', ctrl: true }, ['Ctrl+X']],
		['Russian Ctrl+Z', { key: 'я', code: 'KeyZ', ctrl: true }, ['Ctrl+Z']],
		['AZERTY Ctrl+1 prints &', { key: '&', code: 'Digit1', ctrl: true }, ['Ctrl+1']],
		// German: the US / key prints -, so it is Ctrl+- and never also Ctrl+/.
		['German Ctrl+- (physical /)', { key: '-', code: 'Slash', ctrl: true }, ['Ctrl+-']],
		[
			'US Ctrl+Shift+` prints ~',
			{ key: '~', code: 'Backquote', ctrl: true, shift: true },
			['Ctrl+Shift+`'],
		],
		[
			'US Ctrl+Shift+= prints +',
			{ key: '+', code: 'Equal', ctrl: true, shift: true },
			['Ctrl++'],
		],
		['German Ctrl+^ (dead key)', { key: 'Dead', code: 'Backquote', ctrl: true }, ['Ctrl+`']],
	])('%s', (_name, p, expected) => {
		expect(matching(p)).toEqual(expected);
	});

	it.each<[string, Press]>([
		['Polish AltGr+S', { key: 'ś', code: 'KeyS' }],
		['Polish AltGr+Z', { key: 'ż', code: 'KeyZ' }],
		['Polish AltGr+N', { key: 'ń', code: 'KeyN' }],
		['Polish AltGr+C', { key: 'ć', code: 'KeyC' }],
		['Polish AltGr+L', { key: 'ł', code: 'KeyL' }],
		['Czech AltGr+B {', { key: '{', code: 'KeyB' }],
		['Czech AltGr+N }', { key: '}', code: 'KeyN' }],
		['Czech AltGr+V @', { key: '@', code: 'KeyV' }],
		['Czech AltGr+X #', { key: '#', code: 'KeyX' }],
		['Czech AltGr+C &', { key: '&', code: 'KeyC' }],
		['Swedish AltGr+7 {', { key: '{', code: 'Digit7' }],
		['German AltGr+E', { key: '€', code: 'KeyE' }],
	])('%s types text with right Alt and with left Ctrl+Alt', (_name, p) => {
		// Right Alt sets the AltGraph flag; left Ctrl+Alt produces the same character without it.
		for (const altGraph of [true, false]) {
			const event = { ...p, ctrl: true, alt: true, altGraph };
			expect(isAltGraph(press(event))).toBe(true);
			expect(matching(event)).toEqual([]);
		}
	});

	it('French AltGr+= (}) never runs Ctrl+Alt+=', () => {
		// A punctuation key's AltGr symbol can't be told from a shortcut without the flag, but it
		// isn't the printed = either, so nothing matches.
		for (const altGraph of [true, false]) {
			expect(matching({ key: '}', code: 'Equal', ctrl: true, alt: true, altGraph })).toEqual(
				[],
			);
		}
	});

	it.each<[string, Press, string[]]>([
		['US Ctrl+Alt+S', { key: 's', code: 'KeyS' }, ['Ctrl+Alt+S']],
		['US Ctrl+Alt+/', { key: '/', code: 'Slash' }, ['Ctrl+Alt+/']],
		['US Ctrl+Alt+.', { key: '.', code: 'Period' }, ['Ctrl+Alt+.']],
		['US Ctrl+Alt+=', { key: '=', code: 'Equal' }, ['Ctrl+Alt+=']],
		// German types / with Shift+7; the shortcut still reaches it.
		[
			'German Ctrl+Alt+Shift+7 prints /',
			{ key: '/', code: 'Digit7', shift: true },
			['Ctrl+Alt+/'],
		],
		['Russian Ctrl+Alt+S', { key: 'ы', code: 'KeyS' }, ['Ctrl+Alt+S']],
	])('%s is still a Ctrl+Alt shortcut', (_name, p, expected) => {
		const event = { ...p, ctrl: true, alt: true };
		expect(isAltGraph(press(event))).toBe(false);
		expect(matching(event)).toEqual(expected);
	});
});
