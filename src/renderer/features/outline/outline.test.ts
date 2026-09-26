import { describe, expect, it } from 'vitest';

import { outlineFor, symbolPath } from './outline';

const py = [
	'import numpy as np',
	'',
	'WINDOW = 20',
	'',
	'# %% Features',
	'class Strategy:',
	'\tdef __init__(self, n: int):',
	'\t\tself.n = n',
	'',
	'\tasync def signal(self, px):',
	'\t\treturn px',
	'',
	'def sharpe(r, periods=252):',
	'\treturn r.mean() / r.std()',
];

describe('outline', () => {
	it('finds python classes, methods, functions, constants and cells', () => {
		const s = outlineFor('python', py);
		expect(s.map((x) => [x.name, x.kind, x.line, x.depth])).toEqual([
			['WINDOW', 'variable', 3, 0],
			['Features', 'cell', 5, 0],
			['Strategy', 'class', 6, 0],
			['__init__', 'method', 7, 1],
			['signal', 'method', 10, 1],
			['sharpe', 'function', 13, 0],
		]);
		expect(s.find((x) => x.name === 'Strategy')?.end).toBe(12);
	});

	it('tells which symbol the cursor is in', () => {
		const s = outlineFor('python', py);
		expect(symbolPath(s, 11).map((x) => x.name)).toEqual(['Strategy', 'signal']);
		expect(symbolPath(s, 14).map((x) => x.name)).toEqual(['sharpe']);
	});

	it('handles typescript and markdown', () => {
		const ts = [
			'export interface Bar { t: number }',
			'export const fetchBars = async (s: string) => {',
			'};',
			'export class Feed {',
			'\tasync connect(url: string): Promise<void> {',
			'\t\tif (x) {',
			'\t}',
			'}',
		];
		expect(outlineFor('typescript', ts).map((x) => [x.name, x.kind])).toEqual([
			['Bar', 'type'],
			['fetchBars', 'function'],
			['Feed', 'class'],
			['connect', 'method'],
		]);
		const md = ['# Title', '```', '# not a heading', '```', '## Sub'];
		expect(outlineFor('markdown', md).map((x) => [x.name, x.depth])).toEqual([
			['Title', 0],
			['Sub', 1],
		]);
	});
});
