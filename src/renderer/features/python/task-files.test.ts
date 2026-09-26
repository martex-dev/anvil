import { describe, expect, it } from 'vitest';

import { touchesTaskFiles } from './task-files';

describe('touchesTaskFiles', () => {
	it('reacts to edits of top-level task sources', () => {
		expect(touchesTaskFiles({ dirs: [], files: ['package.json'] })).toBe(true);
		expect(touchesTaskFiles({ dirs: [], files: ['Makefile'] })).toBe(true);
		expect(touchesTaskFiles({ dirs: [], files: ['pyproject.toml'] })).toBe(true);
		expect(touchesTaskFiles({ dirs: [], files: ['uv.lock'] })).toBe(true);
	});

	it('reacts to anything added or removed at the top level', () => {
		expect(touchesTaskFiles({ dirs: [''], files: [] })).toBe(true);
	});

	it('ignores other files and nested task-like names', () => {
		expect(touchesTaskFiles({ dirs: ['src'], files: ['src/main.py'] })).toBe(false);
		expect(touchesTaskFiles({ dirs: [], files: ['packages/a/package.json'] })).toBe(false);
		expect(touchesTaskFiles({ dirs: [], files: ['main.py'] })).toBe(false);
	});
});
