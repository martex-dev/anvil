import { describe, expect, it, vi } from 'vitest';

import { LAYOUT_DEFAULTS, type LayoutState } from '../../stores/layout-store';
import { installFocusRescue } from './focus-rescue';

function setup(active: { isConnected: boolean }) {
	const body = { isConnected: true };
	const doc = { activeElement: active, body } as unknown as Document;
	let listener: ((s: LayoutState, p: LayoutState) => void) | null = null;
	const deferred: Array<() => void> = [];
	const refocus = vi.fn();
	installFocusRescue({
		subscribe: (l) => {
			listener = l;
			return () => undefined;
		},
		doc,
		defer: (fn) => deferred.push(fn),
		refocus,
	});
	const change = (patch: Partial<LayoutState>): void =>
		listener?.({ ...LAYOUT_DEFAULTS, ...patch }, LAYOUT_DEFAULTS);
	const flush = (unmounted: boolean): void => {
		active.isConnected = !unmounted;
		(doc as { activeElement: unknown }).activeElement = unmounted ? body : active;
		for (const fn of deferred.splice(0)) fn();
	};
	return { change, flush, refocus };
}

describe('installFocusRescue', () => {
	it('refocuses when hiding a pane removes the focused element', () => {
		const { change, flush, refocus } = setup({ isConnected: true });
		change({ panelOpen: false });
		flush(true);
		expect(refocus).toHaveBeenCalledOnce();
	});

	it('leaves focus alone when it was elsewhere', () => {
		const { change, flush, refocus } = setup({ isConnected: true });
		change({ sideOpen: false });
		flush(false);
		expect(refocus).not.toHaveBeenCalled();
	});

	it('ignores changes that hide nothing', () => {
		const { change, flush, refocus } = setup({ isConnected: true });
		change({ sideWidth: 400 });
		flush(true);
		expect(refocus).not.toHaveBeenCalled();
	});
});
