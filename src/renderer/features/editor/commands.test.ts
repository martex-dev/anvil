import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '../../stores/toast-store';

const model = { uri: {} };
const editor = { setPosition: vi.fn(), revealLineInCenter: vi.fn(), getModel: () => model };
let current: typeof editor | null = editor;
vi.mock('../../lib/monaco/editors', () => ({ focusedEditor: () => current }));
const nextBookmarkLine = vi.fn((_editor: unknown): number | null => null);
vi.mock('./extras/bookmarks', () => ({
	nextBookmarkLine: (e: unknown) => nextBookmarkLine(e),
	toggleBookmarkAt: vi.fn(),
}));
vi.mock('./extras/shield', () => ({ repaintShield: vi.fn() }));
vi.mock('./file-ops', () => ({
	isScratch: (path: string | null) => path === '__scratch__',
	saveAll: vi.fn(),
	saveFile: vi.fn(),
}));
vi.mock('./open', () => ({ closeTab: vi.fn() }));
vi.mock('./new-file', () => ({ newFile: vi.fn() }));
vi.mock('../../lib/ipc', () => ({
	call: (_channel: string, input: { path: string }) => Promise.resolve(`C:\\proj\\${input.path}`),
}));
let workspacePath: string | null = null;
vi.mock('../../lib/monaco/workspace-root', () => ({ toWorkspacePath: () => workspacePath }));
const writeText = vi.fn((_text: string) => Promise.resolve());
vi.stubGlobal('navigator', { clipboard: { writeText: (text: string) => writeText(text) } });
let settings: Record<string, unknown> = {};
const updateSettings = vi.fn((_patch: Record<string, unknown>) => Promise.resolve());
vi.mock('../../app/hooks/use-settings', () => ({
	getSettings: () => settings,
	updateSettings: (patch: Record<string, unknown>) => updateSettings(patch),
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

	it('copies the absolute path of the active file', async () => {
		workspacePath = 'bot.py';
		await run('file.copyPath');
		expect(writeText).toHaveBeenCalledWith('C:\\proj\\bot.py');
		expect(lastToast()?.title).toBe('Path copied');
	});

	it('has no path to copy on the scratchpad', async () => {
		workspacePath = null;
		writeText.mockClear();
		await run('file.copyPath');
		expect(writeText).not.toHaveBeenCalled();
		expect(lastToast()?.title).toBe('Open a file first');
	});

	it('saves the inline blame toggle as a setting', async () => {
		settings = { inlineBlame: true };
		await run('git.toggleBlame');
		expect(updateSettings).toHaveBeenCalledWith({ inlineBlame: false });
		expect(lastToast()?.title).toBe('Inline blame off');
	});
});
