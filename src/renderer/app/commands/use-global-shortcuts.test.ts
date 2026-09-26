import { describe, expect, it } from 'vitest';

import type { Command } from './types';
import { globalCommandFor } from './use-global-shortcuts';

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
