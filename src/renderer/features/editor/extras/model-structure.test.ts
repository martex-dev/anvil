import { describe, expect, it } from 'vitest';

import { cellsOf, linesOf, outlineOf } from './model-structure';

/** A text model stand-in that counts how often its text is read. */
function fakeModel(initial: string[], language = 'python') {
	let lines = initial;
	let version = 1;
	const model = {
		reads: 0,
		getVersionId: () => version,
		getLanguageId: () => language,
		getLinesContent: () => {
			model.reads++;
			return [...lines];
		},
		edit(next: string[]) {
			lines = next;
			version++;
		},
	};
	return model;
}

describe('model structure cache', () => {
	it('parses once per version, however often the cursor asks', () => {
		const model = fakeModel(['# %% A', 'a = 1', '# %% B', 'def f():', '\tpass']);
		for (let i = 0; i < 5; i++) {
			expect(cellsOf(model)).toHaveLength(2);
			expect(outlineOf(model).length).toBeGreaterThan(0);
			expect(linesOf(model)).toHaveLength(5);
		}
		expect(model.reads).toBe(1);
		model.edit(['# %% A', 'a = 1']);
		expect(cellsOf(model)).toHaveLength(1);
		expect(model.reads).toBe(2);
	});

	it('has no cells outside Python', () => {
		const model = fakeModel(['# %% A', 'x'], 'markdown');
		expect(cellsOf(model)).toEqual([]);
	});
});
