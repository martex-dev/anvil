import { describe, expect, it } from 'vitest';

import { problemKeys } from './problems-model';
import type { Problem } from './problems-store';

const problem = (line: number, message: string): Problem => ({
	path: 'src/a.py',
	line,
	column: 1,
	message,
	severity: 'error',
	source: 'basedpyright',
});

describe('problemKeys', () => {
	it('keys a problem by its content, not its position in the list', () => {
		const b = problem(9, 'b is undefined');
		const before = problemKeys([problem(3, 'a is undefined'), b]);
		const after = problemKeys([b]);
		expect(after[0]).toBe(before[1]);
	});

	it('keeps keys unique for identical diagnostics', () => {
		const keys = problemKeys([problem(3, 'dup'), problem(3, 'dup')]);
		expect(new Set(keys).size).toBe(2);
	});
});
