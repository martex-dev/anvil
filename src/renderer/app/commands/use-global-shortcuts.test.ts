import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import type { Command } from './types';
import { globalCommandFor, shortcutAction } from './use-global-shortcuts';

const run = (): void => undefined;
const commands: Command[] = [
	{
		id: 'ai.focusChat',
		title: 'Ask AI',
		category: 'AI',
		shortcut: 'Ctrl+L',
		terminalKeepsKey: true,
		run,
	},
	{ id: 'palette', title: 'Palette', category: 'View', shortcut: 'Ctrl+Shift+P', run },
];
const ctrl = (key: string, shiftKey = false) => ({ key, ctrlKey: true, shiftKey, altKey: false });

describe('globalCommandFor', () => {
	it('leaves Ctrl+L to the terminal so it can clear the screen', () => {
		expect(globalCommandFor(ctrl('l'), commands, true)).toBeNull();
		expect(globalCommandFor(ctrl('l'), commands, false)?.id).toBe('ai.focusChat');
	});

	it('still captures other app shortcuts in the terminal', () => {
		expect(globalCommandFor(ctrl('P', true), commands, true)?.id).toBe('palette');
	});
});

const key = { repeat: false, isComposing: false };

describe('shortcutAction', () => {
	it('runs a plain key press', () => {
		expect(shortcutAction(key, {}, false)).toBe('run');
	});

	it('leaves keys to an open dialog unless the command is overlay-safe', () => {
		expect(shortcutAction(key, {}, true)).toBe('pass');
		expect(shortcutAction(key, { allowInOverlay: true }, true)).toBe('run');
	});

	it('swallows auto-repeat for toggles but repeats repeatable commands', () => {
		const held = { ...key, repeat: true };
		expect(shortcutAction(held, {}, false)).toBe('swallow');
		expect(shortcutAction(held, { repeatable: true }, false)).toBe('run');
	});

	it('never fires while an IME is composing', () => {
		expect(shortcutAction({ ...key, isComposing: true }, {}, false)).toBe('pass');
	});
});
