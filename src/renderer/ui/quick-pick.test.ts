import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../stores/toast-store';
import { quickPick } from './QuickPick';

vi.mock('../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

beforeEach(() => useToastStore.setState({ toasts: [] }));

describe('quickPick', () => {
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
