import type * as Monaco from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';

class IpcCallError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}
const call = vi.fn();
vi.mock('../../lib/ipc', () => ({
	call: (...args: unknown[]): unknown => call(...args),
	IpcCallError,
}));
vi.mock('../../app/hooks/use-settings', () => ({ getSettings: () => ({}) }));

const { formatPython } = await import('./format');

const model = { getValue: () => 'x=1\n' } as unknown as Monaco.editor.ITextModel;
const warnings = (): string[] =>
	useToastStore
		.getState()
		.toasts.filter((t) => t.tone === 'warn')
		.map((t) => t.title);

describe('formatPython', () => {
	beforeEach(() => {
		useToastStore.setState({ toasts: [] });
		call.mockReset();
	});

	it('keeps one format warning on screen across repeated saves', async () => {
		call.mockRejectedValue(new IpcCallError('PY_FORMAT_FAILED', 'error: invalid syntax'));
		expect(await formatPython('a.py', model, { onSave: true })).toBe(false);
		expect(await formatPython('a.py', model, { onSave: true })).toBe(false);
		expect(warnings()).toEqual(['Format skipped']);
	});

	it('reports a missing ruff on save once per session, but always when asked to format', async () => {
		call.mockRejectedValue(new IpcCallError('PY_NO_RUFF', 'ruff is not installed.'));
		await formatPython('a.py', model, { onSave: true });
		await formatPython('a.py', model, { onSave: true });
		expect(warnings()).toEqual(['Format on save needs ruff']);
		useToastStore.setState({ toasts: [] });
		await formatPython('a.py', model, { onSave: true });
		expect(warnings()).toEqual([]);
		await formatPython('a.py', model);
		expect(warnings()).toEqual(['Format skipped']);
	});
});
