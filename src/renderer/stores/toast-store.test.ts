import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_TOASTS, toast, useToastStore } from './toast-store';

beforeEach(() => useToastStore.setState({ toasts: [] }));

describe('toast store', () => {
	it('evicts the oldest non-error toast first when over the cap', () => {
		toast.error('Save failed');
		for (let i = 0; i < MAX_TOASTS; i++) toast.info(`Theme ${i}`);
		const titles = useToastStore.getState().toasts.map((t) => t.title);
		expect(titles).toHaveLength(MAX_TOASTS);
		expect(titles[0]).toBe('Save failed');
		expect(titles).not.toContain('Theme 0');
	});

	it('drops the oldest error only when every toast is an error', () => {
		for (let i = 0; i <= MAX_TOASTS; i++) toast.error(`Error ${i}`);
		const titles = useToastStore.getState().toasts.map((t) => t.title);
		expect(titles).toHaveLength(MAX_TOASTS);
		expect(titles).not.toContain('Error 0');
	});

	it('folds identical toasts into one with a count and a fresh id', () => {
		const first = toast.warn('Disk full', 'C:\\data');
		const second = toast.warn('Disk full', 'C:\\data');
		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(1);
		expect(toasts[0]).toMatchObject({ id: second, count: 2 });
		expect(second).not.toBe(first);
		toast.warn('Disk full', 'D:\\data');
		expect(useToastStore.getState().toasts).toHaveLength(2);
	});
});
