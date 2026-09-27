import { describe, expect, it } from 'vitest';

import type { TestNode, TestResult } from '@shared/ipc/channels/tests';

import {
	affectsTests,
	fileNode,
	filterTree,
	findNode,
	leafIds,
	lineTargets,
	nodeAtLine,
	openByDefault,
	statusOf,
	statusOfIds,
	visibleRows,
} from './tree-utils';

function node(
	id: string,
	kind: TestNode['kind'],
	line: number | null,
	children: TestNode[] = [],
): TestNode {
	return { id, kind, label: id.split('::').pop() ?? id, file: 'C:\\p\\t.py', line, children };
}

const cases = node('t.py::test_p', 'function', 10, [
	node('t.py::test_p[1]', 'case', 10),
	node('t.py::test_p[2]', 'case', 10),
]);
const cls = node('t.py::TestA', 'class', 20, [node('t.py::TestA::test_m', 'function', 21)]);
const file = node('t.py', 'file', null, [node('t.py::test_ok', 'function', 4), cases, cls]);

function result(id: string, outcome: TestResult['outcome']): TestResult {
	return { id, outcome, duration: 0, message: null, traceback: null, crash: null };
}

describe('leafIds', () => {
	it('lists runnable tests, expanding functions into their cases', () => {
		expect(leafIds([file])).toEqual([
			't.py::test_ok',
			't.py::test_p[1]',
			't.py::test_p[2]',
			't.py::TestA::test_m',
		]);
	});
});

describe('statusOf', () => {
	const idle = { queued: {}, current: null, results: {} };

	it('is none before anything ran', () => {
		expect(statusOf(file, idle)).toBe('none');
	});

	it('shows a failure of any child on the parent', () => {
		const results = {
			't.py::test_p[1]': result('t.py::test_p[1]', 'passed'),
			't.py::test_p[2]': result('t.py::test_p[2]', 'error'),
		};
		expect(statusOf(cases, { ...idle, results })).toBe('failed');
		expect(statusOf(file, { ...idle, results })).toBe('failed');
	});

	it('prefers running over everything, and queued over a pass', () => {
		const results = { 't.py::test_ok': result('t.py::test_ok', 'failed') };
		expect(statusOf(file, { ...idle, results, current: 't.py::TestA::test_m' })).toBe(
			'running',
		);
		expect(
			statusOfIds(['t.py::test_ok'], {
				...idle,
				results: { 't.py::test_ok': result('t.py::test_ok', 'passed') },
				queued: { 't.py::test_ok': true },
			}),
		).toBe('queued');
	});

	it('is skipped only when every test was skipped', () => {
		const skip = { 't.py::test_p[1]': result('t.py::test_p[1]', 'skipped') };
		expect(statusOf(cases, { ...idle, results: skip })).toBe('none');
		const all = { ...skip, 't.py::test_p[2]': result('t.py::test_p[2]', 'skipped') };
		expect(statusOf(cases, { ...idle, results: all })).toBe('skipped');
		const mixed = { ...skip, 't.py::test_p[2]': result('t.py::test_p[2]', 'passed') };
		expect(statusOf(cases, { ...idle, results: mixed })).toBe('passed');
	});
});

describe('filterTree', () => {
	it('keeps matching tests with their ancestors', () => {
		const out = filterTree([file], 'TEST_M');
		expect(out[0]?.children.map((n) => n.id)).toEqual(['t.py::TestA']);
		expect(out[0]?.children[0]?.children.map((n) => n.id)).toEqual(['t.py::TestA::test_m']);
	});

	it('keeps every child of a matching class', () => {
		expect(filterTree([file], 'testa')[0]?.children[0]?.children).toHaveLength(1);
	});

	it('returns everything for an empty query and nothing for a miss', () => {
		expect(filterTree([file], '  ')).toEqual([file]);
		expect(filterTree([file], 'zzz')).toEqual([]);
	});
});

describe('visibleRows', () => {
	it('opens files and classes by default and hides the cases of closed functions', () => {
		expect(visibleRows([file], openByDefault).map((r) => [r.node.id, r.depth, r.open])).toEqual(
			[
				['t.py', 0, true],
				['t.py::test_ok', 1, false],
				['t.py::test_p', 1, false],
				['t.py::TestA', 1, true],
				['t.py::TestA::test_m', 2, false],
			],
		);
	});

	it('shows the cases of an opened function', () => {
		const rows = visibleRows([file], (n) => openByDefault(n) || n.id === 't.py::test_p');
		expect(rows.filter((r) => r.node.kind === 'case').map((r) => r.depth)).toEqual([2, 2]);
	});
});

describe('affectsTests', () => {
	it('matches test modules, conftest and pytest config only', () => {
		for (const p of [
			'tests/test_a.py',
			'src\\pkg\\io_test.py',
			'conftest.py',
			'PYPROJECT.TOML',
		])
			expect(affectsTests(p), p).toBe(true);
		for (const p of ['src/model.py', 'testing.py', 'tests/data.csv'])
			expect(affectsTests(p), p).toBe(false);
	});
});

describe('findNode', () => {
	it('finds nodes at any depth by id', () => {
		expect(findNode([file], 't.py::test_p[2]')?.kind).toBe('case');
		expect(findNode([file], 't.py::TestA::test_m')?.line).toBe(21);
		expect(findNode([file], 't.py::missing')).toBeNull();
	});
});

describe('line lookups', () => {
	it('finds the file by path regardless of case and slashes', () => {
		expect(fileNode([file], 'c:/p/T.py')).toBe(file);
		expect(fileNode([file], 'c:/p/other.py')).toBeNull();
	});

	it('targets functions and classes, not individual cases', () => {
		expect(lineTargets(file).map((n) => n.id)).toEqual([
			't.py::test_ok',
			't.py::test_p',
			't.py::TestA',
			't.py::TestA::test_m',
		]);
	});

	it('picks the nearest definition at or above the line', () => {
		expect(nodeAtLine(file, 3)).toBeNull();
		expect(nodeAtLine(file, 4)?.id).toBe('t.py::test_ok');
		expect(nodeAtLine(file, 12)?.id).toBe('t.py::test_p');
		expect(nodeAtLine(file, 20)?.id).toBe('t.py::TestA');
		expect(nodeAtLine(file, 30)?.id).toBe('t.py::TestA::test_m');
	});
});
