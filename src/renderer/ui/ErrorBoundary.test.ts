import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary, toError } from './ErrorBoundary';

vi.mock('@renderer/lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

describe('ErrorBoundary', () => {
	it('captures thrown values as Errors', () => {
		expect(ErrorBoundary.getDerivedStateFromError('bad chunk')).toEqual({
			error: new Error('bad chunk'),
		});
		const e = new Error('x');
		expect(toError(e)).toBe(e);
	});

	it('clears the error when the reset key changes', () => {
		const state = { error: new Error('x'), resetKey: 'git' };
		const props = { name: 'Side', children: null };
		expect(ErrorBoundary.getDerivedStateFromProps({ ...props, resetKey: 'git' }, state)).toBe(
			null,
		);
		expect(
			ErrorBoundary.getDerivedStateFromProps({ ...props, resetKey: 'search' }, state),
		).toEqual({ error: null, resetKey: 'search' });
	});
});
