import { describe, expect, it } from 'vitest';

import type { TestNode } from '@shared/ipc/channels/tests';

import { enclosingDefLines, testAtCursor } from './cursor';

const source = [
	'import pytest', // 1
	'', // 2
	'def helper():', // 3
	'    return 1', // 4
	'', // 5
	'def test_one():', // 6
	'    def inner():', // 7
	'        return 2', // 8
	'    assert inner() == 2', // 9
	'', // 10
	'class TestGroup:', // 11
	'    def test_two(self):', // 12
	'        assert True', // 13
	'', // 14
	'X = 1', // 15
];

function node(
	id: string,
	kind: TestNode['kind'],
	line: number,
	children: TestNode[] = [],
): TestNode {
	return { id, kind, label: id, file: 'C:\\p\\t.py', line, children };
}

const file = node('t.py', 'file', 1, [
	node('t.py::test_one', 'function', 6),
	node('t.py::TestGroup', 'class', 11, [node('t.py::TestGroup::test_two', 'function', 12)]),
]);

describe('enclosingDefLines', () => {
	it('lists enclosing definitions innermost first', () => {
		expect(enclosingDefLines(source, 8)).toEqual([7, 6]);
		expect(enclosingDefLines(source, 13)).toEqual([12, 11]);
	});

	it('counts the def line itself', () => {
		expect(enclosingDefLines(source, 6)).toEqual([6]);
		expect(enclosingDefLines(source, 12)).toEqual([12, 11]);
	});

	it('uses the statement above on a blank line', () => {
		expect(enclosingDefLines(source, 10)).toEqual([6]);
	});

	it('finds nothing in top-level code', () => {
		expect(enclosingDefLines(source, 15)).toEqual([]);
		expect(enclosingDefLines(source, 1)).toEqual([]);
	});
});

describe('testAtCursor', () => {
	it('skips helpers nested in a test and returns the test', () => {
		expect(testAtCursor(file, source, 8)?.id).toBe('t.py::test_one');
	});

	it('returns the method, or the class on its own line', () => {
		expect(testAtCursor(file, source, 13)?.id).toBe('t.py::TestGroup::test_two');
		expect(testAtCursor(file, source, 11)?.id).toBe('t.py::TestGroup');
	});

	it('returns nothing inside a helper that is not a test', () => {
		expect(testAtCursor(file, source, 4)).toBeNull();
	});
});
