import { describe, expect, it } from 'vitest';

import { updateCheckToast } from './update-text';

describe('updateCheckToast', () => {
	it('reports a failed check as an error with its message', () => {
		expect(updateCheckToast({ state: 'error', message: 'offline', lastChecked: null })).toEqual(
			{ tone: 'error', title: 'Update check failed', description: 'offline' },
		);
	});

	it('names the version being downloaded or ready', () => {
		expect(updateCheckToast({ state: 'downloading', version: '0.3.0', percent: 42 })).toEqual({
			tone: 'info',
			title: 'Anvil 0.3.0 is available',
			description: 'Downloading: 42%',
		});
		expect(updateCheckToast({ state: 'ready', version: '0.3.0' }).title).toBe(
			'Anvil 0.3.0 is ready',
		);
	});

	it('never shows a raw state name', () => {
		const t = updateCheckToast({ state: 'checking' });
		expect(t.description).not.toBe('checking');
	});
});
