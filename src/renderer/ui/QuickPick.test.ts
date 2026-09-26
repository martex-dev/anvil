import { beforeEach, describe, expect, it, vi } from 'vitest';

import { quickPick, useQuickPickStore } from './QuickPick';

vi.mock('@renderer/lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const deferred = <T>(): {
	promise: Promise<T>;
	resolve: (v: T) => void;
	reject: (e: unknown) => void;
} => {
	let resolve: (v: T) => void = () => undefined;
	let reject: (e: unknown) => void = () => undefined;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

beforeEach(() =>
	useQuickPickStore.setState({ request: null, items: null, query: '', active: '', error: null }),
);

describe('quickPick', () => {
	it('ignores items that arrive after a newer picker opened', async () => {
		const branches = deferred<{ id: string; label: string }[]>();
		void quickPick({ title: 'Branch', placeholder: '', items: branches.promise });
		void quickPick({ title: 'Model', placeholder: '', items: [{ id: 'm', label: 'model' }] });
		branches.resolve([{ id: 'main', label: 'main' }]);
		await branches.promise;
		await Promise.resolve();
		expect(useQuickPickStore.getState().items?.map((i) => i.id)).toEqual(['m']);
	});

	it('keeps the load error to show instead of an empty list', async () => {
		const load = deferred<{ id: string; label: string }[]>();
		void quickPick({ title: 'Branch', placeholder: '', items: load.promise });
		load.reject(new Error('git is not installed'));
		await load.promise.catch(() => undefined);
		await Promise.resolve();
		expect(useQuickPickStore.getState()).toMatchObject({
			items: [],
			error: 'git is not installed',
		});
	});
});
