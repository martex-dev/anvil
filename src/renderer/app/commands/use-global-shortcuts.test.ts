import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import { shortcutAction } from './use-global-shortcuts';

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
