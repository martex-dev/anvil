import { describe, expect, it, vi } from 'vitest';

const runEditorAction = vi.fn((_id: string) => Promise.resolve());
vi.mock('./editor-actions', () => ({ runEditorAction: (id: string) => runEditorAction(id) }));
const updateSettings = vi.fn((_patch: unknown) => Promise.resolve());
vi.mock('../../app/hooks/use-settings', () => ({
	getSettings: () => ({ minimap: true }),
	updateSettings: (patch: unknown) => updateSettings(patch),
}));

import { BUILTIN_EDITOR_COMMANDS } from './builtin-commands';

const byId = (id: string) => BUILTIN_EDITOR_COMMANDS.find((c) => c.id === id);

describe('built-in editor commands', () => {
	it('never bind keys Monaco already handles', () => {
		for (const c of BUILTIN_EDITOR_COMMANDS) expect(c.shortcut, c.id).toBeUndefined();
	});

	it('run the matching Monaco action on the focused editor', async () => {
		await byId('editor.renameSymbol')?.run();
		await byId('go.peekDefinition')?.run();
		expect(runEditorAction.mock.calls.map(([id]) => id)).toEqual([
			'editor.action.rename',
			'editor.action.peekDefinition',
		]);
	});

	it('toggles the minimap setting', async () => {
		await byId('view.toggleMinimap')?.run();
		expect(updateSettings).toHaveBeenCalledWith({ minimap: false });
	});
});
