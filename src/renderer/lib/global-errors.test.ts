import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '@renderer/stores/toast-store';

import { describeError, installGlobalErrorHandlers, isBenignError } from './global-errors';

vi.mock('./log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

function errorEvent(error: unknown, message: string): Event {
	return Object.assign(new Event('error'), { error, message });
}

function rejectionEvent(reason: unknown): Event {
	return Object.assign(new Event('unhandledrejection'), { reason });
}

describe('global error handlers', () => {
	beforeEach(() => useToastStore.setState({ toasts: [] }));

	it('toasts uncaught errors and unhandled rejections', () => {
		const target = new EventTarget();
		const uninstall = installGlobalErrorHandlers(target as unknown as Window);
		target.dispatchEvent(errorEvent(new Error('boom'), 'Uncaught Error: boom'));
		target.dispatchEvent(rejectionEvent('ipc down'));
		expect(useToastStore.getState().toasts.map((t) => t.description)).toEqual([
			'boom',
			'ipc down',
		]);
		uninstall();
		target.dispatchEvent(rejectionEvent('after uninstall'));
		expect(useToastStore.getState().toasts).toHaveLength(2);
	});

	it('ignores ResizeObserver loops and Monaco cancellations', () => {
		const target = new EventTarget();
		installGlobalErrorHandlers(target as unknown as Window);
		target.dispatchEvent(
			errorEvent(undefined, 'ResizeObserver loop completed with undelivered notifications.'),
		);
		const canceled = Object.assign(new Error('Canceled'), { name: 'Canceled' });
		target.dispatchEvent(rejectionEvent(canceled));
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	it('describes odd rejection reasons', () => {
		expect(describeError(new Error('x'))).toBe('x');
		expect(describeError({})).toBe('Unknown error');
		expect(isBenignError(new Error('real'))).toBe(false);
	});
});
