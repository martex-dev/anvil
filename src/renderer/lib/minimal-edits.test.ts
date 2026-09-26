import { describe, expect, it } from 'vitest';

import { minimalEdits, type TextEdit } from './minimal-edits';

/** Applies edits (non-overlapping, in old coordinates) the way Monaco does. */
function apply(lines: readonly string[], edits: readonly TextEdit[], eol = '\n'): string {
	const offsets: number[] = [];
	let total = 0;
	for (const line of lines) {
		offsets.push(total);
		total += line.length + eol.length;
	}
	const at = (line: number, column: number): number => (offsets[line - 1] ?? 0) + column - 1;
	let text = lines.join(eol);
	const sorted = [...edits].sort(
		(x, y) =>
			at(y.range.startLineNumber, y.range.startColumn) -
			at(x.range.startLineNumber, x.range.startColumn),
	);
	for (const e of sorted) {
		const start = at(e.range.startLineNumber, e.range.startColumn);
		const end = at(e.range.endLineNumber, e.range.endColumn);
		text = text.slice(0, start) + e.text + text.slice(end);
	}
	return text;
}

const cases: Array<[string, string, string]> = [
	['trims trailing whitespace', 'a  \nb\nc\t\n', 'a\nb\nc\n'],
	['adds a final newline', 'a\nb', 'a\nb\n'],
	['inserts lines in the middle', 'a\nd', 'a\nb\nc\nd'],
	['inserts lines at the top', 'c\nd', 'a\nb\nc\nd'],
	['deletes lines in the middle', 'a\nb\nc\nd', 'a\nd'],
	['deletes lines at the end', 'a\nb\nc', 'a'],
	['deletes everything', 'a\nb', ''],
	['replaces a block with more lines', 'a\nx\nd', 'a\nb\nc\nd'],
	[
		'reformats code',
		'def f( x ):\n  return x\n\n\n\ny=1\n',
		'def f(x):\n    return x\n\n\ny = 1\n',
	],
];

describe('minimalEdits', () => {
	it.each(cases)('%s', (_name, before, after) => {
		const lines = before.split('\n');
		const edits = minimalEdits(lines, after, '\n');
		expect(edits).not.toBeNull();
		expect(apply(lines, edits ?? [])).toBe(after);
	});

	it('only touches the changed characters of a line', () => {
		expect(minimalEdits(['keep', 'x = 1   ', 'keep'], 'keep\nx = 1\nkeep', '\n')).toEqual([
			{
				range: { startLineNumber: 2, startColumn: 6, endLineNumber: 2, endColumn: 9 },
				text: '',
			},
		]);
	});

	it('keeps CRLF files CRLF', () => {
		const lines = ['a', 'b'];
		const edits = minimalEdits(lines, 'a\r\nx\r\ny\r\nb', '\r\n') ?? [];
		expect(apply(lines, edits, '\r\n')).toBe('a\r\nx\r\ny\r\nb');
	});
});
