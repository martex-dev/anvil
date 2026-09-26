import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';

const editor = { setPosition: vi.fn(), revealLineInCenter: vi.fn() };
let current: typeof editor | null = editor;
vi.mock('../../lib/monaco/editors', () => ({ focusedEditor: () => current }));
const nextBookmarkLine = vi.fn((_editor: unknown): number | null => null);
vi.mock('./extras/bookmarks', () => ({
	nextBookmarkLine: (e: unknown) => nextBookmarkLine(e),
	toggleBookmarkAt: vi.fn(),
}));
vi.mock('./extras/git-lines', () => ({ isBlameEnabled: vi.fn(), setBlameEnabled: vi.fn() }));
vi.mock('./extras/shield', () => ({ repaintShield: vi.fn() }));
vi.mock('./file-ops', () => ({ isScratch: vi.fn(), saveAll: vi.fn(), saveFile: vi.fn() }));
vi.mock('./open', () => ({ closeTab: vi.fn() }));
vi.mock('./new-file', () => ({ newFile: vi.fn() }));
vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));
vi.mock('../../lib/monaco/workspace-root', () => ({ toWorkspacePath: vi.fn() }));
vi.mock('../../app/hooks/use-settings', () => ({
	getSettings: () => ({}),
	updateSettings: vi.fn(),
}));

const { EDITOR_COMMANDS } = await import('./commands');

async function run(id: string): Promise<void> {
	const command = EDITOR_COMMANDS.find((c) => c.id === id);
	if (!command) throw new Error(`no command ${id}`);
	await command.run();
}
const lastToast = () => useToastStore.getState().toasts.at(-1);

describe('editor commands', () => {
	beforeEach(() => {
		current = editor;
		editor.setPosition.mockClear();
		useToastStore.setState({ toasts: [] });
	});

	it('jumps to the next bookmark', async () => {
		nextBookmarkLine.mockReturnValueOnce(12);
		await run('edit.nextBookmark');
		expect(editor.setPosition).toHaveBeenCalledWith({ lineNumber: 12, column: 1 });
	});

	it('says so when there is no bookmark to jump to', async () => {
		await run('edit.nextBookmark');
		expect(editor.setPosition).not.toHaveBeenCalled();
		expect(lastToast()?.title).toBe('No bookmarks in this file');
	});

	it('asks for a file outside an editor', async () => {
		current = null;
		await run('edit.nextBookmark');
		expect(lastToast()?.title).toBe('Open a file first');
	});
});
