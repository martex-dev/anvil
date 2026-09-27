import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorStore } from './editor-store';
import { askToSave } from './unsaved';

vi.mock('./file-ops', () => ({ saveFile: vi.fn(() => Promise.resolve(true)) }));

const file = (path: string, dirty: boolean) => ({
	path,
	name: path,
	state: 'ready' as const,
	dirty,
	mtimeMs: 0,
	changedOnDisk: false,
});

describe('askToSave', () => {
	beforeEach(() => {
		useEditorStore.getState().reset();
		useEditorStore.getState().add(file('a.py', true));
		useEditorStore.getState().add(file('b.py', false));
	});

	it('goes ahead without asking when none of the files are dirty', async () => {
		await expect(askToSave(['b.py', 'missing.py'], 'closing')).resolves.toBe(true);
		expect(useEditorStore.getState().unsaved).toBeNull();
	});

	it('asks only about the dirty files and clears the prompt once answered', async () => {
		const answer = askToSave(['a.py', 'b.py'], 'closing the window');
		const prompt = useEditorStore.getState().unsaved;
		expect(prompt?.paths).toEqual(['a.py']);
		expect(prompt?.action).toBe('closing the window');
		prompt?.resolve(true);
		await expect(answer).resolves.toBe(true);
		expect(useEditorStore.getState().unsaved).toBeNull();
	});

	it('a newer prompt cancels the one still open', async () => {
		const first = askToSave(['a.py'], 'closing');
		const second = askToSave(['a.py'], 'closing the window');
		await expect(first).resolves.toBe(false);
		expect(useEditorStore.getState().unsaved?.action).toBe('closing the window');
		useEditorStore.getState().unsaved?.resolve(false);
		await expect(second).resolves.toBe(false);
	});
});
