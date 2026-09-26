import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { rgArgs, Ripgrep } from './ripgrep';

let root: string;

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), 'anvil-rg-'));
	const write = (rel: string, text: string): void => {
		const abs = join(root, ...rel.split('/'));
		mkdirSync(join(abs, '..'), { recursive: true });
		writeFileSync(abs, text);
	};
	write('src/app.ts', 'const Price = 1;\nexport function price() {\n\treturn Price * 2;\n}\n');
	write('src/util.py', 'def price_feed():\n    return "price"\n');
	write('node_modules/lib/index.js', 'price everywhere');
	write('notes.md', 'The price is right. Priceless.');
	write('.github/workflows/ci.yml', 'run: check-price');
	write('.git/config', 'price = internal');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('rgArgs', () => {
	it('maps options to flags and always passes the query after --', () => {
		const args = rgArgs({ query: '-x', regex: false, include: 'src/**', exclude: '*.md' });
		expect(args).toContain('--fixed-strings');
		expect(args).toContain('--ignore-case');
		expect(args.slice(-3)).toEqual(['--', '-x', '.']);
		expect(args.join(' ')).toContain('--glob src/** --glob !*.md');
	});
});

describe('Ripgrep (real binary)', () => {
	const rg = new Ripgrep();

	it('finds case-insensitive literal matches, in dotfiles too, skipping node_modules and .git', async () => {
		const result = await rg.search(root, { query: 'price' });
		const paths = result.files.map((f) => f.path).sort();
		expect(paths).toEqual([
			'.github/workflows/ci.yml',
			'notes.md',
			'src/app.ts',
			'src/util.py',
		]);
		const app = result.files.find((f) => f.path === 'src/app.ts');
		expect(app?.matches.map((m) => [m.line, m.column])).toEqual([
			[1, 7],
			[2, 17],
			[3, 9],
		]);
		expect(result.truncated).toBe(false);
	});

	it('honours case, whole word, regex and globs', async () => {
		const exact = await rg.search(root, {
			query: 'Price',
			caseSensitive: true,
			wholeWord: true,
		});
		expect(exact.matchCount).toBe(2); // "Price" twice in app.ts, not "Priceless"
		const regex = await rg.search(root, { query: 'def \\w+', regex: true, include: '*.py' });
		expect(regex.files.map((f) => f.matches[0]?.text)).toEqual(['def price_feed():']);
		const none = await rg.search(root, { query: 'no-such-text' });
		expect(none.files).toEqual([]);
	});

	it('reports an invalid regex as a readable error', async () => {
		await expect(rg.search(root, { query: '(unclosed', regex: true })).rejects.toMatchObject({
			code: 'SEARCH_BAD_QUERY',
		});
	});
});
