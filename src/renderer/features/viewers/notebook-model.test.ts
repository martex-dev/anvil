import { describe, expect, it } from 'vitest';

import {
	applyCarriageReturns,
	joinSource,
	notebookToScript,
	parseNotebook,
	scriptFileName,
	stripAnsi,
} from './notebook-model';

function nb(cells: unknown[], metadata: unknown = {}): string {
	return JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata, cells });
}

describe('stripAnsi', () => {
	it('removes color codes from IPython tracebacks', () => {
		expect(stripAnsi('\u001b[0;31mValueError\u001b[0m: bad')).toBe('ValueError: bad');
		expect(stripAnsi('\u001b[1;32m---> 1\u001b[39m x')).toBe('---> 1 x');
	});

	it('removes OSC hyperlinks and leaves plain text alone', () => {
		expect(stripAnsi('\u001b]8;;https://x.io\u0007link\u001b]8;;\u0007')).toBe('link');
		expect(stripAnsi('a [1] b')).toBe('a [1] b');
	});
});

describe('applyCarriageReturns', () => {
	it('keeps only the last frame of a progress bar line', () => {
		expect(applyCarriageReturns(' 10%|#\r 50%|###\r100%|#####\nok\n')).toBe('100%|#####\nok\n');
	});

	it('treats CRLF as a plain newline', () => {
		expect(applyCarriageReturns('a\r\nb')).toBe('a\nb');
	});
});

describe('parseNotebook', () => {
	it('reads metadata and joins string[] sources', () => {
		const parsed = parseNotebook(
			nb(
				[
					{ cell_type: 'markdown', source: ['# Title\n', 'text'] },
					{
						cell_type: 'code',
						id: 'abc',
						source: 'x = 1',
						execution_count: 3,
						outputs: [],
					},
				],
				{
					kernelspec: { display_name: 'Python 3 (ipykernel)', language: 'python' },
					language_info: { name: 'Python' },
				},
			),
		);
		expect(parsed.kernel).toBe('Python 3 (ipykernel)');
		expect(parsed.language).toBe('python');
		expect(parsed.cells).toHaveLength(2);
		expect(parsed.cells[0]).toMatchObject({ kind: 'markdown', source: '# Title\ntext' });
		expect(parsed.cells[1]).toMatchObject({ id: 'abc', executionCount: 3 });
	});

	it('prefers images, never renders HTML, and falls back to text/plain', () => {
		const parsed = parseNotebook(
			nb([
				{
					cell_type: 'code',
					source: '',
					execution_count: 1,
					outputs: [
						{
							output_type: 'display_data',
							data: { 'image/png': 'iVBO\nRw0=', 'text/plain': '<Figure>' },
						},
						{
							output_type: 'execute_result',
							data: {
								'text/html': '<script>x()</script>',
								'text/plain': ['   a\n', '0  1'],
							},
						},
						{ output_type: 'display_data', data: { 'image/svg+xml': '<svg/>' } },
						{ output_type: 'display_data', data: { 'text/html': '<b>x</b>' } },
					],
				},
			]),
		);
		const outputs = parsed.cells[0]?.outputs ?? [];
		expect(outputs[0]).toEqual({
			kind: 'image',
			mime: 'image/png',
			src: 'data:image/png;base64,iVBORw0=',
		});
		expect(outputs[1]).toEqual({ kind: 'text', text: '   a\n0  1' });
		expect(outputs[2]).toMatchObject({ kind: 'image', mime: 'image/svg+xml' });
		expect(outputs[2]?.kind === 'image' && outputs[2].src).toBe(
			'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E',
		);
		expect(outputs[3]).toEqual({ kind: 'unsupported', mimes: ['text/html'] });
	});

	it('merges adjacent streams and cleans error tracebacks', () => {
		const parsed = parseNotebook(
			nb([
				{
					cell_type: 'code',
					source: '',
					outputs: [
						{ output_type: 'stream', name: 'stdout', text: ['a\n'] },
						{ output_type: 'stream', name: 'stdout', text: 'b\n' },
						{ output_type: 'stream', name: 'stderr', text: 'warn\n' },
						{
							output_type: 'error',
							ename: 'KeyError',
							evalue: "'x'",
							traceback: ['\u001b[0;31m---\u001b[0m', 'KeyError: x'],
						},
					],
				},
			]),
		);
		expect(parsed.cells[0]?.executionCount).toBeNull();
		expect(parsed.cells[0]?.outputs).toEqual([
			{ kind: 'stream', name: 'stdout', text: 'a\nb\n' },
			{ kind: 'stream', name: 'stderr', text: 'warn\n' },
			{ kind: 'error', ename: 'KeyError', evalue: "'x'", traceback: '---\nKeyError: x' },
		]);
	});

	it('skips malformed cells and rejects non-notebooks', () => {
		expect(
			parseNotebook(nb([null, { cell_type: 'weird' }, { cell_type: 'raw' }])).cells,
		).toEqual([{ id: 'cell-2', kind: 'raw', source: '', executionCount: null, outputs: [] }]);
		expect(() => parseNotebook('{')).toThrow(/Not valid JSON/);
		expect(() => parseNotebook('[]')).toThrow(/Not a Jupyter notebook/);
		expect(() => parseNotebook('{"nbformat":3,"worksheets":[]}')).toThrow(/nbformat 3/);
	});
});

describe('joinSource', () => {
	it('handles strings, arrays and junk', () => {
		expect(joinSource('a')).toBe('a');
		expect(joinSource(['a\n', 1, 'b'])).toBe('a\nb');
		expect(joinSource(undefined)).toBe('');
	});
});

describe('notebookToScript', () => {
	it('writes percent-format cells', () => {
		const script = notebookToScript({
			cells: [
				{
					id: '1',
					kind: 'markdown',
					source: '# Title\n\nSome text\n',
					executionCount: null,
					outputs: [],
				},
				{
					id: '2',
					kind: 'code',
					source: 'import numpy as np\nx = 1\n\n',
					executionCount: 1,
					outputs: [],
				},
				{ id: '3', kind: 'code', source: '', executionCount: null, outputs: [] },
			],
		});
		expect(script).toBe(
			'# %% [markdown]\n# # Title\n#\n# Some text\n\n# %%\nimport numpy as np\nx = 1\n\n# %%\n',
		);
	});
});

describe('scriptFileName', () => {
	it('never collides with existing files (case-insensitively)', () => {
		expect(scriptFileName('train.ipynb', new Set())).toBe('train.py');
		expect(scriptFileName('train.ipynb', new Set(['Train.py']))).toBe('train_cells.py');
		expect(scriptFileName('train.ipynb', new Set(['train.py', 'train_cells.py']))).toBe(
			'train_cells2.py',
		);
		expect(
			scriptFileName(
				'train.ipynb',
				new Set(['train.py', 'train_cells.py', 'train_cells2.py']),
			),
		).toBe('train_cells3.py');
	});
});
