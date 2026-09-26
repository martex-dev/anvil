import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../stores/toast-store';
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

beforeEach(() => {
	useQuickPickStore.setState({ request: null, items: null, query: '', active: '', error: null });
	useToastStore.setState({ toasts: [] });
});

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

	it('closes and reports the reason when its items fail to load', async () => {
		const picked = quickPick({
			title: 'branch',
			placeholder: 'Switch branch',
			loadErrorTitle: 'Could not list branches',
			items: Promise.reject(new Error('fatal: not a git repository')),
		});
		await expect(picked).resolves.toBeNull();
		expect(useToastStore.getState().toasts).toMatchObject([
			{
				tone: 'error',
				title: 'Could not list branches',
				description: 'fatal: not a git repository',
			},
		]);
	});

	it('leaves a newer picker open when an older one fails late', async () => {
		let fail: (error: Error) => void = () => undefined;
		const first = quickPick({
			title: 'log',
			placeholder: 'Recent commits',
			items: new Promise((_, reject) => {
				fail = reject;
			}),
		});
		const second = quickPick({ title: 'theme', placeholder: 'Theme', items: [] });
		// Opening the second picker dismissed the first.
		await expect(first).resolves.toBeNull();
		fail(new Error('late'));
		await Promise.resolve();
		await Promise.resolve();
		let settled = false;
		void second.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
	});
});
