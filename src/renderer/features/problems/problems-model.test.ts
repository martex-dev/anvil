import { describe, expect, it } from 'vitest';

import { compareProblems, problemKeys } from './problems-model';
import type { Problem } from './problems-store';

const problem = (
	line: number,
	message: string,
	severity: Problem['severity'] = 'error',
	path = 'src/a.py',
): Problem => ({ path, line, column: 1, message, severity, source: 'basedpyright' });

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

describe('compareProblems', () => {
	it('orders by file, then errors, warnings and infos, then line', () => {
		const items = [
			problem(1, 'i', 'info'),
			problem(5, 'w2', 'warning'),
			problem(9, 'e', 'error'),
			problem(2, 'w1', 'warning'),
			problem(1, 'other', 'info', 'src/0.py'),
		];
		expect(items.sort(compareProblems).map((p) => p.message)).toEqual([
			'other',
			'e',
			'w1',
			'w2',
			'i',
		]);
	});

	it('is antisymmetric for warnings and infos', () => {
		const w = problem(1, 'w', 'warning');
		const i = problem(1, 'i', 'info');
		expect(compareProblems(w, i)).toBeLessThan(0);
		expect(compareProblems(i, w)).toBeGreaterThan(0);
	});
});
