import { beforeEach, describe, expect, it } from 'vitest';

import { dirtyCount, type OpenFile, useEditorStore } from './editor-store';

const file = (path: string, patch: Partial<OpenFile> = {}): OpenFile => ({
	path,
	name: path,
	state: 'ready',
	dirty: false,
	mtimeMs: 0,
	changedOnDisk: false,
	...patch,
});

describe('editor store', () => {
	beforeEach(() => useEditorStore.getState().reset());

	it('adding a file in the background keeps the active one', () => {
		const s = useEditorStore.getState();
		s.add(file('a.ts'));
		s.setActive('a.ts');
		s.add(file('b.ts'));
		expect(useEditorStore.getState().active).toBe('a.ts');
	});

	it('removing the active file clears it rather than guessing a neighbour', () => {
		const s = useEditorStore.getState();
		s.add(file('a.ts'));
		s.add(file('b.ts'));
		s.setActive('b.ts');
		s.remove('b.ts');
		expect(useEditorStore.getState().active).toBeNull();
	});

	it('closing an inactive tab keeps the active one', () => {
		const s = useEditorStore.getState();
		s.add(file('a.ts'));
		s.add(file('b.ts'));
		s.setActive('b.ts');
		s.remove('a.ts');
		expect(useEditorStore.getState().active).toBe('b.ts');
	});

	it('counts dirty files', () => {
		const s = useEditorStore.getState();
		s.add(file('a.ts'));
		s.add(file('b.ts', { dirty: true }));
		s.update('a.ts', { dirty: true });
		expect(dirtyCount()).toBe(2);
	});

	it("keeps each group's last cursor line independently", () => {
		const s = useEditorStore.getState();
		s.setGroupLine(0, { path: 'a.py', line: 12 });
		s.setGroupLine(1, { path: 'b.py', line: 3 });
		const before = useEditorStore.getState().groupLines;
		s.setGroupLine(0, { path: 'a.py', line: 12 });
		// An unchanged line keeps the same object, so subscribers don't re-render.
		expect(useEditorStore.getState().groupLines).toBe(before);
		s.setGroupLine(1, null);
		expect(useEditorStore.getState().groupLines).toEqual({ 0: { path: 'a.py', line: 12 } });
		s.reset();
		expect(useEditorStore.getState().groupLines).toEqual({});
	});
});
