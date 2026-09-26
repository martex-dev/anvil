import { toast } from '@renderer/stores/toast-store';

import { rlog } from './log';

/**
 * Browser noise that is not a bug: Chromium reports ResizeObserver loops as window errors
 * (Monaco and xterm trigger them while resizing) and Monaco rejects cancelled work with a
 * `Canceled` error.
 */
export function isBenignError(reason: unknown, message = ''): boolean {
	if (/ResizeObserver loop/.test(message)) return true;
	if (reason instanceof Error) {
		return reason.name === 'Canceled' || /ResizeObserver loop/.test(reason.message);
	}
	return false;
}

/** A short, user-facing description of an uncaught error or rejection reason. */
export function describeError(reason: unknown, fallback = 'Unknown error'): string {
	if (reason instanceof Error) return reason.message || reason.name;
	if (typeof reason === 'string' && reason) return reason;
	return fallback;
}

type ErrorTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * Surfaces errors that escape every try/catch and error boundary (event handlers, timers,
 * un-awaited promises): logged to main's log file and shown as a toast, never swallowed.
 * Returns an uninstall function.
 */
export function installGlobalErrorHandlers(target: ErrorTarget = window): () => void {
	const onError = (e: Event): void => {
		const { error, message } = e as ErrorEvent;
		if (isBenignError(error, message)) return;
		const text = describeError(error, message || 'Unknown error');
		rlog.error('window', `uncaught error: ${text}`, error);
		toast.error('Unexpected error', text);
	};
	const onRejection = (e: Event): void => {
		const { reason } = e as PromiseRejectionEvent;
		if (isBenignError(reason)) return;
		const text = describeError(reason);
		rlog.error('window', `unhandled rejection: ${text}`, reason);
		toast.error('Unexpected error', text);
	};
	target.addEventListener('error', onError);
	target.addEventListener('unhandledrejection', onRejection);
	return () => {
		target.removeEventListener('error', onError);
		target.removeEventListener('unhandledrejection', onRejection);
	};
}
