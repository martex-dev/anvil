import { describe, expect, it } from 'vitest';

import { testAtLine } from './test-at-cursor';

const source = [
	'import pytest', // 1
	'', // 2
	'def helper():', // 3
	'    return 1', // 4
	'', // 5
	'def test_top():', // 6
	'    x = helper()', // 7
	'    def inner():', // 8
	'        return 2', // 9
	'    assert x == 1', // 10
	'', // 11
	'class TestMath:', // 12
	'    def setup_method(self):', // 13
	'        pass', // 14
	'', // 15
	'    async def test_add(self):', // 16
	'        assert 1 + 1 == 2', // 17
	'', // 18
	'class Helpers:', // 19
	'    def test_not_collected(self):', // 20
	'        pass', // 21
];

describe('testAtLine', () => {
	it('finds a module-level test from its body, a nested helper or a blank line after it', () => {
		expect(testAtLine(source, 6)).toBe('test_top');
		expect(testAtLine(source, 7)).toBe('test_top');
		expect(testAtLine(source, 9)).toBe('test_top');
		expect(testAtLine(source, 11)).toBe('test_top');
	});

	it('names class-based tests as Class::method', () => {
		expect(testAtLine(source, 17)).toBe('TestMath::test_add');
		expect(testAtLine(source, 16)).toBe('TestMath::test_add');
	});

	it('returns null outside tests and in classes pytest does not collect', () => {
		expect(testAtLine(source, 1)).toBeNull();
		expect(testAtLine(source, 4)).toBeNull();
		expect(testAtLine(source, 14)).toBeNull();
		expect(testAtLine(source, 12)).toBeNull();
		expect(testAtLine(source, 21)).toBeNull();
	});

	it('handles tab indentation', () => {
		expect(testAtLine(['class TestA:', '\tdef test_b(self):', '\t\tpass'], 3)).toBe(
			'TestA::test_b',
		);
	});
});
