import { describe, expect, it } from 'vitest';

import { terminalKeyAction } from './xterm-keys';

const key = (k: string, code: string, mods: { shift?: boolean; alt?: boolean } = {}) => ({
	type: 'keydown',
	key: k,
	code,
	ctrlKey: true,
	shiftKey: mods.shift ?? false,
	altKey: mods.alt ?? false,
});

describe('terminalKeyAction', () => {
	it('copies a selection with Ctrl+C, even with Caps Lock or Shift', () => {
		expect(terminalKeyAction(key('c', 'KeyC'), true)).toBe('copy');
		expect(terminalKeyAction(key('C', 'KeyC'), true)).toBe('copy');
		expect(terminalKeyAction(key('C', 'KeyC', { shift: true }), true)).toBe('copy');
	});

	it('copies on a non-Latin layout by physical key', () => {
		expect(terminalKeyAction(key('ц', 'KeyC'), true)).toBe('copy');
	});

	it('leaves Ctrl+C without a selection to xterm (SIGINT)', () => {
		expect(terminalKeyAction(key('c', 'KeyC'), false)).toBe('xterm');
	});

	it('pastes natively on Ctrl+V only', () => {
		expect(terminalKeyAction(key('v', 'KeyV'), false)).toBe('native-paste');
		expect(terminalKeyAction(key('V', 'KeyV', { shift: true }), false)).toBe('xterm');
		expect(terminalKeyAction(key('v', 'KeyV', { alt: true }), false)).toBe('xterm');
		expect(terminalKeyAction({ ...key('v', 'KeyV'), type: 'keyup' }, false)).toBe('xterm');
	});
});
