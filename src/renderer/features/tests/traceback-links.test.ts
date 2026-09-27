import { describe, expect, it } from 'vitest';

import { linkify, toWorkspaceFile } from './traceback-links';

describe('linkify', () => {
	it('links pytest locations at the start of a line', () => {
		expect(
			linkify(
				'>       assert 1 == 2\nE   assert 1 == 2\n\ntests\\test_a.py:11: AssertionError',
			),
		).toEqual([
			{ text: '>       assert 1 == 2\nE   assert 1 == 2\n\n' },
			{ text: 'tests\\test_a.py:11', path: 'tests\\test_a.py', line: 11 },
			{ text: ': AssertionError' },
		]);
	});

	it('keeps spaces in absolute Windows paths', () => {
		const [first] = linkify('C:\\Users\\PC Games\\proj\\t.py:88: in import_module');
		expect(first).toEqual({
			text: 'C:\\Users\\PC Games\\proj\\t.py:88',
			path: 'C:\\Users\\PC Games\\proj\\t.py',
			line: 88,
		});
	});

	it('links native Python traceback lines', () => {
		expect(linkify('  File "src/a.py", line 3, in f')).toEqual([
			{ text: '  ' },
			{ text: 'File "src/a.py", line 3', path: 'src/a.py', line: 3 },
			{ text: ', in f' },
		]);
	});

	it('leaves other text alone', () => {
		expect(linkify('E   KeyError: x.py:3 is not a location here')).toEqual([
			{ text: 'E   KeyError: x.py:3 is not a location here' },
		]);
		expect(linkify('')).toEqual([]);
	});
});

describe('toWorkspaceFile', () => {
	const root = 'C:\\Proj';

	it('keeps relative paths inside the folder', () => {
		expect(toWorkspaceFile('tests\\test_a.py', root)).toBe('tests/test_a.py');
		expect(toWorkspaceFile('./a.py', root)).toBe('a.py');
		expect(toWorkspaceFile('../x.py', root)).toBeNull();
	});

	it('makes absolute paths inside the folder relative, ignoring case', () => {
		expect(toWorkspaceFile('c:\\proj\\src\\a.py', root)).toBe('src/a.py');
		expect(toWorkspaceFile('C:\\Python\\Lib\\os.py', root)).toBeNull();
	});

	it('has nothing to open without a folder', () => {
		expect(toWorkspaceFile('a.py', null)).toBeNull();
	});
});
