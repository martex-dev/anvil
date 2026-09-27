import type { editor } from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
vi.mock('../../lib/ipc', () => ({ call: (...args: unknown[]) => call(...args) as unknown }));
const models = new Map<string, editor.ITextModel>();
vi.mock('../editor/buffers', () => ({ getModel: (path: string) => models.get(path) ?? null }));

const { replaceAcross, replaceInModel, targetsFor } = await import('./replace');

/** Just enough of a Monaco model: lines, and edits applied as whole-line replacements. */
function fakeModel(text: string): editor.ITextModel & { lines: string[]; stack: string[] } {
	const lines = text.split('\n');
	const stack: string[] = [];
	return {
		lines,
		stack,
		getLineCount: () => lines.length,
		getLineContent: (n: number) => lines[n - 1] ?? '',
		getLineMaxColumn: (n: number) => (lines[n - 1] ?? '').length + 1,
		pushStackElement: () => stack.push('|'),
		pushEditOperations: (_: unknown, edits: editor.IIdentifiedSingleEditOperation[]) => {
			for (const e of edits) lines[e.range.startLineNumber - 1] = e.text ?? '';
			stack.push('edit');
			return null;
		},
	} as unknown as editor.ITextModel & { lines: string[]; stack: string[] };
}

beforeEach(() => {
	call.mockReset();
	models.clear();
});

describe('replaceInModel', () => {
	it('edits the listed lines as one undo step and counts lines that no longer match', () => {
		const model = fakeModel('price = 1\nprice price\nno match now\n');
		const r = replaceInModel(model, [1, 2, 3, 9], { query: 'price' }, 'cost');
		expect(r).toEqual({ count: 3, stale: 2 });
		expect(model.lines).toEqual(['cost = 1', 'cost cost', 'no match now', '']);
		expect(model.stack).toEqual(['|', 'edit', '|']);
	});
});

describe('replaceAcross', () => {
	it('edits open buffers in place and sends only unopened files to main', async () => {
		const open = fakeModel('let price = 1');
		models.set('src/open.ts', open);
		call.mockResolvedValue({ replaced: 2, files: ['src/disk.ts'], skipped: [] });
		const files = [
			{ path: 'src/open.ts', matches: [{ line: 1, column: 5, text: '', ranges: [] }] },
			{
				path: 'src/disk.ts',
				mtimeMs: 42,
				matches: [
					{ line: 3, column: 1, text: '', ranges: [] },
					{ line: 3, column: 9, text: '', ranges: [] },
				],
			},
		];
		const result = await replaceAcross({ query: 'price' }, 'cost', targetsFor(files));
		expect(open.lines).toEqual(['let cost = 1']);
		expect(call).toHaveBeenCalledWith('search:replace', {
			query: { query: 'price' },
			replacement: 'cost',
			files: [{ path: 'src/disk.ts', lines: [3], mtimeMs: 42 }],
		});
		expect(result).toEqual({ replaced: 3, files: ['src/open.ts', 'src/disk.ts'], skipped: [] });
	});
});
