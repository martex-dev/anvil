import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import type { Command } from './types';
import { globalCommandFor, shortcutAction } from './use-global-shortcuts';

const run = (): void => undefined;
const cmd = (id: string, shortcut: string): Command => ({
	id,
	title: id,
	category: 'View',
	shortcut,
	run,
});
const commands: Command[] = [
	cmd('ai.focusChat', 'Ctrl+L'),
	cmd('view.palette', 'Ctrl+Shift+P'),
	cmd('file.quickOpen', 'Ctrl+P'),
	cmd('view.toggleTerminal', 'Ctrl+`'),
	cmd('view.explorer', 'Ctrl+Shift+E'),
	cmd('file.close', 'Ctrl+W'),
	cmd('view.toggleSide', 'Ctrl+B'),
	cmd('view.togglePanel', 'Ctrl+J'),
	cmd('view.splitEditor', 'Ctrl+\\'),
	cmd('markdown.preview', 'Ctrl+Shift+V'),
	cmd('python.runFile', 'F5'),
	cmd('python.runCell', 'F9'),
	cmd('view.zoomOut', 'Ctrl+-'),
	cmd('anvil.shortcuts', 'Ctrl+Alt+/'),
];
const key = (
	k: string,
	mods: { shift?: boolean; alt?: boolean; ctrl?: boolean } = {},
	code = '',
) => ({
	key: k,
	code,
	ctrlKey: mods.ctrl ?? true,
	shiftKey: mods.shift ?? false,
	altKey: mods.alt ?? false,
});

describe('globalCommandFor in the terminal', () => {
	const inTerminal = { inTerminal: true };

	it.each([
		['Ctrl+W', key('w')],
		['Ctrl+L (clear screen)', key('l')],
		['Ctrl+B', key('b')],
		['Ctrl+J', key('j')],
		['Ctrl+\\ (SIGQUIT)', key('\\')],
		['Ctrl+Shift+V (paste)', key('V', { shift: true })],
		['F5', key('F5', { ctrl: false })],
		['F9', key('F9', { ctrl: false })],
	])('leaves %s to the shell', (_name, event) => {
		expect(globalCommandFor(event, commands, inTerminal)).toBeNull();
		// The same keys still work outside the terminal.
		expect(globalCommandFor(event, commands, {})).not.toBeNull();
	});

	it.each([
		['view.palette', key('P', { shift: true })],
		['file.quickOpen', key('p')],
		['view.toggleTerminal', key('`')],
		['view.explorer', key('E', { shift: true })],
	])('still runs %s', (id, event) => {
		expect(globalCommandFor(event, commands, inTerminal)?.id).toBe(id);
	});

	it('hands a key to the command whose context holds, and back when it ends', () => {
		const withDebug: Command[] = [
			{ id: 'python.runFile', title: 'Run', category: 'Python', shortcut: 'F5', run },
			{
				id: 'debug.continue',
				title: 'Continue',
				category: 'Run',
				shortcut: 'F5',
				when: 'debugging',
				run,
			},
		];
		const f5 = { key: 'F5', ctrlKey: false, shiftKey: false, altKey: false };
		expect(globalCommandFor(f5, withDebug, {}, () => false)?.id).toBe('python.runFile');
		expect(globalCommandFor(f5, withDebug, {}, () => true)?.id).toBe('debug.continue');
		// The program being debugged runs in the terminal; its debug keys still work there.
		expect(globalCommandFor(f5, withDebug, { inTerminal: true }, () => true)?.id).toBe(
			'debug.continue',
		);
		expect(globalCommandFor(f5, withDebug, { inTerminal: true }, () => false)).toBeNull();
	});
});

describe('globalCommandFor in text fields', () => {
	it('leaves Ctrl+Shift+V to inputs for a plain-text paste', () => {
		const paste = key('V', { shift: true });
		expect(globalCommandFor(paste, commands, { inTextField: true })).toBeNull();
		expect(globalCommandFor(paste, commands, { inChatInput: true })).toBeNull();
	});

	it('keeps Ctrl+L from re-focusing the chat while typing in it', () => {
		expect(globalCommandFor(key('l'), commands, { inChatInput: true })).toBeNull();
		expect(globalCommandFor(key('l'), commands, { inTextField: true })?.id).toBe(
			'ai.focusChat',
		);
		expect(globalCommandFor(key('p'), commands, { inChatInput: true })?.id).toBe(
			'file.quickOpen',
		);
	});
});

describe('globalCommandFor on other layouts', () => {
	it('picks the printed key over the physical one', () => {
		// German prints - on the US / key: zoom out, not Keyboard Shortcuts.
		expect(globalCommandFor(key('-', {}, 'Slash'), commands)?.id).toBe('view.zoomOut');
	});

	it('reaches Ctrl+Alt+/ where / needs Shift', () => {
		const german = key('/', { alt: true, shift: true }, 'Digit7');
		expect(globalCommandFor(german, commands)?.id).toBe('anvil.shortcuts');
	});

	it('ignores AltGr text', () => {
		const altGr = { ...key('ł', { alt: true }, 'KeyL'), getModifierState: () => true };
		expect(globalCommandFor(altGr, commands)).toBeNull();
	});
});

const press = { repeat: false, isComposing: false };

describe('shortcutAction', () => {
	it('runs a plain key press', () => {
		expect(shortcutAction(press, {}, false)).toBe('run');
	});

	it('leaves keys to an open dialog unless the command is overlay-safe', () => {
		expect(shortcutAction(press, {}, true)).toBe('pass');
		expect(shortcutAction(press, { allowInOverlay: true }, true)).toBe('run');
	});

	it('swallows auto-repeat for toggles but repeats repeatable commands', () => {
		const held = { ...press, repeat: true };
		expect(shortcutAction(held, {}, false)).toBe('swallow');
		expect(shortcutAction(held, { repeatable: true }, false)).toBe('run');
	});

	it('never fires while an IME is composing', () => {
		expect(shortcutAction({ ...press, isComposing: true }, {}, false)).toBe('pass');
	});
});
