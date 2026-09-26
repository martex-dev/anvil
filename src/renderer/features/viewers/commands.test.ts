import { afterEach, describe, expect, it, vi } from 'vitest';

import { type DiffPayload, useTabsStore } from '../../stores/tabs-store';
import { useToastStore } from '../../stores/toast-store';
import { VIEWER_COMMANDS } from './commands';
import { registerViewer, type ViewerActions } from './viewer-actions';

function run(id: string): void {
	const command = VIEWER_COMMANDS.find((c) => c.id === id);
	if (!command) throw new Error(`missing ${id}`);
	void command.run();
}

function fakeImage(): ViewerActions['image'] {
	return {
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		fit: vi.fn(),
		actualSize: vi.fn(),
		reload: vi.fn(),
	};
}

afterEach(() => useTabsStore.getState().reset());

describe('viewer commands', () => {
	it('act on the image in the focused tab', () => {
		const image = fakeImage();
		const unregister = registerViewer('image', 'plot.png', image);
		useTabsStore
			.getState()
			.open({ id: 'image:plot.png', kind: 'image', path: 'plot.png', title: 'plot.png' });
		run('image.zoomIn');
		run('image.fit');
		expect(image.zoomIn).toHaveBeenCalledOnce();
		expect(image.fit).toHaveBeenCalledOnce();
		unregister();
	});

	it('find a diff viewer by the payload its tab holds', () => {
		const diff: DiffPayload = {
			title: 'bot.py',
			original: 'a',
			modified: 'b',
			language: null,
			path: null,
		};
		const viewer = { toggleInline: vi.fn() };
		const unregister = registerViewer('diff', diff, viewer);
		useTabsStore
			.getState()
			.open({ id: 'diff:1', kind: 'diff', path: null, title: 'bot.py', diff });
		run('diff.toggleInline');
		expect(viewer.toggleInline).toHaveBeenCalledOnce();
		unregister();
	});

	it('explain themselves when another kind of tab is focused', () => {
		const image = fakeImage();
		const unregister = registerViewer('image', 'plot.png', image);
		useTabsStore
			.getState()
			.open({ id: 'code:plot.png', kind: 'code', path: 'plot.png', title: 'plot.png' });
		run('image.reload');
		expect(image.reload).not.toHaveBeenCalled();
		expect(useToastStore.getState().toasts.at(-1)?.title).toMatch(/image/);
		unregister();
	});

	it('keep a newer registration when a stale viewer cleans up', () => {
		const first = { reload: vi.fn(), editSource: vi.fn() };
		const second = { reload: vi.fn(), editSource: vi.fn() };
		const unregisterFirst = registerViewer('markdown', 'README.md', first);
		const unregisterSecond = registerViewer('markdown', 'README.md', second);
		unregisterFirst();
		useTabsStore
			.getState()
			.open({ id: 'md:README.md', kind: 'markdown', path: 'README.md', title: 'README.md' });
		run('markdown.editSource');
		expect(second.editSource).toHaveBeenCalledOnce();
		expect(first.editSource).not.toHaveBeenCalled();
		unregisterSecond();
	});
});
