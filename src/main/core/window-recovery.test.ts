import { EventEmitter } from 'node:events';

import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogs = vi.hoisted(() => ({
	response: 0,
	calls: [] as Array<{ message: string; cancelId: number }>,
}));
vi.mock('electron', () => ({
	dialog: {
		showMessageBox: vi.fn(
			async (_win: unknown, options: { message: string; cancelId: number }) => {
				dialogs.calls.push(options);
				return { response: dialogs.response };
			},
		),
	},
}));
vi.mock('electron-log/main', () => ({
	default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { watchRenderer } = await import('./window-recovery');

function fakeWindow(): {
	win: BrowserWindow;
	events: EventEmitter;
	contents: EventEmitter;
	show: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
} {
	const events = new EventEmitter();
	const contents = new EventEmitter();
	const show = vi.fn();
	const close = vi.fn();
	const win = Object.assign(events, {
		webContents: contents,
		isDestroyed: () => false,
		show,
		close,
	}) as unknown as BrowserWindow;
	return { win, events, contents, show, close };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	dialogs.response = 0;
	dialogs.calls = [];
});

describe('watchRenderer', () => {
	it('shows the hidden window and reloads after a failed load', async () => {
		const { win, contents, show } = fakeWindow();
		const reload = vi.fn();
		watchRenderer(win, reload);
		contents.emit('did-fail-load', {}, -102, 'ERR_CONNECTION_REFUSED', 'app://anvil/', true);
		await settle();
		expect(show).toHaveBeenCalled();
		expect(dialogs.calls[0]?.message).toMatch(/could not load/);
		expect(reload).toHaveBeenCalledOnce();
	});

	it('ignores aborted loads and subframes', async () => {
		const { win, contents } = fakeWindow();
		watchRenderer(win, vi.fn());
		contents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'app://anvil/', true);
		contents.emit(
			'did-fail-load',
			{},
			-102,
			'ERR_CONNECTION_REFUSED',
			'https://x.test/',
			false,
		);
		await settle();
		expect(dialogs.calls).toEqual([]);
	});

	it('closes the window when the user picks Close after a crash', async () => {
		const { win, contents, close } = fakeWindow();
		const reload = vi.fn();
		dialogs.response = 1;
		watchRenderer(win, reload);
		contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
		contents.emit('render-process-gone', {}, { reason: 'clean-exit', exitCode: 0 });
		await settle();
		expect(dialogs.calls).toHaveLength(1);
		expect(close).toHaveBeenCalledOnce();
		expect(reload).not.toHaveBeenCalled();
	});

	it('asks once per hang, and Escape means keep waiting', async () => {
		const { win, events } = fakeWindow();
		const reload = vi.fn();
		watchRenderer(win, reload);
		events.emit('unresponsive');
		events.emit('unresponsive');
		await settle();
		expect(dialogs.calls).toHaveLength(1);
		expect(dialogs.calls[0]?.cancelId).toBe(0);
		expect(reload).not.toHaveBeenCalled();
	});
});
