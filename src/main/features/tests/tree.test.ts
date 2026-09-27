import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ItemRecord } from './reporter';
import { buildTree, displayPath, indexTree, runArgs } from './tree';

const root = resolve('/work/proj');
const file = join(root, 'tests', 'test_a.py');

function item(
	nodeid: string,
	line: number | null,
	classes: ItemRecord['classes'] = [],
): ItemRecord {
	return { t: 'item', nodeid, file, line, classes };
}

const items: ItemRecord[] = [
	item('tests/test_a.py::test_ok', 4),
	item('tests/test_a.py::test_param[1]', 14),
	item('tests/test_a.py::test_param[a::b]', 14),
	item('tests/test_a.py::TestGroup::TestInner::test_nested', 40, [
		{ nodeid: 'tests/test_a.py::TestGroup', line: 38 },
		{ nodeid: 'tests/test_a.py::TestGroup::TestInner', line: 39 },
	]),
	item('tests/test_a.py::TestGroup::test_method', 43, [
		{ nodeid: 'tests/test_a.py::TestGroup', line: 38 },
	]),
];

describe('buildTree', () => {
	const tree = buildTree(items, root);

	it('groups tests under their file with a root-relative label', () => {
		expect(tree).toHaveLength(1);
		expect(tree[0]).toMatchObject({
			id: 'tests/test_a.py',
			kind: 'file',
			label: 'tests/test_a.py',
			line: null,
		});
		expect(tree[0]?.children.map((n) => n.label)).toEqual([
			'test_ok',
			'test_param',
			'TestGroup',
		]);
	});

	it('nests parametrized cases under their function, even with :: in the params', () => {
		const fn = tree[0]?.children[1];
		expect(fn).toMatchObject({ id: 'tests/test_a.py::test_param', kind: 'function', line: 14 });
		expect(fn?.children.map((n) => [n.label, n.kind, n.id])).toEqual([
			['[1]', 'case', 'tests/test_a.py::test_param[1]'],
			['[a::b]', 'case', 'tests/test_a.py::test_param[a::b]'],
		]);
	});

	it('nests classes (and inner classes) with their own lines', () => {
		const group = tree[0]?.children[2];
		expect(group).toMatchObject({ kind: 'class', label: 'TestGroup', line: 38 });
		expect(group?.children.map((n) => [n.label, n.kind, n.line])).toEqual([
			['TestInner', 'class', 39],
			['test_method', 'function', 43],
		]);
		expect(group?.children[0]?.children[0]).toMatchObject({
			id: 'tests/test_a.py::TestGroup::TestInner::test_nested',
			label: 'test_nested',
			line: 40,
		});
	});

	it('keeps the file id as label when the file is outside the root', () => {
		const outside = buildTree(
			[{ ...item('../x/test_b.py::test_y', 1), file: resolve('/elsewhere/x/test_b.py') }],
			root,
		);
		expect(outside[0]?.label).toBe('../x/test_b.py');
	});
});

describe('displayPath', () => {
	it('uses forward slashes inside the root and null outside it', () => {
		expect(displayPath(file, root)).toBe('tests/test_a.py');
		expect(displayPath(resolve('/work/other.py'), root)).toBeNull();
		expect(displayPath(root, root)).toBeNull();
	});
});

describe('runArgs', () => {
	const index = indexTree(buildTree(items, root));

	it('maps known ids of any level to paths relative to the root', () => {
		const { args, unknown } = runArgs(
			['tests/test_a.py', 'tests/test_a.py::TestGroup', 'tests/test_a.py::test_param[a::b]'],
			[],
			index,
			root,
		);
		expect(args).toEqual([
			'tests/test_a.py',
			'tests/test_a.py::TestGroup',
			'tests/test_a.py::test_param[a::b]',
		]);
		expect(unknown).toEqual([]);
	});

	it('refuses ids that discovery never produced', () => {
		const { args, unknown } = runArgs(
			['--collect-only', 'tests/test_a.py::nope'],
			[],
			index,
			root,
		);
		expect(args).toEqual([]);
		expect(unknown).toEqual(['--collect-only', 'tests/test_a.py::nope']);
	});

	it('accepts Python files inside the workspace only', () => {
		const { args, unknown } = runArgs(
			[],
			[
				join(root, 'tests', 'test_new.py'),
				join(root, '..', 'evil.py'),
				join(root, 'notes.txt'),
			],
			index,
			root,
		);
		expect(args).toEqual(['tests/test_new.py']);
		expect(unknown).toHaveLength(2);
	});

	it('keeps a file named like an option from reading as one', () => {
		const { args } = runArgs([], [join(root, '-k.py')], index, root);
		expect(args).toEqual(['./-k.py']);
	});

	it('drops duplicates', () => {
		expect(runArgs(['tests/test_a.py', 'tests/test_a.py'], [file], index, root).args).toEqual([
			'tests/test_a.py',
		]);
	});
});
