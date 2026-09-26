import type * as Monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';

import { requireEditor } from './edit-actions';
import { runEditorAction } from './editor-actions';

vi.mock('./edit-actions', () => ({ requireEditor: vi.fn(), insertAtCursors: vi.fn() }));
vi.mock('../../lib/monaco/load', () => ({ getLoadedMonaco: () => null }));
vi.mock('../../stores/toast-store', () => ({ toast: { warn: vi.fn() } }));
vi.mock('../../ui/QuickPick', () => ({ quickPick: vi.fn() }));

describe('runEditorAction', () => {
	it('passes an action failure on to the caller', async () => {
		const editor = {
			getAction: () => ({ run: () => Promise.reject(new Error('read-only')) }),
		};
		vi.mocked(requireEditor).mockReturnValue(
			editor as unknown as Monaco.editor.IStandaloneCodeEditor,
		);
		await expect(runEditorAction('editor.action.indentationToTabs')).rejects.toThrow(
			'read-only',
		);
	});
});
