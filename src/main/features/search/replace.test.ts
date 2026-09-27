import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { replaceInFiles } from './replace';

let root: string;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'anvil-replace-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (name: string, content: string | Buffer): number => {
	writeFileSync(join(root, name), content);
	return statSync(join(root, name)).mtimeMs;
};
const read = (name: string): string => readFileSync(join(root, name), 'utf8');

describe('replaceInFiles', () => {
	it('rewrites only the seen lines, keeping a BOM and CRLF line endings', async () => {
		const mtimeMs = write('a.py', '﻿old = 1\r\nold()\r\nkeep old\r\n');
		const result = await replaceInFiles(root, { query: 'old' }, 'new', [
			{ path: 'a.py', lines: [1, 2], mtimeMs },
		]);
		expect(result).toEqual({ replaced: 2, files: ['a.py'], skipped: [] });
		expect(read('a.py')).toBe('﻿new = 1\r\nnew()\r\nkeep old\r\n');
	});

	it('keeps a Windows-1252 file in Windows-1252', async () => {
		// "café price" in Windows-1252: é is the single byte 0xE9.
		const mtimeMs = write(
			'legacy.csv',
			Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x70, 0x72, 0x69, 0x63, 0x65]),
		);
		const result = await replaceInFiles(root, { query: 'price' }, 'coût', [
			{ path: 'legacy.csv', lines: [1], mtimeMs },
		]);
		expect(result.replaced).toBe(1);
		expect([...readFileSync(join(root, 'legacy.csv'))]).toEqual([
			0x63, 0x61, 0x66, 0xe9, 0x20, 0x63, 0x6f, 0xfb, 0x74,
		]);
	});

	it('uses capture groups in regex mode and keeps "$1" literal otherwise', async () => {
		write('r.py', 'a = 1\nb = 2\n');
		await replaceInFiles(root, { query: '(\\w) = (\\d)', regex: true }, '$2 = $1', [
			{ path: 'r.py', lines: [1, 2] },
		]);
		expect(read('r.py')).toBe('1 = a\n2 = b\n');
		write('l.txt', 'cost\n');
		await replaceInFiles(root, { query: 'cost' }, '$1 & $&', [{ path: 'l.txt', lines: [1] }]);
		expect(read('l.txt')).toBe('$1 & $&\n');
	});

	it('skips files that changed since the search, and refuses paths outside the folder', async () => {
		const mtimeMs = write('moved.py', 'x\nold\n');
		write('edited.py', 'old\n');
		const past = new Date(Date.now() - 60_000);
		utimesSync(join(root, 'edited.py'), past, past);
		const result = await replaceInFiles(root, { query: 'old' }, 'new', [
			// A line was inserted above the match: line 1 no longer matches.
			{ path: 'moved.py', lines: [1], mtimeMs },
			{ path: 'edited.py', lines: [1], mtimeMs: Date.now() },
			{ path: '../escape.py', lines: [1] },
		]);
		expect(result.replaced).toBe(0);
		expect(result.skipped.map((s) => s.path)).toEqual([
			'moved.py',
			'edited.py',
			'../escape.py',
		]);
		expect(result.skipped[0]?.reason).toBe('changed since the search');
		expect(result.skipped[1]?.reason).toBe('changed since the search');
		expect(read('moved.py')).toBe('x\nold\n');
	});

	it('rejects a pattern JavaScript cannot run', async () => {
		await expect(
			replaceInFiles(root, { query: '(', regex: true }, 'x', [{ path: 'a.py', lines: [1] }]),
		).rejects.toMatchObject({ code: 'SEARCH_BAD_QUERY' });
	});
});
