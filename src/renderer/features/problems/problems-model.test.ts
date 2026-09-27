import { describe, expect, it } from 'vitest';

import {
	compareProblems,
	groupProblems,
	problemKeys,
	SEVERITIES,
	severityCounts,
} from './problems-model';
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

describe('filtering', () => {
	const items = [
		problem(1, 'x is undefined', 'error'),
		problem(2, 'unused import', 'warning'),
		problem(3, 'hint', 'info', 'src/b.py'),
	];
	const all = new Set(SEVERITIES);

	it('counts each severity', () => {
		expect(severityCounts(items)).toEqual({ error: 1, warning: 1, info: 1 });
	});

	it('keeps only the shown severities, grouped by file', () => {
		const groups = groupProblems(items, '', new Set(['error', 'info'] as const));
		expect(groups.map(([path, ps]) => [path, ps.map((p) => p.line)])).toEqual([
			['src/a.py', [1]],
			['src/b.py', [3]],
		]);
	});

	it('matches text in the message, path or source', () => {
		expect(groupProblems(items, 'UNUSED', all)[0]?.[1].map((p) => p.line)).toEqual([2]);
		expect(groupProblems(items, 'b.py', all).map(([path]) => path)).toEqual(['src/b.py']);
		expect(groupProblems(items, 'basedpyright', all)).toHaveLength(2);
		expect(groupProblems(items, 'nothing', all)).toEqual([]);
	});
});
