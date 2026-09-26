import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TemplateDef } from './catalog';
import { writeTemplate } from './write-template';

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-tpl-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function template(files: Record<string, string>): TemplateDef {
	return { id: 't', name: 'T', description: 'd', tags: ['x'], files };
}

describe('writeTemplate', () => {
	it('writes every file and fills in the project name', () => {
		const root = writeTemplate(
			template({ 'README.md': '# {{name}}\n', 'src/app/main.py': 'x = 1\n' }),
			dir,
			'demo',
		);
		expect(root).toBe(join(dir, 'demo'));
		expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('# demo\n');
		expect(existsSync(join(root, 'src', 'app', 'main.py'))).toBe(true);
	});

	it('refuses an existing folder', () => {
		writeTemplate(template({ 'a.txt': '' }), dir, 'demo');
		expect(() => writeTemplate(template({ 'a.txt': '' }), dir, 'demo')).toThrow(
			expect.objectContaining({ code: 'TEMPLATE_EXISTS' }),
		);
	});

	it('checks every path before creating anything', () => {
		expect(() =>
			writeTemplate(template({ 'ok.txt': 'x', '../evil.txt': 'x' }), dir, 'demo'),
		).toThrow(expect.objectContaining({ code: 'TEMPLATE_BAD_PATH' }));
		expect(existsSync(join(dir, 'demo'))).toBe(false);
	});

	it('removes the half-written folder when a write fails, so a retry works', () => {
		// 'a' is written as a file, so creating the folder 'a/' for 'a/b.txt' fails midway.
		const broken = template({ a: 'file', 'a/b.txt': 'x' });
		expect(() => writeTemplate(broken, dir, 'demo')).toThrow(
			expect.objectContaining({ code: 'TEMPLATE_WRITE_FAILED' }),
		);
		expect(existsSync(join(dir, 'demo'))).toBe(false);
		expect(() => writeTemplate(template({ 'a.txt': '' }), dir, 'demo')).not.toThrow();
	});
});
